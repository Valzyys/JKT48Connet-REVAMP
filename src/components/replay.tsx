import { Lock, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Countdown, useNow } from "@/components/countdown";
import { cx } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";
import { fmtDate, fmtDuration, fmtTime } from "@/lib/format";
import { gsap } from "@/lib/gsap";
import { REPLAY_LOCK_HOURS, type Recording } from "@/lib/jkt48";

const LOCK_MS = REPLAY_LOCK_HOURS * 3_600_000;

/**
 * Replay live yang diputar langsung di situs (di-stream lewat `/api/replay`, token terikat sesi).
 * Kunci 72 jam ditegakkan server: selama masa kunci server tidak mengirim URL apa pun (`recordings` kosong),
 * jadi panel terkunci dengan hitung mundur tampil. Saat waktunya tiba, data diminta ulang (`onUnlock`)
 * dan panel berubah jadi pemutar bila server sudah membukanya.
 */
export function Replay({
  recordings,
  count,
  unlockAt,
  onUnlock,
  vertical,
  poster,
}: {
  recordings: Recording[];
  count: number;
  unlockAt: string;
  onUnlock: () => void;
  vertical: boolean;
  poster?: string;
}) {
  const now = useNow();
  const unlock = Date.parse(unlockAt);
  const open = recordings.length > 0;
  const due = Number.isFinite(unlock) && now >= unlock;
  const [part, setPart] = useState(0);
  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const progress = Number.isFinite(unlock) ? Math.min(1, Math.max(0, 1 - (unlock - now) / LOCK_MS)) : 0;

  // Masuk: panel terbuka dari kiri, isi naik bertahap; bar masa tunggu terisi sampai posisi sekarang.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(el, { clipPath: "inset(0 100% 0 0 round 24px)" }, { clipPath: "inset(0 0% 0 0 round 24px)", duration: 0.9, ease: "expo.inOut" });
      gsap.from("[data-rp]", { y: 18, opacity: 0, duration: 0.5, stagger: 0.06, delay: 0.35 });
      if (bar.current) gsap.fromTo(bar.current, { scaleX: 0 }, { scaleX: progress, duration: 1.4, delay: 0.4, ease: "power3.out" });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Jam lokal bilang sudah waktunya tapi server belum mengirim rekaman → minta ulang (lalu tiap 30 detik,
  // bila jam perangkat sedikit lebih cepat dari server).
  const unlockRef = useRef(onUnlock);
  unlockRef.current = onUnlock;
  useEffect(() => {
    if (!due || open) return;
    unlockRef.current();
    const t = setInterval(() => unlockRef.current(), 30_000);
    return () => clearInterval(t);
  }, [due, open]);

  if (!count) return null;

  if (!open) {
    return (
      <section ref={root} className="relative overflow-hidden rounded-3xl bg-nav p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start gap-5">
          <span data-rp className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10">
            <Lock className="h-6 w-6 text-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <p data-rp className="micro text-white/50">
              Replay · terbuka {REPLAY_LOCK_HOURS} jam setelah live
            </p>
            <p data-rp className="condensed mt-2 text-[clamp(1.8rem,4vw,2.6rem)] uppercase leading-none">
              {due ? "Membuka…" : Number.isFinite(unlock) ? <Countdown target={unlockAt} /> : "Segera"}
            </p>
            {Number.isFinite(unlock) && (
              <p data-rp className="mt-2 text-[14px] text-white/70">
                Bisa diputar mulai {fmtDate(unlockAt, { weekday: "long", day: "numeric", month: "long" })}, {fmtTime(unlockAt)} WIB.
              </p>
            )}
          </div>
        </div>
        <div data-rp className="mt-6">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <span ref={bar} className="block h-full origin-left rounded-full bg-brand" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <p className="mt-2 flex justify-between font-mono text-[11px] text-white/45">
            <span>Live selesai</span>
            <span className="num">{Math.round(progress * 100)}%</span>
            <span>Replay terbuka</span>
          </p>
        </div>
      </section>
    );
  }

  const rec = recordings[Math.min(part, recordings.length - 1)];
  return (
    <section ref={root} className="overflow-hidden rounded-3xl bg-nav p-3 text-white sm:p-4">
      <div data-rp className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3 pt-1">
        <p className="micro flex items-center gap-2 text-white/60">
          <Play className="h-3.5 w-3.5 fill-brand text-brand" /> Replay
        </p>
        {recordings.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {recordings.map((r, i) => (
              <button
                key={r.url}
                type="button"
                onClick={() => setPart(i)}
                className={cx("pill transition-colors", i === part ? "bg-brand text-white" : "bg-white/10 text-white/70 hover:bg-white/20")}
              >
                Bagian {i + 1} · {fmtDuration(r.durationMs)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div data-rp>
        <VideoPlayer key={rec.url} src={rec.url} poster={poster} initialRatio={vertical ? 3 / 4 : 16 / 9} />
      </div>
      {rec.partial && <p className="px-2 pt-3 text-[12px] text-white/50">Sebagian rekaman tidak tercatat, jadi ada bagian live yang terlewat.</p>}
    </section>
  );
}
