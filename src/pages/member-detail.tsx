import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Cake, Droplet, Ruler, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { ShowRow } from "@/components/cards";
import { Page } from "@/components/page";
import { ErrorState, Img, Skeleton } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { q } from "@/lib/queries";

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  if (!value) return null;
  return (
    <div data-reveal className="rounded-3xl border border-line bg-card p-5">
      <div className="flex items-center gap-2 text-ink-soft">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-xl font-bold">{value}</p>
    </div>
  );
}

export function MemberDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const member = useQuery(q.member(id));
  const m = member.data;

  return (
    <Page deps={[m]}>
      <section className="container-x pt-28">
        <BackLink to="/member" label="Semua member" />
      </section>

      {member.isError ? (
        <div className="container-x pt-10">
          <ErrorState error={member.error} onRetry={() => member.refetch()} />
        </div>
      ) : !m ? (
        <div className="container-x grid gap-10 pt-10 md:grid-cols-[minmax(0,420px)_1fr]">
          <Skeleton className="aspect-[4/5] rounded-[36px]" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        </div>
      ) : (
        <>
          <section className="container-x grid items-start gap-10 pt-10 md:grid-cols-[minmax(0,420px)_1fr]">
            <div data-reveal className="relative overflow-hidden rounded-[36px] bg-surface md:sticky md:top-24">
              <Img src={m.img} alt={m.name} eager className="aspect-[4/5] w-full object-cover" />
              {m.isGraduate && <span className="chip absolute left-4 top-4 bg-black/70 text-white">Graduated</span>}
            </div>

            <div className="min-w-0">
              <p data-reveal className="eyebrow">
                {[m.generation && (/^\d+$/.test(m.generation) ? `Generasi ${m.generation}` : m.generation), m.team].filter(Boolean).join(" · ") || "Member JKT48"}
              </p>
              <h1 data-reveal className="mt-4 font-display text-[clamp(2.75rem,8vw,6rem)] font-extrabold leading-[0.9] tracking-[-0.05em]">
                {m.name}
              </h1>
              {(m.nickname || (m.fullname && m.fullname !== m.name)) && (
                <p data-reveal className="mt-4 text-lg text-ink-soft">
                  {m.fullname && m.fullname !== m.name ? m.fullname : ""}
                  {m.nickname && <span className="text-brand"> “{m.nickname}”</span>}
                </p>
              )}

              {m.jikosokai && (
                <blockquote data-reveal className="mt-8 rounded-[28px] bg-brand p-6 text-white sm:p-8">
                  <Sparkles className="h-5 w-5 opacity-70" />
                  <p className="mt-3 font-display text-xl font-bold leading-snug sm:text-2xl">“{m.jikosokai}”</p>
                  <p className="num mt-3 text-[11px] uppercase tracking-[0.2em] text-white/70">Jikoshoukai</p>
                </blockquote>
              )}

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Fact icon={<Cake className="h-4 w-4" />} label="Ulang tahun" value={m.birthdate ? fmtDate(m.birthdate) : ""} />
                <Fact icon={<Droplet className="h-4 w-4" />} label="Gol. darah" value={m.bloodType} />
                <Fact icon={<Ruler className="h-4 w-4" />} label="Tinggi" value={m.height} />
              </div>

              {m.description && (
                <p data-reveal className="mt-8 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">
                  {m.description}
                </p>
              )}

              {m.socials.length > 0 && (
                <div data-reveal className="mt-8 flex flex-wrap gap-2">
                  {m.socials.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !py-2">
                      {s.title || new URL(s.url).hostname} <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              )}

              {m.upcomingShows.length > 0 && (
                <div className="mt-12">
                  <p data-reveal className="eyebrow mb-4">Jadwal theater berikutnya</p>
                  <div className="space-y-3">
                    {m.upcomingShows.slice(0, 5).map((s) => (
                      <ShowRow key={s.id} s={s} />
                    ))}
                  </div>
                </div>
              )}
              {m.recentShows.length > 0 && (
                <div className="mt-12">
                  <p data-reveal className="eyebrow mb-4">Theater terakhir</p>
                  <div className="space-y-3">
                    {m.recentShows.slice(0, 5).map((s) => (
                      <ShowRow key={s.id} s={s} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </Page>
  );
}
