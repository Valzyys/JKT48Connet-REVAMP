import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { ArrowLeft, ArrowRight, User } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SignalBars, SplitText } from "@/components/motion";
import { ApiError } from "@/lib/api";

export function cx(...a: Parameters<typeof clsx>) {
  return clsx(...a);
}

/** Kepala halaman: label mono, judul condensed "JUDUL / jumlah" ala desain brand. */
export function PageHeader({
  label,
  title,
  count,
  desc,
  aside,
}: {
  label?: string;
  title: string;
  count?: ReactNode;
  desc?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="container-x pt-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          {label && <p className="micro mb-3 flex items-center gap-2 text-brand"><span className="h-1.5 w-1.5 rounded-full bg-brand" />{label}</p>}
          <h1 className="condensed flex flex-wrap items-baseline gap-x-3 text-[clamp(2.5rem,7vw,4.5rem)] uppercase leading-[0.9]">
            <SplitText text={title} />
            {count != null && <span className="text-brand">/ {count}</span>}
          </h1>
          {desc && <p className="mt-3 max-w-xl text-ink-soft">{desc}</p>}
        </div>
        {aside}
      </div>
    </header>
  );
}

export function SectionHead({ title, count, to, label }: { title: string; count?: ReactNode; to?: string; label?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {label && <p className="micro mb-1.5 text-ink-soft">{label}</p>}
        <h2 className="condensed flex items-baseline gap-2 text-[30px] uppercase leading-none">
          <SplitText text={title} />
          {count != null && <span className="text-brand">/ {count}</span>}
        </h2>
      </div>
      {to && (
        <Link to={to} className="link-more group inline-flex items-center gap-1.5">
          Semua <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

/** Gambar dengan placeholder bila URL kosong atau gagal dimuat (sesuai saran docs). */
export function Img({ src, alt, className, eager }: { src?: string; alt: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className={cx("grid place-items-center bg-surface text-ink-soft/40", className)}>
        <User className="h-1/3 max-h-12 w-1/3 max-w-12" strokeWidth={1.5} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} className={className} />;
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

export function SkeletonList({ rows = 5, className = "h-16" }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center text-ink-soft">
      <SignalBars active={false} className="h-5 text-brand" />
      <p>{children}</p>
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
          ? "Akses API ditolak. Periksa API key di server."
          : "Sinyal terputus, data gagal dimuat.";
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-5">
      <p className="text-ink-soft">{msg}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-ghost">
          Muat ulang
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, total, perpage, onChange }: { page: number; total: number; perpage: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perpage));
  if (pages <= 1) return null;
  const btn = "btn btn-ghost disabled:pointer-events-none disabled:opacity-35";
  return (
    <nav aria-label="Halaman" className="mt-8 flex items-center justify-between gap-3">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ArrowLeft className="h-4 w-4" /> Sebelumnya
      </button>
      <span className="font-mono text-[12px] text-ink-soft">
        {String(page).padStart(2, "0")} / {String(pages).padStart(2, "0")}
      </span>
      <button type="button" className={btn} disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Berikutnya <ArrowRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

export function PlatformTag({ platform }: { platform: string }) {
  const idn = platform === "idn";
  return <span className={cx("pill", idn ? "bg-blush text-brand" : "bg-butter text-[#7a4b00]")}>{idn ? "IDN" : platform === "showroom" ? "Showroom" : platform || "Live"}</span>;
}

export function LiveTag() {
  return (
    <span className="pill bg-brand text-white">
      <SignalBars className="h-2.5" /> Live
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-card p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cx("rounded-full px-3.5 py-1.5 text-[13px] font-bold transition", value === o.id ? "bg-brand text-white" : "text-ink-soft hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Nomor urut merah "01" seperti pada desain lineup jkt48connect. */
export function Index({ n, className }: { n: number; className?: string }) {
  return <span className={cx("font-mono text-[11px] font-semibold text-brand", className)}>{String(n).padStart(2, "0")}</span>;
}
