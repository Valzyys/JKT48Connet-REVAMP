import { useRef, type ReactNode } from "react";
import { useReveal } from "@/hooks/use-reveal";

/**
 * Pembungkus halaman: menjalankan animasi reveal GSAP untuk semua `[data-reveal]`.
 * `deps` diisi data async supaya elemen yang baru muncul ikut dianimasikan.
 */
export function Page({ children, deps = [] }: { children: ReactNode; deps?: unknown[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, deps);
  return <div ref={ref}>{children}</div>;
}
