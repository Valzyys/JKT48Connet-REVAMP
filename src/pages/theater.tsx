import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShowRow } from "@/components/cards";
import { Page } from "@/components/page";
import { Empty, ErrorState, PageHeader, Pagination, SkeletonList } from "@/components/ui";
import { q } from "@/lib/queries";

const PER = 15;

export function TheaterPage() {
  const { page = 1 } = useSearch({ strict: false }) as { page?: number };
  const navigate = useNavigate();
  const theater = useQuery(q.theaterList(page, PER));

  return (
    <Page deps={[theater.data]}>
      <PageHeader title="Theater" desc="Pertunjukan di JKT48 Theater: setlist, member yang tampil, dan seitansai." />
      <section className="container-x pt-4">
        {theater.isError ? (
          <ErrorState error={theater.error} onRetry={() => theater.refetch()} />
        ) : theater.isLoading ? (
          <SkeletonList rows={8} />
        ) : theater.data?.items.length ? (
          <>
            {theater.data.items.map((s) => (
              <ShowRow key={s.id} s={s} lineup />
            ))}
            <Pagination
              page={page}
              perpage={PER}
              total={theater.data.total}
              onChange={(p) => navigate({ to: "/theater", search: p > 1 ? { page: p } : {} })}
            />
          </>
        ) : (
          <Empty>Belum ada jadwal theater.</Empty>
        )}
      </section>
    </Page>
  );
}
