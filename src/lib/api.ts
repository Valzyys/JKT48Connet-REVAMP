/**
 * Klien HTTP untuk proxy `/api/*` milik situs ini (worker/proxy.ts).
 *
 * Browser TIDAK memanggil api.jkt48connect.app langsung dan tidak pernah memegang API key. Semua `/api/*` privat:
 * - Sesi: `POST /api/session` memberi cookie HttpOnly (HMAC, SameSite=Strict) dan, lewat tukar kunci ECDH,
 *   kunci sesi yang disimpan sebagai CryptoKey tidak bisa diekspor (memori + IndexedDB). Bila
 *   `VITE_TURNSTILE_SITE_KEY` diisi, sesi baru hanya diberikan setelah lolos Cloudflare Turnstile.
 * - Setiap request ditandatangani (HMAC + timestamp + nonce), setiap respons datang terenkripsi AES-256-GCM.
 *   Format ada di src/lib/wire.ts.
 * - Bila server memblokir IP ini, layar blokir ditampilkan (src/lib/blocked.ts).
 * Proxy harus berada di origin yang sama (cookie SameSite=Strict).
 */
import { isBlockBody, setBlocked } from "./blocked";
import { b64url, canonical, deriveSessionKeys, ECDH, H, isSealed, keyId, sign, unb64url, unseal, wrapKey, type SessionKeys } from "./wire";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Query = Record<string, string | number | undefined>;

const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "");

/* ───────────────────────────── Turnstile (opsional) ───────────────────────────── */

type Turnstile = {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
};

let turnstileScript: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  turnstileScript ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => {
      const t = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (t) resolve(t);
      else reject(new Error("Turnstile tidak tersedia"));
    };
    s.onerror = () => {
      turnstileScript = null;
      reject(new Error("Turnstile gagal dimuat"));
    };
    document.head.appendChild(s);
  });
  return turnstileScript;
}

/** Widget hanya tampil (pojok kanan bawah) bila Cloudflare butuh interaksi; biasanya lolos tanpa terlihat. */
async function turnstileToken(): Promise<string> {
  const t = await loadTurnstile();
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647";
  document.body.appendChild(box);
  try {
    return await new Promise<string>((resolve, reject) => {
      const id = t.render(box, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        callback: (token: string) => resolve(token),
        "error-callback": () => reject(new ApiError(403, "Verifikasi keamanan gagal")),
        "expired-callback": () => reject(new ApiError(403, "Verifikasi keamanan kedaluwarsa")),
      });
      box.dataset.widget = id;
    });
  } finally {
    if (box.dataset.widget) t.remove(box.dataset.widget);
    box.remove();
  }
}

/* ───────────────────────────── Penyimpanan kunci ───────────────────────────── */

type Wire = SessionKeys & { kid: string; exp: number; offset: number };

const DB = "jc-wire";

/** IndexedDB menyimpan CryptoKey tanpa bisa diekspor; gagal (mode privat, dsb.) → hanya memori. */
function idb<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("k");
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        const tx = open.result.transaction("k", mode);
        const req = op(tx.objectStore("k"));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => resolve(undefined);
        tx.oncomplete = () => open.result.close();
      };
    } catch {
      resolve(undefined);
    }
  });
}

const saveWire = (w: Wire) => idb("readwrite", (s) => s.put(w, "current"));
const loadWire = () => idb<Wire>("readonly", (s) => s.get("current"));

/* ───────────────────────────── Sesi & tukar kunci ───────────────────────────── */

async function readBody(res: Response): Promise<unknown> {
  const body = await res.json().catch(() => null);
  if (res.status === 403 && isBlockBody(body)) {
    setBlocked(body);
    throw new ApiError(403, "Akses diblokir");
  }
  return body;
}

function errorOf(res: Response, body: unknown, fallback: string) {
  const message = body && typeof body === "object" && "message" in body ? String(body.message) : "";
  const msg = message || res.statusText || fallback;
  return new ApiError(res.status, msg);
}

async function startSession(): Promise<Wire> {
  const token = TURNSTILE_SITE_KEY ? await turnstileToken() : "";
  // Kunci privat ECDH tidak bisa diekspor; hanya kunci publik yang dikirim.
  const pair = (await crypto.subtle.generateKey(ECDH, false, ["deriveBits"])) as CryptoKeyPair;
  const pub = b64url(await crypto.subtle.exportKey("raw", pair.publicKey));
  const sent = Date.now();
  const res = await fetch("/api/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ turnstile: token, pub }),
  });
  const body = (await readBody(res)) as { exp?: number; now?: number; spk?: string; wk?: string; kid?: string } | null;
  if (!res.ok || !body?.spk || !body.wk || !body.kid) throw errorOf(res, body, "Sesi gagal dibuat");

  const spk = unb64url(body.spk);
  if (!spk) throw new ApiError(502, "Sesi tidak valid");
  const peer = await crypto.subtle.importKey("raw", spk, ECDH, false, []);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: peer }, pair.privateKey, 256);
  const secret = await unseal(await wrapKey(bits), body.wk, "session-wrap");
  if (!secret || (await keyId(secret)) !== body.kid) throw new ApiError(502, "Kunci sesi tidak valid");
  const keys = await deriveSessionKeys(secret);
  secret.fill(0);

  // Selisih jam perangkat vs server (dihitung di tengah perjalanan request) untuk timestamp tanda tangan.
  const offset = Number(body.now) ? Number(body.now) - Math.round((sent + Date.now()) / 2) : 0;
  const wire: Wire = { ...keys, kid: body.kid, exp: Number(body.exp) * 1000 || Date.now() + 5 * 60_000, offset };
  void saveWire(wire);
  return wire;
}

let wire: Promise<Wire> | null = null;

function guarded(p: Promise<Wire>): Promise<Wire> {
  const out = p.catch((err) => {
    if (wire === out) wire = null;
    throw err;
  });
  return out;
}

/**
 * Kunci sesi untuk request berikutnya. `rejected` = kunci yang baru saja ditolak server (sesi berganti/kedaluwarsa).
 * Banyak request yang gagal bersamaan hanya memicu SATU sesi baru: yang datang belakangan memakai hasil yang sudah
 * diperbarui, sehingga cookie tidak saling menimpa.
 */
async function getWire(rejected?: Wire): Promise<Wire> {
  wire ??= guarded(
    (async () => {
      const stored = await loadWire();
      return stored && stored.exp - Date.now() > 60_000 && stored.enc && stored.mac ? stored : startSession();
    })(),
  );
  const p = wire;
  const w = await p;
  if (w !== rejected && Date.now() < w.exp - 60_000) return w;
  if (wire !== p) return wire; // sudah diperbarui pemanggil lain
  wire = guarded(startSession());
  return wire;
}

/* ───────────────────────────── Request ───────────────────────────── */

const RETRY_CODES = new Set(["session_required", "key_mismatch", "signature_required", "clock_skew"]);

async function signedFetch(w: Wire, pathAndQuery: string) {
  const ts = String(Date.now() + w.offset);
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(18)));
  const sig = await sign(w.mac, canonical("GET", pathAndQuery, ts, nonce));
  return fetch(pathAndQuery, {
    credentials: "same-origin",
    headers: { Accept: "application/json", [H.ts]: ts, [H.nonce]: nonce, [H.sig]: sig, [H.kid]: w.kid },
  });
}

export async function apiGet<T = unknown>(path: string, query: Query = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs.set(k, String(v));
  // Path+query persis seperti yang dilihat server (sudah dinormalisasi parser URL) — dipakai untuk tanda tangan & AAD.
  const u = new URL(`${path}${qs.size ? `?${qs}` : ""}`, location.origin);
  const pathAndQuery = u.pathname + u.search;

  let rejected: Wire | undefined;
  for (let attempt = 0; ; attempt++) {
    const w = await getWire(rejected);
    rejected = w;
    const res = await signedFetch(w, pathAndQuery);
    const body = await readBody(res);

    if (res.status === 401 && attempt === 0 && body && typeof body === "object" && RETRY_CODES.has(String((body as { code?: unknown }).code))) {
      // Cookie/kunci kedaluwarsa atau berganti (mis. tab lain membuat sesi baru): tukar kunci lalu ulangi sekali.
      continue;
    }
    if (!res.ok) throw errorOf(res, body, `HTTP ${res.status}`);
    if (!isSealed(body)) throw new ApiError(502, "Respons tidak valid");

    const plain = await unseal(w.enc, body.d, pathAndQuery);
    if (plain) return JSON.parse(new TextDecoder().decode(plain)) as T;
    // Kunci tersimpan tidak cocok dengan cookie: tukar kunci lalu ulangi sekali.
    if (attempt === 0) continue;
    throw new ApiError(502, "Respons tidak bisa dibuka");
  }
}
