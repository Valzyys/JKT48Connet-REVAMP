import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
      {play && !done && <Curtain onDone={finish} />}
    </IntroContext.Provider>
  );
}

const WORD = "JKT48CONNECT".split("");

/**
 * Intro "pertunjukan dimulai": tirai tertutup, lampu sorot menyapu panggung lalu
 * berhenti di tengah, papan LED menyala huruf demi huruf, kemudian tirai dibuka.
 */
function Curtain({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    document.body.classList.add("is-locked");
    const ctx = gsap.context(() => {
      const t = gsap.timeline({
        onComplete: () => {
          document.body.classList.remove("is-locked");
          onDone();
        },
      });
      tl.current = t;

      t.set("[data-c='char']", { opacity: 0.08 })
        .set("[data-c='sub']", { y: 8 })
        // Lampu sorot masuk dari kiri, sedikit melewati tengah, lalu kembali.
        .fromTo("[data-c='spot']", { xPercent: -160, opacity: 0 }, { xPercent: 18, opacity: 1, duration: 0.9, ease: "power2.inOut" })
        .to("[data-c='spot']", { xPercent: 0, duration: 0.45, ease: "back.out(2)" })
        // Huruf LED menyala acak, seperti lampu yang baru dinyalakan.
        .to("[data-c='char']", { opacity: 1, duration: 0.05, stagger: { each: 0.045, from: "random" } }, "-=0.2")
        .to("[data-c='sign']", { opacity: 0.35, duration: 0.05, yoyo: true, repeat: 3 }, "+=0.05")
        .to("[data-c='sub']", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, "<")
        .addLabel("open", "+=0.35")
        .to("[data-c='sign'], [data-c='sub']", { opacity: 0, duration: 0.25 }, "open")
        .to("[data-c='spot']", { scale: 4, opacity: 0, duration: 0.6, ease: "power2.in" }, "open")
        // Tirai dibuka: kedua sisi tertarik ke samping dengan sedikit lengkung.
        .to("[data-c='left']", { xPercent: -102, skewY: 2, duration: 1, ease: "power3.inOut" }, "open+=0.1")
        .to("[data-c='right']", { xPercent: 102, skewY: -2, duration: 1, ease: "power3.inOut" }, "open+=0.1")
        .to("[data-c='valance']", { yPercent: -100, duration: 0.6, ease: "power2.in" }, "open+=0.55");
    }, root);

    return () => {
      document.body.classList.remove("is-locked");
      ctx.revert();
    };
  }, [onDone]);

  return (
    <div ref={root} className="fixed inset-0 z-[100] overflow-hidden" aria-hidden>
      <div data-c="left" className="velvet absolute inset-y-0 left-0 w-1/2 origin-top-left shadow-[inset_-40px_0_60px_rgb(0_0_0/0.5)]" />
      <div data-c="right" className="velvet absolute inset-y-0 right-0 w-1/2 origin-top-right shadow-[inset_40px_0_60px_rgb(0_0_0/0.5)]" />
      <div
        data-c="valance"
        className="velvet absolute inset-x-0 top-0 h-16 sm:h-20"
        style={{
          WebkitMask: "radial-gradient(28px 18px at 50% 100%, #0000 98%, #000) 0 0 / 56px 100% repeat-x",
          mask: "radial-gradient(28px 18px at 50% 100%, #0000 98%, #000) 0 0 / 56px 100% repeat-x",
        }}
      />

      <div className="absolute inset-0 grid place-items-center">
        <div
          data-c="spot"
          className="absolute h-[70vmin] w-[70vmin] rounded-full"
          style={{ background: "radial-gradient(circle, rgb(255 236 210 / 0.38), rgb(255 236 210 / 0.1) 45%, transparent 70%)" }}
        />
        <div className="relative text-center">
          <p data-c="sign" className="led flex justify-center text-[clamp(2rem,8vw,5.5rem)] leading-none text-[#ff3b4c]">
            {WORD.map((c, i) => (
              <span key={i} data-c="char" className={i < 5 ? "" : "text-[#ffd9c9]"}>
                {c}
              </span>
            ))}
          </p>
          <p data-c="sub" className="mt-4 text-[13px] font-semibold uppercase tracking-[0.35em] text-[#ffd9c9]/70 opacity-0">
            Pertunjukan segera dimulai
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => tl.current?.progress(1)}
        className="absolute bottom-6 right-6 rounded border border-white/25 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-white/70 hover:border-white hover:text-white"
      >
        Lewati
      </button>
    </div>
  );
}
