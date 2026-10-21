import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Img, LiveTag, PlatformTag, cx } from "@/components/ui";
import { useMemberPhotos } from "@/hooks/use-member-index";
import { dateParts, fmtDate, fmtDuration, fmtNumber, fmtTime, timeAgo } from "@/lib/format";
import { pointLabel, type Birthday, type LiveSession, type Member, type NewsItem, type RecentLive, type TheaterShow, type Video } from "@/lib/jkt48";

/* Kartu foto ─────────────────────────────────────────────────────────── */

export function LiveCard({ l }: { l: LiveSession }) {
  return (
    <a href={l.link} target="_blank" rel="noopener noreferrer" data-reveal className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-surface">
        <Img src={l.img} alt={l.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        <div className="absolute left-2 top-2">
          <LiveTag />
        </div>
      </div>
      <p className="mt-2 truncate font-semibold group-hover:text-brand">{l.fullname || l.name}</p>
      <p className="num mt-0.5 truncate text-[13px] text-ink-soft">
        {l.platform === "idn" ? "IDN" : "Showroom"}
        {l.startedAt && ` · sejak ${fmtTime(l.startedAt)}`}
      </p>
      {l.title && <p className="mt-0.5 truncate text-[13px] text-ink-soft">“{l.title}”</p>}
    </a>
  );
}

export function MemberCard({ m }: { m: Member }) {
  return (
    <Link to="/member/$id" params={{ id: m.id }} data-reveal className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-surface">
        <Img src={m.img} alt={m.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        {m.isGraduate && <span className="tag absolute left-2 top-2 bg-ink text-bg">Graduated</span>}
      </div>
      <p className="mt-2 truncate font-semibold leading-tight group-hover:text-brand">{m.name}</p>
      {m.nickname && <p className="mt-0.5 truncate text-[13px] text-ink-soft">{m.nickname}</p>}
    </Link>
  );
}

export function VideoCard({ v }: { v: Video }) {
  return (
    <a href={v.url} target="_blank" rel="noopener noreferrer" data-reveal className="group block">
      <div className="aspect-video overflow-hidden rounded-md bg-surface">
        <Img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
      </div>
      <p className="mt-2 line-clamp-2 font-semibold leading-snug group-hover:text-brand">{v.title}</p>
      <p className="num mt-1 text-[13px] text-ink-soft">
        {v.channel} · {timeAgo(v.date)}
        {v.views != null && ` · ${fmtNumber(v.views)} views`}
      </p>
    </a>
  );
}

/* Baris (daftar/tabel) ──────────────────────────────────────────────── */

const row = "group grid items-center gap-x-4 border-b border-line py-3 transition-colors";

function DateCell({ iso }: { iso: string }) {
  const d = dateParts(iso);
  return (
    <div className="w-12 text-center leading-none">
      <p className="condensed num text-[30px]">{d.day}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase text-ink-soft">
        {d.month} · {d.weekday}
      </p>
    </div>
  );
}

const CATEGORY: Record<string, string> = { exclusive: "Exclusive", general: "Event" };

/**
 * Baris jadwal. Show theater bisa dibuka detailnya; item exclusive/event dari
 * next_schedule tidak punya halaman detail di API, jadi tampil tanpa link.
 * `lineup` menampilkan foto member yang tampil.
 */
export function ShowRow({ s, lineup }: { s: TheaterShow; lineup?: boolean }) {
  const photos = useMemberPhotos();
  const isShow = s.category === "show";
  // Event umum hanya punya tanggal (00:00Z), tanpa jam mulai.
  const hasTime = !/T00:00:00(\.000)?Z$/.test(s.date);
  const cols = lineup ? "grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto]" : "grid-cols-[auto_1fr_auto]";

  const body = (
    <>
      <DateCell iso={s.date} />
      <div className="min-w-0">
        <p className={cx("truncate text-[17px] font-semibold", isShow && "group-hover:text-brand")}>{s.title}</p>
        <p className="num mt-0.5 truncate text-[13px] text-ink-soft">
          {!isShow && <span className="tag mr-1.5 border border-line">{CATEGORY[s.category] ?? s.category}</span>}
          {hasTime && `${fmtTime(s.date)} WIB`}
          {s.team && isShow && ` · ${s.team}`}
          {s.birthday.length > 0 && <span className="text-ink"> · Seitansai {s.birthday.map((b) => b.name).join(", ")}</span>}
        </p>
      </div>
      {lineup && (
        <div className="hidden items-center sm:flex">
          {s.members.slice(0, 6).map((m) => (
            <Img
              key={m.id}
              src={m.img || photos.get(m.id)}
              alt={m.name}
              className="-ml-2 h-7 w-7 rounded-full border-2 border-bg object-cover first:ml-0"
            />
          ))}
          {s.memberCount ? <span className="num ml-2 text-[13px] text-ink-soft">{s.memberCount}</span> : null}
        </div>
      )}
      {isShow ? <ArrowUpRight className="h-4 w-4 text-ink-soft transition group-hover:text-brand" /> : <span className="w-4" />}
    </>
  );

  return isShow ? (
    <Link to="/theater/$id" params={{ id: s.id }} data-reveal className={cx(row, cols, "hover:bg-surface/60")}>
      {body}
    </Link>
  ) : (
    <div data-reveal className={cx(row, cols)}>
      {body}
    </div>
  );
}

const recentCols = "md:grid-cols-[auto_1fr_5rem_6rem_7rem_7rem]";

export function RecentRow({ r }: { r: RecentLive }) {
  return (
    <Link
      to="/recent/$id"
      params={{ id: r.id }}
      data-reveal
      className={cx(row, "grid-cols-[auto_1fr_auto] hover:bg-surface/60", recentCols)}
    >
      <Img src={r.img} alt={r.name} className="h-11 w-11 rounded object-cover" />
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span className="truncate font-semibold group-hover:text-brand">{r.name}</span>
          <PlatformTag platform={r.platform} />
        </p>
        <p className="num mt-0.5 truncate text-[13px] text-ink-soft">
          <span className="md:hidden">
            {fmtDuration(r.durationMs)} · {fmtNumber(r.viewers)} penonton
          </span>
          <span className="hidden md:inline">{r.title}</span>
        </p>
      </div>
      <span className="num hidden text-right text-[14px] md:block">{fmtDuration(r.durationMs)}</span>
      <span className="num hidden text-right text-[14px] md:block">{fmtNumber(r.viewers)}</span>
      <span className="num hidden text-right text-[14px] md:block">
        {fmtNumber(r.points)} <span className="text-[12px] text-ink-soft">{pointLabel(r.pointUnit)}</span>
      </span>
      <span className="num text-right text-[13px] text-ink-soft">{timeAgo(r.end || r.start)}</span>
    </Link>
  );
}

/** Kepala kolom untuk daftar RecentRow (desktop). */
export function RecentHead() {
  return (
    <div className={cx("hidden gap-x-4 border-b border-ink pb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft md:grid", recentCols)}>
      <span className="w-11" />
      <span>Member</span>
      <span className="text-right">Durasi</span>
      <span className="text-right">Penonton</span>
      <span className="text-right">Gift</span>
      <span className="text-right">Selesai</span>
    </div>
  );
}

export function NewsRow({ n }: { n: NewsItem }) {
  return (
    <Link to="/news/$id" params={{ id: n.id }} data-reveal className={cx(row, "grid-cols-[1fr_auto] hover:bg-surface/60 sm:grid-cols-[6.5rem_1fr_auto]")}>
      <span className="num hidden text-[13px] text-ink-soft sm:block">{fmtDate(n.date, { day: "numeric", month: "short", year: "numeric" })}</span>
      <div className="min-w-0">
        <p className="font-semibold leading-snug group-hover:text-brand">{n.title}</p>
        <p className="num mt-0.5 text-[13px] text-ink-soft">
          {n.category}
          <span className="sm:hidden"> · {fmtDate(n.date, { day: "numeric", month: "short" })}</span>
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-ink-soft transition group-hover:text-brand" />
    </Link>
  );
}

export function daysUntil(d: Date) {
  return Math.round((d.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
}

export function BirthdayRow({ b }: { b: Birthday }) {
  const days = daysUntil(b.next);
  return (
    <div data-reveal className={cx(row, "grid-cols-[auto_1fr_auto]")}>
      <Img src={b.img} alt={b.name} className="h-11 w-11 rounded object-cover object-top" />
      <div className="min-w-0">
        <p className="truncate font-semibold">{b.name}</p>
        <p className="num mt-0.5 text-[13px] text-ink-soft">
          {b.next.toLocaleDateString("id-ID", { day: "numeric", month: "long" })} · {b.age} tahun
        </p>
      </div>
      <span className={cx("num text-[14px] font-semibold", days === 0 ? "text-brand" : "text-ink-soft")}>
        {days === 0 ? "Hari ini" : days === 1 ? "Besok" : `${days} hari`}
      </span>
    </div>
  );
}
