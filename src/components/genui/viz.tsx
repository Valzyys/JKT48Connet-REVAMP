import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/components/ui";
import { arr, box, Empty, fmt, img, num, obj, str, Title, type P } from "./kit";

const PALETTE = ["var(--color-brand)", "var(--color-ink)", "#f5a524", "#3b82f6", "#16a34a", "#a855f7"];
const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : fmt(Math.round(v * 10) / 10));

/** Muncul bertahap (0 → 1) setelah mount, untuk animasi grafik. */
function useGrow() {
  const [g, setG] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setG(1));
    return () => cancelAnimationFrame(id);
  }, []);
  return g;
}

export function ChartBlock({ p }: { p: P }) {
  const kind = str(p.kind, "bar");
  const labels = arr(p.labels).map((l) => str(l));
  const series = arr(p.series).map(obj).map((s) => ({ name: str(s.name), values: arr(s.values).map((v) => num(v)) }));
  if (!series.length && arr(p.values).length) series.push({ name: str(p.title), values: arr(p.values).map((v) => num(v)) });
  const grow = useGrow();
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(labels.length, ...series.map((s) => s.values.length), 0);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  if (!n) return <Empty>Data grafik kosong.</Empty>;

  if (kind === "donut" || kind === "pie") {
    const vals = series[0]?.values ?? [];
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return (
      <div className={cx(box, "flex flex-wrap items-center gap-5 p-4")}>
        <svg viewBox="0 0 42 42" className="h-32 w-32 -rotate-90">
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--color-surface)" strokeWidth="6" />
          {vals.map((v, i) => {
            const len = (v / total) * 100 * grow;
            const el = <circle key={i} cx="21" cy="21" r="15.9" fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={hover === i ? 7.5 : 6} strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-acc} className="cursor-pointer transition-all duration-700" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
            acc += (v / total) * 100;
            return el;
          })}
        </svg>
        <div className="space-y-1 text-[13px]">
          {str(p.title) && <p className="mb-1 font-bold">{str(p.title)}</p>}
          {vals.map((v, i) => (
            <p key={i} className={cx("flex items-center gap-2", hover === i && "font-bold")}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              {labels[i] ?? `#${i + 1}`} <span className="font-mono text-ink-soft">{Math.round((v / total) * 100)}%</span>
            </p>
          ))}
        </div>
      </div>
    );
  }

  const W = 520;
  const H = 180;
  const pad = 22;
  const step = (W - pad * 2) / Math.max(1, n - (kind === "bar" ? 0 : 1));
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2) * grow;
  return (
    <div className={cx(box, "p-4")}>
      <Title right={series.length > 1 ? <div className="flex gap-3 text-[11.5px]">{series.map((s, i) => <span key={i} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{s.name}</span>)}</div> : undefined}>{str(p.title)}</Title>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={H - pad - f * (H - pad * 2)} y2={H - pad - f * (H - pad * 2)} stroke="var(--color-line)" />
        ))}
        {kind === "bar"
          ? series.map((s, si) =>
              s.values.map((v, i) => {
                const bw = (step * 0.7) / series.length;
                const x = pad + i * step + step * 0.15 + si * bw;
                return (
                  <g key={`${si}-${i}`} onMouseEnter={() => setHover(i)}>
                    <rect x={x} y={y(v)} width={bw - 2} height={Math.max(0, H - pad - y(v))} rx="6" fill={PALETTE[si % PALETTE.length]} opacity={hover === null || hover === i ? 1 : 0.45} className="transition-all duration-700" />
                    {series.length === 1 && <text x={x + bw / 2} y={y(v) - 5} textAnchor="middle" fontSize="11" fill="var(--color-ink)" fontFamily="IBM Plex Mono">{short(v)}</text>}
                  </g>
                );
              }),
            )
          : series.map((s, si) => {
              const pts = s.values.map((v, i) => `${pad + i * step},${y(v)}`).join(" ");
              const color = PALETTE[si % PALETTE.length];
              return (
                <g key={si}>
                  {kind === "area" && <polygon points={`${pad},${H - pad} ${pts} ${pad + (s.values.length - 1) * step},${H - pad}`} fill={color} opacity="0.15" className="transition-all duration-700" />}
                  <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="transition-all duration-700" />
                  {s.values.map((v, i) => (
                    <circle key={i} cx={pad + i * step} cy={y(v)} r={hover === i ? 6 : 3.5} fill={color} className="transition-all" onMouseEnter={() => setHover(i)} />
                  ))}
                </g>
              );
            })}
        {labels.map((l, i) => (
          <text key={i} x={pad + i * step + (kind === "bar" ? step / 2 : 0)} y={H + 12} textAnchor="middle" fontSize="11" fill="var(--color-ink-soft)" fontFamily="IBM Plex Mono">
            {l.slice(0, 8)}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <p className="mt-1 font-mono text-[12px] text-ink-soft">
          {labels[hover] ?? `#${hover + 1}`}: {series.map((s) => `${s.name ? `${s.name} ` : ""}${fmt(s.values[hover] ?? 0)}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

export function TableBlock({ p }: { p: P }) {
  const cols = arr(p.columns).map((c) => str(typeof c === "string" ? c : obj(c).label));
  const rows = arr(p.rows).map((r) => (Array.isArray(r) ? r.map((c) => str(c)) : cols.map((c) => str(obj(r)[c]))));
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.i] ?? "";
      const y = b[sort.i] ?? "";
      const nx = Number(x.replace(/[^\d.-]/g, ""));
      const ny = Number(y.replace(/[^\d.-]/g, ""));
      return (x && y && Number.isFinite(nx) && Number.isFinite(ny) && /\d/.test(x) && /\d/.test(y) ? nx - ny : x.localeCompare(y, "id")) * sort.dir;
    });
  }, [rows, sort]);
  return (
    <div className={cx(box, "overflow-x-auto")}>
      {str(p.title) && <p className="px-4 pt-3 font-bold">{str(p.title)}</p>}
      <table className="w-full text-left text-[13.5px]">
        <thead>
          <tr className="bg-surface">
            {cols.map((c, i) => (
              <th key={i} className="cursor-pointer select-none whitespace-nowrap px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-widest text-ink-soft hover:text-ink" onClick={() => setSort((s) => (s?.i === i ? { i, dir: s.dir === 1 ? -1 : 1 } : { i, dir: 1 }))}>
                {c} {sort?.i === i ? (sort.dir === 1 ? "↑" : "↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 60).map((r, ri) => (
            <tr key={ri} className="border-t border-line transition hover:bg-surface/50">
              {r.map((c, ci) => (
                <td key={ci} className="px-3.5 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HeatmapBlock({ p }: { p: P }) {
  const values = arr(p.values).map((v) => Math.max(0, Math.min(4, Math.round(num(v)))));
  const cols = Math.max(4, Math.min(26, num(p.cols, 18)));
  const shade = ["bg-surface", "bg-brand/25", "bg-brand/50", "bg-brand/75", "bg-brand"];
  return (
    <div className={cx(box, "p-4")}>
      <Title>{str(p.title)}</Title>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: cols * 26 }}>
        {values.slice(0, cols * 8).map((v, i) => (
          <i key={i} title={`${v}`} className={cx("aspect-square rounded-[3px] transition hover:scale-125", shade[v])} />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 font-mono text-[10px] text-ink-soft">
        sedikit {shade.map((c) => <i key={c} className={cx("h-2.5 w-2.5 rounded-[2px]", c)} />)} banyak
      </div>
    </div>
  );
}

export function TimelineBlock({ p }: { p: P }) {
  const items = arr(p.items).map(obj);
  return (
    <div className={cx(box, "p-4")}>
      <Title>{str(p.title)}</Title>
      <ol className="ml-1.5 border-l-2 border-line">
        {items.map((it, i) => (
          <li key={i} className="relative pb-3 pl-5 last:pb-0">
            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-brand ring-4 ring-card" />
            <p className="font-mono text-[11px] text-ink-soft">{str(it.time, str(it.date))}</p>
            <p className="font-semibold leading-snug">{str(it.title)}</p>
            {str(it.text) && <p className="text-[13px] text-ink-soft">{str(it.text)}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function GalleryBlock({ p }: { p: P }) {
  const images = arr(p.images).map((x) => (typeof x === "string" ? { src: img(x), caption: "" } : { src: img(obj(x).src ?? obj(x).image), caption: str(obj(x).caption) })).filter((x) => x.src);
  const [open, setOpen] = useState<number | null>(null);
  if (!images.length) return <Empty>Belum ada gambar.</Empty>;
  return (
    <>
      <div className={cx(box, "grid grid-cols-3 gap-1.5 p-1.5")}>
        {images.slice(0, 12).map((im, i) => (
          <button key={i} type="button" onClick={() => setOpen(i)} className={cx("overflow-hidden rounded-xl", i === 0 && images.length > 2 && "col-span-2 row-span-2")}>
            <img src={im.src} alt={im.caption} loading="lazy" className="h-full max-h-80 w-full object-cover object-top transition duration-500 hover:scale-105" />
          </button>
        ))}
      </div>
      {open !== null &&
        createPortal(
          <div className="fixed inset-0 z-[95] grid place-items-center bg-black/85 p-4" onClick={() => setOpen(null)}>
            <button type="button" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white" aria-label="Tutup">
              <X className="h-5 w-5" />
            </button>
            <figure onClick={(e) => e.stopPropagation()} className="max-w-3xl">
              <img src={images[open].src} alt="" className="max-h-[80vh] rounded-2xl object-contain" />
              <figcaption className="mt-2 flex justify-between text-[13px] text-white/80">
                <span>{images[open].caption}</span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setOpen((open - 1 + images.length) % images.length)}>‹ Sebelumnya</button>
                  <button type="button" onClick={() => setOpen((open + 1) % images.length)}>Berikutnya ›</button>
                </span>
              </figcaption>
            </figure>
          </div>,
          document.body,
        )}
    </>
  );
}

export function TreeBlock({ p }: { p: P }) {
  const kids = arr(p.children).map(obj);
  const [sel, setSel] = useState(() => Math.max(0, kids.findIndex((k) => k.highlight === true)));
  const leaves = arr(kids[sel]?.children).map((x) => (typeof x === "string" ? { name: x } : obj(x)));
  return (
    <div className={cx(box, "p-4 text-center")}>
      <Title>{str(p.title)}</Title>
      <span className="inline-block rounded-full bg-ink px-3 py-1 font-mono text-[11px] font-bold text-bg">{str(p.root, "JKT48")}</span>
      <div className="mx-auto h-4 w-px bg-line" />
      <div className="flex flex-wrap justify-center gap-2 border-t-2 border-line pt-3">
        {kids.map((k, i) => (
          <button key={i} type="button" onClick={() => setSel(i)} className={cx("rounded-full px-3 py-1 font-mono text-[11.5px] font-bold transition", i === sel ? "bg-brand text-white" : "bg-surface text-ink hover:bg-brand/15")}>
            {str(k.name)}
          </button>
        ))}
      </div>
      <div key={sel} className="mt-4 flex animate-[fadein_.35s_ease] flex-wrap justify-center gap-3">
        {leaves.slice(0, 24).map((m, i) => (
          <div key={i} className="w-14 text-[11.5px]">
            {img(m.image) ? <img src={img(m.image)} alt="" loading="lazy" className="mx-auto h-12 w-12 rounded-full object-cover object-top ring-2 ring-brand ring-offset-2 ring-offset-card" /> : <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface font-bold">{str(m.name).slice(0, 1)}</div>}
            <p className="mt-1 truncate">{str(m.name)}</p>
          </div>
        ))}
        {!leaves.length && <p className="text-[13px] text-ink-soft">Pilih generasi di atas.</p>}
      </div>
    </div>
  );
}

export function BeforeAfterBlock({ p }: { p: P }) {
  const [x, setX] = useState(50);
  const a = img(p.before);
  const b = img(p.after);
  if (!a || !b) return <Empty>Dua gambar dibutuhkan untuk perbandingan.</Empty>;
  return (
    <div className={cx(box, "p-1.5")}>
      <div className="relative h-72 select-none overflow-hidden rounded-[18px]">
        <img src={a} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
        <img src={b} alt="" className="absolute inset-0 h-full w-full object-cover object-top" style={{ clipPath: `inset(0 0 0 ${x}%)` }} />
        <div className="pointer-events-none absolute inset-y-0 w-[3px] bg-white shadow" style={{ left: `${x}%` }}>
          <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[#1d1517] shadow">⟷</span>
        </div>
        <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10.5px] text-white">{str(p.beforeLabel, "Dulu")}</span>
        <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10.5px] text-white">{str(p.afterLabel, "Sekarang")}</span>
        <input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} aria-label="Geser perbandingan" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
      {str(p.caption) && <p className="px-2 py-2 text-[13px]"><b>{str(p.caption)}</b> <span className="text-ink-soft">· geser untuk membandingkan</span></p>}
    </div>
  );
}
