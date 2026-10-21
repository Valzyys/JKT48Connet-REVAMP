import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useClock } from "@/hooks/use-clock";
import { gsap } from "@/lib/gsap";
import { q } from "@/lib/queries";

const IntroContext = createContext(true);

/** `true` setelah intro selesai (atau dilewati). Dipakai beranda untuk memulai animasinya. */
export function useIntroDone() {
  return useContext(IntroContext);
}

/** Intro diputar setiap kali situs dibuka (muat penuh); navigasi di dalam situs tidak memutarnya lagi. */
export function IntroProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);
  const finish = useRef(() => setDone(true)).current;

  return (
    <IntroContext.Provider value={done}>
      {children}
      {!done && <SignalIntro onDone={finish} />}
    </IntroContext.Provider>
  );
}

const CARDS = 12;
const RED = "#e1243a";
const INK = "#1d1517";
const BUTTER = "#fde6b0";
const WORDS = ["JKT48CONNECT", "YOUR OSHI", "FRONT ROW", "LIVE", "THEATER", "BIRTHDAY"];

function split(text: string, attr: string) {
  return text.split("").map((c, i) => (
    <span key={i} data-i={attr} className="inline-block whitespace-pre">
      {c}
    </span>
  ));
}

/**
 * Intro "Oshi Roulette" (± 5 detik, bisa dilewati):
 * 1. layar merah, hitung mundur 3-2-1, HUD di empat sudut, dua baris teks raksasa bergaris tepi melaju berlawanan;
 * 2. 12 photocard member asli tersusun jadi cincin 3D lalu berputar kencang dan melambat;
 * 3. cincin berhenti di satu kartu acak: kartu membesar, hati berhamburan, nama "oshi hari ini" muncul;
 * 4. kartu-kartu terlempar keluar dan layar merah terbelah atas-bawah membuka halaman.
 */
function SignalIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const clock = useClock();
  const members = useQuery(q.members());

  // 12 member aktif berfoto, urutan acak per kunjungan.
  const lineup = useMemo(() => {
    const pool = (members.data ?? []).filter((m) => !m.isGraduate && m.img);
    return gsap.utils.shuffle([...pool]).slice(0, CARDS);
  }, [members.data]);
  const [oshi] = useState(() => Math.floor(Math.random() * CARDS));
  const pick = lineup[oshi];

  useLayoutEffect(() => {
    document.body.classList.add("is-locked");
    const ctx = gsap.context(() => {
      const el = root.current!;
      const small = window.innerWidth < 640;
      const radius = small ? 210 : 340;
      const step = 360 / CARDS;
      const cards = gsap.utils.toArray<HTMLElement>("[data-i='card']", el);
      // Urutan transform harus rotateY lalu translateZ (GSAP selalu translate dulu), jadi slot diatur langsung lewat CSS.
      gsap.utils.toArray<HTMLElement>("[data-i='slot']", el).forEach((slot, i) => {
        slot.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`;
      });

      const t = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          document.body.classList.remove("is-locked");
          onDone();
        },
      });
      tl.current = t;

      t.from("[data-i='hud']", { opacity: 0, duration: 0.03, stagger: 0.01 }, 0)
        .from("[data-i='bar']", { scaleY: 0, transformOrigin: "50% 100%", duration: 0.3, stagger: 0.12 }, 0.1)
        // Hitung mundur 3-2-1.
        .fromTo("[data-i='count']", { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.18, stagger: 0.28, ease: "back.out(2)" }, 0.05)
        .to("[data-i='count']", { scale: 0.4, opacity: 0, duration: 0.14, stagger: 0.28, ease: "power2.in" }, 0.25)
        // Teks raksasa melaju berlawanan arah.
        .fromTo("[data-i='row-a']", { xPercent: 0 }, { xPercent: -30, duration: 5, ease: "none" }, 0.3)
        .fromTo("[data-i='row-b']", { xPercent: -30 }, { xPercent: 0, duration: 5, ease: "none" }, 0.3)
        .from("[data-i='row-a'], [data-i='row-b']", { opacity: 0, duration: 0.5 }, 0.3)
        // Cincin photocard muncul lalu berputar dan melambat di kartu terpilih.
        .from(cards, { scale: 0, opacity: 0, duration: 0.5, stagger: { each: 0.03, from: "random" }, ease: "back.out(1.8)" }, 0.85)
        .fromTo("[data-i='ring']", { rotationY: 140, rotationX: -14 }, { rotationY: -(oshi * step) - 720, rotationX: -6, duration: 2.3, ease: "expo.inOut" }, 0.85)
        // Kartu terpilih.
        .to(cards[oshi], { scale: 1.2, duration: 0.45, ease: "back.out(3)" }, 3.1)
        .to(cards.filter((_, i) => i !== oshi), { opacity: 0.35, duration: 0.3 }, 3.1)
        .fromTo("[data-i='heart']", { scale: 0, x: 0, y: 0, opacity: 1 }, {
          scale: () => gsap.utils.random(0.6, 1.4),
          x: () => gsap.utils.random(-260, 260),
          y: () => gsap.utils.random(-220, 160),
          rotate: () => gsap.utils.random(-50, 50),
          opacity: 0,
          duration: 1,
          stagger: 0.015,
          ease: "power3.out",
        }, 3.15)
        // Nama bisa berubah saat data member datang, jadi pembungkusnya yang disembunyikan sampai giliran.
        .fromTo("[data-i='pickwrap']", { opacity: 0 }, { opacity: 1, duration: 0.01 }, 3.25)
        .from("[data-i='pick']", { yPercent: 110, duration: 0.45, stagger: 0.025, ease: "back.out(2)" }, 3.25)
        .from("[data-i='picklabel']", { opacity: 0, y: 10, duration: 0.3 }, 3.2)
        .addLabel("out", 4.2)
        // Keluar: kartu terlempar, layar terbelah.
        .to(cards, {
          x: () => gsap.utils.random(-500, 500),
          y: () => gsap.utils.random(-400, 400),
          opacity: 0,
          duration: 0.5,
          ease: "power3.in",
          stagger: { each: 0.015, from: "random" },
        }, "out")
        .to("[data-i='hud'], [data-i='bar'], [data-i='row-a'], [data-i='row-b'], [data-i='pickwrap'], [data-i='picklabel']", { opacity: 0, duration: 0.25 }, "out")
        .set("[data-i='bg']", { opacity: 0 }, "out+=0.45")
        .to("[data-i='top']", { yPercent: -100, duration: 0.65, ease: "expo.inOut" }, "out+=0.45")
        .to("[data-i='bottom']", { yPercent: 100, duration: 0.65, ease: "expo.inOut" }, "out+=0.45");
    }, root);

    return () => {
      document.body.classList.remove("is-locked");
      ctx.revert();
    };
  }, [onDone, oshi]);

  const row = (attr: string, words: string[]) => (
    <div data-i={attr} className="flex w-max whitespace-nowrap">
      {Array.from({ length: 4 }).flatMap((_, k) =>
        words.map((w) => (
          <span key={`${k}-${w}`} className="px-[2vw]" style={{ WebkitTextStroke: "1.5px rgb(255 255 255 / 0.35)", color: "transparent" }}>
            {w}
          </span>
        )),
      )}
    </div>
  );

  return (
    <div ref={root} className="fixed inset-0 z-[100] overflow-hidden text-white" aria-hidden>
      {/* Dua panel merah yang nanti terbelah atas-bawah */}
      <div data-i="top" className="absolute inset-x-0 top-0 h-1/2" style={{ background: RED }} />
      <div data-i="bottom" className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: RED }} />
      <div data-i="bg" className="absolute inset-0" style={{ background: RED }} />

      {/* Teks raksasa bergaris tepi */}
      <div className="pointer-events-none absolute inset-x-0 top-[9%] overflow-hidden font-extrabold uppercase leading-none" style={{ fontStretch: "75%", fontSize: "clamp(4rem, 14vw, 12rem)" }}>
        {row("row-a", WORDS)}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[9%] overflow-hidden font-extrabold uppercase leading-none" style={{ fontStretch: "75%", fontSize: "clamp(4rem, 14vw, 12rem)" }}>
        {row("row-b", [...WORDS].reverse())}
      </div>

      {/* Hitung mundur */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {["3", "2", "1"].map((n) => (
          <span key={n} data-i="count" className="absolute font-extrabold leading-none opacity-0" style={{ fontStretch: "75%", fontSize: "clamp(8rem, 30vw, 22rem)" }}>
            {n}
          </span>
        ))}
      </div>

      {/* Cincin photocard 3D */}
      <div className="absolute inset-0" style={{ perspective: "1100px" }}>
        <div data-i="ring" className="absolute left-1/2 top-[46%] h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
          {Array.from({ length: CARDS }).map((_, i) => {
            const m = lineup[i];
            return (
              <div key={i} data-i="slot" className="absolute left-0 top-0" style={{ transformStyle: "preserve-3d" }}>
              <div
                data-i="card"
                className="absolute -left-[50px] -top-[68px] h-[136px] w-[100px] overflow-hidden rounded-xl border-[3px] border-white bg-white shadow-[0_18px_40px_-14px_rgb(0_0_0/0.45)] sm:-left-[75px] sm:-top-[100px] sm:h-[200px] sm:w-[150px] sm:rounded-2xl sm:border-4"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="absolute inset-0" style={{ background: "#f6dcdc" }} />
                {m && <img src={m.img} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />}
                <span className="absolute left-1.5 top-1.5 rounded-full px-1.5 font-mono text-[9px] font-semibold text-white sm:text-[11px]" style={{ background: RED }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {m && (
                  <span className="absolute inset-x-0 bottom-0 truncate px-2 py-1 text-[10px] font-extrabold sm:text-[13px]" style={{ background: "rgb(255 255 255 / 0.92)", color: INK }}>
                    {m.nickname || m.name.split(" ")[0]}
                  </span>
                )}
              </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hati berhamburan dari kartu terpilih */}
      <div className="pointer-events-none absolute left-1/2 top-[46%]">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} data-i="heart" className="absolute -ml-3 -mt-3 text-[24px] opacity-0" style={{ color: i % 3 ? "#fff" : BUTTER }}>
            ♥
          </span>
        ))}
      </div>

      {/* Nama oshi terpilih */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(46%+124px)] text-center sm:top-[calc(46%+218px)]">
        <p data-i="picklabel" className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 sm:text-[11px]">
          ♥ Oshi hari ini
        </p>
        <p data-i="pickwrap" className="mt-1 overflow-hidden font-extrabold uppercase leading-[0.95]" style={{ fontStretch: "75%", fontSize: "clamp(2.2rem, 6vw, 4rem)", color: BUTTER }}>
          {split(pick ? pick.nickname || pick.name.split(" ")[0] : "JKT48", "pick")}
        </p>
      </div>

      {/* HUD empat sudut */}
      <div className="absolute inset-x-5 top-5 flex justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.18em] sm:inset-x-8 sm:top-7 sm:text-[11px]">
        <span>{split("JKT48Connect · Oshi roulette", "hud")}</span>
        <span className="hidden sm:inline">{split(`WIB ${clock}`, "hud")}</span>
      </div>
      <div className="absolute inset-x-5 bottom-5 flex items-end justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.18em] sm:inset-x-8 sm:bottom-7 sm:text-[11px]">
        <span>{split(`${lineup.length || CARDS} members · spin`, "hud")}</span>
        <span className="flex h-5 items-end gap-[3px]">
          {[0.35, 0.55, 0.75, 1].map((h, i) => (
            <span key={i} data-i="bar" className="w-[4px] rounded-[1px] bg-white" style={{ height: `${h * 100}%` }} />
          ))}
        </span>
      </div>

      <button
        type="button"
        onClick={() => tl.current?.progress(1)}
        className="absolute bottom-14 right-5 z-10 rounded-full border border-white/40 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-[#e1243a] sm:bottom-16 sm:right-8"
      >
        Lewati
      </button>
    </div>
  );
}
