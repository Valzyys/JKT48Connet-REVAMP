import { useQuery } from "@tanstack/react-query";
import { BirthdayRow, NewsRow, RecentHead, RecentRow, ShowRow, VideoCard } from "@/components/cards";
import { Hero } from "@/components/hero";
import { useIntroDone } from "@/components/intro";
import { Page } from "@/components/page";
import { Empty, ErrorState, SectionHead, SkeletonGrid, SkeletonList } from "@/components/ui";
import { q } from "@/lib/queries";

export function HomePage() {
  const ready = useIntroDone();
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const theater = useQuery(q.theaterList(1, 6));
  const recent = useQuery(q.recentList(1, 6));
  const news = useQuery(q.newsList(1, 6));
  const bday = useQuery(q.birthdays());
  const videos = useQuery(q.videos());

  return (
    <Page ready={ready} deps={[live.data, next.data, theater.data, recent.data, news.data, bday.data, videos.data]}>
      <Hero />

      <section className="container-x pt-16">
        <SectionHead no="M02" title="Jadwal theater" to="/theater" />
        {theater.isError ? (
          <ErrorState error={theater.error} onRetry={() => theater.refetch()} />
        ) : theater.isLoading ? (
          <SkeletonList rows={4} />
        ) : theater.data?.items.length ? (
          theater.data.items.map((s) => <ShowRow key={s.id} s={s} lineup />)
        ) : (
          <Empty>Belum ada jadwal theater.</Empty>
        )}
      </section>

      <section className="container-x pt-16">
        <SectionHead no="M06" title="Recent live" to="/recent" />
        {recent.isError ? (
          <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
        ) : recent.isLoading ? (
          <SkeletonList rows={4} className="h-11" />
        ) : (
          <>
            <RecentHead />
            {recent.data?.items.map((r) => (
              <RecentRow key={r.id} r={r} />
            ))}
          </>
        )}
      </section>

      <section className="container-x grid gap-x-12 gap-y-16 pt-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionHead no="M05" title="Berita" to="/news" />
          {news.isError ? (
            <ErrorState error={news.error} onRetry={() => news.refetch()} />
          ) : news.isLoading ? (
            <SkeletonList rows={5} className="h-10" />
          ) : (
            news.data?.items.map((n) => <NewsRow key={n.id} n={n} />)
          )}
        </div>
        <div className="min-w-0">
          <SectionHead no="M07" title="Ulang tahun" to="/birthday" />
          {bday.isError ? (
            <ErrorState error={bday.error} onRetry={() => bday.refetch()} />
          ) : bday.isLoading ? (
            <SkeletonList rows={5} className="h-11" />
          ) : bday.data?.length ? (
            bday.data.slice(0, 6).map((b) => <BirthdayRow key={b.id} b={b} />)
          ) : (
            <Empty>Belum ada data ulang tahun.</Empty>
          )}
        </div>
      </section>

      {!videos.isError && (videos.isLoading || !!videos.data?.length) && (
        <section className="container-x pt-16">
          <SectionHead no="M08" title="Video terbaru" to="/video" />
          {videos.isLoading ? (
            <SkeletonGrid count={4} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" item="aspect-video" />
          ) : (
            <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {videos.data?.slice(0, 4).map((v) => (
                <VideoCard key={v.id} v={v} />
              ))}
            </div>
          )}
        </section>
      )}
    </Page>
  );
}
