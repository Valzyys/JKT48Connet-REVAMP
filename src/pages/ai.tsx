import { ArrowUp, RotateCcw, Square } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Page } from "@/components/page";
import { PageHeader, SectionHead, Segmented, cx } from "@/components/ui";
import { gsap } from "@/lib/gsap";

/* ───────────────────────────── Data halaman ───────────────────────────── */

const MODELS = [
  { id: "pip", label: "Pip" },
  { id: "pip-code", label: "Pip Code" },
  { id: "pip-docs", label: "Pip Docs" },
] as const;
type ModelId = (typeof MODELS)[number]["id"];

const MODEL_NOTE: Record<ModelId, string> = {
  pip: "Asisten umum: live, jadwal theater, member, ulang tahun, berita.",
  "pip-code": "Fokus kode: integrasi API JKT48Connect, bot Discord, script.",
  "pip-docs": "Fokus dokumentasi: menjelaskan endpoint dan cara pakainya.",
};

const SUGGEST = [
  "Siapa member JKT48 yang sedang live sekarang?",
  "Jadwal theater JKT48 minggu ini apa saja?",
  "Ceritakan profil Freya JKT48",
  "Siapa yang ulang tahun dalam waktu dekat?",
  "Berita JKT48 terbaru apa?",
  "Contoh kode Node.js untuk ambil data live dari API JKT48Connect",
];

const LIMITS: { v: string; k: string }[] = [
  { v: "20", k: "request inferensi / menit" },
  { v: "500", k: "request / hari (UTC)" },
  { v: "1 MiB", k: "ukuran body maksimal" },
  { v: "16384", k: "token output maksimal" },
  { v: "300 dtk", k: "deadline upstream" },
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
  live_now: "live_now",
  theater_schedule: "theater_schedule",
  member_profile: "member_profile",
  upcoming_birthdays: "upcoming_birthdays",
  latest_news: "latest_news",
};

/* ───────────────────────────── Tipe obrolan ───────────────────────────── */

type ToolStep = { id: string; name: string; args: string; ok?: boolean; summary?: string };
type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; tools: ToolStep[]; done: boolean; error?: { status: number; message: string }; rounds?: number };

/* ───────────────────────────── ASCII: latar plasma ───────────────────────────── */

const RAMP = " .·:-=+*#%@";

/** Medan karakter ASCII bergelombang (plasma) sebagai latar hero; berhenti saat tab tersembunyi / reduced motion. */
function AsciiField({ className }: { className?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      const cols = Math.max(20, Math.floor(el.clientWidth / 7.2));
      const rows = Math.max(8, Math.floor(el.clientHeight / 13));
      const s = t / 1000;
      let out = "";
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v =
            Math.sin(x / 7 + s * 1.3) + Math.sin((y + s * 2) / 4) + Math.sin((x + y + s * 3) / 9) + Math.sin(Math.hypot(x - cols / 2, (y - rows / 2) * 2) / 5 - s * 2);
          out += RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.floor(((v + 4) / 8) * RAMP.length)))];
        }
        out += "\n";
      }
      el.textContent = out;
    };
    const loop = (t: number) => {
      if (t - last > 66) {
        last = t;
        draw(t);
      }
      raf = requestAnimationFrame(loop);
    };
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <pre ref={ref} aria-hidden className={cx("pointer-events-none select-none overflow-hidden font-mono text-[12px] leading-[13px]", className)} />;
}

/* ───────────────────────────── ASCII: logo glitch ───────────────────────────── */

const LOGO = [
  "██████╗ ██╗██████╗      █████╗ ██╗",
  "██╔══██╗██║██╔══██╗    ██╔══██╗██║",
  "██████╔╝██║██████╔╝    ███████║██║",
  "██╔═══╝ ██║██╔═══╝     ██╔══██║██║",
  "██║     ██║██║     ██╗ ██║  ██║██║",
  "╚═╝     ╚═╝╚═╝     ╚═╝ ╚═╝  ╚═╝╚═╝",
];
const NOISE = "▓▒░#%&@$*+=-";

/** Logo ASCII "PIP.AI" yang tersusun dari noise lalu sesekali glitch. */
function AsciiLogo() {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const full = LOGO.join("\n");
    if (reduce) {
      el.textContent = full;
      return;
    }
    const scramble = (p: number) =>
      [...full].map((ch, i) => (ch === "\n" || ch === " " ? ch : (i / full.length) * 0.6 + Math.random() * 0.4 < p ? ch : NOISE[(Math.random() * NOISE.length) | 0])).join("");
    const st = { p: 0 };
    const tl = gsap.timeline();
    tl.to(st, { p: 1.05, duration: 1.4, ease: "power2.out", onUpdate: () => void (el.textContent = scramble(st.p)) });
    const glitch = window.setInterval(() => {
      let n = 0;
      const id = window.setInterval(() => {
        el.textContent = n++ < 4 ? scramble(0.85) : full;
        if (n > 4) window.clearInterval(id);
      }, 55);
    }, 5200);
    return () => {
      tl.kill();
      window.clearInterval(glitch);
    };
  }, []);
  return <pre ref={ref} aria-label="PIP.AI" className="font-mono text-[clamp(5px,1.55vw,11px)] font-bold leading-[1.15] text-brand drop-shadow-[0_0_18px_rgba(225,36,58,0.35)]" />;
}

/* ───────────────────────────── ASCII: spinner & kotak ───────────────────────────── */

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function Thinking({ label }: { label: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => v + 1), 80);
    return () => window.clearInterval(id);
  }, []);
  const bar = Array.from({ length: 12 }, (_, k) => ((k + i) % 12 < 4 ? "▓" : "░")).join("");
  return (
    <p className="font-mono text-[12.5px] text-ink-soft" aria-live="polite">
      <span className="text-brand">{SPIN[i % SPIN.length]}</span> {label} <span className="text-brand/70">[{bar}]</span>
    </p>
  );
}

/** Kartu tool call bergaya kotak ASCII. */
function ToolBox({ step }: { step: ToolStep }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { y: 8, opacity: 0, clipPath: "inset(0 100% 0 0)" }, { y: 0, opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.45, ease: "power3.out" });
  }, []);
  let args = step.args;
  try {
    args = JSON.stringify(JSON.parse(step.args || "{}"));
  } catch {
    /* tampilkan apa adanya */
  }
  const state = step.ok === undefined ? "berjalan…" : step.ok ? "✓" : "✗";
  return (
    <div ref={ref} className="my-2 font-mono text-[12px] leading-relaxed">
      <div className="text-ink-soft">┌─ tool · <span className="text-brand">{TOOL_LABEL[step.name] ?? step.name}</span> ──────────────</div>
      <div className="break-all text-ink-soft">│ args {args}</div>
      <div className={cx(step.ok === false ? "text-red-400" : step.ok ? "text-emerald-500" : "text-ink-soft")}>
        │ {state} {step.summary ?? ""}
      </div>
      <div className="text-ink-soft">└────────────────────────────</div>
    </div>
  );
}

/* ───────────────────────────── Markdown ringan (tanpa HTML mentah) ───────────────────────────── */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) out.push(<code key={`${key}c${i++}`} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.9em] text-brand">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={`${key}b${i++}`}>{tok.slice(2, -2)}</strong>);
    else {
      const label = tok.slice(1, tok.indexOf("]"));
      out.push(<a key={`${key}a${i++}`} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">{label}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <>
      {blocks.map((b, bi) => {
        if (bi % 2 === 1) {
          const nl = b.indexOf("\n");
          const lang = nl > 0 ? b.slice(0, nl).trim() : "";
          const code = nl > 0 ? b.slice(nl + 1) : b;
          return (
            <pre key={bi} className="my-3 overflow-x-auto rounded-2xl border border-line bg-[#0d0b0c] p-4 font-mono text-[12.5px] leading-relaxed text-[#f3eee6]">
              {lang && <span className="mb-2 block text-[10px] uppercase tracking-widest text-white/40">{lang}</span>}
              {code.replace(/\n$/, "")}
            </pre>
          );
        }
        const lines = b.split("\n");
        const nodes: ReactNode[] = [];
        let list: ReactNode[] = [];
        const flush = (k: string) => {
          if (list.length) nodes.push(<ul key={k} className="my-2 list-disc space-y-1 pl-5">{list}</ul>);
          list = [];
        };
        lines.forEach((ln, li) => {
          const k = `${bi}-${li}`;
          const item = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(ln);
          if (item) return void list.push(<li key={k}>{inline(item[1], k)}</li>);
          flush(`${k}l`);
          const h = /^#{1,4}\s+(.*)$/.exec(ln);
          if (h) nodes.push(<p key={k} className="mt-3 font-bold">{inline(h[1], k)}</p>);
          else if (ln.trim()) nodes.push(<p key={k} className="my-1.5">{inline(ln, k)}</p>);
        });
        flush(`${bi}-end`);
        return <Fragment key={bi}>{nodes}</Fragment>;
      })}
    </>
  );
}

/* ───────────────────────────── Obrolan ───────────────────────────── */

function useChat(model: ModelId) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const patchLast = useCallback((fn: (t: Extract<Turn, { role: "assistant" }>) => Extract<Turn, { role: "assistant" }>) => {
    setTurns((ts) => {
      const last = ts[ts.length - 1];
      if (!last || last.role !== "assistant") return ts;
      return [...ts.slice(0, -1), fn(last)];
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      const history = [...turns, { role: "user", text: q } as Turn];
      setTurns([...history, { role: "assistant", text: "", tools: [], done: false }]);
      setBusy(true);
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model,
            // Hanya teks percakapan; tool call & hasilnya tidak dikirim ulang dari browser.
            messages: history.filter((t) => t.text).slice(-16).map((t) => ({ role: t.role, content: t.text })),
          }),
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
        if ((err as Error).name === "AbortError") patchLast((t) => ({ ...t, done: true, text: t.text || "_(dihentikan)_" }));
        else patchLast((t) => ({ ...t, done: true, error: { status: 0, message: "Koneksi terputus. Coba lagi." } }));
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [busy, model, patchLast, turns],
  );

  const stop = useCallback(() => abort.current?.abort(), []);
  const reset = useCallback(() => {
    abort.current?.abort();
    setTurns([]);
  }, []);
  return { turns, busy, send, stop, reset };
}

function Bubble({ turn }: { turn: Turn }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { y: 14, opacity: 0, filter: "blur(6px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "power3.out" });
  }, []);
  if (turn.role === "user") {
    return (
      <div ref={ref} className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] text-white">{turn.text}</div>
      </div>
    );
  }
  const waiting = !turn.done && !turn.text;
  const running = turn.tools.find((s) => s.ok === undefined);
  return (
    <div ref={ref} className="flex gap-3">
      <pre aria-hidden className="mt-1 hidden shrink-0 font-mono text-[10px] leading-[11px] text-brand sm:block">{"╭─╮\n│◉│\n╰─╯"}</pre>
      <div className="min-w-0 flex-1 text-[15px] leading-relaxed">
        <p className="micro mb-1 text-ink-soft">pip</p>
        {turn.tools.map((s) => (
          <ToolBox key={s.id} step={s} />
        ))}
        {turn.text && (
          <div className="break-words">
            <Markdown text={turn.text} />
            {!turn.done && <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-brand" />}
          </div>
        )}
        {waiting && <Thinking label={running ? `menjalankan ${running.name}` : turn.tools.length ? "menyusun jawaban" : "berpikir"} />}
        {turn.error && (
          <pre className="mt-2 whitespace-pre-wrap rounded-2xl border border-red-500/30 bg-red-500/5 p-3 font-mono text-[12px] text-red-400">
            {`[ERR ${turn.error.status || "net"}] ${turn.error.message}`}
          </pre>
        )}
        {turn.done && !turn.error && turn.tools.length > 0 && (
          <p className="mt-2 font-mono text-[11px] text-ink-soft/70">
            ↳ {turn.tools.length} tool call · {turn.rounds ?? "?"} putaran · jawaban akhir diterima ✓
          </p>
        )}
      </div>
    </div>
  );
}

function Chat() {
  const [model, setModel] = useState<ModelId>("pip");
  const [input, setInput] = useState("");
  const { turns, busy, send, stop, reset } = useChat(model);
  const end = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(180, el.scrollHeight)}px`;
  }, [input]);

  const submit = (text = input) => {
    if (!text.trim() || busy) return;
    void send(text);
    setInput("");
  };

  return (
    <section data-reveal className="overflow-hidden rounded-[28px] border border-line bg-card shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]">
      {/* Bilah judul terminal */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <p className="font-mono text-[12px] text-ink-soft">~/jkt48connect/ai — {model}</p>
        <div className="ml-auto flex items-center gap-2">
          <Segmented value={model} options={MODELS} onChange={(v) => !busy && setModel(v)} />
          <button type="button" onClick={reset} disabled={!turns.length} className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-soft transition hover:text-ink disabled:opacity-40" aria-label="Obrolan baru">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="h-[min(62vh,620px)] space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
        {!turns.length && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <pre aria-hidden className="mx-auto mb-4 w-max font-mono text-[11px] leading-[13px] text-ink-soft">
                {"  ┌──────────────────────────┐\n  │  > tanya apa saja soal   │\n  │    JKT48 ke Pip_         │\n  └──────────────────────────┘"}
              </pre>
              <p className="mx-auto max-w-md text-[14px] text-ink-soft">{MODEL_NOTE[model]}</p>
              <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
                {SUGGEST.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-full border border-line px-3.5 py-2 text-left text-[13px] text-ink-soft transition hover:-translate-y-0.5 hover:border-brand hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <Bubble key={i} turn={t} />
        ))}
        <div ref={end} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span aria-hidden className="pb-2.5 pl-2 font-mono text-brand">❯</span>
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
          placeholder="Tanya Pip… (Enter kirim, Shift+Enter baris baru)"
          aria-label="Pesan untuk Pip"
          className="min-h-[44px] flex-1 resize-none bg-transparent py-2.5 font-mono text-[14px] outline-none placeholder:text-ink-soft/60"
        />
        {busy ? (
          <button type="button" onClick={stop} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-bg" aria-label="Hentikan">
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white transition disabled:opacity-40" aria-label="Kirim">
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </form>
    </section>
  );
}

/* ───────────────────────────── Halaman ───────────────────────────── */

export function AiPage() {
  return (
    <Page>
      <PageHeader label="JKT48Connect AI" title="Tanya Pip" desc="Asisten AI yang membaca data JKT48Connect secara langsung: siapa yang live, jadwal theater, profil member, ulang tahun, dan berita." />

      <div className="container-x space-y-14 pb-16 pt-8">
        <section data-reveal className="relative overflow-hidden rounded-[28px] border border-line bg-[#0d0b0c] px-5 py-8 sm:px-8">
          <AsciiField className="absolute inset-0 text-white/[0.09]" />
          <div className="relative">
            <AsciiLogo />
            <p className="mt-5 max-w-xl font-mono text-[13px] leading-relaxed text-white/70">
              <span className="text-brand">$</span> pip --model mistral-medium --tools live,theater,member,birthday,news
              <br />
              <span className="text-white/40">→ tool call sungguhan ke API JKT48Connect, hasilnya dikirim balik ke model sampai jawaban akhir diterima.</span>
            </p>
          </div>
        </section>

        <Chat />

        <section data-reveal>
          <SectionHead label="Gateway" title="Batas pemakaian" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {LIMITS.map((l) => (
              <div key={l.k} className="rounded-3xl border border-line bg-card p-4">
                <p className="condensed text-[34px] leading-none text-brand">{l.v}</p>
                <p className="mt-2 text-[12.5px] text-ink-soft">{l.k}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-ink-soft">
            Batas awal per key: 20 request inferensi per menit dan 500 per hari UTC, body 1 MiB, output maksimal 16384 token, deadline upstream 300 detik. Satu tugas agent bisa
            memakai beberapa request. Model yang tercantum tidak menjamin kemampuan penalaran setara model lain.
          </p>
        </section>

        <section data-reveal className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-line bg-card p-6">
            <SectionHead label="Privasi" title="Data & retensi" />
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Gateway menyimpan statistik penggunaan dan metadata request yang disamarkan untuk key developer, tanpa isi prompt atau kode. Isi request dikirim ke Mistral; aturan
              retensi provider tetap berlaku. Jangan sertakan secret proyek. Sesi upstream dapat kedaluwarsa dan membutuhkan pembaruan oleh pemilik.
            </p>
            <pre aria-hidden className="mt-5 font-mono text-[11px] leading-[14px] text-ink-soft/70">
              {"browser ──► jkt48connect.app/api/ai ──► gateway ──► Mistral\n           (tanpa API key)        (key di server)"}
            </pre>
          </div>
          <div className="rounded-[28px] border border-line bg-card p-6">
            <SectionHead label="Kode respons" title="Status" />
            <div className="overflow-hidden rounded-2xl border border-line">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-surface font-mono text-[11px] uppercase tracking-widest text-ink-soft">
                  <tr>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Arti</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS.map(([code, text]) => (
                    <tr key={code} className="border-t border-line">
                      <td className="px-4 py-2.5 font-mono font-bold text-brand">{code}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section data-reveal className="rounded-[28px] border border-dashed border-line p-6">
          <SectionHead label="Integrasi" title="Uji alur agent" />
          <p className="max-w-3xl text-[14px] leading-relaxed text-ink-soft">
            Uji integrasi dengan tool call, kirim kembali hasilnya, lalu pastikan jawaban akhir diterima. Respons teks atau <code className="font-mono text-brand">/v1/models</code>{" "}
            yang berhasil saja belum membuktikan seluruh alur coding agent berjalan.
          </p>
          <pre className="mt-4 overflow-x-auto font-mono text-[12px] leading-relaxed text-ink-soft">
            {"[1] user      ─► \"siapa yang live?\"\n[2] model     ─► tool_call live_now()\n[3] worker    ─► GET /api/now_live ─► hasil\n[4] model     ◄─ tool result\n[5] model     ─► jawaban akhir ✓"}
          </pre>
        </section>
      </div>
    </Page>
  );
}
