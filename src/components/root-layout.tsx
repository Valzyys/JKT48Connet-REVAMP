import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { IntroProvider } from "@/components/intro";
import { PixelCross } from "@/components/logo";
import { Aside, Dock, Footer, Sidebar, Topbar } from "@/components/shell";
import { gsap, ScrollTrigger } from "@/lib/gsap";

export function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const wipe = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const tap = useRef({ x: 0, y: 0, t: 0 });

  // Ingat titik klik/tap terakhir: transisi halaman mekar dari situ.
  useEffect(() => {
    const onDown = (e: PointerEvent) => (tap.current = { x: e.clientX, y: e.clientY, t: Date.now() });
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, []);

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

  // Transisi antar halaman: riak merah menyebar dari titik yang diklik (logo piksel berputar di
  // tengahnya), lalu halaman baru mekar dalam lingkaran dari titik yang sama. Tanpa klik (keyboard,
  // tombol back), titik awalnya tengah kolom utama. Konten baru tersembunyi oleh clip sebelum paint.
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
    const disc = w.querySelector<HTMLElement>("[data-disc]");
    const mark = w.querySelector<HTMLElement>("[data-mark]");

    gsap.set(w, { display: "block" });
    const area = w.getBoundingClientRect();
    const box = c.getBoundingClientRect();
    const recent = Date.now() - tap.current.t < 1500;
    // Klik di sidebar/dock berada di luar area: tarik ke tepi terdekat supaya riak langsung terlihat.
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    const x = recent ? clamp(tap.current.x, area.left + 28, area.right - 28) : area.left + area.width / 2;
    const bottom = window.innerHeight - (window.innerWidth < 1024 ? 110 : 28); // di HP jangan tertutup dock
    const y = recent ? clamp(tap.current.y, Math.max(area.top, 0) + 28, bottom) : area.top + area.height / 2;
    // Jari-jari yang cukup untuk menutup seluruh area terlihat dari titik awal.
    const r = Math.hypot(Math.max(x - area.left, area.right - x), Math.max(y - area.top, window.innerHeight - y)) + 40;
    const at = (el: DOMRect) => `${x - el.left}px ${y - el.top}px`;

    const tl = gsap.timeline();
    tl.set(c, { clipPath: `circle(0px at ${at(box)})` })
      .set(mark, { left: x - area.left, top: y - area.top, scale: 0, rotate: -120, opacity: 1 })
      .fromTo(disc, { clipPath: `circle(0px at ${at(area)})` }, { clipPath: `circle(${r}px at ${at(area)})`, duration: 0.45, ease: "power2.inOut" })
      .to(mark, { scale: 1, rotate: 0, duration: 0.4, ease: "back.out(2.5)" }, 0.08)
      .to(mark, { scale: 0, rotate: 90, opacity: 0, duration: 0.25, ease: "power2.in" }, 0.5)
      .to(c, { clipPath: `circle(${r}px at ${at(box)})`, duration: 0.7, ease: "expo.inOut" }, 0.42)
      .fromTo(c, { y: 24 }, { y: 0, duration: 0.7, ease: "power3.out" }, 0.42)
      .set(c, { clearProps: "clipPath,transform" })
      .set(w, { display: "none" });
    return () => {
      tl.kill();
      gsap.set(c, { clearProps: "clipPath,transform" });
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
            <div ref={content} className="relative z-10 bg-bg">
              <Outlet />
            </div>
            <div ref={wipe} aria-hidden className="pointer-events-none fixed inset-0 z-[5] hidden lg:left-[var(--side-pad)] xl:right-[340px]">
              <div data-disc className="absolute inset-0 bg-brand" />
              <span data-mark className="absolute -ml-7 -mt-7 block h-14 w-14">
                <PixelCross className="h-14 w-14" cellClass="fill-white" />
              </span>
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
