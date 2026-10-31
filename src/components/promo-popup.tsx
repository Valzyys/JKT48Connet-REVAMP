import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Bot, Braces, X } from "lucide-react";
import { SignalBars } from "@/components/motion";

const SEEN_KEY = "jkt48c-promo-popup-seen";

/**
 * Popup promosi API + Bot Discord di beranda.
 * Muncul sekali per sesi, setelah intro selesai. Gaya mengikuti sistem
 * desain Fan Signal: panel, micro label, condensed headline, kartu bg-nav
 * dan bg-brand, ikon lucide.
 */
export function PromoPopup({ ready }: { ready: boolean }) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!ready || armed) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(SEEN_KEY)) return;
    const t = setTimeout(() => {
      setOpen(true);
      setArmed(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [ready, armed]);

  useEffect(() => {
    if (!open) return;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* abaikan: mode privat */
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Promosi JKT48Connect"
    >
      <button
        type="button"
        aria-label="Tutup popup"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-ink/70 backdrop-blur-sm"
        style={{ animation: "jkt48c-fade-in .25s ease-out" }}
      />
      <div
        className="panel relative w-full max-w-lg p-6 sm:p-8"
        style={{ animation: "jkt48c-pop-in .32s cubic-bezier(.2,.9,.3,1.15)" }}
      >
        <button
          type="button"
          aria-label="Tutup"
          onClick={() => setOpen(false)}
          className="btn btn-ghost absolute right-4 top-4 !rounded-full !p-2"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="micro flex items-center gap-2 text-brand">
          <SignalBars className="h-3" /> Sinyal untuk komunitas
        </p>
        <h2 className="condensed mt-3 text-[clamp(1.9rem,5vw,2.6rem)] uppercase leading-[0.95]">
          Bawa JKT48Connect ke mana-mana
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
          Selain situs ini, JKT48Connect juga hidup di tempat lain — gratis dipakai komunitasmu.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-nav p-4 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand">
              <Braces className="h-5 w-5" />
            </span>
            <p className="mt-3 font-bold leading-snug">JKT48Connect API</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
              Data live, theater, member &amp; berita — pakai untuk bot atau aplikasimu sendiri.
            </p>
            <Link
              to="/developer"
              onClick={() => setOpen(false)}
              className="link-more mt-3 inline-flex items-center gap-1.5 text-[13px] text-white/80"
            >
              Lihat dokumentasi <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl bg-brand p-4 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
              <Bot className="h-5 w-5" />
            </span>
            <p className="mt-3 font-bold leading-snug">Bot Discord</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">
              Notifikasi live, rekap, tweet, TikTok, IG &amp; jadwal theater langsung di server kamu.
            </p>
            <Link
              to="/discord"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-white"
            >
              Pasang di server <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
      <style>{`@keyframes jkt48c-fade-in{from{opacity:0}}@keyframes jkt48c-pop-in{from{opacity:0;transform:scale(.92) translateY(14px)}}`}</style>
    </div>
  );
}
