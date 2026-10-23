/**
 * Primitif keamanan untuk proxy: sesi bertanda tangan HMAC, token replay terenkripsi AES-GCM,
 * pemeriksaan same-origin, rate limit, dan header keamanan. Hanya memakai Web Crypto
 * (tersedia di Workers, Pages Functions, dan Node ≥ 20 untuk dev server).
 */

import { b64url, deriveSessionKeys, ECDH, keyId, seal, unb64url, wrapKey, type SessionKeys } from "../src/lib/wire";

export { b64url, unb64url };

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

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ───────────────────────────── Kunci ───────────────────────────── */

export type Keys = { hmac: CryptoKey; aes: CryptoKey };
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

/**
 * "none" = tidak ada cookie, "expired" = kedaluwarsa, "invalid" = format/tanda tangan tidak cocok.
 * "invalid" BUKAN bukti manipulasi: cookie lama dari sebelum SESSION_SECRET diganti juga jatuh di sini,
 * jadi diperlakukan seperti sesi kedaluwarsa (buat sesi baru), tanpa poin curiga. Cookie palsu tidak memberi
 * akses apa pun, jadi tidak perlu dihukum.
 */
export type SessionRead = { ok: true; session: Session } | { ok: false; why: "none" | "expired" | "invalid" };

export async function readSession(k: Keys, request: Request): Promise<SessionRead> {
  const url = new URL(request.url);
  const name = cookieName(url);
  const raw = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!raw) return { ok: false, why: "none" };
  const m = /^v1\.([A-Za-z0-9_-]{22})\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(raw);
  const sig = m && unb64url(m[3]);
  // crypto.subtle.verify membandingkan dalam waktu konstan.
  if (!m || !sig || !(await crypto.subtle.verify("HMAC", k.hmac, sig, enc.encode(`v1.${m[1]}.${m[2]}`)))) return { ok: false, why: "invalid" };
  const exp = Number(m[2]);
  if (exp <= Date.now() / 1000) return { ok: false, why: "expired" };
  return { ok: true, session: { sid: m[1], exp } };
}

/* ───────────────────────────── Token aplikasi mobile ───────────────────────────── */

/** Umur token aplikasi; aplikasi meminta token baru otomatis saat kedaluwarsa. */
export const APP_TOKEN_TTL = 30 * 24 * 60 * 60;

/**
 * Aplikasi native tidak punya cookie/Origin browser, jadi memakai token `a1.<sid>.<exp>.<sig>` di header
 * `Authorization: Bearer`. Awalan berbeda dari cookie (`v1`) sehingga keduanya tidak bisa saling dipakai.
 */
export async function issueAppToken(k: Keys): Promise<{ session: Session; token: string }> {
  const session = { sid: b64url(crypto.getRandomValues(new Uint8Array(16))), exp: Math.floor(Date.now() / 1000) + APP_TOKEN_TTL };
  const payload = `a1.${session.sid}.${session.exp}`;
  const sig = b64url(await crypto.subtle.sign("HMAC", k.hmac, enc.encode(payload)));
  return { session, token: `${payload}.${sig}` };
}

export async function readAppToken(k: Keys, request: Request): Promise<SessionRead> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { ok: false, why: "none" };
  const m = /^a1\.([A-Za-z0-9_-]{22})\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(auth.slice(7).trim());
  const sig = m && unb64url(m[3]);
  if (!m || !sig || !(await crypto.subtle.verify("HMAC", k.hmac, sig, enc.encode(`a1.${m[1]}.${m[2]}`)))) return { ok: false, why: "invalid" };
  const exp = Number(m[2]);
  if (exp <= Date.now() / 1000) return { ok: false, why: "expired" };
  return { ok: true, session: { sid: m[1], exp } };
}

/* ───────────────────────────── Kunci per sesi ───────────────────────────── */

/** Rahasia sesi 32 byte, deterministik dari secret server + id sesi (tidak perlu disimpan). */
async function sessionSecret(k: Keys, sid: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.sign("HMAC", k.hmac, enc.encode(`wire-v1:${sid}`)));
}

const sessionKeyCache = new Map<string, Promise<SessionKeys & { kid: string }>>();

export function sessionKeys(k: Keys, sid: string): Promise<SessionKeys & { kid: string }> {
  let v = sessionKeyCache.get(sid);
  if (!v) {
    if (sessionKeyCache.size > 5000) sessionKeyCache.clear();
    v = sessionSecret(k, sid).then(async (raw) => ({ ...(await deriveSessionKeys(raw)), kid: await keyId(raw) }));
    sessionKeyCache.set(sid, v);
  }
  return v;
}

/**
 * Bungkus rahasia sesi untuk browser lewat ECDH: hanya pemegang kunci privat ECDH browser (tidak bisa
 * diekspor) yang bisa membukanya. Isi jaringan/HAR saja tidak cukup untuk mendapatkan kunci sesi.
 */
export async function exchangeKey(k: Keys, sid: string, clientPub: string): Promise<{ spk: string; wk: string; kid: string } | null> {
  const pub = clientPub.length <= 128 ? unb64url(clientPub) : null;
  if (!pub || pub.length !== 65) return null;
  let peer: CryptoKey;
  try {
    peer = await crypto.subtle.importKey("raw", pub, ECDH, false, []);
  } catch {
    return null;
  }
  const eph = (await crypto.subtle.generateKey(ECDH, true, ["deriveBits"])) as CryptoKeyPair;
  const bits = await crypto.subtle.deriveBits(// Workers menamai field ini `$public` di tipe, Node/browser `public`; keduanya diisi.
    { name: "ECDH", public: peer, $public: peer } as never, eph.privateKey, 256);
  const raw = await sessionSecret(k, sid);
  return {
    spk: b64url((await crypto.subtle.exportKey("raw", eph.publicKey)) as ArrayBuffer),
    wk: await seal(await wrapKey(bits), raw, "session-wrap"),
    kid: await keyId(raw),
  };
}

/* ───────────────────────────── Nonce (anti-replay) ───────────────────────────── */

const nonces = new Map<string, number>();

/** true bila nonce baru; false bila sudah pernah dipakai dalam jendela waktu (per isolate). */
export function freshNonce(sid: string, nonce: string, ttlMs: number): boolean {
  const now = Date.now();
  if (nonces.size > 50_000) for (const [n, exp] of nonces) if (exp < now) nonces.delete(n);
  if (nonces.size > 100_000) nonces.clear();
  const key = `${sid}:${nonce}`;
  const seen = nonces.get(key);
  if (seen && seen > now) return false;
  nonces.set(key, now + ttlMs);
  return true;
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
/**
 * "ok" | "direct" (dibuka langsung di address bar) | "cross" (browser menyatakan asal situs lain) |
 * "unknown" (tidak ada Sec-Fetch-Site/Origin/Referer: browser lama atau pemblokir privasi — ditolak tanpa poin).
 */
export function originCheck(request: Request): "ok" | "direct" | "cross" | "unknown" {
  const site = request.headers.get("sec-fetch-site");
  if (site === "none") return "direct";
  if (!site && !request.headers.get("origin") && !request.headers.get("referer")) return "unknown";
  return sameOrigin(request) ? "ok" : "cross";
}

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
