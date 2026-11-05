import { Check, Copy } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";

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

export function Markdown({ text }: { text: string }) {
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

