import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Countdown } from "@/components/countdown";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { getAppRelease } from "@/lib/jkt48";
import { q } from "@/lib/queries";
import { STATIC_PAGES } from "@/lib/seo";

/*
 * Landing page aplikasi: halaman produk yang terang dan bersih. Putih dengan garis rambut abu, tipografi tebal
 * rapat, merah JKT48Connect hanya sebagai aksen, dan mockup HP berisi tangkapan layar asli aplikasi Android
 * (Compose, Liquid Glass) dan iPhone (SwiftUI). Data "hari ini" dan versi rilis diambil langsung dari API.
 * Animasi GSAP hanya transform/opacity dan dimatikan bila pengguna memilih gerak dikurangi.
 */

/** APK selalu bernama sama di setiap rilis, jadi tautan "latest" GitHub selalu menuju versi terbaru. */
const LATEST_APK = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/latest/download/jkt48connect.apk";
const IOS_BASE = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest";
/** Installer Windows dengan URL tetap (prerelease desktop-latest). */
const WIN_EXE = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/desktop-latest/JKT48Connect-Setup.exe";
const IOS_IPA = `${IOS_BASE}/jkt48connect.ipa`;
/** Repo Scarlet dan sumber AltStore (dibaca SideStore, Feather, ESign); URL tetap, diperbarui tiap rilis iPhone. */
const IOS_SCARLET = `${IOS_BASE}/scarlet.json`;
const IOS_SOURCE = `${IOS_BASE}/repo.json`;
const GITHUB_STAR = "https://github.com/JKT48Connect/JKT48Connect-APP";
const REVIEW_INTENT = `https://x.com/intent/post?text=${encodeURIComponent("Pakai aplikasi JKT48Connect buat pantau live, jadwal theater & recent member JKT48. Menurutku: ")}&url=${encodeURIComponent("https://jkt48connect.app/apps")}&hashtags=JKT48ConnectApp`;
const REVIEW_SEARCH = "https://x.com/search?q=%23JKT48ConnectApp&f=live";

const BRAND = "#e1243a";

type Shot = { src: string; label: string; ios?: boolean };

const GALLERY: Record<"android" | "iphone", Shot[]> = {
  android: [
    { src: "/apps/android-home.webp", label: "Beranda" },
    { src: "/apps/android-live.webp", label: "Live" },
    { src: "/apps/android-jadwal.webp", label: "Jadwal" },
    { src: "/apps/android-theater.webp", label: "Detail show" },
    { src: "/apps/android-recent.webp", label: "Recent" },
    { src: "/apps/android-member.webp", label: "Member" },
    { src: "/apps/android-profile.webp", label: "Profil member" },
    { src: "/apps/android-sosmed.webp", label: "Sosmed" },
    { src: "/apps/android-video.webp", label: "Video" },
    { src: "/apps/android-menu.webp", label: "Menu" },
    { src: "/apps/android-dark.webp", label: "Mode gelap" },
  ],
  iphone: [
    { src: "/apps/ios-home.webp", label: "Beranda", ios: true },
    { src: "/apps/ios-live.webp", label: "Live", ios: true },
    { src: "/apps/ios-jadwal.webp", label: "Jadwal", ios: true },
    { src: "/apps/ios-recent.webp", label: "Recent", ios: true },
    { src: "/apps/ios-member.webp", label: "Member", ios: true },
    { src: "/apps/ios-sosmed.webp", label: "Sosmed", ios: true },
    { src: "/apps/ios-video.webp", label: "Video", ios: true },
    { src: "/apps/ios-dark.webp", label: "Mode gelap", ios: true },
  ],
};

type Feature = { tag: string; title: string; body: string; points: string[]; shot: Shot };

const FEATURES: Feature[] = [
  {
    tag: "Live & notifikasi",
    title: "Tahu begitu oshi mulai live.",
    body: "Notifikasi masuk sekitar 15 detik setelah live dimulai, walau aplikasi sedang ditutup.",
    points: ["Live Showroom ditonton langsung di aplikasi", "Live IDN dibuka di aplikasi/situs IDN", "Pengingat show, ulang tahun, dan berita baru"],
    shot: { src: "/apps/android-live.webp", label: "Live" },
  },
  {
    tag: "Jadwal theater",
    title: "Jadwal, lineup, dan setlist dalam satu layar.",
    body: "Show dan event mendatang dikelompokkan per hari, lengkap dengan hitung mundur ke jam mulai.",
    points: ["Lineup member tampil dan setlist lagu", "Arsip theater yang bisa digulir terus", "Penanda ulang tahun di show"],
    shot: { src: "/apps/ios-jadwal.webp", label: "Jadwal", ios: true },
  },
  {
    tag: "Recent & replay",
    title: "Rekap tiap live, sampai replay-nya.",
    body: "Durasi, penonton, gift, dan top supporter setiap live IDN dan Showroom.",
    points: ["Replay Showroom bisa diputar langsung", "Replay IDN terbuka 72 jam setelah live", "Cuplikan layar dari jalannya live"],
    shot: { src: "/apps/android-recent.webp", label: "Recent" },
  },
  {
    tag: "Member & oshi",
    title: "Tandai oshi, semuanya mendahulukan mereka.",
    body: "Profil lengkap tiap member: data diri, total live, jikoshoukai, dan jadwal theater-nya.",
    points: ["Oshi tampil paling atas di beranda", "Postingan X, TikTok, dan Instagram member", "Pencarian cepat, aktif dan lulus"],
    shot: { src: "/apps/ios-member.webp", label: "Member", ios: true },
  },
];

const EXTRAS: { title: string; body: string; icon: ReactNode }[] = [
  { title: "Video YouTube", body: "JKT48 & JKT48 TV diputar di aplikasi, lengkap dengan komentar.", icon: <IconPlay /> },
  { title: "Unduh media sosmed", body: "Simpan foto dan video dari posting member ke galeri.", icon: <IconDownload /> },
  { title: "Liquid Glass", body: "Kaca bening yang bisa ditekan dan diseret, di Android dan iPhone.", icon: <IconGlass /> },
  { title: "Terang & gelap", body: "Ikut tema sistem, atau pilih sendiri.", icon: <IconMoon /> },
  { title: "Update otomatis", body: "Versi baru muncul di aplikasi dan terpasang di atas versi lama.", icon: <IconRefresh /> },
  { title: "Ringan & hemat", body: "Sekitar 2 MB, data tersimpan di HP, tetap bisa dibuka saat offline.", icon: <IconBolt /> },
];

const FAQ = [
  { q: "Apakah gratis?", a: "Ya, gratis dan tanpa iklan. Kalau mau, kamu bisa mendukung lewat menu Donasi (QRIS) di aplikasi." },
  { q: "Kenapa tidak ada di Play Store / App Store?", a: "JKT48Connect proyek fans yang dirilis langsung lewat GitHub Releases. APK Android ditandatangani kunci yang sama setiap rilis, jadi update bisa langsung dipasang di atas versi lama. Versi iPhone dipasang lewat sideload (lihat Panduan)." },
  { q: "Aman dipasang?", a: "Aplikasi dibangun otomatis dari kode sumber di GitHub. Tidak meminta akun, kontak, atau lokasi. Izin yang dipakai: internet, notifikasi, dan memasang update." },
  { q: "Butuh versi Android / iOS berapa?", a: "Android 8.0 (Oreo) ke atas. iPhone: iOS 16 ke atas; di iOS 26 tampilannya memakai Liquid Glass asli Apple." },
  { q: "Bagaimana cara update?", a: "Android: pop-up update muncul sendiri di aplikasi, ketuk Update sekarang (data tetap). iPhone: kalau kamu menambahkan repo JKT48Connect di Scarlet/ESign/Feather/SideStore, versi baru muncul di sana; atau unduh .ipa terbaru dan pasang di atas versi lama." },
  { q: "Apakah resmi dari JKT48?", a: "Bukan. JKT48Connect dibuat oleh fans dan tidak berafiliasi dengan JKT48 Operation Team, IDN, maupun Showroom." },
];

function fmtSize(bytes?: number) {
  return bytes ? `${(bytes / 1_048_576).toFixed(1).replace(".", ",")} MB` : "±2 MB";
}

function fmtDate(iso?: string) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

const wib = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("id-ID", { ...opts, timeZone: "Asia/Jakarta" });

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
  const ios = release.data?.ios;
  const win = release.data?.desktop;
  const ipa = ios?.ipa || IOS_IPA;
  const liveList = live.data ?? [];
  const show = next.data?.find((s) => s.category === "show") ?? next.data?.[0];
  const bday = birthdays.data?.[0];
  const [guide, setGuide] = useState<"android" | "iphone">("android");
  const [gallery, setGallery] = useState<"android" | "iphone">("android");
  useEffect(() => {
    // Perangkat iPhone dan tautan #panduan-iphone langsung membuka bagian iPhone.
    if (location.hash === "#panduan-iphone" || /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      setGuide("iphone");
      setGallery("iphone");
    }
  }, []);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduce) return;
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-hero-in]", { y: 28, opacity: 0, duration: 0.8, stagger: 0.08 })
        .from("[data-phone-back]", { y: 80, rotate: -14, opacity: 0, duration: 1.1 }, 0.15)
        .from("[data-phone-front]", { y: 110, rotate: 12, opacity: 0, duration: 1.1 }, 0.25)
        .from("[data-float]", { y: 20, opacity: 0, scale: 0.94, duration: 0.7, stagger: 0.12 }, 0.8);
      gsap.to("[data-phone-front]", { yPercent: -6, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true } });
      gsap.to("[data-phone-back]", { yPercent: 4, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true } });
      gsap.utils.toArray<HTMLElement>("[data-in]").forEach((box) => {
        gsap.from(box, { y: 36, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: box, start: "top 90%", once: true } });
      });
    }, el);
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

  const firstLive = liveList[0];

  return (
    <div ref={root} className="relative min-h-screen overflow-x-clip bg-white text-[#0b0b0f] antialiased">
      <TopBar apk={apk} />

      {/* ───── Hero ───── */}
      <section data-hero className="relative isolate">
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[680px] bg-[radial-gradient(60%_60%_at_75%_30%,rgba(225,36,58,0.10),transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-28 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:pb-24 md:pt-36">
          <div>
            <p data-hero-in className="inline-flex items-center gap-2 rounded-full border border-[#e8e8ec] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#3c3c44] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {liveList.length > 0 ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e1243a] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e1243a]" />
                  </span>
                  {liveList.length} member sedang live
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-[#e1243a]" /> Android &amp; iPhone · Gratis
                </>
              )}
            </p>
            <h1 data-hero-in className="mt-6 text-[clamp(2.9rem,5.2vw,4.25rem)] font-extrabold leading-[0.95] tracking-[-0.045em]">
              Oshi live,
              <br />
              <span className="text-[#e1243a] lg:whitespace-nowrap">kamu tahu duluan.</span>
            </h1>
            <p data-hero-in className="mt-6 max-w-[34rem] text-[clamp(1.05rem,1.6vw,1.2rem)] leading-relaxed text-[#5c5c66]">
              Notifikasi live IDN &amp; Showroom, jadwal theater, recent &amp; replay, video YouTube, dan posting sosmed member JKT48. Satu aplikasi untuk Android dan iPhone.
            </p>
            <div data-hero-in className="mt-8 flex flex-wrap gap-3">
              <StoreButton href={apk} dark label="Unduh untuk Android" sub={version ? `APK · v${version}` : "APK"} icon={<IconAndroidPhone />} />
              <StoreButton href="#panduan-iphone" onClick={() => setGuide("iphone")} label="Pasang di iPhone" sub={ios?.version ? `.ipa · v${ios.version}` : ".ipa · tanpa PC"} icon={<IconIphone />} />
              <StoreButton href={win?.exe || WIN_EXE} label="Unduh untuk Windows" sub={win?.version ? `.exe · v${win.version}` : ".exe · Windows 10/11"} icon={<IconWindows />} />
            </div>
            <p data-hero-in className="mt-5 text-[13px] text-[#8a8a94]">
              Gratis · tanpa akun · tanpa iklan · Android 8+ · iOS 16+ · Windows 10/11
            </p>
          </div>

          {/* Dua HP: Android di belakang, iPhone di depan, dengan notifikasi yang mengambang. */}
          <div className="relative mx-auto h-[520px] w-full max-w-[460px] sm:h-[600px]">
            <div data-phone-back className="absolute left-0 top-10 w-[54%] -rotate-6 sm:top-6">
              <Phone src="/apps/android-home.webp" alt="Beranda aplikasi Android JKT48Connect" />
            </div>
            <div data-phone-front className="absolute right-0 top-0 w-[56%] rotate-[4deg]">
              <Phone src="/apps/ios-home.webp" alt="Beranda aplikasi iPhone JKT48Connect" ios />
            </div>
            <div data-float className="absolute -left-2 bottom-16 z-10 w-[78%] max-w-[300px] sm:-left-8">
              <Notice
                title={firstLive ? `${firstLive.name} sedang live` : "Member mulai live"}
                body={firstLive ? `${firstLive.platform === "showroom" ? "Showroom" : "IDN Live"} · ketuk untuk menonton` : "IDN Live · ketuk untuk menonton"}
                img={firstLive?.img || firstLive?.avatar}
              />
            </div>
            {show && (
              <div data-float className="absolute -right-2 bottom-2 z-10 rounded-2xl border border-[#e8e8ec] bg-white/95 px-4 py-3 shadow-[0_12px_30px_rgba(11,11,15,0.12)] backdrop-blur sm:-right-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8a94]">Show berikutnya</p>
                <p className="mt-0.5 max-w-[11rem] truncate text-[14px] font-bold">{show.title}</p>
                <p className="mt-0.5 font-mono text-[12px] text-[#e1243a]">
                  <Countdown target={show.date} />
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ───── Hari ini (data asli) ───── */}
      <section className="mx-auto max-w-6xl px-4 md:px-8">
        <div data-in className="grid overflow-hidden rounded-3xl border border-[#e8e8ec] bg-[#fafafb] md:grid-cols-3 md:divide-x md:divide-[#e8e8ec]">
          <TodayCell label="Sedang live">
            <div className="flex items-end gap-3">
              <span className="text-[44px] font-extrabold leading-none tracking-[-0.04em]">{live.data ? liveList.length : "…"}</span>
              <span className="pb-1 text-[14px] text-[#5c5c66]">member</span>
            </div>
            {liveList.length > 0 ? (
              <div className="mt-3 flex -space-x-2">
                {liveList.slice(0, 6).map((l) => (
                  <img key={l.id} src={l.img || l.avatar} alt={l.name} title={l.name} loading="lazy" className="h-8 w-8 rounded-full border-2 border-white object-cover object-top" />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-[#8a8a94]">{live.data ? "Belum ada yang live sekarang." : "Memuat…"}</p>
            )}
          </TodayCell>
          <TodayCell label="Show berikutnya">
            {show ? (
              <>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[44px] font-extrabold leading-none tracking-[-0.04em]">{wib(show.date, { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-[13px] font-semibold text-[#5c5c66]">WIB</span>
                </p>
                <p className="mt-2 truncate text-[15px] font-bold">{show.title}</p>
                <p className="mt-0.5 text-[13px] text-[#8a8a94]">
                  {wib(show.date, { weekday: "long", day: "numeric", month: "long" })} · <Countdown target={show.date} className="text-[#e1243a]" />
                </p>
              </>
            ) : (
              <p className="text-[14px] text-[#8a8a94]">{next.data ? "Belum ada jadwal baru." : "Memuat…"}</p>
            )}
          </TodayCell>
          <TodayCell label="Ulang tahun terdekat">
            {bday ? (
              <div className="flex items-center gap-3.5">
                <img src={bday.img} alt="" loading="lazy" className="h-14 w-14 rounded-2xl object-cover object-top" />
                <div className="min-w-0">
                  <p className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.03em]">{bday.name}</p>
                  <p className="mt-0.5 text-[13px] text-[#8a8a94]">
                    {bday.next.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })} · ke-{bday.age}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[14px] text-[#8a8a94]">Memuat…</p>
            )}
          </TodayCell>
        </div>
      </section>

      {/* ───── Fitur utama: baris bergantian ───── */}
      <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 md:px-8 md:pt-32">
        <Heading eyebrow="Fitur" title="Semua yang kamu butuhkan untuk mengikuti oshi." />
        <div className="mt-14 space-y-20 md:space-y-28">
          {FEATURES.map((f, i) => (
            <article key={f.tag} data-in className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <div className="relative mx-auto w-full max-w-[300px]">
                <div aria-hidden className="absolute inset-x-[-18%] bottom-[-6%] top-[12%] -z-10 rounded-[48px] bg-[#f4f4f6]" />
                <Phone src={f.shot.src} alt={`Layar ${f.shot.label}`} ios={f.shot.ios} />
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-[#e8e8ec] bg-white px-3 py-1 text-[12px] font-semibold text-[#5c5c66] shadow-sm">
                  {f.shot.ios ? "iPhone" : "Android"} · {f.shot.label}
                </span>
              </div>
              <div>
                <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#e1243a]">{f.tag}</p>
                <h3 className="mt-3 text-[clamp(1.9rem,3.6vw,2.8rem)] font-extrabold leading-[1.05] tracking-[-0.035em]">{f.title}</h3>
                <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[#5c5c66]">{f.body}</p>
                <ul className="mt-6 space-y-3">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[16px] text-[#3c3c44]">
                      <IconCheck />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRAS.map((x) => (
            <div key={x.title} data-in className="rounded-3xl border border-[#e8e8ec] p-6 transition-colors hover:border-[#d4d4da]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fdecee] text-[#e1243a]">{x.icon}</span>
              <p className="mt-5 text-[18px] font-bold tracking-[-0.02em]">{x.title}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[#5c5c66]">{x.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───── Galeri layar ───── */}
      <section id="galeri" className="mt-24 bg-[#f6f6f8] py-20 md:mt-32 md:py-28">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 md:px-8">
          <Heading eyebrow="Galeri" title="Lihat isinya." />
          <Segmented value={gallery} onChange={setGallery} options={[["android", "Android"], ["iphone", "iPhone"]]} />
        </div>
        <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 md:px-[max(2rem,calc((100vw_-_72rem)/2_+_2rem))] md:scroll-px-[max(2rem,calc((100vw_-_72rem)/2_+_2rem))] [scrollbar-width:thin]">
          {GALLERY[gallery].map((s) => (
            <figure key={s.src} className="w-[210px] shrink-0 snap-start sm:w-[230px]">
              <Phone src={s.src} alt={`Layar ${s.label}`} ios={s.ios} />
              <figcaption className="mt-3 text-center text-[13px] font-semibold text-[#5c5c66]">{s.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ───── Unduh ───── */}
      <section id="unduh" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 md:px-8 md:pt-32">
        <Heading eyebrow="Unduh" title="Pilih perangkatmu." />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div data-in className="flex flex-col rounded-[28px] bg-[#0b0b0f] p-7 text-white sm:p-9">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><IconAndroidPhone /></span>
              <div>
                <p className="text-[22px] font-extrabold tracking-[-0.03em]">Android</p>
                <p className="text-[13px] text-white/60">APK langsung dari GitHub Releases</p>
              </div>
            </div>
            <dl className="mt-8 grid grid-cols-3 gap-4">
              <Meta k="Versi" v={version ?? "—"} dark />
              <Meta k="Ukuran" v={fmtSize(release.data?.size)} dark />
              <Meta k="Rilis" v={fmtDate(release.data?.publishedAt)} dark />
            </dl>
            <p className="mt-6 text-[14px] leading-relaxed text-white/70">Notifikasi live, jadwal, recent &amp; replay, video, dan sosmed member, dengan tampilan Liquid Glass.</p>
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
              <a href={apk} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-bold text-[#0b0b0f] transition-transform hover:-translate-y-0.5 active:scale-95">
                Unduh APK <IconArrow />
              </a>
              <a href="#panduan" onClick={() => setGuide("android")} className="text-[14px] font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline">
                Cara pasang
              </a>
              {release.data?.page && (
                <a href={release.data.page} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline">
                  Catatan rilis ↗
                </a>
              )}
            </div>
            <p className="mt-5 text-[12px] text-white/45">Android 8.0+ · update berikutnya terpasang di atas versi lama</p>
          </div>

          <div data-in className="flex flex-col rounded-[28px] border border-[#e8e8ec] bg-white p-7 sm:p-9">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f4f4f6]"><IconIphone /></span>
              <div>
                <p className="text-[22px] font-extrabold tracking-[-0.03em]">iPhone</p>
                <p className="text-[13px] text-[#8a8a94]">.ipa · pasang langsung dari iPhone</p>
              </div>
            </div>
            <dl className="mt-8 grid grid-cols-3 gap-4">
              <Meta k="Versi" v={ios?.version ?? "—"} />
              <Meta k="Ukuran" v={fmtSize(ios?.size)} />
              <Meta k="Rilis" v={fmtDate(ios?.publishedAt)} />
            </dl>
            <p className="mt-6 text-[14px] leading-relaxed text-[#5c5c66]">Lewat Scarlet, ESign, Feather, atau SideStore. Tanpa PC dan tanpa kabel.</p>
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
              <a href={ipa} className="inline-flex items-center gap-2 rounded-full bg-[#0b0b0f] px-6 py-3.5 text-[15px] font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-95">
                Unduh .ipa <IconArrow />
              </a>
              <a href="#panduan-iphone" onClick={() => setGuide("iphone")} className="text-[14px] font-semibold text-[#5c5c66] underline-offset-4 hover:text-[#0b0b0f] hover:underline">
                Cara pasang
              </a>
            </div>
            <p className="mt-5 text-[12px] text-[#8a8a94]">iOS 16+ · Liquid Glass asli di iOS 26</p>
          </div>

          <div data-in id="windows" className="relative flex flex-col overflow-hidden rounded-[28px] bg-[#e1243a] p-7 text-white sm:p-9 md:col-span-2 md:flex-row md:items-center md:gap-10">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><IconWindows /></span>
                <div>
                  <p className="text-[22px] font-extrabold tracking-[-0.03em]">Windows</p>
                  <p className="text-[13px] text-white/75">Aplikasi desktop dengan tampilan sendiri · installer .exe</p>
                </div>
              </div>
              <p className="mt-6 max-w-2xl text-[14px] leading-relaxed text-white/85">
                Hero panggung, pemutar custom untuk live Showroom &amp; replay, komentar live Showroom, notifikasi Windows saat member mulai live, tetap jalan di tray, dan update otomatis.
              </p>
              <dl className="mt-6 grid max-w-md grid-cols-3 gap-4">
                <Meta k="Versi" v={win?.version ?? "—"} dark />
                <Meta k="Ukuran" v={fmtSize(win?.size)} dark />
                <Meta k="Rilis" v={fmtDate(win?.publishedAt)} dark />
              </dl>
            </div>
            <div className="mt-8 shrink-0 md:mt-0">
              <a href={win?.exe || WIN_EXE} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-bold text-[#e1243a] transition-transform hover:-translate-y-0.5 active:scale-95">
                Unduh untuk Windows <IconArrow />
              </a>
              <p className="mt-4 max-w-xs text-[12px] text-white/70">Windows 10/11 64-bit. Jika muncul “Windows protected your PC”, klik More info → Run anyway (installer belum bertanda tangan digital).</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Panduan ───── */}
      <Guide tab={guide} onTab={setGuide} apk={apk} ipa={ipa} version={version} iosVersion={ios?.version} />

      {/* ───── FAQ ───── */}
      <section id="faq" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 pt-24 md:px-8 md:pt-32">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Heading eyebrow="Tanya jawab" title="Pertanyaan yang sering muncul." />
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-[#5c5c66]">
              Punya masukan? Ceritakan di X dengan tagar <b className="text-[#0b0b0f]">#JKT48ConnectApp</b>.
            </p>
            <div className="mt-6 flex flex-col items-start gap-3 text-[15px] font-semibold">
              <ExtLink href={REVIEW_INTENT}>Tulis ulasan di X</ExtLink>
              <ExtLink href={REVIEW_SEARCH}>Baca ulasan fans lain</ExtLink>
              <ExtLink href={GITHUB_STAR}>Beri bintang di GitHub</ExtLink>
            </div>
          </div>
          <div className="divide-y divide-[#e8e8ec] border-y border-[#e8e8ec]">
            {FAQ.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e8e8ec]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 md:px-8">
          <Logo />
          <p className="text-[13px] text-[#8a8a94]">Fan-made · tidak berafiliasi dengan JKT48 Operation Team</p>
          <Link to="/" className="text-[13px] font-semibold text-[#5c5c66] hover:text-[#0b0b0f]">Buka versi web →</Link>
        </div>
      </footer>
    </div>
  );
}

/* ───────────────────────────── Panduan ───────────────────────────── */

type Step = { t: string; d: ReactNode };

const ANDROID_STEPS: Step[] = [
  { t: "Unduh APK", d: "Ketuk Unduh APK. Filenya kecil (±2,5 MB) dan diambil langsung dari GitHub Releases." },
  {
    t: "Izinkan pemasangan",
    d: (
      <>
        Buka <b>jkt48connect.apk</b> dari notifikasi unduhan atau aplikasi File. Bila muncul peringatan aplikasi tak dikenal, ketuk <b>Setelan</b> → aktifkan <b>Izinkan dari sumber ini</b> untuk browser/file manager, lalu kembali.
      </>
    ),
  },
  { t: "Pasang", d: <>Ketuk <b>Pasang</b>. Kalau Play Protect bertanya, pilih <b>Detail lainnya → Tetap pasang</b>. Aplikasi tidak meminta akun, kontak, atau lokasi.</> },
  { t: "Izinkan notifikasi", d: "Saat pertama dibuka, izinkan notifikasi (Android 13+) supaya kamu tahu begitu member mulai live, show akan mulai, ulang tahun, dan berita baru." },
  { t: "Update otomatis", d: <>Versi baru muncul sebagai pop-up di aplikasi. Ketuk <b>Update sekarang</b>: terpasang di atas versi lama, data &amp; oshi tetap ada.</> },
];

const ANDROID_TIPS: Step[] = [
  { t: "Notifikasi live telat?", d: <>Pengaturan → Aplikasi → JKT48Connect → Baterai → <b>Tidak dibatasi</b>. Xiaomi/Redmi/POCO: aktifkan <b>Mulai otomatis</b>. Oppo/realme/vivo: izinkan berjalan di latar. Samsung: keluarkan dari <b>Aplikasi tidur</b>.</> },
  { t: "“Aplikasi tidak terpasang”", d: "Biasanya karena versi lama di HP ditandatangani kunci yang berbeda (rilis paling awal). Hapus versi lama sekali, lalu pasang lagi. Setelah itu update berikutnya langsung terpasang di atasnya." },
  { t: "“Ada masalah saat mengurai paket”", d: "Unduhan belum selesai atau Android di bawah 8.0. Unduh ulang APK dari halaman ini sampai selesai." },
  { t: "Update di aplikasi gagal", d: "Unduh APK terbaru langsung dari halaman ini lalu pasang di atas versi lama. Datamu tidak hilang." },
];

type Method = { id: string; name: string; tag: string; steps: Step[]; action?: { label: string; href: string } };

const IOS_METHODS: Method[] = [
  {
    id: "scarlet",
    name: "Scarlet",
    tag: "Paling mudah · tanpa PC",
    steps: [
      { t: "Pasang Scarlet", d: <>Buka situs resmi Scarlet (<b>usescarlet.com</b>) di Safari, lalu pasang Scarlet dari sana.</> },
      { t: "Percayai profil", d: <>Pengaturan → Umum → <b>VPN &amp; Manajemen Perangkat</b> → ketuk profil Scarlet → <b>Percayai</b>.</> },
      { t: "Mode Pengembang", d: <>iOS 16 ke atas: Pengaturan → Privasi &amp; Keamanan → <b>Mode Pengembang</b> → aktifkan. iPhone akan mulai ulang.</> },
      { t: "Pasang JKT48Connect", d: <>Di Scarlet buka <b>Repos → +</b>, tempel <b>Repo Scarlet</b> di atas, lalu ketuk JKT48Connect → <b>Get</b>. Atau unduh .ipa, buka di aplikasi File, tahan file → <b>Bagikan → Scarlet → Install</b>.</> },
      { t: "Update", d: "Buka repo JKT48Connect di Scarlet dan pasang versi baru di atas versi lama. Data tetap ada." },
    ],
  },
  {
    id: "esign",
    name: "ESign",
    tag: "Tanpa PC · butuh sertifikat",
    steps: [
      { t: "Pasang ESign + sertifikat", d: <>Pasang ESign, lalu impor sertifikat (<b>.p12</b> + <b>.mobileprovision</b> dan kata sandinya): sertifikat developer sendiri atau dari penyedia sertifikat.</> },
      { t: "Tambahkan sumber", d: <>Buka <b>Sources → +</b>, tempel <b>Sumber ESign/Feather/SideStore</b> di atas. Atau unduh .ipa lalu <b>Bagikan → ESign</b>.</> },
      { t: "Tanda tangani & pasang", d: <>Ketuk JKT48Connect → <b>Signature</b> → <b>Install</b>. Bila diminta, percayai profilnya di VPN &amp; Manajemen Perangkat.</> },
    ],
  },
  {
    id: "feather",
    name: "Feather",
    tag: "Tanpa PC · butuh sertifikat",
    action: { label: "Tambahkan sumber ke Feather", href: `feather://source/${IOS_SOURCE}` },
    steps: [
      { t: "Pasang Feather + sertifikat", d: <>Pasang Feather, lalu impor sertifikatmu (<b>.p12</b> + <b>.mobileprovision</b>).</> },
      { t: "Tambahkan sumber", d: <>Ketuk tombol <b>Tambahkan sumber ke Feather</b> di bawah (langsung membuka Feather), atau tempel Sumber di menu Sources. Bisa juga unduh .ipa lalu <b>Bagikan → Feather</b>.</> },
      { t: "Pasang", d: <>Pilih JKT48Connect → <b>Sign</b> → <b>Install</b>.</> },
    ],
  },
  {
    id: "sidestore",
    name: "SideStore",
    tag: "Apple ID sendiri",
    steps: [
      { t: "Pasang SideStore", d: <>Ikuti panduan di <b>sidestore.io</b>. Pemasangan awal SideStore butuh komputer sekali; setelah itu semuanya dari iPhone.</> },
      { t: "Tambahkan sumber", d: <>Buka <b>Sources → +</b>, tempel <b>Sumber ESign/Feather/SideStore</b> di atas, lalu pasang JKT48Connect.</> },
      { t: "Refresh tiap 7 hari", d: "Dengan Apple ID gratis, tanda tangannya berlaku 7 hari. Ketuk Refresh di SideStore sebelum itu (bisa otomatis di latar)." },
    ],
  },
  {
    id: "trollstore",
    name: "TrollStore",
    tag: "iOS tertentu · permanen",
    steps: [
      { t: "Cek dukungan", d: <>TrollStore hanya bisa di versi iOS tertentu (lihat daftar di halaman TrollStore).</> },
      { t: "Pasang", d: <>Unduh .ipa, buka di aplikasi File, tahan file → <b>Bagikan → TrollStore → Install</b>. Terpasang permanen tanpa perlu refresh.</> },
    ],
  },
  {
    id: "pc",
    name: "Dari komputer",
    tag: "Sideloadly",
    steps: [
      { t: "Siapkan Sideloadly", d: <>Pasang <b>Sideloadly</b> (Windows/macOS). Di Windows, pasang juga iTunes &amp; iCloud versi dari situs Apple.</> },
      { t: "Pasang", d: <>Sambungkan iPhone dengan kabel, seret <b>jkt48connect.ipa</b> ke Sideloadly, masukkan Apple ID (boleh gratis), klik <b>Start</b>.</> },
      { t: "Percayai & aktifkan", d: <>Percayai profil di VPN &amp; Manajemen Perangkat dan aktifkan Mode Pengembang. Apple ID gratis: pasang ulang tiap 7 hari.</> },
    ],
  },
];

const IOS_TROUBLE: Step[] = [
  { t: "“Pengembang Tidak Dipercaya”", d: <>Pengaturan → Umum → VPN &amp; Manajemen Perangkat → ketuk profilnya → <b>Percayai</b>.</> },
  { t: "Aplikasi langsung tertutup / “Tidak lagi tersedia”", d: "Sertifikatnya kedaluwarsa atau dicabut Apple. Pasang ulang dari pemasang yang sama setelah sertifikatnya diperbarui, atau pakai cara lain. Data & oshi tetap tersimpan." },
  { t: "Mode Pengembang tidak muncul", d: "Menu itu baru muncul setelah ada aplikasi sideload yang terpasang. Pasang dulu sekali, lalu buka lagi Privasi & Keamanan." },
  { t: ".ipa tidak terunduh", d: <>Di Safari, tahan tombol unduh → <b>Unduh File Tertaut</b>, lalu buka dari aplikasi File (folder Unduhan).</> },
];

/**
 * Panduan lengkap di halaman (tidak perlu membuka GitHub): pilih Android atau iPhone, langkah bernomor, dan
 * solusi masalah. iPhone: tautan tetap (.ipa, repo Scarlet, sumber AltStore) yang bisa disalin, lalu pilihan
 * cara pasang tanpa PC.
 */
function Guide({ tab, onTab, apk, ipa, version, iosVersion }: { tab: "android" | "iphone"; onTab: (t: "android" | "iphone") => void; apk: string; ipa: string; version?: string; iosVersion?: string }) {
  const [method, setMethod] = useState(IOS_METHODS[0].id);
  const m = IOS_METHODS.find((x) => x.id === method) ?? IOS_METHODS[0];
  return (
    <section id="panduan" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 pt-24 md:px-8 md:pt-32">
      <span id="panduan-iphone" className="absolute -top-20" aria-hidden />
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Heading eyebrow="Panduan" title="Cara pasang & update." />
        <Segmented value={tab} onChange={onTab} options={[["android", `Android${version ? ` · v${version}` : ""}`], ["iphone", `iPhone${iosVersion ? ` · v${iosVersion}` : ""}`]]} />
      </div>

      {tab === "android" ? (
        <div className="pt-10">
          <Steps steps={ANDROID_STEPS} />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a href={apk} className="inline-flex items-center gap-2 rounded-full bg-[#0b0b0f] px-6 py-3.5 text-[15px] font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-95">
              Unduh APK{version ? ` v${version}` : ""} <IconArrow />
            </a>
            <span className="text-[13px] text-[#8a8a94]">Gratis · tanpa akun · tanpa iklan</span>
          </div>
          <SubHead label="Kalau ada masalah" />
          <Faqish items={ANDROID_TIPS} />
        </div>
      ) : (
        <div className="pt-10">
          <p className="max-w-2xl text-[16px] leading-relaxed text-[#5c5c66]">
            JKT48Connect belum ada di App Store, jadi dipasang lewat <b className="text-[#0b0b0f]">sideload</b>. Scarlet, ESign, dan Feather bisa langsung dari iPhone, tanpa PC dan tanpa kabel. Tautan berikut selalu menunjuk versi terbaru.
          </p>
          <div className="mt-6 overflow-hidden rounded-3xl border border-[#e8e8ec]">
            <CopyRow label="File aplikasi (.ipa)" value={ipa} href={ipa} />
            <CopyRow label="Repo Scarlet" value={IOS_SCARLET} />
            <CopyRow label="Sumber ESign / Feather / SideStore / AltStore" value={IOS_SOURCE} />
          </div>

          <SubHead label="Pilih cara pasang" />
          <div role="tablist" aria-label="Cara pasang" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 md:flex-wrap md:overflow-visible">
            {IOS_METHODS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={method === x.id}
                onClick={() => setMethod(x.id)}
                className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition-colors ${method === x.id ? "border-[#0b0b0f] bg-[#0b0b0f] text-white" : "border-[#e8e8ec] hover:border-[#c9c9d0]"}`}
              >
                <span className="block text-[15px] font-bold tracking-[-0.01em]">{x.name}</span>
                <span className={`block text-[12px] ${method === x.id ? "text-white/65" : "text-[#8a8a94]"}`}>{x.tag}</span>
              </button>
            ))}
          </div>
          <div className="pt-5">
            <Steps steps={m.steps} />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {m.action && (
                <a href={m.action.href} className="inline-flex items-center gap-2 rounded-full border border-[#0b0b0f] px-5 py-3 text-[15px] font-bold transition-transform hover:-translate-y-0.5 active:scale-95">
                  {m.action.label} <IconArrow />
                </a>
              )}
              <a href={ipa} className="inline-flex items-center gap-2 rounded-full bg-[#0b0b0f] px-5 py-3 text-[15px] font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-95">
                Unduh .ipa{iosVersion ? ` v${iosVersion}` : ""} <IconArrow />
              </a>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-[#f1d58a] bg-[#fff8e1] p-6 text-[15px] leading-relaxed text-[#5a4300]">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-[#9a6b00]">Penting soal sertifikat</p>
            iPhone hanya menjalankan aplikasi yang ditandatangani sertifikat Apple. Scarlet memakai sertifikat bersama milik layanannya; ESign dan Feather memakai sertifikat yang kamu impor. Apple kadang mencabut sertifikat bersama: kalau itu terjadi, JKT48Connect (dan aplikasi lain dari pemasang yang sama) tidak bisa dibuka sampai dipasang ulang setelah sertifikatnya diperbarui. Data dan oshi tetap tersimpan. Aplikasi ini tidak meminta login atau izin khusus.
          </div>

          <SubHead label="Kalau ada masalah" />
          <Faqish items={IOS_TROUBLE} />
        </div>
      )}
    </section>
  );
}

function SubHead({ label }: { label: string }) {
  return <p className="mb-5 mt-14 text-[13px] font-bold uppercase tracking-[0.08em] text-[#8a8a94]">{label}</p>;
}

/** Langkah bernomor dalam kartu, 1–3 kolom. */
function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.t} className="rounded-3xl border border-[#e8e8ec] bg-white p-6">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fdecee] text-[14px] font-bold text-[#e1243a]">{i + 1}</span>
          <p className="mt-4 text-[17px] font-bold tracking-[-0.02em]">{s.t}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[#5c5c66]">{s.d}</p>
        </li>
      ))}
    </ol>
  );
}

/** Daftar masalah → solusi (selalu terbuka, mudah dipindai). */
function Faqish({ items }: { items: Step[] }) {
  return (
    <dl className="grid gap-x-12 gap-y-7 md:grid-cols-2">
      {items.map((x) => (
        <div key={x.t}>
          <dt className="text-[16px] font-bold tracking-[-0.01em]">{x.t}</dt>
          <dd className="mt-1.5 text-[15px] leading-relaxed text-[#5c5c66]">{x.d}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Baris tautan dengan tombol salin (dan unduh bila `href`). */
function CopyRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const t = document.createElement("textarea");
      t.value = value;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  };
  return (
    <div className="flex flex-col gap-3 border-t border-[#e8e8ec] p-5 first:border-t-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#8a8a94]">{label}</p>
        <p className="mt-1 truncate font-mono text-[13px] text-[#0b0b0f]">{value}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {href && (
          <a href={href} className="rounded-full border border-[#e8e8ec] px-4 py-2 text-[13px] font-bold hover:border-[#c9c9d0]">
            Unduh
          </a>
        )}
        <button type="button" onClick={copy} className={`rounded-full px-4 py-2 text-[13px] font-bold text-white transition-colors ${done ? "bg-[#1f8a4c]" : "bg-[#0b0b0f]"}`}>
          {done ? "Tersalin ✓" : "Salin"}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────── Komponen ───────────────────────────── */

/** Bilah atas: logo, tautan bagian, tombol unduh; putih tembus pandang dengan garis rambut. */
function TopBar({ apk }: { apk: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e8e8ec]/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-8">
        <Link to="/" aria-label="JKT48Connect" className="mr-auto">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-[14px] font-semibold text-[#5c5c66] md:flex">
          <a href="#fitur" className="hover:text-[#0b0b0f]">Fitur</a>
          <a href="#galeri" className="hover:text-[#0b0b0f]">Galeri</a>
          <a href="#unduh" className="hover:text-[#0b0b0f]">Unduh</a>
          <a href="#panduan" className="hover:text-[#0b0b0f]">Panduan</a>
          <a href="#faq" className="hover:text-[#0b0b0f]">FAQ</a>
        </nav>
        <a href={apk} className="inline-flex items-center gap-1.5 rounded-full bg-[#0b0b0f] px-4 py-2 text-[14px] font-bold text-white transition-transform active:scale-95">
          Unduh <IconArrow />
        </a>
      </div>
    </header>
  );
}

const PIXELS: [number, number][] = [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [2, 4]];

/** Logo salib piksel JKT48Connect (sama dengan ikon aplikasi) + nama. */
function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#e1243a] shadow-[0_4px_12px_rgba(225,36,58,0.35)]">
        <svg viewBox="0 0 5 5" className="h-[18px] w-[18px]" aria-hidden>
          {PIXELS.map(([x, y]) => (
            <rect key={`${x}${y}`} x={x + 0.06} y={y + 0.06} width={0.88} height={0.88} rx={0.16} fill="#fff" />
          ))}
        </svg>
      </span>
      <span className="text-[18px] font-extrabold tracking-[-0.03em]">JKT48Connect</span>
    </span>
  );
}

function StoreButton({ href, label, sub, icon, dark, onClick }: { href: string; label: string; sub: string; icon: ReactNode; dark?: boolean; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`inline-flex items-center gap-3 rounded-2xl px-5 py-3 transition-transform hover:-translate-y-0.5 active:scale-[0.97] ${dark ? "bg-[#0b0b0f] text-white shadow-[0_10px_24px_rgba(11,11,15,0.22)]" : "border border-[#d9d9de] bg-white text-[#0b0b0f]"}`}
    >
      <span className={dark ? "text-white" : "text-[#0b0b0f]"}>{icon}</span>
      <span className="text-left leading-tight">
        <span className="block text-[15px] font-bold">{label}</span>
        <span className={`block text-[12px] ${dark ? "text-white/60" : "text-[#8a8a94]"}`}>{sub}</span>
      </span>
    </a>
  );
}

/** Mockup HP dari CSS: iPhone dengan Dynamic Island, Android dengan kamera punch-hole. */
function Phone({ src, alt, ios }: { src: string; alt: string; ios?: boolean }) {
  return (
    <div className={`relative bg-[#16161a] p-[3.2%] shadow-[0_30px_60px_-20px_rgba(11,11,15,0.35),0_0_0_1px_rgba(255,255,255,0.06)_inset] ${ios ? "rounded-[17%/8%]" : "rounded-[14%/6.6%]"}`}>
      <div className={`relative overflow-hidden bg-[#f2f2f7] ${ios ? "rounded-[14.5%/6.8%]" : "rounded-[11.5%/5.4%]"}`}>
        <img src={src} alt={alt} width={540} height={ios ? 1174 : 1170} loading="lazy" className="block h-auto w-full" />
        {ios ? (
          <span aria-hidden className="absolute left-1/2 top-[1.6%] h-[3.2%] w-[30%] -translate-x-1/2 rounded-full bg-[#0b0b0f]" />
        ) : (
          <span aria-hidden className="absolute left-1/2 top-[1.4%] h-[2.2%] w-[4.6%] -translate-x-1/2 rounded-full bg-[#0b0b0f]" />
        )}
      </div>
    </div>
  );
}

/** Kartu notifikasi seperti di layar kunci. */
function Notice({ title, body, img }: { title: string; body: string; img?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/85 p-3 pr-4 shadow-[0_16px_40px_rgba(11,11,15,0.16)] backdrop-blur-xl">
      <span className="relative shrink-0">
        {img ? (
          <img src={img} alt="" className="h-11 w-11 rounded-xl object-cover object-top" />
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e1243a] text-white"><IconSignal /></span>
        )}
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-md bg-[#e1243a] ring-2 ring-white">
          <svg viewBox="0 0 5 5" className="h-3 w-3" aria-hidden>
            {PIXELS.map(([x, y]) => (
              <rect key={`${x}${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.16} fill="#fff" />
            ))}
          </svg>
        </span>
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8a8a94]">
          JKT48Connect <span className="font-normal normal-case tracking-normal">· baru saja</span>
        </span>
        <span className="block truncate text-[14px] font-bold">{title}</span>
        <span className="block truncate text-[13px] text-[#5c5c66]">{body}</span>
      </span>
    </div>
  );
}

function TodayCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-[#e8e8ec] p-6 last:border-b-0 sm:p-7 md:border-b-0">
      <p className="mb-4 text-[13px] font-semibold text-[#8a8a94]">{label}</p>
      {children}
    </div>
  );
}

function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div data-in>
      <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#e1243a]">{eyebrow}</p>
      <h2 className="mt-3 max-w-2xl text-[clamp(2.1rem,4.4vw,3.4rem)] font-extrabold leading-[1.02] tracking-[-0.04em]">{title}</h2>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="tablist" className="inline-flex rounded-full border border-[#e8e8ec] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`rounded-full px-4 py-2 text-[14px] font-bold transition-colors ${value === v ? "bg-[#0b0b0f] text-white" : "text-[#5c5c66] hover:text-[#0b0b0f]"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Meta({ k, v, dark }: { k: string; v: string; dark?: boolean }) {
  return (
    <div>
      <dt className={`text-[12px] font-semibold ${dark ? "text-white/50" : "text-[#8a8a94]"}`}>{k}</dt>
      <dd className="mt-1 text-[18px] font-extrabold tracking-[-0.02em]">{v}</dd>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 text-[#0b0b0f] hover:text-[#e1243a]">
      {children} <IconArrow />
    </a>
  );
}

function FaqItem({ q: question, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-4 py-5 text-left">
        <span className="flex-1 text-[17px] font-bold tracking-[-0.015em]">{question}</span>
        <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#e8e8ec] text-[16px] transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <p className="max-w-xl pb-6 text-[15px] leading-relaxed text-[#5c5c66]">{a}</p>
        </div>
      </div>
    </div>
  );
}

/* Ikon garis sederhana (24×24, stroke 2). */
const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function IconArrow() {
  return (
    <svg {...svgProps} className="h-4 w-4">
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg {...svgProps} className="mt-0.5 h-5 w-5 shrink-0" style={{ color: BRAND }}>
      <circle cx="12" cy="12" r="10" strokeWidth={1.6} opacity={0.25} />
      <path d="M8 12.5l2.6 2.6L16 9.7" />
    </svg>
  );
}
function IconAndroidPhone() {
  return (
    <svg {...svgProps} className="h-6 w-6">
      <rect x="6" y="2.5" width="12" height="19" rx="2.6" />
      <circle cx="12" cy="5.6" r="0.6" fill="currentColor" />
      <path d="M12 9.5v6M9.5 13l2.5 2.5 2.5-2.5" />
    </svg>
  );
}
function IconWindows() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M3 5.6 10.4 4.6v7H3zM11.4 4.4 21 3v8.6h-9.6zM3 12.6h7.4v7L3 18.5zM11.4 12.6H21V21l-9.6-1.4z" />
    </svg>
  );
}

function IconIphone() {
  return (
    <svg {...svgProps} className="h-6 w-6">
      <rect x="6" y="2.5" width="12" height="19" rx="3.2" />
      <path d="M10.4 5h3.2" />
      <path d="M12 9.5v6M9.5 13l2.5 2.5 2.5-2.5" />
    </svg>
  );
}
function IconSignal() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <path d="M5 18v-3M9.5 18v-6M14 18V9M18.5 18V6" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <rect x="2.5" y="5" width="19" height="14" rx="3.5" />
      <path d="M10.2 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />
    </svg>
  );
}
function IconGlass() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <rect x="3" y="6" width="18" height="12" rx="6" />
      <path d="M7.5 10.5c.6-1 1.6-1.5 2.8-1.5" opacity={0.6} />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <path d="M20 11a8 8 0 0 0-14.3-4.7L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.7L20 16M20 20v-4h-4" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />
    </svg>
  );
}
