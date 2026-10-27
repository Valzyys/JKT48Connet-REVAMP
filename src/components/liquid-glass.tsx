import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { gsap } from "@/lib/gsap";

/**
 * Liquid glass untuk web: kaca yang benar-benar membiaskan isi di belakangnya.
 *
 * Cara kerja (Chromium: Chrome/Edge/Android): `backdrop-filter: url(#filter)` memakai filter SVG berisi
 * `feDisplacementMap`. Peta perpindahan (displacement map) dibuat di canvas sesuai ukuran & radius elemen:
 * piksel di tepi (bezel) digeser mengikuti normal permukaan sehingga latar terlihat melengkung seperti lensa,
 * lalu kanal merah/hijau/biru digeser sedikit berbeda (aberasi kromatik). Di atasnya: tint, tepi mengilap
 * (specular), dan kilau yang mengikuti kursor.
 * Browser lain (Safari, Firefox) tidak mendukung filter SVG di backdrop-filter, jadi memakai kaca buram biasa.
 */

const supportsRefraction = (() => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iOS: semua browser memakai WebKit (tidak mendukung).
  if (/iPhone|iPad|iPod/.test(ua)) return false;
  return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua);
})();

const mapCache = new Map<string, string>();

/**
 * Peta perpindahan untuk persegi membulat w×h: R = geser X, G = geser Y (128 = diam).
 * Di dalam bezel, besar geseran mengikuti profil permukaan cembung (paling kuat di tepi), arahnya normal tepi.
 */
function displacementMap(w: number, h: number, radius: number, bezel: number): string {
  const key = `${w}x${h}r${radius}b${bezel}`;
  const hit = mapCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const r = Math.min(radius, w / 2, h / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Jarak bertanda ke tepi persegi membulat (positif di dalam) + arah normal ke luar.
      const px = x + 0.5 - w / 2;
      const py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - (w / 2 - r);
      const qy = Math.abs(py) - (h / 2 - r);
      let dist: number;
      let nx: number;
      let ny: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy) || 1;
        dist = r - len;
        nx = (qx / len) * Math.sign(px);
        ny = (qy / len) * Math.sign(py);
      } else if (qx > qy) {
        dist = r - qx;
        nx = Math.sign(px);
        ny = 0;
      } else {
        dist = r - qy;
        nx = 0;
        ny = Math.sign(py);
      }
      let mag = 0;
      if (dist < bezel && dist > -1) {
        // Profil "squircle": tepi melengkung tajam, makin ke dalam makin datar.
        const t = Math.max(0, 1 - dist / bezel);
        mag = t * t * (3 - 2 * t);
      }
      const i = (y * w + x) * 4;
      img.data[i] = 128 - nx * mag * 127;
      img.data[i + 1] = 128 - ny * mag * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL();
  if (mapCache.size > 40) mapCache.clear();
  mapCache.set(key, url);
  return url;
}

type GlassProps = {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Radius sudut (px); pakai nilai besar untuk kapsul. */
  radius?: number;
  /** Lebar tepi yang membiaskan (px). */
  bezel?: number;
  /** Kekuatan pembiasan (px). */
  strength?: number;
  /** Blur halus latar (px) supaya teks di atas kaca tetap terbaca; 0 = bening. */
  blur?: number;
  /** Warna isian kaca (mis. merah untuk tombol utama). */
  tint?: string;
  /** Kilau mengikuti kursor + memantul saat ditekan. */
  interactive?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  "aria-label"?: string;
  /** Untuk `as={Link}` (router). */
  to?: string;
  [data: `data-${string}`]: string | boolean | undefined;
};

export function Glass({
  as: Tag = "div",
  children,
  className = "",
  style,
  radius = 28,
  bezel = 22,
  strength = 46,
  blur = 2,
  tint,
  interactive = false,
  ...rest
}: GlassProps) {
  const ref = useRef<HTMLElement>(null);
  const id = `lg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !supportsRefraction) return;
    let t = 0;
    const measure = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (w > 0 && h > 0) setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = window.setTimeout(measure, 120);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  // Kilau mengikuti kursor & pantulan "jelly" saat ditekan.
  useEffect(() => {
    const el = ref.current;
    if (!el || !interactive || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    const down = () => gsap.to(el, { scaleX: 1.04, scaleY: 0.94, duration: 0.18, ease: "power2.out", overwrite: true });
    const up = () => gsap.to(el, { scaleX: 1, scaleY: 1, duration: 0.9, ease: "elastic.out(1.2, 0.35)", overwrite: true });
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointerleave", up);
    };
  }, [interactive]);

  const map = size ? displacementMap(size.w, size.h, radius, Math.min(bezel, size.w / 2, size.h / 2)) : "";
  const refract = supportsRefraction && map;

  return (
    <Tag ref={ref} className={`lg ${interactive ? "lg-interactive" : ""} ${className}`} style={{ ...style, borderRadius: radius, ...(tint ? { "--lg-tint": tint } : {}) }} {...rest}>
      {refract && size && (
        <svg width="0" height="0" aria-hidden className="absolute">
          <filter id={id} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map} x="0" y="0" width={size.w} height={size.h} result="map" preserveAspectRatio="none" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="src" />
            {/* Tiga kanal digeser sedikit berbeda → aberasi kromatik halus di tepi kaca. */}
            <feDisplacementMap in="src" in2="map" scale={strength} xChannelSelector="R" yChannelSelector="G" result="dr" />
            <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feDisplacementMap in="src" in2="map" scale={strength * 0.97} xChannelSelector="R" yChannelSelector="G" result="dg" />
            <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feDisplacementMap in="src" in2="map" scale={strength * 0.94} xChannelSelector="R" yChannelSelector="G" result="db" />
            <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feBlend in="r" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b" mode="screen" />
          </filter>
        </svg>
      )}
      <span aria-hidden className="lg-fx" style={refract ? { backdropFilter: `url(#${id}) saturate(1.5) brightness(1.05)` } : undefined} />
      <span aria-hidden className="lg-tint" />
      {interactive && <span aria-hidden className="lg-shine" />}
      {children}
    </Tag>
  );
}

export { supportsRefraction };
