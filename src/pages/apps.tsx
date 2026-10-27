import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Countdown } from "@/components/countdown";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { getAppRelease, type AppRelease } from "@/lib/jkt48";
import { q } from "@/lib/queries";
import { STATIC_PAGES } from "@/lib/seo";

/*
 * Landing page aplikasi yang mengikuti gaya grafis brand JKT48Connect (kartu "live notice" dari API):
 * kertas krem bergrid "+", garis lengkung pink, wordmark dengan asterisk merah, label mono, panel merah
 * membulat, judul tebal rapat dengan titik kotak kuning, foto polaroid miring, dan maskot ASCII "ON AIR!".
 * Selalu tema terang. Animasi hanya transform/opacity (dan stroke garis lengkung sekali saat masuk).
 */

/** APK selalu bernama sama di setiap rilis, jadi tautan "latest" GitHub selalu menuju versi terbaru. */
const LATEST_APK = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/latest/download/jkt48connect.apk";
/** .ipa iPhone di prerelease tetap "ios-latest" (rilis "latest" milik APK). Dibuka di Safari iPhone lalu "Bagikan → Scarlet/ESign/Feather". */
const IOS_IPA = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest/jkt48connect.ipa";
const IOS_GUIDE = "https://github.com/Valzyys/JKT48Connet-REVAMP/blob/main/ios/README.md#memasang-ipa";
const GITHUB_STAR = "https://github.com/JKT48Connect/JKT48Connect-APP";
const REVIEW_INTENT = `https://x.com/intent/post?text=${encodeURIComponent("Pakai aplikasi JKT48Connect buat pantau live, jadwal theater & recent member JKT48. Menurutku: ")}&url=${encodeURIComponent("https://jkt48connect.app/apps")}&hashtags=JKT48ConnectApp`;
const REVIEW_SEARCH = "https://x.com/search?q=%23JKT48ConnectApp&f=live";

/** Pola grid "+" seperti latar kartu brand. */
const plus = (stroke: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='54' height='54'><path d='M27 23v8M23 27h8' stroke='${stroke}' stroke-width='1.2'/></svg>`)}")`;
const PLUS_INK = plus("rgba(225,36,58,0.16)");
const PLUS_WHITE = plus("rgba(255,255,255,0.16)");

const FEATURES = [
  { word: "Live", line: "Notif masuk ±15 detik setelah live dimulai, walau aplikasi ditutup.", meta: "IDN / Showroom", src: "/apps/home.webp", red: true },
  { word: "Recent", line: "Durasi, penonton, gift, top supporter, dan replay tiap live.", meta: "Rekap live", src: "/apps/recent.webp" },
  { word: "Sosmed", line: "Posting X, TikTok, dan Instagram member. Foto & videonya bisa diunduh.", meta: "X / TikTok / IG", src: "/apps/sosmed.webp" },
  { word: "YouTube", line: "Video JKT48 & JKT48 TV diputar di aplikasi, lengkap dengan komentar.", meta: "JKT48 / JKT48 TV", src: "/apps/video.webp", red: true },
  { word: "Oshi", line: "Tandai member favorit, beranda dan notifikasi mendahulukan mereka.", meta: "Member / favorit", src: "/apps/member.webp", red: true },
  { word: "Gelap", line: "Ikut tema sistem, atau pilih terang / gelap sendiri.", meta: "Tema", src: "/apps/home-dark.webp" },
];

const FAQ = [
  { q: "Apakah gratis?", a: "Ya, gratis dan tanpa iklan. Kalau mau, kamu bisa mendukung lewat menu Donasi (QRIS) di aplikasi." },
  { q: "Kenapa tidak ada di Play Store?", a: "JKT48Connect proyek fans yang dirilis langsung lewat GitHub Releases. Setiap APK ditandatangani kunci yang sama, jadi update berikutnya bisa langsung dipasang di atas versi lama." },
  { q: "Aman dipasang?", a: "APK dibangun otomatis dari kode sumber di GitHub. Aplikasi tidak meminta akun, kontak, atau lokasi. Izin yang dipakai: internet, notifikasi, dan memasang update." },
  { q: "Butuh Android versi berapa?", a: "Android 8.0 (Oreo) ke atas." },
  { q: "Ada untuk iPhone?", a: "Ada, sebagai file .ipa yang bisa dipasang langsung dari iPhone tanpa PC: unduh lewat tombol iPhone, lalu buka dengan Scarlet, ESign, atau Feather (atau tambahkan repo JKT48Connect di aplikasi itu supaya bisa update). Panduan lengkap ada di tautan \"Cara pasang di iPhone\". Tanpa memasang apa pun, situs jkt48connect.app isinya sama." },
  { q: "Apakah resmi dari JKT48?", a: "Bukan. JKT48Connect dibuat oleh fans dan tidak berafiliasi dengan JKT48 Operation Team." },
];

const pad2 = (n: number) => String(n).padStart(2, "0");
const wib = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("id-ID", { ...opts, timeZone: "Asia/Jakarta" });

function fmtSize(bytes?: number) {
  return bytes ? `${(bytes / 1_048_576).toFixed(1).replace(".", ",")} MB` : "±2,5 MB";
}

function fmtDate(iso?: string) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** Ringkasan rilis dari catatan GitHub: baris pertama yang bukan "Merge pull request …", sebelum pemisah "---". */
function releaseSummary(r?: AppRelease) {
  const lines = (r?.notes ?? "").split("---")[0].split("\n").map((l) => l.trim()).filter(Boolean);
  const line = lines.find((l) => !/^merge pull request/i.test(l)) ?? "";
  return line.replace(/^APK\s+\d+\.\d+\.\d+\s*:\s*/i, "");
}

export function AppsPage() {
  const meta = STATIC_PAGES["/apps"];
  useDocumentTitle(meta?.title, meta?.description);
  const root = useRef<HTMLDivElement>(null);
  const release = useQuery({ queryKey: ["app-release"], queryFn: getAppRelease, staleTime: 10 * 60_000, retry: 1 });
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const birthdays = useQuery(q.birthdays());
  const apk = release.data?.apk || LATEST_APK;
  const version = release.data?.version;
  const size = fmtSize(release.data?.size);
  const summary = releaseSummary(release.data);
  const liveList = live.data ?? [];
  const cards = liveList.filter((l) => l.banner).slice(0, 4);
  const show = next.data?.find((s) => s.category === "show") ?? next.data?.[0];
  const bday = birthdays.data?.[0];

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.utils.toArray<HTMLElement>("[data-in]").forEach((box) => {
          gsap.from(box, { opacity: 0, duration: 0.6, scrollTrigger: { trigger: box, start: "top 92%", once: true } });
        });
        return;
      }

      // Asterisk wordmark berputar pelan; garis lengkung "digambar" saat masuk lalu bergeser mengikuti gulir.
      gsap.to("[data-asterisk]", { rotate: 360, duration: 14, repeat: -1, ease: "none" });
      gsap.utils.toArray<SVGPathElement>("[data-swoosh] path").forEach((p) => {
        const len = p.getTotalLength();
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2.4, ease: "power2.inOut", scrollTrigger: { trigger: p.closest("section") ?? p, start: "top 85%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-swoosh]").forEach((s) => {
        gsap.to(s, { yPercent: -12, rotate: 4, ease: "none", scrollTrigger: { trigger: s.closest("section") ?? s, start: "top bottom", end: "bottom top", scrub: 1 } });
      });

      // Hero: panel muncul, huruf judul naik, titik kuning "dicap", polaroid jatuh, baris info menyusul.
      gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .from("[data-panel]", { y: 40, scale: 0.97, opacity: 0, duration: 1 })
        .from("[data-hero-badge]", { y: 16, opacity: 0, duration: 0.6 }, 0.35)
        .from("[data-hero] [data-char]", { yPercent: 110, duration: 0.9, stagger: 0.04 }, 0.4)
        .from("[data-hero] [data-dot]", { scale: 0, rotate: -90, duration: 0.6, ease: "back.out(4)" }, 0.95)
        .from("[data-hero-sub]", { y: 20, opacity: 0, duration: 0.7, stagger: 0.08 }, 0.8)
        .from("[data-polaroid-hero]", { y: -90, rotate: 16, opacity: 0, duration: 1.2, ease: "back.out(1.3)" }, 0.55)
        .from("[data-mascot]", { y: 30, opacity: 0, duration: 0.8 }, 1.1)
        .from("[data-hero-row] > *", { y: 24, opacity: 0, duration: 0.7, stagger: 0.08 }, 1);
      gsap.to("[data-mascot]", { y: -8, duration: 1.4, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 2 });
      gsap.to("[data-polaroid-hero]", { yPercent: -10, rotate: 6, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true } });

      // Kartu & blok lain muncul saat digulir; judul besar naik per huruf dengan titik kuningnya.
      gsap.utils.toArray<HTMLElement>("[data-in]").forEach((box) => {
        gsap.from(box, { y: 50, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: box, start: "top 88%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-big]").forEach((big) => {
        if (big.closest("[data-hero]")) return;
        const st = { trigger: big, start: "top 90%", once: true };
        gsap.from(big.querySelectorAll("[data-char]"), { yPercent: 110, duration: 0.8, stagger: 0.035, ease: "power4.out", scrollTrigger: st });
        gsap.from(big.querySelectorAll("[data-dot]"), { scale: 0, rotate: -90, duration: 0.6, delay: 0.4, ease: "back.out(4)", scrollTrigger: st });
      });
      gsap.utils.toArray<HTMLElement>("[data-polaroid]").forEach((p, i) => {
        gsap.from(p, { y: 120, rotate: i % 2 ? -14 : 14, duration: 1.1, ease: "back.out(1.2)", scrollTrigger: { trigger: p.parentElement ?? p, start: "top 80%", once: true } });
      });
    }, el);

    // Tinggi halaman berubah saat data & gambar selesai dimuat → posisi trigger dihitung ulang.
    let t = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={root} className="relative min-h-screen overflow-x-clip bg-[#f3eee6] text-[#1d1517]" style={{ backgroundImage: PLUS_INK }}>
      <TopBar apk={apk} version={version} />

      {/* ───── Hero: panel merah seperti kartu live notice ───── */}
      <section data-hero className="relative mx-auto max-w-6xl px-4 pt-24 md:px-8 md:pt-28">
        <Swoosh className="-right-40 -top-10 w-[56rem] text-[#e1243a]/[0.13]" />
        <div data-panel className="relative isolate overflow-hidden rounded-[28px] bg-[#e1243a] text-[#fff7ec]" style={{ backgroundImage: PLUS_WHITE }}>
          <Swoosh className="-bottom-40 -left-32 w-[54rem] text-white/[0.12]" />
          <div className="grid items-center gap-10 p-6 sm:p-9 md:grid-cols-[1.25fr_0.75fr] md:p-12">
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span data-hero-badge className="inline-flex items-center gap-2.5 rounded-lg border border-white/55 px-3.5 py-2 font-mono text-[12px] uppercase tracking-[0.14em]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f7c548]" /> Aplikasi Android <span aria-hidden>↗</span>
                </span>
                <span data-hero-badge className="flex items-center gap-2.5 font-mono text-[11px] uppercase leading-tight tracking-[0.12em] text-white/85">
                  <Equalizer />
                  Satu aplikasi.
                  <br />
                  Semua oshi.
                </span>
              </div>
              <h1 className="mt-10 md:mt-14">
                <Big text="Oshi live" className="text-[clamp(4rem,10vw,8.4rem)]" />
              </h1>
              <p data-hero-sub className="mt-4 text-[clamp(1.6rem,3.4vw,2.6rem)] font-medium leading-tight tracking-[-0.035em]">Kamu tahu duluan.</p>
              <p data-hero-sub className="mt-4 font-mono text-[12px] uppercase tracking-[0.14em] text-white/80">Notifikasi ±15 detik / IDN &amp; Showroom</p>
              <Mascot className="absolute -bottom-6 right-0 hidden lg:block" caption="< your oshi is online >" />
            </div>
            <div className="mx-auto w-full max-w-[250px] md:mr-2">
              <Polaroid src="/apps/home.webp" alt="Beranda aplikasi JKT48Connect" caption="App preview" n="01" rotate={3} data-polaroid-hero />
            </div>
          </div>
        </div>

        {/* Baris info di bawah panel (seperti baris "judul live / mulai pukul" di kartu brand). */}
        <div data-hero-row className="grid gap-6 border-b border-[#1d1517] py-7 md:grid-cols-[1fr_auto_1fr_auto] md:items-center md:gap-10">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#1d1517] text-[#fff7ec] shadow-[0_6px_16px_rgb(29_21_23/0.25)]">
              <span className="text-center leading-none">
                <b className="block text-[17px] tracking-[-0.04em]">APK</b>
                <span className="font-mono text-[7px] tracking-[0.2em]">ANDROID</span>
              </span>
            </span>
            <div>
              <p className="micro text-[#1d1517]/60">Versi terbaru</p>
              <p className="text-[clamp(1.8rem,3vw,2.4rem)] font-extrabold leading-none tracking-[-0.045em]">{version ?? "…"}</p>
            </div>
          </div>
          <span aria-hidden className="hidden h-12 w-px bg-[#1d1517]/25 md:block" />
          <div className="flex items-end gap-4">
            <div>
              <p className="micro text-[#1d1517]/60">Ukuran</p>
              <p className="text-[clamp(1.8rem,3vw,2.4rem)] font-extrabold leading-none tracking-[-0.045em]">{size}</p>
            </div>
            <p className="pb-1 font-mono text-[11px] uppercase leading-tight tracking-[0.12em] text-[#1d1517]/70">
              Android 8+
              <br />
              Gratis
            </p>
          </div>
          <div>
            <a href={apk} className="group inline-flex items-center gap-3 text-[clamp(1.8rem,3.2vw,2.5rem)] font-extrabold leading-none tracking-[-0.045em]">
              Unduh APK <Arrow className="h-[0.8em] w-[0.8em] text-[#e1243a] transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
            </a>
            <p className="micro mt-2 text-[#1d1517]/60">Langsung dari GitHub Releases</p>
          </div>
        </div>
      </section>

      {/* ───── Live notice: kartu notifikasi asli dari live yang sedang berlangsung ───── */}
      <section className="relative mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <Swoosh className="-left-60 top-10 w-[50rem] text-[#e1243a]/[0.1]" />
        <SectionHead label="JKT48 / Live notice" tag={live.data ? pad2(liveList.length) : "—"} />
        <div className="grid items-center gap-12 pt-10 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Big text="Kartu live" className="text-[clamp(3.2rem,7vw,5.6rem)]" />
            <p data-in className="mt-5 max-w-sm text-[17px] leading-relaxed text-[#1d1517]/75">
              Setiap kali member mulai live, notifikasinya datang dengan kartu seperti ini: nama, foto, judul live, dan jam mulai.
            </p>
            <p data-in className="micro mt-5 text-[#1d1517]/60">
              {cards.length ? "Kartu di samping asli, dari live yang sedang berlangsung." : "Belum ada yang live sekarang."}
            </p>
          </div>
          <div data-in>{cards.length ? <CardStack cards={cards.map((c) => ({ id: c.id, src: c.banner, alt: `Kartu live ${c.name}` }))} /> : <Polaroid src="/apps/home.webp" alt="Beranda aplikasi" caption="Live sekarang" n="00" rotate={-2} className="mx-auto max-w-[260px]" />}</div>
        </div>
      </section>

      {/* ───── Fitur: kartu-kartu bergaya banner ───── */}
      <section id="fitur" className="relative mx-auto max-w-6xl px-4 pb-20 md:px-8 md:pb-28">
        <SectionHead label="JKT48Connect / Isi aplikasi" tag={pad2(FEATURES.length)} />
        <div className="grid gap-5 pt-10 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <article
              key={f.word}
              data-in
              className={`relative isolate flex min-h-[340px] flex-col overflow-hidden rounded-[24px] sm:flex-row ${f.red ? "bg-[#e1243a] text-[#fff7ec]" : "border border-[#1d1517]/12 bg-[#fbf7f0]"}`}
              style={{ backgroundImage: f.red ? PLUS_WHITE : PLUS_INK }}
            >
              <div className="relative z-10 flex flex-1 flex-col p-6 sm:p-7">
                <div className={`flex items-center justify-between border-b pb-3 ${f.red ? "border-white/40" : "border-[#1d1517]"}`}>
                  <span className="micro">Fitur / {pad2(i + 1)}</span>
                  <span className={`rounded px-2 py-0.5 font-mono text-[11px] ${f.red ? "bg-white/15" : "bg-[#1d1517]/[0.06]"}`}>{f.meta}</span>
                </div>
                <Big text={f.word} className="mt-auto pt-10 text-[clamp(2.6rem,4.4vw,3.6rem)]" />
                <p className={`mt-3 max-w-[15rem] text-[16px] leading-snug ${f.red ? "text-white/85" : "text-[#1d1517]/70"}`}>{f.line}</p>
              </div>
              <div className="relative h-64 w-full shrink-0 sm:h-auto sm:w-[44%]">
                <div data-polaroid className="absolute -bottom-28 right-6 w-[150px] sm:-bottom-24 sm:right-5 sm:w-[200px]">
                  <Polaroid src={f.src} alt={`Layar ${f.word}`} caption={f.word} n={pad2(i + 1)} rotate={i % 2 ? -4 : 4} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ───── Hari ini: baris data seperti bagian bawah kartu brand ───── */}
      <section id="hari-ini" className="relative mx-auto max-w-6xl px-4 pb-20 md:px-8 md:pb-28">
        <SectionHead label="JKT48 / Hari ini" tag="Live data" />
        <div className="grid md:grid-cols-3 md:divide-x md:divide-[#1d1517]/20">
          <Stat label="Sedang live">
            <p className="text-[clamp(3rem,6vw,4.6rem)] font-extrabold leading-none tracking-[-0.05em]">{live.data ? pad2(liveList.length) : "…"}</p>
            {liveList.length > 0 && (
              <div className="mt-3 flex -space-x-2">
                {liveList.slice(0, 6).map((l) => (
                  <img key={l.id} src={l.img || l.avatar} alt={l.name} title={l.name} loading="lazy" className="h-9 w-9 rounded-full border-2 border-[#f3eee6] object-cover object-top" />
                ))}
              </div>
            )}
          </Stat>
          <Stat label="Show berikutnya">
            {show ? (
              <>
                <p className="flex items-baseline gap-2">
                  <span className="text-[clamp(3rem,6vw,4.6rem)] font-extrabold leading-none tracking-[-0.05em]">{wib(show.date, { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-mono text-[12px] font-semibold">WIB</span>
                </p>
                <p className="mt-2 text-[17px] font-bold tracking-[-0.02em]">{show.title}</p>
                <p className="micro mt-1 text-[#1d1517]/60">
                  {wib(show.date, { weekday: "long", day: "numeric", month: "long" })} · <Countdown target={show.date} className="text-[#e1243a]" />
                </p>
              </>
            ) : (
              <p className="text-[15px] text-[#1d1517]/60">{next.data ? "Belum ada jadwal baru." : "Memuat…"}</p>
            )}
          </Stat>
          <Stat label="Ulang tahun terdekat">
            {bday ? (
              <div className="flex items-center gap-4">
                <img src={bday.img} alt="" loading="lazy" className="h-16 w-16 rounded-2xl object-cover object-top" />
                <div>
                  <p className="text-[clamp(2rem,3.6vw,2.8rem)] font-extrabold leading-none tracking-[-0.05em]">{bday.name.split(" ")[0]}</p>
                  <p className="micro mt-2 text-[#1d1517]/60">
                    {bday.next.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} / ke-{bday.age}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[15px] text-[#1d1517]/60">Memuat…</p>
            )}
          </Stat>
        </div>
        <div className="h-px bg-[#1d1517]" />
      </section>

      {/* ───── Unduh ───── */}
      <section id="unduh" className="relative mx-auto max-w-6xl px-4 pb-20 md:px-8 md:pb-28">
        <Swoosh className="-right-48 -top-24 w-[52rem] text-[#e1243a]/[0.12]" />
        <div data-in className="relative isolate overflow-hidden rounded-[28px] bg-[#e1243a] text-[#fff7ec]" style={{ backgroundImage: PLUS_WHITE }}>
          <div className="grid gap-10 p-6 sm:p-9 md:grid-cols-[1.3fr_0.7fr] md:p-12">
            <div>
              <div className="flex items-center justify-between border-b border-white/40 pb-3">
                <span className="micro">JKT48Connect / Unduh</span>
                <span className="rounded bg-white/15 px-2 py-0.5 font-mono text-[11px]">v{version ?? "—"}</span>
              </div>
              <Big text="Unduh" className="mt-10 text-[clamp(4rem,11vw,8.5rem)]" />
              <p className="mt-3 text-[clamp(1.4rem,2.8vw,2.1rem)] font-medium leading-tight tracking-[-0.035em]">{summary ? `${summary[0].toUpperCase()}${summary.slice(1)}.` : "Gratis, tanpa akun, tanpa iklan."}</p>
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                {[
                  ["Versi", version ?? "—"],
                  ["Ukuran", size],
                  ["Rilis", fmtDate(release.data?.publishedAt)],
                  ["Android", "8+"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="micro text-white/70">{k}</dt>
                    <dd className="mt-1 text-[22px] font-extrabold tracking-[-0.04em]">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a href={apk} className="inline-flex items-center gap-2.5 rounded-xl bg-[#fff7ec] px-6 py-4 text-[17px] font-extrabold tracking-[-0.02em] text-[#e1243a] shadow-[0_10px_24px_rgb(120_10_25/0.35)] transition-transform hover:-translate-y-0.5 active:scale-95">
                  Unduh APK <Arrow className="h-5 w-5" />
                </a>
                <a href={IOS_IPA} className="inline-flex items-center gap-2.5 rounded-xl border-2 border-[#fff7ec]/70 px-5 py-[14px] text-[17px] font-extrabold tracking-[-0.02em] text-[#fff7ec] transition-transform hover:-translate-y-0.5 active:scale-95">
                  iPhone (.ipa) <Arrow className="h-5 w-5" />
                </a>
                <a href={IOS_GUIDE} target="_blank" rel="noopener noreferrer" className="micro underline decoration-white/40 underline-offset-4 hover:decoration-white">
                  Cara pasang di iPhone ↗
                </a>
                {release.data?.page && (
                  <a href={release.data.page} target="_blank" rel="noopener noreferrer" className="micro underline decoration-white/40 underline-offset-4 hover:decoration-white">
                    Catatan rilis ↗
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col justify-between gap-8">
              <Mascot caption="< siap dipasang >" className="self-center md:self-end" />
              <p className="font-mono text-[12px] leading-relaxed text-white/80">
                Pertama kali pasang APK? Buka file yang terunduh, izinkan pemasangan dari browser atau file manager bila diminta, lalu ketuk Pasang. Versi berikutnya muncul sendiri di aplikasi dan terpasang di atas versi lama.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Ulasan + FAQ ───── */}
      <section id="faq" className="relative mx-auto max-w-6xl px-4 pb-20 md:px-8 md:pb-28">
        <SectionHead label="JKT48Connect / Tanya jawab" tag={pad2(FAQ.length)} />
        <div className="grid gap-14 pt-10 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Big text="Ulasan" className="text-[clamp(3rem,6vw,4.6rem)]" />
            <p data-in className="mt-4 max-w-sm text-[16px] leading-relaxed text-[#1d1517]/70">
              Ceritakan pengalamanmu di X dengan tagar <b className="text-[#1d1517]">#JKT48ConnectApp</b>. Masukan seperti itu yang menentukan isi versi berikutnya.
            </p>
            <ul data-in className="mt-6 space-y-3 text-[16px] font-bold tracking-[-0.02em]">
              <li><ExtLink href={REVIEW_INTENT}>Tulis ulasan di X</ExtLink></li>
              <li><ExtLink href={REVIEW_SEARCH}>Baca ulasan fans lain</ExtLink></li>
              <li><ExtLink href={GITHUB_STAR}>Beri bintang di GitHub</ExtLink></li>
            </ul>
          </div>
          <div data-in className="border-b border-[#1d1517]">
            {FAQ.map((f, i) => (
              <FaqItem key={f.q} n={pad2(i + 1)} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1d1517] py-7">
          <Wordmark small />
          <p className="micro text-[#1d1517]/60">Fan-made / tidak berafiliasi dengan JKT48 Operation Team</p>
          <Link to="/" className="micro underline decoration-[#1d1517]/30 underline-offset-4 hover:decoration-[#1d1517]">Buka versi web ↗</Link>
        </div>
      </footer>
    </div>
  );
}

/** Bilah atas seperti kepala kartu brand: wordmark, label mono, tag versi, garis hitam tipis. */
function TopBar({ apk, version }: { apk: string; version?: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[#f3eee6]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 border-b border-[#1d1517] px-4 md:px-8">
        <Link to="/" aria-label="JKT48Connect" className="mr-auto">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-5 font-mono text-[11px] uppercase tracking-[0.14em] md:flex">
          <a href="#fitur" className="opacity-70 hover:opacity-100">Fitur</a>
          <a href="#unduh" className="opacity-70 hover:opacity-100">Unduh</a>
          <a href="#faq" className="opacity-70 hover:opacity-100">FAQ</a>
        </nav>
        <span className="hidden rounded bg-[#1d1517]/[0.06] px-2 py-0.5 font-mono text-[11px] sm:inline">{version ? `v${version}` : "—"}</span>
        <a href={apk} className="inline-flex items-center gap-2 rounded-lg bg-[#e1243a] px-4 py-2.5 text-[14px] font-extrabold tracking-[-0.01em] text-white transition-transform active:scale-95">
          Unduh <Arrow className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
}

function Wordmark({ small }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 font-extrabold tracking-[-0.055em] ${small ? "text-[20px]" : "text-[24px]"}`}>
      JKT48Connect
      <svg data-asterisk viewBox="0 0 24 24" aria-hidden className={`${small ? "h-5 w-5" : "h-6 w-6"} text-[#e1243a]`}>
        <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Kepala bagian: label mono + tag, dengan garis hitam tipis. */
function SectionHead({ label, tag }: { label: string; tag: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#1d1517] pb-3">
      <span className="micro">{label}</span>
      <span className="rounded bg-[#1d1517]/[0.06] px-2 py-0.5 font-mono text-[11px]">{tag}</span>
    </div>
  );
}

/** Judul tebal rapat per huruf (untuk animasi) dengan titik kotak kuning, seperti nama member di kartu brand. */
function Big({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <span data-big aria-label={`${text}.`} className={`block font-extrabold leading-[0.84] tracking-[-0.06em] ${className}`}>
      {words.map((w, wi) => (
        // Satu kata tidak boleh terpotong; baris hanya boleh pindah di antara kata.
        <span key={wi} aria-hidden className={`inline-block whitespace-nowrap ${wi < words.length - 1 ? "mr-[0.2em]" : ""}`}>
          <span className="inline-block overflow-hidden pb-[0.06em] align-bottom">
            {[...w].map((c, i) => (
              <span key={i} data-char className="inline-block">
                {c}
              </span>
            ))}
          </span>
          {wi === words.length - 1 && <span data-dot className="ml-[0.03em] inline-block h-[0.16em] w-[0.16em] bg-[#f7c548]" />}
        </span>
      ))}
    </span>
  );
}

/** Foto polaroid miring dengan keterangan mono, seperti foto member di kartu live. */
function Polaroid({ src, alt, caption, n, rotate = 0, className = "", ...rest }: { src: string; alt: string; caption: string; n: string; rotate?: number; className?: string; "data-polaroid-hero"?: boolean }) {
  return (
    <figure {...rest} className={`rounded-[14px] rounded-tr-[40px] bg-[#fffaf2] p-2.5 pb-0 text-[#1d1517] shadow-[0_18px_40px_rgb(29_21_23/0.28)] ${className}`} style={{ rotate: `${rotate}deg` }}>
      <img src={src} alt={alt} width={540} height={1170} loading="lazy" className="block aspect-[540/1170] w-full rounded-[8px] rounded-tr-[32px] object-cover object-top" />
      <figcaption className="flex items-center justify-between px-1 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em]">
        <span>{caption}</span>
        <b className="text-[12px] tracking-normal">{n}</b>
      </figcaption>
    </figure>
  );
}

/** Tumpukan kartu live asli yang bergantian setiap beberapa detik. */
function CardStack({ cards }: { cards: { id: string; src: string; alt: string }[] }) {
  const [top, setTop] = useState(0);
  useEffect(() => {
    if (cards.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setTop((t) => (t + 1) % cards.length);
    }, 3200);
    return () => clearInterval(id);
  }, [cards.length]);
  return (
    <div className="relative mx-auto aspect-[16/9] w-full max-w-[640px]">
      {cards.map((c, i) => {
        const d = (i - top + cards.length) % cards.length;
        return (
          <img
            key={c.id}
            src={c.src}
            alt={d === 0 ? c.alt : ""}
            loading="lazy"
            className="absolute inset-0 h-full w-full rounded-[18px] object-cover shadow-[0_20px_50px_rgb(29_21_23/0.22)] transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{
              zIndex: cards.length - d,
              transform: `translate(${d * 14}px, ${d * -16}px) rotate(${d === 0 ? -1.5 : d * 2}deg) scale(${1 - d * 0.05})`,
              opacity: d > 2 ? 0 : 1 - d * 0.18,
            }}
          />
        );
      })}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div data-in className="border-b border-[#1d1517]/15 py-8 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0">
      <p className="micro mb-4 text-[#1d1517]/60">{label}</p>
      {children}
    </div>
  );
}

/** Maskot ASCII "ON AIR!" dari kartu live brand; matanya berkedip sesekali. */
function Mascot({ caption, className = "" }: { caption: string; className?: string }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let off = 0;
    const id = window.setInterval(() => {
      setBlink(true);
      off = window.setTimeout(() => setBlink(false), 160);
    }, 3600);
    return () => {
      clearInterval(id);
      clearTimeout(off);
    };
  }, []);
  const eye = blink ? "-" : "o";
  const art = [
    "    (( • ))",
    "    /\\___/\\",
    ` __( ${eye}   ${eye} )__`,
    "/   >  ^  <   \\",
    "|  ┆ON AIR!┆   |",
    "\\_____________/",
    "  (__)   (__)",
  ].join("\n");
  return (
    <figure data-mascot aria-hidden className={`select-none font-mono text-[#fff7ec] ${className}`}>
      <pre className="text-[12px] leading-[1.25]">{art}</pre>
      <figcaption className="mt-1 text-[10px] tracking-wide text-white/80">{caption}</figcaption>
    </figure>
  );
}

/** Ikon equalizer kuning yang bergerak (CSS, ringan). */
function Equalizer() {
  return (
    <span aria-hidden className="flex h-6 items-center gap-[3px]">
      {[0.5, 0.9, 0.6, 1, 0.7].map((h, i) => (
        <span key={i} className="eq-bar w-[3px] rounded-full bg-[#f7c548]" style={{ height: `${h * 100}%`, animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

/** Garis lengkung pink di latar, seperti pita lengkung pada kartu brand. */
function Swoosh({ className = "" }: { className?: string }) {
  return (
    <svg data-swoosh aria-hidden viewBox="0 0 800 400" fill="none" className={`pointer-events-none absolute -z-10 ${className}`}>
      <path d="M40 300C120 120 520 40 700 120c120 54 40 200-160 230-220 34-440-30-480-120" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
      <path d="M120 360C300 330 640 260 760 160" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M6 18L18 6M8 6h10v10" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="square" />
    </svg>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 underline decoration-[#1d1517]/25 underline-offset-4 hover:decoration-[#e1243a]">
      {children} <Arrow className="h-4 w-4 text-[#e1243a] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  );
}

function FaqItem({ n, q: question, a }: { n: string; q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    gsap.to(el, { height: open ? "auto" : 0, opacity: open ? 1 : 0, duration: 0.45, ease: open ? "power3.out" : "power2.inOut" });
  }, [open]);
  return (
    <div className="border-t border-[#1d1517]/20 first:border-[#1d1517]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-4 py-5 text-left">
        <span className="font-mono text-[12px] text-[#e1243a]">{n}</span>
        <span className="flex-1 text-[18px] font-bold tracking-[-0.025em]">{question}</span>
        <span aria-hidden className={`font-mono text-[20px] transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div ref={body} className="h-0 overflow-hidden opacity-0">
        <p className="max-w-xl pb-6 pl-9 text-[15px] leading-relaxed text-[#1d1517]/70">{a}</p>
      </div>
    </div>
  );
}
