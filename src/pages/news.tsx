import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { NewsRow } from "@/components/cards";
import { Page } from "@/components/page";
import { Empty, ErrorState, PageHeader, Pagination, SkeletonList } from "@/components/ui";
import { q } from "@/lib/queries";

const PER = 20;

export function NewsPage() {
  const { page = 1 } = useSearch({ strict: false }) as { page?: number };
  const navigate = useNavigate();
  const news = useQuery(q.newsList(page, PER));

  return (
    <Page deps={[news.data]}>
      <PageHeader title="Berita" desc="Pengumuman resmi JKT48." />
      <section className="container-x pt-4">
        {news.isError ? (
          <ErrorState error={news.error} onRetry={() => news.refetch()} />
        ) : news.isLoading ? (
          <SkeletonList rows={10} className="h-10" />
        ) : news.data?.items.length ? (
          <>
            {news.data.items.map((n) => (
              <NewsRow key={n.id} n={n} />
            ))}
            <Pagination page={page} perpage={PER} total={news.data.total} onChange={(p) => navigate({ to: "/news", search: p > 1 ? { page: p } : {} })} />
          </>
        ) : (
          <Empty>Belum ada berita.</Empty>
        )}
      </section>
    </Page>
  );
}
