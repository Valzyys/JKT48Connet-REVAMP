import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Cake, Calendar, Clock, Play, Users } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { ShowRow } from "@/components/cards";
import { Countdown } from "@/components/countdown";
import { Page } from "@/components/page";
import { EmptyState, ErrorState, Img, Skeleton, cx } from "@/components/ui";
import { fmtDate, fmtTime } from "@/lib/format";
import type { ShowMember } from "@/lib/jkt48";
import { q } from "@/lib/queries";

function MemberTile({ m, tag }: { m: ShowMember; tag?: string }) {
  return (
    <Link
      to="/member/$id"
      params={{ id: m.id }}
      data-reveal
      className={cx("group block overflow-hidden rounded-3xl border bg-card transition hover:-translate-y-1", tag ? "border-gold" : "border-line hover:border-brand/60")}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface">
        <Img src={m.img} alt={m.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" />
        {tag && <span className="chip absolute left-2.5 top-2.5 bg-gold text-black">{tag}</span>}
      </div>
      <p className="truncate px-3 py-2.5 text-center text-sm font-semibold">{m.name}</p>
    </Link>
  );
}

export function TheaterDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const show = useQuery(q.theater(id));
  const s = show.data;
  const upcoming = s?.date ? new Date(s.date).getTime() > Date.now() : false;
  const birthdayIds = new Set(s?.birthday.map((b) => b.name));

  return (
    <Page deps={[s]}>
      <section className="container-x pt-28">
        <BackLink to="/theater" label="Semua jadwal" />
      </section>

      {show.isError ? (
        <div className="container-x pt-10">
          <ErrorState error={show.error} onRetry={() => show.refetch()} />
        </div>
      ) : !s ? (
        <div className="container-x space-y-5 pt-10">
          <Skeleton className="aspect-[21/9] w-full rounded-[32px]" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      ) : (
        <>
          <section className="container-x pt-8">
            <div data-reveal className="relative overflow-hidden rounded-[36px] bg-surface">
              <Img src={s.designBanner || s.banner || s.poster} alt={s.title} eager className="aspect-[16/10] w-full object-cover sm:aspect-[21/9]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10">
                <div className="flex flex-wrap gap-2">
                  {upcoming && <span className="chip bg-brand text-white">Akan datang</span>}
                  {s.birthday.length > 0 && (
                    <span className="chip bg-gold text-black">
                      <Cake className="h-3 w-3" /> Seitansai
                    </span>
                  )}
                </div>
                <h1 className="mt-3 font-display text-[clamp(2rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">{s.title}</h1>
              </div>
            </div>
          </section>

          <section className="container-x grid gap-10 pt-10 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              {s.setlistDescription && (
                <div data-reveal>
                  <p className="eyebrow">Tentang setlist</p>
                  <p className="mt-3 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{s.setlistDescription}</p>
                </div>
              )}

              <div className="mt-12">
                <div data-reveal className="mb-6 flex items-end justify-between">
                  <div>
                    <p className="eyebrow">Lineup</p>
                    <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Member yang tampil</h2>
                  </div>
                  <span className="num text-sm text-ink-soft">{s.members.length || s.memberCount || 0} member</span>
                </div>
                {s.members.length ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {s.members.map((m) => (
                      <MemberTile key={m.id} m={m} tag={birthdayIds.has(m.name) ? "🎂 Seitansai" : undefined} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<Users className="h-5 w-5" />} title="Lineup belum diumumkan" />
                )}
              </div>

              {s.graduation.length > 0 && (
                <div className="mt-12">
                  <p data-reveal className="eyebrow">Graduation show</p>
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {s.graduation.map((m) => (
                      <MemberTile key={m.id} m={m} tag="Graduation" />
                    ))}
                  </div>
                </div>
              )}

              {s.recordings.length > 0 && (
                <div className="mt-12">
                  <p data-reveal className="eyebrow">Rekaman</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {s.recordings.map((r) => (
                      <a key={r.youtubeUrl} href={r.youtubeUrl} target="_blank" rel="noopener noreferrer" data-reveal className="group block">
                        <div className="relative aspect-video overflow-hidden rounded-3xl bg-surface">
                          <Img src={r.thumbnail} alt={r.title} className="h-full w-full object-cover" />
                          <span className="absolute inset-0 grid place-items-center bg-black/30">
                            <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-brand">
                              <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                            </span>
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold group-hover:text-brand">{r.title}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div data-reveal className="rounded-[28px] border border-line bg-card p-6">
                <div className="space-y-4 text-sm">
                  <p className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-brand" />
                    {fmtDate(s.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <p className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-brand" /> {fmtTime(s.date)} WIB
                  </p>
                </div>
                {upcoming && (
                  <div className="mt-6 border-t border-line pt-6">
                    <p className="eyebrow mb-3 !text-ink-soft">Dimulai dalam</p>
                    <Countdown target={s.date} />
                  </div>
                )}
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-6 w-full">
                    Info resmi & tiket <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
              {s.otherShows.length > 0 && (
                <div className="space-y-3">
                  <p className="eyebrow">Show lain di hari yang sama</p>
                  {s.otherShows.map((o) => (
                    <ShowRow key={o.id} s={o} />
                  ))}
                </div>
              )}
            </aside>
          </section>
        </>
      )}
    </Page>
  );
}
