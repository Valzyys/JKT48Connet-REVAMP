import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/back-link";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { ShowRow } from "@/components/cards";
import { Page } from "@/components/page";
import { ErrorState, Img, Skeleton } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { q } from "@/lib/queries";

function Fact({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2.5 text-[15px] first:border-t-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="num text-right font-semibold">{value}</dd>
    </div>
  );
}

export function MemberDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const member = useQuery(q.member(id));
  const m = member.data;
  useDocumentTitle(m ? `${m.nickname && m.nickname !== m.name ? `${m.name} (${m.nickname})` : m.name} — Profil Member JKT48` : undefined, m ? `Profil ${m.fullname || m.name} JKT48: jadwal theater, live IDN & Showroom terbaru, dan sosial media.` : undefined);

  return (
    <Page deps={[m]}>
      <div className="container-x pt-6">
        <BackLink to="/member" label="Semua member" />

        {member.isError ? (
          <div className="pt-8">
            <ErrorState error={member.error} onRetry={() => member.refetch()} />
          </div>
        ) : !m ? (
          <div className="grid gap-10 pt-8 md:grid-cols-[320px_1fr]">
            <Skeleton className="aspect-[3/4]" />
            <Skeleton className="h-20 w-2/3" />
          </div>
        ) : (
          <div className="grid items-start gap-x-12 gap-y-8 pt-6 md:grid-cols-[320px_minmax(0,1fr)]">
            <div data-reveal className="overflow-hidden rounded-2xl bg-surface md:sticky md:top-20">
              <Img src={m.img} alt={m.name} eager className="aspect-[3/4] w-full object-cover" />
            </div>

            <div className="min-w-0">
              <div data-reveal className="border-b-2 border-brand pb-4">
                {m.nickname && <p className="micro text-brand">{m.nickname} · JKT48</p>}
                <h1 className="condensed mt-1 text-[clamp(2.75rem,8vw,5.5rem)] uppercase leading-[0.85]">{m.fullname || m.name}</h1>
                {m.isGraduate && <p className="mt-2 text-ink-soft">Sudah graduate dari JKT48.</p>}
              </div>

              {m.jikosokai && (
                <p data-reveal className="mt-6 rounded-2xl bg-blush px-5 py-4 text-[17px] font-semibold leading-relaxed">
                  {m.jikosokai}
                </p>
              )}

              <dl data-reveal className="panel mt-6 max-w-md px-5 py-2">
                <Fact label="Tanggal lahir" value={m.birthdate ? fmtDate(m.birthdate) : ""} />
                <Fact label="Golongan darah" value={m.bloodType} />
                <Fact label="Tinggi" value={m.height} />
                {m.totalLive && (m.totalLive.idn > 0 || m.totalLive.showroom > 0) && (
                  <Fact label="Total live tercatat" value={`${m.totalLive.idn} IDN · ${m.totalLive.showroom} Showroom`} />
                )}
              </dl>

              {m.description && (
                <p data-reveal className="mt-6 max-w-2xl whitespace-pre-line leading-relaxed text-ink-soft">
                  {m.description}
                </p>
              )}

              {(m.socials.length > 0 || m.idnUsername) && (
                <div data-reveal className="mt-6 flex flex-wrap gap-2">
                  {m.socials.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !py-2">
                      {s.title || new URL(s.url).hostname}
                    </a>
                  ))}
                  {m.idnUsername && (
                    <a href={`https://www.idn.app/${m.idnUsername}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !py-2">
                      IDN @{m.idnUsername}
                    </a>
                  )}
                </div>
              )}

              {m.upcomingShows.length > 0 && (
                <div className="mt-10">
                  <h2 data-reveal className="condensed text-[28px] uppercase leading-none">Jadwal theater</h2>
                  <div className="panel mt-3 overflow-hidden">
                    {m.upcomingShows.slice(0, 6).map((s) => (
                      <ShowRow key={s.id} s={s} />
                    ))}
                  </div>
                </div>
              )}
              {m.recentShows.length > 0 && (
                <div className="mt-10">
                  <h2 data-reveal className="condensed text-[28px] uppercase leading-none">Theater terakhir</h2>
                  <div className="panel mt-3 overflow-hidden">
                    {m.recentShows.slice(0, 6).map((s) => (
                      <ShowRow key={s.id} s={s} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
