import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { Countdown } from "@/components/countdown";
import { PIXELS } from "@/components/logo";
import { SignalBars } from "@/components/motion";
import { Img, cx } from "@/components/ui";
import { useClock } from "@/hooks/use-clock";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { NAV, SOCIALS } from "@/lib/nav";
import { q } from "@/lib/queries";

/** Menu sebagai "setlist" (M01, M02, …) dan halaman legal sebagai "encore". */
const SETLIST = NAV.map((n) => ({ label: n.label, to: n.to }));
const ENCORE = [
  { label: "Disclaimer", to: "/disclaimer" },
  { label: "Ketentuan", to: "/terms" },
  { label: "Privasi", to: "/privacy" },
];
/** Batang barcode tiket (lebar 1–3) — tetap, supaya tidak berubah tiap render. */
const BARS = [2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 1, 2];
const BAR_X = BARS.map((_, i) => BARS.slice(0, i).reduce((a, b) => a + b + 1, 0));
const BAR_WIDTH = BAR_X.at(-1)! + BARS.at(-1)!;
const WORD = [..."JKT48".split("").map((c) => [c, false] as const), ..."CONNECT".split("").map((c) => [c, true] as const)];

/**
 * Footer "curtain call": lampu sorot panggung yang berayun, strip lineup member yang lajunya ikut kecepatan
 * scroll, tiket theater sobek (show berikutnya + barcode), menu bergaya setlist, wordmark raksasa yang
 * hurufnya bergelombang mengikuti kursor, dan lencana "kembali ke atas" yang berputar.
 */
export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const clock = useClock();
  const members = useQuery(q.members());
  const next = useQuery(q.nextSchedule());
  const show = next.data?.find((s) => s.category === "show");
  const lineup = (members.data ?? []).filter((m) => !m.isGraduate && m.img).slice(0, 18);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      // Masuk: lampu menyala, tiket "dirobek" masuk, barcode tercetak, setlist berurutan, huruf jatuh ke panggung.
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      tl.from("[data-beam]", { opacity: 0, rotate: (i) => (i % 2 ? 35 : -35), duration: 1.1, ease: "power3.out", stagger: 0.12 })
        .from("[data-ticket]", { y: 70, rotate: -7, opacity: 0, duration: 0.9, ease: "back.out(1.6)" }, 0.1)
        .from("[data-bar]", { scaleY: 0, transformOrigin: "50% 100%", duration: 0.4, stagger: { each: 0.015, from: "random" }, ease: "power2.out" }, 0.5)
        .from("[data-set]", { x: -24, opacity: 0, duration: 0.5, stagger: 0.035, ease: "power3.out" }, 0.25)
        .from("[data-fl]", { yPercent: 110, rotate: (i) => (i % 2 ? 8 : -8), duration: 0.9, stagger: 0.05, ease: "back.out(1.8)" }, 0.45)
        .from("[data-fpx]", { scale: 0, rotate: 90, transformOrigin: "50% 50%", duration: 0.5, stagger: { each: 0.04, from: "random" }, ease: "back.out(3)" }, 0.8);
      if (calm) return;

      // Lampu sorot berayun pelan; lencana atas berputar.
      gsap.to("[data-beam]", { rotate: (i) => (i % 2 ? -9 : 9), duration: 4.5, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.8 });
      gsap.to("[data-badge]", { rotate: 360, duration: 18, ease: "none", repeat: -1, transformOrigin: "50% 50%" });

      // Lineup berjalan; scroll cepat mempercepat (dan membalik arah saat scroll naik).
      const track = el.querySelector<HTMLElement>("[data-track]");
      if (track) {
        const loop = gsap.to(track, { xPercent: -50, ease: "none", duration: 40, repeat: -1 });
        loop.totalTime(loop.duration() * 100);
        ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const boost = Math.min(Math.abs(self.getVelocity()) / 300, 6);
            gsap.to(loop, { timeScale: self.direction * (1 + boost), duration: 0.2, overwrite: true });
            gsap.to(loop, { timeScale: self.direction, duration: 1.2, delay: 0.25, ease: "power2.out", overwrite: false });
          },
        });
      }
    }, el);

    // Sorot panggung mengikuti kursor; huruf wordmark terangkat seperti ombak di dekat kursor.
    const spot = el.querySelector<HTMLElement>("[data-spot]");
    const word = el.querySelector<HTMLElement>("[data-word]");
    const letters = [...el.querySelectorAll<HTMLElement>("[data-fl]")];
    if (calm || !spot || !word) return () => ctx.revert();
    const sx = gsap.quickTo(spot, "x", { duration: 0.6, ease: "power3.out" });
    const sy = gsap.quickTo(spot, "y", { duration: 0.6, ease: "power3.out" });
    const lifts = letters.map((l) => gsap.quickTo(l, "y", { duration: 0.5, ease: "power3.out" }));
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      sx(e.clientX - r.left - 210);
      sy(e.clientY - r.top - 210);
      gsap.to(spot, { opacity: 1, duration: 0.4, overwrite: "auto" });
      const w = word.getBoundingClientRect();
      const near = e.clientY > w.top - 80 && e.clientY < w.bottom + 40;
      letters.forEach((l, i) => {
        const b = l.getBoundingClientRect();
        const d = Math.abs(e.clientX - (b.left + b.width / 2)) / w.width;
        lifts[i](near ? -Math.max(0, 1 - d * 4) * w.height * 0.3 : 0);
      });
    };
    const leave = () => {
      gsap.to(spot, { opacity: 0, duration: 0.5, overwrite: "auto" });
      lifts.forEach((f) => f(0));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      ctx.revert();
    };
  }, []);

  return (
    <footer ref={ref} className="@container relative isolate mx-3 mb-28 mt-16 overflow-hidden rounded-[28px] bg-nav text-white sm:mx-6 lg:mb-6">
      {/* Lampu panggung + sorot kursor */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <span data-beam className="absolute -top-8 left-[12%] h-[130%] w-[34%] origin-top bg-gradient-to-b from-brand/40 via-brand/10 to-transparent opacity-70 blur-md [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]" />
        <span data-beam className="absolute -top-8 right-[10%] h-[130%] w-[30%] origin-top bg-gradient-to-b from-white/25 via-white/5 to-transparent opacity-60 blur-md [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]" />
        <span data-spot className="absolute left-0 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgb(225_36_58/0.28),transparent_62%)] opacity-0" />
        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Lineup berjalan */}
      <div className="border-b border-white/10 py-3.5" aria-hidden>
        <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <div data-track className="flex w-max">
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0 items-center">
                {(lineup.length ? lineup : SETLIST).map((m, i) => (
                  <span key={i} className="mx-2 flex items-center gap-2.5 whitespace-nowrap rounded-full bg-white/[0.06] py-1 pl-1 pr-4">
                    {"img" in m ? (
                      <Img src={m.img} alt="" className="h-8 w-8 rounded-full object-cover object-top" />
                    ) : (
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/80 font-mono text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                    )}
                    <span className="text-[13px] font-bold">{"img" in m ? m.nickname || m.name.split(" ")[0] : m.label}</span>
                    <span className="text-brand">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-8 p-5 sm:p-9 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] @4xl:gap-12">
        {/* Tiket theater */}
        <div data-ticket className="relative flex flex-col overflow-hidden rounded-[24px] bg-brand shadow-[0_30px_60px_-30px_rgb(225_36_58/0.7)] @lg:flex-row">
          <div className="relative min-w-0 flex-1 p-6 sm:p-7">
            <p className="micro flex items-center gap-2 text-white/80">
              <SignalBars /> Admit one · Fan Signal
            </p>
            <p className="condensed mt-4 text-[clamp(2.1rem,6cqw,3.4rem)] uppercase leading-[0.86]">
              Sampai jumpa
              <br />
              di <span className="text-nav">theater.</span>
            </p>
            {show ? (
              <Link to="/theater/$id" params={{ id: show.id }} className="group mt-5 flex items-center gap-3 rounded-2xl bg-black/20 p-3 transition hover:bg-black/30">
                <span className="min-w-0 flex-1">
                  <span className="micro block text-white/70">Show berikutnya</span>
                  <span className="mt-0.5 block truncate text-[16px] font-extrabold">{show.title}</span>
                  <Countdown target={show.date} className="mt-0.5 block font-mono text-[12px] text-white/85" />
                </span>
                <ArrowUpRight className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <p className="mt-5 text-[14px] text-white/80">Your oshi, your front row feeling.</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {SOCIALS.map((s, i) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className={cx("btn group !px-4 !py-2 text-[13px]", i === 0 ? "bg-nav text-white hover:bg-black" : "bg-white/15 text-white hover:bg-white/25")}
                >
                  {s.label}
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Garis sobek: titik-titik + lubang setengah lingkaran di ujungnya */}
          <div aria-hidden className="relative h-0 border-t-2 border-dashed border-white/35 @lg:h-auto @lg:w-0 @lg:border-l-2 @lg:border-t-0">
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-nav @lg:-left-3 @lg:-top-3" />
            <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-nav @lg:-bottom-3 @lg:-left-3 @lg:right-auto @lg:top-auto" />
          </div>

          {/* Potongan tiket */}
          <div className="flex items-center justify-between gap-4 p-5 @lg:w-36 @lg:flex-col @lg:justify-center @lg:p-6">
            <div className="text-center">
              <p className="micro text-white/70">Row · Seat</p>
              <p className="condensed text-[34px] leading-none">A·48</p>
            </div>
            <svg viewBox={`0 0 ${BAR_WIDTH} 40`} className="h-12 w-36 @lg:h-14 @lg:w-24" aria-hidden>
              {BARS.map((w, i) => (
                <rect key={i} data-bar x={BAR_X[i]} y={0} width={w} height={40} className="fill-white/90" />
              ))}
            </svg>
            <p className="hidden font-mono text-[10px] tracking-[0.2em] text-white/70 @lg:block">№ {new Date().getFullYear()}</p>
          </div>
        </div>

        {/* Setlist */}
        <nav aria-label="Navigasi footer" className="min-w-0">
          <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
            <p className="micro text-white/50">Setlist malam ini</p>
            <p className="font-mono text-[11px] text-white/35">
              M01–M{String(SETLIST.length).padStart(2, "0")} · EN1–EN{ENCORE.length}
            </p>
          </div>
          <ol className="mt-1 grid grid-cols-1 gap-x-6 @md:grid-cols-2">
            {SETLIST.map((l, i) => (
              <SetRow key={l.to} no={`M${String(i + 1).padStart(2, "0")}`} {...l} />
            ))}
          </ol>
          <p className="micro mt-5 text-white/40">Encore</p>
          <ol className="grid grid-cols-1 gap-x-6 @md:grid-cols-3">
            {ENCORE.map((l, i) => (
              <SetRow key={l.to} no={`EN${i + 1}`} {...l} />
            ))}
          </ol>
        </nav>
      </div>

      {/* Wordmark */}
      <div className="relative px-4 sm:px-8" aria-hidden>
        <p data-word className="condensed flex justify-between overflow-hidden whitespace-nowrap pb-[1.2cqw] pt-[5cqw] text-[13.4cqw] uppercase leading-[0.8]">
          {WORD.map(([c, red], i) => (
            <span key={i} data-fl className={cx("inline-block will-change-transform", red && "text-brand")}>
              {c}
            </span>
          ))}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 px-5 py-4 font-mono text-[11px] text-white/45 sm:px-9">
        <span className="flex items-center gap-2 text-white/70">
          <svg viewBox="0 0 50 50" className="h-4 w-4">
            {PIXELS.map(([x, y]) => (
              <rect key={`${x}-${y}`} data-fpx x={x * 10} y={y * 10} width="10" height="10" rx="1.5" className="fill-brand" />
            ))}
          </svg>
          © {new Date().getFullYear()} JKT48Connect
        </span>
        <span>Proyek komunitas, bukan situs resmi JKT48</span>
        <Link to="/developer" className="transition-colors hover:text-white">
          Data: <span className="text-white/75">api.jkt48connect.app</span>
        </Link>
        <span className="ml-auto flex items-center gap-4">
          <span className="num flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            WIB {clock}
          </span>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Kembali ke atas"
            className="group relative grid h-16 w-16 place-items-center rounded-full text-white"
          >
            <svg data-badge viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <path id="ft-ring" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
              </defs>
              <text className="fill-white/60 font-mono text-[10.5px] uppercase">
                <textPath href="#ft-ring" textLength="234" lengthAdjust="spacing">
                  Curtain call · ke atas ·
                </textPath>
              </text>
            </svg>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand transition-transform duration-300 group-hover:scale-110">
              <ArrowUp className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
            </span>
          </button>
        </span>
      </div>
    </footer>
  );
}

function SetRow({ no, label, to }: { no: string; label: string; to: string }) {
  return (
    <li data-set>
      <Link to={to} className="group relative isolate flex items-center gap-3 overflow-hidden border-b border-white/[0.07] py-2.5 pl-2 pr-2 text-[15px] font-semibold text-white/75 transition-colors hover:text-white">
        <span className="absolute inset-0 -z-10 origin-left scale-x-0 rounded-lg bg-brand transition-transform duration-300 ease-out group-hover:scale-x-100" />
        <span className="w-9 font-mono text-[11px] text-brand transition-colors group-hover:text-white/80">{no}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ArrowUpRight className="h-4 w-4 -translate-x-2 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
      </Link>
    </li>
  );
}
