import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { clsx as cx } from "clsx";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/** Judul yang muncul huruf demi huruf saat masuk viewport (atau saat teksnya berganti). */
export function SplitText({ text, className, as: Tag = "span" }: { text: string; className?: string; as?: "span" | "h1" | "h2" }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
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
    if (!el || !active) return;
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
    if (!el || matchMedia("(pointer: coarse)").matches) return;
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
    if (!el) return;
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

export { ScrollTrigger };
