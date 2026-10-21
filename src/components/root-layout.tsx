import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { IntroProvider } from "@/components/intro";
import { Aside, Dock, Footer, Sidebar, Topbar } from "@/components/shell";
import { gsap, ScrollTrigger } from "@/lib/gsap";

const WIPE_COLS = 6;
const WIPE_ROWS = 4;

export function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const wipe = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Data API sering datang setelah halaman tampil, sehingga tinggi halaman berubah. Hitung ulang
  // posisi ScrollTrigger setiap kali tinggi konten berubah agar reveal & footer tetap terpicu.
  useEffect(() => {
    const el = content.current;
    if (!el) return;
    let t = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  // Transisi antar halaman: kotak-kotak merah menyapu kolom utama, lalu konten baru naik.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    requestAnimationFrame(() => ScrollTrigger.refresh());
    if (!wipe.current || !content.current) return;
    const cells = wipe.current.children;
    const tl = gsap.timeline();
    tl.set(wipe.current, { display: "grid" })
      .fromTo(cells, { scale: 0 }, { scale: 1, duration: 0.28, ease: "power2.in", stagger: { grid: [WIPE_ROWS, WIPE_COLS], from: "start", amount: 0.18 } })
      .to(cells, { scale: 0, duration: 0.32, ease: "power2.out", stagger: { grid: [WIPE_ROWS, WIPE_COLS], from: "end", amount: 0.18 } })
      .fromTo(content.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out", clearProps: "transform,opacity" }, "-=0.35")
      .set(wipe.current, { display: "none" });
    return () => void tl.kill();
  }, [path]);

  return (
    <IntroProvider>
      <a href="#konten" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
        Lewati ke konten
      </a>
      <Sidebar />
      <div className="flex min-h-screen transition-[padding] duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] lg:pl-[var(--side-pad)]">
        <div className="relative min-w-0 flex-1">
          <Topbar />
          <main id="konten" className="relative z-[1] pb-12">
            <div ref={content}>
              <Outlet />
            </div>
            <div
              ref={wipe}
              aria-hidden
              className="pointer-events-none fixed inset-0 z-20 hidden lg:left-[var(--side-pad)] xl:right-[340px]"
              style={{ gridTemplateColumns: `repeat(${WIPE_COLS}, 1fr)`, gridTemplateRows: `repeat(${WIPE_ROWS}, 1fr)` }}
            >
              {Array.from({ length: WIPE_COLS * WIPE_ROWS }).map((_, i) => (
                <div key={i} className="-m-px bg-brand" />
              ))}
            </div>
          </main>
          <Footer />
        </div>
        <Aside />
      </div>
      <Dock />
    </IntroProvider>
  );
}
