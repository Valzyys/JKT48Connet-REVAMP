import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/back-link";
import { Countdown } from "@/components/countdown";
import { PixelCross } from "@/components/logo";
import { SplitText, Tilt } from "@/components/motion";
import { Page } from "@/components/page";
import { Empty, ErrorState, Img, Index, SectionHead, Skeleton } from "@/components/ui";
import { useMemberPhotos } from "@/hooks/use-member-index";
import { dateParts, fmtDate, fmtTime } from "@/lib/format";
import type { ShowMember } from "@/lib/jkt48";
import { q } from "@/lib/queries";

function Lineup({ title, people, mark }: { title: string; people: ShowMember[]; mark?: Set<string> }) {
  const photos = useMemberPhotos();
  return (
    <section>
      <SectionHead title={title} count={people.length} />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-4 2xl:grid-cols-6">
        {people.map((m, i) => {
          const special = mark?.has(m.id);
          return (
            <Link key={m.id} to="/member/$id" params={{ id: m.id }} data-reveal className="group block">
              <Tilt className={`relative aspect-[3/4] overflow-hidden rounded-2xl border bg-[#f4f1ee] ${special ? "border-brand ring-2 ring-brand/40" : "border-line"}`}>
                <Img src={m.img || photos.get(m.id)} alt={m.name} className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105" />
                <span className="absolute left-2 top-2">
                  <Index n={i + 1} />
                </span>
              </Tilt>
              <p className="mt-1.5 flex items-baseline justify-between gap-1">
                <span className="truncate text-[14px] font-extrabold group-hover:text-brand">{m.name}</span>
                {special && <span className="micro text-brand">♥</span>}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function TheaterDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const show = useQuery(q.theater(id));
  const s = show.data;
  const upcoming = s?.date ? new Date(s.date).getTime() > Date.now() : false;
  const bday = new Set(s?.birthday.map((b) => b.id));
  const d = s ? dateParts(s.date) : null;

  return (
    <Page deps={[s]}>
      <div className="container-x pt-6">
        <BackLink to="/theater" label="Semua jadwal theater" />

        {show.isError ? (
          <div className="pt-6">
            <ErrorState error={show.error} onRetry={() => show.refetch()} />
          </div>
        ) : !s || !d ? (
          <div className="grid gap-6 pt-6 lg:grid-cols-[360px_1fr]">
            <Skeleton className="h-[420px] rounded-3xl" />
            <Skeleton className="h-[420px] rounded-3xl" />
          </div>
        ) : (
          <div className="space-y-10 pt-6">
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
              {/* Panel merah "your next theater date" */}
              <div data-reveal className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white sm:p-7">
                <PixelCross className="absolute -right-6 -top-6 h-32 w-32 opacity-15" cellClass="fill-white" />
                <p className="micro flex items-center justify-between text-white/80">
                  <span>{upcoming ? "Your next theater date" : "Theater show"}</span>
                  {s.team && <span>Team {s.team}</span>}
                </p>
                <h1 className="condensed mt-6 text-[clamp(2.5rem,6vw,4.25rem)] uppercase leading-[0.86]">
                  <SplitText text={s.title} />
                </h1>
                <div className="mt-8 flex items-end gap-4 border-t border-white/25 pt-5">
                  <span className="condensed text-[72px] leading-[0.8]">{d.day}</span>
                  <div className="pb-1">
                    <p className="micro text-white/80">{fmtDate(s.date, { weekday: "long" })}</p>
                    <p className="micro text-white/80">{fmtDate(s.date, { month: "long", year: "numeric" })}</p>
                    <p className="mt-1 text-[22px] font-extrabold leading-none">{fmtTime(s.date)} <span className="micro">WIB</span></p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 text-[13px]">
                  <div className="rounded-2xl bg-white/12 p-3">
                    <p className="micro text-white/70">Member</p>
                    <p className="condensed mt-1 text-[30px] leading-none">{s.memberCount ?? s.members.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 p-3">
                    <p className="micro text-white/70">{upcoming ? "Mulai dalam" : "Kode show"}</p>
                    {upcoming ? <Countdown target={s.date} className="mt-1 block font-mono text-[15px] font-semibold" /> : <p className="mt-1 font-mono text-[15px] font-semibold">{s.id}</p>}
                  </div>
                </div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="btn mt-5 w-full bg-white text-brand hover:bg-butter">
                    Beli tiket di jkt48.com
                  </a>
                )}
              </div>

              <div className="min-w-0 space-y-6">
                {s.members.length ? <Lineup title="The lineup" people={s.members} mark={bday} /> : <Empty>Lineup belum diumumkan.</Empty>}
                {s.birthday.length > 0 && (
                  <div data-reveal className="flex items-center gap-4 rounded-2xl bg-blush px-5 py-4">
                    <span className="text-[28px] text-brand">✳</span>
                    <div className="min-w-0 flex-1">
                      <p className="micro text-brand">Birthday show</p>
                      <p className="text-[18px] font-extrabold">
                        <span className="text-brand">{s.birthday.map((b) => b.name).join(" & ")}</span>’s special stage.
                      </p>
                    </div>
                    <span className="micro hidden font-semibold text-brand sm:block">Make some noise ♥</span>
                  </div>
                )}
              </div>
            </div>

            {s.graduation.length > 0 && <Lineup title="Graduation" people={s.graduation} />}

            {s.banner && (
              <section data-reveal>
                <SectionHead label="jkt48connect" title="Stage file" />
                <a href={s.banner} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-3xl border border-line">
                  <img src={s.banner} alt={`Desain jadwal ${s.title}`} loading="lazy" className="w-full" />
                </a>
              </section>
            )}

            {s.songs.length > 0 && (
              <section>
                <SectionHead title="Setlist" count={s.songs.length} />
                <ol className="panel grid overflow-hidden sm:grid-cols-2">
                  {s.songs.map((t, i) => (
                    <li key={`${i}-${t}`} data-reveal className="flex gap-3 border-t border-line px-4 py-2.5">
                      <Index n={i + 1} />
                      {t}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {s.recordings.length > 0 && (
              <section>
                <SectionHead title="Rekaman" count={s.recordings.length} />
                <div className="grid gap-4 sm:grid-cols-2">
                  {s.recordings.map((r) => (
                    <a key={r.youtubeUrl} href={r.youtubeUrl} target="_blank" rel="noopener noreferrer" data-reveal className="group block">
                      <div className="aspect-video overflow-hidden rounded-2xl bg-surface">
                        <Img src={r.thumbnail} alt={r.title} className="h-full w-full object-cover" />
                      </div>
                      <p className="mt-2 font-bold group-hover:text-brand">{r.title} · YouTube</p>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
