import { Download, GripVertical, Minus, Plus, Star } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { arr, box, btnBase, btnStyle, downloadPng, Empty, fmt, img, num, obj, str, Title, useGenUi, type P } from "./kit";

/** Simpan state kecil per komponen di browser (checklist, polling) — kunci dari isi blok. */
function useLocal<T>(key: string, init: T): [T, (v: T) => void] {
  const k = `pip:ui:${key}`;
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch {
      return init;
    }
  });
  return [
    v,
    (nv: T) => {
      setV(nv);
      try {
        localStorage.setItem(k, JSON.stringify(nv));
      } catch {
        /* penyimpanan penuh/diblokir */
      }
    },
  ];
}
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export function FormBlock({ p }: { p: P }) {
  const { send, busy } = useGenUi();
  const fields = arr(p.fields).map(obj).slice(0, 12);
  const [vals, setVals] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(fields.map((f) => [str(f.name, str(f.label)), f.value !== undefined ? (f.value as string | number | boolean) : str(f.kind) === "toggle" ? false : str(f.kind) === "slider" ? num(f.min) : ""])),
  );
  const [sent, setSent] = useState(false);
  return (
    <form
      className={cx(box, "space-y-3 p-4")}
      onSubmit={(e) => {
        e.preventDefault();
        const lines = fields.map((f) => {
          const k = str(f.name, str(f.label));
          const v = vals[k];
          return `- ${str(f.label, k)}: ${typeof v === "boolean" ? (v ? "ya" : "tidak") : String(v)}`;
        });
        send(`${str(p.title, "Form")}\n${lines.join("\n")}`);
        setSent(true);
      }}
    >
      <Title sub={str(p.subtitle)}>{str(p.title)}</Title>
      {fields.map((f, i) => {
        const k = str(f.name, str(f.label));
        const kind = str(f.kind, "text");
        const label = <span className="mb-1 block text-[12.5px] text-ink-soft">{str(f.label, k)}</span>;
        const input = "w-full rounded-2xl border border-line bg-bg px-3.5 py-2.5 text-[14px] outline-none focus:border-brand";
        if (kind === "toggle")
          return (
            <label key={i} className="flex cursor-pointer items-center justify-between text-[14px]">
              {str(f.label, k)}
              <span className={cx("relative h-6 w-11 rounded-full transition", vals[k] ? "bg-brand" : "bg-surface")}>
                <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", vals[k] ? "left-[22px]" : "left-0.5")} />
              </span>
              <input type="checkbox" className="sr-only" checked={Boolean(vals[k])} onChange={(e) => setVals({ ...vals, [k]: e.target.checked })} />
            </label>
          );
        if (kind === "slider")
          return (
            <label key={i} className="block">
              {label}
              <input type="range" min={num(f.min)} max={num(f.max, 100)} step={num(f.step, 1)} value={Number(vals[k])} onChange={(e) => setVals({ ...vals, [k]: Number(e.target.value) })} className="w-full accent-[var(--color-brand)]" />
              <span className="font-mono text-[11.5px] text-ink-soft">
                {String(vals[k])} {str(f.unit)}
              </span>
            </label>
          );
        if (kind === "select")
          return (
            <label key={i} className="block">
              {label}
              <select className={input} value={String(vals[k])} onChange={(e) => setVals({ ...vals, [k]: e.target.value })}>
                <option value="">Pilih…</option>
                {arr(f.options).map((o) => (
                  <option key={str(o)} value={str(o)}>
                    {str(o)}
                  </option>
                ))}
              </select>
            </label>
          );
        return (
          <label key={i} className="block">
            {label}
            <input type={kind === "number" ? "number" : "text"} className={input} value={String(vals[k])} placeholder={str(f.placeholder)} onChange={(e) => setVals({ ...vals, [k]: kind === "number" ? Number(e.target.value) : e.target.value })} />
          </label>
        );
      })}
      <button type="submit" disabled={busy || sent} className={cx(btnBase, btnStyle("primary"), "w-full")}>
        {sent ? "Terkirim ✓" : str(p.submit, "Kirim ke Pip")}
      </button>
    </form>
  );
}

export function QuizBlock({ p }: { p: P }) {
  const { send } = useGenUi();
  const qs = arr(p.questions).map(obj).filter((q) => arr(q.options).length);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  if (!qs.length) return <Empty>Soal kuis kosong.</Empty>;
  const done = i >= qs.length;
  if (done)
    return (
      <div className={cx(box, "p-5 text-center")}>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">{str(p.title, "Kuis")} · selesai</p>
        <p className="mt-2 text-[44px] font-black leading-none text-brand">
          {score}/{qs.length}
        </p>
        <p className="mt-1 text-[14px]">{score === qs.length ? "Sempurna! Kamu fans sejati 🎉" : score >= qs.length / 2 ? "Mantap, hampir semua benar!" : "Ayo coba lagi!"}</p>
        <div className="mt-3 flex justify-center gap-2">
          <button type="button" className={cx(btnBase, btnStyle("secondary"))} onClick={() => { setI(0); setScore(0); setPick(null); }}>Ulangi</button>
          <button type="button" className={cx(btnBase, btnStyle("primary"))} onClick={() => send(`Skor kuis "${str(p.title, "JKT48")}" aku ${score}/${qs.length}. Kasih kuis lanjutan yang lebih sulit!`)}>Kuis lanjutan</button>
        </div>
      </div>
    );
  const q = qs[i];
  const ans = num(q.answer, -1);
  return (
    <div className={cx(box, "p-4")}>
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
        {str(p.title, "Kuis")} · {i + 1}/{qs.length}
      </p>
      <p className="mt-1 text-[16px] font-bold leading-snug">{str(q.q, str(q.question))}</p>
      <div className="mt-3 space-y-2">
        {arr(q.options).map((o, oi) => {
          const state = pick === null ? "" : oi === ans ? "ok" : oi === pick ? "no" : "";
          return (
            <button
              key={oi}
              type="button"
              disabled={pick !== null}
              onClick={() => {
                setPick(oi);
                if (oi === ans) setScore((s) => s + 1);
              }}
              className={cx(
                "flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left text-[14px] transition",
                state === "ok" ? "border-emerald-500 bg-emerald-500/10 font-bold text-emerald-600" : state === "no" ? "animate-[shake_.35s] border-brand bg-brand/5 text-brand" : "border-line hover:border-brand/50",
              )}
            >
              {str(o)} <span>{state === "ok" ? "✓ benar" : state === "no" ? "✗" : ""}</span>
            </button>
          );
        })}
      </div>
      {pick !== null && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-ink-soft">{str(q.explain, `Skor ${score}/${i + 1}`)}</p>
          <button type="button" className={cx(btnBase, btnStyle("secondary"), "shrink-0")} onClick={() => { setI(i + 1); setPick(null); }}>
            {i + 1 < qs.length ? "Soal berikutnya →" : "Lihat skor"}
          </button>
        </div>
      )}
    </div>
  );
}

export function PollBlock({ p }: { p: P }) {
  const options = arr(p.options).map((o) => str(o)).filter(Boolean).slice(0, 8);
  const [vote, setVote] = useLocal<number | null>(`poll:${hash(JSON.stringify(p))}`, null);
  // Persentase tampilan: pilihanmu + sebaran semu yang stabil (polling ini lokal, bukan data bersama).
  const base = useMemo(() => options.map((o) => (parseInt(hash(o), 36) % 40) + 10), [options]);
  const counts = base.map((b, i) => b + (vote === i ? 25 : 0));
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className={cx(box, "p-4")}>
      <Title sub={vote !== null ? "Pilihanmu tersimpan di perangkat ini" : undefined}>{str(p.q, str(p.question))}</Title>
      <div className="space-y-2">
        {options.map((o, i) => (
          <button key={i} type="button" onClick={() => setVote(i)} className={cx("relative flex w-full justify-between overflow-hidden rounded-xl bg-surface px-3.5 py-2.5 text-left text-[14px]", vote === i && "ring-2 ring-brand")}>
            {vote !== null && <span className="absolute inset-y-0 left-0 bg-brand/20 transition-[width] duration-700" style={{ width: `${(counts[i] / total) * 100}%` }} />}
            <span className="relative">{o}</span>
            {vote !== null && <span className="relative font-mono">{Math.round((counts[i] / total) * 100)}%</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChecklistBlock({ p }: { p: P }) {
  const items = arr(p.items).map((x) => str(typeof x === "string" ? x : obj(x).text)).filter(Boolean).slice(0, 20);
  const [done, setDone] = useLocal<number[]>(`check:${hash(items.join("|"))}`, []);
  const pct = items.length ? (done.length / items.length) * 100 : 0;
  return (
    <div className={cx(box, "p-4")}>
      <Title right={<span className="font-mono text-[12px] text-ink-soft">{done.length}/{items.length}</span>}>{str(p.title)}</Title>
      {items.map((t, i) => {
        const on = done.includes(i);
        return (
          <label key={i} className="flex cursor-pointer items-center gap-3 py-1.5 text-[14px]">
            <input type="checkbox" className="sr-only" checked={on} onChange={() => setDone(on ? done.filter((x) => x !== i) : [...done, i])} />
            <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 text-[11px] text-white transition", on ? "scale-105 border-brand bg-brand" : "border-line")}>{on ? "✓" : ""}</span>
            <span className={cx("transition", on && "text-ink-soft line-through")}>{t}</span>
          </label>
        );
      })}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {pct === 100 && <p className="mt-2 text-center text-[13px] font-semibold text-brand">Semua siap! 🎉</p>}
    </div>
  );
}

export function PersonalityBlock({ p }: { p: P }) {
  const { send } = useGenUi();
  const qs = arr(p.questions).map(obj);
  const results = obj(p.results);
  const [i, setI] = useState(0);
  const [tally, setTally] = useState<Record<string, number>>({});
  if (!qs.length) return <Empty>Soal kuis kepribadian kosong.</Empty>;
  if (i >= qs.length) {
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? Object.keys(results)[0];
    const r = obj(results[best]);
    const match = Math.min(99, 70 + Math.round(((tally[best] ?? 0) / qs.length) * 29));
    return (
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-white to-butter p-5 text-[#1d1517]">
        {img(r.image) && <img src={img(r.image)} alt="" className="absolute bottom-0 right-0 h-[90%] [mask-image:linear-gradient(90deg,transparent,#000_35%)]" />}
        <div className="relative max-w-[58%]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] opacity-70">{str(p.title, "Hasil kamu")}</p>
          <p className="mt-2 text-[52px] font-black leading-none text-[#e1243a]">{match}%</p>
          <p className="text-[22px] font-extrabold">{str(r.title, best)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">{arr(r.traits).map((t) => <span key={str(t)} className="rounded-full bg-[#e1243a]/12 px-2.5 py-0.5 text-[12px] font-bold text-[#b9172b]">{str(t)}</span>)}</div>
          <p className="mt-2 text-[13px] opacity-80">{str(r.text)}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={cx(btnBase, "bg-[#e1243a] text-white")} onClick={() => send(`Hasil kuis kepribadianku: ${str(r.title, best)} (${match}%). Ceritakan lebih banyak tentang dia!`)}>Ceritakan dia</button>
            <button type="button" className={cx(btnBase, "bg-black/10")} onClick={() => { setI(0); setTally({}); }}>Ulangi</button>
          </div>
        </div>
      </div>
    );
  }
  const q = qs[i];
  return (
    <div className={cx(box, "p-4")}>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(i / qs.length) * 100}%` }} />
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">{str(p.title, "Kuis kepribadian")} · {i + 1}/{qs.length}</p>
      <p className="mt-1 text-[16px] font-bold">{str(q.q)}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {arr(q.options).map(obj).map((o, oi) => (
          <button key={oi} type="button" onClick={() => { const k = str(o.result); setTally((t) => ({ ...t, [k]: (t[k] ?? 0) + 1 })); setI(i + 1); }} className="rounded-2xl border border-line px-3.5 py-3 text-left text-[14px] transition hover:-translate-y-0.5 hover:border-brand hover:bg-brand/5">
            {str(o.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SimulatorBlock({ p }: { p: P }) {
  const [items, setItems] = useState(() => arr(p.items).map(obj).slice(0, 10).map((x) => ({ name: str(x.name), value: num(x.value, 50), image: img(x.image) })));
  // Skala slider mengikuti data (persen 0–100 atau jumlah suara ribuan).
  const [max] = useState(() => {
    const top = Math.max(0, ...items.map((x) => x.value));
    return top <= 100 ? 100 : Math.ceil((top * 1.5) / 10 ** Math.floor(Math.log10(top))) * 10 ** Math.floor(Math.log10(top));
  });
  const ranked = [...items].sort((a, b) => b.value - a.value);
  const lead = ranked[0]?.value || 1;
  const unit = str(p.unit);
  return (
    <div className={cx(box, "grid gap-4 p-4 sm:grid-cols-2")}>
      <div className="min-w-0">
        <Title sub="Geser untuk mengatur dukungan">{str(p.title, "Simulator")}</Title>
        {items.map((it, i) => (
          <label key={i} className="my-2 grid grid-cols-[64px_1fr_auto] items-center gap-2 text-[13px]">
            <span className="truncate">{it.name}</span>
            <input type="range" min={0} max={max} step={max / 100} value={it.value} onChange={(e) => setItems(items.map((x, xi) => (xi === i ? { ...x, value: Number(e.target.value) } : x)))} className="min-w-0 accent-[var(--color-brand)]" />
            <span className="min-w-[3.5rem] text-right font-mono text-[12px]">{fmt(Math.round(it.value))}</span>
          </label>
        ))}
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-[13px] font-bold">Prediksi peringkat</p>
        {ranked.map((it, i) => (
          <div key={it.name} className="mb-1.5 flex items-center gap-2 text-[13px]">
            <b className="w-4 shrink-0 text-brand">{i + 1}</b>
            <div className="relative h-7 min-w-0 flex-1">
              <div className={cx("absolute inset-y-0 left-0 rounded-lg transition-[width] duration-500", i === 0 ? "bg-gradient-to-r from-brand to-[#ff6476]" : "bg-brand/30")} style={{ width: `${Math.max(6, (it.value / lead) * 100)}%` }} />
              <span className={cx("absolute inset-y-0 left-2 flex items-center truncate font-bold", i === 0 ? "text-white" : "text-ink")}>{it.name}</span>
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-[11px] text-ink-soft">{fmt(Math.round(it.value))}{unit ? ` ${unit}` : ""}</span>
          </div>
        ))}
        <p className="mt-2 font-mono text-[10.5px] text-ink-soft">simulasi hiburan, bukan hasil resmi</p>
      </div>
    </div>
  );
}

export function RatingBlock({ p }: { p: P }) {
  const { send } = useGenUi();
  const [v, setV] = useState(0);
  const [hov, setHov] = useState(0);
  return (
    <div className={cx(box, "flex flex-wrap items-center gap-3 p-4")}>
      <span className="text-[14px]">{str(p.label, "Seberapa membantu?")}</span>
      <div className="flex" onMouseLeave={() => setHov(0)}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} type="button" onMouseEnter={() => setHov(s)} onClick={() => { setV(s); send(`Rating: ${s}/5 bintang${str(p.label) ? ` untuk "${str(p.label)}"` : ""}`); }} className="p-0.5 transition hover:scale-125" aria-label={`${s} bintang`}>
            <Star className={cx("h-6 w-6", (hov || v) >= s ? "fill-[#f5a524] text-[#f5a524]" : "text-ink-soft/40")} />
          </button>
        ))}
      </div>
      {v > 0 && <span className="text-[13px] text-ink-soft">Terima kasih!</span>}
    </div>
  );
}

/** Daftar yang bisa diurutkan dengan seret (mouse/sentuh) — mis. setlist impian. */
export function SortableBlock({ p }: { p: P }) {
  const { send, busy } = useGenUi();
  const [items, setItems] = useState(() => arr(p.items).map((x) => (typeof x === "string" ? { title: x, meta: "" } : { title: str(obj(x).title, str(obj(x).name)), meta: str(obj(x).meta) })).slice(0, 20));
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setItems(next);
    setDrag(to);
  };
  return (
    <div className={cx(box, "overflow-hidden")}>
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="font-bold">{str(p.title, "Urutkan")}</p>
        <span className="font-mono text-[11px] text-ink-soft">{items.length} item · seret untuk mengurutkan</span>
      </div>
      <ol className="mt-2">
        {items.map((it, i) => (
          <li
            key={it.title + i}
            draggable
            onDragStart={() => setDrag(i)}
            onDragEnter={() => drag !== null && move(drag, i)}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => e.preventDefault()}
            className={cx("flex cursor-grab items-center gap-3 border-t border-line bg-card px-4 py-2.5 text-[14px] transition-all", drag === i && "relative z-10 scale-[1.02] rounded-xl shadow-xl ring-2 ring-brand")}
          >
            <GripVertical className="h-4 w-4 text-ink-soft" />
            <span className="w-6 font-mono text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1 font-medium">{it.title}</span>
            <span className="font-mono text-[12px] text-ink-soft">{it.meta}</span>
            <span className="flex flex-col sm:hidden">
              <button type="button" className="px-1 text-ink-soft" onClick={() => move(i, i - 1)} aria-label="Naik">▲</button>
              <button type="button" className="px-1 text-ink-soft" onClick={() => move(i, i + 1)} aria-label="Turun">▼</button>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex gap-2 border-t border-line p-3">
        <button type="button" disabled={busy} className={cx(btnBase, btnStyle("primary"))} onClick={() => send(`${str(p.submit, "Urutanku")}:\n${items.map((x, i) => `${i + 1}. ${x.title}`).join("\n")}`)}>
          {str(p.submit, "Kirim urutan ke Pip")}
        </button>
      </div>
    </div>
  );
}

const TIER_COLORS = ["#ff7a8a", "#fdc78a", "#fde6b0", "#b8e3c4", "#a8d4ff", "#d6c4ff"];

/** Tier list: seret foto ke baris tier (desktop), atau ketuk foto lalu ketuk baris (HP). Bisa diunduh PNG. */
export function TierListBlock({ p }: { p: P }) {
  const tiers = (arr(p.tiers).map((t) => str(t)).filter(Boolean).slice(0, 6).length ? arr(p.tiers).map((t) => str(t)).slice(0, 6) : ["S", "A", "B", "C"]) as string[];
  const items = arr(p.items).map(obj).slice(0, 30).map((x, i) => ({ id: i, name: str(x.name), image: img(x.image) }));
  const [place, setPlace] = useState<Record<number, string>>({});
  const [held, setHeld] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const drop = (tier: string) => {
    if (held === null) return;
    setPlace({ ...place, [held]: tier });
    setHeld(null);
  };
  const Chip = ({ it }: { it: (typeof items)[number] }) => (
    <button
      type="button"
      draggable
      onDragStart={() => setHeld(it.id)}
      onClick={() => setHeld(held === it.id ? null : it.id)}
      title={it.name}
      className={cx("relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface transition", held === it.id && "-translate-y-1 -rotate-6 shadow-lg ring-2 ring-brand")}
    >
      {it.image ? <img src={it.image} alt={it.name} crossOrigin="anonymous" className="h-full w-full object-cover object-top" /> : <span className="grid h-full place-items-center text-[10px] font-bold">{it.name.slice(0, 6)}</span>}
    </button>
  );
  return (
    <div className={cx(box, "overflow-hidden")}>
      <div ref={ref} className="bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="font-bold">{str(p.title, "Tier list")}</p>
          <button type="button" className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-ink-soft" onClick={() => void downloadPng(ref, str(p.title, "tier-list"))}>
            <Download className="h-3 w-3" /> PNG
          </button>
        </div>
        {tiers.map((t, ti) => (
          <div key={t} className="grid grid-cols-[52px_1fr] border-t border-line" onDragOver={(e) => e.preventDefault()} onDrop={() => drop(t)} onClick={() => held !== null && drop(t)}>
            <div className="grid place-items-center text-[22px] font-black text-[#1d1517]" style={{ background: TIER_COLORS[ti] }}>
              {t}
            </div>
            <div className={cx("flex min-h-[60px] flex-wrap items-center gap-1.5 p-1.5 transition", held !== null && "bg-brand/5")}>
              {items.filter((it) => place[it.id] === t).map((it) => <Chip key={it.id} it={it} />)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-line p-2.5" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (held !== null) { const n = { ...place }; delete n[held]; setPlace(n); setHeld(null); } }}>
        <span className="font-mono text-[11px] text-ink-soft">{held !== null ? "Ketuk baris tier →" : "Belum ditempatkan →"}</span>
        {items.filter((it) => !place[it.id]).map((it) => <Chip key={it.id} it={it} />)}
      </div>
    </div>
  );
}

export function CalculatorBlock({ p }: { p: P }) {
  const [items, setItems] = useState(() => arr(p.items).map(obj).slice(0, 12).map((x) => ({ label: str(x.label), price: num(x.price), qty: Math.max(0, num(x.qty, 1)) })));
  const total = items.reduce((a, b) => a + b.price * b.qty, 0);
  const days = Math.max(1, num(p.days, 30));
  return (
    <div className={cx(box, "p-4")}>
      <Title>{str(p.title, "Kalkulator")}</Title>
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between gap-2 border-b border-dashed border-line py-1.5 text-[13.5px]">
          <span className="min-w-0 flex-1 truncate">{it.label}</span>
          <span className="inline-flex items-center rounded-full border border-line">
            <button type="button" className="px-2 py-1" onClick={() => setItems(items.map((x, xi) => (xi === i ? { ...x, qty: Math.max(0, x.qty - 1) } : x)))} aria-label="Kurangi"><Minus className="h-3 w-3" /></button>
            <span className="w-6 text-center font-bold tabular-nums">{it.qty}</span>
            <button type="button" className="px-2 py-1" onClick={() => setItems(items.map((x, xi) => (xi === i ? { ...x, qty: x.qty + 1 } : x)))} aria-label="Tambah"><Plus className="h-3 w-3" /></button>
          </span>
          <span className="w-28 text-right font-mono">Rp{fmt(it.price * it.qty)}</span>
        </div>
      ))}
      <div className="mt-3 flex items-end justify-between">
        <span className="text-[13px] text-ink-soft">Total</span>
        <span className="text-[30px] font-black text-brand tabular-nums">Rp{fmt(total)}</span>
      </div>
      <p className="font-mono text-[11px] text-ink-soft">≈ nabung Rp{fmt(Math.ceil(total / days))}/hari selama {days} hari</p>
    </div>
  );
}
