import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { IntroProvider } from "@/components/intro";
import { PixelCross } from "@/components/logo";
import { Aside, Dock, Sidebar, Topbar } from "@/components/shell";
import { Footer } from "@/components/footer";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { NAV, navFor } from "@/lib/nav";

const PARTICLES = 18;

export function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const wipe = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const tap = useRef({ x: 0, y: 0, t: 0 });
  const dest = navFor(path);
  const isPm = path === "/pm" || path.startsWith("/pm/");
  const prev = useRef(path);

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

  // Transisi antar halaman "Signal burst", semuanya berpusat di titik yang diklik:
  // 1. tiga cincin sinyal memancar, pecahan piksel terlempar ke segala arah;
  // 2. gelombang merah lalu merah tua menutup kolom utama, logo piksel berputar dengan nama halaman tujuan;
  // 3. halaman baru mekar melingkar dengan tepi cincin kuning yang ikut melebar.
  // Tanpa klik (keyboard, tombol back) pusatnya tengah kolom utama. Konten tersembunyi oleh clip sebelum paint.
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = path;
    if (first.current) {
      first.current = false;
      return;
    }
    // Antar tab di dalam Private Messages cukup animasi konten milik halaman PM sendiri.
    if ((from === "/pm" || from.startsWith("/pm/")) && isPm) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    requestAnimationFrame(() => ScrollTrigger.refresh());
    const w = wipe.current;
    const c = content.current;
    if (!w || !c) return;
    const q = (sel: string) => w.querySelectorAll<HTMLElement>(sel);

    gsap.set(w, { display: "block" });
    const area = w.getBoundingClientRect();
    const box = c.getBoundingClientRect();
    const recent = Date.now() - tap.current.t < 1500;
    // Klik di sidebar/dock berada di luar area: tarik ke tepi terdekat supaya efeknya langsung terlihat.
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    const x = recent ? clamp(tap.current.x, area.left + 90, area.right - 90) : area.left + area.width / 2;
    const bottom = window.innerHeight - (window.innerWidth < 1024 ? 150 : 90); // di HP jangan tertutup dock
    const y = recent ? clamp(tap.current.y, Math.max(area.top, 0) + 90, bottom) : area.top + area.height / 2;
    const lx = x - area.left;
    const ly = y - area.top;
    // Jari-jari yang cukup untuk menutup seluruh area terlihat dari titik awal.
    const r = Math.hypot(Math.max(lx, area.right - x), Math.max(ly, window.innerHeight - y)) + 40;
    const at = (el: DOMRect) => `${x - el.left}px ${y - el.top}px`;
    const ring = Math.min(r, 520);
    const EDGE = 8;

    const tl = gsap.timeline();
    tl.set(c, { clipPath: `circle(0px at ${at(box)})` })
      .set(q("[data-ring]"), { left: lx - ring, top: ly - ring, width: ring * 2, height: ring * 2, scale: 0, opacity: 1 })
      .set(q("[data-edge]"), { left: lx - r - EDGE, top: ly - r - EDGE, width: (r + EDGE) * 2, height: (r + EDGE) * 2, scale: 0, opacity: 1 })
      .set(q("[data-bit]"), { left: lx, top: ly, x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 })
      .set(q("[data-mark]"), { left: lx, top: ly, scale: 0, rotate: -120, opacity: 1 })
      .set(q("[data-cap]"), { left: lx, top: ly + 58, xPercent: -50, opacity: 0, y: 8 })
      // 1. Cincin sinyal + pecahan piksel.
      .to(q("[data-ring]"), { scale: 1, opacity: 0, duration: 0.8, ease: "power2.out", stagger: 0.09 }, 0)
      .to(q("[data-bit]"), {
        x: (i) => Math.cos((i / PARTICLES) * Math.PI * 2) * gsap.utils.random(110, 300),
        y: (i) => Math.sin((i / PARTICLES) * Math.PI * 2) * gsap.utils.random(110, 300),
        rotate: () => gsap.utils.random(-180, 180),
        scale: 0,
        duration: 0.75,
        ease: "power3.out",
      }, 0.04)
      // 2. Gelombang merah dua tingkat + logo dan nama tujuan.
      .fromTo(q("[data-disc]"), { clipPath: `circle(0px at ${lx}px ${ly}px)` }, { clipPath: `circle(${r}px at ${lx}px ${ly}px)`, duration: 0.48, ease: "power2.inOut", stagger: 0.12 }, 0)
      .to(q("[data-mark]"), { scale: 1, rotate: 0, duration: 0.42, ease: "back.out(2.5)" }, 0.12)
      .to(q("[data-cap]"), { opacity: 1, y: 0, duration: 0.3 }, 0.22)
      .to(q("[data-mark]"), { scale: 0, rotate: 90, opacity: 0, duration: 0.25, ease: "power2.in" }, 0.56)
      .to(q("[data-cap]"), { opacity: 0, y: -8, duration: 0.2 }, 0.52)
      // 3. Halaman baru mekar, tepi kuning mengikuti.
      .to(c, { clipPath: `circle(${r}px at ${at(box)})`, duration: 0.75, ease: "expo.inOut" }, 0.5)
      .to(q("[data-edge]"), { scale: 1, duration: 0.75, ease: "expo.inOut" }, 0.5)
      .to(q("[data-edge]"), { opacity: 0, duration: 0.25 }, 1.0)
      .fromTo(c, { y: 24 }, { y: 0, duration: 0.75, ease: "power3.out" }, 0.5)
      .set(c, { clearProps: "clipPath,transform" })
      .set(w, { display: "none" });
    return () => {
      tl.kill();
      gsap.set(c, { clearProps: "clipPath,transform" });
      gsap.set(w, { display: "none" });
    };
  }, [path]);

  return (
    // Private Messages ikut shell situs, tapi tanpa intro (dibuka untuk membaca/membayar) dan tanpa sidebar kanan.
    <IntroProvider skip={isPm}>
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
            <div ref={wipe} aria-hidden className={`pointer-events-none fixed inset-0 z-[5] hidden overflow-hidden lg:left-[var(--side-pad)] ${isPm ? "" : "xl:right-[340px]"}`}>
              <div data-disc className="absolute inset-0 bg-brand" />
              <div data-disc className="absolute inset-0 bg-brand-strong" />
              <span data-ring className="absolute rounded-full border-[3px] border-butter" />
              <span data-ring className="absolute rounded-full border-2 border-white/80" />
              <span data-ring className="absolute rounded-full border border-white/50" />
              {Array.from({ length: PARTICLES }).map((_, i) => (
                <span key={i} data-bit className={i % 3 ? "absolute -ml-1 -mt-1 h-2 w-2 rounded-[2px] bg-white" : "absolute -ml-1.5 -mt-1.5 h-3 w-3 rounded-[3px] bg-butter"} />
              ))}
              <span data-edge className="absolute rounded-full border-[8px] border-butter" />
              <span data-mark className="absolute -ml-10 -mt-10 block h-20 w-20">
                <PixelCross className="h-20 w-20" cellClass="fill-white" />
              </span>
              <span data-cap className="absolute whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                {String(NAV.indexOf(dest) + 1).padStart(2, "0")} → {dest.label}
              </span>
            </div>
          </main>
          <Footer />
        </div>
        {!isPm && <Aside />}
      </div>
      <Dock />
    </IntroProvider>
  );
}
