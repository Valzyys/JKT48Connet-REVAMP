import { useNavigate } from "@tanstack/react-router";
import { toPng } from "html-to-image";
import { Check, Copy, ExternalLink } from "lucide-react";
import { createContext, useContext, useState, type ReactNode, type RefObject } from "react";
import { cx } from "@/components/ui";
import { safeImage, safeLink } from "@/lib/genui";

/** Props blok dari model (sudah disanitasi worker; tetap dibaca defensif). */
export type P = Record<string, unknown>;

export const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : d);
export const num = (v: unknown, d = 0): number => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(x) ? x : d;
};
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const obj = (v: unknown): P => (v && typeof v === "object" && !Array.isArray(v) ? (v as P) : {});
export const img = (v: unknown): string => safeImage(v);
export const fmt = (n: number) => n.toLocaleString("id-ID");

/** Konteks obrolan untuk komponen: kirim pesan balik ke Pip, buka Kanvas. */
export type GenUiCtx = { send: (text: string) => void; busy: boolean; openCanvas?: (title: string) => void };
export const GenUi = createContext<GenUiCtx>({ send: () => {}, busy: false });
export const useGenUi = () => useContext(GenUi);

export const box = "rounded-[22px] border border-line bg-card";
export const btnBase = "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold transition active:scale-[0.97] disabled:opacity-50";
export const btnStyle = (style: string) =>
  style === "secondary" ? "bg-surface text-ink hover:brightness-95" : style === "ghost" ? "border border-line text-ink hover:bg-surface" : "bg-brand text-white hover:brightness-110";

export function Title({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  if (!children && !sub && !right) return null;
  return (
    <div className="mb-2 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        {children && <p className="text-[15px] font-bold leading-snug text-ink">{children}</p>}
        {sub && <p className="text-[12.5px] text-ink-soft">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Satu tombol aksi dari model. Menerima variasi bentuk: {action,value} atau {url|href|to} atau {prompt}. */
export function ActionButton({ a, className }: { a: P; className?: string }) {
  const { send, busy } = useGenUi();
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);
  const label = str(a.label, str(a.text, "Buka"));
  const action = str(a.action);
  const link = safeLink(str(a.href) || str(a.url) || str(a.to) || (action === "link" ? str(a.value) : ""));
  const style = str(a.style, "primary");
  const cls = cx(btnBase, btnStyle(style), className);
  if (action === "copy") {
    return (
      <button
        type="button"
        className={cls}
        onClick={() => {
          void navigator.clipboard?.writeText(str(a.value, label));
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Tersalin" : label}
      </button>
    );
  }
  if (link) {
    const external = /^https:/.test(link);
    return external ? (
      <a href={link} target="_blank" rel="noopener noreferrer" className={cls}>
        {label} <ExternalLink className="h-3.5 w-3.5" />
      </a>
    ) : (
      <button type="button" className={cls} onClick={() => void nav({ to: link })}>
        {label}
      </button>
    );
  }
  const prompt = str(a.value) || str(a.prompt) || label;
  return (
    <button type="button" className={cls} disabled={busy} onClick={() => send(prompt)}>
      {label}
    </button>
  );
}

export function Actions({ items, className }: { items: unknown; className?: string }) {
  const list = arr(items).map(obj).filter((a) => str(a.label) || str(a.text));
  if (!list.length) return null;
  return (
    <div className={cx("flex flex-wrap gap-2", className)}>
      {list.slice(0, 8).map((a, i) => (
        <ActionButton key={i} a={a} />
      ))}
    </div>
  );
}

/** Simpan elemen sebagai PNG (kartu ucapan, tier list, story, Kanvas). */
export async function downloadPng(ref: RefObject<HTMLElement | null>, name: string) {
  if (!ref.current) return;
  try {
    // Gambar dari host lain bisa diblokir CSP/CORS: diganti piksel kosong agar PNG tetap jadi.
    const bg = getComputedStyle(document.body).backgroundColor;
    const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: bg, imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w-]+/g, "-").slice(0, 60) || "jkt48connect"}.png`;
    a.click();
  } catch {
    window.alert("Gambar belum bisa dibuat (gambar dari server lain diblokir browser). Coba screenshot manual.");
  }
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[13px] text-ink-soft">{children}</p>;
}
