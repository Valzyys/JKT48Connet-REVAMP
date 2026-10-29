import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Cake, ExternalLink, Music, PlayCircle, Ticket } from "lucide-react";
import { ShowRow } from "@/components/cards";
import { showWhen } from "@/components/shell";
import { Empty, ErrorState, Img, LoadMore, PageHeader, SectionHead, Skeleton, SkeletonGrid, useNow } from "@/components/ui";
import { openExternal } from "@/lib/bridge";
import { q, type ShowMember, type TheaterShow } from "@/lib/data";
import { countdown, dayKey, fmtDate, fmtTime } from "@/lib/format";
import { Link } from "@/lib/router";

function groupByDay(shows: TheaterShow[]) {
  const map = new Map<string, TheaterShow[]>();
  for (const s of shows) {
    const k = dayKey(s.date);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.entries()];
}

export function SchedulePage() {
  const sched = useQuery(q.nextSchedule());
  const list = sched.data ?? [];
  return (
    <div>
      <PageHeader label="Show, event & exclusive" title="Jadwal" count={list.length || undefined} desc="Jadwal JKT48 yang akan datang, dikelompokkan per hari (WIB)." />
      {sched.isError && !sched.data ? (
        <ErrorState error={sched.error} onRetry={() => sched.refetch()} />
      ) : sched.isPending ? (
        <Skeleton className="h-[420px]" />
      ) : list.length ? (
        <div className="space-y-6">
          {groupByDay(list).map(([day, shows], i) => (
            <section key={day} className="rise grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="pt-3">
                <p className="condensed text-[30px] uppercase leading-none">{fmtDate(shows[0].date, { weekday: "long" })}</p>
                <p className="micro mt-2 text-ink-soft">{fmtDate(shows[0].date, { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <div className="panel overflow-hidden">
                {shows.map((s) => (
                  <ShowRow key={s.id + s.date} s={s} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty title="Belum ada jadwal">Jadwal baru akan muncul begitu diumumkan.</Empty>
      )}
    </div>
  );
}

export function TheaterPage() {
  const list = useInfiniteQuery(q.theaterList());
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const now = Date.now();
  const upcoming = items.filter((s) => Date.parse(s.date) > now - 3 * 3600_000).reverse();
  const past = items.filter((s) => Date.parse(s.date) <= now - 3 * 3600_000);
  return (
    <div>
      <PageHeader label="Theater JKT48" title="Theater" count={list.data?.pages[0]?.total} desc="Show theater mendatang dan arsip show sebelumnya, lengkap dengan lineup member." />
      {list.isError && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <SkeletonGrid count={6} className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" item="h-[300px]" />
      ) : (
        <div className="space-y-10">
          {upcoming.length > 0 && (
            <section>
              <SectionHead title="Mendatang" count={upcoming.length} />
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {upcoming.map((s) => (
                  <ShowCard key={s.id} s={s} />
                ))}
              </div>
            </section>
          )}
          <section>
            <SectionHead title="Arsip show" />
            <div className="stagger grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {past.map((s) => (
                <ShowCard key={s.id} s={s} />
              ))}
            </div>
            <LoadMore hasNext={list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} />
          </section>
        </div>
      )}
    </div>
  );
}

function ShowCard({ s }: { s: TheaterShow }) {
  return (
    <Link to={`/theater/${encodeURIComponent(s.id)}`} className="lift group panel block overflow-hidden p-0">
      <div className="relative aspect-[16/9] overflow-hidden bg-surface">
        {s.banner ? (
          <Img src={s.banner} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full items-end bg-[linear-gradient(150deg,var(--brand),#9e1326)] p-5">
            <p className="condensed text-[36px] uppercase leading-[0.9] text-white">{s.title}</p>
          </div>
        )}
        {s.birthday.length > 0 && (
          <span className="pill absolute left-3 top-3 bg-butter text-[#5c3d00]">
            <Cake className="h-3 w-3" /> Seitansai
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="truncate text-[16px] font-bold">{s.title}</p>
        <p className="mt-1 font-mono text-[12px] text-ink-soft">{showWhen(s)} WIB</p>
        {s.members.some((m) => m.img) ? (
          <div className="mt-3 flex -space-x-2">
            {s.members
              .filter((m) => m.img)
              .slice(0, 9)
              .map((m) => (
                <Img key={m.id || m.name} src={m.img} alt={m.name} className="h-8 w-8 rounded-full border-2 border-card object-top" />
              ))}
            {s.members.length > 9 && <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-surface text-[10.5px] font-bold">+{s.members.length - 9}</span>}
          </div>
        ) : s.memberCount ? (
          <p className="micro mt-3 text-ink-soft">{s.memberCount} member tampil</p>
        ) : null}
      </div>
    </Link>
  );
}

function People({ title, people, icon }: { title: string; people: ShowMember[]; icon?: React.ReactNode }) {
  if (!people.length) return null;
  return (
    <section>
      <SectionHead title={title} count={people.length} />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
        {people.map((m) => {
          const card = (
            <>
              <div className="relative aspect-[3/4] overflow-hidden rounded-[16px] bg-surface">
                <Img src={m.img} alt={m.name} className="h-full w-full object-top transition-transform duration-500 group-hover:scale-[1.05]" />
                {icon && <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-butter text-[#5c3d00]">{icon}</span>}
              </div>
              <p className="mt-2 truncate text-center text-[13px] font-semibold">{m.name}</p>
            </>
          );
          return m.id ? (
            <Link key={m.id} to={`/member/${encodeURIComponent(m.id)}`} className="group">
              {card}
            </Link>
          ) : (
            <div key={m.name}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}

export function TheaterDetailPage({ id }: { id: string }) {
  const d = useQuery(q.theater(id));
  const now = useNow(1000);
  if (d.isError && !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  if (!d.data) return <Skeleton className="h-[420px]" />;
  const s = d.data;
  const c = countdown(new Date(s.date), now);
  return (
    <div className="space-y-10">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="self-start overflow-hidden rounded-[28px] shadow-[0_30px_60px_-34px_rgb(29_21_23/0.6)]">
          {s.banner ? <Img src={s.banner} className="aspect-[16/9] w-full" eager /> : <div className="aspect-[16/9] bg-[linear-gradient(150deg,#e1243a,#9e1326)]" />}
        </div>
        <div className="flex flex-col gap-4">
          <div className="panel p-6">
            <p className="micro flex items-center gap-2 text-brand">
              <Ticket className="h-3.5 w-3.5" /> {s.team || "Show theater"}
            </p>
            <h1 className="condensed mt-3 text-[46px] uppercase leading-[0.88]">{s.title}</h1>
            <p className="mt-3 font-mono text-[13px] text-ink-soft">
              {fmtDate(s.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {fmtTime(s.date)} WIB
            </p>
            {c ? (
              <div className="mt-5 grid grid-cols-4 gap-2">
                {[
                  [c.d, "hari"],
                  [c.h, "jam"],
                  [c.m, "mnt"],
                  [c.s, "dtk"],
                ].map(([v, k]) => (
                  <div key={k} className="rounded-[14px] bg-surface py-2.5 text-center">
                    <p className="num condensed text-[28px] leading-none">{String(v).padStart(2, "0")}</p>
                    <p className="micro mt-1 text-[9px] text-ink-soft">{k}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="pill mt-4 bg-surface text-ink-soft">Show sudah berlangsung</p>
            )}
            {s.url && (
              <button type="button" className="btn btn-primary mt-5 w-full" onClick={() => openExternal(s.url)}>
                Lihat di jkt48.com <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
          {s.poster && <Img src={s.poster} className="hidden aspect-[3/4] w-full rounded-[22px] xl:block" fit="cover" />}
        </div>
      </div>

      <People title="Lineup" people={s.members} />
      <People title="Seitansai" people={s.birthday} icon={<Cake className="h-3.5 w-3.5" />} />
      <People title="Graduation" people={s.graduation} />

      {s.songs.length > 0 && (
        <section>
          <SectionHead title="Setlist" count={s.songs.length} />
          <ol className="panel grid gap-x-8 p-5 sm:grid-cols-2 2xl:grid-cols-3">
            {s.songs.map((song, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-line py-2.5">
                <span className="num w-6 font-mono text-[12px] text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                <Music className="h-3.5 w-3.5 text-brand" />
                <span className="truncate font-medium">{song}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {s.recordings.length > 0 && (
        <section>
          <SectionHead title="Rekaman" count={s.recordings.length} />
          <div className="grid gap-4 lg:grid-cols-3">
            {s.recordings.map((r) => (
              <button key={r.youtubeUrl} type="button" onClick={() => openExternal(r.youtubeUrl)} className="lift panel overflow-hidden p-0 text-left">
                <Img src={r.thumbnail} className="aspect-video w-full" />
                <p className="flex items-center gap-2 p-4 text-[14px] font-semibold">
                  <PlayCircle className="h-4 w-4 shrink-0 text-brand" /> <span className="line-clamp-2">{r.title}</span>
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
