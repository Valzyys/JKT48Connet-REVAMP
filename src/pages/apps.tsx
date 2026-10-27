import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpRight, Moon, Sun } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PixelCross } from "@/components/logo";
import { Countdown } from "@/components/countdown";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useTheme } from "@/hooks/use-theme";
import { timeAgo } from "@/lib/format";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { getAppRelease, type AppRelease } from "@/lib/jkt48";
import { q } from "@/lib/queries";
import { STATIC_PAGES } from "@/lib/seo";

/*
 * Landing page aplikasi dengan konsep "malam di theater": hero sebagai panggung dengan lampu sorot & penlight,
 * show berikutnya sebagai tiket, fitur sebagai setlist (M01…), data hari ini sebagai sesi MC, dan unduhan
 * sebagai encore. Semua animasi hanya transform/opacity supaya ringan.
 */

/** APK selalu bernama sama di setiap rilis, jadi tautan "latest" GitHub selalu menuju versi terbaru. */
const LATEST_APK = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/latest/download/jkt48connect.apk";
const RELEASES = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases";
const GITHUB_STAR = "https://github.com/JKT48Connect/JKT48Connect-APP";
const REVIEW_INTENT = `https://x.com/intent/post?text=${encodeURIComponent("Pakai aplikasi JKT48Connect buat pantau live, jadwal theater & recent member JKT48. Menurutku: ")}&url=${encodeURIComponent("https://jkt48connect.app/apps")}&hashtags=JKT48ConnectApp`;
const REVIEW_SEARCH = "https://x.com/search?q=%23JKT48ConnectApp&f=live";
const HEADLINE = "Tahu duluan kalau oshi mulai live.";

const SETLIST = [
  { src: "/apps/home.webp", title: "Notif live, ±15 detik", text: "Begitu member mulai live di IDN atau Showroom, notifikasi masuk kira-kira 15 detik kemudian, walau aplikasinya sedang ditutup.", meta: "IDN Live · Showroom · notifikasi" },
  { src: "/apps/recent.webp", title: "Recent & replay", text: "Live yang sudah selesai lengkap dengan durasi, jumlah penonton, gift, top supporter, dan replay yang bisa diputar ulang.", meta: "durasi · penonton · gift · replay" },
  { src: "/apps/sosmed.webp", title: "Sosmed member", text: "Posting X, TikTok, dan Instagram member dalam satu tempat. Foto dan videonya bisa langsung diunduh ke HP.", meta: "X · TikTok · Instagram · unduh" },
  { src: "/apps/video.webp", title: "Video YouTube", text: "Video JKT48 dan JKT48 TV diputar di dalam aplikasi, dengan pilihan kualitas dan kolom komentar.", meta: "JKT48 · JKT48 TV · komentar" },
  { src: "/apps/member.webp", title: "Member & oshi", text: "Direktori member dengan pencarian. Tandai oshi, beranda dan notifikasi akan mendahulukan mereka.", meta: "pencarian · favorit" },
  { src: "/apps/home-dark.webp", title: "Tema gelap", text: "Ikut tema sistem, atau pilih terang / gelap sendiri. Nyaman dipakai nonton live tengah malam.", meta: "terang · gelap · otomatis" },
];

const FAQ = [
  { q: "Apakah gratis?", a: "Ya, gratis dan tanpa iklan. Kalau mau, kamu bisa mendukung lewat menu Donasi (QRIS) di aplikasi." },
  { q: "Kenapa tidak ada di Play Store?", a: "JKT48Connect proyek fans yang dirilis langsung lewat GitHub Releases. Setiap APK ditandatangani kunci yang sama, jadi update berikutnya bisa langsung dipasang di atas versi lama." },
  { q: "Aman dipasang?", a: "APK dibangun otomatis dari kode sumber di GitHub. Aplikasi tidak meminta akun, kontak, atau lokasi. Izin yang dipakai: internet, notifikasi, dan memasang update." },
  { q: "Butuh Android versi berapa?", a: "Android 8.0 (Oreo) ke atas." },
  { q: "Ada untuk iPhone?", a: "Belum. Pengguna iPhone bisa memakai situs jkt48connect.app yang isinya sama." },
  { q: "Apakah resmi dari JKT48?", a: "Bukan. JKT48Connect dibuat oleh fans dan tidak berafiliasi dengan JKT48 Operation Team." },
];

/** Warna penlight: kebanyakan merah, diselingi putih, pink, dan kuning seperti barisan penonton theater. */
const PEN_COLORS = ["#ff3048", "#ff3048", "#ffffff", "#ff3048", "#ff7aa2", "#ff3048", "#ffd36b", "#ff3048", "#ffffff", "#ff7aa2"];

const pad2 = (n: number) => String(n).padStart(2, "0");

function fmtSize(bytes?: number) {
  return bytes ? `${(bytes / 1_048_576).toFixed(1).replace(".", ",")} MB` : "±2,5 MB";
}

function fmtDate(iso?: string) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

const wib = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("id-ID", { ...opts, timeZone: "Asia/Jakarta" });

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
  const { dark, toggle } = useTheme();
  const release = useQuery({ queryKey: ["app-release"], queryFn: getAppRelease, staleTime: 10 * 60_000, retry: 1 });
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const birthdays = useQuery(q.birthdays());
  const [song, setSong] = useState(0);
  const apk = release.data?.apk || LATEST_APK;
  const version = release.data?.version;
  const size = fmtSize(release.data?.size);
  const summary = releaseSummary(release.data);
  const liveList = live.data ?? [];
  const show = next.data?.find((s) => s.category === "show") ?? next.data?.[0];

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      // Lagu aktif di setlist (menentukan layar di ponsel yang menempel). Tetap jalan walau animasi dimatikan.
      gsap.utils.toArray<HTMLElement>("[data-song]").forEach((li, i) => {
        ScrollTrigger.create({ trigger: li, start: "top 60%", end: "bottom 60%", onToggle: (self) => self.isActive && setSong(i) });
      });

      if (reduce) {
        gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((box) => {
          gsap.from(box.children, { opacity: 0, duration: 0.6, stagger: 0.05, scrollTrigger: { trigger: box, start: "top 92%", once: true } });
        });
        return;
      }

      // ── Panggung: lampu sorot menyala, judul naik per kata, ponsel & tiket masuk, stempel "LIVE" dicap, penlight naik.
      gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .from("[data-beam]", { opacity: 0, rotate: (i) => (i ? 30 : -30), duration: 1.6, ease: "power2.out" }, 0)
        .from("[data-word]", { yPercent: 115, rotate: 6, duration: 1.1, stagger: 0.06 }, 0.15)
        .from("[data-hero-in]", { y: 28, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.5)
        .from("[data-phone]", { y: 140, rotate: 10, opacity: 0, duration: 1.4, ease: "expo.out" }, 0.3)
        .from("[data-ticket]", { x: -120, y: 40, rotate: -18, opacity: 0, duration: 1.2, ease: "back.out(1.4)" }, 0.8)
        .from("[data-stamp]", { scale: 2.6, rotate: 30, opacity: 0, duration: 0.5, ease: "back.out(3)" }, 1.6)
        .from("[data-pen]", { yPercent: 120, duration: 1, stagger: { each: 0.02, from: "center" }, ease: "back.out(1.6)" }, 0.6);

      // Lampu sorot bergoyang pelan; penlight melambai bergelombang seperti penonton (berhenti saat panggung tak terlihat).
      gsap.to("[data-beam]", { rotate: (i) => (i ? -8 : 8), duration: 5, repeat: -1, yoyo: true, ease: "sine.inOut" });
      const wave = gsap.timeline({ delay: 1.4 });
      gsap.utils.toArray<HTMLElement>("[data-pen-row]").forEach((row, r) => {
        const pens = row.querySelectorAll("[data-pen]");
        gsap.set(pens, { rotate: -14 });
        wave.to(pens, { rotate: 14, duration: r ? 1.05 : 0.9, ease: "sine.inOut", stagger: { each: 0.07, repeat: -1, yoyo: true } }, r * 0.3);
      });
      ScrollTrigger.create({ trigger: "[data-hero]", start: "top bottom", end: "bottom top", onToggle: (self) => (self.isActive ? wave.resume() : wave.pause()) });

      // Gulir keluar panggung: ponsel naik, tiket tertinggal, teks memudar.
      const leave = { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true };
      gsap.to("[data-phone]", { yPercent: -14, rotate: -2, ease: "none", scrollTrigger: leave });
      gsap.to("[data-ticket]", { yPercent: 30, rotate: -10, ease: "none", scrollTrigger: leave });
      gsap.to("[data-hero-copy]", { y: -70, opacity: 0.2, ease: "none", scrollTrigger: leave });

      // ── Judul bagian & kelompok isi muncul saat digulir.
      gsap.utils.toArray<HTMLElement>("[data-title]").forEach((t) => {
        gsap.from(t, { yPercent: 40, opacity: 0, duration: 1, ease: "power4.out", scrollTrigger: { trigger: t, start: "top 90%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((box) => {
        gsap.from(box.children, { y: 36, opacity: 0, duration: 0.85, stagger: 0.08, ease: "power3.out", clearProps: "transform,opacity", scrollTrigger: { trigger: box, start: "top 88%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-rule]").forEach((r) => {
        gsap.from(r, { scaleX: 0, transformOrigin: "left", duration: 1.2, ease: "power3.inOut", scrollTrigger: { trigger: r, start: "top 92%", once: true } });
      });

      // ── Encore: tiket besar masuk, lalu potongan tiketnya "disobek" mengikuti gulir.
      gsap.from("[data-big-ticket]", { y: 100, rotate: -4, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: "#unduh", start: "top 70%", once: true } });
      gsap.to("[data-stub]", { rotate: 9, x: 26, y: 18, ease: "none", scrollTrigger: { trigger: "[data-big-ticket]", start: "top 60%", end: "bottom 20%", scrub: 0.6 } });
    }, el);

    // Tinggi halaman berubah saat data & gambar selesai dimuat → posisi semua trigger dihitung ulang.
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
    <div ref={root} className="relative min-h-screen overflow-x-clip bg-bg text-ink">
      <TopBar apk={apk} dark={dark} onTheme={toggle} />

      {/* ───── Panggung ───── */}
      <section data-hero data-dark className="relative isolate overflow-hidden bg-[#120a0c] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div data-beam className="absolute -top-24 left-[12%] h-[120%] w-[30rem] origin-top bg-[linear-gradient(180deg,rgb(255_236_222/0.22),transparent_70%)] [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]" />
          <div data-beam className="absolute -top-24 right-[6%] h-[120%] w-[30rem] origin-top bg-[linear-gradient(180deg,rgb(255_122_162/0.2),transparent_70%)] [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_at_50%_100%,rgb(225_36_58/0.42),transparent_62%)]" />
        </div>

        <div className="mx-auto grid min-h-[100svh] w-full max-w-6xl items-center gap-12 px-5 pb-56 pt-28 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:pb-48">
          <div data-hero-copy>
            <p data-hero-in className="micro text-white/60">JKT48Connect · Android{version ? ` · v${version}` : ""}</p>
            <h1 aria-label={HEADLINE} className="condensed mt-5 text-[clamp(3rem,7.2vw,5.8rem)] leading-[0.9]">
              {HEADLINE.split(" ").map((w, i) => (
                <span key={i} aria-hidden className="mr-[0.2em] inline-block overflow-hidden pb-[0.05em] align-bottom">
                  <span data-word className={`inline-block ${w === "live." ? "text-[#ff4a5f]" : ""}`}>{w}</span>
                </span>
              ))}
            </h1>
            <p data-hero-in className="mt-6 max-w-[33rem] text-[17px] leading-relaxed text-white/75">
              Notifikasi masuk kira-kira 15 detik setelah live IDN atau Showroom dimulai, walau aplikasinya ditutup. Jadwal theater, recent dan replay, YouTube, sampai posting sosmed member, semuanya di satu aplikasi.
            </p>
            <div data-hero-in className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <a href={apk} className="inline-flex items-center gap-2.5 rounded-full bg-brand px-7 py-4 text-[16px] font-extrabold text-white shadow-[0_10px_30px_rgb(225_36_58/0.45)] transition-transform hover:-translate-y-0.5 active:scale-95">
                <ArrowDownToLine className="h-5 w-5" /> Unduh APK <span className="font-mono text-[12px] font-medium text-white/75">{size}</span>
              </a>
              <a href={RELEASES} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[15px] font-semibold text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white">
                Semua rilis <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <p data-hero-in className="micro mt-8 text-white/45">Gratis · tanpa akun · tanpa iklan · Android 8+</p>
          </div>

          <div className="relative mx-auto w-full max-w-[280px] md:mr-6">
            <Phone src="/apps/home.webp" alt="Beranda aplikasi JKT48Connect" data-phone />
            {show && (
              <div data-ticket className="absolute -bottom-10 -left-28 hidden w-[300px] sm:block">
                <ShowTicket title={show.title} date={show.date} live={liveList.length} />
              </div>
            )}
          </div>
        </div>

        <Penlights />
      </section>

      {/* ───── Setlist: layar di ponsel berganti mengikuti lagu yang sedang dibaca ───── */}
      <section id="setlist" className="mx-auto max-w-6xl px-5 pb-12 pt-24 md:px-8 md:pt-32">
        <header className="flex flex-wrap items-end justify-between gap-3 pb-4">
          <h2 data-title className="condensed text-[clamp(3rem,8vw,6.5rem)] uppercase leading-[0.85]">Setlist</h2>
          <p className="micro pb-2 text-ink-soft">JKT48Connect{version ? ` v${version}` : ""} · {SETLIST.length} lagu</p>
        </header>
        <div data-rule className="h-[3px] bg-ink" />
        <div className="grid gap-16 md:grid-cols-[1fr_300px]">
          <ol>
            {SETLIST.map((s, i) => (
              <li
                key={s.src}
                data-song
                className={`border-b border-line py-12 transition-opacity duration-500 md:flex md:min-h-[64vh] md:flex-col md:justify-center ${song === i ? "" : "md:opacity-30"}`}
              >
                <p className="font-mono text-[14px] font-semibold text-brand">M{pad2(i + 1)}</p>
                <h3 className="condensed mt-2 text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[0.92]">{s.title}</h3>
                <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-soft">{s.text}</p>
                <p className="micro mt-5 text-ink-soft">{s.meta}</p>
                <div className="mt-8 w-[210px] md:hidden">
                  <Phone src={s.src} alt={`Layar ${s.title}`} small />
                </div>
              </li>
            ))}
          </ol>
          <div className="hidden md:block">
            <div className="sticky top-[14vh] pt-12">
              <div className="relative transition-transform duration-700 ease-out" style={{ transform: `rotate(${song % 2 ? 2.5 : -2.5}deg)` }}>
                <div className="relative rounded-[2.6rem] bg-[#0d0709] p-2.5 shadow-[0_30px_70px_rgb(29_21_23/0.35)]">
                  <div className="absolute left-1/2 top-4 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
                  <div className="relative aspect-[540/1170] overflow-hidden rounded-[2.1rem]">
                    {SETLIST.map((s, i) => (
                      <img
                        key={s.src}
                        src={s.src}
                        alt={i === song ? `Layar ${s.title}` : ""}
                        loading="lazy"
                        className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ease-out ${i === song ? "translate-y-0 scale-100 opacity-100" : i < song ? "-translate-y-6 scale-95 opacity-0" : "translate-y-6 scale-95 opacity-0"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3 font-mono text-[13px]">
                <span className="font-semibold text-brand">M{pad2(song + 1)}</span>
                <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-full origin-left bg-brand transition-transform duration-500" style={{ transform: `scaleX(${(song + 1) / SETLIST.length})` }} />
                </span>
                <span className="text-ink-soft">{pad2(SETLIST.length)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── MC: data hari ini, sama seperti yang muncul di aplikasi ───── */}
      <section id="hari-ini" className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
          <h2 data-title className="condensed text-[clamp(2.4rem,5vw,4rem)] leading-[0.9]">
            <span className="text-brand">MC</span> · hari ini
          </h2>
          <p className="micro pb-1.5 text-ink-soft">data langsung · diperbarui tiap menit</p>
        </div>
        <div data-rule className="h-[3px] bg-ink" />
        <div data-stagger className="grid md:grid-cols-3 md:divide-x md:divide-line">
          <Column label="Sedang live" count={live.data ? liveList.length : undefined}>
            {liveList.length ? (
              <ul className="space-y-4">
                {liveList.slice(0, 5).map((l) => (
                  <li key={l.id} className="flex items-center gap-3">
                    <img src={l.img || l.avatar} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-full object-cover object-top" />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{l.name}</p>
                      <p className="truncate text-[13px] text-ink-soft">{l.platform === "idn" ? "IDN Live" : "Showroom"} · mulai {timeAgo(l.startedAt)}</p>
                    </div>
                    <span className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-brand" />
                  </li>
                ))}
                {liveList.length > 5 && <li className="micro text-ink-soft">+{liveList.length - 5} member lain</li>}
              </ul>
            ) : (
              <p className="text-[15px] leading-relaxed text-ink-soft">{live.data ? "Belum ada yang live. Begitu ada, aplikasi langsung memberi tahu." : "Memuat…"}</p>
            )}
          </Column>
          <Column label="Show berikutnya">
            {show ? (
              <>
                {(show.banner || show.poster) && <img src={show.banner || show.poster} alt="" loading="lazy" className="mb-4 aspect-[16/9] w-full rounded-xl object-cover" />}
                <p className="text-[19px] font-extrabold leading-tight">{show.title}</p>
                <p className="mt-1 text-[14px] text-ink-soft">{wib(show.date, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} WIB</p>
                <Countdown target={show.date} className="mt-3 block font-mono text-[15px] font-semibold text-brand" />
                {show.members.length > 0 && (
                  <div className="mt-4 flex items-center">
                    <div className="flex -space-x-2">
                      {show.members.slice(0, 7).map((m) => (
                        <img key={m.id} src={m.img} alt={m.name} title={m.name} loading="lazy" className="h-8 w-8 rounded-full border-2 border-bg object-cover object-top" />
                      ))}
                    </div>
                    {show.members.length > 7 && <span className="ml-2 text-[13px] text-ink-soft">+{show.members.length - 7}</span>}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[15px] text-ink-soft">{next.data ? "Belum ada jadwal baru." : "Memuat…"}</p>
            )}
          </Column>
          <Column label="Ulang tahun terdekat">
            {birthdays.data?.length ? (
              <ul className="space-y-4">
                {birthdays.data.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-center gap-3">
                    <img src={b.img} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-full object-cover object-top" />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{b.name}</p>
                      <p className="text-[13px] text-ink-soft">{b.next.toLocaleDateString("id-ID", { day: "numeric", month: "long" })} · ke-{b.age}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-ink-soft">Memuat…</p>
            )}
          </Column>
        </div>
      </section>

      {/* ───── Encore: tiket unduh ───── */}
      <section id="unduh" data-dark className="relative isolate overflow-hidden bg-[#120a0c] px-5 py-24 text-white md:py-32">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgb(225_36_58/0.35),transparent_60%)]" />
        <div className="mx-auto max-w-5xl">
          <p className="micro text-[#ff6b7d]">Encore · EN01</p>
          <h2 data-title className="condensed mt-3 max-w-3xl text-[clamp(2.6rem,6vw,4.8rem)] leading-[0.9]">Satu lagu lagi: pasang di HP-mu.</h2>

          <div data-big-ticket className="mt-12 flex flex-col text-ink md:flex-row">
            <div className="relative flex-1 rounded-t-[22px] bg-butter p-7 md:rounded-l-[22px] md:rounded-tr-none md:p-9">
              <p className="micro text-ink/60">Tiket · JKT48Connect untuk Android</p>
              <p className="condensed mt-3 text-[clamp(2.6rem,5vw,3.8rem)] leading-none">{version ? `Versi ${version}` : "Versi terbaru"}</p>
              {summary && <p className="mt-2 text-[16px] text-ink/75">{summary}.</p>}
              <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-dashed border-ink/25 pt-5 sm:grid-cols-4">
                {[
                  ["Ukuran", size],
                  ["Rilis", fmtDate(release.data?.publishedAt)],
                  ["Butuh", "Android 8+"],
                  ["Harga", "Gratis"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="micro text-ink/55">{k}</dt>
                    <dd className="mt-1 font-mono text-[15px] font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a href={apk} className="inline-flex items-center gap-2.5 rounded-full bg-ink px-7 py-4 text-[16px] font-extrabold text-butter transition-transform hover:-translate-y-0.5 active:scale-95">
                  <ArrowDownToLine className="h-5 w-5" /> Unduh APK
                </a>
                {release.data?.page && (
                  <a href={release.data.page} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[15px] font-semibold underline decoration-ink/30 underline-offset-4">
                    Catatan rilis <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
            {/* Garis sobek + potongan tiket. */}
            <div data-stub className="relative flex origin-top-left items-center justify-between gap-4 rounded-b-[22px] border-t-2 border-dashed border-ink/30 bg-butter p-6 md:w-44 md:flex-col md:rounded-r-[22px] md:rounded-bl-none md:border-l-2 md:border-t-0 md:py-9">
              <span aria-hidden className="absolute -left-3 -top-3 hidden h-6 w-6 rounded-full bg-[#120a0c] md:block" />
              <span aria-hidden className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full bg-[#120a0c] md:block" />
              <p className="micro text-ink/60 md:text-center">Admit one</p>
              <div aria-hidden className="h-12 w-40 bg-[repeating-linear-gradient(90deg,#1d1517_0_2px,transparent_2px_4px,#1d1517_4px_5px,transparent_5px_8px,#1d1517_8px_11px,transparent_11px_13px)] md:h-40 md:w-12 md:bg-[repeating-linear-gradient(180deg,#1d1517_0_2px,transparent_2px_4px,#1d1517_4px_5px,transparent_5px_8px,#1d1517_8px_11px,transparent_11px_13px)]" />
              <p className="font-mono text-[13px] font-semibold md:text-center">No. {version ?? "—"}</p>
            </div>
          </div>
          <p className="mt-8 max-w-2xl text-[14px] leading-relaxed text-white/60">
            Pertama kali pasang APK? Buka file yang terunduh, izinkan pemasangan dari browser atau file manager bila diminta, lalu ketuk Pasang. Setelah itu, versi baru muncul sendiri di aplikasi dan terpasang di atas versi lama.
          </p>
        </div>
      </section>

      {/* ───── Ulasan + FAQ ───── */}
      <section id="faq" className="mx-auto grid max-w-6xl gap-16 px-5 py-24 md:grid-cols-[0.8fr_1.2fr] md:px-8 md:py-32">
        <div>
          <h2 data-title className="condensed text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[0.95]">Sudah dipakai?</h2>
          <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-ink-soft">
            Ceritakan pengalamanmu di X dengan tagar <b className="text-ink">#JKT48ConnectApp</b>. Masukan seperti itu yang menentukan isi versi berikutnya.
          </p>
          <ul className="mt-6 space-y-3 text-[15px] font-semibold">
            <li><ExtLink href={REVIEW_INTENT}>Tulis ulasan di X</ExtLink></li>
            <li><ExtLink href={REVIEW_SEARCH}>Baca ulasan fans lain</ExtLink></li>
            <li><ExtLink href={GITHUB_STAR}>Beri bintang di GitHub</ExtLink></li>
          </ul>
        </div>
        <div>
          <h2 data-title className="condensed text-[clamp(1.8rem,3vw,2.4rem)] leading-none">Pertanyaan</h2>
          <div data-stagger className="mt-6 border-b border-line">
            {FAQ.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-ink-soft md:px-8">
          <p>Dibuat oleh fans, tidak berafiliasi dengan JKT48 Operation Team. APK dibangun otomatis dari kode sumber di GitHub.</p>
          <Link to="/" className="font-semibold text-ink underline decoration-line underline-offset-4">Buka versi web</Link>
        </div>
      </footer>
    </div>
  );
}

/** Bilah atas: transparan di atas bagian gelap, kertas krem di bagian terang. */
function TopBar({ apk, dark, onTheme }: { apk: string; dark: boolean; onTheme: () => void }) {
  const [onDark, setOnDark] = useState(true);
  useEffect(() => {
    const on = () => {
      const y = 32;
      setOnDark([...document.querySelectorAll("[data-dark]")].some((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= y && r.bottom >= y;
      }));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${onDark ? "text-white" : "border-b border-line bg-bg text-ink"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-5 md:px-8">
        <Link to="/" className="flex items-center gap-2 pr-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand"><PixelCross className="h-5 w-5" cellClass="fill-white" /></span>
          <span className="condensed text-[20px] uppercase leading-none">JKT48<span className={onDark ? "text-[#ff6b7d]" : "text-brand"}>Connect</span></span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 font-mono text-[12px] uppercase tracking-wider md:flex">
          {[["#setlist", "Setlist"], ["#hari-ini", "MC"], ["#unduh", "Encore"], ["#faq", "FAQ"]].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3 py-2 opacity-70 hover:opacity-100">{label}</a>
          ))}
        </nav>
        <button type="button" onClick={onTheme} aria-label="Ganti tema" className="ml-auto grid h-10 w-10 place-items-center rounded-full opacity-80 hover:opacity-100 md:ml-1">
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <a href={apk} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-[14px] font-extrabold text-white transition-transform active:scale-95">
          <ArrowDownToLine className="h-4 w-4" /> <span>Unduh</span>
        </a>
      </div>
    </header>
  );
}

/** Tiket show berikutnya (data asli) dengan stempel jumlah member yang sedang live. */
function ShowTicket({ title, date, live }: { title: string; date: string; live: number }) {
  return (
    <div className="relative -rotate-6 text-ink drop-shadow-[0_20px_30px_rgb(0_0_0/0.45)]">
      <div className="flex">
        <div className="relative flex-1 rounded-l-[16px] bg-butter p-4 pr-3">
          <p className="micro text-ink/60">JKT48 Theater · show berikutnya</p>
          <p className="mt-1.5 truncate text-[18px] font-extrabold leading-tight">{title}</p>
          <p className="mt-0.5 font-mono text-[12px] text-ink/70">{wib(date, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} WIB</p>
          <Countdown target={date} className="mt-2 block font-mono text-[13px] font-semibold text-brand-strong" />
        </div>
        <div className="relative flex w-16 flex-col items-center justify-center gap-2 rounded-r-[16px] border-l-2 border-dashed border-ink/30 bg-butter">
          <span aria-hidden className="absolute -left-[9px] -top-2 h-4 w-4 rounded-full bg-[#120a0c]" />
          <span aria-hidden className="absolute -bottom-2 -left-[9px] h-4 w-4 rounded-full bg-[#120a0c]" />
          <div aria-hidden className="h-16 w-7 bg-[repeating-linear-gradient(180deg,#1d1517_0_2px,transparent_2px_4px,#1d1517_4px_5px,transparent_5px_7px)]" />
        </div>
      </div>
      {live > 0 && (
        <div data-stamp className="absolute bottom-3 right-[78px] rotate-[-12deg] rounded-md border-[2.5px] border-[#d81f35] px-2 py-0.5 text-center font-mono text-[10px] font-bold uppercase leading-tight tracking-wider text-[#d81f35] opacity-90">
          {live} member
          <br />
          sedang live
        </div>
      )}
    </div>
  );
}

/** Barisan penlight penonton di bawah panggung (dua baris: belakang lebih kecil & redup). */
function Penlights() {
  const rows = [
    { n: 34, h: 92, cls: "bottom-10 opacity-45" },
    { n: 26, h: 130, cls: "-bottom-6" },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-48 overflow-hidden">
      {rows.map((row, r) => (
        <div key={r} data-pen-row className={`absolute inset-x-[-2%] flex justify-between ${row.cls}`}>
          {Array.from({ length: row.n }, (_, i) => {
            const c = PEN_COLORS[(i * 3 + r * 5) % PEN_COLORS.length];
            return (
              <span key={i} data-pen className="relative block w-[10px] origin-bottom will-change-transform" style={{ height: row.h }}>
                <span className="absolute left-1/2 top-0 h-20 w-20 -translate-x-1/2 -translate-y-6 rounded-full" style={{ background: `radial-gradient(circle, ${c}55, transparent 62%)` }} />
                <span className="absolute inset-x-0 top-0 rounded-full" style={{ height: row.h * 0.6, background: `linear-gradient(180deg, #fff, ${c} 35%)`, boxShadow: `0 0 10px ${c}, 0 0 22px ${c}88` }} />
                <span className="absolute inset-x-[1px] bottom-0 rounded-b-[4px] bg-[#2a1d21]" style={{ height: row.h * 0.4 }} />
              </span>
            );
          })}
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#120a0c] to-transparent" />
    </div>
  );
}

/** Bingkai ponsel dengan screenshot asli aplikasi. */
function Phone({ src, alt, small, ...rest }: { src: string; alt: string; small?: boolean; "data-phone"?: boolean }) {
  return (
    <div {...rest} className={`relative rounded-[2.6rem] bg-[#0d0709] p-2.5 shadow-[0_40px_90px_rgb(0_0_0/0.5),inset_0_0_0_1.5px_rgb(255_255_255/0.14)] ${small ? "" : "mx-auto"}`}>
      <div className="absolute left-1/2 top-4 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      <img src={src} alt={alt} width={540} height={1170} loading={small ? "lazy" : "eager"} className="block aspect-[540/1170] w-full rounded-[2.1rem] object-cover" />
    </div>
  );
}

function Column({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <div className="border-b border-line py-8 md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0">
      <p className="micro mb-5 flex items-center justify-between text-ink-soft">
        {label}
        {count !== undefined && <span className="font-mono text-[13px] font-semibold tracking-normal text-brand">{pad2(count)}</span>}
      </p>
      {children}
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-line underline-offset-4 hover:text-brand">
      {children} <ArrowUpRight className="h-4 w-4" />
    </a>
  );
}

function FaqItem({ q: question, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    gsap.to(el, { height: open ? "auto" : 0, opacity: open ? 1 : 0, duration: 0.45, ease: open ? "power3.out" : "power2.inOut" });
  }, [open]);
  return (
    <div className="border-t border-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 py-5 text-left text-[16px] font-bold">
        {question}
        <span aria-hidden className={`font-mono text-[18px] text-ink-soft transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div ref={body} className="h-0 overflow-hidden opacity-0">
        <p className="max-w-xl pb-6 text-[15px] leading-relaxed text-ink-soft">{a}</p>
      </div>
    </div>
  );
}
