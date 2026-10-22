/**
 * Primitif keamanan untuk proxy: sesi bertanda tangan HMAC, token replay terenkripsi AES-GCM,
 * pemeriksaan same-origin, rate limit, dan header keamanan. Hanya memakai Web Crypto
 * (tersedia di Workers, Pages Functions, dan Node ≥ 20 untuk dev server).
 */

/** Binding rate limit Workers (`ratelimits` di wrangler.jsonc); tidak ada di Pages/dev. */
export interface Limiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface SecurityEnv {
  /** Secret penanda tangan sesi/token. Bila kosong, diturunkan (HKDF) dari JKT48CONNECT_API_KEY. */
  SESSION_SECRET?: string;
  JKT48CONNECT_API_KEY?: string;
  /** Secret Cloudflare Turnstile. Bila diisi, `POST /api/session` wajib membawa token Turnstile yang valid. */
  TURNSTILE_SECRET_KEY?: string;
  /** Batas per sesi untuk semua `/api/*` (opsional; tanpa binding dipakai batas per-isolate). */
  API_LIMITER?: Limiter;
  /** Batas per IP untuk pembuatan sesi. */
  SESSION_LIMITER?: Limiter;
}

/** Umur sesi (detik). Diperpanjang otomatis saat sisa < separuhnya. */
export const SESSION_TTL = 12 * 60 * 60;

/* ───────────────────────────── base64url ───────────────────────────── */

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unb64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ───────────────────────────── Kunci ───────────────────────────── */

type Keys = { hmac: CryptoKey; aes: CryptoKey };
const keyCache = new Map<string, Promise<Keys>>();

/** Dua kunci terpisah (HMAC untuk sesi, AES-GCM untuk token replay) diturunkan dari satu secret lewat HKDF. */
export function keys(env: SecurityEnv): Promise<Keys> | null {
  const secret = env.SESSION_SECRET || env.JKT48CONNECT_API_KEY;
  if (!secret) return null;
  let k = keyCache.get(secret);
  if (!k) {
    k = (async () => {
      const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
      const derive = (info: string, alg: { name: string; hash?: string; length: number }, usages: ("sign" | "verify" | "encrypt" | "decrypt")[]) =>
        crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc.encode("jkt48connect-revamp"), info: enc.encode(info) }, base, alg, false, usages);
      return {
        hmac: await derive("session-v1", { name: "HMAC", hash: "SHA-256", length: 256 }, ["sign", "verify"]),
        aes: await derive("replay-v1", { name: "AES-GCM", length: 256 }, ["encrypt", "decrypt"]),
      };
    })();
    keyCache.set(secret, k);
  }
  return k;
}

/* ───────────────────────────── Sesi (cookie) ───────────────────────────── */

export type Session = { sid: string; exp: number };

/** `__Host-` mengunci cookie ke host ini, path `/`, dan HTTPS. Di http://localhost (dev) prefix itu tidak bisa dipakai. */
export function cookieName(url: URL) {
  return url.protocol === "https:" ? "__Host-jc_s" : "jc_s";
}

export async function issueSession(k: Keys, url: URL, sid?: string): Promise<{ session: Session; cookie: string }> {
  const session = { sid: sid ?? b64url(crypto.getRandomValues(new Uint8Array(16))), exp: Math.floor(Date.now() / 1000) + SESSION_TTL };
  const payload = `v1.${session.sid}.${session.exp}`;
  const sig = b64url(await crypto.subtle.sign("HMAC", k.hmac, enc.encode(payload)));
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return {
    session,
    cookie: `${cookieName(url)}=${payload}.${sig}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; SameSite=Strict${secure}`,
  };
}

export async function readSession(k: Keys, request: Request): Promise<Session | null> {
  const url = new URL(request.url);
  const name = cookieName(url);
  const raw = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  const m = raw && /^v1\.([A-Za-z0-9_-]{22})\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(raw);
  if (!m) return null;
  const sig = unb64url(m[3]);
  // crypto.subtle.verify membandingkan dalam waktu konstan.
  if (!sig || !(await crypto.subtle.verify("HMAC", k.hmac, sig, enc.encode(`v1.${m[1]}.${m[2]}`)))) return null;
  const exp = Number(m[2]);
  if (exp <= Date.now() / 1000) return null;
  return { sid: m[1], exp };
}

/* ───────────────────────────── Token replay ───────────────────────────── */

/** Token opak: URL file asli tidak terbaca klien, terikat ke sesi, dan kedaluwarsa. */
export async function sealReplay(k: Keys, data: { u: string; s: string; e: number }): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k.aes, enc.encode(JSON.stringify(data))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64url(out);
}

export async function openReplay(k: Keys, token: string): Promise<{ u: string; s: string; e: number } | null> {
  const bytes = token.length <= 4096 ? unb64url(token) : null;
  if (!bytes || bytes.length < 12 + 16) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, k.aes, bytes.slice(12));
    const data = JSON.parse(dec.decode(pt));
    if (typeof data?.u !== "string" || typeof data?.s !== "string" || typeof data?.e !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

/* ───────────────────────────── Turnstile ───────────────────────────── */

export async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const out = (await res.json()) as { success?: boolean };
    return out.success === true;
  } catch {
    return false;
  }
}

/* ───────────────────────────── Same-origin ───────────────────────────── */

/**
 * Tolak permintaan lintas situs (CSRF, hotlink, embed dari domain lain).
 * Browser modern mengirim `Sec-Fetch-Site`; browser lama dicek lewat Origin/Referer.
 * Ini bukan autentikasi (klien non-browser bisa memalsukan header), tapi menutup penyalahgunaan dari situs lain.
 */
export function sameOrigin(request: Request): boolean {
  const url = new URL(request.url);
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const from = request.headers.get("origin") ?? request.headers.get("referer");
  if (!from) return false;
  try {
    return new URL(from).origin === url.origin;
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "";
}

/* ───────────────────────────── Rate limit ───────────────────────────── */

/** Cadangan bila binding tidak ada: jendela tetap 60 detik per isolate (tidak global, tapi tetap menahan burst). */
const windows = new Map<string, { start: number; count: number }>();

export async function allow(limiter: Limiter | undefined, key: string, fallbackPerMinute: number): Promise<boolean> {
  if (limiter) {
    try {
      return (await limiter.limit({ key })).success;
    } catch {
      /* binding gagal: jatuh ke batas lokal */
    }
  }
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > 60_000) {
    if (windows.size > 10_000) windows.clear();
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  return ++w.count <= fallbackPerMinute;
}

/* ───────────────────────────── Header ───────────────────────────── */

/** Header keamanan untuk semua respons `/api/*` (aset statis memakai public/_headers). */
export const API_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
  "cross-origin-resource-policy": "same-origin",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
};

export function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...API_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store", vary: "Cookie", ...extra },
  });
}
