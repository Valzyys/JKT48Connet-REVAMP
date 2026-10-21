import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/back-link";
import { Countdown } from "@/components/countdown";
import { Page } from "@/components/page";
import { Empty, ErrorState, Img, Skeleton } from "@/components/ui";
import { useMemberPhotos } from "@/hooks/use-member-index";
import { fmtDate, fmtTime } from "@/lib/format";
import type { ShowMember } from "@/lib/jkt48";
import { q } from "@/lib/queries";

function Lineup({ title, people, note }: { title: string; people: ShowMember[]; note?: (m: ShowMember) => string | undefined }) {
  const photos = useMemberPhotos();
  return (
    <div className="mt-10">
      <h2 data-reveal className="condensed mb-4 border-b border-line pb-2 text-[24px] uppercase leading-none">
        {title} <span className="num text-ink-soft">{people.length}</span>
      </h2>
      <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
        {people.map((m) => (
          <Link key={m.id} to="/member/$id" params={{ id: m.id }} data-reveal className="group block">
            <div className="aspect-[3/4] overflow-hidden rounded-md bg-surface">
              <Img src={m.img || photos.get(m.id)} alt={m.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
            </div>
            <p className="mt-1.5 truncate text-[14px] font-semibold group-hover:text-brand">{m.name}</p>
            {note?.(m) && <p className="text-[12px] font-semibold text-brand">{note(m)}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function TheaterDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const show = useQuery(q.theater(id));
  const s = show.data;
  const upcoming = s?.date ? new Date(s.date).getTime() > Date.now() : false;
  const bday = new Set(s?.birthday.map((b) => b.id));

  return (
    <Page deps={[s]}>
      <div className="container-x pt-20 sm:pt-24">
        <BackLink to="/theater" label="Semua jadwal theater" />

        {show.isError ? (
          <div className="pt-8">
            <ErrorState error={show.error} onRetry={() => show.refetch()} />
          </div>
        ) : !s ? (
          <div className="space-y-4 pt-8">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="aspect-[16/9] w-full" />
          </div>
        ) : (
          <div className="grid gap-x-12 pt-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <div data-reveal className="border-b border-ink pb-4">
                <p className="num text-ink-soft">
                  {fmtDate(s.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {fmtTime(s.date)} WIB
                  {s.team && ` · Team ${s.team}`}
                </p>
                <h1 className="condensed mt-2 text-[clamp(2.5rem,7vw,5rem)] uppercase leading-[0.86]">{s.title}</h1>
              </div>

              {s.members.length ? (
                <Lineup title="Lineup" people={s.members} note={(m) => (bday.has(m.id) ? "Seitansai" : undefined)} />
              ) : (
                <div className="mt-10">
                  <Empty>Lineup belum diumumkan.</Empty>
                </div>
              )}
              {s.graduation.length > 0 && <Lineup title="Graduation" people={s.graduation} />}

              {s.songs.length > 0 && (
                <div className="mt-10">
                  <h2 data-reveal className="condensed mb-2 border-b border-line pb-2 text-[24px] uppercase leading-none">Setlist</h2>
                  <ol className="num columns-1 gap-8 text-[15px] sm:columns-2">
                    {s.songs.map((t, i) => (
                      <li key={`${i}-${t}`} className="flex gap-3 border-b border-line py-2">
                        <span className="w-6 text-ink-soft">{i + 1}</span>
                        {t}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {s.recordings.length > 0 && (
                <div className="mt-10">
                  <h2 data-reveal className="condensed mb-4 border-b border-line pb-2 text-[24px] uppercase leading-none">Rekaman</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {s.recordings.map((r) => (
                      <a key={r.youtubeUrl} href={r.youtubeUrl} target="_blank" rel="noopener noreferrer" data-reveal className="group block">
                        <div className="aspect-video overflow-hidden rounded-md bg-surface">
                          <Img src={r.thumbnail} alt={r.title} className="h-full w-full object-cover" />
                        </div>
                        <p className="mt-2 font-semibold group-hover:text-brand">{r.title} · YouTube</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="mt-10 space-y-5 lg:mt-0 lg:sticky lg:top-20 lg:self-start">
              {s.poster && (
                <a data-reveal href={s.poster} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-line">
                  <img src={s.poster} alt={`Poster jadwal ${s.title}`} loading="lazy" className="w-full" />
                </a>
              )}
              <div data-reveal className="space-y-3 text-[14px]">
                {upcoming && (
                  <p className="flex justify-between border-b border-line pb-3">
                    <span className="text-ink-soft">Mulai dalam</span>
                    <Countdown target={s.date} className="font-semibold" />
                  </p>
                )}
                <p className="flex justify-between border-b border-line pb-3">
                  <span className="text-ink-soft">Kode show</span>
                  <span className="num font-semibold">{s.id}</span>
                </p>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
                    Beli tiket di jkt48.com
                  </a>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </Page>
  );
}
