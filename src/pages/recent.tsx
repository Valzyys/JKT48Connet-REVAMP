import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RecentRow } from "@/components/cards";
import { Page } from "@/components/page";
import { Empty, ErrorState, PageHeader, Pagination, SkeletonList } from "@/components/ui";
import { q } from "@/lib/queries";

const PER = 20;

export function RecentPage() {
  const { page = 1 } = useSearch({ strict: false }) as { page?: number };
  const navigate = useNavigate();
  const recent = useQuery(q.recentList(page, PER));

  return (
    <Page deps={[recent.data]}>
      <PageHeader label="Rekap live" title="Recent" count={recent.data?.total} desc="Live Showroom dan IDN yang sudah selesai: durasi, penonton, gift, dan replay bila ada." />
      <section className="container-x pt-8">
        {recent.isError ? (
          <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
        ) : recent.isLoading ? (
          <SkeletonList rows={8} />
        ) : recent.data?.items.length ? (
          <>
            <div className="panel overflow-hidden">
              {recent.data.items.map((r) => (
                <RecentRow key={r.id} r={r} />
              ))}
            </div>
            <Pagination page={page} perpage={PER} total={recent.data.total} onChange={(p) => navigate({ to: "/recent", search: p > 1 ? { page: p } : {} })} />
          </>
        ) : (
          <Empty>Belum ada rekap live.</Empty>
        )}
      </section>
    </Page>
  );
}
