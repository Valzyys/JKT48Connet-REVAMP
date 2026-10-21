import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Play } from "lucide-react";
import { Tilt } from "@/components/motion";
import { Img, Index, LiveTag, PlatformTag, cx } from "@/components/ui";
import { useMemberPhotos } from "@/hooks/use-member-index";
import { dateParts, fmtDate, fmtDuration, fmtNumber, fmtTime, timeAgo } from "@/lib/format";
import { pointLabel, type Birthday, type LiveSession, type Member, type NewsItem, type RecentLive, type TheaterShow, type Video } from "@/lib/jkt48";

/* Kartu foto ─────────────────────────────────────────────────────────── */

export function LiveCard({ l, n }: { l: LiveSession; n: number }) {
  return (
    <a href={l.link} target="_blank" rel="noopener noreferrer" data-reveal className="group block">
      <Tilt className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface">
        <Img src={l.img} alt={l.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute left-2.5 top-2.5 rounded-md bg-card/90 px-1.5 py-0.5 backdrop-blur">
          <Index n={n} />
        </span>
        <span className="absolute right-2.5 top-2.5">
          <LiveTag />
        </span>
        <div className="absolute inset-x-3 bottom-3 text-white">
          <p className="truncate text-[16px] font-extrabold leading-tight">{l.fullname || l.name}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-white/80">
            {l.platform === "idn" ? "IDN" : "Showroom"} · sejak {fmtTime(l.startedAt)}
          </p>
        </div>
      </Tilt>
      {l.title && <p className="mt-2 truncate text-[13px] text-ink-soft">“{l.title}”</p>}
    </a>
  );
}

export function MemberCard({ m, n }: { m: Member; n?: number }) {
  return (
    <Link to="/member/$id" params={{ id: m.id }} data-reveal className="group block">
      <Tilt className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-[#f4f1ee]">
        <Img src={m.img} alt={m.name} className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105" />
        {n != null && (
          <span className="absolute left-2 top-2">
            <Index n={n} />
          </span>
        )}
        {m.isGraduate && <span className="pill absolute bottom-2 left-2 bg-ink text-bg">Graduated</span>}
      </Tilt>
      <p className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-[15px] font-extrabold leading-tight group-hover:text-brand">{m.nickname || m.name}</span>
        <span className="font-mono text-[9px] text-ink-soft">JKT48</span>
      </p>
      {m.nickname && <p className="truncate text-[12px] text-ink-soft">{m.name}</p>}
    </Link>
  );
}

/** Poster jadwal (desain jkt48connect potret) untuk deretan show theater. */
export function PosterCard({ s }: { s: TheaterShow }) {
  const d = dateParts(s.date);
  return (
    <Link to="/theater/$id" params={{ id: s.id }} data-reveal className="group block w-[200px] shrink-0 snap-start sm:w-[220px]">
      <Tilt className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface shadow-[0_18px_40px_-24px_rgb(0_0_0/0.5)]">
        <Img src={s.poster} alt={s.title} className="h-full w-full object-cover" />
        {!s.poster && (
          <div className="absolute inset-0 flex flex-col justify-end bg-brand p-4 text-white">
            <p className="condensed text-[28px] uppercase leading-[0.9]">{s.title}</p>
          </div>
        )}
      </Tilt>
      <div className="mt-2.5 flex items-start gap-3">
        <div className="text-center leading-none">
          <p className="condensed text-[26px]">{d.day}</p>
          <p className="micro mt-0.5 text-ink-soft">{d.month}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate font-extrabold group-hover:text-brand">{s.title}</p>
          <p className="font-mono text-[11px] text-ink-soft">
            {d.weekday} · {fmtTime(s.date)} · {s.team || "JKT48"}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function VideoCard({ v }: { v: Video }) {
  return (
    <a href={v.url} target="_blank" rel="noopener noreferrer" data-reveal className="group block">
      <Tilt className="relative aspect-video overflow-hidden rounded-2xl bg-surface" max={5}>
        <Img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-brand text-white opacity-0 transition duration-300 group-hover:opacity-100">
          <Play className="h-4 w-4 translate-x-px fill-current" />
        </span>
      </Tilt>
      <p className="mt-2 line-clamp-2 text-[14px] font-bold leading-snug group-hover:text-brand">{v.title}</p>
      <p className="mt-1 font-mono text-[11px] text-ink-soft">
        {v.channel} · {timeAgo(v.date)}
        {v.views != null && ` · ${fmtNumber(v.views)} views`}
      </p>
    </a>
  );
}

/* Baris di dalam panel ──────────────────────────────────────────────── */

const row = "group flex items-center gap-4 border-t border-line px-4 py-3 first:border-t-0 transition-colors";

const CATEGORY: Record<string, { label: string; cls: string }> = {
  exclusive: { label: "Exclusive", cls: "bg-blush text-brand" },
  general: { label: "Event", cls: "bg-surface text-ink-soft" },
};

/**
 * Baris jadwal. Show theater bisa dibuka detailnya; item exclusive/event dari
 * next_schedule tidak punya halaman detail di API, jadi tampil tanpa link.
 */
export function ShowRow({ s, lineup }: { s: TheaterShow; lineup?: boolean }) {
  const photos = useMemberPhotos();
  const isShow = s.category === "show";
  const hasTime = !/T00:00:00(\.000)?Z$/.test(s.date);
  const d = dateParts(s.date);
  const body = (
    <>
      <div className="w-11 shrink-0 text-center leading-none">
        <p className="condensed text-[26px]">{d.day}</p>
        <p className="micro mt-1 text-ink-soft">{d.month}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cx("truncate text-[16px] font-extrabold", isShow && "group-hover:text-brand")}>{s.title}</p>
        <p className="mt-0.5 flex items-center gap-2 truncate font-mono text-[11px] text-ink-soft">
          {!isShow && <span className={cx("pill", CATEGORY[s.category]?.cls)}>{CATEGORY[s.category]?.label ?? s.category}</span>}
          {d.weekday}
          {hasTime && ` · ${fmtTime(s.date)} WIB`}
          {isShow && s.team && ` · ${s.team}`}
        </p>
        {s.birthday.length > 0 && <p className="mt-1 text-[12px] font-semibold text-brand">♥ Seitansai {s.birthday.map((b) => b.name).join(", ")}</p>}
      </div>
      {lineup && s.members.length > 0 && (
        <div className="hidden items-center sm:flex">
          {s.members.slice(0, 6).map((m) => (
            <Img key={m.id} src={m.img || photos.get(m.id)} alt={m.name} className="-ml-2.5 h-8 w-8 rounded-full border-2 border-card object-cover object-top first:ml-0" />
          ))}
          {s.memberCount ? <span className="ml-2 font-mono text-[11px] text-ink-soft">{s.memberCount}</span> : null}
        </div>
      )}
      {isShow && <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-soft transition group-hover:rotate-45 group-hover:text-brand" />}
    </>
  );
  return isShow ? (
    <Link to="/theater/$id" params={{ id: s.id }} data-reveal className={cx(row, "hover:bg-surface/70")}>
      {body}
    </Link>
  ) : (
    <div data-reveal className={row}>
      {body}
    </div>
  );
}

export function RecentRow({ r }: { r: RecentLive }) {
  return (
    <Link to="/recent/$id" params={{ id: r.id }} data-reveal className={cx(row, "hover:bg-surface/70")}>
      <Img src={r.img} alt={r.name} className="h-12 w-12 shrink-0 rounded-xl object-cover object-top" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-extrabold group-hover:text-brand">{r.name}</span>
          <PlatformTag platform={r.platform} />
        </p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-ink-soft">
          {fmtDuration(r.durationMs)} · {fmtNumber(r.viewers)} penonton · {fmtNumber(r.points)} {pointLabel(r.pointUnit)}
        </p>
      </div>
      <span className="hidden shrink-0 font-mono text-[11px] text-ink-soft sm:block">{timeAgo(r.end || r.start)}</span>
    </Link>
  );
}

export function NewsRow({ n }: { n: NewsItem }) {
  return (
    <Link to="/news/$id" params={{ id: n.id }} data-reveal className={cx(row, "items-start hover:bg-surface/70")}>
      <span className="pill mt-0.5 bg-blush text-brand">{n.category}</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug group-hover:text-brand">{n.title}</p>
        <p className="mt-1 font-mono text-[11px] text-ink-soft">{fmtDate(n.date, { day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft transition group-hover:rotate-45 group-hover:text-brand" />
    </Link>
  );
}

export function daysUntil(d: Date) {
  return Math.round((d.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
}

export function BirthdayRow({ b }: { b: Birthday }) {
  const days = daysUntil(b.next);
  return (
    <div data-reveal className={row}>
      <Img src={b.img} alt={b.name} className="h-12 w-12 shrink-0 rounded-xl object-cover object-top" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">{b.name}</p>
        <p className="mt-0.5 font-mono text-[11px] text-ink-soft">
          {b.next.toLocaleDateString("id-ID", { day: "numeric", month: "long" })} · {b.age} tahun
        </p>
      </div>
      <span className={cx("pill", days === 0 ? "bg-brand text-white" : "bg-blush text-brand")}>{days === 0 ? "Hari ini" : days === 1 ? "Besok" : `${days} hari`}</span>
    </div>
  );
}
