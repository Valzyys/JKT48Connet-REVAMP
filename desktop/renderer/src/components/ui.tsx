import { clsx } from "clsx";
import { ArrowRight, RefreshCw, User, WifiOff } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/bridge";
import { Link } from "@/lib/router";

export const cx = clsx;

/** Sel logo salib piksel JKT48Connect pada grid 5×5 (sama dengan situs). */
export const PIXELS: [number, number][] = [
  [2, 0],
  [1, 1],
  [2, 1],
  [3, 1],
  [0, 2],
  [1, 2],
  [3, 2],
  [4, 2],
  [1, 3],
  [2, 3],
  [3, 3],
  [2, 4],
];

export function PixelCross({ className = "h-8 w-8", cell = "fill-brand", blink }: { className?: string; cell?: string; blink?: number }) {
  return (
    <svg viewBox="0 0 50 50" className={className} aria-hidden>
      {PIXELS.map(([x, y], i) => (
        <rect key={i} x={x * 10 + 0.5} y={y * 10 + 0.5} width="9" height="9" rx="1.6" className={cx(cell, blink === i && "animate-pulse fill-brand")} />
      ))}
    </svg>
  );
}

/** Kepala halaman: label mono + judul condensed "JUDUL / jumlah" ala desain brand. */
export function PageHeader({ label, title, count, desc, aside }: { label?: string; title: string; count?: ReactNode; desc?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6">
      <div className="min-w-0">
        {label && (
          <p className="micro mb-3 flex items-center gap-2 text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {label}
          </p>
        )}
        <h1 className="condensed flex flex-wrap items-baseline gap-x-3 text-[clamp(2.6rem,4.6vw,4.4rem)] uppercase leading-[0.88]">
          {title}
          {count != null && <span className="text-brand">/ {count}</span>}
        </h1>
        {desc && <p className="mt-3 max-w-2xl text-ink-soft">{desc}</p>}
      </div>
      {aside}
    </header>
  );
}

export function SectionHead({ title, count, to, label, aside }: { title: string; count?: ReactNode; to?: string; label?: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {label && <p className="micro mb-1.5 text-ink-soft">{label}</p>}
        <h2 className="condensed flex items-baseline gap-2 text-[28px] uppercase leading-none">
          {title}
          {count != null && <span className="text-brand">/ {count}</span>}
        </h2>
      </div>
      {aside}
      {to && (
        <Link to={to} className="link-more group inline-flex items-center gap-1.5">
          Semua <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

/** Gambar dengan fade-in dan placeholder bila URL kosong / gagal dimuat. */
export function Img({ src, alt = "", className, eager, fit = "cover" }: { src?: string; alt?: string; className?: string; eager?: boolean; fit?: "cover" | "contain" }) {
  const [state, setState] = useState<"load" | "ok" | "fail">("load");
  const prev = useRef(src);
  if (prev.current !== src) {
    prev.current = src;
    if (state !== "load") setState("load");
  }
  if (!src || state === "fail") {
    return (
      <div role="img" aria-label={alt} className={cx("grid place-items-center bg-surface text-ink-soft/40", className)}>
        <User className="h-1/3 max-h-12 w-1/3 max-w-12" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      onLoad={() => setState("ok")}
      onError={() => setState("fail")}
      className={cx(className, fit === "cover" ? "object-cover" : "object-contain", "bg-surface transition-opacity duration-300", state === "ok" ? "opacity-100" : "opacity-0")}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

export function SkeletonGrid({ count = 8, className, item }: { count?: number; className: string; item: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={item} />
      ))}
    </div>
  );
}

export function Empty({ title, children, icon }: { title?: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon ?? <PixelCross className="h-12 w-12" cell="fill-ink/10" blink={2} />}
      {title && <p className="text-[17px] font-bold">{title}</p>}
      {children && <p className="max-w-md text-[14px] leading-relaxed text-ink-soft">{children}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const offline = !status || !navigator.onLine;
  const msg =
    status === 429
      ? "Server sedang sibuk. Coba lagi sebentar lagi."
      : status === 404
        ? "Data tidak ditemukan."
        : offline
          ? "Tidak ada koneksi internet. Data akan dimuat begitu tersambung lagi."
          : "Data gagal dimuat dari server.";
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-4 px-5 py-5">
      <p className="flex items-center gap-3 text-ink-soft">
        <WifiOff className="h-5 w-5 shrink-0 text-brand" />
        {msg}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-ghost">
          <RefreshCw className="h-4 w-4" /> Coba lagi
        </button>
      )}
    </div>
  );
}

export function PlatformTag({ platform, className }: { platform: string; className?: string }) {
  const idn = platform === "idn";
  return <span className={cx("pill", idn ? "bg-brand text-white" : "bg-butter text-[#5c3d00]", className)}>{idn ? "IDN" : platform === "showroom" ? "Showroom" : platform || "Live"}</span>;
}

/** Tombol "Muat lebih banyak" untuk daftar berhalaman (useInfiniteQuery). */
export function LoadMore({ hasNext, loading, onMore }: { hasNext?: boolean; loading: boolean; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Muat otomatis saat tombol terlihat (gulir tak terbatas), tombol tetap ada untuk klik manual.
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasNext) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && !loading && onMore(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, loading, onMore]);
  if (!hasNext) return null;
  return (
    <div ref={ref} className="flex justify-center pt-8">
      <button type="button" className="btn btn-ghost" disabled={loading} onClick={onMore}>
        {loading ? "Memuat…" : "Muat lebih banyak"}
      </button>
    </div>
  );
}

/** Jam berdetak (per detik) untuk hitung mundur. */
export function useNow(every = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

export function Stat({ k, v, accent }: { k: string; v: ReactNode; accent?: boolean }) {
  return (
    <div className={cx("panel p-4", accent && "border-brand bg-brand text-white")}>
      <p className={cx("micro", accent ? "opacity-80" : "text-ink-soft")}>{k}</p>
      <p className="num condensed mt-1.5 text-[32px] leading-none">{v}</p>
    </div>
  );
}
