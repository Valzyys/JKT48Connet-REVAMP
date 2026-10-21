import { Link, useRouterState } from "@tanstack/react-router";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { setlistNoFor } from "@/lib/nav";

export function cx(...a: Parameters<typeof clsx>) {
  return clsx(...a);
}

/** Kepala halaman dalam: nomor setlist (M01…), judul condensed besar, garis bawah. */
export function PageHeader({ title, desc, aside }: { title: string; desc?: ReactNode; aside?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const no = setlistNoFor(path);
  return (
    <header className="container-x pt-24 sm:pt-28">
      <div data-reveal className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-ink pb-5">
        <div>
          {no && <p className="led mb-2 text-[18px] leading-none">{no}</p>}
          <h1 className="condensed text-[clamp(2.75rem,8vw,5.5rem)] uppercase leading-[0.85]">{title}</h1>
          {desc && <p className="mt-3 max-w-xl text-ink-soft">{desc}</p>}
        </div>
        {aside}
      </div>
    </header>
  );
}

export function SectionHead({ title, count, to, no }: { title: string; count?: ReactNode; to?: string; no?: string }) {
  return (
    <div data-reveal className="mb-4 flex items-baseline justify-between gap-4 border-t border-line pt-5">
      <h2 className="condensed flex items-baseline gap-3 text-[30px] uppercase leading-none">
        {no && <span className="led led-off text-[15px]">{no}</span>}
        {title}
        {count != null && <span className="num ml-2 text-[20px] font-semibold text-ink-soft">{count}</span>}
      </h2>
      {to && (
        <Link to={to} className="link-arrow">
          Semua →
        </Link>
      )}
    </div>
  );
}

/** Gambar dengan placeholder netral bila URL kosong atau gagal dimuat (sesuai saran docs). */
export function Img({ src, alt, className, eager }: { src?: string; alt: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
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
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-surface", className)} />;
}

export function SkeletonList({ rows = 5, className = "h-16" }: { rows?: number; className?: string }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="py-3">
          <Skeleton className={className} />
        </div>
      ))}
    </div>
  );
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

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border-y border-line py-10 text-center text-ink-soft">{children}</p>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const msg =
    status === 429
      ? "Kuota API sedang habis. Coba lagi nanti."
      : status === 404
        ? "Data tidak ditemukan."
        : status === 401
          ? "Akses API ditolak. Periksa API key di server."
          : "Data gagal dimuat.";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-6">
      <p className="text-ink-soft">{msg}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-ghost">
          Muat ulang
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
    "inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-sm font-semibold transition hover:border-ink disabled:pointer-events-none disabled:opacity-35";
  return (
    <nav aria-label="Halaman" className="mt-8 flex items-center justify-between border-t border-line pt-5">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" /> Sebelumnya
      </button>
      <span className="num text-sm text-ink-soft">
        Halaman {page} dari {pages}
      </span>
      <button type="button" className={btn} disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Berikutnya <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

export function PlatformTag({ platform }: { platform: string }) {
  const label = platform === "idn" ? "IDN" : platform === "showroom" ? "Showroom" : platform || "Live";
  return <span className="tag border border-line text-ink-soft">{label}</span>;
}

export function LiveTag() {
  return (
    <span className="tag bg-brand text-white">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      Live
    </span>
  );
}

/** Kontrol segmen sederhana (filter). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cx(
            "rounded-[5px] px-3 py-1.5 text-[13px] font-semibold transition",
            value === o.id ? "bg-ink text-bg" : "text-ink-soft hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
