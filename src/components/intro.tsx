import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PIXELS } from "@/components/logo";
import { useClock } from "@/hooks/use-clock";
import { gsap } from "@/lib/gsap";
import { q } from "@/lib/queries";

const IntroContext = createContext(true);

/** `true` setelah intro selesai (atau dilewati). Dipakai beranda untuk memulai animasinya. */
export function useIntroDone() {
  return useContext(IntroContext);
}

/** Intro diputar setiap kali situs dibuka (muat penuh); navigasi di dalam situs tidak memutarnya lagi. */
export function IntroProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);
  const finish = useRef(() => setDone(true)).current;

  return (
    <IntroContext.Provider value={done}>
      {children}
      {!done && <SignalIntro onDone={finish} />}
    </IntroContext.Provider>
  );
}

const COLS = 8;
const ROWS = 5;
const TILES = 12;
const RED = "#e1243a";
const CREAM = "#f3eee6";
const INK = "#1d1517";
const MARQUEE = ["Live member", "Jadwal theater", "Birthday", "Recent live", "Berita resmi", "Your oshi", "Front row feeling"];

function split(text: string, attr: string) {
  return text.split("").map((c, i) => (
    <span key={i} data-i={attr} className="inline-block whitespace-pre">
      {c}
    </span>
  ));
}

/**
 * Intro "Fan Signal" (± 4,5 detik, bisa dilewati):
 * 1. HUD di empat sudut mengetik diri, frekuensi naik 00.0 → 48.0 MHz;
 * 2. panel merah naik dari bawah, judulnya tersusun huruf demi huruf, logo piksel terbentuk;
 * 3. 12 foto member asli membalik masuk dengan nomor 01–12, pita miring melintas;
 * 4. satu kartu terpilih menjadi "your oshi" (cincin merah + hati);
 * 5. semuanya beterbangan keluar, kotak-kotak merah menutup layar lalu menyusut membuka halaman.
 */
function SignalIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const clock = useClock();
  const members = useQuery(q.members());

  // 12 member aktif berfoto, urutan acak per kunjungan.
  const lineup = useMemo(() => {
    const pool = (members.data ?? []).filter((m) => !m.isGraduate && m.img);
    return gsap.utils.shuffle([...pool]).slice(0, TILES);
  }, [members.data]);
  const [oshi] = useState(() => Math.floor(Math.random() * TILES));

  useLayoutEffect(() => {
    document.body.classList.add("is-locked");
    const ctx = gsap.context(() => {
      const freq = root.current?.querySelector<HTMLElement>("[data-i='freq']");
      const f = { v: 0 };

      const t = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          document.body.classList.remove("is-locked");
          onDone();
        },
      });
      tl.current = t;

      t.set("[data-i='cell']", { scale: 0 })
        .from("[data-i='hud']", { opacity: 0, duration: 0.03, stagger: 0.012 }, 0.1)
        .to(f, { v: 48, duration: 2.6, ease: "power2.out", onUpdate: () => freq && (freq.textContent = f.v.toFixed(1).padStart(4, "0")) }, 0.2)
        .from("[data-i='bar']", { scaleY: 0, transformOrigin: "50% 100%", duration: 0.3, stagger: 0.25 }, 0.3)
        // Panel merah naik dari bawah.
        .fromTo("[data-i='card']", { clipPath: "inset(100% 0 0 0 round 28px)" }, { clipPath: "inset(0% 0 0 0 round 28px)", duration: 0.8, ease: "expo.inOut" }, 0.35)
        .from("[data-i='title']", { yPercent: 110, opacity: 0, duration: 0.5, stagger: 0.035, ease: "back.out(2)" }, 0.85)
        .from("[data-i='px']", { scale: 0, rotate: 90, opacity: 0, duration: 0.45, stagger: { each: 0.04, from: "random" }, ease: "back.out(3)" }, 0.9)
        .from("[data-i='tag']", { opacity: 0, y: 12, duration: 0.4, stagger: 0.08 }, 1.2)
        // Kartu member membalik masuk.
        .from("[data-i='tile']", { rotateY: 90, scale: 0.6, opacity: 0, duration: 0.6, stagger: { each: 0.06, from: "start" }, ease: "back.out(1.6)" }, 0.95)
        // Pita merah miring melintas.
        .fromTo("[data-i='band']", { xPercent: -5 }, { xPercent: -45, duration: 3, ease: "none" }, 1.15)
        // Satu kartu jadi "your oshi".
        .to(`[data-tile='${oshi}']`, { scale: 1.12, zIndex: 5, duration: 0.4, ease: "back.out(3)" }, 2.55)
        .fromTo("[data-i='ring']", { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.3 }, 2.6)
        .fromTo("[data-i='heart']", { scale: 0, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.45, ease: "back.out(4)" }, 2.7)
        .addLabel("out", 3.25)
        // Semua beterbangan keluar.
        .to("[data-i='tile']", {
          y: () => gsap.utils.random(-300, 300),
          x: () => gsap.utils.random(-200, 200),
          rotate: () => gsap.utils.random(-40, 40),
          opacity: 0,
          duration: 0.5,
          ease: "power3.in",
          stagger: { each: 0.02, from: "random" },
        }, "out")
        .to("[data-i='card']", { scale: 0.85, opacity: 0, duration: 0.45, ease: "power3.in" }, "out+=0.1")
        .to("[data-i='hud'], [data-i='band']", { opacity: 0, duration: 0.3 }, "out")
        // Kotak merah menutup layar, lalu menyusut membuka halaman.
        .to("[data-i='cell']", { scale: 1, duration: 0.35, ease: "power2.in", stagger: { grid: [ROWS, COLS], from: "center", amount: 0.3 } }, "out+=0.25")
        .set("[data-i='bg']", { opacity: 0 })
        .to("[data-i='cell']", { scale: 0, duration: 0.45, ease: "power3.out", stagger: { grid: [ROWS, COLS], from: "edges", amount: 0.35 } });
    }, root);

    return () => {
      document.body.classList.remove("is-locked");
      ctx.revert();
    };
  }, [onDone, oshi]);

  return (
    <div ref={root} className="fixed inset-0 z-[100] overflow-hidden" style={{ color: INK }} aria-hidden>
      <div data-i="bg" className="absolute inset-0" style={{ background: CREAM }} />

      {/* HUD empat sudut */}
      <div className="absolute inset-x-5 top-5 flex justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.18em] sm:inset-x-8 sm:top-7 sm:text-[11px]">
        <span>{split("JKT48Connect · Fan Signal", "hud")}</span>
        <span className="hidden sm:inline">{split(`WIB ${clock}`, "hud")}</span>
      </div>
      <div className="absolute inset-x-5 bottom-5 flex items-end justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.18em] sm:inset-x-8 sm:bottom-7 sm:text-[11px]">
        <span>
          {split("Tuning ", "hud")}
          <span data-i="freq" className="text-[18px] sm:text-[22px]" style={{ color: RED }}>
            00.0
          </span>
          {split(" MHz", "hud")}
        </span>
        <span className="flex items-end gap-3">
          <span className="hidden sm:inline">{split("Loading stage file", "hud")}</span>
          <span className="flex h-5 items-end gap-[3px]">
            {[0.35, 0.55, 0.75, 1].map((h, i) => (
              <span key={i} data-i="bar" className="w-[4px] rounded-[1px]" style={{ height: `${h * 100}%`, background: RED }} />
            ))}
          </span>
        </span>
      </div>

      {/* Panggung tengah: panel merah + mosaik lineup */}
      <div className="absolute inset-0 flex items-center justify-center px-5 py-16 sm:px-10">
        <div className="grid w-full max-w-[1100px] items-center gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-6">
          <div data-i="card" className="relative overflow-hidden rounded-[28px] p-6 text-white sm:p-8" style={{ background: RED }}>
            <svg viewBox="0 0 50 50" className="absolute right-6 top-6 h-14 w-14 sm:h-20 sm:w-20">
              {PIXELS.map(([x, y]) => (
                <rect key={`${x}-${y}`} data-i="px" x={x * 10} y={y * 10} width="10" height="10" rx="1.5" fill="#fff" />
              ))}
            </svg>
            <p data-i="tag" className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
              ● Welcome to
            </p>
            <p className="mt-10 overflow-hidden font-extrabold uppercase leading-[0.85] sm:mt-14" style={{ fontStretch: "75%", fontSize: "clamp(3rem, 8vw, 6rem)" }}>
              {split("JKT48", "title")}
              <br />
              <span style={{ color: "#fde6b0" }}>{split("Connect", "title")}</span>
            </p>
            <div className="mt-8 flex items-end justify-between gap-4 border-t border-white/25 pt-4">
              <p data-i="tag" className="text-[15px] font-extrabold leading-tight sm:text-[17px]">
                Your oshi.
                <br />
                <span className="text-white/80">Your front row feeling.</span>
              </p>
              <span data-i="tag" className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/70">
                {lineup.length || TILES} members on stage
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-1.5 [perspective:900px] sm:gap-2.5">
            {Array.from({ length: TILES }).map((_, i) => {
              const m = lineup[i];
              return (
                <div
                  key={i}
                  data-i="tile"
                  data-tile={i}
                  className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-white sm:rounded-xl"
                  style={{ borderColor: "rgb(29 21 23 / 0.1)" }}
                >
                  <div className="absolute inset-0" style={{ background: "#f6dcdc" }} />
                  {m && <img src={m.img} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />}
                  <span className="absolute left-1 top-1 font-mono text-[8px] font-semibold sm:left-1.5 sm:top-1.5 sm:text-[10px]" style={{ color: RED }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {m && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-white/90 px-1 py-0.5 text-[8px] font-extrabold sm:px-1.5 sm:text-[11px]">
                      {m.nickname || m.name.split(" ")[0]}
                    </span>
                  )}
                  {i === oshi && (
                    <>
                      <span data-i="ring" className="absolute inset-0 rounded-lg border-[3px] opacity-0 sm:rounded-xl" style={{ borderColor: RED }} />
                      <span data-i="heart" className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-[11px] text-white sm:h-7 sm:w-7 sm:text-[14px]" style={{ background: RED }}>
                        ♥
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pita merah miring dengan teks berjalan */}
      <div className="pointer-events-none absolute -left-[20vw] top-[14%] w-[140vw] -rotate-6 overflow-hidden md:top-[76%]">
        <div data-i="band" className="flex w-max whitespace-nowrap py-2.5 font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-white sm:py-3 sm:text-[14px]" style={{ background: INK }}>
          {Array.from({ length: 8 }).flatMap((_, k) =>
            MARQUEE.map((w) => (
              <span key={`${k}-${w}`} className="flex items-center gap-4 px-4">
                <span style={{ color: RED }}>✚</span>
                {w}
              </span>
            )),
          )}
        </div>
      </div>

      {/* Kotak-kotak transisi keluar */}
      <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
        {Array.from({ length: COLS * ROWS }).map((_, i) => (
          <div key={i} data-i="cell" className="-m-px" style={{ background: RED }} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => tl.current?.progress(1)}
        className="absolute bottom-14 right-5 z-10 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] transition hover:text-white sm:bottom-16 sm:right-8"
        style={{ borderColor: "rgb(29 21 23 / 0.25)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = RED)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        Lewati
      </button>
    </div>
  );
}
