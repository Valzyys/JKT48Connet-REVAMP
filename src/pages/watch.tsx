import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/back-link";
import { LiveLink } from "@/components/cards";
import { Page } from "@/components/page";
import { Empty, ErrorState, Img, LiveTag, PlatformTag, Skeleton, cx } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { fmtTime, timeAgo } from "@/lib/format";
import type { LiveSession } from "@/lib/jkt48";
import { q } from "@/lib/queries";

/**
 * Menonton live Showroom langsung di situs (HLS dari CDN Showroom lewat hls.js).
 * Live IDN tidak bisa diputar di sini; tautannya mengarah ke idn.app, bukan ke halaman ini.
 */
export function WatchPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const live = useQuery(q.live());
  const found = live.data?.find((l) => l.id === id);
  // Daftar live diperbarui tiap menit; sesi yang baru saja hilang dari daftar tetap diputar sampai streamnya sendiri berhenti.
  const [session, setSession] = useState<LiveSession | undefined>(found);
  useEffect(() => {
    if (found) setSession(found);
  }, [found]);
  const [quality, setQuality] = useState(0);
  useEffect(() => setQuality(0), [id]);
  const l = found ?? session;
  useDocumentTitle(l ? `Live ${l.fullname || l.name}` : "Live");

  const stream = l?.streams[Math.min(quality, (l?.streams.length ?? 1) - 1)];
  const others = (live.data ?? []).filter((x) => x.id !== id);
  const gone = !!live.data && !found;

  return (
    <Page deps={[l?.id, live.isLoading]}>
      <div className="container-x pt-6">
        <BackLink to="/live" label="Semua live" />

        {live.isError && !l ? (
          <div className="pt-8">
            <ErrorState error={live.error} onRetry={() => live.refetch()} />
          </div>
        ) : !l ? (
          live.isLoading ? (
            <div className="grid gap-6 pt-6 lg:grid-cols-[1fr_320px]">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="pt-8">
              <Empty>
                Siaran ini sudah selesai atau tidak ditemukan.{" "}
                <Link to="/recent" className="font-semibold text-brand underline underline-offset-4">
                  Lihat rekaman di Recent
                </Link>
              </Empty>
            </div>
          )
        ) : !stream ? (
          // Bukan live Showroom (mis. IDN dibuka lewat alamat langsung): arahkan ke platform aslinya.
          <div className="pt-8">
            <Empty>
              Live {l.platform === "idn" ? "IDN" : "ini"} tidak bisa diputar di sini.{" "}
              <a href={l.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline underline-offset-4">
                Tonton di {l.platform === "idn" ? "IDN" : "platform aslinya"}
              </a>
            </Empty>
          </div>
        ) : (
          <div className="grid gap-6 pt-6 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              <VideoPlayer
                key={stream.url}
                src={stream.url}
                hls={stream.url}
                poster={l.banner || undefined}
                live={{ since: l.startedAt, fallback: { href: l.link, label: "Tonton di Showroom" } }}
              />
              {l.streams.length > 1 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="micro text-ink-soft">Kualitas</span>
                  {l.streams.map((s, i) => (
                    <button
                      key={s.url}
                      type="button"
                      onClick={() => setQuality(i)}
                      className={cx("pill transition-colors", i === quality ? "bg-brand text-white" : "bg-surface text-ink hover:bg-blush")}
                    >
                      {qualityLabel(s.label, i)}
                    </button>
                  ))}
                </div>
              )}
              {gone && <p className="mt-3 text-[13px] text-ink-soft">Siaran ini sudah tidak ada di daftar live; pemutaran berhenti saat streamnya berakhir.</p>}
            </div>

            <aside className="space-y-4">
              <div className="panel p-5">
                <div className="flex items-center gap-4">
                  <Img src={l.img || l.avatar} alt={l.name} eager className="h-16 w-16 shrink-0 rounded-2xl object-cover object-top" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <PlatformTag platform={l.platform} />
                      {!gone && <LiveTag />}
                    </p>
                    <h1 className="condensed mt-1 break-words text-[28px] uppercase leading-[0.95]">{l.fullname || l.name}</h1>
                  </div>
                </div>
                {l.title && <p className="mt-4 text-[15px]">“{l.title}”</p>}
                <p className="num mt-3 font-mono text-[12px] text-ink-soft">
                  Mulai {fmtTime(l.startedAt)} WIB · {timeAgo(l.startedAt)}
                </p>
                <a href={l.link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-soft hover:text-brand">
                  Buka di Showroom <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>

              {others.length > 0 && (
                <div className="panel overflow-hidden">
                  <p className="micro border-b border-line px-5 py-3 text-ink-soft">Live lainnya</p>
                  <ul>
                    {others.map((o) => (
                      <li key={o.id} className="border-b border-line last:border-0">
                        <LiveLink l={o} className="flex items-center gap-3 px-5 py-3 hover:bg-surface">
                          <Img src={o.img || o.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover object-top" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{o.fullname || o.name}</span>
                            <span className="block truncate text-[12px] text-ink-soft">
                              {o.platform === "idn" ? "IDN · dibuka di idn.app" : "Showroom · tonton di sini"}
                            </span>
                          </span>
                          {o.streams.length ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-brand" /> : <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-soft" />}
                        </LiveLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </Page>
  );
}

/** "original quality" → "Asli", "Medium quality" → "Sedang", "low quality" → "Rendah". */
function qualityLabel(label: string, i: number) {
  const l = label.toLowerCase();
  if (l.includes("original") || l.includes("high")) return "Asli";
  if (l.includes("medium")) return "Sedang";
  if (l.includes("low")) return "Rendah";
  return label || `Pilihan ${i + 1}`;
}
