/**
 * Proxy privat `/api/*` → https://api.jkt48connect.app dengan API key dari secret server.
 * Dipakai bersama oleh Cloudflare Workers (worker/index.ts), Pages Functions
 * (functions/api/[[path]].ts), dan dev server Vite (vite.config.ts).
 *
 * Lapisan perlindungan (urut):
 *   1. Penjaga anti-iseng (worker/guard.ts): IP yang sudah terblokir langsung mendapat halaman blokir.
 *      Setiap upaya mengakali di bawah ini menambah poin curiga; melewati ambang → blokir berjenjang.
 *   2. Hanya GET/HEAD (kecuali POST /api/session), hanya dari origin situs sendiri.
 *   3. Wajib cookie sesi bertanda tangan HMAC (dibuat POST /api/session lewat tukar kunci ECDH, opsional Turnstile).
 *   4. Request data wajib bertanda tangan HMAC per sesi + timestamp + nonce (src/lib/wire.ts): request yang
 *      disalin/diputar ulang atau dibuat tanpa kunci sesi ditolak.
 *   5. Rate limit per sesi dan pembuatan sesi per IP.
 *   6. Route & parameter query di-allowlist ketat dan dibatasi; parameter lain ditolak (tidak ada cache-busting).
 *   7. Respons upstream dinormalisasi di server (src/lib/shape.ts) lalu DIENKRIPSI AES-256-GCM dengan kunci
 *      sesi: isi jaringan/HAR tidak terbaca dan tidak bisa dipakai sesi lain.
 *   8. Replay: URL file tidak dikirim selama 72 jam; setelahnya diganti token AES-GCM yang terikat sesi
 *      dan kedaluwarsa, lalu di-stream lewat `/api/replay`.
 *   9. Pesan error generik; detail hanya di log Worker.
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
import { canonical, H, MAX_SKEW_MS, seal, verify, WIRE_VERSION } from "../src/lib/wire";
import { denyPage, guardFor, INCIDENT_RE, maskIp, newIncident, REASON_LABEL, unblock, type Block, type GuardNamespace, type Reason } from "./guard";
import {
  allow,
  API_HEADERS,
  clientIp,
  exchangeKey,
  freshNonce,
  issueSession,
  json,
  keys,
  openReplay,
  originCheck,
  readSession,
  sealReplay,
  sessionKeys,
  SESSION_TTL,
  verifyTurnstile,
  type Keys,
  type SecurityEnv,
  type Session,
} from "./security";

export interface ProxyEnv extends SecurityEnv {
  /** Secret: `wrangler secret put JKT48CONNECT_API_KEY` */
  JKT48CONNECT_API_KEY?: string;
  /** Opsional, default https://api.jkt48connect.app */
  API_UPSTREAM?: string;
  /** Durable Object penjaga (wrangler.jsonc). Tanpa binding (Pages/dev) dipakai penyimpanan per-isolate. */
  GUARD?: GuardNamespace;
  /** "1" mematikan pemblokiran otomatis (darurat, mis. salah blokir massal). Pelanggaran tetap ditolak. */
  GUARD_DISABLED?: string;
  /**
   * Secret (≥ 24 karakter) untuk `POST /api/admin/unblock` (lihat scripts/guard-unblock.mjs).
   * Tanpa secret ini endpoint admin tidak ada.
   */
  GUARD_ADMIN_TOKEN?: string;
  /** Mengganti nilainya (mis. "2" → "3") mengosongkan semua blokir sekaligus tanpa deploy kode. */
  GUARD_EPOCH?: string;
  /** Hanya untuk dev server Node (lewat proxy keluar); Workers memakai fetch bawaan. */
  UPSTREAM_FETCH?: typeof fetch;
}

type Ctx = { waitUntil(p: Promise<unknown>): void };

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

/* ───────────────────────────── Konteks & penolakan ───────────────────────────── */

type Call = { request: Request; url: URL; env: ProxyEnv; ctx: Ctx; ip: string; guard: ReturnType<typeof guardFor> };

const te = new TextEncoder();

/** Dibuka langsung sebagai halaman (address bar, tab baru) → balas HTML, bukan JSON. */
function isNavigation(request: Request) {
  const mode = request.headers.get("sec-fetch-mode");
  if (mode) return mode === "navigate";
  return (request.headers.get("accept") ?? "").includes("text/html");
}

function html(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      ...API_HEADERS,
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    },
  });
}

/** Respons untuk IP yang sedang diblokir: halaman HTML (navigasi) atau JSON `code: "blocked"` (dibaca UI). */
function blockedResponse(c: Call, b: Block) {
  if (isNavigation(c.request)) return html(denyPage({ blocked: true, ...b, ip: c.ip }), 403);
  return json(
    { status: 403, code: "blocked", message: "Akses diblokir", incident: b.incident, reason: b.reason, reasonLabel: REASON_LABEL[b.reason], at: b.at, until: b.until, ip: maskIp(c.ip) },
    403,
    { "retry-after": String(Math.max(1, Math.ceil((b.until - Date.now()) / 1000))) },
  );
}

/** Tolak + catat pelanggaran. Bila poin melewati ambang, langsung balas sebagai blokir. */
async function deny(c: Call, reason: Reason, status: number, message: string, detail = "", extra: Record<string, string> = {}): Promise<Response> {
  const v = await c.guard.strike(reason, `${c.request.method} ${c.url.pathname}${c.url.search} ${detail}`);
  if (v.blocked) return blockedResponse(c, v);
  if (isNavigation(c.request)) return html(denyPage({ blocked: false, incident: newIncident(), reason, ip: c.ip, at: Date.now() }), status);
  return json({ status, message }, status, extra);
}

const noGuard: Call["guard"] = { status: async () => ({ blocked: false, score: 0 }), strike: async () => ({ blocked: false, score: 0 }) };

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
  const ip = clientIp(request);
  const c: Call = { request, url, env, ctx, ip, guard: env.GUARD_DISABLED === "1" ? noGuard : guardFor(env.GUARD, ip, env.GUARD_EPOCH) };

  // Endpoint admin diperiksa sebelum status blokir: admin yang ikut terblokir tetap bisa membuka blokirnya sendiri.
  if (url.pathname === "/api/admin/unblock" && adminToken(env)) return handleUnblock(c);

  const verdict = await c.guard.status();
  if (verdict.blocked) return blockedResponse(c, verdict);

  const k = await keys(env);
  if (!k || !env.JKT48CONNECT_API_KEY) {
    console.error("JKT48CONNECT_API_KEY belum diset (npm run cf:secret)");
    return json({ status: 503, message: "Layanan belum tersedia" }, 503);
  }

  if (url.pathname === "/api/session") return handleSession(c, k);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return deny(c, "bad_method", 405, "Method tidak diizinkan", "", { allow: "GET, HEAD" });
  }
  const origin = originCheck(request);
  if (origin === "direct") return deny(c, "direct_access", 403, "Akses ditolak");
  if (origin === "cross") return deny(c, "cross_site", 403, "Akses ditolak", request.headers.get("origin") ?? request.headers.get("referer") ?? "");
  if (origin === "unknown") return json({ status: 403, message: "Akses ditolak" }, 403);

  // Cookie tidak ada / kedaluwarsa / tidak cocok (mis. SESSION_SECRET diganti) → klien membuat sesi baru, tanpa poin.
  const read = await readSession(k, request);
  if (!read.ok) return json({ status: 401, code: "session_required", message: "Sesi diperlukan" }, 401);
  const session = read.session;
  if (!(await allow(env.API_LIMITER, `s:${session.sid}`, 300))) {
    return deny(c, "rate_limit", 429, "Terlalu banyak permintaan, coba lagi sebentar", "", { "retry-after": "30" });
  }

  let res: Response;
  // <img>/<video> tidak bisa membawa header tanda tangan; keduanya dilindungi sesi + token/allowlist host.
  if (url.pathname === "/api/media") res = await handleMedia(c);
  else if (url.pathname === "/api/replay") res = await handleReplay(c, k, session);
  else {
    const bad = await checkSignature(c, k, session);
    res = bad ?? (await handleData(c, k, session));
  }

  // Sesi geser: perpanjang cookie bila sisa umurnya < separuh (id sesi & kunci tetap sama).
  if (session.exp - Date.now() / 1000 < SESSION_TTL / 2) {
    const fresh = await issueSession(k, url, session.sid);
    res = new Response(res.body, res);
    res.headers.append("set-cookie", fresh.cookie);
  }
  return res;
}

/* ───────────────────────────── Admin: buka blokir ───────────────────────────── */

const adminToken = (env: ProxyEnv) => ((env.GUARD_ADMIN_TOKEN ?? "").length >= 24 ? env.GUARD_ADMIN_TOKEN! : "");

/** Bandingkan token lewat digest SHA-256 supaya waktu pembandingan tidak membocorkan isi token. */
async function sameToken(a: string, b: string) {
  const [x, y] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(s)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const IP_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{2,39})$/i;

/**
 * `POST /api/admin/unblock` dengan header `Authorization: Bearer <GUARD_ADMIN_TOKEN>` dan body JSON:
 *   { "incident": "JC-XXXX-XXXX" }  → buka blokir IP pemilik insiden (dari screenshot pengguna)
 *   { "ip": "203.0.113.7" }         → buka blokir IP tertentu
 *   {}                              → buka blokir IP pemanggil sendiri
 * Token salah memberi poin curiga (admin_auth) seperti percobaan mengakali lainnya.
 */
async function handleUnblock(c: Call): Promise<Response> {
  if (c.request.method !== "POST") return json({ status: 405, message: "Method tidak diizinkan" }, 405, { allow: "POST" });
  if (!(await allow(c.env.SESSION_LIMITER, `admin:${c.ip}`, 10))) return json({ status: 429, message: "Terlalu banyak permintaan" }, 429, { "retry-after": "60" });

  const auth = c.request.headers.get("authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!given || !(await sameToken(given, adminToken(c.env)))) {
    const v = await c.guard.strike("admin_auth", "token admin salah");
    if (v.blocked) return blockedResponse(c, v);
    return json({ status: 401, message: "Token admin salah" }, 401);
  }

  const body = ((await c.request.json().catch(() => ({}))) ?? {}) as { ip?: unknown; incident?: unknown };
  const incident = typeof body.incident === "string" ? body.incident.trim().toUpperCase() : "";
  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  if (incident && !INCIDENT_RE.test(incident)) return json({ status: 400, message: "Format ID insiden: JC-XXXX-XXXX" }, 400);
  if (ip && !IP_RE.test(ip)) return json({ status: 400, message: "Format IP tidak valid" }, 400);

  const target = incident ? { incident } : { ip: ip || c.ip };
  const r = await unblock(c.env.GUARD, target, c.env.GUARD_EPOCH);
  if (!r.ok) return json({ status: 404, message: "ID insiden tidak ditemukan (sudah lewat 8 hari atau GUARD_EPOCH diganti)" }, 404);
  return json({ ok: true, message: "Blokir dibuka", ip: maskIp(r.ip), incident: incident || null }, 200);
}

/* ───────────────────────────── Tanda tangan request ───────────────────────────── */

/** null = sah. Kunci usang/klien lama → 401 tanpa poin (klien membuat ulang kunci); pemalsuan/replay → poin. */
async function checkSignature(c: Call, k: Keys, session: Session): Promise<Response | null> {
  const h = c.request.headers;
  const ts = h.get(H.ts) ?? "";
  const nonce = h.get(H.nonce) ?? "";
  const sig = h.get(H.sig) ?? "";
  const kid = h.get(H.kid) ?? "";
  if (!ts && !nonce && !sig && !kid) return json({ status: 401, code: "signature_required", message: "Muat ulang halaman" }, 401);

  const ks = await sessionKeys(k, session.sid);
  if (kid !== ks.kid) return json({ status: 401, code: "key_mismatch", message: "Kunci sesi berganti" }, 401);
  if (!/^\d{13}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) return deny(c, "bad_signature", 401, "Permintaan tidak valid", "format");
  if (!(await verify(ks.mac, canonical(c.request.method, c.url.pathname + c.url.search, ts, nonce), sig))) {
    return deny(c, "bad_signature", 401, "Permintaan tidak valid", "sig");
  }
  // Timestamp jauh bisa juga karena jam perangkat berubah (HP tidur, sinkron jam): ditolak tanpa poin, klien
  // menyinkronkan ulang jam lewat tukar kunci. Request lama yang disalin tetap tidak bisa dipakai.
  if (Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return json({ status: 401, code: "clock_skew", message: "Jam perangkat tidak sinkron" }, 401);
  // Nonce yang sama dengan tanda tangan sah = request yang disalin lalu diputar ulang.
  if (!freshNonce(session.sid, nonce, MAX_SKEW_MS * 2)) return deny(c, "replay", 401, "Permintaan diputar ulang", "nonce");
  return null;
}

/* ───────────────────────────── Sesi ───────────────────────────── */

async function handleSession(c: Call, k: Keys): Promise<Response> {
  const { request, url, env, ip } = c;
  if (request.method !== "POST") return deny(c, "bad_method", 405, "Method tidak diizinkan", "", { allow: "POST" });
  const origin = originCheck(request);
  if (origin === "unknown") return json({ status: 403, message: "Akses ditolak" }, 403);
  if (origin !== "ok") return deny(c, origin === "direct" ? "direct_access" : "cross_site", 403, "Akses ditolak");

  const text = await request.text();
  let body: { turnstile?: unknown; pub?: unknown } = {};
  try {
    body = text.length <= 4096 ? JSON.parse(text) : {};
  } catch {
    /* body kosong → ditolak di bawah */
  }
  const pub = typeof body.pub === "string" ? body.pub : "";
  if (!pub) return json({ status: 400, code: "client_outdated", message: "Muat ulang halaman" }, 400);

  // Cookie tidak cocok/kedaluwarsa → sesi baru (cookie lama ditimpa).
  const read = await readSession(k, request);
  const existing = read.ok ? read.session : null;

  // Berlaku juga untuk tukar ulang kunci (ECDH memakan CPU).
  if (!(await allow(env.SESSION_LIMITER, `ip:${ip}`, 30))) {
    return deny(c, "rate_limit", 429, "Terlalu banyak permintaan, coba lagi sebentar", "session", { "retry-after": "60" });
  }

  let session: Session;
  let cookie: string | undefined;
  if (existing && existing.exp - Date.now() / 1000 > SESSION_TTL / 2) {
    // Sesi masih panjang: hanya tukar ulang kunci (mis. tab baru / penyimpanan kunci dihapus).
    session = existing;
  } else {
    if (env.TURNSTILE_SECRET_KEY && !(await verifyTurnstile(env.TURNSTILE_SECRET_KEY, String(body.turnstile ?? ""), ip))) {
      return deny(c, "bot_check", 403, "Verifikasi keamanan gagal");
    }
    ({ session, cookie } = await issueSession(k, url, existing?.sid));
  }

  const wrapped = await exchangeKey(k, session.sid, pub);
  if (!wrapped) return deny(c, "probing", 400, "Permintaan tidak valid", "pub");
  return json({ status: 200, exp: session.exp, now: Date.now(), ...wrapped }, 200, cookie ? { "set-cookie": cookie } : {});
}

/* ───────────────────────────── Data JSON ───────────────────────────── */

async function handleData(c: Call, k: Keys, session: Session): Promise<Response> {
  const { url, env, ctx } = c;
  let match: RegExpExecArray | null = null;
  const r = ROUTES.find((x) => (match = x.re.exec(url.pathname)));
  if (!r || !match) return deny(c, "probing", 404, "Endpoint tidak tersedia");
  const m = (match as RegExpExecArray).slice(1);

  // Parameter di luar allowlist ditolak, jadi URL acak tidak bisa memaksa cache miss ke upstream.
  const q: Params = {};
  for (const key of url.searchParams.keys()) {
    if (!r.query?.[key] || url.searchParams.getAll(key).length > 1) return deny(c, "probing", 400, "Parameter tidak valid");
  }
  for (const [key, check] of Object.entries(r.query ?? {})) {
    const v = check(url.searchParams.get(key));
    if (v === null) return deny(c, "probing", 400, "Parameter tidak valid");
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

  // Isi dienkripsi dengan kunci sesi; AAD = path+query sehingga respons tidak bisa ditukar antar endpoint.
  const ks = await sessionKeys(k, session.sid);
  const sealed = { v: WIRE_VERSION, d: await seal(ks.enc, new Uint8Array(te.encode(body)), url.pathname + url.search) };

  return new Response(JSON.stringify(sealed), {
    headers: {
      ...API_HEADERS,
      "content-type": "application/json; charset=utf-8",
      // Respons privat per sesi: tidak boleh disimpan cache bersama (CDN/proxy).
      "cache-control": "private, no-store",
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
      // Workers tidak mendukung "error"; redirect tidak diikuti dan status 3xx diperlakukan sebagai gagal di bawah.
      redirect: "manual",
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

async function handleReplay(c: Call, k: Keys, session: Session): Promise<Response> {
  const { request, url, env } = c;
  // Hanya untuk <video> (atau dibuka di tab dari tombol "Buka file video"); fetch()/skrip ditolak.
  const dest = request.headers.get("sec-fetch-dest");
  if (dest && !["video", "audio", "document"].includes(dest)) return deny(c, "probing", 403, "Akses ditolak", `dest=${dest}`);
  const token = url.searchParams.get("t") ?? "";
  if ([...url.searchParams.keys()].some((x) => x !== "t")) return deny(c, "probing", 400, "Parameter tidak valid");
  const data = await openReplay(k, token);
  if (!data) return deny(c, "tampered_token", 404, "Replay tidak ditemukan");
  // Tautan yang disalin ke browser/orang lain tidak berlaku (sesi berbeda).
  if (data.s !== session.sid) return deny(c, "shared_token", 403, "Replay hanya bisa diputar dari halaman situs");
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
async function handleMedia(c: Call): Promise<Response> {
  const { url, env, ctx } = c;
  // Hanya untuk <img>; diambil lewat fetch()/skrip = penyalahgunaan proxy.
  const dest = c.request.headers.get("sec-fetch-dest");
  if (dest && dest !== "image") return deny(c, "media_abuse", 403, "Akses ditolak", `dest=${dest}`);
  if ([...url.searchParams.keys()].some((x) => x !== "url")) return deny(c, "probing", 400, "Parameter tidak valid");
  let target: URL;
  try {
    target = new URL(url.searchParams.get("url") ?? "");
  } catch {
    return json({ status: 400, message: "Parameter url tidak valid" }, 400);
  }
  if (!mediaAllowed(target) || target.href.length > 2048) return deny(c, "media_abuse", 403, "Host gambar tidak diizinkan", target.hostname);

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
