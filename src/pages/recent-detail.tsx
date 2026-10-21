import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/back-link";
import { Page } from "@/components/page";
import { ErrorState, Img, PlatformTag, Skeleton } from "@/components/ui";
import { fmtDate, fmtDuration, fmtNumber, fmtTime } from "@/lib/format";
import { pointLabel } from "@/lib/jkt48";
import { q } from "@/lib/queries";

/** Ambil beberapa momen (awal, tengah, akhir) dari daftar screenshot, sesuai saran docs. */
function pickMoments(list: string[], n = 6) {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="condensed mb-3 text-[28px] uppercase leading-none">{children}</h2>;
}

export function RecentDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const recent = useQuery(q.recent(id));
  const r = recent.data;
  const unit = r ? pointLabel(r.pointUnit) : "";

  return (
    <Page deps={[r]}>
      <div className="container-x pt-6">
        <BackLink to="/recent" label="Semua recent live" />

        {recent.isError ? (
          <div className="pt-8">
            <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
          </div>
        ) : !r ? (
          <div className="space-y-4 pt-8">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <div data-reveal className="flex flex-wrap items-end gap-5 border-b-2 border-brand pb-5 pt-6">
              <Img src={r.img} alt={r.name} eager className="h-24 w-24 rounded-2xl object-cover object-top" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-ink-soft">
                  <PlatformTag platform={r.platform} />
                  <span className="num">
                    {fmtDate(r.start, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(r.start)}–{fmtTime(r.end)} WIB
                  </span>
                </p>
                <h1 className="condensed mt-1 text-[clamp(2.25rem,6vw,4.25rem)] uppercase leading-[0.86]">
                  {r.memberId ? (
                    <Link to="/member/$id" params={{ id: r.memberId }} className="hover:text-brand">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </h1>
                {r.title && <p className="mt-1 text-ink-soft">“{r.title}”</p>}
              </div>
              {r.replayUrl && (
                <a href={r.replayUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  Tonton replay
                </a>
              )}
            </div>

            <dl data-reveal className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Durasi", fmtDuration(r.durationMs)],
                ["Penonton", fmtNumber(r.viewers)],
                [unit, fmtNumber(r.points)],
                ["Komentar", fmtNumber(r.comments)],
                ["Pemberi komentar", fmtNumber(r.commenters)],
              ].map(([k, v]) => (
                <div key={k} className="panel p-4 first:border-brand first:bg-brand first:text-white">
                  <dt className="micro opacity-70">{k}</dt>
                  <dd className="num condensed mt-1 text-[32px] leading-none">{v}</dd>
                </div>
              ))}
            </dl>
            {(r.recordingPartial || r.giftsPartial) && (
              <p className="pt-3 text-[13px] text-ink-soft">
                Data parsial: {[r.recordingPartial && "sebagian rekaman tidak tercatat", r.giftsPartial && "rincian gift hanya dari event yang teramati"].filter(Boolean).join("; ")}.
              </p>
            )}

            <div className="grid gap-x-12 gap-y-10 pt-10 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-10">
                {r.fans.length > 0 && (
                  <section data-reveal>
                    <H2>Top supporter</H2>
                    <ol className="panel overflow-hidden">
                      {r.fans.slice(0, 10).map((f, i) => (
                        <li key={`${f.name}-${i}`} className="grid grid-cols-[1.5rem_auto_1fr_auto] items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                          <span className="num text-ink-soft">{i + 1}</span>
                          <Img src={f.avatar} alt={f.name} className="h-8 w-8 rounded-full object-cover" />
                          <span className="truncate font-medium">{f.name}</span>
                          <span className="num font-semibold">
                            {fmtNumber(f.amount)} <span className="text-[12px] font-normal text-ink-soft">{unit}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {r.gifts.length > 0 && (
                  <section data-reveal>
                    <H2>Gift</H2>
                    <div className="panel grid grid-cols-2 overflow-hidden sm:grid-cols-3">
                      {r.gifts.slice(0, 12).map((g) => (
                        <div key={g.name} className="flex items-center gap-3 border-t border-line px-4 py-2.5">
                          {g.img ? <img src={g.img} alt="" loading="lazy" className="h-9 w-9 shrink-0 object-contain" /> : <span className="h-9 w-9 shrink-0 rounded bg-surface" />}
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold">{g.name}</p>
                            <p className="num text-[12px] text-ink-soft">
                              ×{fmtNumber(g.num)}
                              {g.users != null && ` · ${g.users} pengirim`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {r.screenshots.length > 0 && (
                  <section data-reveal>
                    <H2>Cuplikan</H2>
                    <div className={`grid gap-2 pt-3 ${r.platform === "idn" ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-3"}`}>
                      {pickMoments(r.screenshots).map((src) => (
                        <Img key={src} src={src} alt={`Cuplikan live ${r.name}`} className={`${r.platform === "idn" ? "aspect-[9/16]" : "aspect-video"} w-full rounded object-cover`} />
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {r.leaderboard && (
                <aside data-reveal className="lg:sticky lg:top-20 lg:self-start">
                  <H2>Rekap</H2>
                  <a href={r.leaderboard} target="_blank" rel="noopener noreferrer" className="mt-3 block overflow-hidden rounded-2xl border border-line">
                    <img src={r.leaderboard} alt="Rekap dan leaderboard sesi live" loading="lazy" className="w-full" />
                  </a>
                </aside>
              )}
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
