import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Info, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cx } from "@/components/ui";
import { safeLink } from "@/lib/genui";
import { Markdown } from "./markdown";
import { Actions, arr, box, btnBase, btnStyle, Empty, fmt, img, num, obj, str, Title, useGenUi, type P } from "./kit";

/* ── dasar ─────────────────────────────────────────────── */

export function TextBlock({ p }: { p: P }) {
  return (
    <div className="text-[15px] leading-[1.7] text-ink/90">
      <Markdown text={str(p.md, str(p.text))} />
    </div>
  );
}

export function ButtonsBlock({ p }: { p: P }) {
  return <Actions items={p.items ?? p.buttons ?? p.actions} />;
}

export function ChipsBlock({ p }: { p: P }) {
  const { send, busy } = useGenUi();
  const items = arr(p.items ?? p.options).map((x) => (typeof x === "string" ? x : str(obj(x).label)));
  return (
    <div className="flex flex-wrap gap-2">
      {items.filter(Boolean).slice(0, 10).map((t) => (
        <button key={t} type="button" disabled={busy} onClick={() => send(t)} className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-ink-soft transition hover:-translate-y-0.5 hover:border-brand hover:text-brand disabled:opacity-50">
          {t}
        </button>
      ))}
    </div>
  );
}

const TONES = {
  info: { icon: Info, cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  warn: { icon: AlertTriangle, cls: "bg-butter text-[#7a4a00]" },
  success: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  error: { icon: XCircle, cls: "bg-brand/10 text-brand" },
} as const;

export function CalloutBlock({ p }: { p: P }) {
  const tone = TONES[str(p.tone, "info") as keyof typeof TONES] ?? TONES.info;
  const Icon = tone.icon;
  return (
    <div className={cx("flex gap-3 rounded-2xl px-4 py-3 text-[14px]", tone.cls)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {str(p.title) && <p className="font-bold">{str(p.title)}</p>}
        <p>{str(p.text, str(p.body))}</p>
      </div>
    </div>
  );
}

export function CardBlock({ p }: { p: P }) {
  const image = img(p.image);
  return (
    <div className={cx(box, "overflow-hidden")}>
      {image && <img src={image} alt="" loading="lazy" className="max-h-64 w-full object-cover" />}
      <div className="p-4">
        <Title sub={str(p.subtitle)}>{str(p.title)}</Title>
        {str(p.text, str(p.body)) && <div className="text-[14px] text-ink/85"><Markdown text={str(p.text, str(p.body))} /></div>}
        <Actions items={p.actions ?? p.buttons} className="mt-3" />
      </div>
    </div>
  );
}

export function KvBlock({ p }: { p: P }) {
  const items = arr(p.items).map(obj);
  return (
    <div className={cx(box, "p-4")}>
      <Title>{str(p.title)}</Title>
      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[14px]">
        {items.map((it, i) => (
          <div key={i} className="contents">
            <dt className="text-ink-soft">{str(it.k, str(it.label))}</dt>
            <dd className="font-medium">{str(it.v, str(it.value))}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const DividerBlock = () => <hr className="border-line" />;

export function ProgressBlock({ p }: { p: P }) {
  const max = num(p.max, 100) || 100;
  const pct = Math.max(0, Math.min(100, (num(p.value) / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <span>{str(p.label)}</span>
        <span className="font-mono text-ink-soft">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── data JKT48 ─────────────────────────────────────────── */

export function MemberCard({ p }: { p: P }) {
  const image = img(p.image);
  const info = arr(p.info).map(obj);
  const id = str(p.id);
  const actions = arr(p.actions).length ? p.actions : id ? [{ label: "Lihat profil", href: `/member/${id}` }, { label: "Jadwal theater-nya", value: `Jadwal theater ${str(p.name)}`, style: "secondary" }] : [];
  return (
    <div className={cx(box, "flex gap-4 p-3.5")}>
      {image && <img src={image} alt={str(p.name)} loading="lazy" className="h-36 w-28 shrink-0 rounded-2xl bg-surface object-cover object-top" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[18px] font-bold leading-tight">{str(p.name)}</p>
          {str(p.status) && <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-brand">{str(p.status)}</span>}
        </div>
        {str(p.nickname) && <p className="text-[13px] text-ink-soft">“{str(p.nickname)}”{str(p.subtitle) ? ` · ${str(p.subtitle)}` : ""}</p>}
        {info.length > 0 && (
          <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[13.5px]">
            {info.map((it, i) => (
              <div key={i} className="contents">
                <dt className="text-ink-soft">{str(it.k, str(it.label))}</dt>
                <dd>{str(it.v, str(it.value))}</dd>
              </div>
            ))}
          </dl>
        )}
        <Actions items={actions} className="mt-2" />
      </div>
    </div>
  );
}

export function LiveCard({ p }: { p: P }) {
  const image = img(p.image) || img(p.banner);
  const href = safeLink(str(p.href, str(p.watch)));
  const body = (
    <div className={cx(box, "group relative h-48 overflow-hidden")}>
      {image ? <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[center_22%] transition duration-700 group-hover:scale-105" /> : <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-strong" />}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-widest text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live · {str(p.platform) === "idn" ? "IDN" : "Showroom"}
      </span>
      <div className="absolute inset-x-3 bottom-3 text-white">
        <p className="text-[17px] font-bold leading-tight">{str(p.name)}</p>
        <p className="text-[12.5px] opacity-80">{[str(p.since) && `sejak ${str(p.since)}`, num(p.viewers) ? `${fmt(num(p.viewers))} penonton` : ""].filter(Boolean).join(" · ") || str(p.title)}</p>
      </div>
    </div>
  );
  if (!href) return body;
  return /^https:/.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{body}</a> : <Link to={href}>{body}</Link>;
}

export function ScheduleBlock({ p }: { p: P }) {
  const items = arr(p.items).map(obj);
  if (!items.length) return <Empty>Belum ada jadwal.</Empty>;
  return (
    <div className={cx(box, "divide-y divide-line overflow-hidden")}>
      {str(p.title) && <p className="px-4 pt-3 text-[15px] font-bold">{str(p.title)}</p>}
      {items.map((it, i) => {
        const d = new Date(str(it.date));
        const ok = !Number.isNaN(d.getTime());
        const href = safeLink(str(it.href, str(it.page)));
        const members = arr(it.members).map((m) => (typeof m === "string" ? m : str(obj(m).name))).filter(Boolean);
        return (
          <div key={i} className="flex items-center gap-3.5 px-4 py-3">
            <div className="w-14 shrink-0 rounded-2xl bg-surface py-1.5 text-center">
              <p className="font-mono text-[10px] uppercase text-ink-soft">{ok ? d.toLocaleDateString("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" }) : "—"}</p>
              <p className="text-[22px] font-bold leading-none">{ok ? d.toLocaleDateString("id-ID", { day: "2-digit", timeZone: "Asia/Jakarta" }) : "?"}</p>
              <p className="font-mono text-[10px] uppercase text-ink-soft">{ok ? d.toLocaleDateString("id-ID", { month: "short", timeZone: "Asia/Jakarta" }) : ""}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-snug">{str(it.title)}</p>
              <p className="text-[13px] text-ink-soft">{[ok && `${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`, str(it.team), members.length ? `${members.length} member` : ""].filter(Boolean).join(" · ")}</p>
              {members.length > 0 && <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-soft/80">{members.join(", ")}</p>}
            </div>
            {href && (
              <Link to={href} className={cx(btnBase, btnStyle("secondary"), "shrink-0")}>
                Detail
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CountdownBlock({ p }: { p: P }) {
  const to = Date.parse(str(p.to, str(p.date)));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, (Number.isFinite(to) ? to : now) - now);
  const parts: [number, string][] = [
    [Math.floor(left / 86_400_000), "hari"],
    [Math.floor(left / 3_600_000) % 24, "jam"],
    [Math.floor(left / 60_000) % 60, "menit"],
    [Math.floor(left / 1000) % 60, "detik"],
  ];
  return (
    <div className={cx(box, "p-4 text-center")}>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-soft">{str(p.kicker, "Hitung mundur")}</p>
      <p className="mt-1 text-[17px] font-bold">{str(p.title)}</p>
      <div className="my-3 flex justify-center gap-2">
        {parts.map(([v, l]) => (
          <div key={l} className="w-16 rounded-2xl bg-surface py-2">
            <p className="font-mono text-[26px] font-bold leading-none text-brand tabular-nums">{String(v).padStart(2, "0")}</p>
            <p className="text-[11px] text-ink-soft">{l}</p>
          </div>
        ))}
      </div>
      {left === 0 && Number.isFinite(to) && <p className="mb-2 text-[13px] font-semibold text-brand">Sudah dimulai! 🎉</p>}
      <Actions items={p.actions} className="justify-center" />
    </div>
  );
}

export function StatsBlock({ p }: { p: P }) {
  const items = arr(p.items).map(obj).slice(0, 8);
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map((it, i) => {
        const delta = str(it.delta);
        const down = delta.trim().startsWith("-") || delta.includes("▼");
        return (
          <div key={i} className={cx(box, "p-3.5")}>
            <p className="text-[12.5px] text-ink-soft">{str(it.label)}</p>
            <p className="text-[26px] font-extrabold leading-tight tabular-nums">{str(it.value)}</p>
            {delta && <p className={cx("font-mono text-[11.5px] font-semibold", down ? "text-brand" : "text-emerald-600")}>{down ? "▼" : "▲"} {delta.replace(/^[▲▼+-]\s*/, "")}</p>}
            {str(it.hint) && <p className="font-mono text-[11px] text-ink-soft">{str(it.hint)}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function MemberGrid({ p }: { p: P }) {
  const items = arr(p.items).map(obj);
  const filters = arr(p.filters).map((f) => str(f)).filter(Boolean);
  const [q, setQ] = useState("");
  const [on, setOn] = useState<string[]>([]);
  const shown = useMemo(
    () =>
      items.filter((m) => {
        const tags = arr(m.tags).map((t) => str(t).toLowerCase());
        return (!q || `${str(m.name)} ${str(m.nickname)}`.toLowerCase().includes(q.toLowerCase())) && on.every((f) => tags.includes(f.toLowerCase()));
      }),
    [items, q, on],
  );
  return (
    <div className={cx(box, "p-3")}>
      <Title>{str(p.title)}</Title>
      <label className="flex items-center gap-2 rounded-full border border-line bg-bg px-3.5 py-2 text-[13px]">
        <Search className="h-4 w-4 text-ink-soft" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari member…" className="flex-1 bg-transparent outline-none" />
      </label>
      {filters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button key={f} type="button" onClick={() => setOn((v) => (v.includes(f) ? v.filter((x) => x !== f) : [...v, f]))} className={cx("rounded-full border px-3 py-1 text-[12.5px] transition", on.includes(f) ? "border-brand bg-brand/10 text-brand" : "border-line text-ink-soft")}>
              {f}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {shown.slice(0, 40).map((m, i) => {
          const id = str(m.id);
          const inner = (
            <>
              {img(m.image) ? <img src={img(m.image)} alt="" loading="lazy" className="aspect-[3/4] w-full rounded-xl bg-surface object-cover object-top transition group-hover:-translate-y-0.5" /> : <div className="aspect-[3/4] rounded-xl bg-surface" />}
              <p className="mt-1 truncate text-[12px] font-bold">{str(m.nickname, str(m.name))}</p>
            </>
          );
          return id ? (
            <Link key={i} to="/member/$id" params={{ id }} className="group text-center">
              {inner}
            </Link>
          ) : (
            <div key={i} className="text-center">
              {inner}
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[11px] text-ink-soft">
        {shown.length} dari {items.length} member
      </p>
    </div>
  );
}

export function CompareBlock({ p }: { p: P }) {
  const L = obj(p.left);
  const R = obj(p.right);
  const rows = arr(p.rows).map(obj);
  const Face = ({ m, ring }: { m: P; ring: string }) => (
    <div className="text-center">
      {img(m.image) ? <img src={img(m.image)} alt="" className={cx("mx-auto h-20 w-20 rounded-full object-cover object-top ring-2 ring-offset-2 ring-offset-card", ring)} /> : <div className="mx-auto h-20 w-20 rounded-full bg-surface" />}
      <p className="mt-1.5 font-bold">{str(m.name)}</p>
    </div>
  );
  return (
    <div className={cx(box, "p-4")}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Face m={L} ring="ring-brand" />
        <span className="font-mono text-[12px] text-ink-soft">VS</span>
        <Face m={R} ring="ring-ink" />
      </div>
      <div className="mt-4 space-y-2.5">
        {rows.map((r, i) => {
          const a = num(r.left);
          const b = num(r.right);
          const m = Math.max(a, b, 1);
          return (
            <div key={i} className="grid grid-cols-[1fr_110px_1fr] items-center gap-2 text-[12.5px]">
              <div className="flex items-center justify-end gap-2">
                <span className="font-mono">{fmt(a)}</span>
                <div className="h-2 rounded-full bg-brand transition-[width] duration-700" style={{ width: `${(a / m) * 70}%` }} />
              </div>
              <span className="text-center text-ink-soft">{str(r.label)}</span>
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-ink/70 transition-[width] duration-700" style={{ width: `${(b / m) * 70}%` }} />
                <span className="font-mono">{fmt(b)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

