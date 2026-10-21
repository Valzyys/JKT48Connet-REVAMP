import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Cake, Clock, Eye, Gift, Play, Users } from "lucide-react";
import { Img, LiveDot, PlatformChip, cx } from "@/components/ui";
import { dateParts, fmtDate, fmtDuration, fmtNumber, fmtTime, timeAgo } from "@/lib/format";
import type { Birthday, EventItem, LiveSession, Member, NewsItem, RecentLive, TheaterShow, Video } from "@/lib/jkt48";

const lift =
  "transition duration-500 [transition-timing-function:cubic-bezier(.2,.8,.2,1)] hover:-translate-y-1";

export function LiveCard({ l }: { l: LiveSession }) {
  return (
    <a
      href={l.link}
      target="_blank"
      rel="noopener noreferrer"
      data-reveal
      className={cx("group relative block overflow-hidden rounded-[28px] bg-surface", lift)}
    >
      <div className="relative aspect-[3/4]">
        <Img src={l.img} alt={l.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="chip bg-brand text-white">
            <LiveDot /> Live
          </span>
          <PlatformChip platform={l.platform} />
        </div>
        <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 scale-75 place-items-center rounded-full bg-white text-brand opacity-0 shadow-xl transition duration-300 group-hover:scale-100 group-hover:opacity-100">
          <Play className="h-5 w-5 translate-x-0.5 fill-current" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="font-display text-xl font-extrabold leading-tight tracking-tight">{l.name}</p>
          {l.title && <p className="mt-1 line-clamp-1 text-xs text-white/70">{l.title}</p>}
          <div className="num mt-2 flex items-center gap-3 text-[11px] text-white/70">
            {l.startedAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {fmtTime(l.startedAt)} WIB
              </span>
            )}
            {l.viewers != null && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> {fmtNumber(l.viewers)}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

export function MemberCard({ m }: { m: Member }) {
  return (
    <Link
      to="/member/$id"
      params={{ id: m.id }}
      data-reveal
      className={cx("group block overflow-hidden rounded-3xl border border-line bg-card", lift, "hover:border-brand/60")}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface">
        <Img src={m.img} alt={m.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" />
        {m.isGraduate && <span className="chip absolute left-3 top-3 bg-black/70 text-white backdrop-blur">Graduated</span>}
      </div>
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="truncate font-display text-[17px] font-bold leading-tight">{m.name}</p>
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            {[m.nickname && `“${m.nickname}”`, m.generation && `Gen ${m.generation.replace(/\D+/g, "") || m.generation}`]
              .filter(Boolean)
              .join(" · ") || "JKT48"}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-soft transition group-hover:rotate-45 group-hover:text-brand" />
      </div>
    </Link>
  );
}

export function ShowCard({ s, featured }: { s: TheaterShow; featured?: boolean }) {
  const d = dateParts(s.date);
  return (
    <Link
      to="/theater/$id"
      params={{ id: s.id }}
      data-reveal
      className={cx("group flex flex-col overflow-hidden rounded-[28px] border border-line bg-card", lift, "hover:border-brand/60")}
    >
      <div className={cx("relative overflow-hidden bg-surface", featured ? "aspect-[16/10]" : "aspect-[16/9]")}>
        <Img src={s.banner || s.poster} alt={s.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        <div className="absolute left-3 top-3 flex flex-col items-center rounded-2xl bg-bg/90 px-3 py-2 text-center backdrop-blur">
          <span className="num text-xl font-semibold leading-none">{d.day}</span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-brand">{d.month}</span>
        </div>
        {s.birthday.length > 0 && (
          <span className="chip absolute right-3 top-3 bg-gold text-black">
            <Cake className="h-3 w-3" /> Seitansai
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          {fmtDate(s.date, { weekday: "long" })} · {fmtTime(s.date)} WIB
        </p>
        <h3 className={cx("mt-2 font-display font-extrabold leading-tight tracking-tight group-hover:text-brand", featured ? "text-3xl" : "text-xl")}>
          {s.title}
        </h3>
        {s.members.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-2">
              {s.members.slice(0, 5).map((m) => (
                <Img key={m.id} src={m.img} alt={m.name} className="h-8 w-8 rounded-full border-2 border-card object-cover" />
              ))}
            </div>
            <span className="text-xs text-ink-soft">{s.members.length} member</span>
          </div>
        )}
        {s.birthday.length > 0 && (
          <p className="mt-3 text-xs text-ink-soft">
            🎂 {s.birthday.map((b) => b.name).join(", ")}
          </p>
        )}
        {!s.members.length && s.memberCount ? (
          <p className="mt-auto pt-4 text-xs text-ink-soft">
            <Users className="mr-1 inline h-3.5 w-3.5" />
            {s.memberCount} member tampil
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/** Baris jadwal ringkas (kalender di kiri). */
export function ShowRow({ s }: { s: TheaterShow }) {
  const d = dateParts(s.date);
  return (
    <Link
      to="/theater/$id"
      params={{ id: s.id }}
      data-reveal
      className="group flex items-center gap-4 rounded-3xl border border-line bg-card p-3 pr-5 transition hover:border-brand/60"
    >
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-surface text-center">
        <div>
          <p className="num text-2xl font-semibold leading-none">{d.day}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-brand">{d.month}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="num text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          {d.weekday} · {fmtTime(s.date)} WIB
        </p>
        <p className="mt-1 truncate font-display text-lg font-bold group-hover:text-brand">{s.title}</p>
        {s.birthday.length > 0 && <p className="truncate text-xs text-ink-soft">🎂 {s.birthday.map((b) => b.name).join(", ")}</p>}
      </div>
      <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-soft transition group-hover:rotate-45 group-hover:text-brand" />
    </Link>
  );
}

export function NewsCard({ n, big }: { n: NewsItem; big?: boolean }) {
  return (
    <Link
      to="/news/$id"
      params={{ id: n.id }}
      data-reveal
      className={cx(
        "group flex flex-col justify-between gap-6 rounded-[28px] border border-line bg-card p-6 transition hover:border-brand/60",
        big && "sm:p-8",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="chip bg-brand-soft text-brand">{n.category}</span>
        <span className="num text-[11px] text-ink-soft">{fmtDate(n.date, { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
      <h3
        className={cx(
          "font-display font-bold leading-snug tracking-tight transition group-hover:text-brand",
          big ? "text-2xl sm:text-3xl" : "line-clamp-3 text-lg",
        )}
      >
        {n.title}
      </h3>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft group-hover:text-ink">
        Baca berita <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:rotate-45" />
      </span>
    </Link>
  );
}

export function RecentCard({ r }: { r: RecentLive }) {
  return (
    <Link
      to="/recent/$id"
      params={{ id: r.id }}
      data-reveal
      className="group flex items-center gap-4 rounded-3xl border border-line bg-card p-3 pr-4 transition hover:border-brand/60"
    >
      <Img src={r.img} alt={r.name} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-display text-[17px] font-bold">{r.name}</p>
          <PlatformChip platform={r.platform} />
        </div>
        <div className="num mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {fmtDuration(r.durationMs)}
          </span>
          {r.viewers != null && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {fmtNumber(r.viewers)}
            </span>
          )}
          {r.points != null && (
            <span className="inline-flex items-center gap-1">
              <Gift className="h-3 w-3" /> {fmtNumber(r.points)}
            </span>
          )}
        </div>
      </div>
      <span className="num hidden shrink-0 text-right text-[11px] text-ink-soft sm:block">{timeAgo(r.end || r.start)}</span>
    </Link>
  );
}

export function BirthdayCard({ b }: { b: Birthday }) {
  const today = b.next.toDateString() === new Date().toDateString();
  const days = Math.max(0, Math.round((b.next.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000));
  return (
    <div data-reveal className={cx("group w-48 shrink-0 snap-start overflow-hidden rounded-3xl border bg-card sm:w-56", today ? "border-gold" : "border-line")}>
      <div className="relative aspect-[4/5] overflow-hidden bg-surface">
        <Img src={b.img} alt={b.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        {today && <span className="chip absolute left-3 top-3 bg-gold text-black">🎂 Hari ini</span>}
        <div className="absolute inset-x-3 bottom-3 text-white">
          <p className="font-display text-lg font-bold leading-tight">{b.name}</p>
          <p className="num mt-0.5 text-[11px] text-white/70">
            {fmtDate(b.birthdate, { day: "numeric", month: "long" })}
            {b.age ? ` · ${b.age} th` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[11px] uppercase tracking-wider text-ink-soft">{today ? "Selamat!" : "Lagi"}</span>
        <span className="num text-sm font-semibold text-brand">{today ? "HBD ♡" : `${days} hari`}</span>
      </div>
    </div>
  );
}

export function VideoCard({ v }: { v: Video }) {
  return (
    <a href={v.url} target="_blank" rel="noopener noreferrer" data-reveal className="group block">
      <div className="relative aspect-video overflow-hidden rounded-3xl bg-surface">
        <Img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" />
        <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/30">
          <span className="grid h-12 w-12 scale-90 place-items-center rounded-full bg-white/95 text-brand opacity-0 transition group-hover:scale-100 group-hover:opacity-100">
            <Play className="h-5 w-5 translate-x-0.5 fill-current" />
          </span>
        </span>
      </div>
      <p className="mt-3 line-clamp-2 font-semibold leading-snug transition group-hover:text-brand">{v.title}</p>
      <p className="num mt-1 text-[11px] text-ink-soft">
        {v.channel} · {timeAgo(v.date)}
      </p>
    </a>
  );
}

export function EventCard({ e }: { e: EventItem }) {
  const d = dateParts(e.date);
  const inner = (
    <>
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand text-center text-white">
        <div>
          <p className="num text-2xl font-semibold leading-none">{d.day}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider">{d.month}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {e.type && <span className="chip bg-gold/20 text-ink">{e.type}</span>}
        <p className="mt-1.5 line-clamp-2 font-display text-lg font-bold leading-snug">{e.title}</p>
      </div>
      {e.url && <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-soft" />}
    </>
  );
  const cls = "flex items-center gap-4 rounded-3xl border border-line bg-card p-3 pr-5 transition hover:border-brand/60";
  return e.url ? (
    <a href={e.url} target="_blank" rel="noopener noreferrer" data-reveal className={cls}>
      {inner}
    </a>
  ) : (
    <div data-reveal className={cls}>
      {inner}
    </div>
  );
}
