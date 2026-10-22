import { Camera, Clock, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { useNow } from "@/components/countdown";
import { createPortal } from "react-dom";
import { useBlocked } from "@/lib/blocked";

const fmtWib = (ms: number) =>
  `${new Date(ms).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "medium" })} WIB`;

/**
 * Layar blokir: menutup seluruh situs saat server memblokir IP ini (poin curiga melewati ambang).
 * Berisi ID insiden untuk di-screenshot dan dikirim ke admin; detail lengkap ada di log Worker.
 */
const pad = (n: number) => String(n).padStart(2, "0");

/** "05:42:10" — sisa waktu blokir. */
function left(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s / 60) % 60))}:${pad(s % 60)}`;
}

export function Blocked() {
  const b = useBlocked();
  const now = useNow();
  const remaining = b ? b.until - now : 0;

  // Blokir selalu sementara: begitu waktunya habis, muat ulang supaya situs terbuka lagi tanpa perlu apa-apa.
  useEffect(() => {
    if (b && remaining <= 0) {
      const t = setTimeout(() => window.location.reload(), 1500);
      return () => clearTimeout(t);
    }
  }, [b, remaining]);

  useEffect(() => {
    if (!b) return;
    document.title = "Akses diblokir · JKT48Connect";
    document.documentElement.style.overflow = "hidden";
  }, [b]);

  if (!b) return null;
  const rows: [string, string][] = [
    ["ID insiden", b.incident],
    ["Alasan", b.reasonLabel],
    ["Waktu", fmtWib(b.at)],
    ["Berlaku sampai", fmtWib(b.until)],
    ["IP", b.ip],
  ];

  return createPortal(
    <div role="alertdialog" aria-modal="true" aria-labelledby="blocked-title" className="fixed inset-0 z-[2147483646] grid place-items-center overflow-y-auto bg-bg p-4">
      <main className="w-full max-w-[560px] overflow-hidden rounded-3xl border border-line bg-card">
        <header className="bg-brand px-6 py-7 text-white">
          <p className="micro flex items-center gap-2 text-white/80">
            <ShieldAlert className="h-4 w-4" /> JKT48Connect · keamanan
          </p>
          <h1 id="blocked-title" className="condensed mt-3 text-[clamp(2rem,8vw,2.8rem)] uppercase leading-none">
            Akses diblokir
          </h1>
        </header>
        <section className="p-6">
          <p className="text-ink-soft">
            Aktivitas mencurigakan terdeteksi dari jaringanmu, jadi akses ke JKT48Connect dihentikan sementara.
          </p>
          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-surface p-4">
            <Clock className="h-6 w-6 shrink-0 text-brand" />
            <div>
              <p className="micro text-ink-soft">{remaining > 0 ? "Terbuka otomatis dalam" : "Membuka kembali…"}</p>
              <p className="num font-mono text-[26px] font-bold leading-tight">{left(remaining)}</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[14px] text-ink-soft">{k}</dt>
                <dd className={k === "ID insiden" ? "font-mono text-[18px] font-bold text-brand" : "break-words font-semibold"}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-dashed border-brand p-4 font-semibold">
            <Camera className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <span>
              Screenshot halaman ini dan kirim ke admin bila menurutmu ini keliru. Dengan ID insiden di atas, admin bisa membuka blokir lebih
              cepat.
            </span>
          </p>
        </section>
      </main>
    </div>,
    document.body,
  );
}
