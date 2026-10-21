import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Countdown } from "@/components/countdown";
import { NAV, SOCIALS, setlistNo } from "@/lib/nav";
import { q } from "@/lib/queries";

/** Rumbai tirai di tepi atas footer. */
function Valance() {
  return (
    <div
      aria-hidden
      className="velvet h-10"
      style={{
        WebkitMask: "radial-gradient(22px 14px at 50% 100%, #0000 98%, #000) 0 0 / 44px 100% repeat-x",
        mask: "radial-gradient(22px 14px at 50% 100%, #0000 98%, #000) 0 0 / 44px 100% repeat-x",
      }}
    />
  );
}

/** "Curtain call": penutup halaman berisi kredit dan hitung mundur ke show berikutnya. */
export function Footer() {
  const next = useQuery(q.nextSchedule());
  const show = next.data?.find((s) => s.category === "show");

  return (
    <footer className="mt-28">
      <Valance />
      <div className="container-x pb-10 pt-14">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.35em] text-ink-soft">Curtain call</p>
          <p className="condensed mx-auto mt-3 max-w-3xl text-[clamp(2.25rem,6vw,4.5rem)] uppercase leading-[0.9]">
            Terima kasih sudah datang ke theater
          </p>
          {show && (
            <Link to="/theater/$id" params={{ id: show.id }} className="group mt-6 inline-flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
              <span className="text-ink-soft">Show berikutnya</span>
              <span className="font-semibold group-hover:text-brand">{show.title}</span>
              <Countdown target={show.date} className="led text-[20px]" />
            </Link>
          )}
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-x-10 gap-y-8 border-t border-line pt-8 text-[14px] sm:grid-cols-3">
          <div>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-soft">Setlist</p>
            <ul className="grid grid-cols-2 gap-y-1.5">
              {NAV.map((n, i) => (
                <li key={n.to}>
                  <Link to={n.to} className="group inline-flex items-baseline gap-2 hover:text-brand">
                    <span className="led led-off text-[11px] group-hover:opacity-100">{setlistNo(i)}</span>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-soft">Komunitas</p>
            <ul className="space-y-1.5">
              {SOCIALS.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noreferrer" className="hover:text-brand">
                    {s.label} ↗
                  </a>
                </li>
              ))}
              <li>
                <a href="https://api.jkt48connect.app/docs" target="_blank" rel="noreferrer" className="hover:text-brand">
                  Public API ↗
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-soft">Catatan</p>
            <p className="leading-relaxed text-ink-soft">
              Proyek komunitas fan-made. Bukan situs resmi dan tidak berafiliasi dengan JKT48 Operation Team.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-4xl flex-col gap-2 border-t border-line pt-5 text-[13px] text-ink-soft sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} JKT48Connect</p>
          <div className="flex gap-4">
            <Link to="/disclaimer" className="hover:text-ink">
              Disclaimer
            </Link>
            <Link to="/terms" className="hover:text-ink">
              Ketentuan
            </Link>
            <Link to="/privacy" className="hover:text-ink">
              Privasi
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
