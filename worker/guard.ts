/**
 * Penjaga anti-iseng: setiap upaya mengakali API (cookie dipalsukan, tanda tangan salah, replay,
 * probing endpoint/parameter, token replay milik orang lain, banjir request, akses dari situs lain)
 * memberi "poin curiga" ke IP pelaku. Melewati ambang → IP diblokir sementara dan seluruh situs
 * menampilkan halaman blokir berisi ID insiden (untuk di-screenshot dan dikirim ke admin).
 *
 * State disimpan di Durable Object `Guard` (worker/guard-do.ts, satu instance per IP) bila binding
 * `GUARD` ada; di Pages/dev memakai Map per-isolate dengan logika yang sama.
 */

export type Reason =
  | "forged_session"
  | "bad_signature"
  | "replay"
  | "cross_site"
  | "direct_access"
  | "probing"
  | "bad_method"
  | "tampered_token"
  | "shared_token"
  | "rate_limit"
  | "bot_check"
  | "media_abuse";

/** Label yang ditampilkan di halaman blokir (sama dengan src/components/blocked.tsx). */
export const REASON_LABEL: Record<Reason, string> = {
  forged_session: "Cookie sesi dimanipulasi",
  bad_signature: "Tanda tangan permintaan tidak valid",
  replay: "Permintaan lama diputar ulang (replay)",
  cross_site: "Akses API dari situs lain",
  direct_access: "Membuka API secara langsung",
  probing: "Mencoba endpoint atau parameter yang tidak tersedia",
  bad_method: "Method HTTP tidak wajar",
  tampered_token: "Token replay dimanipulasi",
  shared_token: "Memakai token replay milik sesi lain",
  rate_limit: "Terlalu banyak permintaan",
  bot_check: "Gagal verifikasi keamanan",
  media_abuse: "Menyalahgunakan proxy gambar",
};

/** Poin per pelanggaran. Hal yang bisa terjadi pada pengunjung biasa (sesi kedaluwarsa, 404 data) bernilai 0. */
export const POINTS: Record<Reason, number> = {
  forged_session: 5,
  bad_signature: 5,
  replay: 4,
  cross_site: 3,
  direct_access: 2,
  probing: 2,
  bad_method: 2,
  tampered_token: 5,
  shared_token: 3,
  rate_limit: 3,
  bot_check: 2,
  media_abuse: 3,
};

export const THRESHOLD = 10;
const WINDOW_MS = 15 * 60_000;
/** Blokir berjenjang untuk pelanggar berulang (level direset setelah 7 hari bersih). */
const BLOCK_MS = [60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
const LEVEL_RESET_MS = 7 * 24 * 60 * 60_000;

export type Block = { incident: string; reason: Reason; until: number; at: number };
export type Verdict = { blocked: false; score: number } | ({ blocked: true } & Block);

export type GuardState = {
  strikes: { t: number; p: number; r: Reason }[];
  block?: Block;
  level: number;
  levelAt: number;
};

export function newIncident(): string {
  const b = crypto.getRandomValues(new Uint8Array(4));
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `JC-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export function verdictOf(s: GuardState, now: number): Verdict {
  if (s.block && s.block.until > now) return { blocked: true, ...s.block };
  return { blocked: false, score: s.strikes.filter((x) => now - x.t < WINDOW_MS).reduce((a, x) => a + x.p, 0) };
}

/** Logika murni: tambah poin, blokir bila ambang terlewati. */
export function applyStrike(s: GuardState, reason: Reason, now: number): GuardState {
  const active = verdictOf(s, now);
  if (active.blocked) return s;
  const strikes = [...s.strikes.filter((x) => now - x.t < WINDOW_MS), { t: now, p: POINTS[reason], r: reason }].slice(-100);
  const score = strikes.reduce((a, x) => a + x.p, 0);
  if (score < THRESHOLD) return { ...s, strikes };
  const level = now - s.levelAt > LEVEL_RESET_MS ? 1 : s.level + 1;
  // Alasan blokir = pelanggaran dengan poin terbesar di jendela ini.
  const top = strikes.reduce((a, x) => (x.p > a.p ? x : a));
  return {
    strikes: [],
    level,
    levelAt: now,
    block: { incident: newIncident(), reason: top.r, until: now + BLOCK_MS[Math.min(level, BLOCK_MS.length) - 1], at: now },
  };
}

export const emptyState = (): GuardState => ({ strikes: [], level: 0, levelAt: 0 });

/* ───────────────────────────── Akses dari proxy ───────────────────────────── */

export interface GuardStub {
  status(): Promise<Verdict>;
  strike(reason: Reason): Promise<Verdict>;
}

/** Binding Durable Object (bentuk struktural supaya proxy tidak bergantung pada `cloudflare:workers`). */
export interface GuardNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): GuardStub;
}

const memory = new Map<string, GuardState>();

function memoryGuard(key: string): GuardStub {
  const read = () => memory.get(key) ?? emptyState();
  return {
    status: async () => verdictOf(read(), Date.now()),
    strike: async (reason) => {
      if (memory.size > 20_000) memory.clear();
      const next = applyStrike(read(), reason, Date.now());
      memory.set(key, next);
      return verdictOf(next, Date.now());
    },
  };
}

/** Cache status per isolate supaya tidak memanggil Durable Object di setiap request. */
const statusCache = new Map<string, { v: Verdict; exp: number }>();
const STATUS_TTL = 30_000;

export function guardFor(ns: GuardNamespace | undefined, ip: string) {
  const key = `ip:${ip || "unknown"}`;
  let stub: GuardStub;
  try {
    stub = ns ? ns.get(ns.idFromName(key)) : memoryGuard(key);
  } catch {
    stub = memoryGuard(key);
  }
  const remember = (v: Verdict) => {
    if (statusCache.size > 20_000) statusCache.clear();
    statusCache.set(key, { v, exp: Date.now() + STATUS_TTL });
    return v;
  };
  return {
    async status(): Promise<Verdict> {
      const c = statusCache.get(key);
      if (c && c.exp > Date.now()) return c.v.blocked && c.v.until <= Date.now() ? { blocked: false, score: 0 } : c.v;
      try {
        return remember(await stub.status());
      } catch (err) {
        console.error("guard status failed", err);
        return { blocked: false, score: 0 };
      }
    },
    async strike(reason: Reason, detail: string): Promise<Verdict> {
      try {
        const v = remember(await stub.strike(reason));
        console.warn(JSON.stringify({ guard: "strike", ip, reason, detail: detail.slice(0, 200), ...v }));
        return v;
      } catch (err) {
        console.error("guard strike failed", err);
        return { blocked: false, score: 0 };
      }
    },
  };
}

/* ───────────────────────────── Halaman blokir (HTML) ───────────────────────────── */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function maskIp(ip: string) {
  if (!ip) return "-";
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + ":…";
  const p = ip.split(".");
  return p.length === 4 ? `${p[0]}.${p[1]}.x.x` : ip;
}

const fmtWib = (ms: number) =>
  new Date(ms).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "medium" }) + " WIB";

/**
 * Untuk navigasi langsung ke /api/* (dibuka di address bar, dari situs lain, dsb.).
 * `blocked=false` → "Akses ditolak" (pelanggaran dicatat, belum diblokir).
 */
export function denyPage(opts: { blocked: boolean; incident: string; reason: Reason; ip: string; until?: number; at: number }) {
  const title = opts.blocked ? "Akses diblokir" : "Akses ditolak";
  const lead = opts.blocked
    ? "Aktivitas mencurigakan terdeteksi dari jaringanmu, jadi akses ke JKT48Connect dihentikan sementara."
    : "Permintaan ini tidak diizinkan dan sudah dicatat. Pelanggaran berulang akan memblokir akses ke seluruh situs.";
  const rows: [string, string][] = [
    ["ID insiden", opts.incident],
    ["Alasan", REASON_LABEL[opts.reason]],
    ["Waktu", fmtWib(opts.at)],
    ...(opts.until ? ([["Berlaku sampai", fmtWib(opts.until)]] as [string, string][]) : []),
    ["IP", maskIp(opts.ip)],
  ];
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · JKT48Connect</title>
<style>
:root{color-scheme:light dark;--bg:#f3eee6;--card:#fffaf2;--ink:#1c1416;--soft:#6b5e60;--line:#e4d9cb;--brand:#e11d48}
@media (prefers-color-scheme:dark){:root{--bg:#141012;--card:#1f191b;--ink:#f6efe7;--soft:#b3a6a8;--line:#352c2f}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{width:100%;max-width:560px;background:var(--card);border:1px solid var(--line);border-radius:24px;overflow:hidden}
header{background:var(--brand);color:#fff;padding:28px 24px}header p{margin:0;font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
h1{margin:10px 0 0;font-size:clamp(32px,8vw,44px);line-height:1;text-transform:uppercase;letter-spacing:-.01em}
section{padding:24px}.lead{margin:0 0 18px;color:var(--soft)}dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:10px 16px}
dt{color:var(--soft);font-size:14px}dd{margin:0;font-weight:600;word-break:break-word}dd.id{font:700 18px ui-monospace,Menlo,monospace;color:var(--brand)}
.ss{margin:22px 0 0;padding:14px 16px;border:2px dashed var(--brand);border-radius:16px;font-weight:600}
</style></head><body><main><header><p>JKT48Connect · keamanan</p><h1>${title}</h1></header><section>
<p class="lead">${esc(lead)}</p><dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd${k === "ID insiden" ? ' class="id"' : ""}>${esc(v)}</dd>`).join("")}</dl>
<p class="ss">📸 Screenshot halaman ini dan kirim ke admin bila menurutmu ini keliru. Sertakan ID insiden di atas.</p>
</section></main></body></html>`;
}
