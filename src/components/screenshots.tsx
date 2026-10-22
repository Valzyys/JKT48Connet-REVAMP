import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Img, Segmented, cx } from "@/components/ui";
import { gsap } from "@/lib/gsap";
import type { Screenshot } from "@/lib/jkt48";

const PREVIEW = 18;
const clock = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Posisi cuplikan di dalam live: "+12:05" (atau "+1:02:05"). */
function offset(at: string, start: string) {
  const ms = Date.parse(at) - Date.parse(start);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  return `+${h ? `${h}:${pad(Math.floor((s / 60) % 60))}` : Math.floor(s / 60)}:${pad(s % 60)}`;
}

function wib(at: string) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : `${clock.format(d)} WIB`;
}

type View = "grid" | "list";
const VIEWS = [
  { id: "grid", label: "Grid" },
  { id: "list", label: "Daftar" },
] as const;

/**
 * Semua cuplikan layar sebuah live: tampilan grid (18 dulu, bisa dibuka semua) atau daftar rinci
 * (nomor, menit ke-, jam WIB), plus penampil layar penuh dengan filmstrip, panah, keyboard, dan geser.
 */
export function ScreenshotGallery({ shots, start, name, vertical }: { shots: Screenshot[]; start: string; name: string; vertical: boolean }) {
  const [view, setView] = useState<View>("grid");
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const shown = all ? shots : shots.slice(0, PREVIEW);
  const aspect = vertical ? "aspect-[3/4]" : "aspect-video";

  // Item baru (saat ganti tampilan / buka semua) masuk bertahap.
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const items = el.querySelectorAll("[data-shot]:not([data-in])");
    items.forEach((i) => i.setAttribute("data-in", ""));
    gsap.fromTo(items, { opacity: 0, y: 18, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.025, ease: "power3.out", clearProps: "transform" });
  }, [view, all]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="condensed text-[28px] uppercase leading-none">
            Cuplikan <span className="text-brand">/ {shots.length}</span>
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">Ditangkap otomatis sekitar tiap menit selama live.</p>
        </div>
        <Segmented value={view} options={VIEWS} onChange={setView} />
      </div>

      <div ref={grid} key={view}>
        {view === "grid" ? (
          <div className={cx("grid gap-2", vertical ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4")}>
            {shown.map((s, i) => (
              <button
                key={s.url}
                type="button"
                data-shot
                onClick={() => setOpen(i)}
                className="group relative overflow-hidden rounded-xl bg-surface text-left focus-visible:outline-2 focus-visible:outline-brand"
                aria-label={`Buka cuplikan ${i + 1}`}
              >
                <Img src={s.url} alt={`Cuplikan ${i + 1} live ${name}`} className={cx(aspect, "w-full object-cover transition duration-500 group-hover:scale-105")} />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-1.5 font-mono text-[9px] font-semibold text-white">{String(i + 1).padStart(2, "0")}</span>
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6 font-mono text-[10px] font-semibold text-white">
                  {offset(s.at, start)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <ol className="panel overflow-hidden">
            <li className="micro hidden grid-cols-[2.5rem_auto_1fr_1fr_auto] items-center gap-4 border-b border-line px-4 py-2.5 text-ink-soft sm:grid">
              <span>#</span>
              <span className="w-16">Gambar</span>
              <span>Menit ke-</span>
              <span>Jam</span>
              <span />
            </li>
            {shots.map((s, i) => (
              <li key={s.url} data-shot className="border-t border-line first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  className="grid w-full grid-cols-[2rem_auto_1fr_auto] items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface sm:grid-cols-[2.5rem_auto_1fr_1fr_auto] sm:gap-4"
                >
                  <span className="font-mono text-[11px] font-semibold text-brand">{String(i + 1).padStart(2, "0")}</span>
                  <Img src={s.url} alt="" className={cx(vertical ? "h-14 w-[42px]" : "h-10 w-16", "rounded-md object-cover")} />
                  <span className="min-w-0">
                    <span className="num block font-bold">{offset(s.at, start) || "—"}</span>
                    <span className="num block font-mono text-[11px] text-ink-soft sm:hidden">{wib(s.at)}</span>
                  </span>
                  <span className="num hidden font-mono text-[12px] text-ink-soft sm:block">{wib(s.at)}</span>
                  <span className="link-more">Lihat</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {view === "grid" && shots.length > PREVIEW && (
        <button type="button" onClick={() => setAll((a) => !a)} className="btn btn-ghost mt-4 w-full">
          {all ? "Tampilkan lebih sedikit" : `Tampilkan semua ${shots.length} cuplikan`}
        </button>
      )}

      {/* Portal ke <body> supaya posisi fixed tidak terpengaruh transform animasi halaman. */}
      {open !== null &&
        createPortal(<Lightbox shots={shots} index={open} start={start} name={name} vertical={vertical} onIndex={setOpen} onClose={() => setOpen(null)} />, document.body)}
    </section>
  );
}

function Lightbox({
  shots,
  index,
  start,
  name,
  vertical,
  onIndex,
  onClose,
}: {
  shots: Screenshot[];
  index: number;
  start: string;
  name: string;
  vertical: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const prev = useRef(index);
  const swipe = useRef<number | null>(null);
  const s = shots[index];

  const go = useCallback((d: number) => onIndex((index + d + shots.length) % shots.length), [index, onIndex, shots.length]);

  const close = useCallback(() => {
    const el = root.current;
    if (!el) return onClose();
    gsap.to(el, { opacity: 0, duration: 0.2, onComplete: onClose });
  }, [onClose]);

  useEffect(() => {
    document.body.classList.add("is-locked");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-locked");
    };
  }, [close, go]);

  useLayoutEffect(() => {
    if (!root.current) return;
    gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.from("[data-lb-bar]", { y: -20, opacity: 0, duration: 0.4, delay: 0.1 });
    gsap.from("[data-lb-strip]", { y: 30, opacity: 0, duration: 0.45, delay: 0.15 });
  }, []);

  // Gambar baru meluncur dari arah navigasi; filmstrip menggulir ke item aktif.
  useLayoutEffect(() => {
    const dir = index === prev.current ? 0 : index > prev.current ? 1 : -1;
    prev.current = index;
    if (img.current) gsap.fromTo(img.current, { x: dir * 60, opacity: 0, scale: dir ? 1 : 0.94 }, { x: 0, opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" });
    const t = strip.current?.querySelector<HTMLElement>(`[data-i='${index}']`);
    t?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  return (
    <div ref={root} className="fixed inset-0 z-[70] flex flex-col bg-[#0b0809]/95 text-white backdrop-blur" role="dialog" aria-modal="true" aria-label={`Cuplikan live ${name}`}>
      <div data-lb-bar className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <span className="font-mono text-[12px] font-semibold">
          <span className="text-brand">{String(index + 1).padStart(2, "0")}</span>
          <span className="text-white/40"> / {shots.length}</span>
        </span>
        <span className="min-w-0 truncate text-[13px] text-white/75">
          <b className="text-white">{offset(s.at, start) || "—"}</b> · {wib(s.at)}
        </span>
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" aria-label="Buka gambar asli">
          <ExternalLink className="h-4 w-4" />
        </a>
        <button type="button" onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition hover:bg-butter" aria-label="Tutup">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20"
        onClick={(e) => e.target === e.currentTarget && close()}
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current == null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        <img
          ref={img}
          key={s.url}
          src={s.url}
          alt={`Cuplikan ${index + 1} live ${name}`}
          draggable={false}
          className={cx("max-h-full max-w-full select-none rounded-2xl object-contain shadow-2xl", vertical ? "h-full" : "w-full")}
        />
        <button type="button" onClick={() => go(-1)} aria-label="Sebelumnya" className="absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 transition hover:bg-brand sm:left-5">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Berikutnya" className="absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 transition hover:bg-brand sm:right-5">
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div data-lb-strip ref={strip} className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-3 sm:px-6">
        {shots.map((t, i) => (
          <button
            key={t.url}
            type="button"
            data-i={i}
            onClick={() => onIndex(i)}
            aria-label={`Cuplikan ${i + 1}`}
            className={cx(
              "relative shrink-0 overflow-hidden rounded-lg transition",
              vertical ? "h-20 w-[60px]" : "h-14 w-24",
              i === index ? "ring-2 ring-brand ring-offset-2 ring-offset-[#0b0809]" : "opacity-50 hover:opacity-100",
            )}
          >
            <img src={t.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            <span className="absolute bottom-0.5 left-1 font-mono text-[9px] font-semibold text-white drop-shadow">{offset(t.at, start)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

