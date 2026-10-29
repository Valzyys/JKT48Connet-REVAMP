import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Cake } from "lucide-react";
import { LiveCard, NewsRow, RecentCard, VideoCard } from "@/components/cards";
import { StageHero } from "@/components/hero";
import { Empty, ErrorState, Img, SectionHead, Skeleton, SkeletonGrid, Stat, useNow } from "@/components/ui";
import { q } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { Link } from "@/lib/router";

function greeting(h: number) {
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}

export function HomePage() {
  const now = useNow(1000);
  const live = useQuery(q.live());
  const sched = useQuery(q.nextSchedule());
  const members = useQuery(q.members());
  const recent = useInfiniteQuery(q.recentList());
  const birthdays = useQuery(q.birthdays());
  const videos = useQuery(q.videos());
  const news = useInfiniteQuery(q.newsList());

  const wibHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(now));
  const next = sched.data?.find((s) => Date.parse(s.date) > now - 2 * 3600_000 && s.category !== "event") ?? sched.data?.[0];
  const recentItems = recent.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-10">
      {/* Sambutan */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="micro flex items-center gap-2 text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {fmtDate(new Date(now).toISOString(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="condensed mt-2 text-[clamp(2rem,3.2vw,3rem)] uppercase leading-[0.9]">
            {greeting(wibHour)}, <span className="text-brand">fans JKT48!</span>
          </h1>
        </div>
        <p className="num rounded-full border border-line bg-card px-4 py-2 font-mono text-[13px] text-ink-soft">
          WIB {new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now).replace(/\./g, ":")}
        </p>
      </div>

      {/* Hero panggung */}
      {sched.isPending ? (
        <Skeleton className="h-[460px] rounded-[34px]" />
      ) : next ? (
        <StageHero show={next} upcoming={(sched.data ?? []).filter((s) => Date.parse(s.date) > now - 2 * 3600_000)} live={live.data ?? []} now={now} />
      ) : (
        <Empty title="Belum ada jadwal">Jadwal theater berikutnya akan muncul di sini.</Empty>
      )}

      {/* Angka */}
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat k="Sedang live" v={live.data?.length ?? "—"} accent />
        <Stat k="Member aktif" v={members.data ? members.data.filter((m) => !m.isGraduate).length : "—"} />
        <Stat k="Jadwal mendatang" v={sched.data?.length ?? "—"} />
        <Stat k="Live tercatat" v={recent.data?.pages[0]?.total ?? "—"} />
      </div>

      {/* Live yang sedang berjalan (kartu besar) */}
      {live.data && live.data.length > 0 && (
        <section>
          <SectionHead title="Live sekarang" count={live.data.length} to="/live" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
            {live.data.slice(0, 4).map((l) => (
              <LiveCard key={l.id} l={l} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <SectionHead title="Recent live" to="/recent" />
          {recent.isError ? (
            <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
          ) : recent.isPending ? (
            <SkeletonGrid count={6} className="grid gap-3 lg:grid-cols-2" item="h-[120px]" />
          ) : (
            <div className="stagger grid gap-3 lg:grid-cols-2">
              {recentItems.slice(0, 6).map((r) => (
                <RecentCard key={r.id} r={r} />
              ))}
            </div>
          )}
        </section>
        <section>
          <SectionHead title="Ulang tahun" to="/birthday" />
          <div className="panel overflow-hidden">
            {birthdays.isPending ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : (
              (birthdays.data ?? []).slice(0, 5).map((b) => {
                const days = Math.round((b.next.getTime() - new Date(new Date().toDateString()).getTime()) / 86400_000);
                return (
                  <Link key={b.id} to={`/member/${encodeURIComponent(b.id)}`} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 hover:bg-surface/60">
                    <Img src={b.img} className="h-11 w-11 rounded-full object-top" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{b.name}</p>
                      <p className="font-mono text-[11.5px] text-ink-soft">
                        {fmtDate(b.next.toISOString(), { day: "numeric", month: "short" })} · {b.age} th
                      </p>
                    </div>
                    {days === 0 ? (
                      <span className="pill bg-brand text-white">
                        <Cake className="h-3 w-3" /> Hari ini
                      </span>
                    ) : (
                      <span className="pill bg-blush text-brand">{days} hr</span>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <SectionHead title="Video terbaru" to="/video" />
          {videos.isPending ? (
            <SkeletonGrid count={3} className="grid gap-4 lg:grid-cols-3" item="aspect-[4/3.4]" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {(videos.data ?? []).slice(0, 3).map((v) => (
                <VideoCard key={v.id} v={v} />
              ))}
            </div>
          )}
        </section>
        <section>
          <SectionHead title="Berita" to="/news" />
          <div className="panel overflow-hidden">
            {(news.data?.pages[0]?.items ?? []).slice(0, 4).map((n) => (
              <NewsRow key={n.id} n={n} />
            ))}
            {news.isPending && <Skeleton className="m-3 h-40" />}
          </div>
        </section>
      </div>
    </div>
  );
}
