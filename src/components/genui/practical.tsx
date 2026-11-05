import { Bell, BellRing, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react";
import { toBlob } from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { safeLink } from "@/lib/genui";
import { arr, box, btnBase, btnStyle, downloadPng, Empty, img, obj, str, Title, type P } from "./kit";

/* ── kalender & pengingat ───────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");
const icsDate = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const icsEsc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** Unduh berkas .ics (berlaku di Google/Apple/Outlook Calendar). */
export function downloadIcs(name: string, events: { title: string; start: Date; minutes?: number; url?: string }[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JKT48Connect//Pip//ID"];
  for (const [i, e] of events.entries()) {
    const end = new Date(e.start.getTime() + (e.minutes ?? 120) * 60000);
    lines.push("BEGIN:VEVENT", `UID:${e.start.getTime()}-${i}@jkt48connect.app`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${icsEsc(e.title)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(e.title)}`, "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  a.download = `${name.replace(/[^\w-]+/g, "-").slice(0, 50) || "jadwal"}.ics`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const gcal = (title: string, start: Date, minutes = 120) =>
  `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsDate(start)}/${icsDate(new Date(start.getTime() + minutes * 60000))}`;

const parseDate = (v: unknown) => {
  const d = new Date(str(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Tanggal dalam WIB (jadwal JKT48 selalu WIB, apa pun zona waktu perangkat). */
const wib = (d: Date) => {
  const w = new Date(d.getTime() + 7 * 3600000);
  return { y: w.getUTCFullYear(), m: w.getUTCMonth(), d: w.getUTCDate() };
};

export function CalendarBlock({ p }: { p: P }) {
  const events = arr(p.events)
    .map(obj)
    .map((e) => ({ date: parseDate(e.date), title: str(e.title), kind: str(e.kind, "event") }))
    .filter((e): e is { date: Date; title: string; kind: string } => Boolean(e.date && e.title));
  const first = /^\d{4}-\d{2}$/.test(str(p.month)) ? { y: Number(str(p.month).slice(0, 4)), m: Number(str(p.month).slice(5)) - 1 } : wib(events[0]?.date ?? new Date());
  const [cur, setCur] = useState(new Date(first.y, first.m, 1));
  const [sel, setSel] = useState<number | null>(null);
  const y = cur.getFullYear();
  const m = cur.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const inMonth = events.filter((e) => wib(e.date).y === y && wib(e.date).m === m);
  const on = (d: number) => inMonth.filter((e) => wib(e.date).d === d);
  const dot = (k: string) => (k === "birthday" ? "bg-[#f5c96a]" : k === "show" ? "bg-brand" : "bg-ink");
  const list = sel ? on(sel) : inMonth;
  return (
    <div className={cx(box, "p-4")}>
      <Title
        sub={cur.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
        right={
          <div className="flex gap-1">
            <button type="button" aria-label="Bulan sebelumnya" className="grid h-8 w-8 place-items-center rounded-full bg-surface" onClick={() => (setCur(new Date(y, m - 1, 1)), setSel(null))}><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Bulan berikutnya" className="grid h-8 w-8 place-items-center rounded-full bg-surface" onClick={() => (setCur(new Date(y, m + 1, 1)), setSel(null))}><ChevronRight className="h-4 w-4" /></button>
          </div>
        }
      >
        {str(p.title, "Kalender")}
      </Title>
      <div className="grid grid-cols-7 gap-1 text-center text-[12px]">
        {["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"].map((d) => <span key={d} className="py-1 font-mono text-[10.5px] text-ink-soft">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const ev = on(d);
          const today = wib(new Date());
          const isToday = today.y === y && today.m === m && today.d === d;
          return (
            <button key={d} type="button" onClick={() => setSel(sel === d ? null : d)} className={cx("relative grid h-10 place-items-center rounded-xl transition", sel === d ? "bg-brand font-bold text-white" : ev.length ? "bg-surface font-bold" : "hover:bg-surface", isToday && sel !== d && "ring-1 ring-brand")}>
              {d}
              {ev.length > 0 && <span className="absolute bottom-1 flex gap-0.5">{ev.slice(0, 3).map((e, k) => <i key={k} className={cx("h-1 w-1 rounded-full", sel === d ? "bg-white" : dot(e.kind))} />)}</span>}
            </button>
          );
        })}
      </div>
      <ul className="mt-3 space-y-1.5">
        {list.slice(0, 12).map((e, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-[13px]">
            <i className={cx("h-2 w-2 shrink-0 rounded-full", dot(e.kind))} />
            <span className="min-w-0 flex-1 truncate"><b>{wib(e.date).d}</b> · {e.title}</span>
            <a href={gcal(e.title, e.date)} target="_blank" rel="noopener noreferrer" className="text-[11.5px] font-bold text-brand">+ GCal</a>
          </li>
        ))}
        {!list.length && <li className="text-[12.5px] text-ink-soft">Tidak ada acara {sel ? "di tanggal ini" : "bulan ini"}.</li>}
      </ul>
      {events.length > 0 && (
        <button type="button" className={cx(btnBase, btnStyle("ghost"), "mt-3 w-full")} onClick={() => downloadIcs(str(p.title, "jadwal-jkt48"), events.map((e) => ({ title: e.title, start: e.date })))}>
          <CalendarPlus className="h-4 w-4" /> Simpan semua ke kalender (.ics)
        </button>
      )}
    </div>
  );
}

const REM_KEY = "pip:reminders";
type Rem = { id: string; title: string; at: number };
const readRems = (): Rem[] => {
  try {
    return (JSON.parse(localStorage.getItem(REM_KEY) || "[]") as Rem[]).filter((r) => r.at > Date.now());
  } catch {
    return [];
  }
};
const timers = new Map<string, number>();
/** Jadwalkan notifikasi browser untuk pengingat yang tersimpan (selama tab terbuka). */
export function armReminders() {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  for (const r of readRems()) {
    if (timers.has(r.id)) continue;
    const ms = r.at - Date.now();
    if (ms > 2 ** 31 - 1) continue;
    timers.set(r.id, window.setTimeout(() => {
      new Notification("JKT48Connect", { body: r.title, icon: "/favicon.svg" });
      timers.delete(r.id);
    }, ms));
  }
}

export function ReminderBlock({ p }: { p: P }) {
  const at = parseDate(p.at);
  const before = Math.max(0, Math.min(1440, Number(p.minutesBefore) || 30));
  const title = str(p.title, "Pengingat JKT48");
  const fire = at ? new Date(at.getTime() - before * 60000) : null;
  const id = `${title}|${str(p.at)}`;
  const [set, setSet] = useState(() => readRems().some((r) => r.id === id));
  const [msg, setMsg] = useState("");
  if (!at || !fire) return <Empty>Waktu pengingat tidak valid.</Empty>;
  const arm = async () => {
    if (!("Notification" in window)) return setMsg("Browser ini tidak mendukung notifikasi. Pakai .ics saja.");
    const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (perm !== "granted") return setMsg("Izin notifikasi ditolak. Pakai tombol .ics sebagai gantinya.");
    try {
      localStorage.setItem(REM_KEY, JSON.stringify([...readRems().filter((r) => r.id !== id), { id, title: `${title} — ${before} menit lagi`, at: fire.getTime() }]));
    } catch {
      /* penyimpanan diblokir: tetap jadwalkan selama tab terbuka */
    }
    armReminders();
    setSet(true);
    setMsg("Notifikasi muncul selama tab ini (atau situs ini) terbuka.");
  };
  return (
    <div className={cx(box, "flex flex-wrap items-center gap-3 p-4")}>
      <span className={cx("grid h-11 w-11 place-items-center rounded-2xl", set ? "bg-brand text-white" : "bg-surface text-brand")}>{set ? <BellRing className="h-5 w-5 animate-[shake_.6s]" /> : <Bell className="h-5 w-5" />}</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="text-[12.5px] text-ink-soft">
          {at.toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB · ingatkan {before} menit sebelumnya
        </p>
        {msg && <p className="mt-1 text-[11.5px] text-ink-soft">{msg}</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={set} onClick={() => void arm()} className={cx(btnBase, btnStyle("primary"))}>{set ? <><Check className="h-4 w-4" /> Aktif</> : "Ingatkan aku"}</button>
        <button type="button" onClick={() => downloadIcs(title, [{ title, start: at }])} className={cx(btnBase, btnStyle("ghost"))} aria-label="Unduh .ics"><CalendarPlus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/* ── kartu share ────────────────────────────────────────── */

const THEMES: Record<string, string> = {
  red: "bg-gradient-to-br from-[#ff6476] via-brand to-[#7a0d1c] text-white",
  dark: "bg-gradient-to-br from-[#2a1e21] to-[#0d0809] text-white",
  butter: "bg-gradient-to-br from-butter to-[#f5c96a] text-[#3a2600]",
  black: "bg-[#0b0708] text-white",
};

export function ShareCardBlock({ p }: { p: P }) {
  const ref = useRef<HTMLDivElement>(null);
  const title = str(p.title, "JKT48Connect");
  const share = async () => {
    try {
      const blob = ref.current && (await toBlob(ref.current, { pixelRatio: 2, imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" }));
      const file = blob && new File([blob], "jkt48connect.png", { type: "image/png" });
      if (file && navigator.canShare?.({ files: [file] })) return void (await navigator.share({ files: [file], title }));
    } catch {
      /* jatuh ke unduhan */
    }
    void downloadPng(ref, title);
  };
  return (
    <div>
      <div ref={ref} className={cx("relative isolate aspect-[4/5] max-w-sm overflow-hidden rounded-[26px] p-6", THEMES[str(p.theme, "red")] ?? THEMES.red)}>
        {img(p.image) && <img src={img(p.image)} crossOrigin="anonymous" alt="" className="absolute inset-x-0 bottom-0 -z-10 h-[72%] w-full object-cover object-top [mask-image:linear-gradient(to_bottom,transparent,black_40%)]" />}
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-80">{str(p.kicker, "JKT48Connect")}</p>
        <p className="mt-2 text-[30px] font-black leading-[1.05] tracking-tight [text-wrap:balance]">{title}</p>
        {str(p.subtitle) && <p className="mt-2 text-[14px] opacity-85">{str(p.subtitle)}</p>}
        <p className="absolute bottom-4 left-6 rounded-full bg-black/40 px-2.5 py-1 font-mono text-[10.5px] text-white backdrop-blur-sm">jkt48connect.app</p>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => void share()} className={cx(btnBase, btnStyle("primary"))}><Share2 className="h-4 w-4" /> Bagikan</button>
        <button type="button" onClick={() => void downloadPng(ref, title)} className={cx(btnBase, btnStyle("ghost"))}><Download className="h-4 w-4" /> PNG</button>
      </div>
    </div>
  );
}

/* ── agent: rencana, sumber, API tester, JSON ───────────── */

export function PlanBlock({ p }: { p: P }) {
  const steps = arr(p.steps).map(obj).filter((s) => str(s.text));
  return (
    <div className={cx(box, "p-4")}>
      <Title>{str(p.title, "Rencana")}</Title>
      <ol className="relative space-y-2.5 pl-1">
        {steps.map((s, i) => {
          const done = s.done !== false;
          return (
            <li key={i} className="flex animate-[fadein_.35s_ease_both] items-start gap-2.5 text-[13.5px]" style={{ animationDelay: `${i * 80}ms` }}>
              <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold", done ? "bg-brand text-white" : "border border-line text-ink-soft")}>{done ? <Check className="h-3 w-3" /> : i + 1}</span>
              <span className={cx(!done && "text-ink-soft")}>{str(s.text)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function SourcesBlock({ p }: { p: P }) {
  const items = arr(p.items).map(obj).map((s) => ({ label: str(s.label, str(s.title)), href: safeLink(str(s.href, str(s.url))) })).filter((s) => s.label);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-soft">Sumber</span>
      {items.map((s, i) =>
        s.href ? (
          <a key={i} href={s.href} target={/^https:/.test(s.href) ? "_blank" : undefined} rel="noopener noreferrer" className="rounded-full border border-line px-2.5 py-1 text-[12px] hover:border-brand hover:text-brand">
            <b className="mr-1 text-brand">{i + 1}</b>{s.label}
          </a>
        ) : (
          <span key={i} className="rounded-full border border-line px-2.5 py-1 text-[12px]"><b className="mr-1 text-brand">{i + 1}</b>{s.label}</span>
        ),
      )}
    </div>
  );
}

/** Hanya endpoint baca publik milik proxy situs; tidak ada path lain yang bisa dipanggil. */
const API_OK = /^\/api\/(news|theater|member|recent|now|next|jkt48|music|youtube|birthday|schedule|events?)(\/[\w.-]{1,80}){0,3}$/;

export function JsonView({ data, depth = 0, name }: { data: unknown; depth?: number; name?: string }) {
  const [open, setOpen] = useState(depth < 1);
  const isObj = data !== null && typeof data === "object";
  const key = name !== undefined ? <span className="text-[#b9172b] dark:text-[#ff8aa0]">{name}: </span> : null;
  if (!isObj) {
    const color = typeof data === "string" ? "text-emerald-700 dark:text-emerald-400" : typeof data === "number" ? "text-sky-700 dark:text-sky-400" : "text-ink-soft";
    const shown = typeof data === "string" ? `"${data.length > 140 ? `${data.slice(0, 140)}…` : data}"` : String(data);
    return <div className="truncate">{key}<span className={color}>{shown}</span></div>;
  }
  const entries = Array.isArray(data) ? data.map((v, i) => [String(i), v] as const) : Object.entries(data as object);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 hover:text-brand">
        <ChevronDown className={cx("h-3 w-3 transition", !open && "-rotate-90")} />
        {key}
        <span className="text-ink-soft">{Array.isArray(data) ? `[${entries.length}]` : `{${entries.length}}`}</span>
      </button>
      {open && (
        <div className="ml-2 border-l border-line pl-3">
          {entries.slice(0, 80).map(([k, v]) => <JsonView key={k} name={k} data={v} depth={depth + 1} />)}
          {entries.length > 80 && <div className="text-ink-soft">… {entries.length - 80} lagi</div>}
        </div>
      )}
    </div>
  );
}

export function JsonBlock({ p }: { p: P }) {
  return (
    <div className={cx(box, "max-h-96 overflow-auto p-4 font-mono text-[12px] leading-relaxed")}>
      {str(p.title) && <p className="mb-2 font-sans text-[14px] font-bold">{str(p.title)}</p>}
      <JsonView data={p.data} />
    </div>
  );
}

export function ApiTesterBlock({ p }: { p: P }) {
  const [path, setPath] = useState(str(p.path, "/api/now"));
  const [state, setState] = useState<{ ms: number; data?: unknown; err?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const ok = API_OK.test(path.split("?")[0]);
  const run = async () => {
    if (!ok) return;
    setLoading(true);
    const t0 = performance.now();
    const [base, qs] = path.split("?");
    const query = Object.fromEntries(new URLSearchParams(qs ?? ""));
    try {
      const data = await apiGet(base, query);
      setState({ ms: Math.round(performance.now() - t0), data });
    } catch (e) {
      setState({ ms: Math.round(performance.now() - t0), err: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className={cx(box, "overflow-hidden")}>
      <form className="flex gap-2 border-b border-line p-3" onSubmit={(e) => (e.preventDefault(), void run())}>
        <span className="grid place-items-center rounded-full bg-emerald-500/15 px-2.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">GET</span>
        <input value={path} onChange={(e) => setPath(e.target.value)} spellCheck={false} className="min-w-0 flex-1 rounded-full bg-surface px-3 font-mono text-[12.5px] outline-none focus:ring-1 focus:ring-brand" aria-label="Path endpoint" />
        <button type="submit" disabled={!ok || loading} className={cx(btnBase, btnStyle("primary"), "px-3")}>{loading ? "…" : "Kirim"}</button>
      </form>
      {!ok && <p className="px-3 pt-2 text-[11.5px] text-ink-soft">Hanya endpoint baca JKT48Connect (/api/news, /api/theater, /api/member/…).</p>}
      {state && (
        <div className="p-3">
          <p className="mb-2 font-mono text-[11px]"><span className={state.err ? "text-brand" : "text-emerald-600"}>{state.err ? "error" : "200 OK"}</span> · {state.ms} ms</p>
          <div className="max-h-80 overflow-auto font-mono text-[12px] leading-relaxed">{state.err ? state.err : <JsonView data={state.data} />}</div>
        </div>
      )}
    </div>
  );
}

/** Stempel waktu yang diperbarui setiap menit (dipakai di Kanvas). */
export function useNow(ms = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return useMemo(() => new Date(now), [now]);
}
