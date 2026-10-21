import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Building2, Radio } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { BirthdayCard, LiveCard, NewsCard, RecentCard, ShowCard, ShowRow, VideoCard } from "@/components/cards";
import { Countdown } from "@/components/countdown";
import { useIntroDone } from "@/components/intro";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, Img, LiveDot, SectionHead, Skeleton, SkeletonGrid } from "@/components/ui";
import { fmtDate, fmtTime } from "@/lib/format";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { q } from "@/lib/queries";

const HEADLINE = ["Selalu", "dekat", "dengan", "oshi."];

function Hero() {
  const root = useRef<HTMLElement>(null);
  const ready = useIntroDone();
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const show = next.data?.[0];
  const lives = live.data ?? [];

  // Animasi hero dimulai setelah intro selesai.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !ready) return;
    const reduce = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.set("[data-hero]", { opacity: 1, y: 0, yPercent: 0 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.fromTo("[data-hero='word']", { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.08 })
        .fromTo("[data-hero='fade']", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, "-=0.8")
        .fromTo("[data-hero='panel']", { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 1 }, "-=0.9");

      // Parallax wordmark latar saat scroll.
      gsap.to("[data-hero-bg]", {
        yPercent: 35,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
      });
    }, el);
    return () => ctx.revert();
  }, [ready]);

  return (
    <section ref={root} className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-10 h-[34rem] w-[34rem] rounded-full bg-brand/20 blur-[120px]" />
        <div className="absolute -right-40 bottom-0 h-[28rem] w-[28rem] rounded-full bg-gold/15 blur-[120px]" />
        <p
          data-hero-bg
          className="absolute -bottom-[0.18em] left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[34vw] font-extrabold leading-none tracking-[-0.07em] text-transparent [-webkit-text-stroke:1px_var(--line)]"
        >
          JKT48
        </p>
      </div>

      <div className="container-x relative grid min-h-[100svh] items-end gap-10 pb-14 pt-32 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:pb-20">
        <div>
          <p data-hero="fade" className="eyebrow flex items-center gap-3 opacity-0">
            <span className="h-px w-8 bg-brand" /> Fan hub JKT48 · real-time
          </p>
          <h1 className="mt-6 font-display text-[clamp(3.4rem,11vw,9rem)] font-extrabold leading-[0.86] tracking-[-0.055em]">
            {HEADLINE.map((w, i) => (
              <span key={w} className="mr-[0.18em] inline-block overflow-hidden pb-[0.06em] align-bottom">
                <span data-hero="word" className={`inline-block ${i === 3 ? "text-brand" : ""}`}>
                  {w}
                </span>
              </span>
            ))}
          </h1>
          <p data-hero="fade" className="mt-7 max-w-lg text-[17px] leading-relaxed text-ink-soft opacity-0">
            Live member, jadwal theater, birthday, rekap live, sampai berita resmi — dirangkum dalam satu tempat yang
            cepat dan ringan.
          </p>
          <div data-hero="fade" className="mt-9 flex flex-wrap gap-3 opacity-0">
            <Link to="/live" className="btn btn-primary">
              <Radio className="h-4 w-4" /> Lihat yang live
            </Link>
            <Link to="/theater" className="btn btn-ghost">
              <Building2 className="h-4 w-4" /> Jadwal theater
            </Link>
          </div>
        </div>

        <div data-hero="panel" className="space-y-4 opacity-0">
          {/* Panel: show berikutnya */}
          <div className="overflow-hidden rounded-[32px] border border-line bg-card shadow-2xl shadow-black/5">
            {show ? (
              <Link to="/theater/$id" params={{ id: show.id }} className="group block">
                <div className="relative aspect-[16/8] overflow-hidden bg-surface">
                  <Img
                    src={show.banner || show.poster}
                    alt={show.title}
                    eager
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                  <span className="chip absolute left-4 top-4 bg-bg/90 text-ink backdrop-blur">Show berikutnya</span>
                </div>
                <div className="p-6">
                  <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                    {fmtDate(show.date, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(show.date)} WIB
                  </p>
                  <div className="mt-2 flex items-start justify-between gap-4">
                    <h2 className="font-display text-2xl font-extrabold leading-tight tracking-tight group-hover:text-brand">
                      {show.title}
                    </h2>
                    <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-ink-soft transition group-hover:rotate-45 group-hover:text-brand" />
                  </div>
                  <Countdown target={show.date} className="mt-5 text-ink" />
                </div>
              </Link>
            ) : next.isLoading ? (
              <div className="p-6">
                <Skeleton className="aspect-[16/8] w-full" />
                <Skeleton className="mt-5 h-6 w-2/3" />
                <Skeleton className="mt-3 h-10 w-1/2" />
              </div>
            ) : (
              <div className="p-8">
                <p className="eyebrow">Show berikutnya</p>
                <p className="mt-3 font-display text-2xl font-bold">Belum ada jadwal terdekat.</p>
                <Link to="/theater" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                  Lihat semua jadwal <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>

          {/* Panel: status live */}
          <Link
            to="/live"
            className="group flex items-center justify-between gap-4 rounded-[28px] bg-ink p-5 text-bg transition hover:bg-brand"
          >
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {lives.slice(0, 4).map((l) => (
                  <Img key={l.id} src={l.img} alt={l.name} className="h-11 w-11 rounded-full border-2 border-ink object-cover group-hover:border-brand" />
                ))}
                {!lives.length && (
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-bg/10">
                    <Radio className="h-5 w-5" />
                  </span>
                )}
              </div>
              <div>
                <p className="flex items-center gap-2 font-display text-lg font-bold">
                  {lives.length > 0 && <LiveDot className="text-brand group-hover:text-white" />}
                  {live.isLoading ? "Memeriksa live…" : lives.length ? `${lives.length} member sedang live` : "Belum ada yang live"}
                </p>
                <p className="text-xs opacity-60">Showroom & IDN Live · diperbarui tiap menit</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function LiveSection() {
  const live = useQuery(q.live());
  const recent = useQuery({ ...q.recentList(1, 6), enabled: live.isSuccess && live.data.length === 0 });
  const data = live.data ?? [];

  return (
    <section className="container-x pt-24">
      <SectionHead eyebrow="On air" title="Live sekarang" meta="Member yang sedang siaran di Showroom & IDN." to="/live" />
      {live.isError ? (
        <ErrorState error={live.error} onRetry={() => live.refetch()} />
      ) : live.isLoading ? (
        <SkeletonGrid count={4} className="grid grid-cols-2 gap-4 md:grid-cols-4" item="aspect-[3/4] rounded-[28px]" />
      ) : data.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.slice(0, 8).map((l) => (
            <LiveCard key={l.id} l={l} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <EmptyState icon={<Radio className="h-5 w-5" />} title="Member sedang rehat" desc="Sampai jumpa di live berikutnya ♡ Sambil menunggu, cek live yang baru selesai." />
          {recent.data && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recent.data.items.map((r) => (
                <RecentCard key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TheaterSection() {
  const theater = useQuery(q.theaterList(1, 6));
  const [first, ...rest] = theater.data?.items ?? [];
  return (
    <section className="container-x pt-28">
      <SectionHead eyebrow="Theater" title="Jadwal pertunjukan" meta="Setlist, member yang tampil, dan seitansai." to="/theater" />
      {theater.isError ? (
        <ErrorState error={theater.error} onRetry={() => theater.refetch()} />
      ) : theater.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="aspect-[16/12] rounded-[28px]" />
          <SkeletonGrid count={4} className="space-y-3" item="h-[88px] rounded-3xl" />
        </div>
      ) : first ? (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <ShowCard s={first} featured />
          <div className="space-y-3">
            {rest.slice(0, 5).map((s) => (
              <ShowRow key={s.id} s={s} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title="Belum ada jadwal theater" />
      )}
    </section>
  );
}

function BirthdaySection() {
  const bday = useQuery(q.birthdays());
  if (bday.isSuccess && !bday.data.length) return null;
  return (
    <section className="pt-28">
      <div className="container-x">
        <SectionHead eyebrow="Upcoming" title="Ulang tahun member" to="/birthday" />
      </div>
      <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-[max(2.5rem,calc((100vw_-_1400px)/2_+_2.5rem))]">
        {bday.isLoading &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] w-48 shrink-0 rounded-3xl sm:w-56" />)}
        {bday.data?.slice(0, 12).map((b) => (
          <BirthdayCard key={b.id} b={b} />
        ))}
      </div>
    </section>
  );
}

function RecentSection() {
  const recent = useQuery(q.recentList(1, 6));
  return (
    <section className="container-x pt-28">
      <SectionHead eyebrow="Baru selesai" title="Recent live" meta="Rekap durasi, penonton, dan gift." to="/recent" />
      {recent.isError ? (
        <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
      ) : recent.isLoading ? (
        <SkeletonGrid count={6} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" item="h-[88px] rounded-3xl" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recent.data?.items.map((r) => (
            <RecentCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function NewsSection() {
  const news = useQuery(q.newsList(1, 5));
  const [first, ...rest] = news.data?.items ?? [];
  return (
    <section className="container-x pt-28">
      <SectionHead eyebrow="Kabar resmi" title="Berita terbaru" to="/news" />
      {news.isError ? (
        <ErrorState error={news.error} onRetry={() => news.refetch()} />
      ) : news.isLoading ? (
        <SkeletonGrid count={3} className="grid gap-4 lg:grid-cols-3" item="h-56 rounded-[28px]" />
      ) : first ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <NewsCard n={first} big />
          <div className="grid gap-4 sm:grid-cols-2">
            {rest.slice(0, 4).map((n) => (
              <NewsCard key={n.id} n={n} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title="Belum ada berita" />
      )}
    </section>
  );
}

function VideoSection() {
  const videos = useQuery(q.videos());
  if (videos.isError || (videos.isSuccess && !videos.data.length)) return null;
  return (
    <section className="container-x pt-28">
      <SectionHead eyebrow="YouTube" title="Video terbaru" meta="Dari kanal resmi JKT48 & JKT48 TV." to="/video" />
      {videos.isLoading ? (
        <SkeletonGrid count={4} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" item="aspect-video rounded-3xl" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {videos.data?.slice(0, 4).map((v) => (
            <VideoCard key={v.id} v={v} />
          ))}
        </div>
      )}
    </section>
  );
}

function CommunityBand() {
  return (
    <section className="container-x pt-28">
      <div data-reveal className="relative overflow-hidden rounded-[40px] bg-brand px-6 py-14 text-white sm:px-12 sm:py-20">
        <div aria-hidden className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <p className="num text-[11px] uppercase tracking-[0.25em] text-white/70">Komunitas</p>
        <h2 className="mt-4 max-w-3xl font-display text-[clamp(2.2rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">
          Notifikasi live & jadwal, langsung ke timeline-mu.
        </h2>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="https://x.com/JKT48Connect" target="_blank" rel="noreferrer" className="btn bg-white text-brand hover:bg-white/90">
            Ikuti di X <ArrowUpRight className="h-4 w-4" />
          </a>
          <a
            href="https://discord.com/discovery/applications/1305141693477027891"
            target="_blank"
            rel="noreferrer"
            className="btn border border-white/40 text-white hover:bg-white/10"
          >
            Tambah bot Discord <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const live = useQuery(q.live());
  const theater = useQuery(q.theaterList(1, 6));
  const recent = useQuery(q.recentList(1, 6));
  const news = useQuery(q.newsList(1, 5));
  const bday = useQuery(q.birthdays());
  const videos = useQuery(q.videos());
  return (
    <Page deps={[live.data, theater.data, recent.data, news.data, bday.data, videos.data]}>
      <Hero />
      <LiveSection />
      <TheaterSection />
      <BirthdaySection />
      <RecentSection />
      <NewsSection />
      <VideoSection />
      <CommunityBand />
    </Page>
  );
}
