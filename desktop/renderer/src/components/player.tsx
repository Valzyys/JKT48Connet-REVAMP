import Hls from "hls.js";
import { AlertTriangle, Gauge, Maximize, Minimize, Pause, PictureInPicture2, Play, RefreshCw, RotateCcw, RotateCw, Settings2, Volume1, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cx, PixelCross } from "./ui";

export type Source = { label: string; url: string };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function clock(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** URL replay dari server bisa relatif ("/api/app/replay?t=…"): lengkapi dengan domain JKT48Connect. */
const absolute = (src: string) => new URL(src, "https://jkt48connect.app/").href;

function savedVolume() {
  try {
    const v = Number(localStorage.getItem("jkc:vol") ?? 1);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  } catch {
    return 1;
  }
}

/**
 * Pemutar JKT48Connect dengan kontrol sendiri, untuk live Showroom, replay, dan video YouTube JKT48.
 * Playlist HLS diputar lewat hls.js (Chromium tidak memutar HLS bawaan); MP4 langsung. Token replay disisipkan
 * main process, tidak ada di sini.
 */
export function Player({
  src,
  sources,
  poster,
  live,
  autoPlay = true,
  vertical,
  title,
  subtitle,
  className,
  onEnded,
}: {
  src?: string;
  /** Beberapa sumber (mis. kualitas live Showroom); menu kualitas memilih di antaranya. */
  sources?: Source[];
  poster?: string;
  live?: boolean;
  autoPlay?: boolean;
  vertical?: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  onEnded?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resumeAt = useRef(0);

  const [pick, setPick] = useState(0);
  const url = sources?.length ? sources[Math.min(pick, sources.length - 1)].url : (src ?? "");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [vol, setVol] = useState(savedVolume);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [levels, setLevels] = useState<{ i: number; label: string }[]>([]);
  const [level, setLevel] = useState(-1);
  const [menu, setMenu] = useState<"" | "quality" | "speed">("");
  const [show, setShow] = useState(true);
  const [full, setFull] = useState(false);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [scrub, setScrub] = useState(false);
  const [flash, setFlash] = useState<{ k: number; icon: ReactNode } | null>(null);
  const [behind, setBehind] = useState(false);

  /* Sumber & hls.js */
  useEffect(() => {
    const video = ref.current;
    if (!video || !url) return;
    setError("");
    setWaiting(true);
    setLevels([]);
    setLevel(-1);
    const abs = absolute(url);
    const isHls = /\.m3u8(\?|$)/i.test(abs) || /\/hls$/.test(new URL(abs).pathname);
    const resume = live ? 0 : resumeAt.current;
    let hls: Hls | null = null;
    if (isHls && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: !!live, liveSyncDurationCount: 3, backBufferLength: live ? 30 : 90, maxBufferLength: live ? 20 : 45, startPosition: resume || -1 });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => {
        const ls = d.levels.map((l, i) => ({ i, label: l.height ? `${l.height}p` : l.bitrate ? `${Math.round(l.bitrate / 1000)} kbps` : `Kualitas ${i + 1}` }));
        setLevels(ls.length > 1 ? ls.reverse() : []);
      });
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
        else setError(live ? "Siaran tidak bisa diputar. Mungkin live sudah selesai." : "Video tidak bisa diputar.");
      });
      hls.loadSource(abs);
      hls.attachMedia(video);
    } else {
      video.src = abs;
      if (resume) video.currentTime = resume;
    }
    video.volume = savedVolume();
    if (autoPlay || resumeAt.current) video.play().catch(() => {});
    return () => {
      resumeAt.current = video.currentTime || 0;
      hls?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [url, live, attempt, autoPlay]);

  /* Layar penuh */
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  /* Kontrol menghilang saat diam & sedang diputar */
  const poke = useCallback(() => {
    setShow(true);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setShow(false), 2600);
  }, []);
  useEffect(() => () => clearTimeout(idle.current), []);
  const visible = show || !playing || !!menu || scrub || !!error;

  const video = () => ref.current!;
  const toggle = () => {
    const el = video();
    const resume = el.paused;
    if (resume) el.play().catch(() => {});
    else el.pause();
    setFlash({ k: Date.now(), icon: resume ? <Play className="h-7 w-7 translate-x-0.5 fill-current" /> : <Pause className="h-7 w-7 fill-current" /> });
  };
  const seek = (d: number) => {
    const el = video();
    if (live || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(el.duration, el.currentTime + d));
    setFlash({ k: Date.now(), icon: d > 0 ? <RotateCw className="h-7 w-7" /> : <RotateCcw className="h-7 w-7" /> });
  };
  const setVolume = (x: number) => {
    const el = video();
    const val = Math.max(0, Math.min(1, x));
    el.volume = val;
    el.muted = val === 0;
    setVol(val);
    try {
      localStorage.setItem("jkc:vol", String(val));
    } catch {
      /* abaikan */
    }
  };
  const toggleMute = () => {
    video().muted = !video().muted;
  };
  const goFull = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen());
  const pip = () => {
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else video()
      .requestPictureInPicture?.()
      .catch(() => {});
  };
  const toLive = () => {
    const el = video();
    const end = hlsRef.current?.liveSyncPosition ?? (el.seekable.length ? el.seekable.end(el.seekable.length - 1) : el.currentTime);
    el.currentTime = end;
    el.play().catch(() => {});
  };

  const fraction = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };
  const scrubTo = (e: PointerEvent) => {
    if (!dur) return;
    const t = fraction(e.clientX) * dur;
    video().currentTime = t;
    setTime(t);
  };

  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") toggle();
    else if (k === "arrowright") seek(10);
    else if (k === "arrowleft") seek(-10);
    else if (k === "arrowup") setVolume(vol + 0.1);
    else if (k === "arrowdown") setVolume(vol - 0.1);
    else if (k === "m") toggleMute();
    else if (k === "f") goFull();
    else return;
    e.preventDefault();
    e.stopPropagation();
    poke();
  };

  const played = dur ? (time / dur) * 100 : 0;
  const VolIcon = muted || vol === 0 ? VolumeX : vol < 0.5 ? Volume1 : Volume2;
  const pickLevel = (i: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = i;
    setLevel(i);
  };
  const qualityItems = sources?.length
    ? sources.map((s, i) => ({ key: i, label: s.label, on: i === pick, pick: () => setPick(i) }))
    : levels.length
      ? [{ key: -1, label: "Otomatis", on: level === -1, pick: () => pickLevel(-1) }, ...levels.map((l) => ({ key: l.i, label: l.label, on: level === l.i, pick: () => pickLevel(l.i) }))]
      : [];

  return (
    <div className={cx("relative mx-auto", vertical ? "w-fit" : "w-full", className)} style={vertical ? undefined : { maxWidth: "calc(74vh * 16 / 9)" }}>
      {/* Cahaya ambient: poster yang diburamkan di belakang bingkai */}
      {poster && <img aria-hidden src={poster} alt="" className="pointer-events-none absolute inset-6 -z-10 h-[calc(100%-3rem)] w-[calc(100%-3rem)] scale-105 rounded-[40px] object-cover opacity-55 blur-3xl saturate-150 dark:opacity-35" />}
      <div
        ref={box}
        tabIndex={0}
        onKeyDown={onKey}
        onMouseMove={poke}
        onMouseLeave={() => playing && setShow(false)}
        className={cx(
          "group/player relative overflow-hidden bg-black outline-none ring-brand/60 focus-visible:ring-2",
          full ? "h-screen w-screen" : "rounded-[26px] shadow-[0_30px_70px_-30px_rgb(15_10_12/0.8)]",
          !full && (vertical ? "aspect-[9/16] h-[78vh]" : "aspect-video w-full"),
          !visible && "cursor-none",
        )}
      >
        <video
          ref={ref}
          poster={poster}
          playsInline
          className="h-full w-full bg-black object-contain"
          onClick={() => (menu ? setMenu("") : toggle())}
          onDoubleClick={goFull}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => {
            setWaiting(false);
            setStarted(true);
          }}
          onCanPlay={() => setWaiting(false)}
          onPlay={() => {
            setPlaying(true);
            poke();
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            resumeAt.current = 0;
            onEnded?.();
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (!scrub) setTime(el.currentTime);
            if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1));
            if (live && el.seekable.length) setBehind(el.seekable.end(el.seekable.length - 1) - el.currentTime > 12);
          }}
          onDurationChange={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
          onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          onError={() => !error && setError(live ? "Siaran tidak bisa diputar." : "Video tidak bisa diputar.")}
        />

        {/* Memuat: salib piksel berdenyut dalam cincin merah */}
        {waiting && !error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative grid h-20 w-20 place-items-center">
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-[#ff3b52]" />
              <PixelCross className="h-8 w-8 animate-pulse" cell="fill-white/90" />
            </div>
          </div>
        )}

        {/* Ikon kilat saat putar / jeda / lompat */}
        {flash && (
          <div key={flash.k} className="player-flash pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">{flash.icon}</span>
          </div>
        )}

        {/* Sebelum diputar: tombol putar besar bermerek */}
        {!started && !playing && !waiting && !error && (
          <button type="button" onClick={toggle} aria-label="Putar" className="absolute inset-0 grid place-items-center bg-black/25">
            <span className="relative grid h-24 w-24 place-items-center rounded-full bg-[#e1243a] text-white shadow-[0_20px_50px_-10px_#e1243a] transition-transform hover:scale-105">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#e1243a]/40" />
              <Play className="relative h-10 w-10 translate-x-1 fill-current" />
            </span>
          </button>
        )}

        {/* Judul atas */}
        {(title || live) && (
          <div className={cx("pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 bg-gradient-to-b from-black/70 to-transparent p-5 text-white transition-opacity duration-300", visible ? "opacity-100" : "opacity-0")}>
            {live && (
              <span className="pill shrink-0 bg-[#e1243a] text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
              </span>
            )}
            <div className="min-w-0">
              {title && <p className="truncate text-[15px] font-bold">{title}</p>}
              {subtitle && <p className="truncate text-[12px] text-white/70">{subtitle}</p>}
            </div>
          </div>
        )}

        {/* Kontrol bawah */}
        <div className={cx("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pb-4 pt-16 text-white transition-all duration-300", visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")}>
          {!live && dur > 0 && (
            <div
              ref={bar}
              className="group/bar relative mb-2.5 h-5 cursor-pointer touch-none"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setScrub(true);
                scrubTo(e);
              }}
              onPointerMove={(e) => {
                const f = fraction(e.clientX);
                setHover({ x: f * 100, t: f * dur });
                if (scrub) scrubTo(e);
              }}
              onPointerUp={() => setScrub(false)}
              onPointerLeave={() => setHover(null)}
            >
              <div className="absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/bar:h-[7px]">
                <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${dur ? Math.min(100, (buffered / dur) * 100) : 0}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#e1243a] to-[#ff5a6e]" style={{ width: `${played}%` }} />
              </div>
              <span className={cx("absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#e1243a] bg-[#fde6b0] shadow-lg transition-transform", scrub ? "scale-125" : "scale-0 group-hover/bar:scale-100")} style={{ left: `${played}%` }} />
              {hover && (
                <span className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-[#fbf8f3] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#1d1517] shadow" style={{ left: `${hover.x}%` }}>
                  {clock(hover.t)}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Ctl title={playing ? "Jeda (Spasi)" : "Putar (Spasi)"} onClick={toggle} big>
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 translate-x-px fill-current" />}
            </Ctl>
            {!live && (
              <>
                <Ctl title="Mundur 10 detik (←)" onClick={() => seek(-10)}>
                  <RotateCcw className="h-[18px] w-[18px]" />
                </Ctl>
                <Ctl title="Maju 10 detik (→)" onClick={() => seek(10)}>
                  <RotateCw className="h-[18px] w-[18px]" />
                </Ctl>
              </>
            )}
            <div className="group/vol flex items-center">
              <Ctl title="Bisukan (M)" onClick={toggleMute}>
                <VolIcon className="h-[18px] w-[18px]" />
              </Ctl>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : vol}
                onChange={(e) => setVolume(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                aria-label="Volume"
                className="player-range w-0 opacity-0 transition-all duration-300 group-hover/vol:ml-1 group-hover/vol:w-24 group-hover/vol:opacity-100"
                style={{ "--p": `${(muted ? 0 : vol) * 100}%` } as CSSProperties}
              />
            </div>
            {live ? (
              <button type="button" onClick={toLive} className={cx("ml-2 flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11.5px] font-semibold uppercase tracking-wider transition-colors", behind ? "bg-white/15 text-white hover:bg-white/25" : "text-[#ff8a98]")}>
                <span className={cx("h-2 w-2 rounded-full", behind ? "bg-white/50" : "animate-pulse bg-[#ff3b52]")} />
                {behind ? "Kembali ke live" : "Live"}
              </button>
            ) : (
              <span className="ml-2 font-mono text-[12px] tabular-nums text-white/85">
                {clock(time)} <span className="text-white/45">/ {clock(dur)}</span>
              </span>
            )}
            <div className="flex-1" />

            {qualityItems.length > 1 && (
              <div className="relative">
                <Ctl title="Kualitas" onClick={() => setMenu(menu === "quality" ? "" : "quality")}>
                  <Settings2 className="h-[18px] w-[18px]" />
                </Ctl>
                {menu === "quality" && (
                  <Menu title="Kualitas">
                    {qualityItems.map((q) => (
                      <MenuItem
                        key={q.key}
                        on={q.on}
                        onClick={() => {
                          q.pick();
                          setMenu("");
                        }}
                      >
                        {q.label}
                      </MenuItem>
                    ))}
                  </Menu>
                )}
              </div>
            )}
            {!live && (
              <div className="relative">
                <Ctl title="Kecepatan" onClick={() => setMenu(menu === "speed" ? "" : "speed")}>
                  {rate === 1 ? <Gauge className="h-[18px] w-[18px]" /> : <span className="font-mono text-[11px] font-bold">{rate}×</span>}
                </Ctl>
                {menu === "speed" && (
                  <Menu title="Kecepatan">
                    {SPEEDS.map((s) => (
                      <MenuItem
                        key={s}
                        on={rate === s}
                        onClick={() => {
                          video().playbackRate = s;
                          setMenu("");
                        }}
                      >
                        {s === 1 ? "Normal" : `${s}×`}
                      </MenuItem>
                    ))}
                  </Menu>
                )}
              </div>
            )}
            {document.pictureInPictureEnabled && (
              <Ctl title="Gambar dalam gambar" onClick={pip}>
                <PictureInPicture2 className="h-[18px] w-[18px]" />
              </Ctl>
            )}
            <Ctl title={full ? "Keluar layar penuh (F)" : "Layar penuh (F)"} onClick={goFull}>
              {full ? <Minimize className="h-[18px] w-[18px]" /> : <Maximize className="h-[18px] w-[18px]" />}
            </Ctl>
          </div>
        </div>

        {error && (
          <div className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center text-white">
            <div>
              <AlertTriangle className="mx-auto h-8 w-8 text-[#fde6b0]" />
              <p className="mt-3 font-semibold">{error}</p>
              <button type="button" className="btn mt-4 bg-white/15 text-white hover:bg-white/25" onClick={() => setAttempt((a) => a + 1)}>
                <RefreshCw className="h-4 w-4" /> Coba lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Ctl({ title, onClick, children, big }: { title: string; onClick: () => void; children: ReactNode; big?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cx("grid place-items-center rounded-full text-white transition-all hover:bg-white/15 active:scale-90", big ? "h-11 w-11 bg-white/10" : "h-9 w-9")}
    >
      {children}
    </button>
  );
}

function Menu({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rise absolute bottom-[calc(100%+10px)] right-0 z-10 min-w-[160px] overflow-hidden rounded-[16px] border border-white/10 bg-[#1d1517]/95 p-1.5 text-white shadow-2xl backdrop-blur-xl" style={{ animationDuration: "0.2s" }} onClick={(e) => e.stopPropagation()}>
      <p className="micro px-3 pb-1.5 pt-1 text-[9.5px] text-white/45">{title}</p>
      {children}
    </div>
  );
}

function MenuItem({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx("flex w-full items-center justify-between gap-6 rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold transition-colors", on ? "bg-[#e1243a] text-white" : "hover:bg-white/10")}>
      {children}
      {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </button>
  );
}
