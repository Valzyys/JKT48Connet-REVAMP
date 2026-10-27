import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  CalendarClock,
  ChevronDown,
  Download,
  GitBranch,
  History,
  MessageSquareQuote,
  Moon,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Glass } from "@/components/liquid-glass";
import { PixelCross } from "@/components/logo";
import { Countdown } from "@/components/countdown";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useTheme } from "@/hooks/use-theme";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { getAppRelease } from "@/lib/jkt48";
import { q } from "@/lib/queries";
import { STATIC_PAGES } from "@/lib/seo";

/** APK selalu bernama sama di setiap rilis, jadi tautan "latest" GitHub selalu menuju versi terbaru. */
const LATEST_APK = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/latest/download/jkt48connect.apk";
const RELEASES = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases";
const GITHUB_STAR = "https://github.com/JKT48Connect/JKT48Connect-APP";
const REVIEW_INTENT = `https://x.com/intent/post?text=${encodeURIComponent("Pakai aplikasi JKT48Connect buat pantau live, jadwal theater & recent member JKT48. Menurutku: ")}&url=${encodeURIComponent("https://jkt48connect.app/apps")}&hashtags=JKT48ConnectApp`;
const REVIEW_SEARCH = "https://x.com/search?q=%23JKT48ConnectApp&f=live";

const SCREENS = [
  { src: "/apps/home.webp", title: "Beranda", text: "Siapa yang sedang live dan hitung mundur show berikutnya, dalam satu kartu." },
  { src: "/apps/sosmed.webp", title: "Sosmed member", text: "Posting X, TikTok, dan Instagram member, lengkap dengan tombol unduh." },
  { src: "/apps/video.webp", title: "Video YouTube", text: "Video JKT48 & JKT48 TV diputar langsung, sampai 1080p." },
  { src: "/apps/recent.webp", title: "Recent", text: "Rekap live: durasi, penonton, gift, top supporter, dan replay." },
  { src: "/apps/member.webp", title: "Member", text: "Direktori member dengan pencarian dan daftar oshi favorit." },
  { src: "/apps/home-dark.webp", title: "Tema gelap", text: "Ikut tema sistem, atau pilih putih / gelap sendiri." },
];

const FEATURES: { icon: LucideIcon; title: string; text: string; wide?: boolean }[] = [
  { icon: Radio, title: "Live realtime", text: "Notifikasi dalam ±15 detik saat member mulai live di IDN atau Showroom, walau aplikasi ditutup.", wide: true },
  { icon: CalendarClock, title: "Jadwal theater", text: "Show & event mendatang, lineup, setlist, dan hitung mundur." },
  { icon: History, title: "Recent & replay", text: "Statistik live, gift, top supporter, cuplikan layar, dan replay." },
  { icon: PlayCircle, title: "Video YouTube", text: "Putar di aplikasi dengan pilihan kualitas dan komentar." },
  { icon: Download, title: "Sosmed + unduh", text: "Posting X, TikTok, Instagram member. Foto & video bisa diunduh.", wide: true },
  { icon: Sparkles, title: "Liquid glass", text: "Kaca yang membiaskan isi di belakangnya: bisa ditekan, ditarik, membal." },
  { icon: RefreshCw, title: "Update otomatis", text: "Versi baru muncul sebagai pop-up dan langsung terpasang, tanpa hapus aplikasi lama.", wide: true },
  { icon: Bell, title: "Ultah & berita", text: "Pengingat ulang tahun member dan berita baru dari jkt48.com.", wide: true },
];

const STEPS = [
  { n: "01", title: "Unduh APK", text: "Ketuk tombol unduh. Ukurannya sekitar 2,5 MB, langsung dari GitHub Releases resmi JKT48Connect." },
  { n: "02", title: "Izinkan & pasang", text: "Buka file-nya, izinkan pemasangan dari browser/file manager bila diminta, lalu Pasang." },
  { n: "03", title: "Selesai, update sendiri", text: "Versi berikutnya muncul sebagai pop-up di aplikasi dan terpasang tanpa hapus aplikasi lama." },
];

const FAQ = [
  { q: "Apakah gratis?", a: "Ya, gratis dan tanpa iklan. Kalau mau, kamu bisa mendukung lewat menu Donasi (QRIS) di aplikasi." },
  { q: "Kenapa tidak ada di Play Store?", a: "JKT48Connect proyek fans yang dirilis langsung lewat GitHub Releases. Setiap APK ditandatangani kunci yang sama, jadi update berikutnya bisa langsung dipasang di atas versi lama." },
  { q: "Aman dipasang?", a: "APK dibangun otomatis dari kode sumber di GitHub. Aplikasi tidak meminta akun, kontak, atau lokasi. Izin yang dipakai: internet, notifikasi, dan memasang update." },
  { q: "Butuh Android versi berapa?", a: "Android 8.0 (Oreo) ke atas. Efek kaca paling lengkap di Android 13+, versi lebih lama tetap bisa dipakai." },
  { q: "Ada untuk iPhone?", a: "Belum. Pengguna iPhone bisa memakai situs jkt48connect.app yang isinya sama." },
  { q: "Apakah resmi dari JKT48?", a: "Bukan. JKT48Connect dibuat oleh fans dan tidak berafiliasi dengan JKT48 Operation Team." },
];

function fmtSize(bytes?: number) {
  return bytes ? `${(bytes / 1_048_576).toFixed(1).replace(".", ",")} MB` : "±2,5 MB";
}

export function AppsPage() {
  const meta = STATIC_PAGES["/apps"];
  useDocumentTitle(meta?.title, meta?.description);
  const root = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useTheme();
  const release = useQuery({ queryKey: ["app-release"], queryFn: getAppRelease, staleTime: 10 * 60_000, retry: 1 });
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const apk = release.data?.apk || LATEST_APK;
  const version = release.data?.version;
  const liveList = live.data ?? [];
  const show = next.data?.find((s) => s.category === "show") ?? next.data?.[0];

  // Animasi halaman (GSAP): intro hero, kartu melayang, parallax ponsel, reveal per bagian, galeri yang dipin.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduce) return;
      const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
      intro
        .from("[data-hero-line]", { yPercent: 110, opacity: 0, duration: 1.1, stagger: 0.09 })
        .from("[data-hero-sub]", { y: 24, opacity: 0, duration: 0.8 }, "-=0.7")
        .from("[data-hero-cta]", { y: 20, opacity: 0, scale: 0.92, duration: 0.8, stagger: 0.08, ease: "back.out(2)" }, "-=0.6")
        .from("[data-phone]", { y: 120, rotate: 8, opacity: 0, duration: 1.4, ease: "expo.out" }, 0.15)
        .from("[data-float]", { scale: 0.6, opacity: 0, duration: 1, stagger: 0.12, ease: "elastic.out(1, 0.55)" }, 0.6);

      gsap.utils.toArray<HTMLElement>("[data-float]").forEach((f, i) => {
        gsap.to(f, { y: i % 2 ? 14 : -14, rotate: i % 2 ? -1.5 : 1.5, duration: 3 + i * 0.6, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.4 });
      });
      gsap.to("[data-blob]", { xPercent: (i) => (i % 2 ? -18 : 14), yPercent: (i) => (i % 2 ? 12 : -10), duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: 1.5 });

      gsap.to("[data-phone]", { yPercent: -12, rotate: -4, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true } });
      gsap.to("[data-hero-bgtext]", { xPercent: -18, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true } });

      ScrollTrigger.batch("[data-reveal-up]", {
        start: "top 88%",
        onEnter: (els) => gsap.fromTo(els, { y: 50, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.9, stagger: 0.08, ease: "power3.out", overwrite: true }),
      });
      gsap.utils.toArray<HTMLElement>("[data-title]").forEach((t) => {
        gsap.from(t, { yPercent: 60, opacity: 0, duration: 1, ease: "power4.out", scrollTrigger: { trigger: t, start: "top 90%" } });
      });

      // Galeri layar: dipin & digeser horizontal saat menggulir (desktop); di HP cukup geser biasa.
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px)", () => {
        const track = el.querySelector<HTMLElement>("[data-track]");
        const pin = el.querySelector<HTMLElement>("[data-gallery]");
        if (!track || !pin) return;
        const distance = () => track.scrollWidth - pin.clientWidth + 48;
        gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: { trigger: pin, start: "top top", end: () => `+=${distance()}`, scrub: 0.6, pin: true, invalidateOnRefresh: true },
        });
        gsap.utils.toArray<HTMLElement>("[data-shot]").forEach((s) => {
          gsap.fromTo(s, { rotateY: -18 }, { rotateY: 0, ease: "none", scrollTrigger: { trigger: pin, start: "top top", end: () => `+=${distance()}`, scrub: true } });
        });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="relative min-h-screen overflow-x-clip bg-bg text-ink">
      <TopBar apk={apk} dark={dark} onTheme={toggle} />

      {/* ───── Hero ───── */}
      <section data-hero data-dark className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[#1a0a0f] pb-20 pt-28 text-white lg:pb-40 lg:pt-28">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div data-blob className="absolute -left-40 -top-32 h-[38rem] w-[38rem] rounded-full bg-[#e1243a] opacity-70 blur-[110px]" />
          <div data-blob className="absolute -right-32 top-24 h-[32rem] w-[32rem] rounded-full bg-[#ff7aa2] opacity-50 blur-[120px]" />
          <div data-blob className="absolute bottom-[-12rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-[#ffb36b] opacity-35 blur-[120px]" />
          {/* Teks raksasa di belakang: supaya pembiasan kaca terlihat jelas. */}
          <div data-hero-bgtext className="condensed absolute bottom-[-3vw] left-0 whitespace-nowrap text-[26vw] uppercase leading-none text-white/[0.06]">
            JKT48CONNECT · JKT48CONNECT
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.08)_1px,transparent_0)] [background-size:22px_22px]" />
        </div>

        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 md:grid-cols-[1.15fr_0.85fr] md:px-8">
          <div className="relative">
            <Glass radius={999} bezel={14} strength={28} className="mb-6 inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold" data-hero-sub>
              <Smartphone className="h-4 w-4" /> Aplikasi Android · Gratis{version ? ` · v${version}` : ""}
            </Glass>
            <h1 className="condensed text-[clamp(3.2rem,8vw,6.4rem)] uppercase leading-[0.86]">
              <span className="block overflow-hidden"><span data-hero-line className="block">Oshi kamu,</span></span>
              <span className="block overflow-hidden"><span data-hero-line className="block text-transparent [-webkit-text-stroke:2px_white]">selalu di</span></span>
              <span className="block overflow-hidden"><span data-hero-line className="block">genggaman.</span></span>
            </h1>
            <p data-hero-sub className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/75">
              Live IDN & Showroom, jadwal theater, recent dan replay, video YouTube, sampai posting sosmed member JKT48. Ringan, gratis, dengan tampilan liquid glass.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Glass as="a" href={apk} interactive radius={999} bezel={18} strength={40} tint="rgb(225 36 58 / 0.78)" className="inline-flex items-center gap-2.5 px-7 py-4 text-[16px] font-extrabold" data-hero-cta>
                <ArrowDownToLine className="h-5 w-5" /> Unduh APK
                <span className="text-[12px] font-semibold text-white/75">{fmtSize(release.data?.size)}</span>
              </Glass>
              <Glass as="a" href={RELEASES} target="_blank" rel="noopener noreferrer" interactive radius={999} bezel={18} strength={40} className="inline-flex items-center gap-2.5 px-6 py-4 text-[15px] font-bold" data-hero-cta>
                <GitBranch className="h-5 w-5" /> Lihat rilis
              </Glass>
            </div>
            <ul data-hero-sub className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/65">
              <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Tanpa akun & tanpa iklan</li>
              <li className="flex items-center gap-1.5"><RefreshCw className="h-4 w-4" /> Update otomatis</li>
              <li className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> Android 8+</li>
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[290px]">
            <Phone src="/apps/home.webp" alt="Beranda aplikasi JKT48Connect" data-phone />
            {/* Kartu kaca melayang dengan data asli dari API. */}
            <Glass data-float radius={22} bezel={16} strength={34} blur={10} tint="rgb(26 10 15 / 0.5)" className="absolute -left-28 top-20 hidden w-52 p-4 sm:block">
              <p className="micro flex items-center gap-1.5 text-white/80"><span className="h-2 w-2 animate-pulse rounded-full bg-[#ff4a5f]" /> Live sekarang</p>
              <p className="condensed mt-1 text-[34px] leading-none">{live.data ? `${liveList.length} member` : "…"}</p>
              <div className="mt-2 flex -space-x-2">
                {liveList.slice(0, 5).map((l) => (
                  <img key={l.id} src={l.img || l.avatar} alt={l.name} loading="lazy" className="h-8 w-8 rounded-full border-2 border-white/70 object-cover object-top" />
                ))}
              </div>
            </Glass>
            {show && (
              <Glass data-float radius={22} bezel={16} strength={34} blur={10} tint="rgb(26 10 15 / 0.5)" className="absolute -right-14 bottom-36 hidden w-56 p-4 sm:block">
                <p className="micro text-white/75">Show berikutnya</p>
                <p className="mt-1 truncate text-[16px] font-extrabold">{show.title}</p>
                <Countdown target={show.date} className="mt-1 block font-mono text-[13px] text-white/85" />
              </Glass>
            )}
            <Glass data-float radius={20} bezel={14} strength={30} blur={10} tint="rgb(26 10 15 / 0.5)" className="absolute -left-14 bottom-4 hidden items-center gap-3 p-3 pr-4 sm:flex">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e1243a]"><Bell className="h-5 w-5" /></span>
              <span className="text-[13px] leading-tight">
                <b className="block">Notifikasi live</b>
                <span className="text-white/70">± 15 detik setelah mulai</span>
              </span>
            </Glass>
          </div>
        </div>
        <DragLens />
      </section>

      {/* ───── Fitur ───── */}
      <section id="fitur" className="relative isolate mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
        <SectionTitle eyebrow="Fitur" title="Semua tentang JKT48, satu aplikasi" />
        <div className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div aria-hidden className="absolute -left-16 top-0 -z-10 h-80 w-80 rounded-full bg-brand/30 blur-[90px]" />
          <div aria-hidden className="absolute left-1/2 top-1/3 -z-10 h-72 w-72 rounded-full bg-[#ffb36b]/30 blur-[90px]" />
          <div aria-hidden className="absolute -right-16 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#ff9ab0]/40 blur-[90px]" />
          {FEATURES.map((f) => (
            <Glass key={f.title} interactive radius={28} bezel={20} strength={36} className={`p-6 ${f.wide ? "lg:col-span-2" : ""}`} data-reveal-up>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-white shadow-[0_8px_24px_rgb(225_36_58/0.35)]">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-[19px] font-extrabold">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{f.text}</p>
            </Glass>
          ))}
        </div>
      </section>

      {/* ───── Galeri layar ───── */}
      <section id="tampilan" data-gallery data-dark className="relative overflow-hidden bg-[#140b0e] py-20 text-white md:h-screen md:py-0">
        <div aria-hidden className="absolute inset-0 -z-0">
          <div className="absolute left-1/4 top-1/3 h-[30rem] w-[30rem] rounded-full bg-[#e1243a]/45 blur-[130px]" />
          <div className="absolute right-0 top-0 h-[24rem] w-[24rem] rounded-full bg-[#ff7aa2]/25 blur-[120px]" />
        </div>
        <div className="relative flex h-full flex-col justify-center">
          <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
            <SectionTitle eyebrow="Tampilan" title="Lihat isinya" light />
          </div>
          <div data-track className="no-scrollbar mt-10 flex snap-x gap-8 overflow-x-auto px-5 pb-6 [perspective:1400px] md:overflow-visible md:px-[max(2rem,calc((100vw-72rem)/2+2rem))]">
            {SCREENS.map((s) => (
              <figure key={s.src} data-shot className="w-[230px] shrink-0 snap-center md:w-[260px]">
                <Phone src={s.src} alt={`Layar ${s.title} aplikasi JKT48Connect`} small />
                <figcaption className="mt-5">
                  <p className="text-[17px] font-extrabold">{s.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-white/65">{s.text}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Cara pasang ───── */}
      <section id="pasang" className="relative isolate mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
        <SectionTitle eyebrow="Cara pasang" title="Tiga langkah, selesai" />
        <div className="relative mt-12 grid gap-4 md:grid-cols-3">
          <div aria-hidden className="absolute left-1/2 top-0 -z-10 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[100px]" />
          {STEPS.map((s) => (
            <Glass key={s.n} radius={28} bezel={20} strength={34} className="p-7" data-reveal-up>
              <p className="condensed text-[56px] leading-none text-brand">{s.n}</p>
              <h3 className="mt-4 text-[20px] font-extrabold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.text}</p>
            </Glass>
          ))}
        </div>
      </section>

      {/* ───── Ulasan ───── */}
      <section id="ulasan" className="relative isolate mx-auto max-w-6xl px-5 pb-24 md:px-8 md:pb-32">
        <Glass radius={36} bezel={26} strength={40} className="overflow-hidden p-8 md:p-12" data-reveal-up>
          <div aria-hidden className="absolute -right-16 -top-16 -z-10 h-64 w-64 rounded-full bg-brand/30 blur-[80px]" />
          <div className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="micro flex items-center gap-2 text-brand"><MessageSquareQuote className="h-4 w-4" /> Ulasan</p>
              <h2 className="condensed mt-3 text-[clamp(2.4rem,5vw,3.6rem)] uppercase leading-[0.9]">Sudah coba? Ceritakan!</h2>
              <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-soft">
                Ulasanmu membantu fans lain dan jadi masukan untuk versi berikutnya. Tulis di X dengan tagar <b className="text-ink">#JKT48ConnectApp</b>, atau beri bintang di GitHub.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Glass as="a" href={REVIEW_INTENT} target="_blank" rel="noopener noreferrer" interactive radius={22} bezel={16} strength={32} tint="rgb(225 36 58 / 0.85)" className="flex items-center justify-between gap-3 px-5 py-4 font-extrabold text-white">
                Tulis ulasan di X <ArrowRight className="h-5 w-5" />
              </Glass>
              <Glass as="a" href={REVIEW_SEARCH} target="_blank" rel="noopener noreferrer" interactive radius={22} bezel={16} strength={32} className="flex items-center justify-between gap-3 px-5 py-4 font-bold">
                Baca ulasan fans lain <ArrowRight className="h-5 w-5" />
              </Glass>
              <Glass as="a" href={GITHUB_STAR} target="_blank" rel="noopener noreferrer" interactive radius={22} bezel={16} strength={32} className="flex items-center justify-between gap-3 px-5 py-4 font-bold">
                <span className="flex items-center gap-2"><Star className="h-5 w-5 text-brand" /> Beri bintang di GitHub</span> <ArrowRight className="h-5 w-5" />
              </Glass>
            </div>
          </div>
        </Glass>
      </section>

      {/* ───── FAQ ───── */}
      <section id="faq" className="mx-auto max-w-3xl px-5 pb-24 md:px-8 md:pb-32">
        <SectionTitle eyebrow="FAQ" title="Pertanyaan umum" center />
        <div className="mt-10 space-y-3">
          {FAQ.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* ───── CTA akhir ───── */}
      <section data-dark className="relative isolate overflow-hidden bg-[#1a0a0f] px-5 py-24 text-center text-white md:py-32">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e1243a]/60 blur-[120px]" />
        </div>
        <PixelCross className="mx-auto h-14 w-14" cellClass="fill-white" />
        <h2 data-title className="condensed mx-auto mt-6 max-w-3xl text-[clamp(2.8rem,7vw,5.5rem)] uppercase leading-[0.88]">Pasang sekarang, gratis.</h2>
        <p className="mx-auto mt-5 max-w-md text-[16px] text-white/70">
          {version ? `Versi ${version}` : "Versi terbaru"} · {fmtSize(release.data?.size)} · Android 8+
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Glass as="a" href={apk} interactive radius={999} bezel={18} strength={40} tint="rgb(225 36 58 / 0.8)" className="inline-flex items-center gap-2.5 px-8 py-4 text-[17px] font-extrabold">
            <ArrowDownToLine className="h-5 w-5" /> Unduh APK
          </Glass>
          <Glass as={Link} to="/" interactive radius={999} bezel={18} strength={40} className="inline-flex items-center gap-2.5 px-7 py-4 text-[15px] font-bold">
            Buka versi web <ArrowRight className="h-5 w-5" />
          </Glass>
        </div>
        <p className="mx-auto mt-16 max-w-xl text-[12px] text-white/45">
          Fan-made · tidak berafiliasi dengan JKT48 Operation Team. APK dibangun otomatis dari kode sumber di GitHub.
        </p>
      </section>
    </div>
  );
}

/** Bilah atas kaca yang menempel: logo, tautan bagian, tema, dan tombol unduh. */
function TopBar({ apk, dark, onTheme }: { apk: string; dark: boolean; onTheme: () => void }) {
  // Teks putih saat bilah berada di atas bagian gelap (hero, galeri, CTA), gelap/ikut tema di bagian terang.
  const [onDark, setOnDark] = useState(true);
  useEffect(() => {
    const on = () => {
      const y = 48;
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
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3 md:top-5">
      <Glass radius={999} bezel={16} strength={30} blur={8} className={`pointer-events-auto mx-auto flex max-w-5xl items-center gap-2 py-2 pl-3 pr-2 transition-colors ${onDark ? "text-white" : "text-ink"}`}>
        <Link to="/" className="flex items-center gap-2 pr-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand"><PixelCross className="h-5 w-5" cellClass="fill-white" /></span>
          <span className="condensed text-[20px] uppercase leading-none">JKT48<span className={onDark ? "text-[#ff8f9e]" : "text-brand"}>Connect</span></span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 text-[14px] font-semibold md:flex">
          {[["#fitur", "Fitur"], ["#tampilan", "Tampilan"], ["#pasang", "Cara pasang"], ["#ulasan", "Ulasan"], ["#faq", "FAQ"]].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3 py-2 opacity-80 hover:bg-white/10 hover:opacity-100">{label}</a>
          ))}
        </nav>
        <button type="button" onClick={onTheme} aria-label="Ganti tema" className="ml-auto grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 md:ml-1">
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <a href={apk} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-[14px] font-extrabold text-white shadow-[0_6px_20px_rgb(225_36_58/0.4)]">
          <ArrowDownToLine className="h-4 w-4" /> <span>Unduh</span>
        </a>
      </Glass>
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

/**
 * Lensa kaca besar yang bisa diseret di atas hero: membiaskan teks & warna di belakangnya,
 * meregang mengikuti kecepatan seret lalu membal (elastic) saat dilepas.
 */
function DragLens() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const idle = gsap.to(el, { y: "+=26", x: "+=18", duration: 4, repeat: -1, yoyo: true, ease: "sine.inOut" });
    let dragging = false;
    let sx = 0, sy = 0, ox = 0, oy = 0, lx = 0, ly = 0, lt = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      idle.pause();
      el.setPointerCapture(e.pointerId);
      sx = e.clientX;
      sy = e.clientY;
      ox = Number(gsap.getProperty(el, "x"));
      oy = Number(gsap.getProperty(el, "y"));
      lx = e.clientX;
      ly = e.clientY;
      lt = performance.now();
      gsap.to(el, { scale: 1.06, duration: 0.25 });
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max(16, now - lt);
      const vx = (e.clientX - lx) / dt;
      const vy = (e.clientY - ly) / dt;
      lx = e.clientX;
      ly = e.clientY;
      lt = now;
      const stretch = Math.min(0.22, Math.hypot(vx, vy) * 0.12);
      gsap.to(el, {
        x: ox + e.clientX - sx,
        y: oy + e.clientY - sy,
        scaleX: 1.06 + (Math.abs(vx) > Math.abs(vy) ? stretch : -stretch * 0.6),
        scaleY: 1.06 + (Math.abs(vy) >= Math.abs(vx) ? stretch : -stretch * 0.6),
        duration: 0.18,
        overwrite: "auto",
      });
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      gsap.to(el, { scaleX: 1, scaleY: 1, scale: 1, duration: 1.1, ease: "elastic.out(1.1, 0.3)", onComplete: () => void idle.invalidate().restart() });
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      idle.kill();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <div ref={ref} className="absolute bottom-8 left-[7%] z-20 hidden cursor-grab touch-none select-none active:cursor-grabbing lg:block" aria-hidden>
      <Glass radius={999} bezel={34} strength={56} blur={0} className="grid h-[120px] w-[230px] place-items-center">
        <span className="micro text-white/70">Seret aku</span>
      </Glass>
    </div>
  );
}

function SectionTitle({ eyebrow, title, light, center }: { eyebrow: string; title: string; light?: boolean; center?: boolean }) {
  return (
    <div className={`overflow-hidden ${center ? "text-center" : ""}`}>
      <p className={`micro flex items-center gap-2 ${center ? "justify-center" : ""} text-brand`}>
        <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {eyebrow}
      </p>
      <h2 data-title className={`condensed mt-3 text-[clamp(2.6rem,6vw,4.6rem)] uppercase leading-[0.88] ${light ? "text-white" : ""}`}>{title}</h2>
    </div>
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
    <Glass radius={22} bezel={16} strength={28} className="overflow-hidden" data-reveal-up>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[16px] font-bold">
        {question}
        <ChevronDown className={`h-5 w-5 shrink-0 text-brand transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div ref={body} className="h-0 overflow-hidden opacity-0">
        <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-soft">{a}</p>
      </div>
    </Glass>
  );
}
