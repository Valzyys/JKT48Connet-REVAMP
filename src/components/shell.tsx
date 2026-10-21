import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Moon, MoreHorizontal, Search, Sun, X } from "lucide-react";
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Countdown } from "@/components/countdown";
import { Logo, PixelCross } from "@/components/logo";
import { SignalBars, Ticker } from "@/components/motion";
import { Img, cx } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { dateParts, fmtTime } from "@/lib/format";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import type { TheaterShow } from "@/lib/jkt48";
import { MOBILE_MAIN, NAV, SOCIALS, isActive, navFor } from "@/lib/nav";
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

/* ─────────────── Rail kiri (desktop) ─────────────── */

/** Rail ikon vertikal. Kotak merah di belakang ikon aktif meluncur ke item yang dipilih. */
export function Rail() {
  const path = usePath();
  const nav = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>("[data-active='true']");
    if (!el || !marker.current) return;
    gsap.to(marker.current, {
      y: el.offsetTop,
      opacity: 1,
      duration: prefersReducedMotion() ? 0 : 0.6,
      ease: "elastic.out(1, 0.7)",
    });
  }, [path]);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col items-center border-r border-line bg-bg/80 py-5 backdrop-blur lg:flex">
      <Logo compact />
      <nav ref={nav} className="relative mt-8 flex flex-col items-center gap-1" aria-label="Menu utama">
        <span ref={marker} className="absolute left-1/2 top-0 h-[58px] w-[64px] -translate-x-1/2 rounded-2xl bg-brand opacity-0 shadow-[0_8px_20px_-8px_var(--brand)]" />
        {NAV.map((n) => {
          const active = isActive(path, n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              data-active={active}
              className={cx(
                "group relative flex h-[58px] w-[64px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors",
                active ? "text-white" : "text-ink-soft hover:bg-surface hover:text-ink",
              )}
            >
              <n.icon className="h-[19px] w-[19px] transition-transform duration-300 group-hover:-translate-y-0.5" strokeWidth={2} />
              <span className="text-[10px] font-semibold leading-none">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </aside>
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
    if (!title.current || prefersReducedMotion()) return;
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
    if (!list.current || !days.length || prefersReducedMotion()) return;
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

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cx("text-[13px] text-ink-soft", className)}>
      <div className="flex items-center gap-2 text-ink">
        <PixelCross className="h-5 w-5" />
        <span className="font-extrabold">JKT48Connect</span>
        <SignalBars className="ml-auto text-brand" />
      </div>
      <p className="mt-3 leading-relaxed">Your oshi, your front row feeling. Proyek komunitas, bukan situs resmi JKT48.</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {SOCIALS.map((s) => (
          <a key={s.href} href={s.href} target="_blank" rel="noreferrer" className="hover:text-brand">
            {s.label}
          </a>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3">
        <Link to="/disclaimer" className="hover:text-brand">
          Disclaimer
        </Link>
        <Link to="/terms" className="hover:text-brand">
          Ketentuan
        </Link>
        <Link to="/privacy" className="hover:text-brand">
          Privasi
        </Link>
        <span className="font-mono text-[11px]">© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}

/** Sidebar kanan (xl+): cari member, jadwal, birthday, dan footer. */
export function Aside() {
  return (
    <aside className="thin-scrollbar sticky top-0 hidden h-screen w-[340px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line p-5 xl:flex [&>*]:shrink-0">
      <MemberSearch />
      <ScheduleCard />
      <BirthdayCard />
      <Footer className="mt-auto px-1 pt-2" />
    </aside>
  );
}

/* ─────────────── Navigasi bawah (HP) ─────────────── */

export function BottomNav() {
  const path = usePath();
  const [more, setMore] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const main = NAV.filter((n) => MOBILE_MAIN.includes(n.to));
  const rest = NAV.filter((n) => !MOBILE_MAIN.includes(n.to));
  const moreActive = rest.some((n) => isActive(path, n.to));

  useEffect(() => setMore(false), [path]);

  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const d = prefersReducedMotion() ? 0 : 1;
    if (more) {
      gsap.set(el, { display: "block" });
      gsap.fromTo(el.firstElementChild, { yPercent: 100 }, { yPercent: 0, duration: 0.45 * d, ease: "power3.out" });
      gsap.fromTo(el.querySelectorAll("[data-sheet-item]"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 * d, stagger: 0.04 * d, delay: 0.1 * d });
    } else {
      gsap.to(el.firstElementChild, {
        yPercent: 100,
        duration: 0.3 * d,
        ease: "power3.in",
        onComplete: () => void gsap.set(el, { display: "none" }),
      });
    }
  }, [more]);

  return (
    <>
      <div ref={sheet} style={{ display: "none" }} className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMore(false)}>
        <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card px-4 pb-24 pt-5" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <p className="micro text-ink-soft">Menu lainnya</p>
            <button type="button" onClick={() => setMore(false)} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full bg-surface">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {rest.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                data-sheet-item
                className={cx(
                  "flex flex-col items-center gap-2 rounded-2xl py-4 text-[13px] font-semibold",
                  isActive(path, n.to) ? "bg-brand text-white" : "bg-surface",
                )}
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-2xl border border-line bg-card/95 p-1.5 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.3)] backdrop-blur lg:hidden" aria-label="Menu">
        {main.map((n) => {
          const active = isActive(path, n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cx(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-colors",
                active ? "bg-brand text-white" : "text-ink-soft",
              )}
            >
              <n.icon className="h-[18px] w-[18px]" />
              {n.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          className={cx(
            "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold",
            more || moreActive ? "bg-ink text-bg" : "text-ink-soft",
          )}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
          Lainnya
        </button>
      </nav>
    </>
  );
}
