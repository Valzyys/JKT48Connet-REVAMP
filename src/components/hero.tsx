import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef } from "react";
import { RecentRow } from "@/components/cards";
import { Clock, Countdown } from "@/components/countdown";
import { useIntroDone } from "@/components/intro";
import { Img, Skeleton, cx } from "@/components/ui";
import { useMemberPhotos } from "@/hooks/use-member-index";
import { fmtDate, fmtTime } from "@/lib/format";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import type { TheaterShow } from "@/lib/jkt48";
import { q } from "@/lib/queries";

/** Barcode dekoratif yang konsisten untuk setiap kode show. */
function Barcode({ code }: { code: string }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of `*${code}*`) {
    const bits = ch.charCodeAt(0).toString(2).padStart(8, "0");
    for (const b of bits) {
      const w = b === "1" ? 2.4 : 1;
      bars.push({ x, w });
      x += w + 1.4;
    }
  }
  return (
    <svg viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="40" fill="currentColor" />
      ))}
    </svg>
  );
}

function longestWord(s: string) {
  return Math.max(...s.split(/\s+/).map((w) => w.length));
}

function Ticket({ show }: { show: TheaterShow }) {
  const photos = useMemberPhotos();
  return (
    <Link
      to="/theater/$id"
      params={{ id: show.id }}
      data-hero="ticket"
      className="ticket group relative grid overflow-hidden rounded-lg bg-[#f3e9da] text-[#17120f] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)] transition-[rotate] duration-500 hover:-rotate-1 md:grid-cols-[minmax(0,1fr)_30%]"
      style={{ ["--stub" as string]: "150px" }}
    >
      <div className="relative min-w-0 p-6 [container-type:inline-size] sm:p-8">
        <p className="flex justify-between text-[11px] font-bold uppercase tracking-[0.25em] text-[#17120f]/55">
          <span>Admit one</span>
          <span>JKT48 Theater · fX Sudirman</span>
        </p>
        {/* Ukuran judul menyesuaikan panjangnya agar satu kata panjang (mis. "ITADAKI♥LOVE") tidak terpotong. */}
        <h2
          className="condensed mt-5 uppercase leading-[0.84] transition-colors group-hover:text-[#d7192b]"
          style={{ fontSize: `clamp(2rem, calc(100cqw / ${Math.max(6, longestWord(show.title)) * 0.5}), 5.25rem)` }}
        >
          {show.title}
        </h2>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-[#17120f]/15 pt-4">
          {[
            ["Tanggal", fmtDate(show.date, { weekday: "short", day: "numeric", month: "short" })],
            ["Jam", `${fmtTime(show.date)} WIB`],
            ["Team", show.team || "JKT48"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#17120f]/50">{k}</dt>
              <dd className="mt-1 text-[16px] font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        {show.members.length > 0 && (
          <div className="mt-5 flex items-center gap-3">
            <div className="flex">
              {show.members.slice(0, 8).map((m) => (
                <Img
                  key={m.id}
                  src={m.img || photos.get(m.id)}
                  alt={m.name}
                  className="-ml-2 h-9 w-9 rounded-full border-2 border-[#f3e9da] object-cover object-top first:ml-0"
                />
              ))}
            </div>
            <span className="text-[13px] font-semibold text-[#17120f]/60">{show.memberCount ?? show.members.length} member</span>
          </div>
        )}
        {show.birthday.length > 0 && (
          <span
            data-hero="stamp"
            className="absolute right-6 top-14 -rotate-12 rounded border-[3px] border-[#d7192b] px-3 py-1 text-center text-[13px] font-black uppercase leading-tight tracking-wider text-[#d7192b] opacity-90"
          >
            Seitansai
            <br />
            {show.birthday.map((b) => b.name).join(" · ")}
          </span>
        )}
      </div>

      <div data-hero="stub" className="flex h-[150px] flex-col justify-between border-t-2 border-dashed border-[#17120f]/25 p-6 md:h-auto md:border-l-2 md:border-t-0">
        <div className="flex items-start justify-between md:block">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#17120f]/50">No. show</p>
            <p className="led mt-1 text-[26px] leading-none text-[#d7192b] [text-shadow:none]">{show.id}</p>
          </div>
          <div className="text-right md:mt-6 md:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#17120f]/50">Mulai dalam</p>
            <Countdown target={show.date} className="led mt-1 block text-[20px] leading-none text-[#17120f] [text-shadow:none]" />
          </div>
        </div>
        <div className="hidden text-[#17120f] md:block">
          <Barcode code={show.id} />
        </div>
      </div>
    </Link>
  );
}

function OnAirStage() {
  const live = useQuery(q.live());
  const recent = useQuery({ ...q.recentList(1, 3), enabled: live.isSuccess && live.data.length === 0 });
  const data = live.data ?? [];

  return (
    <div data-hero="stage" className="min-w-0">
      <div className="flex items-end justify-between border-b border-line pb-3">
        <p className="flex items-baseline gap-3">
          <span className={cx("led text-[40px] leading-none", !data.length && "led-off")}>ON AIR</span>
          {data.length > 0 && <span className="led text-[40px] leading-none">{String(data.length).padStart(2, "0")}</span>}
        </p>
        <Link to="/live" className="link-arrow">
          Semua →
        </Link>
      </div>

      {live.isLoading ? (
        <div className="space-y-3 pt-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : data.length ? (
        <ul>
          {data.slice(0, 5).map((l) => (
            <li key={l.id} data-hero="live">
              <a href={l.link} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 border-b border-line py-3">
                <span className="relative shrink-0">
                  <span data-hero="ring" className="absolute -inset-1 rounded-full bg-brand/40 blur-md" />
                  <Img src={l.avatar} alt={l.name} className="penlight relative h-12 w-12 rounded-full object-cover object-top" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold group-hover:text-brand">{l.fullname || l.name}</span>
                  <span className="num block truncate text-[13px] text-ink-soft">
                    {l.platform === "idn" ? "IDN" : "Showroom"} · sejak {fmtTime(l.startedAt)}
                    {l.title && ` · ${l.title}`}
                  </span>
                </span>
                <span className="text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-brand">↗</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="pt-4">
          <p className="text-ink-soft">Panggung sedang kosong. Belum ada member yang live.</p>
          {recent.data?.items.map((r) => (
            <RecentRow key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const ready = useIntroDone();
  const next = useQuery(q.nextSchedule());
  const live = useQuery(q.live());
  const show = next.data?.find((s) => s.category === "show");
  const loaded = !next.isLoading && !live.isLoading;

  // Lampu sorot mengikuti kursor di area hero.
  useEffect(() => {
    const el = root.current;
    const light = spot.current;
    if (!el || !light || prefersReducedMotion() || matchMedia("(pointer: coarse)").matches) return;
    const toX = gsap.quickTo(light, "x", { duration: 0.8, ease: "power3.out" });
    const toY = gsap.quickTo(light, "y", { duration: 0.8, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      toX(e.clientX - r.left - light.offsetWidth / 2);
      toY(e.clientY - r.top - light.offsetHeight / 2);
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, []);

  // Masuk panggung setelah intro selesai dan data siap: tiket "dicap", penlight menyala.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !ready || !loaded) return;
    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) {
        gsap.set("[data-hero]", { opacity: 1 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo("[data-hero='meta']", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 })
        .fromTo("[data-hero='ticket']", { opacity: 0, y: 90, rotate: -7 }, { opacity: 1, y: 0, rotate: 0, duration: 1, ease: "back.out(1.3)" }, "-=0.2")
        .fromTo("[data-hero='stub']", { rotate: 5, x: 14, transformOrigin: "0% 0%" }, { rotate: 0, x: 0, duration: 0.6, ease: "elastic.out(1, 0.5)" }, "-=0.45")
        .fromTo("[data-hero='stamp']", { opacity: 0, scale: 2.4 }, { opacity: 0.9, scale: 1, duration: 0.35, ease: "power4.in" }, "-=0.2")
        .fromTo("[data-hero='stage']", { opacity: 0 }, { opacity: 1, duration: 0.3 }, "-=0.6")
        .fromTo("[data-hero='live']", { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.08 }, "-=0.2");
      gsap.to("[data-hero='ring']", { opacity: 0.25, scale: 0.85, duration: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: 0.3 });
    }, el);
    return () => ctx.revert();
  }, [ready, loaded]);

  return (
    <section ref={root} className="relative overflow-hidden">
      <div
        ref={spot}
        aria-hidden
        className="pointer-events-none absolute left-[18%] top-0 h-[42rem] w-[42rem] rounded-full"
        style={{ background: "radial-gradient(circle, rgb(255 225 190 / 0.12), rgb(255 225 190 / 0.04) 40%, transparent 68%)" }}
      />
      <div className="container-x relative pb-6 pt-24 sm:pt-28">
        <div data-hero="meta" className="mb-6 flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-ink-soft">
          <Clock />
          <span className="uppercase tracking-[0.25em]">Tiket show berikutnya</span>
        </div>
        <div className="grid items-start gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {show ? (
            <Ticket show={show} />
          ) : next.isLoading ? (
            <Skeleton className="h-[340px] rounded-lg" />
          ) : (
            <p data-hero="ticket" className="rounded-lg border border-dashed border-line p-10 text-ink-soft">
              Belum ada jadwal show theater terdekat.
            </p>
          )}
          <OnAirStage />
        </div>
      </div>
    </section>
  );
}
