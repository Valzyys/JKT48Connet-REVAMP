import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Bell,
  BellOff,
  Cake,
  CalendarDays,
  History,
  Home,
  MoreHorizontal,
  Moon,
  Newspaper,
  PlayCircle,
  Radio,
  Search,
  Settings,
  Sun,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { setSetting, useAppState } from "@/lib/app-state";
import { bridge } from "@/lib/bridge";
import { platformLabel, q, type LiveSession, type TheaterShow } from "@/lib/data";
import { countdown, fmtDate, fmtTime } from "@/lib/format";
import { back, forward, isActive, Link, navigate, useRoute } from "@/lib/router";
import { cx, Img, PixelCross, useNow } from "./ui";

const NAV: { group: string; items: { to: string; label: string; icon: typeof Home }[] }[] = [
  {
    group: "Utama",
    items: [
      { to: "/", label: "Beranda", icon: Home },
      { to: "/live", label: "Live", icon: Radio },
      { to: "/schedule", label: "Jadwal", icon: CalendarDays },
      { to: "/theater", label: "Theater", icon: Ticket },
      { to: "/member", label: "Member", icon: Users },
    ],
  },
  {
    group: "Arsip",
    items: [
      { to: "/recent", label: "Recent", icon: History },
      { to: "/news", label: "Berita", icon: Newspaper },
      { to: "/birthday", label: "Ulang tahun", icon: Cake },
      { to: "/video", label: "Video", icon: PlayCircle },
      { to: "/social", label: "Sosmed", icon: AtSign },
    ],
  },
];

const TITLES: Record<string, string> = {
  "": "Beranda",
  live: "Live",
  watch: "Tonton live",
  schedule: "Jadwal",
  theater: "Theater",
  member: "Member",
  recent: "Recent",
  news: "Berita",
  birthday: "Ulang tahun",
  video: "Video",
  social: "Sosmed",
  settings: "Pengaturan",
};

/* ───────────────────────────── Sidebar ───────────────────────────── */

export function Sidebar() {
  const { path } = useRoute();
  const live = useQuery(q.live());
  const s = useAppState();
  const n = live.data?.length ?? 0;
  const nav = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  // Penanda menu aktif meluncur ke item baru (bukan sekadar berganti warna).
  useLayoutEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>("[data-on='true']");
    setPill(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  }, [path]);
  let i = 0;
  return (
    <aside className="flex h-full w-[244px] shrink-0 flex-col p-2.5 pr-0">
      <div className="flex h-full flex-col overflow-hidden rounded-[26px] bg-nav text-[#f3ece6] shadow-[0_18px_40px_-24px_rgb(29_21_23/0.7)]">
        <div className="drag flex items-center gap-3 px-5 pb-5 pt-5">
          <PixelCross className="h-9 w-9 transition-transform duration-700 hover:rotate-90" cell="fill-[#ff3b52]" />
          <div>
            <p className="text-[17px] font-extrabold leading-tight tracking-tight">JKT48Connect</p>
            <p className="micro mt-0.5 text-[9.5px] text-white/45">Fan signal · desktop</p>
          </div>
        </div>
        <nav ref={nav} className="scroll no-scrollbar relative flex-1 px-3">
          {pill && (
            <span
              aria-hidden
              className="absolute left-3 right-3 rounded-[14px] bg-[#e1243a] shadow-[0_10px_24px_-12px_rgb(225_36_58/0.9)] transition-all duration-500 [transition-timing-function:cubic-bezier(0.3,1.3,0.5,1)]"
              style={{ top: pill.top, height: pill.height }}
            />
          )}
          {NAV.map((g) => (
            <div key={g.group} className="mb-4">
              <p className="micro px-3 pb-2 text-[9.5px] text-white/35">{g.group}</p>
              {g.items.map((it) => {
                const on = isActive(path, it.to) || (it.to === "/live" && path.startsWith("/watch"));
                const Icon = it.icon;
                i += 1;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    data-on={on}
                    className={cx(
                      "group relative mb-0.5 flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14.5px] font-semibold transition-colors duration-300",
                      on ? "text-white" : "text-white/75 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:scale-110" strokeWidth={2} />
                    <span className="flex-1">{it.label}</span>
                    {it.to === "/live" && n > 0 ? (
                      <span className={cx("num rounded-full px-1.5 py-px text-[11px] font-bold", on ? "bg-white text-[#e1243a]" : "bg-[#e1243a] text-white")}>{n}</span>
                    ) : (
                      <span className={cx("font-mono text-[10px]", on ? "text-white/80" : "text-white/25")}>{String(i).padStart(2, "0")}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <NextShowCard />
        <div className="flex items-center justify-between px-4 pb-4 pt-2 text-white/45">
          <Link to="/settings" className={cx("flex items-center gap-2 rounded-full px-2 py-1.5 text-[12px] font-semibold hover:bg-white/[0.06] hover:text-white", isActive(path, "/settings") && "text-white")}>
            <Settings className="h-4 w-4" /> Pengaturan
          </Link>
          <button
            type="button"
            title={s?.theme === "dark" ? "Tema terang" : "Tema gelap"}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/[0.08] hover:text-white"
            onClick={() => setSetting("theme", s?.theme === "dark" ? "light" : "dark")}
          >
            {s?.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}

function NextShowCard() {
  const sched = useQuery(q.nextSchedule());
  const now = useNow(1000);
  const show = sched.data?.find((s) => Date.parse(s.date) > now - 2 * 3600_000 && s.category !== "event");
  if (!show) return null;
  const c = countdown(new Date(show.date), now);
  return (
    <Link to={`/theater/${encodeURIComponent(show.id)}`} className="mx-3 mb-2 block rounded-[18px] bg-white/[0.06] p-3.5 transition-colors hover:bg-white/[0.1]">
      <p className="micro text-[9.5px] text-white/45">Show berikutnya</p>
      <p className="mt-1 truncate text-[14px] font-bold text-white">{show.title}</p>
      <p className="num mt-1 font-mono text-[12px] text-[#ff6476]">
        {c ? (c.d ? `${c.d} hari ` : "") + `${String(c.h).padStart(2, "0")}:${String(c.m).padStart(2, "0")}:${String(c.s).padStart(2, "0")}` : "Sedang berlangsung"}
      </p>
    </Link>
  );
}

/* ───────────────────────────── Title bar ───────────────────────────── */

export function Topbar({ title }: { title?: string }) {
  const { parts } = useRoute();
  const s = useAppState();
  const [pop, setPop] = useState(false);
  const live = useQuery(q.live());
  const n = live.data?.length ?? 0;
  const menuRef = useRef<HTMLButtonElement>(null);
  const label = title ?? TITLES[parts[0] ?? ""] ?? "JKT48Connect";

  return (
    <header
      className="drag relative z-30 flex h-[52px] shrink-0 items-center gap-2 pl-5"
      style={{ paddingRight: "calc(100vw - env(titlebar-area-width, calc(100vw - 140px)) + 10px)" }}
    >
      <div className="flex items-center gap-1">
        <IconBtn title="Kembali (Alt+←)" onClick={back}>
          <ArrowLeft className="h-[18px] w-[18px]" />
        </IconBtn>
        <IconBtn title="Maju (Alt+→)" onClick={forward}>
          <ArrowRight className="h-[18px] w-[18px]" />
        </IconBtn>
      </div>
      <p className="condensed min-w-0 truncate pl-2 text-[22px] uppercase leading-none">{label}</p>
      <div className="flex-1" />
      <MemberSearch />
      <div className="relative" data-nodrag>
        <button
          type="button"
          onClick={() => setPop((v) => !v)}
          title={n ? `${n} member sedang live` : "Belum ada member yang live"}
          className={cx(
            "flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold transition-all active:scale-[0.97]",
            n ? "border-transparent bg-brand text-white shadow-[0_8px_20px_-10px_var(--brand)] hover:bg-brand-strong" : "border-line bg-card text-ink-soft hover:text-ink",
          )}
        >
          {n ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : <span className="h-2 w-2 rounded-full bg-current opacity-50" />}
          <span className="num condensed text-[16px] leading-none">{n}</span>
          <span className="micro text-[9.5px]">live</span>
        </button>
        {pop && <LivePopover list={live.data ?? []} onClose={() => setPop(false)} />}
      </div>
      <IconBtn title={s?.notifyLive ? "Notifikasi live aktif (klik untuk mematikan)" : "Notifikasi live mati (klik untuk menyalakan)"} onClick={() => setSetting("notifyLive", !s?.notifyLive)}>
        {s?.notifyLive ? <Bell className="h-[18px] w-[18px]" /> : <BellOff className="h-[18px] w-[18px] text-ink-soft" />}
      </IconBtn>
      {s?.update?.ready && (
        <button type="button" className="btn h-9 bg-butter px-3.5 text-[12.5px] text-[#3d2a00] hover:brightness-105" onClick={() => bridge.send("update-install")}>
          Update {s.update.version} siap · Mulai ulang
        </button>
      )}
      <button
        ref={menuRef}
        type="button"
        title="Menu"
        className="grid h-9 w-9 place-items-center rounded-full text-ink transition-colors hover:bg-ink/[0.07]"
        onClick={() => {
          const r = menuRef.current!.getBoundingClientRect();
          const z = Math.pow(1.2, s?.zoom ?? 0);
          bridge.send("menu", { x: r.left * z, y: (r.bottom + 6) * z });
        }}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </header>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-full text-ink transition-colors hover:bg-ink/[0.07] active:bg-ink/[0.12]">
      {children}
    </button>
  );
}

/* ───────────────────────────── Popover live ───────────────────────────── */

function since(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  return `${fmtTime(iso)} · ${min < 60 ? `${min} mnt` : `${Math.floor(min / 60)} j ${min % 60} m`}`;
}

function LivePopover({ list, onClose }: { list: LiveSession[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.parentElement?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="rise absolute right-0 top-[calc(100%+10px)] w-[380px] overflow-hidden rounded-[22px] border border-white/10 bg-[#1d1517] text-[#f3ece6] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)]" style={{ animationDuration: "0.25s" }}>
      <div className="flex items-end justify-between bg-gradient-to-br from-[#e1243a] to-[#b9172b] px-5 py-4 text-white">
        <div>
          <p className="micro flex items-center gap-2 opacity-85">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Sedang live
          </p>
          <p className="condensed mt-1.5 text-[34px] leading-none">
            {list.length} <span className="text-[18px] opacity-80">member</span>
          </p>
        </div>
        <Link to="/live" onClick={onClose} className="rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-bold hover:bg-white/25">
          Halaman Live →
        </Link>
      </div>
      {list.length ? (
        <ol className="scroll max-h-[420px] p-1.5">
          {list.map((l) => (
            <li key={l.id}>
              <Link to={`/watch/${encodeURIComponent(l.id)}`} onClick={onClose} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-[14px] px-2.5 py-2 transition-colors hover:bg-white/[0.06]">
                <Img src={l.avatar || l.img} className="h-12 w-12 rounded-full object-top shadow-[0_0_0_2px_#1d1517,0_0_0_4px_#ff3b52]" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">{l.name}</span>
                  <span className="block truncate text-[12px] text-white/55">{l.title || l.fullname}</span>
                </span>
                <span className="text-right">
                  <span className={cx("pill", l.platform === "idn" ? "bg-[#ff3b52]/20 text-[#ff8a98]" : "bg-[#fde6b0]/15 text-[#fde6b0]")}>{platformLabel(l.platform)}</span>
                  <span className="mt-1.5 block font-mono text-[11px] text-white/45">{since(l.startedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-8 py-8 text-center">
          <PixelCross className="mx-auto h-12 w-12" cell="fill-white/10" blink={4} />
          <p className="mt-3 text-[16px] font-extrabold">Belum ada yang live</p>
          <p className="mx-auto mt-1.5 max-w-[270px] text-[12.5px] leading-relaxed text-white/55">Biarkan aplikasi terbuka atau di tray: kamu dapat notifikasi begitu ada member yang mulai live.</p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Cari member ───────────────────────────── */

function MemberSearch() {
  const members = useQuery(q.members());
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return [];
    return (members.data ?? []).filter((m) => m.name.toLowerCase().includes(t) || m.nickname.toLowerCase().includes(t)).slice(0, 7);
  }, [members.data, text]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const go = (id: string) => {
    navigate(`/member/${encodeURIComponent(id)}`);
    setText("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="relative w-[260px]" data-nodrag>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      <input
        ref={input}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setSel(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setSel((v) => Math.min(v + 1, hits.length - 1));
          else if (e.key === "ArrowUp") setSel((v) => Math.max(v - 1, 0));
          else if (e.key === "Enter" && hits[sel]) go(hits[sel].id);
          else if (e.key === "Escape") input.current?.blur();
        }}
        placeholder="Cari member…"
        className="h-9 w-full rounded-full border border-line bg-card pl-10 pr-14 text-[13.5px] outline-none transition-colors placeholder:text-ink-soft focus:border-brand"
      />
      {text ? (
        <button type="button" className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:bg-ink/10" onMouseDown={(e) => e.preventDefault()} onClick={() => setText("")}>
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-line px-1.5 font-mono text-[10px] text-ink-soft">Ctrl K</kbd>
      )}
      {open && text.trim() && (
        <div className="rise absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-[18px] border border-line bg-card p-1.5 shadow-[0_20px_50px_-20px_rgb(29_21_23/0.45)]" style={{ animationDuration: "0.2s" }}>
          {hits.length ? (
            hits.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setSel(i)}
                onClick={() => go(m.id)}
                className={cx("flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left", i === sel && "bg-surface")}
              >
                <Img src={m.img} className="h-9 w-9 rounded-full object-top" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{m.name}</span>
                  <span className="block text-[11.5px] text-ink-soft">{m.isGraduate ? "Alumni" : "Member aktif"}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-[13px] text-ink-soft">Tidak ada member bernama “{text.trim()}”.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Ringkas tanggal show untuk kartu: "Sabtu, 31 Okt · 16.00". */
export function showWhen(s: TheaterShow) {
  return `${fmtDate(s.date, { weekday: "long", day: "numeric", month: "short" })} · ${fmtTime(s.date)}`;
}
