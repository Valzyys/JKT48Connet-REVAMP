/**
 * Proxy `/api/*` → https://api.jkt48connect.app dengan API key dari secret server.
 * Dipakai bersama oleh Cloudflare Workers (worker/index.ts) dan Pages Functions
 * (functions/api/[[path]].ts), sehingga key tidak pernah sampai ke browser.
 */

export interface ProxyEnv {
  /** Secret: `wrangler secret put JKT48CONNECT_API_KEY` */
  JKT48CONNECT_API_KEY?: string;
  /** Opsional, default https://api.jkt48connect.app */
  API_UPSTREAM?: string;
}

/** Hanya endpoint publik yang dipakai UI yang diteruskan. */
const ALLOWED = [
  "news",
  "member",
  "birthday",
  "next_birthday",
  "theater",
  "next_schedule",
  "event",
  "jkt48event",
  "setlist",
  "now_live",
  "idn_lives",
  "recent",
  "jkt48_youtube",
  "live-notifications",
  "screenshots",
];

/** Data live berubah cepat; berita, member, dan jadwal jarang. (detik) */
function ttlFor(path: string): number {
  if (/^\/api\/(now_live|idn_lives|live-notifications)/.test(path)) return 20;
  if (path.startsWith("/api/recent")) return 60;
  return 300;
}

const STALE_TTL = 60 * 60 * 24; // salinan cadangan bila upstream gagal

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

export async function handleApi(request: Request, env: ProxyEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
  const url = new URL(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ status: 405, message: "Method tidak diizinkan" }, 405, { allow: "GET, HEAD" });
  }

  const segment = url.pathname.replace(/^\/api\//, "").split("/")[0];
  if (!ALLOWED.includes(segment)) {
    return json({ status: 404, message: "Endpoint tidak tersedia" }, 404);
  }

  if (!env.JKT48CONNECT_API_KEY) {
    return json(
      { status: 500, message: "JKT48CONNECT_API_KEY belum diset. Jalankan `npm run cf:secret`." },
      500,
    );
  }

  // Jangan teruskan key yang mungkin dikirim klien lewat query.
  url.searchParams.delete("apikey");
  url.searchParams.delete("api_key");
  url.searchParams.sort();

  const upstreamBase = (env.API_UPSTREAM || "https://api.jkt48connect.app").replace(/\/+$/, "");
  const upstreamUrl = `${upstreamBase}${url.pathname}${url.search}`;
  const ttl = ttlFor(url.pathname);

  const cache = (caches as unknown as { default: Cache }).default;
  const freshKey = new Request(`${url.origin}${url.pathname}${url.search}`, { method: "GET" });
  const staleKey = new Request(`${url.origin}/__stale${url.pathname}${url.search}`, { method: "GET" });

  const hit = await cache.match(freshKey);
  if (hit) return withHeader(hit, "x-cache", "HIT");

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { "X-API-Key": env.JKT48CONNECT_API_KEY, Accept: "application/json" },
      cf: { cacheTtl: 0 },
    } as RequestInit);
  } catch {
    const stale = await cache.match(staleKey);
    if (stale) return withHeader(stale, "x-cache", "STALE");
    return json({ status: 502, message: "JKT48Connect API tidak bisa dihubungi" }, 502);
  }

  if (upstream.status >= 500) {
    const stale = await cache.match(staleKey);
    if (stale) return withHeader(stale, "x-cache", "STALE");
  }

  const body = await upstream.arrayBuffer();
  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    "cache-control": upstream.ok ? `public, max-age=${ttl}` : "no-store",
    "x-cache": "MISS",
  });
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers.set("retry-after", retryAfter);

  const response = new Response(body, { status: upstream.status, headers });

  if (upstream.ok) {
    const stale = new Response(body, { status: 200, headers: new Headers(headers) });
    stale.headers.set("cache-control", `public, max-age=${STALE_TTL}`);
    ctx.waitUntil(Promise.all([cache.put(freshKey, response.clone()), cache.put(staleKey, stale)]));
  }
  return response;
}

function withHeader(res: Response, key: string, value: string) {
  const out = new Response(res.body, res);
  out.headers.set(key, value);
  return out;
}
