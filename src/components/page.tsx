import { useRef, type ReactNode } from "react";
import { useReveal } from "@/hooks/use-reveal";

/**
 * Pembungkus halaman: menjalankan animasi reveal GSAP untuk semua `[data-reveal]`.
 * `deps` diisi data async supaya elemen yang baru muncul ikut dianimasikan;
 * `ready=false` menunda animasi (dipakai beranda selama intro berjalan).
 */
export function Page({ children, deps = [], ready = true }: { children: ReactNode; deps?: unknown[]; ready?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, deps, ready);
  return <div ref={ref}>{children}</div>;
}
