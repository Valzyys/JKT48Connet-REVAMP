import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PIXELS } from "@/components/logo";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

const SEEN_KEY = "jkt48c:intro-seen";
const IntroContext = createContext(true);

/** `true` setelah intro selesai (atau dilewati). Dipakai beranda untuk memulai animasinya. */
export function useIntroDone() {
  return useContext(IntroContext);
}

function shouldPlay() {
  if (prefersReducedMotion()) return false;
  try {
    return sessionStorage.getItem(SEEN_KEY) !== "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* abaikan */
  }
}

export function IntroProvider({ children }: { children: ReactNode }) {
  const [play] = useState(shouldPlay);
  const [done, setDone] = useState(!play);
  const finish = useCallback(() => {
    markSeen();
    setDone(true);
  }, []);

  return (
    <IntroContext.Provider value={done}>
      {children}
      {play && !done && <SignalIntro onDone={finish} />}
    </IntroContext.Provider>
  );
}

const COLS = 8;
const ROWS = 5;
const WORD = "JKT48Connect".split("");

/**
 * Intro "mencari sinyal":
 * 1. piksel beterbangan lalu menyusun logo salib JKT48Connect,
 * 2. bar sinyal naik satu per satu dan garis lengkung tergambar,
 * 3. nama muncul huruf demi huruf,
 * 4. layar pecah menjadi kotak-kotak merah yang menyusut, membuka halaman.
 */
function SignalIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    document.body.classList.add("is-locked");
    const ctx = gsap.context(() => {
      const path = root.current?.querySelector<SVGPathElement>("[data-i='loop']");
      const len = path?.getTotalLength() ?? 0;
      if (path) gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });

      const t = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          document.body.classList.remove("is-locked");
          onDone();
        },
      });
      tl.current = t;

      t.from("[data-i='px']", {
        x: () => gsap.utils.random(-260, 260),
        y: () => gsap.utils.random(-200, 200),
        rotate: () => gsap.utils.random(-180, 180),
        scale: 0,
        opacity: 0,
        duration: 0.9,
        ease: "expo.out",
        stagger: { each: 0.035, from: "random" },
      })
        .to("[data-i='mark']", { rotate: 90, duration: 0.6, ease: "back.inOut(2)" }, "-=0.1")
        .to(path ?? {}, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, "-=0.5")
        .from("[data-i='bar']", { scaleY: 0, transformOrigin: "50% 100%", duration: 0.35, stagger: 0.08 }, "<")
        .from("[data-i='char']", { yPercent: 120, opacity: 0, duration: 0.5, stagger: 0.03 }, "<0.15")
        .from("[data-i='sub']", { opacity: 0, y: 10, duration: 0.4 }, "-=0.2")
        .addLabel("out", "+=0.35")
        .to("[data-i='content']", { scale: 0.92, opacity: 0, duration: 0.35, ease: "power2.in" }, "out")
        .to(path ?? {}, { opacity: 0, duration: 0.3 }, "out")
        // Layar terbelah jadi kotak-kotak yang menyusut dari tengah ke tepi.
        .to("[data-i='cell']", { scale: 0, duration: 0.55, ease: "power3.in", stagger: { grid: [ROWS, COLS], from: "center", amount: 0.45 } }, "out+=0.1");
    }, root);

    return () => {
      document.body.classList.remove("is-locked");
      ctx.revert();
    };
  }, [onDone]);

  return (
    <div ref={root} className="fixed inset-0 z-[100]" aria-hidden>
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
        {Array.from({ length: COLS * ROWS }).map((_, i) => (
          <div key={i} data-i="cell" className="-m-px bg-[#e1243a]" />
        ))}
      </div>

      <svg viewBox="0 0 1200 800" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        <path
          data-i="loop"
          d="M-40 620 C 220 520, 360 760, 560 600 S 760 180, 980 300 S 1180 700, 1260 520"
          fill="none"
          stroke="rgb(255 255 255 / 0.35)"
          strokeWidth="2"
        />
      </svg>

      <div data-i="content" className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <svg data-i="mark" viewBox="0 0 50 50" className="h-24 w-24 sm:h-28 sm:w-28">
          {PIXELS.map(([x, y]) => (
            <rect key={`${x}-${y}`} data-i="px" x={x * 10} y={y * 10} width="10" height="10" rx="1.5" fill="#fff" />
          ))}
        </svg>
        <div className="mt-8 flex items-end gap-4">
          <div className="flex h-7 items-end gap-1" aria-hidden>
            {[0.35, 0.55, 0.75, 1].map((h, i) => (
              <span key={i} data-i="bar" className="w-1.5 rounded-sm bg-white" style={{ height: `${h * 100}%` }} />
            ))}
          </div>
          <p className="flex overflow-hidden text-[clamp(2rem,6vw,3.75rem)] font-extrabold leading-none tracking-tight">
            {WORD.map((c, i) => (
              <span key={i} data-i="char" className="inline-block">
                {c}
              </span>
            ))}
          </p>
        </div>
        <p data-i="sub" className="micro mt-5 text-white/75">
          Your oshi · your front row feeling
        </p>
      </div>

      <button
        type="button"
        onClick={() => tl.current?.progress(1)}
        className="micro absolute bottom-6 right-6 rounded-full border border-white/40 px-3 py-1.5 text-white/80 hover:bg-white hover:text-[#e1243a]"
      >
        Lewati
      </button>
    </div>
  );
}
