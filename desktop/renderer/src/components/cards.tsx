import { Clock, Eye, Heart, Play, Users } from "lucide-react";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { pointLabel, type LiveSession, type Member, type NewsItem, type RecentLive, type TheaterShow, type Video } from "@/lib/data";
import { dateParts, fmtDate, fmtDuration, fmtNumber, fmtTime, timeAgo } from "@/lib/format";
import { Link } from "@/lib/router";
import { cx, Img, PlatformTag } from "./ui";

export function LiveCard({ l, big }: { l: LiveSession; big?: boolean }) {
  return (
    <Link to={`/watch/${encodeURIComponent(l.id)}`} className="lift group panel relative block overflow-hidden p-0">
      <div className={cx("relative overflow-hidden bg-surface", big ? "aspect-[16/10]" : "aspect-[4/5]")}>
        <Img src={l.banner && big ? l.banner : l.img} className="h-full w-full object-top transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className="pill absolute left-3 top-3 bg-brand text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
        </span>
        <PlatformTag platform={l.platform} className="absolute right-3 top-3" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="condensed text-[26px] uppercase leading-none">{l.name}</p>
          {l.title && <p className="mt-1.5 line-clamp-2 text-[12.5px] text-white/80">{l.title}</p>}
          <p className="mt-2 font-mono text-[11px] text-white/60">sejak {fmtTime(l.startedAt)} WIB</p>
        </div>
        <span className="absolute bottom-4 right-4 grid h-11 w-11 scale-90 place-items-center rounded-full bg-white text-brand opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
          <Play className="h-5 w-5 translate-x-px fill-current" />
        </span>
      </div>
    </Link>
  );
}

export function ShowRow({ s, compact }: { s: TheaterShow; compact?: boolean }) {
  const d = dateParts(s.date);
  const cat = s.category === "exclusive" ? "bg-blush text-brand" : s.category === "event" || s.category === "general" ? "bg-surface text-ink-soft" : "bg-butter text-[#5c3d00]";
  const inner = (
    <>
      <div className="w-14 shrink-0 text-center">
        <p className="num condensed text-[30px] leading-none">{d.day}</p>
        <p className="micro mt-1 text-ink-soft">{d.month}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cx("pill", cat)}>{s.category === "show" ? "Show" : s.category}</span>
          {s.team && <span className="micro truncate text-ink-soft">{s.team}</span>}
        </div>
        <p className="mt-1.5 truncate text-[15.5px] font-bold">{s.title}</p>
        <p className="mt-0.5 font-mono text-[12px] text-ink-soft">
          {d.weekday}, {fmtTime(s.date)} WIB{s.memberCount ? ` · ${s.memberCount} member` : ""}
        </p>
      </div>
      {!compact && s.members.some((m) => m.img) && (
        <div className="hidden shrink-0 -space-x-2.5 xl:flex">
          {s.members.filter((m) => m.img).slice(0, 6).map((m) => (
            <Img key={m.id || m.name} src={m.img} alt={m.name} className="h-9 w-9 rounded-full border-2 border-card object-top" />
          ))}
          {s.members.length > 6 && <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-card bg-surface text-[11px] font-bold">+{s.members.length - 6}</span>}
        </div>
      )}
    </>
  );
  const cls = "flex items-center gap-4 border-t border-line px-5 py-4 first:border-t-0 transition-colors";
  return s.category === "show" || s.members.length ? (
    <Link to={`/theater/${encodeURIComponent(s.id)}`} className={cx(cls, "hover:bg-surface/60")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function RecentCard({ r }: { r: RecentLive }) {
  return (
    <Link to={`/recent/${encodeURIComponent(r.id)}`} className="lift group panel flex gap-4 p-3.5">
      <Img src={r.img} alt={r.name} className="h-[92px] w-[92px] shrink-0 rounded-[16px] object-top" />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-2">
          <PlatformTag platform={r.platform} />
          <span className="truncate font-mono text-[11px] text-ink-soft">{timeAgo(r.end || r.start)}</span>
        </div>
        <p className="condensed mt-1.5 truncate text-[22px] uppercase leading-none">{r.name}</p>
        <p className="mt-1 truncate text-[12.5px] text-ink-soft">{r.title || fmtDate(r.start, { weekday: "long", day: "numeric", month: "long" })}</p>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11.5px] text-ink-soft">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {fmtDuration(r.durationMs)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {fmtNumber(r.viewers)}
          </span>
          {r.points != null && (
            <span className="font-semibold text-brand">
              {fmtNumber(r.points)} {pointLabel(r.pointUnit)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MemberCard({ m }: { m: Member }) {
  const fav = useFavorites().includes(m.id);
  return (
    <div className="group relative">
      <Link to={`/member/${encodeURIComponent(m.id)}`} className="lift panel block overflow-hidden p-0">
        <div className="relative aspect-[3/4] overflow-hidden bg-surface">
          <Img src={m.img} alt={m.name} className="h-full w-full object-top transition-transform duration-500 group-hover:scale-[1.05]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10 text-white">
            <p className="truncate text-[15px] font-bold leading-tight">{m.name}</p>
            {m.isGraduate && <p className="micro mt-1 text-[9.5px] text-white/70">Alumni</p>}
          </div>
        </div>
      </Link>
      <button
        type="button"
        title={fav ? "Hapus dari favorit" : "Jadikan favorit"}
        onClick={() => toggleFavorite(m.id)}
        className={cx(
          "absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full backdrop-blur transition-all",
          fav ? "bg-brand text-white" : "bg-black/30 text-white opacity-0 group-hover:opacity-100",
        )}
      >
        <Heart className={cx("h-4 w-4", fav && "fill-current")} />
      </button>
    </div>
  );
}

export function VideoCard({ v }: { v: Video }) {
  return (
    <Link to={`/video/${encodeURIComponent(v.id)}`} className="lift group panel block overflow-hidden p-0">
      <div className="relative aspect-video overflow-hidden bg-surface">
        <Img src={v.thumbnail} alt={v.title} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]" />
        <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/25">
          <span className="grid h-12 w-12 scale-90 place-items-center rounded-full bg-white/95 text-brand opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
            <Play className="h-5 w-5 translate-x-px fill-current" />
          </span>
        </span>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 text-[14.5px] font-semibold leading-snug">{v.title}</p>
        <p className="mt-2 flex items-center gap-3 font-mono text-[11px] text-ink-soft">
          <span>{timeAgo(v.date)}</span>
          {v.views != null && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {fmtNumber(v.views)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

export function NewsRow({ n }: { n: NewsItem }) {
  const d = dateParts(n.date);
  return (
    <Link to={`/news/${encodeURIComponent(n.id)}`} className="group flex items-center gap-4 border-t border-line px-5 py-4 transition-colors first:border-t-0 hover:bg-surface/60">
      <div className="w-12 shrink-0 text-center">
        <p className="num condensed text-[26px] leading-none">{d.day}</p>
        <p className="micro mt-1 text-[9.5px] text-ink-soft">{d.month}</p>
      </div>
      <div className="min-w-0 flex-1">
        {n.category && <p className="micro text-[9.5px] text-brand">{n.category}</p>}
        <p className="mt-1 line-clamp-2 text-[14.5px] font-semibold leading-snug group-hover:text-brand">{n.title}</p>
      </div>
    </Link>
  );
}
