/**
 * Protokol kabel antara browser dan worker/proxy.ts. Dipakai DUA sisi (browser & Worker) supaya formatnya
 * tidak pernah berbeda. Hanya Web Crypto, tanpa DOM.
 *
 * 1. Sesi: browser membuat pasangan kunci ECDH P-256 (privat tidak bisa diekspor) dan mengirim kunci publiknya.
 *    Server menurunkan rahasia sesi (HMAC dari secret server + id sesi), membungkusnya dengan kunci hasil ECDH,
 *    lalu mengirimnya. Rahasia sesi tidak pernah lewat jaringan dalam bentuk terbaca.
 * 2. Dari rahasia sesi diturunkan (HKDF) kunci AES-GCM (respons) dan HMAC (tanda tangan request), keduanya
 *    disimpan browser sebagai CryptoKey yang tidak bisa diekspor.
 * 3. Setiap request data ditandatangani: HMAC(method, path+query, timestamp, nonce). Server menolak tanda tangan
 *    salah, timestamp > 60 detik, dan nonce yang sudah dipakai → request yang disalin tidak bisa diputar ulang.
 * 4. Setiap respons data dienkripsi AES-256-GCM dengan AAD = path+query: isinya tidak terbaca di jaringan/HAR,
 *    tidak bisa diubah, dan tidak bisa ditukar dengan respons endpoint lain.
 */

export const WIRE_VERSION = 1;
/** Batas selisih jam (setelah koreksi offset) untuk request bertanda tangan. */
export const MAX_SKEW_MS = 60_000;

const te = new TextEncoder();

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

const hkdf = (info: string) => ({ name: "HKDF", hash: "SHA-256", salt: te.encode("jkt48connect-wire"), info: te.encode(info) });

export type SessionKeys = { enc: CryptoKey; mac: CryptoKey };

/** Kunci respons & tanda tangan dari rahasia sesi (32 byte). Tidak bisa diekspor. */
export async function deriveSessionKeys(secret: Uint8Array<ArrayBuffer>): Promise<SessionKeys> {
  const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return {
    enc: await crypto.subtle.deriveKey(hkdf("enc-v1"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
    mac: await crypto.subtle.deriveKey(hkdf("mac-v1"), base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign", "verify"]),
  };
}

/** ID kunci (bukan rahasia): membedakan "kunci usang" (sesi berganti) dari tanda tangan palsu. */
export async function keyId(secret: Uint8Array<ArrayBuffer>): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", secret)).slice(0, 16);
}

/** Kunci pembungkus rahasia sesi dari bit ECDH bersama. */
export async function wrapKey(sharedBits: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(hkdf("wrap-v1"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

/** Teks yang ditandatangani untuk satu request. */
export function canonical(method: string, pathAndQuery: string, ts: string, nonce: string) {
  return `${method.toUpperCase()}\n${pathAndQuery}\n${ts}\n${nonce}`;
}

export async function sign(mac: CryptoKey, text: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", mac, te.encode(text)));
}

export async function verify(mac: CryptoKey, text: string, sig: string): Promise<boolean> {
  const bytes = sig.length <= 64 ? unb64url(sig) : null;
  // crypto.subtle.verify membandingkan dalam waktu konstan.
  return !!bytes && (await crypto.subtle.verify("HMAC", mac, bytes, te.encode(text)));
}

/** AES-256-GCM: hasil = base64url(iv[12] ‖ ciphertext+tag). */
export async function seal(key: CryptoKey, data: Uint8Array<ArrayBuffer>, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(aad) }, key, data));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return b64url(out);
}

export async function unseal(key: CryptoKey, token: string, aad: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const bytes = unb64url(token);
  if (!bytes || bytes.length < 12 + 16) return null;
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: te.encode(aad) }, key, bytes.slice(12)));
  } catch {
    return null;
  }
}

/** Header request bertanda tangan. */
export const H = { ts: "x-jc-ts", nonce: "x-jc-nonce", sig: "x-jc-sig", kid: "x-jc-kid" } as const;

/** Bentuk respons terenkripsi. */
export type Sealed = { v: typeof WIRE_VERSION; d: string };

export function isSealed(x: unknown): x is Sealed {
  return !!x && typeof x === "object" && (x as Sealed).v === WIRE_VERSION && typeof (x as Sealed).d === "string";
}
