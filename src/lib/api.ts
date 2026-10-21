/**
 * Klien HTTP untuk JKT48Connect API (https://api.jkt48connect.app).
 *
 * Browser TIDAK memanggil api.jkt48connect.app langsung dan tidak pernah memegang
 * API key: request dikirim ke proxy milik situs ini (dev: proxy Vite, produksi:
 * Cloudflare Worker di worker/proxy.ts) yang menambahkan header `X-API-Key`.
 * `VITE_API_BASE_URL` boleh diisi bila proxy berada di origin lain.
 */
const BASE = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Query = Record<string, string | number | undefined>;

export async function apiGet<T = unknown>(path: string, query: Query = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const url = `${BASE}${path}${qs.size ? `?${qs}` : ""}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body && typeof body === "object" && "message" in body && String(body.message)) || res.statusText;
    throw new ApiError(res.status, msg || `HTTP ${res.status}`);
  }
  return body as T;
}
