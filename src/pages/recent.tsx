import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { RecentCard } from "@/components/cards";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, PageHero, Pagination, SkeletonGrid } from "@/components/ui";
import { q } from "@/lib/queries";

const PER = 18;

export function RecentPage() {
  const { page = 1 } = useSearch({ strict: false }) as { page?: number };
  const navigate = useNavigate();
  const recent = useQuery(q.recentList(page, PER));

  return (
    <Page deps={[recent.data]}>
      <PageHero
        eyebrow="Rekap live"
        title={
          <>
            Recent <span className="text-brand">live.</span>
          </>
        }
        desc="Live Showroom dan IDN yang baru selesai, lengkap dengan durasi, penonton, gift, dan replay bila tersedia."
      />
      <section className="container-x pt-12">
        {recent.isError ? (
          <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
        ) : recent.isLoading ? (
          <SkeletonGrid count={9} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" item="h-[88px] rounded-3xl" />
        ) : recent.data?.items.length ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recent.data.items.map((r) => (
                <RecentCard key={r.id} r={r} />
              ))}
            </div>
            <Pagination
              page={page}
              perpage={PER}
              total={recent.data.total}
              onChange={(p) => navigate({ to: "/recent", search: p > 1 ? { page: p } : {} })}
            />
          </>
        ) : (
          <EmptyState icon={<History className="h-5 w-5" />} title="Belum ada rekap live" />
        )}
      </section>
    </Page>
  );
}
