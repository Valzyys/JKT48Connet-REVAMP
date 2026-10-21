import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Clock, Eye, Gift, Play, Users } from "lucide-react";
import type { ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { Page } from "@/components/page";
import { ErrorState, Img, PlatformChip, Skeleton } from "@/components/ui";
import { fmtDate, fmtDuration, fmtNumber, fmtTime } from "@/lib/format";
import { q } from "@/lib/queries";

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div data-reveal className="rounded-3xl border border-line bg-card p-5">
      <div className="flex items-center gap-2 text-ink-soft">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="num mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

/** Ambil beberapa momen (awal, tengah, akhir) dari daftar screenshot, sesuai saran docs. */
function pickMoments(list: string[], n = 6) {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

export function RecentDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const recent = useQuery(q.recent(id));
  const r = recent.data;
  const unit = r?.platform === "idn" ? "Gold" : "Poin";

  return (
    <Page deps={[r]}>
      <section className="container-x pt-28">
        <BackLink to="/recent" label="Semua recent live" />
      </section>

      {recent.isError ? (
        <div className="container-x pt-10">
          <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
        </div>
      ) : !r ? (
        <div className="container-x space-y-4 pt-10">
          <Skeleton className="h-28 w-full rounded-[32px]" />
          <Skeleton className="h-40 w-full rounded-[32px]" />
        </div>
      ) : (
        <>
          <section className="container-x pt-8">
            <div data-reveal className="flex flex-col gap-6 rounded-[36px] border border-line bg-card p-6 sm:flex-row sm:items-center sm:p-8">
              <Img src={r.img} alt={r.name} eager className="h-28 w-28 shrink-0 rounded-[28px] object-cover" />
              <div className="min-w-0 flex-1">
                <PlatformChip platform={r.platform} />
                <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">{r.name}</h1>
                <p className="num mt-2 text-sm text-ink-soft">
                  {fmtDate(r.start, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {fmtTime(r.start)}–{fmtTime(r.end)} WIB
                </p>
                {r.title && <p className="mt-1 text-sm text-ink-soft">“{r.title}”</p>}
              </div>
              {r.replayUrl && (
                <a href={r.replayUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary shrink-0">
                  <Play className="h-4 w-4 fill-current" /> Putar replay
                </a>
              )}
            </div>
          </section>

          <section className="container-x grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<Clock className="h-4 w-4" />} label="Durasi" value={fmtDuration(r.durationMs)} />
            <Stat icon={<Eye className="h-4 w-4" />} label="Penonton" value={fmtNumber(r.viewers)} />
            <Stat icon={<Gift className="h-4 w-4" />} label={unit} value={fmtNumber(r.points)} />
            <Stat icon={<Users className="h-4 w-4" />} label="Supporter" value={fmtNumber(r.supporters)} />
          </section>
          {r.partial && (
            <p className="container-x pt-3 text-xs text-ink-soft">* Data sesi ini parsial — sebagian rekaman atau rincian tidak tercatat.</p>
          )}

          <section className="container-x grid gap-10 pt-12 lg:grid-cols-[1fr_380px]">
            <div className="min-w-0 space-y-12">
              {r.gifts.length > 0 && (
                <div>
                  <p data-reveal className="eyebrow mb-4">Gift terbanyak</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {r.gifts.slice(0, 16).map((g) => (
                      <div key={g.name} data-reveal className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
                        {g.img ? (
                          <img src={g.img} alt={g.name} loading="lazy" className="h-10 w-10 shrink-0 object-contain" />
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface">
                            <Gift className="h-4 w-4 text-ink-soft" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{g.name}</p>
                          <p className="num text-[11px] text-ink-soft">
                            ×{fmtNumber(g.num)}
                            {g.users != null ? ` · ${g.users} pengirim` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.screenshots.length > 0 && (
                <div>
                  <p data-reveal className="eyebrow mb-4">Momen live</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {pickMoments(r.screenshots).map((src) => (
                      <Img key={src} src={src} alt={`Cuplikan live ${r.name}`} className="aspect-video w-full rounded-2xl object-cover" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {r.leaderboard && (
              <aside data-reveal className="lg:sticky lg:top-24 lg:self-start">
                <p className="eyebrow mb-4">Rekap & leaderboard</p>
                <a href={r.leaderboard} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-[28px] border border-line">
                  <img src={r.leaderboard} alt="Rekap dan leaderboard sesi live" loading="lazy" className="w-full transition duration-500 group-hover:scale-[1.02]" />
                </a>
                <a href={r.leaderboard} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
                  Buka gambar penuh <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </aside>
            )}
          </section>
        </>
      )}
    </Page>
  );
}
