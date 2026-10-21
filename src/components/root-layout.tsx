import { Outlet, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import { IntroProvider } from "@/components/intro";
import { ScrollLoop } from "@/components/motion";
import { Aside, BottomNav, Footer, Rail, Topbar } from "@/components/shell";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

const WIPE_COLS = 6;
const WIPE_ROWS = 4;

export function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const wipe = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Transisi antar halaman: kotak-kotak merah menyapu kolom utama, lalu konten baru naik.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    requestAnimationFrame(() => ScrollTrigger.refresh());
    if (prefersReducedMotion() || !wipe.current || !content.current) return;
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
      <Rail />
      <div className="flex min-h-screen lg:pl-[84px]">
        <div className="relative min-w-0 flex-1">
          <ScrollLoop className="absolute inset-y-0 right-0 h-full w-1/2" />
          <Topbar />
          <main id="konten" className="relative z-[1] pb-12">
            <div ref={content}>
              <Outlet />
            </div>
            <div
              ref={wipe}
              aria-hidden
              className="pointer-events-none fixed inset-0 z-20 hidden lg:left-[84px] xl:right-[340px]"
              style={{ gridTemplateColumns: `repeat(${WIPE_COLS}, 1fr)`, gridTemplateRows: `repeat(${WIPE_ROWS}, 1fr)` }}
            >
              {Array.from({ length: WIPE_COLS * WIPE_ROWS }).map((_, i) => (
                <div key={i} className="-m-px bg-brand" />
              ))}
            </div>
          </main>
          <div className="container-x pb-28 xl:hidden">
            <Footer className="border-t border-line pt-6" />
          </div>
        </div>
        <Aside />
      </div>
      <BottomNav />
    </IntroProvider>
  );
}
