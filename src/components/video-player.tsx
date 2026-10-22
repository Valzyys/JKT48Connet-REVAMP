import {
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { gsap } from "@/lib/gsap";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP = 10;
const HIDE_AFTER = 2600;
const VOL_KEY = "jkt48c:volume";

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const s = Math.floor(t % 60);
  const m = Math.floor((t / 60) % 60);
  const h = Math.floor(t / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function readVolume() {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

type Feedback = { icon: ReactNode; label?: string; key: number };

/**
 * Pemutar video custom ala JKT48Connect: bar seek dengan buffer + pratinjau waktu, lompat ±10 detik,
 * volume (diingat), kecepatan, picture-in-picture, layar penuh, kontrol yang menghilang sendiri,
 * pintasan keyboard (spasi/K, J/L, ←/→, ↑/↓, M, F, 0–9), dan ketuk dua kali kiri/kanan di layar sentuh.
 */
export function VideoPlayer({ src, hls, poster, initialRatio = 16 / 9 }: { src: string; hls?: string; poster?: string; initialRatio?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const hideTimer = useRef(0);
  const lastTap = useRef<{ t: number; side: "l" | "r" | "c" }>({ t: 0, side: "c" });
  const tapTimer = useRef(0);
  const pointerType = useRef("mouse");

  const [ratio, setRatio] = useState(initialRatio);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(readVolume);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [shown, setShown] = useState(true);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [error, setError] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const v = () => video.current;

  // Sumber: playlist HLS (indeks potongan → mulai & seek langsung) bila ada, diputar lewat hls.js (dimuat
  // terpisah; termasuk Safari/iOS lewat MediaSource). Tanpa MediaSource → HLS bawaan browser.
  // Gagal di tengah jalan → kembali ke file MP4 biasa.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let player: import("hls.js").default | undefined;
    let cancelled = false;
    const fallback = () => {
      player?.destroy();
      player = undefined;
      if (!cancelled && el.getAttribute("src") !== src) el.src = src;
    };
    const native = () => {
      if (cancelled) return;
      if (!el.canPlayType("application/vnd.apple.mpegurl")) return fallback();
      el.src = hls!;
      el.addEventListener("error", fallback, { once: true });
    };
    if (!hls) el.src = src;
    else
      void import("hls.js/light")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) return native();
          let retried = false;
          player = new Hls({
            // Sebelum diputar cukup siapkan beberapa detik awal; setelah main, tampung lebih jauh ke depan.
            maxBufferLength: 12,
            maxMaxBufferLength: 90,
            backBufferLength: 30,
            startFragPrefetch: true,
            fragLoadPolicy: { default: { maxTimeToFirstByteMs: 15000, maxLoadTimeMs: 60000, timeoutRetry: { maxNumRetry: 3, retryDelayMs: 0, maxRetryDelayMs: 0 }, errorRetry: { maxNumRetry: 4, retryDelayMs: 800, maxRetryDelayMs: 6000 } } },
          });
          player.on(Hls.Events.ERROR, (_e, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !retried) {
              retried = true;
              player?.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !retried) {
              retried = true;
              player?.recoverMediaError();
            } else fallback();
          });
          el.addEventListener("play", () => player && (player.config.maxBufferLength = 45), { once: true });
          player.loadSource(hls);
          player.attachMedia(el);
        })
        .catch(native);
    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [src, hls]);

  const flash = useCallback((icon: ReactNode, label?: string) => setFeedback({ icon, label, key: Date.now() }), []);

  const wake = useCallback(() => {
    setShown(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const el = video.current;
      if (el && !el.paused) {
        setShown(false);
        setSpeedOpen(false);
      }
    }, HIDE_AFTER);
  }, []);

  const toggle = useCallback(() => {
    const el = v();
    if (!el) return;
    if (el.paused || el.ended) {
      void el.play().catch(() => setError(true));
      flash(<Play className="h-7 w-7 fill-current" />);
    } else {
      el.pause();
      flash(<Pause className="h-7 w-7 fill-current" />);
    }
    wake();
  }, [flash, wake]);

  const seekBy = useCallback(
    (d: number) => {
      const el = v();
      if (!el) return;
      el.currentTime = Math.min(Math.max(0, el.currentTime + d), el.duration || Infinity);
      flash(d < 0 ? <RotateCcw className="h-7 w-7" /> : <RotateCw className="h-7 w-7" />, `${d > 0 ? "+" : ""}${d} detik`);
      wake();
    },
    [flash, wake],
  );

  const setVol = useCallback(
    (next: number, show = true) => {
      const el = v();
      const val = Math.min(1, Math.max(0, next));
      if (el) {
        el.volume = val;
        el.muted = val === 0;
      }
      setVolume(val);
      setMuted(val === 0);
      try {
        if (val > 0) localStorage.setItem(VOL_KEY, String(val));
      } catch {
        /* storage diblokir */
      }
      if (show) flash(val === 0 ? <VolumeX className="h-7 w-7" /> : <Volume2 className="h-7 w-7" />, `${Math.round(val * 100)}%`);
    },
    [flash],
  );

  const toggleMute = useCallback(() => {
    const el = v();
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted && el.volume === 0) el.volume = readVolume();
    setMuted(el.muted);
    setVolume(el.volume);
    flash(el.muted ? <VolumeX className="h-7 w-7" /> : <Volume2 className="h-7 w-7" />);
  }, [flash]);

  const toggleFullscreen = useCallback(() => {
    const el = wrap.current;
    const vid = v() as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => vid?.webkitEnterFullscreen?.());
    else vid?.webkitEnterFullscreen?.(); // Safari iOS hanya mendukung layar penuh pada elemen video.
  }, []);

  const togglePip = useCallback(() => {
    const el = v();
    if (!el) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void el.requestPictureInPicture?.().catch(() => {});
  }, []);

  const changeSpeed = useCallback(
    (s: number) => {
      const el = v();
      if (el) el.playbackRate = s;
      setSpeed(s);
      setSpeedOpen(false);
      flash(<Gauge className="h-7 w-7" />, `${s}×`);
    },
    [flash],
  );

  // Ganti sumber (bagian lain): reset state.
  useEffect(() => {
    setPlaying(false);
    setStarted(false);
    setEnded(false);
    setTime(0);
    setDuration(0);
    setBuffered(0);
    setError(false);
    setShown(true);
    const el = v();
    if (el) {
      el.volume = readVolume();
      el.playbackRate = speed;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Progress halus mengikuti frame saat diputar (timeupdate hanya ±4×/detik).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const el = v();
      if (el && fill.current && el.duration && !scrubbing) fill.current.style.transform = `scaleX(${el.currentTime / el.duration})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, scrubbing]);

  useEffect(() => {
    if (fill.current && duration && (!playing || scrubbing)) fill.current.style.transform = `scaleX(${time / duration})`;
  }, [time, duration, playing, scrubbing]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => () => {
    clearTimeout(hideTimer.current);
    clearTimeout(tapTimer.current);
  }, []);

  // Kontrol muncul/menghilang (GSAP).
  useLayoutEffect(() => {
    const el = controls.current;
    if (!el) return;
    const show = shown || !playing || scrubbing;
    gsap.to(el, { opacity: show ? 1 : 0, y: show ? 0 : 16, duration: show ? 0.3 : 0.45, ease: show ? "power3.out" : "power2.in" });
    if (wrap.current) wrap.current.style.cursor = show ? "" : "none";
  }, [shown, playing, scrubbing]);

  // Gelembung umpan balik di tengah.
  useLayoutEffect(() => {
    if (!feedback || !bubble.current) return;
    gsap.fromTo(bubble.current, { scale: 0.6, opacity: 1 }, { scale: 1.25, opacity: 0, duration: 0.7, ease: "power2.out" });
  }, [feedback]);

  const ratioAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const onBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = v();
    if (!el || !duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    const t = ratioAt(e.clientX) * duration;
    el.currentTime = t;
    setTime(t);
  };
  const onBarMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const p = ratioAt(e.clientX);
    const r = bar.current!.getBoundingClientRect();
    setHover({ x: p * r.width, t: p * duration });
    if (scrubbing && v()) {
      v()!.currentTime = p * duration;
      setTime(p * duration);
    }
    wake();
  };
  const onBarUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setScrubbing(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input")) return;
    const el = v();
    if (!el) return;
    const k = e.key.toLowerCase();
    const map: Record<string, () => void> = {
      " ": toggle,
      k: toggle,
      j: () => seekBy(-SKIP),
      l: () => seekBy(SKIP),
      arrowleft: () => seekBy(-5),
      arrowright: () => seekBy(5),
      arrowup: () => setVol(el.volume + 0.1),
      arrowdown: () => setVol(el.volume - 0.1),
      m: toggleMute,
      f: toggleFullscreen,
    };
    if (map[k]) {
      e.preventDefault();
      map[k]();
    } else if (/^[0-9]$/.test(k) && duration) {
      e.preventDefault();
      el.currentTime = (Number(k) / 10) * duration;
      wake();
    }
  };

  // Layar sentuh: ketuk sekali menampilkan/menyembunyikan kontrol, ketuk dua kali di kiri/kanan lompat 10 detik.
  const onSurfaceUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const side = x < 0.35 ? "l" : x > 0.65 ? "r" : "c";
    const now = Date.now();
    if (now - lastTap.current.t < 300 && side === lastTap.current.side && side !== "c") {
      clearTimeout(tapTimer.current);
      seekBy(side === "l" ? -SKIP : SKIP);
      lastTap.current = { t: 0, side };
      return;
    }
    lastTap.current = { t: now, side };
    clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      if (shown && playing) setShown(false);
      else wake();
    }, 260);
  };

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const btn = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/85 transition hover:bg-white/15 hover:text-white";

  return (
    <div
      ref={wrap}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerMove={wake}
      onPointerLeave={() => {
        setHover(null);
        if (playing) setShown(false);
      }}
      className={cx("group/player relative grid select-none place-items-center overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-brand", fullscreen ? "h-full w-full" : "rounded-2xl")}
      aria-label="Pemutar replay"
    >
      <video
        ref={video}
        poster={poster}
        playsInline
        preload="metadata"
        style={fullscreen ? undefined : { aspectRatio: ratio }}
        className={cx("block bg-black", fullscreen ? "h-full w-full object-contain" : cx("max-h-[78vh] max-w-full", ratio < 1 ? "h-[68vh] w-auto sm:h-[78vh]" : "w-full"))}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (el.videoWidth && el.videoHeight) setRatio(el.videoWidth / el.videoHeight);
          setDuration(el.duration);
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => !scrubbing && setTime(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const el = e.currentTarget;
          if (el.buffered.length && el.duration) setBuffered(el.buffered.end(el.buffered.length - 1) / el.duration);
        }}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          setEnded(false);
          wake();
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          setShown(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
        }}
        onError={() => setError(true)}
      />

      {/* Permukaan klik: klik = putar/jeda, dobel klik = layar penuh, ketuk ganda di HP = lompat. */}
      <div
        className="absolute inset-0"
        onPointerDown={(e) => (pointerType.current = e.pointerType)}
        onClick={() => pointerType.current === "mouse" && toggle()}
        onDoubleClick={() => pointerType.current === "mouse" && toggleFullscreen()}
        onPointerUp={onSurfaceUp}
      />

      {/* Tombol putar besar sebelum mulai / setelah selesai */}
      {(!started || ended) && !error && (
        <button
          type="button"
          onClick={toggle}
          aria-label={ended ? "Putar ulang" : "Putar"}
          className="absolute grid h-20 w-20 place-items-center rounded-full bg-brand text-white shadow-[0_14px_40px_-10px_var(--brand)] transition-transform hover:scale-105"
        >
          {ended ? <RotateCcw className="h-8 w-8" /> : <Play className="ml-1 h-8 w-8 fill-current" />}
        </button>
      )}

      {waiting && started && !error && <Loader2 className="pointer-events-none absolute h-12 w-12 animate-spin text-white/90" />}

      {feedback && (
        <div ref={bubble} key={feedback.key} className="pointer-events-none absolute grid h-20 w-20 place-items-center rounded-full bg-black/55 text-white opacity-0">
          <span className="grid place-items-center gap-0.5">
            {feedback.icon}
            {feedback.label && <span className="font-mono text-[10px] font-semibold">{feedback.label}</span>}
          </span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-white">
          <div>
            <p className="font-bold">Video tidak bisa diputar di browser ini.</p>
            <a href={src} target="_blank" rel="noopener noreferrer" className="btn mt-3 bg-white text-ink hover:bg-butter">
              Buka file video
            </a>
          </div>
        </div>
      )}

      {/* Bar kontrol */}
      <div
        ref={controls}
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2 pt-10 text-white sm:px-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          ref={bar}
          role="slider"
          aria-label="Posisi video"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${fmt(time)} dari ${fmt(duration)}`}
          className="group/bar relative flex h-5 cursor-pointer touch-none items-center"
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={onBarUp}
          onPointerLeave={() => !scrubbing && setHover(null)}
        >
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/bar:h-1.5">
            <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${buffered * 100}%` }} />
            <div ref={fill} className="absolute inset-0 origin-left bg-brand" style={{ transform: "scaleX(0)" }} />
          </div>
          <span
            className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-brand opacity-0 shadow ring-2 ring-white transition-opacity group-hover/bar:opacity-100"
            style={{ left: `${duration ? (time / duration) * 100 : 0}%`, opacity: scrubbing ? 1 : undefined }}
          />
          {hover && (
            <span
              className="pointer-events-none absolute bottom-6 -translate-x-1/2 rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink"
              style={{ left: hover.x }}
            >
              {fmt(hover.t)}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-0.5">
          <button type="button" onClick={toggle} aria-label={playing ? "Jeda (K)" : "Putar (K)"} className={btn}>
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>
          <button type="button" onClick={() => seekBy(-SKIP)} aria-label="Mundur 10 detik (J)" className={btn}>
            <RotateCcw className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={() => seekBy(SKIP)} aria-label="Maju 10 detik (L)" className={btn}>
            <RotateCw className="h-[18px] w-[18px]" />
          </button>
          <div className="group/vol flex items-center">
            <button type="button" onClick={toggleMute} aria-label={muted ? "Bunyikan (M)" : "Bisukan (M)"} className={btn}>
              <VolIcon className="h-[18px] w-[18px]" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(Number(e.target.value), false)}
              aria-label="Volume"
              className="hidden h-1 w-0 cursor-pointer opacity-0 accent-[var(--brand)] transition-[width,opacity] duration-300 group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100 sm:block"
            />
          </div>
          <span className="num ml-2 whitespace-nowrap font-mono text-[12px] text-white/85">
            {fmt(time)} <span className="text-white/45">/ {fmt(duration)}</span>
          </span>

          <span className="flex-1" />

          <div className="relative">
            <button type="button" onClick={() => setSpeedOpen((o) => !o)} aria-label="Kecepatan" aria-expanded={speedOpen} className={cx(btn, "w-auto px-2.5 font-mono text-[12px] font-semibold")}>
              {speed}×
            </button>
            {speedOpen && (
              <ul className="absolute bottom-12 right-0 min-w-[96px] overflow-hidden rounded-xl bg-nav/95 p-1 shadow-xl ring-1 ring-white/10">
                {SPEEDS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => changeSpeed(s)}
                      className={cx("w-full rounded-lg px-3 py-1.5 text-left font-mono text-[12px]", s === speed ? "bg-brand text-white" : "text-white/80 hover:bg-white/10")}
                    >
                      {s === 1 ? "Normal" : `${s}×`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {typeof document !== "undefined" && document.pictureInPictureEnabled && (
            <button type="button" onClick={togglePip} aria-label="Picture-in-picture" className={cx(btn, "hidden sm:grid")}>
              <PictureInPicture2 className="h-[18px] w-[18px]" />
            </button>
          )}
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Keluar layar penuh (F)" : "Layar penuh (F)"} className={btn}>
            {fullscreen ? <Minimize className="h-[18px] w-[18px]" /> : <Maximize className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}
