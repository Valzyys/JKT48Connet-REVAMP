import { Download, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { cx } from "@/components/ui";
import { arr, box, btnBase, btnStyle, downloadPng, Empty, fmt, img, num, obj, str, Title, type P } from "./kit";

/* ── JKT48 Wrapped (stories) ────────────────────────────── */

const STORY_BG: Record<string, string> = {
  red: "bg-gradient-to-br from-[#ff6476] via-brand to-[#5b0d18] text-white",
  dark: "bg-gradient-to-br from-[#2a1e21] to-[#0d0809] text-white",
  butter: "bg-gradient-to-br from-butter to-[#f5c96a] text-[#3a2600]",
  black: "bg-[#0b0708] text-white",
};
const STORY_MS = 5000;

export function StoriesBlock({ p }: { p: P }) {
  const slides = arr(p.slides).map(obj).filter((s) => str(s.big) || str(s.title) || img(s.image)).slice(0, 10);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [t, setT] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (paused || !slides.length) return;
    const id = window.setInterval(() => setT((v) => Math.min(STORY_MS, v + 100)), 100);
    return () => window.clearInterval(id);
  }, [paused, slides.length]);
  useEffect(() => {
    if (t >= STORY_MS && i + 1 < slides.length) {
      setI(i + 1);
      setT(0);
    }
  }, [t, i, slides.length]);
  if (!slides.length) return <Empty>Belum ada slide.</Empty>;
  const s = slides[i];
  const go = (d: number) => {
    setI((k) => Math.max(0, Math.min(slides.length - 1, k + d)));
    setT(0);
  };
  return (
    <div className="max-w-sm">
      <div
        ref={ref}
        className={cx("relative isolate aspect-[9/16] max-h-[560px] w-full select-none overflow-hidden rounded-[26px]", STORY_BG[str(s.theme, "red")] ?? STORY_BG.red)}
        onPointerDown={() => setPaused(true)}
        onPointerUp={(e) => {
          setPaused(false);
          const r = e.currentTarget.getBoundingClientRect();
          go(e.clientX - r.left < r.width / 3 ? -1 : 1);
        }}
        onPointerLeave={() => setPaused(false)}
      >
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
          {slides.map((_, k) => (
            <i key={k} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
              <b className="block h-full bg-white" style={{ width: `${k < i ? 100 : k === i ? (t / STORY_MS) * 100 : 0}%` }} />
            </i>
          ))}
        </div>
        {img(s.image) && <img src={img(s.image)} crossOrigin="anonymous" alt="" className="absolute inset-x-0 bottom-0 -z-10 h-[62%] w-full object-cover object-top [mask-image:linear-gradient(to_bottom,transparent,black_45%)]" />}
        <div key={i} className="relative z-10 animate-[fadein_.45s_ease] px-6 pt-12">
          {str(s.kicker) && <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-80">{str(s.kicker)}</p>}
          {str(s.big) && <p className="mt-2 text-[64px] font-black leading-none tracking-tight">{str(s.big)}</p>}
          {str(s.title) && <p className="mt-2 text-[26px] font-extrabold leading-tight [text-wrap:balance]">{str(s.title)}</p>}
          {str(s.text) && <p className="mt-2 text-[14px] opacity-85">{str(s.text)}</p>}
        </div>
        <p className="absolute bottom-4 left-6 z-10 rounded-full bg-black/40 px-2.5 py-1 font-mono text-[10.5px] text-white backdrop-blur-sm">JKT48 Wrapped · jkt48connect.app</p>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" className={cx(btnBase, btnStyle("secondary"))} onClick={() => setPaused(!paused)}>{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
        <button type="button" className={cx(btnBase, btnStyle("secondary"))} onClick={() => (setI(0), setT(0))} aria-label="Ulangi"><RotateCcw className="h-4 w-4" /></button>
        <button type="button" className={cx(btnBase, btnStyle("ghost"))} onClick={() => void downloadPng(ref, `wrapped-${i + 1}`)}><Download className="h-4 w-4" /> Slide ini</button>
      </div>
    </div>
  );
}

/* ── kartu holografis ───────────────────────────────────── */

const RARITY: Record<string, string> = { R: "from-[#cfd6e3] to-[#8f9bb3]", SR: "from-[#fde6b0] to-[#e0a93a]", UR: "from-[#ff8aa0] via-[#b28dff] to-[#6ee7ff]" };

function HoloCard({ c, i }: { c: P; i: number }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0, mx: 50, my: 50 });
  const [flip, setFlip] = useState(false);
  const rarity = str(c.rarity, "R").toUpperCase();
  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ x: (0.5 - py) * 22, y: (px - 0.5) * 22, mx: px * 100, my: py * 100 });
  };
  useEffect(() => {
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const y = Math.max(-1, Math.min(1, e.gamma / 30));
      const x = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      setTilt({ x: -x * 14, y: y * 14, mx: 50 + y * 40, my: 50 + x * 40 });
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, []);
  return (
    <button
      type="button"
      onPointerMove={move}
      onPointerLeave={() => setTilt({ x: 0, y: 0, mx: 50, my: 50 })}
      onClick={() => setFlip(!flip)}
      className="w-[172px] shrink-0 animate-[fadein_.5s_ease_both] [perspective:900px]"
      style={{ animationDelay: `${i * 120}ms` }}
      aria-label={`Kartu ${str(c.name)}, ketuk untuk membalik`}
    >
      <div className="relative aspect-[5/7] transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y + (flip ? 180 : 0)}deg)` }}>
        <div className={cx("absolute inset-0 overflow-hidden rounded-[18px] bg-gradient-to-br p-[3px] shadow-[0_18px_40px_-18px_rgba(0,0,0,.55)] [backface-visibility:hidden]", RARITY[rarity] ?? RARITY.R)}>
          <div className="relative h-full overflow-hidden rounded-[15px] bg-ink">
            {img(c.image) && <img src={img(c.image)} alt="" className="h-full w-full object-cover object-top" />}
            <div className="pointer-events-none absolute inset-0 mix-blend-color-dodge" style={{ background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,.55), transparent 45%), linear-gradient(${115 + tilt.y * 3}deg, transparent 20%, rgba(255,120,200,.35) 35%, rgba(120,220,255,.35) 50%, rgba(255,240,140,.35) 65%, transparent 80%)`, opacity: rarity === "R" ? 0.35 : 0.85 }} />
            <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[10px] font-bold text-white">{rarity}</span>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 text-left text-white">
              <p className="text-[15px] font-black leading-tight">{str(c.name)}</p>
              {str(c.subtitle) && <p className="text-[10.5px] opacity-80">{str(c.subtitle)}</p>}
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col justify-center gap-1.5 rounded-[18px] bg-gradient-to-br from-[#2a1e21] to-[#0d0809] p-4 text-left text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="mb-1 text-[14px] font-black">{str(c.name)}</p>
          {arr(c.stats).map(obj).slice(0, 6).map((s, k) => (
            <div key={k} className="text-[11px]">
              <div className="flex justify-between"><span className="opacity-75">{str(s.label)}</span><b>{str(s.value)}</b></div>
              <div className="mt-0.5 h-1 rounded-full bg-white/15"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, num(s.value))}%` }} /></div>
            </div>
          ))}
          <p className="mt-auto font-mono text-[9.5px] opacity-60">JKT48Connect · koleksi</p>
        </div>
      </div>
    </button>
  );
}

export function HoloCardsBlock({ p }: { p: P }) {
  const cards = arr(p.cards).map(obj).filter((c) => str(c.name)).slice(0, 10);
  const key = `pip:pack:${new Date().toISOString().slice(0, 10)}`;
  const [opened, setOpened] = useState(() => {
    try {
      return cards.length <= 3 || localStorage.getItem(key) === "1";
    } catch {
      return true;
    }
  });
  if (!cards.length) return <Empty>Belum ada kartu.</Empty>;
  return (
    <div className={cx(box, "p-4")}>
      <Title sub={opened ? "Gerakkan kursor / miringkan HP · ketuk untuk membalik" : "Satu pack per hari"}>{str(p.title, "Kartu koleksi")}</Title>
      {opened ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1">{cards.map((c, i) => <HoloCard key={i} c={c} i={i} />)}</div>
      ) : (
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(key, "1");
            } catch {
              /* tetap buka */
            }
            setOpened(true);
          }}
          className="mx-auto grid aspect-[5/7] w-44 animate-[shake_1.6s_ease-in-out_infinite] place-items-center rounded-[20px] bg-gradient-to-br from-[#ff8aa0] via-brand to-[#5b0d18] text-center font-black text-white shadow-[0_20px_40px_-18px_rgba(225,36,58,.8)]"
        >
          <span>✦<br />Buka pack<br />harian</span>
        </button>
      )}
    </div>
  );
}

/* ── bar chart race ─────────────────────────────────────── */

export function BarRaceBlock({ p }: { p: P }) {
  const frames = arr(p.frames).map(obj).filter((f) => arr(f.items).length).slice(0, 40);
  const [f, setF] = useState(0);
  const [play, setPlay] = useState(true);
  useEffect(() => {
    if (!play || frames.length < 2) return;
    const id = window.setInterval(() => setF((k) => Math.min(frames.length - 1, k + 1)), 1400);
    return () => window.clearInterval(id);
  }, [play, frames.length]);
  useEffect(() => {
    if (f >= frames.length - 1) setPlay(false);
  }, [f, frames.length]);
  if (!frames.length) return <Empty>Belum ada data.</Empty>;
  const items = arr(frames[f].items).map(obj).map((it) => ({ name: str(it.name), value: num(it.value), image: img(it.image) })).filter((it) => it.name);
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, 10);
  const rank = new Map(sorted.map((it, k) => [it.name, k]));
  const max = sorted[0]?.value || 1;
  const all = Array.from(new Set(frames.flatMap((fr) => arr(fr.items).map((it) => str(obj(it).name))))).filter((n) => rank.has(n));
  const ROW = 34;
  return (
    <div className={cx(box, "p-4")}>
      <Title right={<span className="font-mono text-[22px] font-black text-brand">{str(frames[f].label)}</span>}>{str(p.title, "Bar race")}</Title>
      <div className="relative" style={{ height: sorted.length * ROW }}>
        {all.map((name) => {
          const it = sorted[rank.get(name) ?? 0];
          const k = rank.get(name) ?? 0;
          return (
            <div key={name} className="absolute inset-x-0 flex items-center gap-2 transition-transform duration-700 ease-out" style={{ transform: `translateY(${k * ROW}px)`, height: ROW - 6 }}>
              <span className="w-20 shrink-0 truncate text-right text-[12px] font-bold">{name}</span>
              <div className="relative h-full flex-1">
                <div className={cx("flex h-full items-center justify-end rounded-r-lg pr-1 transition-[width] duration-700 ease-out", k === 0 ? "bg-brand" : "bg-brand/55")} style={{ width: `${Math.max(4, (it.value / max) * 100)}%` }}>
                  {it.image && <img src={it.image} alt="" className="h-[22px] w-[22px] rounded-full object-cover object-top ring-2 ring-card" />}
                </div>
              </div>
              <span className="w-14 shrink-0 font-mono text-[11.5px] tabular-nums">{fmt(it.value)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => (f + 1 >= frames.length ? (setF(0), setPlay(true)) : setPlay(!play))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white" aria-label={play ? "Jeda" : "Putar"}>
          {play ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
        </button>
        <input type="range" min={0} max={frames.length - 1} value={f} onChange={(e) => (setPlay(false), setF(Number(e.target.value)))} className="flex-1 accent-[var(--color-brand)]" aria-label="Bingkai" />
      </div>
    </div>
  );
}
