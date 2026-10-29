import { ArrowRight, CalendarDays, Radio, Ticket } from "lucide-react";
import { useRef, type CSSProperties, type MouseEvent } from "react";
import type { LiveSession, TheaterShow } from "@/lib/data";
import { countdown, dateParts, fmtDate, fmtTime } from "@/lib/format";
import { Link } from "@/lib/router";
import { cx, Img, PixelCross } from "./ui";

/**
 * Hero "Panggung" khusus aplikasi desktop: lantai panggung gelap dengan dua sorot lampu yang berayun,
 * kisi piksel samar, judul show yang naik huruf demi huruf, hitung mundur bergulir, kartu banner 3D yang
 * condong mengikuti kursor, lineup yang mekar satu per satu, dan ticker jadwal berjalan di bawah.
 */
export function StageHero({ show, upcoming, live, now }: { show: TheaterShow; upcoming: TheaterShow[]; live: LiveSession[]; now: number }) {
  const stage = useRef<HTMLDivElement>(null);
  const c = countdown(new Date(show.date), now);
  const d = dateParts(show.date);
  const faces = show.members.filter((m) => m.img);

  // Kemiringan kartu & arah sorot lampu mengikuti kursor (CSS var, tanpa render ulang React).
  const move = (e: MouseEvent) => {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--mx", x.toFixed(3));
    el.style.setProperty("--my", y.toFixed(3));
  };
  const leave = () => {
    stage.current?.style.setProperty("--mx", "0");
    stage.current?.style.setProperty("--my", "0");
  };

  const ticker = upcoming.length ? upcoming : [show];

  return (
    <section
      ref={stage}
      onMouseMove={move}
      onMouseLeave={leave}
      className="stage group/stage @container relative isolate overflow-hidden rounded-[34px] bg-[#0f0a0c] text-[#f6efe9] shadow-[0_40px_80px_-40px_rgb(15_10_12/0.9)]"
      style={{ "--mx": 0, "--my": 0 } as CSSProperties}
    >
      {/* Lampu & tekstur */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="stage-glow absolute -left-[10%] top-[-40%] h-[120%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgb(225_36_58/0.55),transparent)] blur-2xl" />
        <div className="stage-glow-2 absolute -right-[15%] bottom-[-50%] h-[110%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(253_230_176/0.16),transparent)] blur-2xl" />
        <div className="beam beam-l absolute left-[18%] top-[-30%] h-[160%] w-[180px] origin-top bg-[linear-gradient(180deg,rgb(255_255_255/0.16),transparent_75%)] blur-md" />
        <div className="beam beam-r absolute left-[58%] top-[-30%] h-[160%] w-[140px] origin-top bg-[linear-gradient(180deg,rgb(255_120_140/0.18),transparent_75%)] blur-md" />
        <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(180deg,black,transparent_85%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="grid gap-8 p-7 @3xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)] @3xl:p-9 @6xl:gap-12">
        {/* Kiri: info show */}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <span className="pill bg-white/10 text-white backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff3b52]" />
              {show.category === "show" ? "On stage next" : "Jadwal berikutnya"}
            </span>
            {show.team && <span className="micro text-white/50">{show.team}</span>}
            <span className="micro ml-auto hidden items-center gap-2 text-white/45 @5xl:flex">
              <Ticket className="h-3.5 w-3.5" /> #{show.id}
            </span>
          </div>

          <h2 key={show.id} className="condensed mt-6 text-[clamp(2.8rem,5.2vw,5.6rem)] uppercase leading-[0.84]" aria-label={show.title}>
            {show.title.split(" ").map((word, wi, words) => (
              <span key={wi} className="inline-block whitespace-nowrap">
                {[...word].map((ch, ci) => (
                  <span
                    key={ci}
                    aria-hidden
                    className="char inline-block"
                    style={{ animationDelay: `${(words.slice(0, wi).join("").length + ci) * 32 + 120}ms` }}
                  >
                    {ch}
                  </span>
                ))}
                {wi < words.length - 1 && <span className="inline-block w-[0.25em]" />}
              </span>
            ))}
          </h2>

          <div className="fade-up mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[13px] text-white/70" style={{ animationDelay: "420ms" }}>
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#ff6476]" /> {fmtDate(show.date, { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <span>{fmtTime(show.date)} WIB</span>
            {show.memberCount ? <span>{show.memberCount} member</span> : null}
          </div>

          <div className="flex-1" />

          {c ? (
            <div className="fade-up mt-8 flex items-end gap-2.5" style={{ animationDelay: "520ms" }}>
              {(
                [
                  [c.d, "hari"],
                  [c.h, "jam"],
                  [c.m, "menit"],
                  [c.s, "detik"],
                ] as const
              ).map(([v, k], i) => (
                <div key={k} className="flex items-end gap-2.5">
                  <div className="text-center">
                    <div className="flex gap-1">
                      {String(v)
                        .padStart(2, "0")
                        .split("")
                        .map((digit, di) => (
                          <span key={di} className="relative grid h-[66px] w-[46px] place-items-center overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.07] backdrop-blur-md">
                            <span key={digit} className="roll num condensed text-[40px] leading-none">
                              {digit}
                            </span>
                            <span className="absolute inset-x-0 top-1/2 h-px bg-black/30" />
                          </span>
                        ))}
                    </div>
                    <p className="micro mt-2 text-[9.5px] text-white/50">{k}</p>
                  </div>
                  {i < 3 && <span className="condensed mb-8 text-[28px] text-white/25">:</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="fade-up mt-8 flex items-center gap-2 text-[15px] font-bold text-[#ff6476]">
              <span className="live-dot" /> Show sedang berlangsung
            </p>
          )}

          <div className="fade-up mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: "620ms" }}>
            <Link to={`/theater/${encodeURIComponent(show.id)}`} className="btn group/btn bg-[#e1243a] text-white shadow-[0_14px_30px_-12px_#e1243a] hover:bg-[#ff3b52]">
              Lihat lineup <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
            </Link>
            <Link to="/schedule" className="btn border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]">
              Semua jadwal
            </Link>
            {live.length > 0 && (
              <Link to="/live" className="btn border border-[#ff3b52]/40 bg-[#ff3b52]/15 text-[#ffb3bd] hover:bg-[#ff3b52]/25">
                <Radio className="h-4 w-4" /> {live.length} member live
              </Link>
            )}
          </div>
        </div>

        {/* Kanan: kartu banner 3D + lineup */}
        <div className="relative hidden min-h-[320px] @3xl:block [perspective:1400px]">
          <div className="tilt relative mx-auto mt-2 w-full max-w-[560px]">
            <div className="absolute inset-0 translate-x-5 translate-y-5 rotate-[4deg] rounded-[24px] bg-[#e1243a]/80 shadow-2xl" />
            <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rotate-[2deg] rounded-[24px] bg-[#fde6b0]/90" />
            <div className="relative overflow-hidden rounded-[24px] border border-white/15 bg-[#1d1517] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]">
              {show.banner ? (
                <Img src={show.banner} eager className="aspect-[16/9] w-full" />
              ) : (
                <div className="grid aspect-[16/9] place-items-center bg-[linear-gradient(150deg,#e1243a,#9e1326)]">
                  <PixelCross className="h-20 w-20" cell="fill-white/90" />
                </div>
              )}
              <div className="sheen pointer-events-none absolute inset-0" />
            </div>
            {/* Tiket tanggal menempel di sudut kartu */}
            <div className="float absolute -left-6 -top-5 rounded-[18px] bg-[#fbf8f3] px-4 py-3 text-center text-[#1d1517] shadow-xl">
              <p className="micro text-[9px] text-[#e1243a]">{d.weekday}</p>
              <p className="num condensed text-[38px] leading-none">{d.day}</p>
              <p className="micro text-[9px] text-[#776b66]">{d.month}</p>
            </div>
          </div>

          {faces.length > 0 && (
            <div className="relative mt-8 flex items-center justify-center">
              <div className="flex -space-x-3">
                {faces.slice(0, 10).map((m, i) => (
                  <Link key={m.id || m.name} to={m.id ? `/member/${encodeURIComponent(m.id)}` : `/theater/${encodeURIComponent(show.id)}`} title={m.name} className="pop relative block transition-transform duration-300 hover:z-10 hover:-translate-y-2 hover:scale-110" style={{ animationDelay: `${600 + i * 55}ms` }}>
                    <Img src={m.img} alt={m.name} className="h-12 w-12 rounded-full border-[3px] border-[#0f0a0c] object-top" />
                  </Link>
                ))}
              </div>
              {show.members.length > 10 && <span className="pop ml-3 font-mono text-[12px] text-white/55" style={{ animationDelay: "1200ms" }}>+{show.members.length - 10}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Ticker jadwal */}
      <div className="relative border-t border-white/10 bg-black/25 py-3 backdrop-blur">
        <div className="flex w-max marquee hover:[animation-play-state:paused]">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
              {[...ticker, ...ticker, ...ticker].slice(0, Math.max(6, ticker.length)).map((s, i) => (
                <Link key={`${dup}-${i}`} to={s.category === "show" ? `/theater/${encodeURIComponent(s.id)}` : "/schedule"} className="flex items-center gap-3 px-6 text-[13px] text-white/70 transition-colors hover:text-white">
                  <PixelCross className="h-3 w-3" cell={cx(s.category === "show" ? "fill-[#ff3b52]" : "fill-[#fde6b0]")} />
                  <span className="font-mono text-[11.5px] uppercase tracking-wider text-white/45">{fmtDate(s.date, { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className="font-semibold">{s.title}</span>
                  <span className="font-mono text-[11.5px] text-white/45">{fmtTime(s.date)}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
