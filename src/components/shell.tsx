import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowUpRight, LayoutGrid, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, Ticket, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Countdown } from "@/components/countdown";
import { useIntroDone } from "@/components/intro";
import { Logo, PIXELS, PixelCross } from "@/components/logo";
import { SignalBars, Ticker } from "@/components/motion";
import { Img, cx } from "@/components/ui";
import { useClock } from "@/hooks/use-clock";
import { useTheme } from "@/hooks/use-theme";
import { dateParts, fmtTime } from "@/lib/format";
import { gsap } from "@/lib/gsap";
import type { TheaterShow } from "@/lib/jkt48";
import { MOBILE_MAIN, NAV, NAV_GROUPS, SOCIALS, isActive, navFor } from "@/lib/nav";
import { q } from "@/lib/queries";

function usePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Mode terang" : "Mode gelap"}
      className={cx("grid h-10 w-10 place-items-center rounded-xl text-ink-soft transition hover:bg-surface hover:text-brand", className)}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

/* ─────────────── Sidebar kiri (desktop) ─────────────── */

const num = (i: number) => String(i + 1).padStart(2, "0");

const SIDE_KEY = "jkt48c:side";
const SIDE_OPEN = 224;
const SIDE_MINI = 76;

function readCollapsed() {
  try {
    return localStorage.getItem(SIDE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/**
 * Panel tinta yang melayang di kiri dan bisa diciutkan jadi rail ikon (tombol di bawah, atau tombol `[`).
 * Pil merah meluncur (elastic) ke menu aktif, sorotan tipis mengikuti kursor, kartu "On air"
 * menampilkan member yang sedang live. Saat ciut, label muncul sebagai tooltip di samping ikon.
 */
export function Sidebar() {
  const path = usePath();
  const ready = useIntroDone();
  const root = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const ghost = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const firstToggle = useRef(true);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const lives = live.data ?? [];
  const show = next.data?.find((s) => s.category === "show");

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDE_KEY, c ? "open" : "collapsed");
      } catch {
        /* storage diblokir — pilihan berlaku untuk sesi ini */
      }
      return !c;
    });
  }, []);

  // Tombol "[" untuk menciutkan/membuka, kecuali saat mengetik.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, [contenteditable]")) return;
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Lebar panel + padding kolom utama (lewat atribut di <html>, dibaca CSS --side-pad).
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    document.documentElement.dataset.side = collapsed ? "collapsed" : "open";
    const instant = firstToggle.current;
    firstToggle.current = false;
    const labels = el.querySelectorAll("[data-label]");
    const tl = gsap.timeline();
    if (collapsed) {
      tl.to(labels, { opacity: 0, x: -8, duration: instant ? 0 : 0.18, stagger: instant ? 0 : 0.01, ease: "power2.in" }).to(
        el,
        { width: SIDE_MINI, duration: instant ? 0 : 0.55, ease: "expo.inOut" },
        instant ? 0 : 0.08,
      );
    } else {
      tl.to(el, { width: SIDE_OPEN, duration: instant ? 0 : 0.55, ease: "expo.inOut" }).fromTo(
        labels,
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: instant ? 0 : 0.35, stagger: instant ? 0 : 0.015, ease: "power3.out" },
        instant ? 0 : 0.3,
      );
    }
    if (!instant) gsap.fromTo(el.querySelector("[data-toggle-icon]"), { rotate: 0 }, { rotate: 180, duration: 0.5, ease: "back.out(2)" });
    return () => void tl.kill();
  }, [collapsed]);

  // Masuk bertahap setelah intro selesai.
  useLayoutEffect(() => {
    if (!ready || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.from(root.current, { xPercent: -110, duration: 0.9, ease: "expo.out" });
      gsap.from("[data-side-item]", { x: -24, opacity: 0, duration: 0.5, stagger: 0.035, delay: 0.25, ease: "power3.out" });
    }, root);
    return () => ctx.revert();
  }, [ready]);

  useLayoutEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>("[data-active='true']");
    const m = marker.current;
    if (!el || !m) return;
    const first = !m.dataset.ready;
    m.dataset.ready = "1";
    gsap.to(m, { y: el.offsetTop, opacity: 1, duration: first ? 0 : 0.75, ease: "elastic.out(1, 0.7)" });
    if (!first) gsap.fromTo(m, { scaleX: 0.82 }, { scaleX: 1, duration: 0.6, ease: "back.out(3)" });
    gsap.fromTo(el.querySelector("[data-icon]"), { rotate: -25, scale: 0.5 }, { rotate: 0, scale: 1, duration: 0.6, ease: "back.out(3)" });
  }, [path]);

  // Sorotan hover yang ikut meluncur antar menu, plus tooltip label saat panel ciut.
  useEffect(() => {
    const n = nav.current;
    const g = ghost.current;
    const t = tip.current;
    if (!n || !g || !t) return;
    gsap.set(t, { yPercent: -50, x: -6 });
    const y = gsap.quickTo(g, "y", { duration: 0.35, ease: "power3.out" });
    const over = (e: PointerEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-nav]");
      if (!a) return;
      if (Number(gsap.getProperty(g, "opacity")) < 0.05) gsap.set(g, { y: a.offsetTop });
      else y(a.offsetTop);
      gsap.to(g, { opacity: 1, duration: 0.2, overwrite: "auto" });
      if (document.documentElement.dataset.side === "collapsed") {
        const r = a.getBoundingClientRect();
        t.textContent = a.dataset.title ?? "";
        gsap.to(t, { top: r.top + r.height / 2, opacity: 1, x: 0, duration: 0.25, ease: "power3.out", overwrite: "auto" });
      }
    };
    const leave = () => {
      gsap.to(g, { opacity: 0, duration: 0.25, overwrite: "auto" });
      gsap.to(t, { opacity: 0, x: -6, duration: 0.2, overwrite: "auto" });
    };
    n.addEventListener("pointerover", over);
    n.addEventListener("pointerleave", leave);
    return () => {
      n.removeEventListener("pointerover", over);
      n.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <>
      <aside
        ref={root}
        style={{ width: collapsed ? SIDE_MINI : SIDE_OPEN }}
        className="fixed bottom-3 left-3 top-3 z-40 hidden flex-col overflow-hidden rounded-[26px] bg-nav p-3 text-white shadow-[0_20px_50px_-20px_rgb(0_0_0/0.5)] lg:flex dark:ring-1 dark:ring-white/[0.06]"
      >
        <Link to="/" data-side-item className="group flex items-center gap-3 rounded-[18px] bg-white/[0.06] p-2 transition-colors hover:bg-white/[0.1]" aria-label="JKT48Connect, ke beranda">
          <PixelCross className="h-9 w-9 shrink-0 transition-transform duration-500 group-hover:rotate-90" />
          <span data-label className="min-w-0 whitespace-nowrap">
            <span className="block text-[16px] font-extrabold leading-none tracking-tight">JKT48Connect</span>
            <span className="micro mt-1.5 block text-white/45">Fan Signal</span>
          </span>
        </Link>

        <nav ref={nav} className="no-scrollbar relative mt-4 flex-1 overflow-y-auto overflow-x-hidden" aria-label="Menu utama">
          <span ref={ghost} className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-xl bg-white/[0.07] opacity-0" />
          <span ref={marker} className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-xl bg-brand opacity-0 shadow-[0_10px_24px_-10px_var(--brand)]" />
          {NAV_GROUPS.map((g) => (
            <div key={g} className="mb-3">
              <p data-side-item className="relative h-7 px-3 pt-2">
                <span data-label className="micro block whitespace-nowrap text-white/35">
                  {g}
                </span>
                <span className={cx("absolute inset-x-3 top-1/2 h-px bg-white/10 transition-opacity duration-300", collapsed ? "opacity-100" : "opacity-0")} />
              </p>
              {NAV.filter((n) => n.group === g).map((n) => {
                const active = isActive(path, n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    data-nav
                    data-side-item
                    data-active={active}
                    data-title={n.label}
                    aria-label={n.label}
                    className={cx(
                      "relative z-[1] flex h-10 items-center gap-3 rounded-xl px-[17.5px] text-[14px] font-semibold transition-colors",
                      active ? "text-white" : "text-white/60 hover:text-white",
                    )}
                  >
                    <span className="relative shrink-0">
                      <n.icon data-icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
                      {n.to === "/live" && lives.length > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand ring-2 ring-nav" />}
                    </span>
                    <span data-label className="flex flex-1 items-center justify-between gap-2 whitespace-nowrap">
                      {n.label}
                      {n.to === "/live" && lives.length > 0 ? (
                        <span className="pill bg-white text-brand">{lives.length}</span>
                      ) : (
                        <span className={cx("font-mono text-[10px]", active ? "text-white/70" : "text-white/25")}>{num(NAV.indexOf(n))}</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {lives.length > 0 ? (
          <Link
            to="/live"
            data-side-item
            aria-label={`${lives.length} member sedang live`}
            className={cx("group mt-3 block rounded-[18px] bg-brand transition-[padding] duration-300", collapsed ? "p-2" : "p-3")}
          >
            {collapsed ? (
              <span className="grid h-9 place-items-center">
                <SignalBars />
              </span>
            ) : (
              <>
                <span className="micro flex items-center justify-between whitespace-nowrap text-white/85">
                  On air
                  <SignalBars />
                </span>
                <span className="mt-2.5 flex items-center whitespace-nowrap">
                  {lives.slice(0, 4).map((l, i) => (
                    <Img key={l.id} src={l.img || l.avatar} alt={l.name} className={cx("h-8 w-8 rounded-full object-cover object-top ring-2 ring-brand", i > 0 && "-ml-2.5")} />
                  ))}
                  <span className="ml-2.5 text-[13px] font-bold leading-tight">
                    {lives.length} member
                    <br />
                    <span className="font-medium text-white/80">sedang live</span>
                  </span>
                </span>
              </>
            )}
          </Link>
        ) : show ? (
          <Link
            to="/theater/$id"
            params={{ id: show.id }}
            data-side-item
            aria-label={`Show berikutnya: ${show.title}`}
            className={cx("mt-3 block rounded-[18px] bg-white/[0.06] transition-colors hover:bg-white/[0.1]", collapsed ? "p-2" : "p-3")}
          >
            {collapsed ? (
              <span className="grid h-9 place-items-center">
                <Ticket className="h-[17px] w-[17px] text-brand" />
              </span>
            ) : (
              <>
                <span className="micro block whitespace-nowrap text-white/45">Show berikutnya</span>
                <span className="mt-1.5 block truncate text-[14px] font-bold">{show.title}</span>
                <Countdown target={show.date} className="mt-0.5 block whitespace-nowrap font-mono text-[12px] text-brand" />
              </>
            )}
          </Link>
        ) : null}

        <div data-side-item className={cx("mt-3 flex items-center gap-1", collapsed ? "flex-col" : "justify-between pl-1")}>
          {!collapsed && <span className="whitespace-nowrap font-mono text-[10px] text-white/35">© {new Date().getFullYear()} · Fan-made</span>}
          <span className={cx("flex items-center gap-1", collapsed && "flex-col")}>
            <ThemeToggle className="h-9 w-9 text-white/60 hover:bg-white/10 hover:text-white" />
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Buka menu samping" : "Ciutkan menu samping"}
              aria-expanded={!collapsed}
              title={`${collapsed ? "Buka" : "Ciutkan"} menu ( [ )`}
              className="grid h-9 w-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <span data-toggle-icon className="grid place-items-center">
                {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
              </span>
            </button>
          </span>
        </div>
      </aside>
      <span
        ref={tip}
        aria-hidden
        style={{ left: SIDE_MINI + 22, opacity: 0 }}
        className="pointer-events-none fixed z-50 hidden whitespace-nowrap rounded-lg bg-nav px-2.5 py-1.5 text-[12px] font-bold text-white shadow-lg lg:block"
      />
    </>
  );
}

/* ─────────────── Topbar + ticker sinyal ─────────────── */

export function Topbar() {
  const path = usePath();
  const current = navFor(path);
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const lives = live.data ?? [];
  const show = next.data?.find((s) => s.category === "show");
  const title = useRef<HTMLHeadingElement>(null);

  // Judul halaman berganti dengan animasi geser.
  useLayoutEffect(() => {
    if (!title.current) return;
    gsap.fromTo(title.current, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
  }, [current.to]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <div className="overflow-hidden">
          <h1 ref={title} className="condensed text-[24px] uppercase leading-none">
            {current.label}
          </h1>
        </div>
        <Link
          to="/live"
          className={cx(
            "ml-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold",
            lives.length ? "bg-brand text-white" : "bg-surface text-ink-soft",
          )}
        >
          <SignalBars active={lives.length > 0} />
          <span className="num">{lives.length}</span> live
        </Link>
        <ThemeToggle className="lg:hidden" />
      </div>
      {(lives.length > 0 || show) && (
        <div className="border-t border-line py-1.5 text-[12px]">
          <Ticker>
            {lives.map((l) => (
              <a key={l.id} href={l.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 hover:text-brand">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                <span className="font-semibold">{l.fullname || l.name}</span>
                <span className="text-ink-soft">live di {l.platform === "idn" ? "IDN" : "Showroom"}</span>
              </a>
            ))}
            {show && (
              <Link to="/theater/$id" params={{ id: show.id }} className="flex items-center gap-2 px-5 hover:text-brand">
                <PixelCross className="h-3 w-3" />
                <span className="text-ink-soft">Show berikutnya</span>
                <span className="font-semibold">{show.title}</span>
                <Countdown target={show.date} className="font-mono text-brand" />
              </Link>
            )}
          </Ticker>
        </div>
      )}
    </header>
  );
}

/* ─────────────── Sidebar kanan ─────────────── */

function MemberSearch() {
  const members = useQuery(q.members());
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const term = useDeferredValue(query.trim().toLowerCase());
  const results = useMemo(
    () =>
      term.length < 2
        ? []
        : (members.data ?? []).filter((m) => `${m.name} ${m.nickname}`.toLowerCase().includes(term)).slice(0, 6),
    [members.data, term],
  );

  return (
    <div className="relative">
      <label className="flex h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4 transition focus-within:border-brand">
        <Search className="h-4 w-4 text-ink-soft" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari member…"
          aria-label="Cari member"
          className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-soft"
        />
      </label>
      {results.length > 0 && (
        <ul className="panel absolute inset-x-0 top-14 z-10 overflow-hidden p-1.5 shadow-xl">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  navigate({ to: "/member/$id", params: { id: m.id } });
                }}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface"
              >
                <Img src={m.img} alt={m.name} className="h-9 w-9 rounded-lg object-cover object-top" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{m.name}</span>
                  {m.nickname && <span className="block text-[12px] text-ink-soft">{m.nickname}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CATEGORY_STYLE: Record<string, string> = {
  show: "bg-butter text-[#7a4b00]",
  exclusive: "bg-blush text-brand",
  general: "bg-surface text-ink-soft",
};
const CATEGORY_LABEL: Record<string, string> = { show: "Show", exclusive: "Exclusive", general: "Event" };

function groupByDay(items: TheaterShow[]) {
  const map = new Map<string, TheaterShow[]>();
  for (const s of items) {
    const k = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(s.date));
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.values()];
}

/** Daftar jadwal ringkas, dipakai di sidebar kanan (desktop) dan di beranda (HP). */
export function ScheduleCard() {
  const next = useQuery(q.nextSchedule());
  const days = groupByDay([...(next.data ?? [])].sort((a, b) => +new Date(a.date) - +new Date(b.date))).slice(0, 6);
  const list = useRef<HTMLDivElement>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

  useLayoutEffect(() => {
    if (!list.current || !days.length) return;
    gsap.fromTo(list.current.children, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
  }, [days.length]);

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="condensed text-[22px] uppercase leading-none">
          Jadwal <span className="text-brand">/ {next.data?.length ?? 0}</span>
        </h2>
        <Link to="/schedule" className="link-more">
          Semua
        </Link>
      </div>
      <div ref={list}>
        {days.map((items) => {
          const d = dateParts(items[0].date);
          const isToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(items[0].date)) === today;
          return (
            <div key={items[0].date} className="grid grid-cols-[52px_1fr] gap-3 border-t border-line px-5 py-3">
              <div className="text-center leading-none">
                {isToday ? (
                  <span className="micro text-brand">Hari ini</span>
                ) : (
                  <>
                    <p className="condensed text-[24px]">{d.day}</p>
                    <p className="micro mt-1 text-ink-soft">{d.month}</p>
                  </>
                )}
              </div>
              <ul className="space-y-2">
                {items.map((s) => {
                  const body = (
                    <>
                      <span className={cx("pill mt-0.5", CATEGORY_STYLE[s.category] ?? CATEGORY_STYLE.general)}>{CATEGORY_LABEL[s.category] ?? s.category}</span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-[14px] font-semibold leading-snug">{s.title}</span>
                        {!/T00:00:00/.test(s.date) && <span className="font-mono text-[11px] text-ink-soft">{fmtTime(s.date)} WIB</span>}
                      </span>
                    </>
                  );
                  return (
                    <li key={`${s.id}-${s.title}`}>
                      {s.category === "show" ? (
                        <Link to="/theater/$id" params={{ id: s.id }} className="flex items-start gap-2 hover:text-brand">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {next.isSuccess && !days.length && <p className="border-t border-line px-5 py-6 text-[14px] text-ink-soft">Belum ada jadwal mendatang.</p>}
        {next.isLoading && <p className="border-t border-line px-5 py-6 text-[14px] text-ink-soft">Memuat jadwal…</p>}
      </div>
    </section>
  );
}

export function BirthdayCard() {
  const bday = useQuery(q.birthdays());
  const list = bday.data?.slice(0, 4) ?? [];
  if (!list.length) return null;
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="condensed text-[22px] uppercase leading-none">Birthday</h2>
        <Link to="/birthday" className="link-more">
          Semua
        </Link>
      </div>
      <ul>
        {list.map((b) => {
          const days = Math.round((b.next.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
          return (
            <li key={b.id} className="flex items-center gap-3 border-t border-line px-5 py-2.5">
              <Img src={b.img} alt={b.name} className="h-9 w-9 rounded-xl object-cover object-top" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{b.name}</span>
                <span className="block font-mono text-[11px] text-ink-soft">
                  {b.next.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · {b.age} th
                </span>
              </span>
              <span className={cx("pill", days === 0 ? "bg-brand text-white" : "bg-blush text-brand")}>{days === 0 ? "Hari ini" : `${days} hr`}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const FOOTER_COLS: { title: string; links: { label: string; to: string }[] }[] = [
  { title: "Jelajahi", links: NAV.filter((n) => n.group === "Utama").map((n) => ({ label: n.label, to: n.to })) },
  { title: "Arsip", links: NAV.filter((n) => n.group === "Arsip").map((n) => ({ label: n.label, to: n.to })) },
  {
    title: "Info",
    links: [
      { label: "Tentang", to: "/about" },
      { label: "Disclaimer", to: "/disclaimer" },
      { label: "Ketentuan", to: "/terms" },
      { label: "Privasi", to: "/privacy" },
    ],
  },
];

/**
 * Footer tinta di dasar kolom utama: tagline, kolom tautan, wordmark raksasa yang
 * tersusun huruf demi huruf saat discroll, dan tombol kembali ke atas.
 */
export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const clock = useClock();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      tl.from("[data-ft]", { y: 30, opacity: 0, duration: 0.6, stagger: 0.05, ease: "power3.out" })
        .from("[data-fl]", { yPercent: 105, duration: 0.8, stagger: 0.045, ease: "expo.out" }, 0.2)
        .from("[data-fpx]", { scale: 0, rotate: 90, transformOrigin: "50% 50%", duration: 0.5, stagger: { each: 0.04, from: "random" }, ease: "back.out(3)" }, 0.5);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <footer ref={ref} className="@container mx-3 mb-28 mt-16 overflow-hidden rounded-[28px] bg-nav text-white sm:mx-6 lg:mb-6">
      <div className="grid gap-10 p-6 sm:p-10 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <p data-ft className="micro flex items-center gap-2 text-white/50">
            <SignalBars className="text-brand" /> JKT48Connect · Fan Signal
          </p>
          <p data-ft className="condensed mt-5 text-[clamp(2rem,4.6cqw,3.2rem)] uppercase leading-[0.88]">
            Your oshi.
            <br />
            <span className="text-brand">Your front row</span> feeling.
          </p>
          <div data-ft className="mt-7 flex flex-wrap gap-2">
            {SOCIALS.map((s, i) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className={cx("btn group", i === 0 ? "bg-brand text-white hover:bg-brand-strong" : "bg-white/[0.08] text-white hover:bg-white/[0.16]")}
              >
                {s.label}
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {FOOTER_COLS.map((c) => (
            <div key={c.title} data-ft>
              <p className="micro text-white/40">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="group inline-flex items-center gap-2 text-[15px] font-semibold text-white/75 transition-colors hover:text-white">
                      <span className="h-1.5 w-1.5 scale-0 rounded-full bg-brand transition-transform duration-300 group-hover:scale-100" />
                      <span className="-ml-3.5 transition-[margin] duration-300 group-hover:ml-0">{l.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="@container relative px-5 sm:px-9" aria-hidden>
        <p className="condensed flex overflow-hidden whitespace-nowrap pb-[1.5cqw] text-[15.2cqw] uppercase leading-[0.8]">
          {"JKT48".split("").map((c, i) => (
            <span key={`a${i}`} data-fl className="inline-block">
              {c}
            </span>
          ))}
          {"CONNECT".split("").map((c, i) => (
            <span key={`b${i}`} data-fl className="inline-block text-brand">
              {c}
            </span>
          ))}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 px-6 py-4 font-mono text-[11px] text-white/45 sm:px-10">
        <span className="flex items-center gap-2 text-white/70">
          <svg viewBox="0 0 50 50" className="h-4 w-4">
            {PIXELS.map(([x, y]) => (
              <rect key={`${x}-${y}`} data-fpx x={x * 10} y={y * 10} width="10" height="10" rx="1.5" className="fill-brand" />
            ))}
          </svg>
          © {new Date().getFullYear()} JKT48Connect
        </span>
        <span>Proyek komunitas, bukan situs resmi JKT48</span>
        <span className="ml-auto flex items-center gap-4">
          <span className="num">WIB {clock}</span>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Kembali ke atas"
            className="group grid h-10 w-10 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-strong"
          >
            <ArrowUp className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
          </button>
        </span>
      </div>
    </footer>
  );
}

/** Sidebar kanan (xl+): cari member, jadwal, dan birthday. */
export function Aside() {
  return (
    <aside className="thin-scrollbar sticky top-0 hidden h-screen w-[340px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line p-5 xl:flex [&>*]:shrink-0">
      <MemberSearch />
      <ScheduleCard />
      <BirthdayCard />
    </aside>
  );
}

/* ─────────────── Dock + menu layar penuh (HP) ─────────────── */

/**
 * Dock tinta mengambang di bawah. Menu aktif melebar menjadi pil merah berlabel.
 * Tombol kisi membuka menu layar penuh yang mekar melingkar dari tombolnya.
 */
export function Dock() {
  const path = usePath();
  const [open, setOpen] = useState(false);
  const dock = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const main = NAV.filter((n) => MOBILE_MAIN.includes(n.to));
  const restActive = !main.some((n) => isActive(path, n.to));

  useEffect(() => setOpen(false), [path]);

  useLayoutEffect(() => {
    const el = dock.current?.querySelector("[data-active='true'] [data-icon]");
    if (el) gsap.fromTo(el, { y: -8, rotate: -15 }, { y: 0, rotate: 0, duration: 0.6, ease: "elastic.out(1, 0.5)" });
  }, [path]);

  return (
    <>
      <MenuScreen open={open} onClose={() => setOpen(false)} origin={button} />
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 lg:hidden">
        <nav
          ref={dock}
          aria-label="Menu"
          className="pointer-events-auto flex items-center gap-1 rounded-full bg-nav p-1.5 text-white shadow-[0_14px_34px_-12px_rgb(0_0_0/0.55)] dark:ring-1 dark:ring-white/[0.08]"
        >
          {main.map((n) => {
            const active = isActive(path, n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                data-active={active}
                aria-label={n.label}
                className={cx(
                  "flex h-11 items-center rounded-full px-3.5 transition-[background-color,color,gap] duration-300",
                  active ? "gap-2 bg-brand text-white" : "gap-0 text-white/55",
                )}
              >
                <n.icon data-icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
                <span
                  className={cx(
                    "overflow-hidden whitespace-nowrap text-[13px] font-bold transition-[max-width,opacity] duration-300",
                    active ? "max-w-[84px] opacity-100" : "max-w-0 opacity-0",
                  )}
                >
                  {n.label}
                </span>
              </Link>
            );
          })}
          <button
            ref={button}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Semua menu"
            className={cx("ml-0.5 grid h-11 w-11 place-items-center rounded-full transition-colors", restActive ? "bg-white text-nav" : "bg-white/10 text-white")}
          >
            <LayoutGrid className="h-[18px] w-[18px]" />
          </button>
        </nav>
      </div>
    </>
  );
}

function MenuScreen({ open, onClose, origin }: { open: boolean; onClose: () => void; origin: RefObject<HTMLButtonElement | null> }) {
  const path = usePath();
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      if (!open) return;
    }
    const r = origin.current?.getBoundingClientRect();
    const at = r ? `${r.left + r.width / 2}px ${r.top + r.height / 2}px` : "90% 95%";
    const items = el.querySelectorAll("[data-menu-item]");
    if (open) {
      document.body.classList.add("is-locked");
      gsap.timeline()
        .set(el, { display: "flex" })
        .fromTo(el, { clipPath: `circle(0% at ${at})` }, { clipPath: `circle(150% at ${at})`, duration: 0.7, ease: "power3.inOut" })
        .fromTo(items, { yPercent: 110 }, { yPercent: 0, duration: 0.55, stagger: 0.035, ease: "expo.out" }, 0.25)
        .fromTo("[data-menu-fade]", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06 }, 0.45);
    } else {
      document.body.classList.remove("is-locked");
      gsap.timeline()
        .to(items, { yPercent: -110, duration: 0.3, stagger: 0.015, ease: "power3.in" })
        .to(el, { clipPath: `circle(0% at ${at})`, duration: 0.5, ease: "power3.inOut" }, 0.1)
        .set(el, { display: "none" });
    }
  }, [open, origin]);

  return (
    <div ref={ref} style={{ display: "none" }} className="fixed inset-0 z-[60] flex-col bg-brand px-5 pb-8 pt-5 text-white lg:hidden" role="dialog" aria-modal="true" aria-label="Semua menu">
      <div data-menu-fade className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <PixelCross className="h-8 w-8" cellClass="fill-white" />
          <span className="text-[16px] font-extrabold">JKT48Connect</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Tutup menu" className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="mt-8 flex-1 overflow-y-auto">
        {NAV.map((n, i) => {
          const active = isActive(path, n.to);
          return (
            <div key={n.to} className="overflow-hidden border-b border-white/20">
              <Link to={n.to} data-menu-item className="flex items-baseline gap-4 py-2">
                <span className="w-6 font-mono text-[11px] text-white/60">{num(i)}</span>
                <span className={cx("condensed text-[clamp(2rem,10vw,2.75rem)] uppercase leading-[1.05]", active && "text-butter")}>{n.label}</span>
                {active && <span className="micro ml-auto text-butter">Di sini</span>}
              </Link>
            </div>
          );
        })}
      </nav>
      <div data-menu-fade className="mt-6 flex items-center gap-x-4 gap-y-2 text-[13px] font-semibold">
        <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1.5">
          {SOCIALS.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              {s.label}
            </a>
          ))}
        </div>
        <ThemeToggle className="bg-white/15 text-white hover:bg-white/25 hover:text-white" />
      </div>
    </div>
  );
}
