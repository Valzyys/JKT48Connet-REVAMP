import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Braces } from "lucide-react";
import { LiveCard, NewsRow, PosterCard, RecentRow, VideoCard } from "@/components/cards";
import { HeroCarousel } from "@/components/carousel";
import { useIntroDone } from "@/components/intro";
import { CountUp, SignalBars } from "@/components/motion";
import { Page } from "@/components/page";
import { PromoPopup } from "@/components/promo-popup";
import { BirthdayCard, ScheduleCard } from "@/components/shell";
import { Empty, ErrorState, SectionHead, SkeletonGrid, SkeletonList } from "@/components/ui";
import { q } from "@/lib/queries";

function Stats() {
  const live = useQuery(q.live());
  const members = useQuery(q.members());
  const next = useQuery(q.nextSchedule());
  const recent = useQuery(q.recentList(1, 1));
  const items = [
    { label: "Sedang live", value: live.data?.length ?? 0, accent: true },
    { label: "Member aktif", value: members.data?.filter((m) => !m.isGraduate).length ?? 0 },
    { label: "Jadwal mendatang", value: next.data?.length ?? 0 },
    { label: "Live tercatat", value: recent.data?.total ?? 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} data-reveal className={s.accent ? "rounded-2xl bg-brand p-4 text-white" : "panel p-4"}>
          <p className={s.accent ? "micro text-white/80" : "micro text-ink-soft"}>{s.label}</p>
          <p className="condensed mt-2 flex items-center gap-2 text-[36px] leading-none">
            <CountUp value={s.value} />
            {s.accent && s.value > 0 && <SignalBars className="h-4" />}
          </p>
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const ready = useIntroDone();
  const live = useQuery(q.live());
  const theater = useQuery(q.nextSchedule());
  const recent = useQuery(q.recentList(1, 5));
  const news = useQuery(q.newsList(1, 5));
  const videos = useQuery(q.videos());
  const shows = (theater.data ?? []).filter((s) => s.category === "show");
  const lives = live.data ?? [];

  return (
    <Page ready={ready} deps={[live.data, theater.data, recent.data, news.data, videos.data]}>
      <div className="container-x space-y-10 pt-6">
        <section data-reveal>
          <HeroCarousel />
        </section>

        <Stats />

        <Link
          to="/developer"
          data-reveal
          className="group flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-nav px-5 py-4 text-white transition-transform hover:-translate-y-0.5 sm:px-6"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand">
            <Braces className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="micro block text-white/50">JKT48Connect API · untuk developer</span>
            <span className="mt-1 block font-bold leading-snug">
              Semua data di sini dari <span className="text-butter">api.jkt48connect.app</span>, dan kamu juga bisa memakainya.
            </span>
          </span>
          <span className="link-more inline-flex items-center gap-1.5 text-white/70 group-hover:text-white">
            Pelajari <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <section>
          <SectionHead label="On signal" title="Live" count={lives.length} to="/live" />
          {live.isError ? (
            <ErrorState error={live.error} onRetry={() => live.refetch()} />
          ) : live.isLoading ? (
            <SkeletonGrid count={4} className="grid grid-cols-2 gap-4 md:grid-cols-4" item="aspect-[4/5]" />
          ) : lives.length ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {lives.slice(0, 8).map((l, i) => (
                <LiveCard key={l.id} l={l} n={i + 1} />
              ))}
            </div>
          ) : (
            <Empty>Belum ada sinyal live saat ini. Cek lagi sebentar.</Empty>
          )}
        </section>

        <div className="space-y-4 xl:hidden">
          <ScheduleCard />
          <BirthdayCard />
        </div>

        <section>
          <SectionHead label="Your next theater date" title="Show" count={shows.length} to="/theater" />
          {theater.isLoading ? (
            <SkeletonGrid count={3} className="flex gap-4 overflow-hidden" item="aspect-[3/4] w-[220px] shrink-0" />
          ) : shows.length ? (
            <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {shows.map((s) => (
                <PosterCard key={s.id} s={s} />
              ))}
            </div>
          ) : (
            <Empty>Belum ada show theater terjadwal.</Empty>
          )}
        </section>

        <div className="grid gap-10 2xl:grid-cols-2">
          <section>
            <SectionHead label="Baru selesai" title="Recent" to="/recent" />
            {recent.isError ? (
              <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
            ) : recent.isLoading ? (
              <SkeletonList rows={4} />
            ) : (
              <div className="panel overflow-hidden">
                {recent.data?.items.map((r) => (
                  <RecentRow key={r.id} r={r} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHead label="Kabar resmi" title="Berita" to="/news" />
            {news.isError ? (
              <ErrorState error={news.error} onRetry={() => news.refetch()} />
            ) : news.isLoading ? (
              <SkeletonList rows={4} />
            ) : (
              <div className="panel overflow-hidden">
                {news.data?.items.map((n) => (
                  <NewsRow key={n.id} n={n} />
                ))}
              </div>
            )}
          </section>
        </div>

        {!videos.isError && (videos.isLoading || !!videos.data?.length) && (
          <section>
            <SectionHead label="YouTube" title="Video" to="/video" />
            {videos.isLoading ? (
              <SkeletonGrid count={3} className="grid gap-4 sm:grid-cols-3" item="aspect-video" />
            ) : (
              <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {videos.data?.slice(0, 6).map((v) => (
                  <VideoCard key={v.id} v={v} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      <PromoPopup ready={ready} />
    </Page>
  );
}
