import { useLayoutEffect, type RefObject } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

function show(el: HTMLElement) {
  el.dataset.revealed = "";
  el.style.opacity = "1";
}

/**
 * Animasikan setiap `[data-reveal]` di dalam `scope` saat masuk viewport.
 * `deps` dipakai untuk memindai ulang ketika konten async (data API) muncul.
 * Elemen yang sudah tampil ditandai `data-revealed` dan tidak pernah disembunyikan lagi.
 */
export function useReveal(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])"));
    if (!items.length) return;

    if (prefersReducedMotion()) {
      items.forEach(show);
      return;
    }

    // Cleanup hanya mematikan trigger yang belum terpicu; tween yang sedang jalan dibiarkan
    // selesai supaya elemen yang sudah tampil tidak kembali ke opacity 0.
    const triggers = ScrollTrigger.batch(items, {
      start: "top 92%",
      once: true,
      onEnter: (batch) => {
        const els = batch as HTMLElement[];
        els.forEach((el) => (el.dataset.revealed = ""));
        gsap.fromTo(
          els,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.06,
            overwrite: true,
            clearProps: "transform",
            onComplete: () => els.forEach(show),
          },
        );
      },
    });

    // Pastikan posisi trigger benar setelah gambar/font selesai dimuat.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    return () => {
      window.removeEventListener("load", refresh);
      triggers.forEach((t) => t.kill());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
