import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { IntroProvider } from "@/components/intro";
import { Aside, Dock, Footer, Sidebar, Topbar } from "@/components/shell";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { NAV, navFor } from "@/lib/nav";

const SHUTTERS = 5;

export function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const wipe = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const dest = navFor(path);

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

  // Transisi antar halaman: rana kolom merah menutup dari bawah, nama halaman tujuan muncul besar,
  // lalu rana terbuka ke atas dan konten baru naik. Konten baru disembunyikan sebelum paint supaya
  // pergantian halaman tidak terlihat di balik rana.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    requestAnimationFrame(() => ScrollTrigger.refresh());
    const w = wipe.current;
    const c = content.current;
    if (!w || !c) return;
    const cols = w.querySelectorAll("[data-col]");
    const chars = w.querySelectorAll("[data-ch]");
    const label = w.querySelector("[data-wl]");
    const tl = gsap.timeline();
    tl.set(c, { opacity: 0 })
      .set(w, { display: "block" })
      .fromTo(cols, { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.34, ease: "power4.inOut", stagger: 0.04 })
      .fromTo(label, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25 }, 0.2)
      .fromTo(chars, { yPercent: 115 }, { yPercent: 0, duration: 0.4, ease: "expo.out", stagger: 0.022 }, 0.2)
      .to(chars, { yPercent: -115, duration: 0.24, ease: "power3.in", stagger: 0.012 }, 0.62)
      .to(label, { opacity: 0, duration: 0.15 }, 0.62)
      .to(cols, { scaleY: 0, transformOrigin: "50% 0%", duration: 0.42, ease: "power4.inOut", stagger: 0.04 }, 0.72)
      .fromTo(c, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "transform,opacity" }, 0.84)
      .set(w, { display: "none" });
    return () => {
      tl.kill();
      gsap.set(c, { clearProps: "transform,opacity" });
      gsap.set(w, { display: "none" });
    };
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
            <div ref={wipe} aria-hidden className="pointer-events-none fixed inset-0 z-20 hidden lg:left-[var(--side-pad)] xl:right-[340px]">
              <div className="absolute inset-0 flex">
                {Array.from({ length: SHUTTERS }).map((_, i) => (
                  <div key={i} data-col className={i % 2 ? "-mx-px flex-1 bg-brand-strong" : "-mx-px flex-1 bg-brand"} />
                ))}
              </div>
              <div className="absolute inset-0 grid place-items-center px-6 text-center text-white">
                <div>
                  <p data-wl className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
                    {String(NAV.indexOf(dest) + 1).padStart(2, "0")} · JKT48Connect
                  </p>
                  <p className="condensed mt-2 flex justify-center overflow-hidden text-[clamp(3.5rem,11vw,8.5rem)] uppercase leading-[0.9]">
                    {dest.label.split("").map((ch, i) => (
                      <span key={`${dest.to}-${i}`} data-ch className="inline-block">
                        {ch}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
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
