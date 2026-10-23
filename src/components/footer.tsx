import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { Countdown } from "@/components/countdown";
import { PIXELS } from "@/components/logo";
import { SignalBars } from "@/components/motion";
import { Img, cx } from "@/components/ui";
import { useClock } from "@/hooks/use-clock";
import { gsap } from "@/lib/gsap";
import { NAV, SOCIALS } from "@/lib/nav";
import { q } from "@/lib/queries";

const COLS: { title: string; links: { label: string; to: string }[] }[] = [
  { title: "Jelajahi", links: NAV.filter((n) => n.group === "Utama").map((n) => ({ label: n.label, to: n.to })) },
  { title: "Arsip", links: NAV.filter((n) => n.group === "Arsip").map((n) => ({ label: n.label, to: n.to })) },
  {
    title: "Info",
    links: [
      { label: "API untuk developer", to: "/developer" },
      { label: "Tentang", to: "/about" },
      { label: "Disclaimer", to: "/disclaimer" },
      { label: "Ketentuan", to: "/terms" },
      { label: "Privasi", to: "/privacy" },
    ],
  },
];

/**
 * Footer tinta di dasar kolom utama: tagline + show berikutnya, deret foto member, kolom tautan,
 * wordmark yang terisi merah saat discroll, dan tombol kembali ke atas. Animasinya hanya saat muncul.
 */
export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const clock = useClock();
  const members = useQuery(q.members());
  const next = useQuery(q.nextSchedule());
  const show = next.data?.find((s) => s.category === "show");
  const active = (members.data ?? []).filter((m) => !m.isGraduate && m.img);
  const faces = active.slice(0, 7);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      tl.from("[data-ft]", { y: 28, opacity: 0, duration: 0.6, stagger: 0.06, ease: "power3.out" })
        .from("[data-col] li", { y: 12, opacity: 0, duration: 0.4, stagger: 0.025, ease: "power2.out" }, 0.25)
        .from("[data-fl]", { yPercent: 105, duration: 0.8, stagger: 0.04, ease: "expo.out" }, 0.3)
        .from("[data-fill]", { yPercent: 105, duration: 0.8, ease: "expo.out" }, 0.5)
        .from("[data-fpx]", { scale: 0, transformOrigin: "50% 50%", duration: 0.4, stagger: { each: 0.03, from: "random" }, ease: "back.out(2.5)" }, 0.6);
      // "CONNECT" bergaris tepi, terisi merah dari kiri mengikuti scroll.
      gsap.fromTo(
        "[data-fill]",
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", ease: "none", scrollTrigger: { trigger: "[data-word]", start: "top 95%", end: "bottom 75%", scrub: 0.6 } },
      );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <footer ref={ref} className="@container relative mx-3 mb-28 mt-16 overflow-hidden rounded-[28px] bg-nav text-white sm:mx-6 lg:mb-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" aria-hidden />

      <div className="relative grid gap-10 p-6 sm:p-10 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div>
          <p data-ft className="micro flex items-center gap-2 text-white/50">
            <SignalBars className="text-brand" /> JKT48Connect · Fan Signal
          </p>
          <p data-ft className="condensed mt-5 text-[clamp(2rem,4.6cqw,3.2rem)] uppercase leading-[0.88]">
            Your oshi.
            <br />
            <span className="text-brand">Your front row</span> feeling.
          </p>

          {faces.length > 0 && (
            <Link to="/member" data-ft className="group mt-6 flex w-max items-center gap-3">
              <span className="flex">
                {faces.map((m, i) => (
                  <span key={m.id} className={cx("transition-transform duration-300 group-hover:-translate-y-1", i > 0 && "-ml-2.5")} style={{ transitionDelay: `${i * 35}ms` }}>
                    <Img src={m.img} alt="" className="h-9 w-9 rounded-full object-cover object-top ring-2 ring-nav" />
                  </span>
                ))}
              </span>
              <span className="text-[13px] font-semibold text-white/70 transition-colors group-hover:text-white">
                {active.length} member aktif <ArrowUpRight className="inline h-3.5 w-3.5" />
              </span>
            </Link>
          )}

          {show && (
            <Link to="/theater/$id" params={{ id: show.id }} data-ft className="group mt-4 flex max-w-sm items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 transition-colors hover:bg-white/[0.1]">
              <span className="min-w-0 flex-1">
                <span className="micro block text-white/45">Show berikutnya</span>
                <span className="mt-0.5 block truncate text-[15px] font-bold">{show.title}</span>
                <Countdown target={show.date} className="block font-mono text-[12px] text-brand" />
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-white/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
            </Link>
          )}

          <div data-ft className="mt-6 flex flex-wrap gap-2">
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
          {COLS.map((c) => (
            <div key={c.title} data-col>
              <p className="micro text-white/40">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="group relative inline-block text-[15px] font-semibold text-white/70 transition-colors hover:text-white">
                      {l.label}
                      <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-brand transition-transform duration-300 group-hover:scale-x-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="@container relative px-5 sm:px-9" aria-hidden>
        <p data-word className="condensed flex overflow-hidden whitespace-nowrap pb-[1.5cqw] text-[15cqw] uppercase leading-[0.8]">
          {"JKT48".split("").map((c, i) => (
            <span key={`a${i}`} data-fl className="inline-block">
              {c}
            </span>
          ))}
          <span className="relative inline-flex">
            {/* Garis tepi di belakang; versi merah di depan terbuka mengikuti scroll. */}
            {"CONNECT".split("").map((c, i) => (
              <span key={`b${i}`} data-fl className="inline-block text-transparent [-webkit-text-stroke:1.5px_rgb(225_36_58/0.75)]">
                {c}
              </span>
            ))}
            <span data-fill className="absolute inset-0 flex text-brand">
              {"CONNECT".split("").map((c, i) => (
                <span key={i} className="inline-block">
                  {c}
                </span>
              ))}
            </span>
          </span>
        </p>
      </div>

      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 px-6 py-4 font-mono text-[11px] text-white/45 sm:px-10">
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
