import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PixelCross } from "@/components/logo";
import { SignalBars } from "@/components/motion";
import { Skeleton, cx } from "@/components/ui";
import { fmtDate, fmtTime } from "@/lib/format";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { q } from "@/lib/queries";

type Slide = {
  key: string;
  img: string;
  label: string;
  title: string;
  meta: string;
  live?: boolean;
  to?: { id: string };
  href?: string;
};

const DURATION = 6;

/**
 * Banner utama beranda dari gambar desain jkt48connect: kartu notifikasi member
 * yang sedang live dan banner jadwal show berikutnya. Berganti otomatis dengan
 * wipe + zoom pelan, progress bar per slide, bisa digeser di HP.
 */
export function HeroCarousel() {
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());

  const slides = useMemo<Slide[]>(() => {
    const fromLive: Slide[] = (live.data ?? [])
      .filter((l) => l.banner)
      .map((l) => ({
        key: `live-${l.id}`,
        img: l.banner,
        label: "Sedang live",
        title: l.fullname || l.name,
        meta: `${l.platform === "idn" ? "IDN" : "Showroom"} · sejak ${fmtTime(l.startedAt)} WIB`,
        live: true,
        href: l.link,
      }));
    // Show tanpa banner (desain masih "pending") tetap tampil sebagai panel merah.
    const fromShows: Slide[] = (next.data ?? [])
      .filter((s) => s.category === "show")
      .map((s) => ({
        key: `show-${s.id}`,
        img: s.banner,
        label: "Show theater",
        title: s.title,
        meta: `${fmtDate(s.date, { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(s.date)} WIB`,
        to: { id: s.id },
      }));
    return [...fromLive, ...fromShows].slice(0, 7);
  }, [live.data, next.data]);

  const [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef<gsap.core.Tween | null>(null);
  const count = slides.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  // Transisi slide: wipe dari kanan + zoom pelan pada gambar + teks naik.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !count) return;
    const reduce = prefersReducedMotion();
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>("[data-slide]");
      items.forEach((s, i) => gsap.set(s, { zIndex: i === index ? 2 : 0, visibility: i === index ? "visible" : "hidden" }));
      const cur = items[index];
      if (!cur) return;
      if (!reduce) {
        gsap.fromTo(cur, { clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0%)", duration: 0.9, ease: "power4.inOut" });
        const img = cur.querySelector("img");
        if (img) gsap.fromTo(img, { scale: 1.06 }, { scale: 1, duration: DURATION + 1, ease: "none" });
        gsap.fromTo(cur.querySelectorAll("[data-cap]"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, delay: 0.35, ease: "power3.out" });
      }
      // Progress bar slide aktif; selesai → slide berikutnya.
      const bars = gsap.utils.toArray<HTMLElement>("[data-bar]");
      bars.forEach((b, i) => gsap.set(b, { scaleX: i < index ? 1 : 0 }));
      progress.current = gsap.fromTo(
        bars[index],
        { scaleX: 0 },
        { scaleX: 1, duration: DURATION, ease: "none", onComplete: () => count > 1 && go(index + 1) },
      );
    }, el);
    return () => {
      progress.current = null;
      ctx.revert();
    };
  }, [index, count, go]);

  useEffect(() => {
    if (index >= count && count) setIndex(0);
  }, [count, index]);

  // Geser di layar sentuh.
  const startX = useRef<number | null>(null);

  if (!count) {
    if (live.isLoading || next.isLoading) return <Skeleton className="aspect-[16/9] w-full rounded-3xl" />;
    return (
      <div className="relative flex aspect-[16/9] items-end overflow-hidden rounded-3xl bg-brand p-8 text-white">
        <PixelCross className="absolute right-8 top-8 h-16 w-16" cellClass="fill-white/30" />
        <p className="condensed text-[clamp(2rem,5vw,3.5rem)] uppercase leading-[0.9]">Belum ada show terdekat</p>
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="group relative aspect-[16/9] overflow-hidden rounded-3xl bg-surface shadow-[0_30px_60px_-35px_rgb(0_0_0/0.55)]"
      onPointerEnter={() => progress.current?.pause()}
      onPointerLeave={() => progress.current?.resume()}
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current == null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      {slides.map((s, i) => {
        const inner = (
          <>
            {s.img ? (
              <img src={s.img} alt={s.title} loading={i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="relative flex h-full w-full flex-col justify-center bg-brand px-8 text-white sm:px-12">
                <PixelCross className="absolute right-8 top-10 h-20 w-20 opacity-25" cellClass="fill-white" />
                <p className="micro text-white/80">Your next theater date</p>
                <p className="condensed mt-3 max-w-[80%] text-[clamp(2.5rem,7vw,5rem)] uppercase leading-[0.86]">{s.title}</p>
                <p className="mt-3 font-mono text-[13px] text-white/85">{s.meta}</p>
              </div>
            )}
            {/* Desain banner sudah memuat judul & tanggal; cukup label kecil di pojok. */}
            <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 sm:bottom-5 sm:left-5">
              <span data-cap className={cx("pill py-1", s.live ? "bg-brand text-white" : "bg-ink/85 text-white backdrop-blur")}>
                {s.live ? <SignalBars className="h-2.5" /> : <PixelCross className="h-2.5 w-2.5" cellClass="fill-white" />}
                {s.label}
              </span>
              <span data-cap className="pill bg-card/90 py-1 text-ink backdrop-blur">
                {s.title} · {s.meta}
              </span>
            </div>
          </>
        );
        const cls = "absolute inset-0 block";
        return (
          <div key={s.key} data-slide className={cls} style={{ visibility: i === index ? "visible" : "hidden" }}>
            {s.to ? (
              <Link to="/theater/$id" params={s.to} className={cls} draggable={false}>
                {inner}
              </Link>
            ) : (
              <a href={s.href} target="_blank" rel="noopener noreferrer" className={cls} draggable={false}>
                {inner}
              </a>
            )}
          </div>
        );
      })}

      {/* Progress per slide, seperti stories. */}
      <div className="absolute inset-x-5 top-4 z-10 flex gap-1.5 sm:inset-x-7">
        {slides.map((s, i) => (
          <button key={s.key} type="button" onClick={() => go(i)} aria-label={`Slide ${i + 1}`} className="h-1 flex-1 overflow-hidden rounded-full bg-white/35">
            <span data-bar className="block h-full origin-left rounded-full bg-white" />
          </button>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Sebelumnya"
            className={cx("absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-ink opacity-0 transition group-hover:opacity-100")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Berikutnya"
            className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-ink opacity-0 transition group-hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
