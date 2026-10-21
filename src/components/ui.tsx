import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { initials } from "@/lib/format";

export function cx(...a: Parameters<typeof clsx>) {
  return clsx(...a);
}

/** Header halaman dalam (bukan beranda): eyebrow, judul besar, deskripsi. */
export function PageHero({
  eyebrow,
  title,
  desc,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  desc?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="container-x pb-10 pt-28 sm:pb-14 sm:pt-36">
        <p data-reveal className="eyebrow">
          {eyebrow}
        </p>
        <h1
          data-reveal
          className="mt-4 max-w-4xl font-display text-[clamp(2.5rem,7vw,5.5rem)] font-extrabold leading-[0.92] tracking-[-0.04em]"
        >
          {title}
        </h1>
        {desc && (
          <p data-reveal className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            {desc}
          </p>
        )}
        {children && (
          <div data-reveal className="mt-7">
            {children}
          </div>
        )}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/15 blur-3xl"
      />
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  meta,
  to,
  linkLabel = "Lihat semua",
}: {
  eyebrow: string;
  title: ReactNode;
  meta?: ReactNode;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <div data-reveal className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{title}</h2>
        {meta && <p className="mt-1.5 text-sm text-ink-soft">{meta}</p>}
      </div>
      {to && (
        <Link to={to} className="group inline-flex items-center gap-2 text-sm font-semibold text-ink">
          {linkLabel}
          <span className="grid h-8 w-8 place-items-center rounded-full border border-line transition group-hover:border-brand group-hover:bg-brand group-hover:text-white">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}
    </div>
  );
}

/** Gambar dengan placeholder inisial bila URL kosong atau gagal dimuat (sesuai saran docs). */
export function Img({
  src,
  alt,
  className,
  fallbackClassName,
  eager,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cx(
          "grid place-items-center bg-gradient-to-br from-brand/25 via-surface to-gold/20 font-display font-extrabold text-ink/40",
          className,
          fallbackClassName,
        )}
      >
        <span className="text-[clamp(1rem,4vw,2rem)]">{initials(alt) || "48"}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-2xl bg-surface", className)} />;
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

export function EmptyState({ title, desc, icon }: { title: string; desc?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-card/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface text-ink-soft">{icon}</div>}
      <p className="font-display text-lg font-bold">{title}</p>
      {desc && <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{desc}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const msg =
    status === 429
      ? "Kuota API sedang habis. Coba lagi nanti."
      : status === 404
        ? "Data tidak ditemukan."
        : status === 401
          ? "Akses API ditolak. Periksa konfigurasi API key di server."
          : "Gagal memuat data. Periksa koneksi lalu coba lagi.";
  return (
    <div className="flex flex-col items-center rounded-3xl border border-brand/30 bg-brand-soft/40 px-6 py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-brand" />
      <p className="mt-3 font-display text-lg font-bold">Ups, ada kendala</p>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">{msg}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-ghost mt-5">
          <RefreshCw className="h-4 w-4" /> Coba lagi
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  total,
  perpage,
  onChange,
}: {
  page: number;
  total: number;
  perpage: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perpage));
  if (pages <= 1) return null;
  const btn =
    "grid h-10 min-w-10 place-items-center rounded-full border border-line px-3 text-sm font-semibold transition hover:border-ink disabled:pointer-events-none disabled:opacity-40";
  return (
    <nav aria-label="Halaman" className="mt-12 flex items-center justify-center gap-2">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Sebelumnya">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="num px-3 text-sm text-ink-soft">
        <span className="text-ink">{page}</span> / {pages}
      </span>
      <button
        type="button"
        className={btn}
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Berikutnya"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

export function PlatformChip({ platform }: { platform: string }) {
  const idn = platform === "idn";
  return (
    <span className={cx("chip", idn ? "bg-[#d61f3c] text-white" : "bg-[#1e1e24] text-white")}>
      {idn ? "IDN Live" : platform === "showroom" ? "Showroom" : platform || "Live"}
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cx("relative flex h-2 w-2", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
    </span>
  );
}
