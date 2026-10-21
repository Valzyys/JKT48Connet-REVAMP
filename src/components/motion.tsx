import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { clsx as cx } from "clsx";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/** Judul yang muncul huruf demi huruf saat masuk viewport (atau saat teksnya berganti). */
export function SplitText({ text, className, as: Tag = "span" }: { text: string; className?: string; as?: "span" | "h1" | "h2" }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const chars = el.querySelectorAll("[data-ch]");
    const tween = gsap.fromTo(
      chars,
      { yPercent: 110, rotate: 6, opacity: 0 },
      {
        yPercent: 0,
        rotate: 0,
        opacity: 1,
        duration: 0.6,
        ease: "back.out(1.6)",
        stagger: 0.025,
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [text]);

  return (
    <Tag ref={ref as never} className={cx("inline-flex flex-wrap overflow-hidden", className)} aria-label={text}>
      {text.split(" ").map((word, w) => (
        <span key={w} className="inline-flex whitespace-nowrap" aria-hidden>
          {word.split("").map((c, i) => (
            <span key={i} data-ch className="inline-block">
              {c}
            </span>
          ))}
          {w < text.split(" ").length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </Tag>
  );
}

/** Angka yang menghitung naik dari 0 saat terlihat. */
export function CountUp({ value, className, format = (n: number) => n.toLocaleString("id-ID") }: { value: number; className?: string; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.textContent = format(value);
      return;
    }
    const o = { v: 0 };
    const tween = gsap.to(o, {
      v: value,
      duration: 1.2,
      ease: "power2.out",
      onUpdate: () => void (el.textContent = format(Math.round(o.v))),
      scrollTrigger: { trigger: el, start: "top 95%", once: true },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span ref={ref} className={cx("num", className)}>
      0
    </span>
  );
}

/** Bar sinyal yang bergerak naik-turun saat `active`. */
export function SignalBars({ active = true, className }: { active?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active || prefersReducedMotion()) return;
    const bars = el.querySelectorAll("span");
    const tweens = Array.from(bars).map((b, i) =>
      gsap.to(b, { scaleY: 0.3, duration: 0.35 + i * 0.08, repeat: -1, yoyo: true, ease: "sine.inOut", delay: i * 0.1 }),
    );
    return () => tweens.forEach((t) => t.kill());
  }, [active]);
  return (
    <span ref={ref} className={cx("inline-flex h-3 items-end gap-[2px]", className)} aria-hidden>
      {[0.4, 0.6, 0.8, 1].map((h, i) => (
        <span
          key={i}
          className={cx("w-[3px] origin-bottom rounded-[1px]", active ? "bg-current" : "bg-current opacity-30")}
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </span>
  );
}

/** Efek miring 3D mengikuti kursor (hanya perangkat dengan pointer halus). */
export function Tilt({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || matchMedia("(pointer: coarse)").matches) return;
    gsap.set(el, { transformPerspective: 700 });
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3.out" });
    const sc = gsap.quickTo(el, "scale", { duration: 0.5, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      rx(((e.clientY - r.top) / r.height - 0.5) * -2 * max);
      ry(((e.clientX - r.left) / r.width - 0.5) * 2 * max);
      sc(1.03);
    };
    const leave = () => {
      rx(0);
      ry(0);
      sc(1);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);
  return (
    <div ref={ref} className={cx("will-change-transform", className)}>
      {children}
    </div>
  );
}

/** Teks berjalan tanpa ujung (GSAP), berhenti saat di-hover. */
export function Ticker({ children, speed = 40 }: { children: ReactNode; speed?: number }) {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current;
    if (!el || prefersReducedMotion()) return;
    const tween = gsap.to(el, { xPercent: -50, ease: "none", duration: el.scrollWidth / 2 / speed, repeat: -1 });
    const pause = () => tween.pause();
    const play = () => tween.play();
    el.addEventListener("pointerenter", pause);
    el.addEventListener("pointerleave", play);
    return () => {
      tween.kill();
      el.removeEventListener("pointerenter", pause);
      el.removeEventListener("pointerleave", play);
    };
  }, [children, speed]);
  return (
    <div className="overflow-hidden">
      <div ref={track} className="flex w-max">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Garis lengkung khas desain jkt48connect yang tergambar mengikuti scroll. */
export function ScrollLoop({ className }: { className?: string }) {
  const ref = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const p = ref.current;
    if (!p || prefersReducedMotion()) return;
    const len = p.getTotalLength();
    gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    const tween = gsap.to(p, {
      strokeDashoffset: 0,
      ease: "none",
      scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.6 },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);
  return (
    <svg viewBox="0 0 400 1600" preserveAspectRatio="none" className={cx("pointer-events-none", className)} aria-hidden>
      <path
        ref={ref}
        d="M380 0 C 120 160, 40 320, 220 460 S 420 760, 160 900 S -40 1200, 260 1340 S 380 1520, 120 1600"
        fill="none"
        stroke="var(--brand)"
        strokeOpacity="0.16"
        strokeWidth="2"
      />
    </svg>
  );
}

export { ScrollTrigger };
