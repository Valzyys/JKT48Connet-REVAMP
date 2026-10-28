import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowUpRight, Shuffle } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Countdown } from "@/components/countdown";
import { PIXELS } from "@/components/logo";
import { CountUp, SignalBars } from "@/components/motion";
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
      { label: "Donasi Karhutla", to: "/donasika" },
      { label: "API untuk developer", to: "/developer" },
      { label: "Tentang", to: "/about" },
      { label: "Disclaimer", to: "/disclaimer" },
      { label: "Ketentuan", to: "/terms" },
      { label: "Privasi", to: "/privacy" },
    ],
  },
];

/** Huruf 5×7 piksel untuk wordmark — senada dengan logo salib piksel JKT48Connect. */
const GLYPHS: Record<string, string[]> = {
  J: ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
};
const WORD = "JKT48CONNECT";
const CELL = 10;
/** Setiap sel papan: menyala (huruf) atau titik redup; "red" untuk CONNECT. */
const BOARD = (() => {
  const on: { x: number; y: number; red: boolean }[] = [];
  const off: { x: number; y: number }[] = [];
  [...WORD].forEach((ch, i) => {
    const g = GLYPHS[ch];
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 6; x++) {
        const cx = i * 6 + x;
        if (x < 5 && g[y][x] === "#") on.push({ x: cx, y, red: i >= 5 });
        else if (cx < WORD.length * 6 - 1) off.push({ x: cx, y });
      }
  });
  return { on, off, cols: WORD.length * 6 - 1 };
})();

/**
 * Footer tinta: tagline, kartu "oshi hari ini" yang bisa diacak, strip angka live, kolom tautan bergulir,
 * dan wordmark papan piksel yang tersusun saat muncul serta bergelombang mengikuti kursor.
 */
export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const clock = useClock();
  const members = useQuery(q.members());
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const show = next.data?.find((s) => s.category === "show");
  const active = useMemo(() => (members.data ?? []).filter((m) => !m.isGraduate && m.img), [members.data]);
  const liveCount = live.data?.length ?? 0;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      tl.from(el, { clipPath: "inset(14% 0% 0% 0% round 28px)", y: 40, duration: 0.9, ease: "power3.out" })
        .from("[data-ft]", { y: 26, opacity: 0, duration: 0.6, stagger: 0.07, ease: "power3.out" }, 0.15)
        .from("[data-stat]", { y: 18, opacity: 0, duration: 0.5, stagger: 0.08, ease: "power3.out" }, 0.3)
        .from("[data-col] > p", { opacity: 0, x: -10, duration: 0.4, stagger: 0.08 }, 0.2)
        .from("[data-col] li", { y: 12, opacity: 0, duration: 0.4, stagger: 0.025, ease: "power2.out" }, 0.3)
        .from("[data-dot]", { opacity: 0, duration: 0.6, stagger: { amount: 0.5, from: "random" } }, 0.35)
        // Piksel beterbangan lalu tersusun menjadi huruf.
        .from(
          "[data-px]",
          {
            x: () => gsap.utils.random(-260, 260),
            y: () => gsap.utils.random(-160, 120),
            scale: 0,
            opacity: 0,
            duration: 1.1,
            ease: "expo.out",
            stagger: { amount: 0.9, from: "random" },
          },
          0.4,
        )
        .from("[data-fpx]", { scale: 0, transformOrigin: "50% 50%", duration: 0.4, stagger: { each: 0.03, from: "random" }, ease: "back.out(2.5)" }, 0.8);
    }, el);
    if (calm) return () => ctx.revert();

    const offs: (() => void)[] = [];
    // Tombol ikut tertarik sedikit ke arah kursor.
    el.querySelectorAll<HTMLElement>("[data-magnet]").forEach((b) => {
      const x = gsap.quickTo(b, "x", { duration: 0.4, ease: "power3.out" });
      const y = gsap.quickTo(b, "y", { duration: 0.4, ease: "power3.out" });
      const move = (e: PointerEvent) => {
        const r = b.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.25);
        y((e.clientY - r.top - r.height / 2) * 0.35);
      };
      const leave = () => {
        x(0);
        y(0);
      };
      b.addEventListener("pointermove", move);
      b.addEventListener("pointerleave", leave);
      offs.push(() => {
        b.removeEventListener("pointermove", move);
        b.removeEventListener("pointerleave", leave);
      });
    });

    // Papan piksel: piksel di dekat kursor membesar dan terangkat seperti riak.
    const board = el.querySelector<SVGSVGElement>("[data-board]");
    const px = [...el.querySelectorAll<SVGRectElement>("[data-px]")];
    if (board && px.length) {
      const cells = px.map((r) => ({ x: Number(r.dataset.cx), y: Number(r.dataset.cy) }));
      // quickTo hanya untuk satu properti nyata: skala SVG diatur lewat scaleX + scaleY.
      const sxs = px.map((r) => gsap.quickTo(r, "scaleX", { duration: 0.35, ease: "power3.out" }));
      const sys = px.map((r) => gsap.quickTo(r, "scaleY", { duration: 0.35, ease: "power3.out" }));
      const scale = px.map((_, i) => (v: number) => {
        sxs[i](v);
        sys[i](v);
      });
      const lift = px.map((r) => gsap.quickTo(r, "y", { duration: 0.35, ease: "power3.out" }));
      gsap.set(px, { transformOrigin: "50% 50%" });
      let frame = 0;
      const move = (e: PointerEvent) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const r = board.getBoundingClientRect();
          const gx = ((e.clientX - r.left) / r.width) * BOARD.cols;
          const gy = ((e.clientY - r.top) / r.height) * 7;
          cells.forEach((c, i) => {
            const d = Math.hypot(c.x + 0.5 - gx, (c.y + 0.5 - gy) * 1.2);
            const k = Math.max(0, 1 - d / 6) ** 1.5;
            scale[i](1 + k * 0.22);
            lift[i](-k * CELL * 1.4);
          });
        });
      };
      const leave = () => {
        cancelAnimationFrame(frame);
        scale.forEach((f) => f(1));
        lift.forEach((f) => f(0));
      };
      board.addEventListener("pointermove", move);
      board.addEventListener("pointerleave", leave);
      offs.push(() => {
        board.removeEventListener("pointermove", move);
        board.removeEventListener("pointerleave", leave);
        cancelAnimationFrame(frame);
      });
    }
    return () => {
      offs.forEach((f) => f());
      ctx.revert();
    };
  }, []);

  return (
    <footer ref={ref} className="@container relative mx-3 mb-28 mt-16 overflow-hidden rounded-[28px] bg-nav text-white sm:mx-6 lg:mb-6">
      <div className="grid gap-10 p-6 sm:p-10 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0">
          <p data-ft className="micro flex items-center gap-2 text-white/50">
            <SignalBars className="text-brand" /> JKT48Connect · Fan Signal
          </p>
          <p data-ft className="condensed mt-5 text-[clamp(2rem,4.6cqw,3.2rem)] uppercase leading-[0.88]">
            Your oshi.
            <br />
            <span className="text-brand">Your front row</span> feeling.
          </p>
          <div data-ft className="mt-6">
            <OshiCard members={active} />
          </div>
          <div data-ft className="mt-6 flex flex-wrap gap-2">
            {SOCIALS.map((s, i) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                data-magnet
                className={cx("btn group", i === 0 ? "bg-brand text-white hover:bg-brand-strong" : "bg-white/[0.08] text-white hover:bg-white/[0.16]")}
              >
                {s.label}
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 content-start gap-8 sm:grid-cols-3">
          {COLS.map((c) => (
            <div key={c.title} data-col>
              <p className="micro text-white/40">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="group relative inline-flex items-center gap-1.5 text-[15px] font-semibold">
                      {/* Teks bergulir: label lama naik keluar, label putih masuk dari bawah. */}
                      <span className="relative block overflow-hidden">
                        <span className="block text-white/70 transition-transform duration-300 ease-out group-hover:-translate-y-full">{l.label}</span>
                        <span className="absolute inset-0 block translate-y-full text-white transition-transform duration-300 ease-out group-hover:translate-y-0" aria-hidden>
                          {l.label}
                        </span>
                      </span>
                      <span className="h-1.5 w-1.5 scale-0 rounded-full bg-brand transition-transform duration-300 group-hover:scale-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Strip angka live */}
      <div className="grid grid-cols-2 border-y border-white/10 @3xl:grid-cols-4">
        <Link to="/live" data-stat className="group border-b border-r border-white/10 px-6 py-4 transition-colors hover:bg-white/[0.04] sm:px-10 @3xl:border-b-0 @3xl:px-6">
          <p className="micro flex items-center gap-2 text-white/45">
            <span className={cx("h-1.5 w-1.5 rounded-full", liveCount ? "animate-pulse bg-brand" : "bg-white/25")} /> Live sekarang
          </p>
          <p className="condensed mt-1 text-[30px] leading-none">
            <CountUp value={liveCount} /> <span className="text-[15px] text-white/50">member</span>
          </p>
        </Link>
        <Link to="/member" data-stat className="group border-b border-white/10 px-6 py-4 transition-colors hover:bg-white/[0.04] sm:px-10 @3xl:border-b-0 @3xl:border-r @3xl:px-6">
          <p className="micro text-white/45">Member aktif</p>
          <p className="condensed mt-1 text-[30px] leading-none">
            <CountUp value={active.length} />
          </p>
        </Link>
        <Link to="/schedule" data-stat className="group border-r border-white/10 px-6 py-4 transition-colors hover:bg-white/[0.04] sm:px-10 @3xl:px-6">
          <p className="micro text-white/45">Show berikutnya</p>
          {show ? (
            <>
              <p className="mt-1 truncate text-[14px] font-bold">{show.title}</p>
              <Countdown target={show.date} className="block font-mono text-[12px] text-brand" />
            </>
          ) : (
            <p className="mt-1 text-[14px] text-white/50">Belum ada jadwal</p>
          )}
        </Link>
        <Link to="/developer" data-stat className="group px-6 py-4 transition-colors hover:bg-white/[0.04] sm:px-10 @3xl:px-6">
          <p className="micro text-white/45">Sumber data</p>
          <p className="mt-1 truncate font-mono text-[13px] text-white/80">api.jkt48connect.app</p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-white/45 transition-colors group-hover:text-white">
            Pakai API-nya <ArrowUpRight className="h-3 w-3" />
          </p>
        </Link>
      </div>

      {/* Wordmark papan piksel */}
      <div className="px-5 pb-3 pt-7 sm:px-9" aria-hidden>
        <svg data-board viewBox={`0 0 ${BOARD.cols * CELL} ${7 * CELL}`} className="block w-full touch-none overflow-visible">
          {BOARD.off.map((c) => (
            <circle key={`o${c.x}-${c.y}`} data-dot cx={c.x * CELL + CELL / 2} cy={c.y * CELL + CELL / 2} r={1.1} className="fill-white/10" />
          ))}
          {BOARD.on.map((c) => (
            <rect
              key={`p${c.x}-${c.y}`}
              data-px
              data-cx={c.x}
              data-cy={c.y}
              x={c.x * CELL + 0.6}
              y={c.y * CELL + 0.6}
              width={CELL - 1.2}
              height={CELL - 1.2}
              rx={1.8}
              className={c.red ? "fill-brand" : "fill-white"}
            />
          ))}
        </svg>
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
            data-magnet
            className="group relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-brand text-white transition-colors hover:bg-brand-strong"
          >
            <ArrowUp className="h-4 w-4 transition-transform duration-300 ease-out group-hover:-translate-y-8" />
            <ArrowUp className="absolute h-4 w-4 translate-y-8 transition-transform duration-300 ease-out group-hover:translate-y-0" aria-hidden />
          </button>
        </span>
      </div>
    </footer>
  );
}

type OshiMember = { id: string; name: string; nickname: string; img: string };

/** "Oshi hari ini": member pilihan harian; tombol acak mengocok foto seperti slot lalu berhenti di member baru. */
function OshiCard({ members }: { members: OshiMember[] }) {
  const [index, setIndex] = useState(-1);
  const photo = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  // Pilihan awal tetap sepanjang hari (berdasarkan tanggal), jadi tidak berubah tiap render/kunjungan.
  useEffect(() => {
    if (!members.length || index >= 0) return;
    const day = Math.floor((Date.now() + 7 * 3600e3) / 86400e3);
    setIndex(day % members.length);
  }, [members.length, index]);

  if (!members.length || index < 0) return <div className="h-[76px] w-full max-w-sm animate-pulse rounded-2xl bg-white/[0.06]" />;
  const m = members[index % members.length];

  const shuffle = () => {
    const el = photo.current;
    if (busy.current || !el || members.length < 2) return;
    busy.current = true;
    const steps = 7;
    let n = index;
    const tl = gsap.timeline({ onComplete: () => void (busy.current = false) });
    for (let s = 0; s < steps; s++) {
      const last = s === steps - 1;
      tl.to(el, { rotateY: 90, duration: 0.06 + s * 0.02, ease: "power1.in" }).add(() => {
        n = last ? (index + 1 + Math.floor(Math.random() * (members.length - 1))) % members.length : Math.floor(Math.random() * members.length);
        setIndex(n);
      });
      tl.to(el, { rotateY: 0, duration: last ? 0.5 : 0.06 + s * 0.02, ease: last ? "back.out(2.2)" : "power1.out" });
    }
  };

  return (
    <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 pr-3">
      <div className="[perspective:600px]">
        <div ref={photo} className="h-14 w-14 overflow-hidden rounded-xl bg-white/10">
          <Img src={m.img} alt={m.name} className="h-full w-full object-cover object-top" />
        </div>
      </div>
      <Link to="/member/$id" params={{ id: m.id }} className="group min-w-0 flex-1">
        <span className="micro block text-white/45">Oshi hari ini</span>
        <span className="mt-0.5 block truncate text-[16px] font-extrabold transition-colors group-hover:text-brand">{m.nickname || m.name}</span>
        <span className="block truncate text-[12px] text-white/50">{m.name}</span>
      </Link>
      <button
        type="button"
        onClick={shuffle}
        aria-label="Acak oshi lain"
        title="Acak oshi lain"
        className="group grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white transition hover:bg-brand"
      >
        <Shuffle className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
      </button>
    </div>
  );
}
