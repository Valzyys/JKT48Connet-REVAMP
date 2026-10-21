import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

const SEEN_KEY = "jkt48c:intro-seen";
const IntroContext = createContext(true);

/** `true` setelah intro selesai (atau dilewati). Dipakai hero untuk memulai animasinya. */
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
      {play && !done && <IntroOverlay onDone={finish} />}
    </IntroContext.Provider>
  );
}

const WORD = "JKT48".split("");

function IntroOverlay({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    document.body.classList.add("is-locked");
    const counter = { v: 0 };

    const ctx = gsap.context(() => {
      const t = gsap.timeline({
        defaults: { ease: "expo.out" },
        onComplete: () => {
          document.body.classList.remove("is-locked");
          onDone();
        },
      });
      tl.current = t;

      t.set("[data-intro-letter]", { yPercent: 115 })
        .set("[data-intro-connect]", { clipPath: "inset(0 100% 0 0)" })
        .set("[data-intro-bar]", { scaleX: 0 })
        .to("[data-intro-meta]", { opacity: 1, duration: 0.4, stagger: 0.08 }, 0)
        .to("[data-intro-letter]", { yPercent: 0, duration: 1, stagger: 0.07 }, 0.15)
        .to("[data-intro-connect]", { clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "power4.inOut" }, 0.65)
        .to("[data-intro-bar]", { scaleX: 1, duration: 1.5, ease: "power2.inOut" }, 0.1)
        .to(
          counter,
          {
            v: 100,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => {
              const el = root.current?.querySelector("[data-intro-count]");
              if (el) el.textContent = String(Math.round(counter.v)).padStart(3, "0");
            },
          },
          0.1,
        )
        .addLabel("exit", "+=0.15")
        .to("[data-intro-letter]", { yPercent: -115, duration: 0.6, stagger: 0.04, ease: "power3.in" }, "exit")
        .to("[data-intro-connect]", { yPercent: -120, opacity: 0, duration: 0.5, ease: "power3.in" }, "exit+=0.1")
        .to("[data-intro-meta]", { opacity: 0, duration: 0.3 }, "exit")
        .to("[data-intro-panel='dark']", { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "exit+=0.45")
        .to("[data-intro-panel='brand']", { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "exit+=0.58");
    }, root);

    return () => {
      document.body.classList.remove("is-locked");
      ctx.revert();
    };
  }, [onDone]);

  const skip = () => tl.current?.progress(1);

  return (
    <div ref={root} className="fixed inset-0 z-[100]" role="presentation" aria-hidden>
      <div data-intro-panel="brand" className="absolute inset-0 bg-brand" />
      <div data-intro-panel="dark" className="absolute inset-0 flex flex-col bg-[#0b0b0d] text-[#f1efea]">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-10 sm:pt-8">
          <span data-intro-meta className="num text-[11px] tracking-[0.25em] text-white/50 opacity-0">
            JKT48CONNECT
          </span>
          <button
            type="button"
            onClick={skip}
            data-intro-meta
            className="num rounded-full border border-white/15 px-3 py-1 text-[11px] tracking-[0.2em] text-white/70 opacity-0 transition hover:border-white/50 hover:text-white"
          >
            SKIP
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <h1 className="flex overflow-hidden font-display text-[26vw] font-extrabold leading-[0.85] tracking-[-0.06em] sm:text-[18vw] lg:text-[15vw]">
            {WORD.map((c, i) => (
              <span key={i} data-intro-letter className={`inline-block ${i >= 3 ? "text-brand" : ""}`}>
                {c}
              </span>
            ))}
          </h1>
          <p
            data-intro-connect
            className="mt-3 font-display text-2xl font-bold tracking-[0.5em] text-white/90 sm:text-4xl"
          >
            CONNECT
          </p>
        </div>

        <div className="px-5 pb-6 sm:px-10 sm:pb-10">
          <div className="flex items-end justify-between">
            <p data-intro-meta className="max-w-[16rem] text-xs leading-relaxed text-white/45 opacity-0">
              Live member, theater, dan kabar oshi — semuanya di satu tempat.
            </p>
            <span data-intro-count className="num text-4xl font-semibold text-white sm:text-6xl">
              000
            </span>
          </div>
          <div className="mt-4 h-px w-full bg-white/10">
            <div data-intro-bar className="h-full origin-left bg-brand" />
          </div>
        </div>
      </div>
    </div>
  );
}
