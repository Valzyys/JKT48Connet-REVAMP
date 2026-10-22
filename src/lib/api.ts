/**
 * Klien HTTP untuk proxy `/api/*` milik situs ini (worker/proxy.ts).
 *
 * Browser TIDAK memanggil api.jkt48connect.app langsung dan tidak pernah memegang API key.
 * Semua `/api/*` bersifat privat: proxy hanya melayani browser yang punya cookie sesi
 * (HttpOnly, ditandatangani HMAC, SameSite=Strict) dari `POST /api/session`. Bila
 * `VITE_TURNSTILE_SITE_KEY` diisi, sesi baru hanya diberikan setelah lolos Cloudflare Turnstile.
 * Proxy harus berada di origin yang sama (cookie SameSite=Strict).
 */

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

/* ───────────────────────────── Sesi ───────────────────────────── */

let session: Promise<void> | null = null;
let sessionExp = 0;

async function startSession(): Promise<void> {
  const token = TURNSTILE_SITE_KEY ? await turnstileToken() : "";
  const res = await fetch("/api/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ turnstile: token }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (body && typeof body.message === "string" && body.message) || "Sesi gagal dibuat");
  sessionExp = Number(body?.exp) * 1000 || Date.now() + 5 * 60_000;
}

/** Satu permintaan sesi untuk semua query yang berjalan bersamaan; diperbarui sebelum kedaluwarsa. */
function ensureSession(force = false): Promise<void> {
  if (force || !session || Date.now() > sessionExp - 60_000) {
    session = startSession().catch((err) => {
      session = null;
      throw err;
    });
  }
  return session;
}

export async function apiGet<T = unknown>(path: string, query: Query = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const url = `${path}${qs.size ? `?${qs}` : ""}`;

  await ensureSession();
  let res = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (res.status === 401) {
    // Cookie hilang/kedaluwarsa (mis. tab dibiarkan lama): buat sesi baru lalu ulangi sekali.
    await ensureSession(true);
    res = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body && typeof body === "object" && "message" in body && String(body.message)) || res.statusText;
    throw new ApiError(res.status, msg || `HTTP ${res.status}`);
  }
  return body as T;
}
