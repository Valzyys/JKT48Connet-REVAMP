import { Outlet, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { IntroProvider } from "@/components/intro";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

export function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Transisi ringan antar halaman: kembali ke atas lalu fade-up konten.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    if (main.current && !prefersReducedMotion()) {
      gsap.fromTo(main.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, clearProps: "all" });
    }
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [path]);

  return (
    <IntroProvider>
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
      >
        Lewati ke konten
      </a>
      <Header />
      <main id="konten" ref={main} className="min-h-[70vh]">
        <Outlet />
      </main>
      <Footer />
    </IntroProvider>
  );
}
