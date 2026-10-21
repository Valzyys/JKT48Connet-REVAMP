import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LiveCard, RecentHead, RecentRow } from "@/components/cards";
import { Page } from "@/components/page";
import { Empty, ErrorState, PageHeader, SectionHead, Segmented, SkeletonGrid } from "@/components/ui";
import { q } from "@/lib/queries";

const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "showroom", label: "Showroom" },
  { id: "idn", label: "IDN" },
] as const;

export function LivePage() {
  const live = useQuery(q.live());
  const recent = useQuery(q.recentList(1, 6));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const all = live.data ?? [];
  const shown = filter === "all" ? all : all.filter((l) => l.platform === filter);

  return (
    <Page deps={[live.data, recent.data, filter]}>
      <PageHeader
        title="Live"
        desc={live.isSuccess ? `${all.length} member sedang siaran. Diperbarui setiap menit.` : "Member yang sedang siaran di Showroom dan IDN."}
        aside={<Segmented value={filter} options={FILTERS} onChange={setFilter} />}
      />

      <section className="container-x pt-8">
        {live.isError ? (
          <ErrorState error={live.error} onRetry={() => live.refetch()} />
        ) : live.isLoading ? (
          <SkeletonGrid count={8} className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5" item="aspect-[4/5]" />
        ) : shown.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {shown.map((l) => (
              <LiveCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <Empty>Belum ada member yang live{filter !== "all" ? ` di ${filter === "idn" ? "IDN" : "Showroom"}` : ""}.</Empty>
        )}
      </section>

      {!!recent.data?.items.length && (
        <section className="container-x pt-16">
          <SectionHead title="Baru selesai" to="/recent" />
          <RecentHead />
          {recent.data.items.map((r) => (
            <RecentRow key={r.id} r={r} />
          ))}
        </section>
      )}
    </Page>
  );
}
