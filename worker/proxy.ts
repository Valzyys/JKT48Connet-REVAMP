/**
 * Proxy privat `/api/*` → https://api.jkt48connect.app dengan API key dari secret server.
 * Dipakai bersama oleh Cloudflare Workers (worker/index.ts), Pages Functions
 * (functions/api/[[path]].ts), dan dev server Vite (vite.config.ts).
 *
 * Lapisan perlindungan (urut):
 *   1. Hanya GET/HEAD (kecuali POST /api/session), hanya dari origin situs sendiri.
 *   2. Wajib cookie sesi bertanda tangan HMAC (dibuat POST /api/session, opsional lewat Turnstile).
 *   3. Rate limit per sesi dan pembuatan sesi per IP.
 *   4. Route & parameter query di-allowlist ketat dan dibatasi; parameter lain ditolak (tidak ada cache-busting).
 *   5. Respons upstream dinormalisasi di server (src/lib/shape.ts): browser tidak pernah melihat JSON mentah.
 *   6. Replay: URL file tidak dikirim selama 72 jam; setelahnya diganti token AES-GCM yang terikat sesi
 *      dan kedaluwarsa, lalu di-stream lewat `/api/replay`.
 *   7. Pesan error generik; detail hanya di log Worker.
 */

import {
  shapeBirthdays,
  shapeLive,
  shapeMember,
  shapeMembers,
  shapeNews,
  shapeNewsList,
  shapeNextSchedule,
  shapeRecent,
  shapeRecentList,
  shapeTheater,
  shapeTheaterList,
  shapeVideos,
  type RecentDetail,
} from "../src/lib/shape";
import {
  allow,
  API_HEADERS,
  clientIp,
  issueSession,
  json,
  keys,
  openReplay,
  readSession,
  sameOrigin,
  sealReplay,
  SESSION_TTL,
  verifyTurnstile,
  type SecurityEnv,
  type Session,
} from "./security";

export interface ProxyEnv extends SecurityEnv {
  /** Secret: `wrangler secret put JKT48CONNECT_API_KEY` */
  JKT48CONNECT_API_KEY?: string;
  /** Opsional, default https://api.jkt48connect.app */
  API_UPSTREAM?: string;
  /** Hanya untuk dev server Node (lewat proxy keluar); Workers memakai fetch bawaan. */
  UPSTREAM_FETCH?: typeof fetch;
}

type Ctx = { waitUntil(p: Promise<unknown>): void };
type Keys = NonNullable<Awaited<ReturnType<typeof keys>>>;

/* ───────────────────────────── Route ───────────────────────────── */

type Params = Record<string, number>;

/** Validator parameter query: nilai valid → angka, selain itu null (400). */
const int = (min: number, max: number, def: number) => (v: string | null) => {
  if (v === null) return def;
  if (!/^\d{1,6}$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};
const page = int(1, 1000, 1);

type Route = {
  re: RegExp;
  /** Detik di edge cache. */
  ttl: number;
  query?: Record<string, (v: string | null) => number | null>;
  upstream: (m: string[], q: Params) => string;
  shape: (raw: any, m: string[], q: Params) => unknown;
  /** Respons membawa rekaman replay: dikunci/diganti token per sesi sebelum dikirim. */
  replay?: true;
};

/** ID: huruf/angka/._- , tidak diawali titik (menutup `..`), maksimal 100 karakter. */
const ID = "([A-Za-z0-9_-][A-Za-z0-9._-]{0,99})";
const id = (base: string) => new RegExp(`^/api/${base}/${ID}$`);
const qs = (q: Params) => `?${new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)]))}`;

/** Hanya endpoint yang dipakai UI; segala sub-path/parameter lain → 404/400. */
const ROUTES: Route[] = [
  { re: /^\/api\/member$/, ttl: 300, upstream: () => "/api/member", shape: shapeMembers },
  { re: id("member"), ttl: 300, upstream: ([m]) => `/api/member/${encodeURIComponent(m)}`, shape: (r, [m]) => shapeMember(r, m) },
  { re: /^\/api\/now_live$/, ttl: 20, upstream: () => "/api/now_live?group=jkt48", shape: shapeLive },
  {
    re: /^\/api\/theater$/,
    ttl: 300,
    query: { page, perpage: int(1, 40, 12) },
    upstream: (_, q) => `/api/theater${qs(q)}`,
    shape: (r, _, q) => shapeTheaterList(r, q.page, q.perpage),
  },
  { re: id("theater"), ttl: 300, upstream: ([t]) => `/api/theater/${encodeURIComponent(t)}`, shape: (r, [t]) => shapeTheater(r, t) },
  { re: /^\/api\/next_schedule$/, ttl: 300, upstream: () => "/api/next_schedule", shape: shapeNextSchedule },
  {
    re: /^\/api\/news$/,
    ttl: 300,
    query: { page, perpage: int(1, 40, 10) },
    upstream: (_, q) => `/api/news${qs(q)}`,
    shape: (r, _, q) => shapeNewsList(r, q.page, q.perpage),
  },
  { re: id("news"), ttl: 300, upstream: ([n]) => `/api/news/${encodeURIComponent(n)}`, shape: (r, [n]) => shapeNews(r, n) },
  { re: /^\/api\/next_birthday$/, ttl: 300, upstream: () => "/api/next_birthday", shape: shapeBirthdays },
  {
    re: /^\/api\/recent$/,
    ttl: 60,
    query: { page, perpage: int(1, 40, 12) },
    upstream: (_, q) => `/api/recent${qs(q)}`,
    shape: (r, _, q) => shapeRecentList(r, q.page, q.perpage),
  },
  { re: id("recent"), ttl: 60, upstream: ([r]) => `/api/recent/${encodeURIComponent(r)}`, shape: (raw, [r]) => shapeRecent(raw, r), replay: true },
  { re: /^\/api\/jkt48_youtube$/, ttl: 300, upstream: () => "/api/jkt48_youtube", shape: shapeVideos },
];

const STALE_TTL = 60 * 60 * 24; // salinan cadangan bila upstream gagal
/** Umur token replay; cukup untuk menonton rekaman panjang tanpa membuat tautan yang bisa dipakai lama. */
const REPLAY_TOKEN_TTL = 6 * 60 * 60;

function edgeCache(): Cache | undefined {
  return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
}

/* ───────────────────────────── Entry ───────────────────────────── */

export async function handleApi(request: Request, env: ProxyEnv, ctx: Ctx): Promise<Response> {
  try {
    return await route(request, env, ctx);
  } catch (err) {
    console.error("api error", err);
    return json({ status: 500, message: "Terjadi kesalahan" }, 500);
  }
}

async function route(request: Request, env: ProxyEnv, ctx: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const k = await keys(env);
  if (!k || !env.JKT48CONNECT_API_KEY) {
    console.error("JKT48CONNECT_API_KEY belum diset (npm run cf:secret)");
    return json({ status: 503, message: "Layanan belum tersedia" }, 503);
  }

  if (url.pathname === "/api/session") return handleSession(request, env, k, url);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ status: 405, message: "Method tidak diizinkan" }, 405, { allow: "GET, HEAD" });
  }
  if (!sameOrigin(request)) return json({ status: 403, message: "Akses ditolak" }, 403);

  const session = await readSession(k, request);
  if (!session) return json({ status: 401, code: "session_required", message: "Sesi diperlukan" }, 401);
  if (!(await allow(env.API_LIMITER, `s:${session.sid}`, 300))) {
    return json({ status: 429, message: "Terlalu banyak permintaan, coba lagi sebentar" }, 429, { "retry-after": "30" });
  }

  let res: Response;
  if (url.pathname === "/api/media") res = await handleMedia(url, env, ctx);
  else if (url.pathname === "/api/replay") res = await handleReplay(request, url, env, k, session);
  else res = await handleData(url, env, ctx, k, session);

  // Sesi geser: perpanjang cookie bila sisa umurnya < separuh.
  if (session.exp - Date.now() / 1000 < SESSION_TTL / 2) {
    const fresh = await issueSession(k, url, session.sid);
    res = new Response(res.body, res);
    res.headers.append("set-cookie", fresh.cookie);
  }
  return res;
}

/* ───────────────────────────── Sesi ───────────────────────────── */

async function handleSession(request: Request, env: ProxyEnv, k: Keys, url: URL): Promise<Response> {
  if (request.method !== "POST") return json({ status: 405, message: "Method tidak diizinkan" }, 405, { allow: "POST" });
  if (!sameOrigin(request)) return json({ status: 403, message: "Akses ditolak" }, 403);

  const existing = await readSession(k, request);
  if (existing && existing.exp - Date.now() / 1000 > SESSION_TTL / 2) return json({ status: 200, exp: existing.exp }, 200);

  const ip = clientIp(request);
  if (!(await allow(env.SESSION_LIMITER, `ip:${ip}`, 20))) {
    return json({ status: 429, message: "Terlalu banyak permintaan, coba lagi sebentar" }, 429, { "retry-after": "60" });
  }

  if (env.TURNSTILE_SECRET_KEY) {
    const text = await request.text();
    if (text.length > 4096) return json({ status: 400, message: "Permintaan tidak valid" }, 400);
    let token = "";
    try {
      token = String(JSON.parse(text)?.turnstile ?? "");
    } catch {
      /* token kosong → ditolak di bawah */
    }
    if (!(await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, ip))) {
      return json({ status: 403, message: "Verifikasi keamanan gagal" }, 403);
    }
  }

  const { session, cookie } = await issueSession(k, url, existing?.sid);
  return json({ status: 200, exp: session.exp }, 200, { "set-cookie": cookie });
}

/* ───────────────────────────── Data JSON ───────────────────────────── */

async function handleData(url: URL, env: ProxyEnv, ctx: Ctx, k: Keys, session: Session): Promise<Response> {
  let match: RegExpExecArray | null = null;
  const r = ROUTES.find((x) => (match = x.re.exec(url.pathname)));
  if (!r || !match) return json({ status: 404, message: "Endpoint tidak tersedia" }, 404);
  const m = (match as RegExpExecArray).slice(1);

  // Parameter di luar allowlist ditolak, jadi URL acak tidak bisa memaksa cache miss ke upstream.
  const q: Params = {};
  for (const key of url.searchParams.keys()) {
    if (!r.query?.[key] || url.searchParams.getAll(key).length > 1) return json({ status: 400, message: "Parameter tidak valid" }, 400);
  }
  for (const [key, check] of Object.entries(r.query ?? {})) {
    const v = check(url.searchParams.get(key));
    if (v === null) return json({ status: 400, message: "Parameter tidak valid" }, 400);
    q[key] = v;
  }

  const path = r.upstream(m, q);
  const cache = edgeCache();
  const freshKey = new Request(`${url.origin}/__cache/v2${path}`);
  const staleKey = new Request(`${url.origin}/__cache/v2/stale${path}`);

  let body = await cache?.match(freshKey).then((h) => h?.text());
  if (body === undefined) {
    const got = await fetchUpstream(path, env);
    if (got.ok) {
      body = JSON.stringify(r.shape(got.data, m, q));
      if (cache) {
        const put = (ttl: number) =>
          new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${ttl}` } });
        ctx.waitUntil(Promise.all([cache.put(freshKey, put(r.ttl)), cache.put(staleKey, put(STALE_TTL))]));
      }
    } else {
      const stale = got.status >= 500 ? await cache?.match(staleKey).then((h) => h?.text()) : undefined;
      if (stale === undefined) return json({ status: got.status, message: got.message }, got.status, got.headers);
      body = stale;
    }
  }

  if (r.replay) {
    body = JSON.stringify(await gateReplay(JSON.parse(body) as RecentDetail, k, session));
  }

  return new Response(body, {
    headers: {
      ...API_HEADERS,
      "content-type": "application/json; charset=utf-8",
      // Respons privat per sesi: tidak boleh disimpan cache bersama (CDN/proxy). Detail recent membawa token sesi.
      "cache-control": r.replay ? "private, no-store" : `private, max-age=${Math.min(r.ttl, 60)}`,
      vary: "Cookie",
    },
  });
}

type Upstream =
  | { ok: true; data: unknown }
  | { ok: false; status: number; message: string; headers: Record<string, string> };

async function fetchUpstream(path: string, env: ProxyEnv): Promise<Upstream> {
  const base = (env.API_UPSTREAM || "https://api.jkt48connect.app").replace(/\/+$/, "");
  const doFetch = env.UPSTREAM_FETCH ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${base}${path}`, {
      headers: { "X-API-Key": env.JKT48CONNECT_API_KEY!, Accept: "application/json" },
      redirect: "error",
      cf: { cacheTtl: 0 },
    } as RequestInit);
  } catch (err) {
    console.error("upstream fetch failed", path, err);
    return { ok: false, status: 502, message: "Sumber data tidak bisa dihubungi", headers: {} };
  }
  if (res.ok) {
    try {
      return { ok: true, data: await res.json() };
    } catch {
      console.error("upstream returned invalid JSON", path);
      return { ok: false, status: 502, message: "Sumber data tidak valid", headers: {} };
    }
  }
  // Isi error upstream (bisa memuat info kuota/key) tidak diteruskan ke browser.
  console.error("upstream status", res.status, path, (await res.text().catch(() => "")).slice(0, 300));
  if (res.status === 404) return { ok: false, status: 404, message: "Data tidak ditemukan", headers: {} };
  if (res.status === 429) {
    const retry = res.headers.get("retry-after");
    return { ok: false, status: 503, message: "Sumber data sedang sibuk, coba lagi sebentar", headers: retry && /^\d{1,5}$/.test(retry) ? { "retry-after": retry } : {} };
  }
  return { ok: false, status: 502, message: "Sumber data sedang bermasalah", headers: {} };
}

/* ───────────────────────────── Replay ───────────────────────────── */

/** Selama masa kunci tidak ada URL apa pun; setelahnya URL asli diganti token terenkripsi milik sesi ini. */
async function gateReplay(d: RecentDetail, k: Keys, session: Session): Promise<RecentDetail> {
  const unlock = Date.parse(d.replayUnlockAt);
  if (!Number.isFinite(unlock) || Date.now() < unlock) return { ...d, recordings: [] };
  const e = Math.floor(Date.now() / 1000) + REPLAY_TOKEN_TTL;
  return {
    ...d,
    recordings: await Promise.all(
      d.recordings.map(async (r) => ({ ...r, url: `/api/replay?t=${await sealReplay(k, { u: r.url, s: session.sid, e })}` })),
    ),
  };
}

async function handleReplay(request: Request, url: URL, env: ProxyEnv, k: Keys, session: Session): Promise<Response> {
  const token = url.searchParams.get("t") ?? "";
  if ([...url.searchParams.keys()].some((x) => x !== "t")) return json({ status: 400, message: "Parameter tidak valid" }, 400);
  const data = await openReplay(k, token);
  if (!data) return json({ status: 404, message: "Replay tidak ditemukan" }, 404);
  // Tautan yang disalin ke browser/orang lain tidak berlaku (sesi berbeda).
  if (data.s !== session.sid) return json({ status: 403, message: "Replay hanya bisa diputar dari halaman situs" }, 403);
  if (data.e < Date.now() / 1000) return json({ status: 410, message: "Tautan replay kedaluwarsa, muat ulang halaman" }, 410);

  const target = new URL(data.u);
  if (target.protocol !== "https:" || !target.pathname.endsWith(".mp4")) return json({ status: 404, message: "Replay tidak ditemukan" }, 404);

  const range = request.headers.get("range");
  const headers: Record<string, string> = { Accept: "video/mp4,*/*;q=0.5" };
  if (range && /^bytes=\d*-\d*$/.test(range)) headers.Range = range;

  let upstream: Response;
  try {
    upstream = await (env.UPSTREAM_FETCH ?? fetch)(target.href, { method: request.method, headers });
  } catch (err) {
    console.error("replay fetch failed", err);
    return json({ status: 502, message: "Replay tidak bisa diambil" }, 502);
  }
  if (![200, 206, 416].includes(upstream.status)) {
    console.error("replay upstream status", upstream.status);
    return json({ status: 502, message: "Replay tidak bisa diambil" }, 502);
  }

  const out = new Headers({
    ...API_HEADERS,
    "content-type": "video/mp4",
    "content-disposition": "inline",
    "cache-control": "private, no-store",
    "accept-ranges": "bytes",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

/* ───────────────────────────── Media (gambar berita) ───────────────────────────── */

/** Host gambar yang boleh dilewatkan `/api/media`. */
export const MEDIA_HOSTS = /(^|\.)jkt48\.com$/;
const MEDIA_TTL = 60 * 60 * 24 * 7;
const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
/** SVG sengaja tidak termasuk: bisa memuat script bila dibuka langsung di origin ini. */
const MEDIA_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;

const mediaAllowed = (u: URL) => u.protocol === "https:" && MEDIA_HOSTS.test(u.hostname) && !u.username && !u.password && !u.port;

/**
 * `/api/media?url=…` — gambar di berita jkt48.com menolak hotlink (403 bila Referer dari domain lain)
 * dan dikirim dengan `Cross-Origin-Resource-Policy: same-site`, sehingga browser tidak mau menampilkannya.
 * Worker mengambilnya dari server tanpa Referer lalu menyajikannya dari domain situs sendiri.
 */
async function handleMedia(url: URL, env: ProxyEnv, ctx: Ctx): Promise<Response> {
  if ([...url.searchParams.keys()].some((x) => x !== "url")) return json({ status: 400, message: "Parameter tidak valid" }, 400);
  let target: URL;
  try {
    target = new URL(url.searchParams.get("url") ?? "");
  } catch {
    return json({ status: 400, message: "Parameter url tidak valid" }, 400);
  }
  if (!mediaAllowed(target) || target.href.length > 2048) return json({ status: 403, message: "Host gambar tidak diizinkan" }, 403);

  const cache = edgeCache();
  const key = new Request(`${url.origin}/__cache/v2/media?url=${encodeURIComponent(target.href)}`);
  const hit = await cache?.match(key);
  if (hit) return mediaResponse(hit.body, hit.headers.get("content-type") ?? "image/jpeg");

  // Redirect diikuti manual supaya setiap lompatan tetap di host yang diizinkan (tidak jadi open proxy).
  let upstream: Response | null = null;
  let current = target;
  try {
    for (let hop = 0; hop < 4; hop++) {
      const res = await (env.UPSTREAM_FETCH ?? fetch)(current.href, {
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif", "User-Agent": "Mozilla/5.0 (JKT48Connect media proxy)" },
        redirect: "manual",
      });
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!loc) {
        upstream = res;
        break;
      }
      current = new URL(loc, current);
      if (!mediaAllowed(current)) return json({ status: 403, message: "Host gambar tidak diizinkan" }, 403);
    }
  } catch {
    return json({ status: 502, message: "Gambar tidak bisa diambil" }, 502);
  }
  if (!upstream) return json({ status: 502, message: "Gambar tidak bisa diambil" }, 502);

  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!upstream.ok || !MEDIA_TYPES.test(type)) {
    return json({ status: upstream.ok ? 415 : 502, message: "Bukan gambar" }, upstream.ok ? 415 : 502);
  }
  if (Number(upstream.headers.get("content-length") ?? 0) > MEDIA_MAX_BYTES) return json({ status: 413, message: "Gambar terlalu besar" }, 413);
  const bytes = await readCapped(upstream.body, MEDIA_MAX_BYTES);
  if (!bytes) return json({ status: 413, message: "Gambar terlalu besar" }, 413);

  if (cache) {
    ctx.waitUntil(cache.put(key, new Response(bytes, { headers: { "content-type": type, "cache-control": `public, max-age=${MEDIA_TTL}` } })));
  }
  return mediaResponse(bytes, type);
}

function mediaResponse(body: BodyInit | null, type: string) {
  return new Response(body, { headers: { ...API_HEADERS, "content-type": type, "cache-control": "private, max-age=86400", vary: "Cookie" } });
}

async function readCapped(stream: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
