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
      <PageHeader label="Kabar resmi" title="Berita" count={news.data?.total} desc="Pengumuman resmi JKT48." />
      <section className="container-x pt-8">
        {news.isError ? (
          <ErrorState error={news.error} onRetry={() => news.refetch()} />
        ) : news.isLoading ? (
          <SkeletonList rows={10} className="h-10" />
        ) : news.data?.items.length ? (
          <>
            <div className="panel overflow-hidden">
              {news.data.items.map((n) => (
                <NewsRow key={n.id} n={n} />
              ))}
            </div>
            <Pagination page={page} perpage={PER} total={news.data.total} onChange={(p) => navigate({ to: "/news", search: p > 1 ? { page: p } : {} })} />
          </>
        ) : (
          <Empty>Belum ada berita.</Empty>
        )}
      </section>
    </Page>
  );
}
