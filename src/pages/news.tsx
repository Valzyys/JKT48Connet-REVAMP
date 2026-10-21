import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { NewsCard } from "@/components/cards";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, PageHero, Pagination, SkeletonGrid } from "@/components/ui";
import { q } from "@/lib/queries";

const PER = 12;

export function NewsPage() {
  const { page = 1 } = useSearch({ strict: false }) as { page?: number };
  const navigate = useNavigate();
  const news = useQuery(q.newsList(page, PER));

  return (
    <Page deps={[news.data]}>
      <PageHero
        eyebrow="Kabar resmi"
        title={
          <>
            Berita <span className="text-brand">terbaru.</span>
          </>
        }
        desc="Pengumuman resmi JKT48: theater, event, rilisan, merchandise, dan lainnya."
      />
      <section className="container-x pt-12">
        {news.isError ? (
          <ErrorState error={news.error} onRetry={() => news.refetch()} />
        ) : news.isLoading ? (
          <SkeletonGrid count={6} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" item="h-56 rounded-[28px]" />
        ) : news.data?.items.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {news.data.items.map((n, i) => (
                <div key={n.id} className={i === 0 && page === 1 ? "sm:col-span-2" : ""}>
                  <NewsCard n={n} big={i === 0 && page === 1} />
                </div>
              ))}
            </div>
            <Pagination page={page} perpage={PER} total={news.data.total} onChange={(p) => navigate({ to: "/news", search: p > 1 ? { page: p } : {} })} />
          </>
        ) : (
          <EmptyState icon={<Newspaper className="h-5 w-5" />} title="Belum ada berita" />
        )}
      </section>
    </Page>
  );
}
