import { ArrowUp, Cake, Check, ChevronDown, Code2, Copy, Info, Newspaper, PenSquare, Radio, RefreshCw, Sparkles, Square, Ticket, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/components/ui";
import { gsap } from "@/lib/gsap";

/* ───────────────────────────── Data ───────────────────────────── */

const MODELS = [
  { id: "pip", label: "Pip", desc: "Asisten umum: live, jadwal theater, member, ulang tahun, berita." },
  { id: "pip-code", label: "Pip Code", desc: "Fokus kode: integrasi API JKT48Connect, bot Discord, script." },
  { id: "pip-docs", label: "Pip Docs", desc: "Fokus dokumentasi: menjelaskan endpoint dan cara pakainya." },
] as const;
type ModelId = (typeof MODELS)[number]["id"];

const SUGGEST = [
  { icon: Radio, title: "Siapa yang live?", prompt: "Siapa member JKT48 yang sedang live sekarang?" },
  { icon: Ticket, title: "Jadwal theater", prompt: "Jadwal show theater JKT48 berikutnya apa saja, dan siapa yang tampil?" },
  { icon: Cake, title: "Ulang tahun terdekat", prompt: "Siapa member JKT48 yang ulang tahun dalam waktu dekat?" },
  { icon: Newspaper, title: "Berita terbaru", prompt: "Rangkum berita JKT48 terbaru." },
  { icon: Sparkles, title: "Profil member", prompt: "Ceritakan profil Freya JKT48." },
  { icon: Code2, title: "Contoh kode API", prompt: "Contoh kode Node.js untuk mengambil data member yang sedang live dari API JKT48Connect." },
];

const LIMITS: [string, string][] = [
  ["20", "request inferensi / menit"],
  ["500", "request / hari (UTC)"],
  ["1 MiB", "ukuran body maksimal"],
  ["16384", "token output maksimal"],
  ["300 dtk", "deadline upstream"],
];

const STATUS: [string, string][] = [
  ["400", "Input atau fitur tidak didukung"],
  ["401", "API key tidak valid atau sudah dicabut"],
  ["413", "Body terlalu besar, ringkas konteks"],
  ["429", "Batas gateway atau upstream tercapai"],
  ["501", "Penghitungan token persis tidak tersedia"],
  ["502", "Upstream gagal atau sesi kedaluwarsa"],
  ["503", "Gateway nonaktif atau belum dikonfigurasi"],
];

const TOOL_LABEL: Record<string, string> = {
  live_now: "Mengecek member yang sedang live",
  theater_schedule: "Membaca jadwal theater",
  member_profile: "Membuka profil member",
  upcoming_birthdays: "Melihat ulang tahun terdekat",
  latest_news: "Membaca berita terbaru",
};

type ToolStep = { id: string; name: string; args: string; ok?: boolean; summary?: string };
type Assistant = { role: "assistant"; text: string; tools: ToolStep[]; done: boolean; error?: { status: number; message: string }; rounds?: number };
type Turn = { role: "user"; text: string } | Assistant;

/* ───────────────────────────── ASCII kecil ───────────────────────────── */

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function useTick(ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => v + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return i;
}

/** Indikator "berpikir" ala terminal: spinner braille + bar ASCII berjalan. */
function Thinking({ label }: { label: string }) {
  const i = useTick(80);
  const bar = Array.from({ length: 10 }, (_, k) => ((k + i) % 10 < 3 ? "▓" : "░")).join("");
  return (
    <p className="flex items-center gap-2 font-mono text-[13px] text-ink-soft" aria-live="polite">
      <span className="text-brand">{SPIN[i % SPIN.length]}</span>
      <span className="shimmer-text">{label}</span>
      <span className="text-brand/60">{bar}</span>
    </p>
  );
}

const LOGO = [" ▄▀▀▄ ▀█▀ ▄▀▀▄", " █▄▄▀  █  █▄▄▀", " █    ▄█▄ █   "].join("\n");
const NOISE = "▓▒░#%&@$*+=";

/** Logo ASCII kecil "PIP" yang tersusun dari noise, lalu sesekali glitch. */
function AsciiMark({ className }: { className?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = LOGO;
      return;
    }
    const scramble = (p: number) => [...LOGO].map((ch, i) => (ch === "\n" || ch === " " ? ch : (i / LOGO.length) * 0.6 + Math.random() * 0.4 < p ? ch : NOISE[(Math.random() * NOISE.length) | 0])).join("");
    const st = { p: 0 };
    const tw = gsap.to(st, { p: 1.05, duration: 1.1, ease: "power2.out", onUpdate: () => void (el.textContent = scramble(st.p)) });
    const glitch = window.setInterval(() => {
      let n = 0;
      const id = window.setInterval(() => {
        el.textContent = n++ < 3 ? scramble(0.8) : LOGO;
        if (n > 3) window.clearInterval(id);
      }, 60);
    }, 4800);
    return () => {
      tw.kill();
      window.clearInterval(glitch);
    };
  }, []);
  return <pre ref={ref} aria-hidden className={cx("font-mono font-bold leading-[1.05] text-brand", className)} />;
}

/* ───────────────────────────── Markdown ringan (tanpa HTML mentah) ───────────────────────────── */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) out.push(<code key={`${key}c${i++}`} className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[0.88em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={`${key}b${i++}`} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) out.push(<em key={`${key}i${i++}`}>{tok.slice(1, -1)}</em>);
    else {
      const label = tok.slice(1, tok.indexOf("]"));
      out.push(<a key={`${key}a${i++}`} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">{label}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-line bg-[#0d0b0c] text-[#f3eee6]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 font-mono text-[11px] text-white/50">
        <span>{lang || "kode"}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1.5 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed">{code}</pre>
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <>
      {blocks.map((b, bi) => {
        if (bi % 2 === 1) {
          const nl = b.indexOf("\n");
          return <CodeBlock key={bi} lang={nl > 0 ? b.slice(0, nl).trim() : ""} code={(nl > 0 ? b.slice(nl + 1) : b).replace(/\n$/, "")} />;
        }
        const nodes: ReactNode[] = [];
        let list: { ordered: boolean; items: ReactNode[] } | null = null;
        const flush = (k: string) => {
          if (list) nodes.push(list.ordered ? <ol key={k} className="my-2 list-decimal space-y-1 pl-6">{list.items}</ol> : <ul key={k} className="my-2 list-disc space-y-1 pl-6">{list.items}</ul>);
          list = null;
        };
        b.split("\n").forEach((ln, li) => {
          const k = `${bi}-${li}`;
          const item = /^\s*([-*•]|\d+\.)\s+(.*)$/.exec(ln);
          if (item) {
            const ordered = /\d/.test(item[1]);
            if (list && list.ordered !== ordered) flush(`${k}x`);
            list ??= { ordered, items: [] };
            list.items.push(<li key={k}>{inline(item[2], k)}</li>);
            return;
          }
          flush(`${k}l`);
          const h = /^#{1,4}\s+(.*)$/.exec(ln);
          if (h) nodes.push(<p key={k} className="mb-1 mt-4 font-semibold text-ink">{inline(h[1], k)}</p>);
          else if (ln.trim()) nodes.push(<p key={k} className="my-2">{inline(ln, k)}</p>);
        });
        flush(`${bi}-end`);
        return <Fragment key={bi}>{nodes}</Fragment>;
      })}
    </>
  );
}

/* ───────────────────────────── Logika obrolan ───────────────────────────── */

function useChat(model: ModelId) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const patchLast = useCallback((fn: (t: Assistant) => Assistant) => {
    setTurns((ts) => {
      const last = ts[ts.length - 1];
      return last?.role === "assistant" ? [...ts.slice(0, -1), fn(last)] : ts;
    });
  }, []);

  const run = useCallback(
    async (history: Turn[]) => {
      setTurns([...history, { role: "assistant", text: "", tools: [], done: false }]);
      setBusy(true);
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // Hanya teks percakapan; tool call & hasilnya tidak dikirim ulang dari browser.
          body: JSON.stringify({ model, messages: history.filter((t) => t.text).slice(-16).map((t) => ({ role: t.role, content: t.text })) }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          patchLast((t) => ({ ...t, done: true, error: { status: res.status, message: body.error ?? "Permintaan gagal." } }));
          return;
        }
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let cut: number;
          while ((cut = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, cut).replace(/^data:\s*/, "");
            buf = buf.slice(cut + 2);
            let ev: { t: string; v?: string; id?: string; name?: string; args?: string; ok?: boolean; summary?: string; status?: number; message?: string; rounds?: number };
            try {
              ev = JSON.parse(raw);
            } catch {
              continue;
            }
            if (ev.t === "text") patchLast((t) => ({ ...t, text: t.text + (ev.v ?? "") }));
            else if (ev.t === "tool") patchLast((t) => ({ ...t, tools: [...t.tools, { id: ev.id!, name: ev.name!, args: ev.args ?? "" }] }));
            else if (ev.t === "tool_result") patchLast((t) => ({ ...t, tools: t.tools.map((s) => (s.id === ev.id ? { ...s, ok: ev.ok, summary: ev.summary } : s)) }));
            else if (ev.t === "error") patchLast((t) => ({ ...t, done: true, error: { status: ev.status ?? 502, message: ev.message ?? "Gagal." } }));
            else if (ev.t === "done") patchLast((t) => ({ ...t, done: true, rounds: ev.rounds }));
          }
        }
        patchLast((t) => ({ ...t, done: true }));
      } catch (err) {
        if ((err as Error).name === "AbortError") patchLast((t) => ({ ...t, done: true, text: t.text || "_Dihentikan._" }));
        else patchLast((t) => ({ ...t, done: true, error: { status: 0, message: "Koneksi terputus. Coba lagi." } }));
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [model, patchLast],
  );

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (q && !busy) void run([...turns, { role: "user", text: q }]);
    },
    [busy, run, turns],
  );
  /** Ulangi jawaban terakhir: buang jawaban AI terakhir lalu kirim ulang percakapan yang sama. */
  const regenerate = useCallback(() => {
    if (busy || turns.at(-1)?.role !== "assistant") return;
    void run(turns.slice(0, -1));
  }, [busy, run, turns]);
  const stop = useCallback(() => abort.current?.abort(), []);
  const reset = useCallback(() => {
    abort.current?.abort();
    setTurns([]);
  }, []);
  return { turns, busy, send, regenerate, stop, reset };
}

/* ───────────────────────────── Komponen pesan ───────────────────────────── */

function Avatar() {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[0_0_0_4px_rgba(225,36,58,0.12)]">
      <span className="font-mono text-[11px] font-bold leading-none">◉</span>
    </div>
  );
}

/** Ringkasan pemakaian alat (bisa dibuka) dengan detail kotak ASCII. */
function ToolSteps({ steps, running }: { steps: ToolStep[]; running: boolean }) {
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!body.current) return;
    gsap.to(body.current, { height: open ? "auto" : 0, opacity: open ? 1 : 0, duration: 0.35, ease: "power3.out" });
  }, [open]);
  const failed = steps.filter((s) => s.ok === false).length;
  const label = running ? TOOL_LABEL[steps.at(-1)?.name ?? ""] ?? "Menggunakan alat" : `Menggunakan ${steps.length} alat${failed ? ` · ${failed} gagal` : ""}`;
  return (
    <div className="mb-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="group flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-soft transition hover:text-ink">
        {running ? <span className="font-mono text-brand"><SpinChar /></span> : <Check className="h-3.5 w-3.5 text-emerald-500" />}
        <span className={running ? "shimmer-text" : ""}>{label}</span>
        <ChevronDown className={cx("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      <div ref={body} className="h-0 overflow-hidden opacity-0">
        <div className="mt-2 space-y-2 border-l-2 border-line pl-4 font-mono text-[12px] leading-relaxed text-ink-soft">
          {steps.map((s) => {
            let args = s.args;
            try {
              args = JSON.stringify(JSON.parse(s.args || "{}"));
            } catch {
              /* apa adanya */
            }
            return (
              <div key={s.id}>
                <div>┌─ <span className="text-brand">{s.name}</span>({args === "{}" ? "" : args})</div>
                <div className={cx(s.ok === false ? "text-red-400" : s.ok ? "text-emerald-500" : "")}>└─ {s.ok === undefined ? "berjalan…" : `${s.ok ? "✓" : "✗"} ${s.summary ?? ""}`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SpinChar() {
  const i = useTick(80);
  return <>{SPIN[i % SPIN.length]}</>;
}

function Message({ turn, last, onRegenerate }: { turn: Turn; last: boolean; onRegenerate: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useLayoutEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" });
  }, []);

  if (turn.role === "user") {
    return (
      <div ref={ref} className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-surface px-4 py-2.5 text-[15px] leading-relaxed text-ink">{turn.text}</div>
      </div>
    );
  }

  const running = turn.tools.some((s) => s.ok === undefined);
  const waiting = !turn.done && !turn.text;
  return (
    <div ref={ref} className="flex gap-3 sm:gap-4">
      <Avatar />
      <div className="min-w-0 flex-1 pt-1 text-[15px] leading-[1.7] text-ink/90">
        {turn.tools.length > 0 && <ToolSteps steps={turn.tools} running={running && !turn.done} />}
        {waiting && !running && <Thinking label={turn.tools.length ? "Menyusun jawaban" : "Berpikir"} />}
        {turn.text && (
          <div className="break-words">
            <Markdown text={turn.text} />
            {!turn.done && <span className="ml-0.5 inline-block h-[1.1em] w-[0.5em] translate-y-[0.2em] animate-pulse bg-brand" />}
          </div>
        )}
        {turn.error && (
          <div className="mt-2 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[14px] text-red-500">
            <span className="font-mono text-[12px]">[{turn.error.status || "net"}]</span> {turn.error.message}
          </div>
        )}
        {turn.done && (
          <div className="mt-1 flex items-center gap-1 text-ink-soft">
            {turn.text && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(turn.text);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-surface hover:text-ink"
                aria-label="Salin jawaban"
                title="Salin"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
            {last && (
              <button type="button" onClick={onRegenerate} className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-surface hover:text-ink" aria-label="Ulangi jawaban" title="Ulangi">
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            {turn.tools.length > 0 && !turn.error && <span className="ml-1 font-mono text-[11px] text-ink-soft/60">{turn.rounds ?? "?"} putaran · jawaban akhir diterima ✓</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── Pemilih model & panel info ───────────────────────────── */

function ModelPicker({ value, onChange, disabled }: { value: ModelId; onChange: (v: ModelId) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const current = MODELS.find((m) => m.id === value)!;
  return (
    <div ref={box} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[16px] font-semibold transition hover:bg-surface disabled:opacity-60" aria-haspopup="listbox" aria-expanded={open}>
        {current.label}
        <ChevronDown className={cx("h-4 w-4 text-ink-soft transition", open && "rotate-180")} />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={m.id === value}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface"
            >
              <div className="flex-1">
                <p className="text-[14px] font-semibold">{m.label}</p>
                <p className="text-[12.5px] leading-snug text-ink-soft">{m.desc}</p>
              </div>
              {m.id === value && <Check className="mt-0.5 h-4 w-4 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!panel.current || !scrim.current) return;
    if (first.current) {
      first.current = false;
      gsap.set(panel.current, { xPercent: 105, autoAlpha: 0 });
      gsap.set(scrim.current, { autoAlpha: 0 });
      if (!open) return;
    }
    gsap.to(panel.current, { xPercent: open ? 0 : 105, autoAlpha: open ? 1 : 0, duration: 0.45, ease: "power3.out" });
    gsap.to(scrim.current, { autoAlpha: open ? 1 : 0, duration: 0.3 });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  // Portal ke <body>: di dalam <main> (z-index sendiri) panel akan tertutup bilah atas situs.
  return createPortal(
    <>
      <div ref={scrim} onClick={onClose} className="invisible fixed inset-0 z-[80] bg-black/40 opacity-0" />
      <aside ref={panel} aria-hidden={!open} className="invisible fixed inset-y-0 right-0 z-[90] w-full max-w-md overflow-y-auto border-l border-line bg-bg p-6 pb-28 lg:pb-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-[18px] font-semibold">Tentang Pip</p>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="micro mb-3 text-ink-soft">Batas pemakaian</p>
        <div className="grid grid-cols-2 gap-2">
          {LIMITS.map(([v, k]) => (
            <div key={k} className="rounded-2xl border border-line p-3">
              <p className="font-mono text-[20px] font-bold text-brand">{v}</p>
              <p className="text-[12px] text-ink-soft">{k}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
          Batas awal per key: 20 request inferensi per menit dan 500 per hari UTC, body 1 MiB, output maksimal 16384 token, deadline upstream 300 detik. Satu tugas agent bisa memakai
          beberapa request. Model yang tercantum tidak menjamin kemampuan penalaran setara model lain.
        </p>

        <p className="micro mb-3 mt-8 text-ink-soft">Privasi</p>
        <p className="text-[13.5px] leading-relaxed text-ink-soft">
          Gateway menyimpan statistik penggunaan dan metadata request yang disamarkan untuk key developer, tanpa isi prompt atau kode. Isi request dikirim ke Mistral; aturan retensi
          provider tetap berlaku. Jangan sertakan secret proyek. Sesi upstream dapat kedaluwarsa dan membutuhkan pembaruan oleh pemilik.
        </p>
        <pre aria-hidden className="mt-3 overflow-x-auto font-mono text-[11px] leading-[14px] text-ink-soft/70">
          {"browser ─► jkt48connect.app/api/ai ─► gateway ─► Mistral\n          (tanpa API key)       (key di server)"}
        </pre>

        <p className="micro mb-3 mt-8 text-ink-soft">Status</p>
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-[13.5px]">
            <thead className="bg-surface font-mono text-[11px] uppercase tracking-widest text-ink-soft">
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Arti</th>
              </tr>
            </thead>
            <tbody>
              {STATUS.map(([c, t]) => (
                <tr key={c} className="border-t border-line">
                  <td className="px-3 py-2 font-mono font-bold text-brand">{c}</td>
                  <td className="px-3 py-2 text-ink-soft">{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="micro mb-3 mt-8 text-ink-soft">Uji alur agent</p>
        <p className="text-[13.5px] leading-relaxed text-ink-soft">
          Uji integrasi dengan tool call, kirim kembali hasilnya, lalu pastikan jawaban akhir diterima. Respons teks atau <code className="font-mono text-brand">/v1/models</code> yang berhasil
          saja belum membuktikan seluruh alur coding agent berjalan.
        </p>
        <pre className="mt-3 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-ink-soft">
          {"[1] kamu   ─► pertanyaan\n[2] Pip    ─► tool_call live_now()\n[3] server ─► GET /api/now_live ─► hasil\n[4] Pip    ◄─ hasil tool\n[5] Pip    ─► jawaban akhir ✓"}
        </pre>
      </aside>
    </>,
    document.body,
  );
}

/* ───────────────────────────── Halaman ───────────────────────────── */

export function AiPage() {
  const [model, setModel] = useState<ModelId>("pip");
  const [input, setInput] = useState("");
  const [info, setInfo] = useState(false);
  const { turns, busy, send, regenerate, stop, reset } = useChat(model);
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const welcome = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Ikuti jawaban yang sedang mengalir, kecuali pengguna sedang menggulir ke atas.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current && turns.length) el.scrollTo({ top: el.scrollHeight, behavior: turns.length < 3 ? "auto" : "smooth" });
  }, [turns]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(200, el.scrollHeight)}px`;
  }, [input]);
  useLayoutEffect(() => {
    if (!welcome.current || turns.length) return;
    gsap.fromTo(welcome.current.querySelectorAll("[data-in]"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: "power3.out" });
  }, [turns.length]);

  const submit = (text = input) => {
    if (!text.trim() || busy) return;
    stick.current = true;
    send(text);
    setInput("");
    area.current?.focus();
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <h1 className="sr-only">Tanya Pip — JKT48Connect AI</h1>

      {/* Header obrolan */}
      <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
        <ModelPicker value={model} onChange={setModel} disabled={busy} />
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={reset} disabled={!turns.length} className="flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-ink-soft transition hover:bg-surface hover:text-ink disabled:opacity-40" title="Obrolan baru">
            <PenSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Obrolan baru</span>
          </button>
          <button type="button" onClick={() => setInfo(true)} className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft transition hover:bg-surface hover:text-ink" aria-label="Info, batas & privasi" title="Info">
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Percakapan */}
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto"
      >
        {turns.length === 0 ? (
          <div ref={welcome} className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-6">
            <div data-in className="mb-5 flex justify-center">
              <AsciiMark className="text-[clamp(14px,3.6vw,22px)]" />
            </div>
            <h2 data-in className="text-center text-[clamp(1.6rem,4.5vw,2.4rem)] font-semibold tracking-tight">Halo! Mau tanya apa soal JKT48?</h2>
            <p data-in className="mx-auto mt-2 max-w-lg text-center text-[15px] text-ink-soft">
              Pip membaca data JKT48Connect secara langsung: siapa yang live, jadwal theater, profil member, ulang tahun, dan berita.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
              {SUGGEST.map(({ icon: Icon, title, prompt }, i) => (
                <button
                  key={title}
                  data-in
                  type="button"
                  onClick={() => submit(prompt)}
                  className={cx(
                    "group rounded-2xl border border-line bg-card p-3.5 text-left transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-[0_12px_30px_-18px_rgba(225,36,58,0.5)] sm:p-4",
                    i >= 4 && "hidden lg:block",
                  )}
                >
                  <Icon className="mb-2 h-4.5 w-4.5 text-brand" />
                  <p className="text-[14px] font-semibold">{title}</p>
                  <p className="mt-0.5 line-clamp-2 hidden text-[13px] text-ink-soft sm:block">{prompt}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
            {turns.map((t, i) => (
              <Message key={i} turn={t} last={i === turns.length - 1} onRegenerate={regenerate} />
            ))}
          </div>
        )}
      </div>

      {/* Kotak pesan */}
      <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+92px)] pt-2 sm:px-5 lg:pb-4">
        <form
          className="mx-auto max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-end gap-2 rounded-[28px] border border-line bg-card p-2 pl-4 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.35)] transition focus-within:border-brand/50">
            <textarea
              ref={area}
              rows={1}
              value={input}
              maxLength={4000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Kirim pesan ke Pip…"
              aria-label="Pesan untuk Pip"
              className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-soft/70"
            />
            {busy ? (
              <button type="button" onClick={stop} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-bg transition hover:opacity-85" aria-label="Hentikan">
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white transition hover:opacity-90 disabled:bg-ink/15 disabled:text-ink-soft" aria-label="Kirim">
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[11.5px] text-ink-soft/80">
            Pip bisa salah. Data dari JKT48Connect · isi pesan diproses Mistral · jangan kirim data rahasia.{" "}
            <button type="button" onClick={() => setInfo(true)} className="underline underline-offset-2 hover:text-ink">
              Batas & privasi
            </button>
          </p>
        </form>
      </div>

      <InfoPanel open={info} onClose={() => setInfo(false)} />
    </div>
  );
}
