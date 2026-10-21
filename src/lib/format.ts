const TZ = "Asia/Jakarta";

function valid(d: Date) {
  return !Number.isNaN(d.getTime());
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  const d = new Date(iso);
  return valid(d) ? new Intl.DateTimeFormat("id-ID", { timeZone: TZ, ...opts }).format(d) : "";
}

export function fmtTime(iso: string) {
  const d = new Date(iso);
  return valid(d) ? new Intl.DateTimeFormat("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d) : "";
}

/** Bagian tanggal untuk "kartu kalender": { day: "21", month: "Okt", weekday: "Sel" } */
export function dateParts(iso: string) {
  const d = new Date(iso);
  if (!valid(d)) return { day: "--", month: "", weekday: "" };
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("id-ID", { timeZone: TZ, ...o }).format(d);
  return { day: f({ day: "2-digit" }), month: f({ month: "short" }), weekday: f({ weekday: "short" }) };
}

/** Kunci tanggal WIB (YYYY-MM-DD) untuk mengelompokkan jadwal per hari. */
export function dayKey(iso: string) {
  const d = new Date(iso);
  return valid(d) ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) : "";
}

export function fmtDuration(ms: number) {
  if (!ms || ms < 0) return "—";
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h}j ${m % 60}m` : `${m}m`;
}

export function fmtNumber(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("id-ID", { notation: n >= 100_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}

export function timeAgo(iso: string) {
  const d = new Date(iso);
  if (!valid(d)) return "";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  if (Math.abs(s) < 60) return rtf.format(-s, "second");
  if (Math.abs(s) < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (Math.abs(s) < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

/** Hitung mundur ke `target`; null bila sudah lewat. */
export function countdown(target: Date, now = Date.now()) {
  const diff = target.getTime() - now;
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
