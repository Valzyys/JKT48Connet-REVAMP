import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { useState } from "react";
import { LiveCard, RecentCard } from "@/components/cards";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, LiveDot, PageHero, SectionHead, SkeletonGrid, cx } from "@/components/ui";
import { q } from "@/lib/queries";

const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "showroom", label: "Showroom" },
  { id: "idn", label: "IDN Live" },
] as const;

export function LivePage() {
  const live = useQuery(q.live());
  const recent = useQuery(q.recentList(1, 6));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const all = live.data ?? [];
  const shown = filter === "all" ? all : all.filter((l) => l.platform === filter);

  return (
    <Page deps={[live.data, recent.data, filter]}>
      <PageHero
        eyebrow="On air"
        title={
          <>
            Live <span className="text-brand">sekarang.</span>
          </>
        }
        desc="Member JKT48 yang sedang siaran di Showroom dan IDN Live. Daftar diperbarui otomatis setiap menit."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">
            <LiveDot /> <span className="num">{all.length}</span> sedang live
          </span>
          <div className="inline-flex rounded-full border border-line bg-card p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cx(
                  "rounded-full px-4 py-1.5 text-[13px] font-semibold transition",
                  filter === f.id ? "bg-ink text-bg" : "text-ink-soft hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </PageHero>

      <section className="container-x pt-12">
        {live.isError ? (
          <ErrorState error={live.error} onRetry={() => live.refetch()} />
        ) : live.isLoading ? (
          <SkeletonGrid count={8} className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" item="aspect-[3/4] rounded-[28px]" />
        ) : shown.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {shown.map((l) => (
              <LiveCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Radio className="h-5 w-5" />} title="Belum ada yang live" desc="Halaman ini akan memperbarui diri saat ada member yang mulai siaran." />
        )}
      </section>

      {!!recent.data?.items.length && (
        <section className="container-x pt-24">
          <SectionHead eyebrow="Baru selesai" title="Recent live" to="/recent" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recent.data.items.map((r) => (
              <RecentCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}
    </Page>
  );
}
