import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Radio, User } from "lucide-react";
import { useMemo, useState } from "react";
import { LiveCard } from "@/components/cards";
import { LiveChat } from "@/components/live-chat";
import { Player } from "@/components/player";
import { Empty, ErrorState, Img, PageHeader, PixelCross, PlatformTag, SectionHead, SkeletonGrid, cx, useNow } from "@/components/ui";
import { bridge, openExternal } from "@/lib/bridge";
import { platformLabel, q } from "@/lib/data";
import { fmtTime } from "@/lib/format";
import { Link } from "@/lib/router";

export function LivePage() {
  const live = useQuery(q.live());
  const list = live.data ?? [];
  const [filter, setFilter] = useState<"all" | "showroom" | "idn">("all");
  const shown = filter === "all" ? list : list.filter((l) => l.platform === filter);
  return (
    <div>
      <PageHeader
        label="Diperbarui otomatis"
        title="Live"
        count={list.length}
        desc="Member yang sedang live di Showroom dan IDN Live. Showroom ditonton langsung di aplikasi; IDN dibuka di IDN Live."
        aside={
          <div className="flex rounded-full border border-line bg-card p-1">
            {(["all", "showroom", "idn"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cx("rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors", filter === f ? "bg-ink text-bg" : "text-ink-soft hover:text-ink")}
              >
                {f === "all" ? "Semua" : platformLabel(f)}
              </button>
            ))}
          </div>
        }
      />
      {live.isError && !live.data ? (
        <ErrorState error={live.error} onRetry={() => live.refetch()} />
      ) : live.isPending ? (
        <SkeletonGrid count={8} className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4" item="aspect-[4/5]" />
      ) : shown.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((l, i) => (
            <div key={l.id} className="rise" style={{ animationDelay: `${i * 40}ms` }}>
              <LiveCard l={l} />
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Belum ada yang live" icon={<Radio className="h-10 w-10 text-brand" />}>
          Daftar ini diperbarui otomatis. Aktifkan notifikasi (ikon lonceng di atas) supaya tahu begitu ada member yang mulai live.
        </Empty>
      )}
    </div>
  );
}

export function WatchPage({ id }: { id: string }) {
  const live = useQuery(q.live());
  const members = useQuery(q.members());
  const now = useNow(30_000);
  const l = live.data?.find((x) => x.id === id);
  const member = useMemo(() => {
    if (!l) return undefined;
    const n = l.name.toLowerCase();
    return members.data?.find((m) => m.nickname.toLowerCase() === n || m.name.toLowerCase() === n || m.name.toLowerCase() === l.fullname.toLowerCase());
  }, [l, members.data]);
  // Live Showroom selalu diputar di aplikasi: bila daftar live belum membawa URL stream, ambil dari Showroom lewat main.
  const roomId = l?.roomId || (l?.platform === "showroom" ? (/^sr-(\d{1,12})-/.exec(l.id)?.[1] ?? "") : "");
  const fallback = useQuery({
    queryKey: ["sr-streams", roomId],
    queryFn: () => bridge.showroomStreams(roomId),
    enabled: !!l && l.platform === "showroom" && !l.streams.length && !!roomId,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data?.length ? false : 15_000),
  });

  if (live.isPending) return <SkeletonGrid count={1} className="" item="aspect-video" />;
  if (!l) {
    return (
      <Empty title="Live sudah selesai" icon={<Radio className="h-10 w-10 text-ink-soft" />}>
        Siaran ini tidak lagi berlangsung. Rekap dan replay-nya akan muncul di halaman{" "}
        <Link to="/recent" className="font-semibold text-brand underline">
          Recent
        </Link>
        .
      </Empty>
    );
  }
  const others = (live.data ?? []).filter((x) => x.id !== id);
  const streams = l.streams.length ? l.streams : (fallback.data ?? []);
  const preparing = l.platform === "showroom" && !streams.length;
  const mins = Math.max(0, Math.round((now - Date.parse(l.startedAt)) / 60000));

  return (
    <div className="space-y-10">
      <div className={cx("grid gap-6", roomId && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
        <div className="min-w-0">
          {streams.length ? (
            <Player
              key={l.id}
              sources={streams.map((s) => ({
                label: s.label || `${s.quality}p`,
                url: s.url,
              }))}
              poster={l.banner || undefined}
              live
              title={l.fullname || l.name}
              subtitle={l.title}
            />
          ) : preparing ? (
            <div className="relative overflow-hidden rounded-[26px] bg-[#0f0a0c] text-white">
              <Img src={l.banner || l.img} className="absolute inset-0 h-full w-full opacity-30 blur-md" />
              <div className="relative flex aspect-video flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="relative grid h-20 w-20 place-items-center">
                  <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-[#ff3b52]" />
                  <PixelCross className="h-8 w-8 animate-pulse" cell="fill-white/90" />
                </div>
                <p className="condensed text-[34px] uppercase leading-none">Menyiapkan siaran {l.name}…</p>
                <p className="max-w-md text-[14px] text-white/65">Stream Showroom sedang diambil dan akan diputar langsung di sini. Dicoba ulang otomatis.</p>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[22px] bg-nav text-white">
              <Img src={l.banner || l.img} className="absolute inset-0 h-full w-full opacity-40 blur-sm" />
              <div className="relative flex aspect-video flex-col items-center justify-center gap-4 p-8 text-center">
                <Img src={l.avatar || l.img} className="h-28 w-28 rounded-full object-top shadow-[0_0_0_4px_#141012,0_0_0_7px_#ff3b52]" />
                <p className="condensed text-[40px] uppercase leading-none">{l.name} sedang live</p>
                <p className="max-w-md text-white/70">Live {platformLabel(l.platform)} hanya bisa ditonton di aplikasi atau situs resminya.</p>
                <button type="button" className="btn btn-primary mt-2" onClick={() => openExternal(l.link)}>
                  Tonton di {platformLabel(l.platform)} <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <PlatformTag platform={l.platform} />
                <span className="font-mono text-[12px] text-ink-soft">
                  sejak {fmtTime(l.startedAt)} WIB · {mins < 60 ? `${mins} menit` : `${Math.floor(mins / 60)} jam ${mins % 60} menit`}
                </span>
              </div>
              <h1 className="condensed mt-2 text-[44px] uppercase leading-[0.9]">{l.fullname || l.name}</h1>
              {l.title && <p className="selectable mt-2 text-[16px] text-ink-soft">“{l.title}”</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {member && (
                <Link to={`/member/${encodeURIComponent(member.id)}`} className="btn btn-ghost">
                  <User className="h-4 w-4" /> Profil
                </Link>
              )}
              {l.platform !== "showroom" && (
                <button type="button" className="btn btn-ghost" onClick={() => openExternal(l.link)}>
                  Buka di {platformLabel(l.platform)} <ExternalLink className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        {roomId && <LiveChat room={roomId} className="h-[520px] xl:sticky xl:top-2 xl:h-[min(78vh,760px)]" />}
      </div>
      {others.length > 0 && (
        <section>
          <SectionHead title="Live lainnya" count={others.length} />
          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
            {others.map((o) => (
              <Link key={o.id} to={`/watch/${encodeURIComponent(o.id)}`} className="lift panel flex items-center gap-3 p-3">
                <Img src={o.avatar || o.img} className="h-14 w-14 rounded-[14px] object-top" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{o.name}</p>
                  <p className="truncate text-[12px] text-ink-soft">{o.title || platformLabel(o.platform)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
