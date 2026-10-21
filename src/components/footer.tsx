import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { MORE_NAV, PRIMARY_NAV, SOCIALS } from "@/lib/nav";

const TICKER = ["Live member", "Jadwal theater", "Birthday", "Recent live", "Berita resmi", "Video terbaru"];

function Ticker() {
  const row = (
    <div className="flex shrink-0 items-center">
      {TICKER.map((t) => (
        <span key={t} className="flex items-center gap-8 pr-8 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t}
          <span aria-hidden className="text-brand">
            ✦
          </span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-y border-line py-5" aria-hidden>
      <div className="marquee">
        {row}
        {row}
      </div>
    </div>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-5 !text-ink-soft">{title}</p>
      <ul className="space-y-2.5 text-[15px]">{children}</ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-28">
      <Ticker />
      <div className="container-x grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink-soft">
            Hub komunitas untuk mengikuti JKT48 secara real-time: live member, jadwal theater, birthday, rekap live, dan
            berita terbaru — dalam satu tempat.
          </p>
          <p className="num mt-6 text-[11px] uppercase tracking-[0.2em] text-ink-soft">
            Fan-made · bukan situs resmi JKT48
          </p>
        </div>
        <Col title="Jelajah">
          {PRIMARY_NAV.slice(1).map((n) => (
            <li key={n.to}>
              <Link to={n.to} className="text-ink-soft transition hover:text-ink">
                {n.label}
              </Link>
            </li>
          ))}
        </Col>
        <Col title="Lainnya">
          {MORE_NAV.map((n) => (
            <li key={n.to}>
              <Link to={n.to} className="text-ink-soft transition hover:text-ink">
                {n.label}
              </Link>
            </li>
          ))}
        </Col>
        <Col title="Komunitas">
          {SOCIALS.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-soft transition hover:text-ink">
                {s.label} <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
          <li>
            <a
              href="https://api.jkt48connect.app/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ink-soft transition hover:text-ink"
            >
              Public API <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </li>
        </Col>
      </div>

      <div className="container-x overflow-hidden">
        <p
          aria-hidden
          className="select-none font-display text-[18.5vw] font-extrabold leading-[0.8] tracking-[-0.06em] text-ink lg:text-[17vw]"
        >
          jkt48<span className="text-brand">.</span>c
        </p>
      </div>

      <div className="border-t border-line">
        <div className="container-x flex flex-col gap-3 py-6 text-[12px] text-ink-soft md:flex-row md:items-center md:justify-between">
          <p className="num uppercase tracking-[0.15em]">© {new Date().getFullYear()} JKT48Connect</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/disclaimer" className="hover:text-ink">
              Disclaimer
            </Link>
            <Link to="/terms" className="hover:text-ink">
              Syarat & Ketentuan
            </Link>
            <Link to="/privacy" className="hover:text-ink">
              Privasi
            </Link>
          </div>
          <p>Tidak berafiliasi dengan JKT48 Operation Team.</p>
        </div>
      </div>
    </footer>
  );
}
