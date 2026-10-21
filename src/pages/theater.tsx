import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShowCard } from "@/components/cards";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, PageHero, Pagination, SkeletonGrid } from "@/components/ui";
import { q } from "@/lib/queries";

const PER = 12;

export function TheaterPage() {
  const { page = 1 } = useSearch({ strict: false }) as { page?: number };
  const navigate = useNavigate();
  const theater = useQuery(q.theaterList(page, PER));

  return (
    <Page deps={[theater.data]}>
      <PageHero
        eyebrow="JKT48 Theater"
        title={
          <>
            Jadwal <span className="text-brand">theater.</span>
          </>
        }
        desc="Semua pertunjukan di JKT48 Theater: setlist, tanggal, member yang tampil, dan seitansai."
      />
      <section className="container-x pt-12">
        {theater.isError ? (
          <ErrorState error={theater.error} onRetry={() => theater.refetch()} />
        ) : theater.isLoading ? (
          <SkeletonGrid count={6} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" item="aspect-[4/3.6] rounded-[28px]" />
        ) : theater.data?.items.length ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {theater.data.items.map((s) => (
                <ShowCard key={s.id} s={s} />
              ))}
            </div>
            <Pagination
              page={page}
              perpage={PER}
              total={theater.data.total}
              onChange={(p) => navigate({ to: "/theater", search: p > 1 ? { page: p } : {} })}
            />
          </>
        ) : (
          <EmptyState title="Belum ada jadwal" desc="Coba lagi nanti." />
        )}
      </section>
    </Page>
  );
}
