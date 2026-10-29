import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Cake, ExternalLink, Heart, MessageCircle, Play, Repeat2, ThumbsUp, Eye } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { NewsRow, VideoCard } from "@/components/cards";
import { Player } from "@/components/player";
import { Empty, ErrorState, Img, LoadMore, PageHeader, SectionHead, Skeleton, SkeletonGrid, cx } from "@/components/ui";
import { openExternal } from "@/lib/bridge";
import { mediaUrl, q, type SocialPlatform, type SocialPost } from "@/lib/data";
import { fmtDate, fmtNumber, timeAgo } from "@/lib/format";
import { Link } from "@/lib/router";

/* ───────────────────────────── Video ───────────────────────────── */

export function VideosPage() {
  const v = useQuery(q.videos());
  return (
    <div>
      <PageHeader label="YouTube JKT48" title="Video" count={v.data?.length} desc="Video terbaru dari kanal YouTube JKT48, diputar langsung di aplikasi." />
      {v.isError && !v.data ? (
        <ErrorState error={v.error} onRetry={() => v.refetch()} />
      ) : v.isPending ? (
        <SkeletonGrid count={9} className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-4" item="aspect-[4/3.4]" />
      ) : (
        <div className="stagger grid gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {(v.data ?? []).map((x) => (
            <VideoCard key={x.id} v={x} />
          ))}
        </div>
      )}
    </div>
  );
}

export function VideoDetailPage({ id }: { id: string }) {
  const v = useQuery(q.video(id));
  const list = useQuery(q.videos());
  const comments = useInfiniteQuery(q.videoComments(id));
  const [more, setMore] = useState(false);
  if (v.isError && !v.data) return <ErrorState error={v.error} onRetry={() => v.refetch()} />;
  if (!v.data) return <Skeleton className="aspect-video" />;
  const x = v.data;
  const items = comments.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="grid gap-8 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        {x.playback ? (
          <Player src={x.playback.url} poster={x.thumbnail} title={x.title} subtitle={x.channel || "JKT48"} />
        ) : (
          <button type="button" onClick={() => openExternal(x.url)} className="group relative block w-full overflow-hidden rounded-[22px] bg-black">
            <Img src={x.thumbnail} className="aspect-video w-full opacity-80" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold text-brand shadow-xl transition-transform group-hover:scale-105">
                <Play className="h-5 w-5 fill-current" /> Tonton di YouTube
              </span>
            </span>
          </button>
        )}
        <h1 className="selectable mt-6 text-[26px] font-extrabold leading-tight">{x.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[12.5px] text-ink-soft">
          <span>{fmtDate(x.date)}</span>
          {x.views != null && (
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> {fmtNumber(x.views)} ditonton
            </span>
          )}
          {x.comments != null && (
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> {fmtNumber(x.comments)} komentar
            </span>
          )}
          <button type="button" className="link-more ml-auto inline-flex items-center gap-1.5" onClick={() => openExternal(x.url)}>
            Buka di YouTube <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
        {x.description && (
          <div className="panel mt-5 p-5">
            <p className={cx("selectable whitespace-pre-line text-[14px] leading-relaxed text-ink-soft", !more && "line-clamp-4")}>{x.description}</p>
            {x.description.length > 240 && (
              <button type="button" className="link-more mt-2" onClick={() => setMore((m) => !m)}>
                {more ? "Ringkas" : "Selengkapnya"}
              </button>
            )}
          </div>
        )}
        <section className="mt-10">
          <SectionHead title="Komentar" count={comments.data?.pages[0]?.total ?? undefined} />
          {comments.isPending ? (
            <Skeleton className="h-40" />
          ) : items.length ? (
            <div className="space-y-5">
              {items.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Img src={c.avatar} className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="min-w-0">
                    <p className="text-[13px]">
                      <span className={cx("font-bold", c.uploader && "rounded-full bg-ink px-2 py-0.5 text-bg")}>{c.author}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-soft">{c.when}</span>
                    </p>
                    <p className="selectable mt-1 whitespace-pre-line text-[14px] leading-relaxed">{c.text}</p>
                    <p className="mt-1.5 flex gap-4 font-mono text-[11px] text-ink-soft">
                      {c.likes != null && (
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" /> {fmtNumber(c.likes)}
                        </span>
                      )}
                      {c.replies ? <span>{c.replies} balasan</span> : null}
                    </p>
                  </div>
                </div>
              ))}
              <LoadMore hasNext={comments.hasNextPage} loading={comments.isFetchingNextPage} onMore={() => comments.fetchNextPage()} />
            </div>
          ) : (
            <p className="panel px-5 py-6 text-[14px] text-ink-soft">Belum ada komentar yang bisa ditampilkan.</p>
          )}
        </section>
      </div>
      <aside>
        <SectionHead title="Video lain" />
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-1">
          {(list.data ?? [])
            .filter((o) => o.id !== id)
            .slice(0, 6)
            .map((o) => (
              <VideoCard key={o.id} v={o} />
            ))}
        </div>
      </aside>
    </div>
  );
}

/* ───────────────────────────── Berita ───────────────────────────── */

export function NewsPage() {
  const list = useInfiniteQuery(q.newsList());
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div>
      <PageHeader label="Dari jkt48.com" title="Berita" count={list.data?.pages[0]?.total} desc="Pengumuman resmi terbaru dari JKT48." />
      {list.isError && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <Skeleton className="h-[480px]" />
      ) : (
        <>
          <div className="panel overflow-hidden">
            {items.map((n) => (
              <NewsRow key={n.id} n={n} />
            ))}
          </div>
          <LoadMore hasNext={list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} />
        </>
      )}
    </div>
  );
}

/** HTML berita jkt48.com: dibersihkan (DOMPurify), gambar lewat proxy aplikasi, tautan dibuka di browser. */
function useNewsHtml(html: string) {
  return useMemo(() => {
    const clean = DOMPurify.sanitize(html, { FORBID_TAGS: ["style", "script", "iframe", "form", "input"], FORBID_ATTR: ["style", "onerror", "onload"] });
    const doc = new DOMParser().parseFromString(clean, "text/html");
    doc.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      try {
        const u = new URL(src, "https://jkt48.com/");
        img.setAttribute("src", /(^|\.)jkt48\.com$/.test(u.hostname) ? mediaUrl(u.href) : u.protocol === "https:" ? u.href : "");
        img.setAttribute("loading", "lazy");
        img.setAttribute("referrerpolicy", "no-referrer");
      } catch {
        img.remove();
      }
    });
    doc.querySelectorAll("a").forEach((a) => {
      try {
        a.setAttribute("href", new URL(a.getAttribute("href") || "", "https://jkt48.com/").href);
      } catch {
        a.removeAttribute("href");
      }
    });
    return doc.body.innerHTML;
  }, [html]);
}

export function NewsDetailPage({ id }: { id: string }) {
  const d = useQuery(q.news(id));
  const html = useNewsHtml(d.data?.content ?? "");
  if (d.isError && !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  if (!d.data) return <Skeleton className="h-[480px]" />;
  const n = d.data;
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (a?.href) {
      e.preventDefault();
      openExternal(a.href);
    }
  };
  return (
    <article className="mx-auto max-w-[820px]">
      {n.category && <p className="micro text-brand">{n.category}</p>}
      <h1 className="selectable mt-3 text-[clamp(2rem,3.4vw,2.8rem)] font-extrabold leading-[1.08] tracking-tight">{n.title}</h1>
      <p className="mt-3 font-mono text-[12.5px] text-ink-soft">{fmtDate(n.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      <div className="panel mt-8 p-8">
        {html.trim() ? <div className="prose-body" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-ink-soft">Isi berita tidak tersedia. Buka di jkt48.com untuk membaca selengkapnya.</p>}
      </div>
      {n.url && (
        <button type="button" className="btn btn-primary mt-6" onClick={() => openExternal(n.url)}>
          Buka di jkt48.com <ExternalLink className="h-4 w-4" />
        </button>
      )}
    </article>
  );
}

/* ───────────────────────────── Ulang tahun ───────────────────────────── */

export function BirthdaysPage() {
  const b = useQuery(q.birthdays());
  const today = new Date(new Date().toDateString()).getTime();
  return (
    <div>
      <PageHeader label="Seitansai" title="Ulang tahun" count={b.data?.length} desc="Ulang tahun member terdekat (tanggal WIB)." />
      {b.isError && !b.data ? (
        <ErrorState error={b.error} onRetry={() => b.refetch()} />
      ) : b.isPending ? (
        <SkeletonGrid count={8} className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" item="h-[110px]" />
      ) : (
        <div className="stagger grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {(b.data ?? []).map((x, i) => {
            const days = Math.round((x.next.getTime() - today) / 86400_000);
            return (
              <Link key={x.id} to={`/member/${encodeURIComponent(x.id)}`} className={cx("lift panel rise flex items-center gap-4 p-4", days === 0 && "border-brand bg-blush")} >
                <Img src={x.img} className={cx("h-[76px] w-[76px] shrink-0 rounded-full object-top", days === 0 && "shadow-[0_0_0_3px_var(--card),0_0_0_6px_var(--brand)]")} />
                <div className="min-w-0 flex-1" style={{ animationDelay: `${i * 30}ms` }}>
                  <p className="truncate text-[18px] font-extrabold">{x.name}</p>
                  <p className="mt-1 font-mono text-[12px] text-ink-soft">
                    {fmtDate(x.next.toISOString(), { weekday: "long", day: "numeric", month: "long" })} · {x.age} tahun
                  </p>
                </div>
                {days === 0 ? (
                  <span className="flex flex-col items-center text-brand">
                    <Cake className="h-7 w-7" />
                    <span className="micro mt-1 text-[9.5px]">Hari ini</span>
                  </span>
                ) : (
                  <span className="text-center">
                    <span className="num condensed block text-[34px] leading-none">{days}</span>
                    <span className="micro text-[9.5px] text-ink-soft">hari lagi</span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Sosmed ───────────────────────────── */

const PLATFORMS: [SocialPlatform, string][] = [
  ["x", "X"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
];

export function SocialPage() {
  const [platform, setPlatform] = useState<SocialPlatform>("x");
  const feed = useInfiniteQuery(q.social(platform, ""));
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div>
      <PageHeader
        label="Postingan member"
        title="Sosmed"
        desc="Postingan terbaru member di X, Instagram, dan TikTok."
        aside={
          <div className="flex rounded-full border border-line bg-card p-1">
            {PLATFORMS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setPlatform(k)} className={cx("rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors", platform === k ? "bg-ink text-bg" : "text-ink-soft hover:text-ink")}>
                {label}
              </button>
            ))}
          </div>
        }
      />
      {feed.isError && !feed.data ? (
        <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
      ) : feed.isPending ? (
        <SkeletonGrid count={6} className="columns-1 gap-4 lg:columns-2 2xl:columns-3 [&>*]:mb-4" item="h-[260px]" />
      ) : items.length ? (
        <>
          <div className="columns-1 gap-4 lg:columns-2 2xl:columns-3 [&>*]:mb-4">
            {items.map((p) => (
              <Post key={`${p.platform}-${p.id}`} p={p} />
            ))}
          </div>
          <LoadMore hasNext={feed.hasNextPage} loading={feed.isFetchingNextPage} onMore={() => feed.fetchNextPage()} />
        </>
      ) : (
        <Empty title="Belum ada postingan" />
      )}
    </div>
  );
}

function Post({ p }: { p: SocialPost }) {
  const m = p.media[0];
  return (
    <article className="panel break-inside-avoid overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Img src={p.member.img || p.author.avatar} className="h-10 w-10 rounded-full object-top" />
        <div className="min-w-0 flex-1">
          {p.member.id ? (
            <Link to={`/member/${encodeURIComponent(p.member.id)}`} className="block truncate font-bold hover:text-brand">
              {p.member.name || p.author.name}
            </Link>
          ) : (
            <p className="truncate font-bold">{p.author.name}</p>
          )}
          <p className="truncate font-mono text-[11px] text-ink-soft">
            @{p.author.username} · {p.dateApprox ? "±" : ""}
            {timeAgo(p.date)}
          </p>
        </div>
        <button type="button" title="Buka postingan" className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface hover:text-ink" onClick={() => openExternal(p.url)}>
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
      {p.text && <p className="selectable whitespace-pre-line px-4 pb-3 text-[14px] leading-relaxed">{p.text}</p>}
      {m &&
        (m.type === "video" ? (
          <video src={m.url} poster={m.thumb || undefined} controls preload="none" className="max-h-[560px] w-full bg-black" />
        ) : (
          <button type="button" onClick={() => openExternal(p.url)} className="block w-full">
            <Img src={m.url || m.thumb} className="max-h-[560px] w-full" />
          </button>
        ))}
      <div className="flex gap-5 px-4 py-3 font-mono text-[11.5px] text-ink-soft">
        {p.likes != null && (
          <span className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" /> {fmtNumber(p.likes)}
          </span>
        )}
        {p.comments != null && (
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" /> {fmtNumber(p.comments)}
          </span>
        )}
        {p.reposts != null && (
          <span className="flex items-center gap-1.5">
            <Repeat2 className="h-3.5 w-3.5" /> {fmtNumber(p.reposts)}
          </span>
        )}
        {p.views != null && (
          <span className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> {fmtNumber(p.views)}
          </span>
        )}
      </div>
    </article>
  );
}
