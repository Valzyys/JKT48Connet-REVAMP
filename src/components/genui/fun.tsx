import { Link } from "@tanstack/react-router";
import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { safeLink } from "@/lib/genui";
import { arr, box, btnBase, btnStyle, Empty, fmt, img, num, obj, str, Title, useGenUi, type P } from "./kit";

/* ── game ───────────────────────────────────────────────── */

export function Confetti({ run }: { run: boolean }) {
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ l: (i * 37) % 100, d: (i % 7) * 0.08, c: ["#e1243a", "#fde6b0", "#ff6476", "#f5c96a", "#1d1517"][i % 5], r: (i * 47) % 360 })), []);
  if (!run) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b, i) => (
        <i key={i} className="absolute top-[-12px] h-3 w-2 animate-[confetti_1.6s_ease-in_forwards] rounded-[2px]" style={{ left: `${b.l}%`, background: b.c, animationDelay: `${b.d}s`, rotate: `${b.r}deg` }} />
      ))}
    </div>
  );
}

export function GuessMemberBlock({ p }: { p: P }) {
  const { send } = useGenUi();
  const rounds = arr(p.rounds).map(obj).filter((r) => img(r.image) && arr(r.options).length);
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  useEffect(() => {
    if (pick !== null) return;
    const id = window.setInterval(() => setT((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [pick, i]);
  if (!rounds.length) return <Empty>Ronde tebak member kosong.</Empty>;
  if (i >= rounds.length)
    return (
      <div className={cx(box, "relative overflow-hidden p-5 text-center")}>
        <Confetti run={score > 0} />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">Tebak member · selesai</p>
        <p className="mt-2 text-[44px] font-black text-brand">{score}/{rounds.length}</p>
        <button type="button" className={cx(btnBase, btnStyle("primary"), "mt-2")} onClick={() => send(`Skor tebak member-ku ${score}/${rounds.length}. Main lagi dengan member lain!`)}>Main lagi</button>
      </div>
    );
  const r = rounds[i];
  const blur = pick !== null ? 0 : Math.max(0, 22 - t * 2.4);
  const ans = num(r.answer, -1);
  return (
    <div className={cx(box, "overflow-hidden")}>
      <div className="relative h-56 overflow-hidden">
        <img src={img(r.image)} alt="" className="h-full w-full scale-110 object-cover object-[center_25%] transition-[filter] duration-1000" style={{ filter: `blur(${blur}px) saturate(1.2)` }} />
        <span className="absolute left-3 top-3 rounded-full bg-card px-2.5 py-1 font-mono text-[11px] font-bold">Tebak siapa? · {i + 1}/{rounds.length}</span>
        <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white">⏱ {t}s</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {arr(r.options).map((o, oi) => (
          <button
            key={oi}
            type="button"
            disabled={pick !== null}
            onClick={() => {
              setPick(oi);
              if (oi === ans) setScore((s) => s + 1);
            }}
            className={cx("rounded-full border px-3 py-2 text-[13.5px] transition", pick === null ? "border-line hover:border-brand" : oi === ans ? "border-emerald-500 bg-emerald-500/10 font-bold text-emerald-600" : oi === pick ? "border-brand text-brand" : "border-line opacity-50")}
          >
            {str(o)}
          </button>
        ))}
      </div>
      {pick !== null && (
        <div className="px-3 pb-3">
          <button type="button" className={cx(btnBase, btnStyle("secondary"), "w-full")} onClick={() => { setI(i + 1); setPick(null); setT(0); }}>
            {i + 1 < rounds.length ? "Ronde berikutnya →" : "Lihat skor"}
          </button>
        </div>
      )}
    </div>
  );
}

export function RouletteBlock({ p }: { p: P }) {
  const { send } = useGenUi();
  const items = arr(p.items).map((x) => str(typeof x === "string" ? x : obj(x).name)).filter(Boolean).slice(0, 12);
  const [deg, setDeg] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  if (items.length < 2) return <Empty>Butuh minimal 2 pilihan.</Empty>;
  const seg = 360 / items.length;
  const colors = ["#e1243a", "#fde6b0", "#b9172b", "#f9a8b4", "#7a1d2b", "#ff6476"];
  const bg = `conic-gradient(${items.map((_, i) => `${colors[i % colors.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(",")})`;
  const spin = () => {
    if (spinning) return;
    const pick = Math.floor(Math.random() * items.length);
    const target = deg + 360 * 5 + (360 - (pick * seg + seg / 2) - (deg % 360));
    setSpinning(true);
    setResult(null);
    setDeg(target);
    window.setTimeout(() => {
      setSpinning(false);
      setResult(items[pick]);
    }, 3200);
  };
  return (
    <div className={cx(box, "relative overflow-hidden p-4 text-center")}>
      <Confetti run={Boolean(result)} />
      <Title>{str(p.title, "Oshi Roulette")}</Title>
      <div className="relative mx-auto h-52 w-52">
        <div className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-ink" />
        <div className="h-full w-full rounded-full shadow-[inset_0_0_0_6px_var(--color-card)] transition-transform duration-[3200ms] ease-[cubic-bezier(.15,.85,.2,1)]" style={{ background: bg, transform: `rotate(${deg}deg)` }}>
          {items.map((t, i) => (
            <span key={i} className="absolute left-1/2 top-1/2 origin-left -translate-y-1/2 whitespace-nowrap pl-7 text-[11px] font-bold" style={{ transform: `rotate(${i * seg + seg / 2 - 90}deg)`, color: ["#fde6b0", "#f9a8b4"].includes(colors[i % colors.length]) ? "#3a0d14" : "#fff" }}>
              {t.slice(0, 12)}
            </span>
          ))}
        </div>
        <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card ring-[3px] ring-brand" />
      </div>
      <p className="mt-3 h-7 text-[18px] font-extrabold text-brand">{result ? `🎉 ${result}!` : spinning ? "Memutar…" : ""}</p>
      <div className="flex justify-center gap-2">
        <button type="button" disabled={spinning} onClick={spin} className={cx(btnBase, btnStyle("primary"))}>{result ? "Putar lagi" : "Putar!"}</button>
        {result && <button type="button" className={cx(btnBase, btnStyle("secondary"))} onClick={() => send(`Hasil roulette: ${result}. Ceritakan tentang ${result}!`)}>Kenalan dengan {result}</button>}
      </div>
    </div>
  );
}

export function LeaderboardBlock({ p }: { p: P }) {
  const items = arr(p.items).map(obj).slice(0, 10);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setGo(true), 150);
    return () => window.clearTimeout(id);
  }, []);
  const top = [items[1], items[0], items[2]];
  const h = [70, 96, 54];
  return (
    <div className={cx(box, "relative overflow-hidden p-4")}>
      <Confetti run={go} />
      <Title>{str(p.title, "Papan peringkat")}</Title>
      <div className="flex items-end justify-center gap-2">
        {top.map((it, k) =>
          it ? (
            <div key={k} className="w-24 text-center text-[12px]">
              {img(it.image) ? <img src={img(it.image)} alt="" className="mx-auto h-11 w-11 rounded-full object-cover object-top" /> : <div className="mx-auto h-11 w-11 rounded-full bg-surface" />}
              <p className="mt-1 truncate font-bold">{str(it.name)}</p>
              <p className="font-mono text-[11px] text-ink-soft">{str(it.value)}</p>
              <div className={cx("mt-1 grid place-items-center rounded-t-xl text-[22px] font-black transition-[height] duration-700", k === 1 ? "bg-gradient-to-b from-butter to-[#f5c96a] text-[#5a3a00]" : "bg-surface")} style={{ height: go ? h[k] : 0 }}>
                {k === 1 ? 1 : k === 0 ? 2 : 3}
              </div>
            </div>
          ) : null,
        )}
      </div>
      {items.length > 3 && (
        <ol className="mt-3 divide-y divide-line text-[13.5px]" start={4}>
          {items.slice(3).map((it, i) => (
            <li key={i} className="flex justify-between py-1.5">
              <span><b className="mr-2 text-brand">{i + 4}</b>{str(it.name)}</span>
              <span className="font-mono">{str(it.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── media ──────────────────────────────────────────────── */

export function YoutubeBlock({ p }: { p: P }) {
  const id = str(p.id).replace(/[^\w-]/g, "").slice(0, 20);
  const [on, setOn] = useState(false);
  if (!id) return <Empty>ID video tidak valid.</Empty>;
  return (
    <div className={cx(box, "overflow-hidden")}>
      <div className="relative aspect-video bg-black">
        {on ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={str(p.title, "Video YouTube")} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" />
        ) : (
          <button type="button" onClick={() => setOn(true)} className="group absolute inset-0" aria-label="Putar video">
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
            <span className="absolute left-1/2 top-1/2 grid h-12 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-[#ff0033] text-white transition group-hover:scale-110">
              <Play className="h-6 w-6 fill-white" />
            </span>
          </button>
        )}
      </div>
      {str(p.title) && <p className="px-3.5 py-2.5 text-[14px] font-bold">{str(p.title)}</p>}
    </div>
  );
}

type Track = { id: string; title: string; artist: string; cover: string; audio: { url: string } | null };
type Line = { time: number; text: string };

/** Ambil detail lagu (dari id, atau cari dulu dengan query). */
function useTrack(p: P) {
  const [track, setTrack] = useState<Track | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        let id = str(p.id);
        if (!id && str(p.query)) {
          const s = await apiGet<{ tracks: { id: string }[] }>("/api/music/search", { q: str(p.query) });
          id = s.tracks[0]?.id ?? "";
        }
        if (!id) throw new Error("Lagu tidak ditemukan");
        const d = await apiGet<Track>(`/api/music/${encodeURIComponent(id)}`);
        if (!dead) setTrack(d);
      } catch (e) {
        if (!dead) setErr((e as Error).message || "Lagu tidak bisa dimuat");
      }
    })();
    return () => {
      dead = true;
    };
  }, [p.id, p.query]);
  return { track, err };
}

function Player({ p, lyrics, onTime }: { p: P; lyrics?: boolean; onTime?: (t: number) => void }) {
  const { track, err } = useTrack(p);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  if (err) return <Empty>{err}</Empty>;
  if (!track) return <div className={cx(box, "h-24 animate-pulse")} />;
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };
  return (
    <div className="flex items-center gap-3 p-3">
      <button type="button" onClick={toggle} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff8aa0] via-brand to-[#5b0d18]" aria-label={playing ? "Jeda" : "Putar"}>
        {img(track.cover) && <img src={img(track.cover)} alt="" className="h-full w-full object-cover" />}
        <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">{playing ? <Pause className="h-6 w-6 fill-white" /> : <Play className="h-6 w-6 fill-white" />}</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-bold">{track.title}</p>
        <p className="truncate text-[12px] text-ink-soft">{track.artist}</p>
        <div className="mt-1.5 flex items-end gap-[2px]" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => (
            <i key={i} className={cx("w-[3px] rounded-full bg-brand transition-all", playing && "animate-[eq_1s_ease-in-out_infinite]")} style={{ height: `${6 + ((i * 7) % 18)}px`, animationDelay: `${(i % 6) * 0.1}s`, opacity: dur && i / 28 < t / dur ? 1 : 0.35 }} />
          ))}
        </div>
        <input type="range" min={0} max={dur || 1} step={0.5} value={t} onChange={(e) => { if (audio.current) audio.current.currentTime = Number(e.target.value); }} className="mt-1 w-full accent-[var(--color-brand)]" aria-label="Posisi lagu" />
        <p className="font-mono text-[10.5px] text-ink-soft">
          {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")} / {Math.floor(dur / 60)}:{String(Math.floor(dur % 60)).padStart(2, "0")}
        </p>
      </div>
      {track.audio?.url ? (
        <audio
          ref={audio}
          src={track.audio.url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            setT(e.currentTarget.currentTime);
            onTime?.(e.currentTarget.currentTime);
          }}
        />
      ) : (
        <span className="text-[11px] text-ink-soft">{lyrics ? "" : "audio belum siap"}</span>
      )}
    </div>
  );
}

export function MusicBlock({ p }: { p: P }) {
  return (
    <div className={box}>
      <Player p={p} />
    </div>
  );
}

export function KaraokeBlock({ p }: { p: P }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [t, setT] = useState(0);
  const [show, setShow] = useState({ orig: true, tr: true });
  const tr = arr(p.translations).map((x) => str(x));
  const { track } = useTrack(p);
  useEffect(() => {
    if (!track?.id) return;
    apiGet<{ lines: Line[] }>(`/api/music/${encodeURIComponent(track.id)}/lyrics`, { track: track.title, artist: track.artist })
      .then((l) => setLines(l.lines.filter((x) => x.time >= 0)))
      .catch(() => setLines([]));
  }, [track?.id, track?.title, track?.artist]);
  let cur = 0;
  for (let k = 0; k < lines.length; k++) if (lines[k].time <= t + 0.2) cur = k;
  return (
    <div className={cx(box, "overflow-hidden")}>
      <Player p={track ? { id: track.id } : p} lyrics onTime={setT} />
      <div className="border-t border-line px-4 py-4 text-center">
        {lines.length ? (
          [cur - 1, cur, cur + 1].map((li) =>
            lines[li] ? (
              <div key={li} className={cx("transition-all duration-300", li === cur ? "my-2 scale-105" : "opacity-35")}>
                {show.orig && <p className={cx(li === cur ? "text-[19px] font-extrabold text-brand" : "text-[14px]")}>{lines[li].text || "♪"}</p>}
                {show.tr && tr[li] && <p className={cx("text-ink-soft", li === cur ? "text-[14px]" : "text-[12px]")}>{tr[li]}</p>}
              </div>
            ) : null,
          )
        ) : (
          <p className="text-[13px] text-ink-soft">Lirik sinkron belum tersedia. Putar lagunya di atas.</p>
        )}
        <div className="mt-3 flex justify-center gap-1.5">
          {(["orig", "tr"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setShow({ ...show, [k]: !show[k] })} className={cx("rounded-full border px-3 py-1 text-[12px]", show[k] ? "border-brand text-brand" : "border-line text-ink-soft")}>
              {k === "orig" ? "Lirik asli" : "Terjemahan"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LivePreviewBlock({ p }: { p: P }) {
  const href = safeLink(str(p.href, str(p.watch)));
  return (
    <div className={cx(box, "overflow-hidden")}>
      <div className="relative h-48 bg-surface">
        {img(p.image) && <img src={img(p.image)} alt="" className="h-full w-full object-cover object-[center_22%]" />}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-widest text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live · {str(p.platform) === "idn" ? "IDN" : "Showroom"}
        </span>
      </div>
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{str(p.name)} sedang live</p>
          <p className="text-[12px] text-ink-soft">{num(p.viewers) ? `${fmt(num(p.viewers))} penonton` : str(p.title)}</p>
        </div>
        {href && (/^https:/.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer" className={cx(btnBase, btnStyle("primary"))}>Tonton</a> : <Link to={href} className={cx(btnBase, btnStyle("primary"))}>Tonton</Link>)}
      </div>
    </div>
  );
}

type Cmt = { id: string; user: string; text: string; gift?: string };

/** Nonton bareng: pratinjau live + komentar Showroom asli (bila ada room) + reaksi yang beterbangan. */
export function WatchPartyBlock({ p }: { p: P }) {
  const room = str(p.room).replace(/\D/g, "");
  const href = safeLink(str(p.href, str(p.watch)));
  const [comments, setComments] = useState<Cmt[]>([]);
  const [floats, setFloats] = useState<{ id: number; e: string; x: number }[]>([]);
  useEffect(() => {
    if (!room) return;
    let dead = false;
    const load = () =>
      apiGet<{ comments: { id?: string; name?: string; user?: string; comment?: string; text?: string }[] }>(`/api/showroom-comments/${room}`)
        .then((d) => {
          if (dead) return;
          setComments(
            d.comments.slice(-14).map((c, i) => ({ id: String(c.id ?? i), user: String(c.name ?? c.user ?? "fans"), text: String(c.comment ?? c.text ?? "") })),
          );
        })
        .catch(() => {});
    void load();
    const id = window.setInterval(load, 5000);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, [room]);
  const react = (e: string) => {
    const id = Date.now() + Math.random();
    setFloats((f) => [...f.slice(-12), { id, e, x: 10 + Math.random() * 70 }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2200);
  };
  return (
    <div className={cx(box, "grid overflow-hidden sm:grid-cols-[1.4fr_1fr]")}>
      <div className="relative min-h-64 bg-black">
        {img(p.image) && <img src={img(p.image)} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_22%] opacity-90" />}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-widest text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live · {str(p.name)}
        </span>
        {floats.map((f) => (
          <span key={f.id} className="pointer-events-none absolute bottom-4 animate-[floatup_2.2s_ease-out_forwards] text-[26px]" style={{ right: `${f.x}%` }}>
            {f.e}
          </span>
        ))}
        {href && (/^https:/.test(href) ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={cx(btnBase, btnStyle("primary"), "absolute bottom-3 left-3")}><Volume2 className="h-4 w-4" /> Tonton penuh</a>
        ) : (
          <Link to={href} className={cx(btnBase, btnStyle("primary"), "absolute bottom-3 left-3")}><Volume2 className="h-4 w-4" /> Tonton penuh</Link>
        ))}
      </div>
      <div className="flex flex-col">
        <div className="flex max-h-64 flex-1 flex-col justify-end gap-1.5 overflow-hidden p-3 text-[13px]">
          {comments.length ? comments.map((c) => <p key={c.id} className="leading-snug"><b className="text-brand">{c.user}</b> {c.text}</p>) : <p className="text-ink-soft">{room ? "Menunggu komentar…" : "Komentar langsung tersedia untuk live Showroom."}</p>}
        </div>
        <div className="flex gap-2 border-t border-line p-2.5">
          {["❤️", "🔥", "😍", "👏", "✨"].map((e) => (
            <button key={e} type="button" onClick={() => react(e)} className="grid h-9 w-9 place-items-center rounded-full bg-surface text-[17px] transition hover:scale-110 active:scale-90">
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function useStableId() {
  return useMemo(() => Math.random().toString(36).slice(2), []);
}
