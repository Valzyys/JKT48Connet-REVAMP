import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/back-link";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Page } from "@/components/page";
import { Replay } from "@/components/replay";
import { ScreenshotGallery } from "@/components/screenshots";
import { ErrorState, Img, PlatformTag, Skeleton } from "@/components/ui";
import { fmtDate, fmtDuration, fmtNumber, fmtTime } from "@/lib/format";
import { pointLabel } from "@/lib/jkt48";
import type { RecentDetail } from "@/lib/shape";
import { q } from "@/lib/queries";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="condensed mb-3 text-[28px] uppercase leading-none">{children}</h2>;
}

export function RecentDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const recent = useQuery(q.recent(id));
  const r = recent.data;
  useDocumentTitle(r ? `Rekap Live ${r.name}` : undefined);
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

            {r.recordingCount > 0 && (
              <div className="pt-8">
                <Replay
                  recordings={r.recordings}
                  count={r.recordingCount}
                  unlockAt={r.replayUnlockAt}
                  onUnlock={() => recent.refetch()}
                  vertical={r.platform === "idn"}
                  poster={r.screenshots[Math.floor(r.screenshots.length / 2)]?.url}
                />
              </div>
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

                {r.gifters.length > 0 && (
                  <section data-reveal>
                    <H2>Pengirim gift</H2>
                    <ol className="panel overflow-hidden">
                      {r.gifters.slice(0, 20).map((g, i) => (
                        <li key={`${g.name}-${i}`} className="border-t border-line px-4 py-3 first:border-t-0">
                          <div className="grid grid-cols-[1.5rem_auto_1fr_auto] items-center gap-3">
                            <span className="num text-ink-soft">{i + 1}</span>
                            <Img src={g.avatar} alt={g.name} className="h-9 w-9 rounded-full object-cover" />
                            <span className="truncate font-medium">{g.name}</span>
                            <span className="num font-semibold">
                              {fmtNumber(g.total)} <span className="text-[12px] font-normal text-ink-soft">{unit}</span>
                            </span>
                          </div>
                          {g.gifts.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-1.5 pl-[calc(1.5rem+2.25rem+1.5rem)]">
                              {g.gifts.slice(0, 10).map((x) => (
                                <li key={x.name} title={x.name} className="flex items-center gap-1 rounded-full bg-surface py-0.5 pl-1 pr-2">
                                  {x.img ? <img src={x.img} alt={x.name} loading="lazy" className="h-5 w-5 object-contain" /> : <span className="h-5 w-5 rounded-full bg-line" />}
                                  <span className="num text-[12px] text-ink-soft">×{fmtNumber(x.num)}</span>
                                </li>
                              ))}
                              {g.gifts.length > 10 && <li className="num self-center text-[12px] text-ink-soft">+{g.gifts.length - 10} jenis</li>}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ol>
                    {r.giftersMore && <p className="pt-2 text-[13px] text-ink-soft">Menampilkan pengirim yang tercatat; daftar lengkap lebih panjang.</p>}
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
                  <div data-reveal>
                    <ScreenshotGallery shots={r.screenshots} start={r.start} name={r.name} vertical={r.platform === "idn"} />
                  </div>
                )}
              </div>

              {(r.designs.length > 0 || r.chatters.length > 0 || r.gifts.length > 0) && <RecapAside r={r} unit={unit} />}
            </div>
          </>
        )}
      </div>
    </Page>
  );
}

/** Kolom kanan: kartu rekap (pilih desain & format), sorotan gift, dan penonton paling aktif berkomentar. */
function RecapAside({ r, unit }: { r: RecentDetail; unit: string }) {
  const [pick, setPick] = useState(0);
  const [banner, setBanner] = useState(false);
  const d = r.designs[Math.min(pick, r.designs.length - 1)];
  const src = d && (banner && d.banner ? d.banner : d.portrait);
  const top = r.gifts[0];
  const supporter = r.fans[0];
  const senders = Math.max(r.gifters.length, ...r.gifts.map((g) => g.users ?? 0)) || null;
  const chat = r.chatters.slice(0, 8);
  const most = chat[0]?.comments || 1;

  return (
    <aside className="flex min-w-0 flex-col gap-10">
      {d && (
        <section data-reveal>
          <div className="mb-3 flex items-end justify-between gap-3">
            <H2>Rekap</H2>
            <span className="micro pb-3 text-ink-soft">{d.label}</span>
          </div>
          {r.designs.length > 1 && (
            <div role="tablist" aria-label="Desain rekap" className="mb-3 flex gap-1 rounded-full border border-line bg-surface p-1">
              {r.designs.map((x, i) => (
                <button
                  key={x.key}
                  role="tab"
                  aria-selected={x === d}
                  onClick={() => setPick(i)}
                  className={`flex-1 truncate rounded-full px-2 py-1.5 text-[12px] font-semibold transition-colors ${x === d ? "bg-brand text-white" : "text-ink-soft hover:text-ink"}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}
          <a href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-line bg-surface">
            <img
              key={src}
              src={src}
              alt={`Rekap live ${r.name}, desain ${d.label}`}
              loading="lazy"
              className={`w-full ${banner && d.banner ? "aspect-[16/9]" : "aspect-[3/4]"} object-cover`}
            />
          </a>
          <div className="mt-3 flex gap-2">
            {d.banner && (
              <div className="flex flex-1 gap-1 rounded-full border border-line bg-surface p-1">
                {[
                  [false, "Potret"],
                  [true, "Banner"],
                ].map(([v, label]) => (
                  <button
                    key={String(label)}
                    aria-pressed={banner === v}
                    onClick={() => setBanner(v as boolean)}
                    className={`flex-1 rounded-full py-1.5 text-[12px] font-semibold transition-colors ${banner === v ? "bg-ink text-bg" : "text-ink-soft hover:text-ink"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <a href={src} target="_blank" rel="noopener noreferrer" className="btn btn-ghost shrink-0 px-4 py-2 text-[13px]">
              Buka ↗
            </a>
          </div>
        </section>
      )}

      {(top || supporter) && (
        <section data-reveal>
          <H2>Sorotan</H2>
          <div className="panel overflow-hidden">
            {top && (
              <div className="flex items-center gap-4 bg-brand p-4 text-white">
                {top.img ? (
                  <img src={top.img} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-2xl bg-white/15 object-contain p-1.5" />
                ) : (
                  <span className="h-14 w-14 shrink-0 rounded-2xl bg-white/15" />
                )}
                <div className="min-w-0">
                  <p className="micro opacity-75">Gift terbanyak</p>
                  <p className="truncate text-[17px] font-bold">{top.name}</p>
                  <p className="num text-[13px] opacity-85">
                    ×{fmtNumber(top.num)}
                    {top.users != null && ` · ${fmtNumber(top.users)} pengirim`}
                  </p>
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 divide-x divide-line">
              <div className="p-4">
                <dt className="micro text-ink-soft">Jenis gift</dt>
                <dd className="num condensed mt-1 text-[28px] leading-none">{fmtNumber(r.gifts.length || null)}</dd>
              </div>
              <div className="p-4">
                <dt className="micro text-ink-soft">Pengirim</dt>
                <dd className="num condensed mt-1 text-[28px] leading-none">{fmtNumber(senders)}</dd>
              </div>
            </dl>
            {supporter && (
              <div className="flex items-center gap-3 border-t border-line p-4">
                <Img src={supporter.avatar} alt={supporter.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="micro text-brand">Supporter #1</p>
                  <p className="truncate font-semibold">{supporter.name}</p>
                </div>
                <p className="num shrink-0 text-right font-semibold">
                  {fmtNumber(supporter.amount)}
                  <span className="block text-[11px] font-normal text-ink-soft">{unit}</span>
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {chat.length > 0 && (
        <section data-reveal className="lg:sticky lg:top-24">
          <H2>Paling aktif komentar</H2>
          <ol className="panel overflow-hidden">
            {chat.map((c, i) => (
              <li key={`${c.name}-${i}`} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                <Img src={c.avatar} alt={c.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-medium">{c.name}</span>
                    <span className="num shrink-0 text-[12px] text-ink-soft">{fmtNumber(c.comments)}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface">
                    <div className={`h-full rounded-full ${i === 0 ? "bg-brand" : "bg-ink-soft/40"}`} style={{ width: `${Math.max(6, (c.comments / most) * 100)}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {r.comments != null && (
            <p className="pt-2 text-[12px] text-ink-soft">
              Dari {fmtNumber(r.comments)} komentar{r.commenters != null && ` oleh ${fmtNumber(r.commenters)} penonton`}.
            </p>
          )}
        </section>
      )}
    </aside>
  );
}
