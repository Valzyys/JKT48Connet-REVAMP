import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Lock, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RecentCard } from "@/components/cards";
import { Player } from "@/components/player";
import { ErrorState, Img, LoadMore, PageHeader, PlatformTag, SectionHead, Skeleton, SkeletonGrid, Stat, cx, useNow } from "@/components/ui";
import { openExternal } from "@/lib/bridge";
import { platformLabel, pointLabel, q, type RecentDetail } from "@/lib/data";
import { countdown, fmtDate, fmtDuration, fmtNumber, fmtTime } from "@/lib/format";
import { Link } from "@/lib/router";

export function RecentPage() {
  const list = useInfiniteQuery(q.recentList());
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const [filter, setFilter] = useState<"all" | "showroom" | "idn">("all");
  const shown = filter === "all" ? items : items.filter((r) => r.platform === filter);
  return (
    <div>
      <PageHeader
        label="Gift · supporter · replay"
        title="Recent"
        count={list.data?.pages[0]?.total}
        desc="Rekap live member yang sudah selesai: statistik, top supporter, gift, dan replay."
        aside={
          <div className="flex rounded-full border border-line bg-card p-1">
            {(["all", "showroom", "idn"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={cx("rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors", filter === f ? "bg-ink text-bg" : "text-ink-soft hover:text-ink")}>
                {f === "all" ? "Semua" : platformLabel(f)}
              </button>
            ))}
          </div>
        }
      />
      {list.isError && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <SkeletonGrid count={9} className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3" item="h-[120px]" />
      ) : (
        <>
          <div className="stagger grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {shown.map((r) => (
              <RecentCard key={r.id} r={r} />
            ))}
          </div>
          <LoadMore hasNext={list.hasNextPage} loading={list.isFetchingNextPage} onMore={() => list.fetchNextPage()} />
        </>
      )}
    </div>
  );
}

export function RecentDetailPage({ id }: { id: string }) {
  const d = useQuery(q.recent(id));
  if (d.isError && !d.data) return <ErrorState error={d.error} onRetry={() => d.refetch()} />;
  if (!d.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="aspect-video" />
      </div>
    );
  }
  const r = d.data;
  const unit = pointLabel(r.pointUnit);
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end gap-5 border-b-2 border-brand pb-6">
        <Img src={r.img} alt={r.name} eager className="h-24 w-24 rounded-[22px] object-top" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-ink-soft">
            <PlatformTag platform={r.platform} />
            <span className="num font-mono text-[12.5px]">
              {fmtDate(r.start, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {fmtTime(r.start)}–{fmtTime(r.end)} WIB
            </span>
          </p>
          <h1 className="condensed mt-2 text-[clamp(2.6rem,5vw,4.4rem)] uppercase leading-[0.86]">
            {r.memberId ? (
              <Link to={`/member/${encodeURIComponent(r.memberId)}`} className="hover:text-brand">
                {r.name}
              </Link>
            ) : (
              r.name
            )}
          </h1>
          {r.title && <p className="selectable mt-1.5 text-ink-soft">“{r.title}”</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat k="Durasi" v={fmtDuration(r.durationMs)} accent />
        <Stat k="Penonton" v={fmtNumber(r.viewers)} />
        <Stat k={unit} v={fmtNumber(r.points)} />
        <Stat k="Komentar" v={fmtNumber(r.comments)} />
        <Stat k="Pemberi komentar" v={fmtNumber(r.commenters)} />
      </div>
      {(r.recordingPartial || r.giftsPartial) && (
        <p className="-mt-6 text-[13px] text-ink-soft">
          Data parsial: {[r.recordingPartial && "sebagian rekaman tidak tercatat", r.giftsPartial && "rincian gift hanya dari event yang teramati"].filter(Boolean).join("; ")}.
        </p>
      )}

      {r.recordingCount > 0 && <Replay r={r} />}

      <div className="grid gap-x-10 gap-y-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          {r.fans.length > 0 && (
            <section>
              <SectionHead title="Top supporter" />
              <ol className="panel overflow-hidden">
                {r.fans.slice(0, 10).map((f, i) => (
                  <li key={`${f.name}-${i}`} className="grid grid-cols-[1.75rem_auto_1fr_auto] items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                    <span className={cx("num font-mono text-[13px]", i < 3 ? "font-bold text-brand" : "text-ink-soft")}>{i + 1}</span>
                    <Img src={f.avatar} alt={f.name} className="h-9 w-9 rounded-full" />
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="num font-semibold">
                      {fmtNumber(f.amount)} <span className="text-[12px] font-normal text-ink-soft">{unit}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {r.gifters.length > 0 && (
            <section>
              <SectionHead title="Pengirim gift" count={r.gifters.length} />
              <ol className="panel overflow-hidden">
                {r.gifters.slice(0, 20).map((g, i) => (
                  <li key={`${g.name}-${i}`} className="border-t border-line px-4 py-3 first:border-t-0">
                    <div className="grid grid-cols-[1.75rem_auto_1fr_auto] items-center gap-3">
                      <span className="num font-mono text-[13px] text-ink-soft">{i + 1}</span>
                      <Img src={g.avatar} alt={g.name} className="h-9 w-9 rounded-full" />
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="num font-semibold">
                        {fmtNumber(g.total)} <span className="text-[12px] font-normal text-ink-soft">{unit}</span>
                      </span>
                    </div>
                    {g.gifts.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5 pl-[calc(1.75rem+2.25rem+1.5rem)]">
                        {g.gifts.slice(0, 12).map((x) => (
                          <li key={x.name} title={x.name} className="flex items-center gap-1 rounded-full bg-surface py-0.5 pl-1 pr-2">
                            {x.img ? <img src={x.img} alt={x.name} loading="lazy" className="h-5 w-5 object-contain" /> : <span className="h-5 w-5 rounded-full bg-line" />}
                            <span className="num font-mono text-[11.5px] text-ink-soft">×{fmtNumber(x.num)}</span>
                          </li>
                        ))}
                        {g.gifts.length > 12 && <li className="num self-center font-mono text-[11.5px] text-ink-soft">+{g.gifts.length - 12} jenis</li>}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              {r.giftersMore && <p className="pt-2 text-[13px] text-ink-soft">Menampilkan pengirim yang tercatat; daftar lengkap lebih panjang.</p>}
            </section>
          )}

          {r.gifts.length > 0 && (
            <section>
              <SectionHead title="Gift" count={r.gifts.length} />
              <div className="panel grid grid-cols-2 overflow-hidden sm:grid-cols-3 2xl:grid-cols-4">
                {r.gifts.slice(0, 16).map((g) => (
                  <div key={g.name} className="flex items-center gap-3 border-t border-line px-4 py-3">
                    {g.img ? <img src={g.img} alt="" loading="lazy" className="h-10 w-10 shrink-0 object-contain" /> : <span className="h-10 w-10 shrink-0 rounded bg-surface" />}
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{g.name}</p>
                      <p className="num font-mono text-[11.5px] text-ink-soft">
                        ×{fmtNumber(g.num)}
                        {g.users != null && ` · ${g.users} pengirim`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {r.screenshots.length > 0 && <Shots r={r} />}
        </div>

        <RecapAside r={r} unit={unit} />
      </div>
    </div>
  );
}

/** Replay: Showroom langsung; IDN terkunci sampai `replayUnlockAt` (72 jam setelah live, diputuskan server). */
function Replay({ r }: { r: RecentDetail }) {
  const now = useNow(1000);
  const client = useQueryClient();
  const [part, setPart] = useState(0);
  const unlockAt = new Date(r.replayUnlockAt);
  const left = countdown(unlockAt, now);
  const locked = r.recordings.length === 0;
  // Saat hitung mundur habis, minta detail lagi supaya URL replay dari server muncul.
  useEffect(() => {
    if (locked && !left) client.invalidateQueries({ queryKey: ["recent", r.id] });
  }, [locked, left, client, r.id]);

  if (locked) {
    return (
      <section className="relative overflow-hidden rounded-[26px] bg-nav text-white">
        {r.screenshots[0] && <Img src={r.screenshots[Math.floor(r.screenshots.length / 2)]?.url} className="absolute inset-0 h-full w-full opacity-25 blur-md" />}
        <div className="relative flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
            <Lock className="h-6 w-6" />
          </span>
          <p className="micro text-white/60">Replay IDN · terbuka 72 jam setelah live</p>
          {left ? (
            <p className="num condensed text-[44px] leading-none">
              {left.d ? `${left.d}h ` : ""}
              {String(left.h).padStart(2, "0")}:{String(left.m).padStart(2, "0")}:{String(left.s).padStart(2, "0")}
            </p>
          ) : (
            <p className="text-[18px] font-bold">Menyiapkan replay…</p>
          )}
          <p className="text-[13px] text-white/60">
            {r.recordingCount} bagian rekaman · terbuka {fmtDate(r.replayUnlockAt, { weekday: "long", day: "numeric", month: "long" })} {fmtTime(r.replayUnlockAt)} WIB
          </p>
        </div>
      </section>
    );
  }
  const rec = r.recordings[Math.min(part, r.recordings.length - 1)];
  return (
    <section>
      <SectionHead
        title="Replay"
        label={r.recordings.length > 1 ? `Bagian ${part + 1} dari ${r.recordings.length}` : undefined}
        aside={
          r.recordings.length > 1 ? (
            <div className="flex rounded-full border border-line bg-card p-1">
              {r.recordings.map((x, i) => (
                <button key={x.url} type="button" onClick={() => setPart(i)} className={cx("rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold", i === part ? "bg-ink text-bg" : "text-ink-soft hover:text-ink")}>
                  Bagian {i + 1} · {fmtDuration(x.durationMs)}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />
      <Player
        key={rec.url}
        src={rec.hls || rec.url}
        autoPlay={false}
        vertical={r.platform === "idn"}
        poster={r.screenshots[Math.floor(r.screenshots.length / 2)]?.url}
        title={`Replay · ${r.name}`}
        subtitle={r.recordings.length > 1 ? `Bagian ${part + 1} dari ${r.recordings.length}` : fmtDate(r.start, { weekday: "long", day: "numeric", month: "long" })}
        onEnded={() => part < r.recordings.length - 1 && setPart(part + 1)}
      />
    </section>
  );
}

function RecapAside({ r, unit }: { r: RecentDetail; unit: string }) {
  const [pick, setPick] = useState(0);
  const [banner, setBanner] = useState(false);
  const d = r.designs[Math.min(pick, r.designs.length - 1)];
  const src = d && (banner && d.banner ? d.banner : d.portrait);
  const top = r.gifts[0];
  const supporter = r.fans[0];
  const senders = Math.max(r.gifters.length, ...r.gifts.map((g) => g.users ?? 0)) || null;
  const chat = r.chatters.slice(0, 8);
  const most = chat[0]?.comments || 1;
  if (!d && !top && !supporter && !chat.length) return null;

  return (
    <aside className="flex min-w-0 flex-col gap-10">
      {d && (
        <section>
          <SectionHead title="Rekap" aside={<span className="micro pb-1 text-ink-soft">{d.label}</span>} />
          {r.designs.length > 1 && (
            <div className="mb-3 flex gap-1 rounded-full border border-line bg-surface p-1">
              {r.designs.map((x, i) => (
                <button key={x.key} type="button" onClick={() => setPick(i)} className={cx("flex-1 truncate rounded-full px-2 py-1.5 text-[12px] font-semibold transition-colors", x === d ? "bg-brand text-white" : "text-ink-soft hover:text-ink")}>
                  {x.label}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => openExternal(src)} className="block w-full overflow-hidden rounded-[20px] border border-line bg-surface" title="Buka ukuran penuh">
            <Img key={src} src={src} alt={`Rekap live ${r.name}`} className={cx("w-full", banner && d.banner ? "aspect-[16/9]" : "aspect-[3/4]")} />
          </button>
          <div className="mt-3 flex gap-2">
            {d.banner && (
              <div className="flex flex-1 gap-1 rounded-full border border-line bg-surface p-1">
                {[false, true].map((v) => (
                  <button key={String(v)} type="button" onClick={() => setBanner(v)} className={cx("flex-1 rounded-full py-1.5 text-[12px] font-semibold transition-colors", banner === v ? "bg-ink text-bg" : "text-ink-soft hover:text-ink")}>
                    {v ? "Banner" : "Potret"}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-ghost shrink-0 px-4 py-2 text-[13px]" onClick={() => openExternal(src)}>
              Buka <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      )}

      {(top || supporter) && (
        <section>
          <SectionHead title="Sorotan" />
          <div className="panel overflow-hidden">
            {top && (
              <div className="flex items-center gap-4 bg-brand p-4 text-white">
                {top.img ? <img src={top.img} alt="" className="h-14 w-14 shrink-0 rounded-[16px] bg-white/15 object-contain p-1.5" /> : <span className="h-14 w-14 shrink-0 rounded-[16px] bg-white/15" />}
                <div className="min-w-0">
                  <p className="micro opacity-75">Gift terbanyak</p>
                  <p className="truncate text-[17px] font-bold">{top.name}</p>
                  <p className="num text-[13px] opacity-85">
                    ×{fmtNumber(top.num)}
                    {top.users != null && ` · ${fmtNumber(top.users)} pengirim`}
                  </p>
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 divide-x divide-line">
              <div className="p-4">
                <dt className="micro text-ink-soft">Jenis gift</dt>
                <dd className="num condensed mt-1 text-[28px] leading-none">{fmtNumber(r.gifts.length || null)}</dd>
              </div>
              <div className="p-4">
                <dt className="micro text-ink-soft">Pengirim</dt>
                <dd className="num condensed mt-1 text-[28px] leading-none">{fmtNumber(senders)}</dd>
              </div>
            </dl>
            {supporter && (
              <div className="flex items-center gap-3 border-t border-line p-4">
                <Img src={supporter.avatar} alt={supporter.name} className="h-11 w-11 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="micro text-brand">Supporter #1</p>
                  <p className="truncate font-semibold">{supporter.name}</p>
                </div>
                <p className="num shrink-0 text-right font-semibold">
                  {fmtNumber(supporter.amount)}
                  <span className="block text-[11px] font-normal text-ink-soft">{unit}</span>
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {chat.length > 0 && (
        <section className="xl:sticky xl:top-4">
          <SectionHead title="Paling aktif komentar" />
          <ol className="panel overflow-hidden">
            {chat.map((c, i) => (
              <li key={`${c.name}-${i}`} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                <Img src={c.avatar} alt={c.name} className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-medium">{c.name}</span>
                    <span className="num shrink-0 font-mono text-[12px] text-ink-soft">{fmtNumber(c.comments)}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface">
                    <div className={cx("h-full rounded-full", i === 0 ? "bg-brand" : "bg-ink-soft/40")} style={{ width: `${Math.max(6, (c.comments / most) * 100)}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </aside>
  );
}

/** Cuplikan layar sepanjang live, klik untuk memperbesar (← → untuk berpindah). */
function Shots({ r }: { r: RecentDetail }) {
  const [open, setOpen] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const shots = useMemo(() => (all ? r.screenshots : r.screenshots.slice(0, 12)), [all, r.screenshots]);
  useEffect(() => {
    if (open == null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((v) => Math.min((v ?? 0) + 1, r.screenshots.length - 1));
      if (e.key === "ArrowLeft") setOpen((v) => Math.max((v ?? 0) - 1, 0));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, r.screenshots.length]);
  const vertical = r.platform === "idn";
  return (
    <section>
      <SectionHead title="Cuplikan" count={r.screenshots.length} />
      <div className={cx("grid gap-2", vertical ? "grid-cols-4 2xl:grid-cols-6" : "grid-cols-3 2xl:grid-cols-4")}>
        {shots.map((s, i) => (
          <button key={s.url} type="button" onClick={() => setOpen(i)} className="group relative overflow-hidden rounded-[14px] bg-surface">
            <Img src={s.url} className={cx("w-full transition-transform duration-500 group-hover:scale-[1.05]", vertical ? "aspect-[9/16]" : "aspect-video")} />
            {s.at && <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white">{fmtTime(s.at)}</span>}
          </button>
        ))}
      </div>
      {!all && r.screenshots.length > 12 && (
        <div className="flex justify-center pt-4">
          <button type="button" className="btn btn-ghost" onClick={() => setAll(true)}>
            Tampilkan semua {r.screenshots.length} cuplikan
          </button>
        </div>
      )}
      {open != null && r.screenshots[open] && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-10 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <img src={r.screenshots[open].url} alt="" className="max-h-full max-w-full rounded-[18px] object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="absolute right-6 top-16 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" onClick={() => setOpen(null)}>
            <X className="h-5 w-5" />
          </button>
          <p className="absolute bottom-6 font-mono text-[12px] text-white/70">
            {open + 1} / {r.screenshots.length} {r.screenshots[open].at && `· ${fmtTime(r.screenshots[open].at)} WIB`}
          </p>
        </div>
      )}
    </section>
  );
}

