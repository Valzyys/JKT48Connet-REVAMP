import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpRight, Moon, Sun } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Glass } from "@/components/liquid-glass";
import { PixelCross } from "@/components/logo";
import { Countdown } from "@/components/countdown";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useTheme } from "@/hooks/use-theme";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { timeAgo } from "@/lib/format";
import { getAppRelease, type AppRelease } from "@/lib/jkt48";
import { q } from "@/lib/queries";
import { STATIC_PAGES } from "@/lib/seo";
import type { Member } from "@/lib/shape";

/** APK selalu bernama sama di setiap rilis, jadi tautan "latest" GitHub selalu menuju versi terbaru. */
const LATEST_APK = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/latest/download/jkt48connect.apk";
const RELEASES = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases";
const GITHUB_STAR = "https://github.com/JKT48Connect/JKT48Connect-APP";
const REVIEW_INTENT = `https://x.com/intent/post?text=${encodeURIComponent("Pakai aplikasi JKT48Connect buat pantau live, jadwal theater & recent member JKT48. Menurutku: ")}&url=${encodeURIComponent("https://jkt48connect.app/apps")}&hashtags=JKT48ConnectApp`;
const REVIEW_SEARCH = "https://x.com/search?q=%23JKT48ConnectApp&f=live";

const SCREENS = [
  { src: "/apps/home.webp", title: "Beranda", text: "Siapa yang sedang live dan hitung mundur show berikutnya, dalam satu kartu." },
  { src: "/apps/sosmed.webp", title: "Sosmed member", text: "Posting X, TikTok, dan Instagram member, lengkap dengan tombol unduh." },
  { src: "/apps/video.webp", title: "Video YouTube", text: "Video JKT48 & JKT48 TV diputar langsung di aplikasi." },
  { src: "/apps/recent.webp", title: "Recent", text: "Rekap live: durasi, penonton, gift, top supporter, dan replay." },
  { src: "/apps/member.webp", title: "Member", text: "Direktori member dengan pencarian dan daftar oshi favorit." },
  { src: "/apps/home-dark.webp", title: "Tema gelap", text: "Ikut tema sistem, atau pilih terang / gelap sendiri." },
];

const DETAILS = [
  ["Notifikasi per jenis", "Live, show yang segera mulai, ulang tahun member, berita baru. Nyalakan yang kamu mau saja."],
  ["Replay di Recent", "Live yang sudah selesai bisa diputar ulang, lengkap dengan gift dan top supporter."],
  ["Unduh foto & video", "Dari posting X, TikTok, dan Instagram member. Tersimpan di folder Download/JKT48Connect."],
  ["YouTube di dalam aplikasi", "Pilih kualitas, baca komentar, tanpa pindah ke aplikasi YouTube."],
  ["Oshi favorit", "Tandai member favorit, beranda dan notifikasi mendahulukan mereka."],
  ["Update tanpa hapus", "Versi baru muncul di aplikasi dan terpasang di atas versi lama. Data tetap ada."],
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

function fmtDate(iso?: string) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";
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
  const { dark, toggle } = useTheme();
  const release = useQuery({ queryKey: ["app-release"], queryFn: getAppRelease, staleTime: 10 * 60_000, retry: 1 });
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const members = useQuery(q.members());
  const birthdays = useQuery(q.birthdays());
  const apk = release.data?.apk || LATEST_APK;
  const version = release.data?.version;
  const size = fmtSize(release.data?.size);
  const summary = releaseSummary(release.data);
  const liveList = live.data ?? [];
  const show = next.data?.find((s) => s.category === "show") ?? next.data?.[0];
  const faces = (members.data ?? []).filter((m) => !m.isGraduate && m.img);

  // Animasi halaman (GSAP): intro hero, kartu melayang, parallax ponsel, reveal per bagian, galeri yang dipin.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduce) return;
      gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .from("[data-hero-in]", { y: 36, opacity: 0, duration: 1, stagger: 0.08 })
        .from("[data-phone]", { y: 100, rotate: 6, opacity: 0, duration: 1.3, ease: "expo.out" }, 0.1)
        .from("[data-float]", { scale: 0.7, opacity: 0, duration: 1, stagger: 0.15, ease: "elastic.out(1, 0.6)" }, 0.7);

      gsap.utils.toArray<HTMLElement>("[data-float]").forEach((f, i) => {
        gsap.to(f, { y: i % 2 ? 12 : -12, duration: 3.4 + i * 0.7, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.6 });
      });
      gsap.to("[data-phone]", { yPercent: -10, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true } });

      gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((box) => {
        gsap.set(box.children, { opacity: 0, y: 28 });
        ScrollTrigger.create({
          trigger: box,
          start: "top 88%",
          once: true,
          onEnter: () => gsap.to(box.children, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: "power3.out", clearProps: "opacity,transform" }),
        });
      });

      // Galeri layar: dipin & digeser horizontal saat menggulir (desktop); di HP cukup geser biasa.
      gsap.matchMedia().add("(min-width: 900px)", () => {
        const track = el.querySelector<HTMLElement>("[data-track]");
        const pin = el.querySelector<HTMLElement>("[data-gallery]");
        if (!track || !pin) return;
        const distance = () => track.scrollWidth - pin.clientWidth + 48;
        const st = { trigger: pin, start: "top top", end: () => `+=${distance()}`, scrub: 0.6, invalidateOnRefresh: true };
        gsap.to(track, { x: () => -distance(), ease: "none", scrollTrigger: { ...st, pin: true } });
        gsap.utils.toArray<HTMLElement>("[data-shot]").forEach((s) => gsap.fromTo(s, { rotateY: -16 }, { rotateY: 0, ease: "none", scrollTrigger: st }));
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="relative min-h-screen overflow-x-clip bg-bg text-ink">
      <TopBar apk={apk} dark={dark} onTheme={toggle} />

      {/* ───── Hero: foto member asli di belakang kaca ───── */}
      <section data-hero data-dark className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[#120a0c] pb-16 pt-28 text-white">
        <div aria-hidden className="absolute inset-0 -z-10 opacity-50">
          <PhotoWall faces={faces} rows={5} eager />
        </div>
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#120a0c_0%,rgb(18_10_12/0.82)_55%,rgb(18_10_12/0.35)_100%)] md:bg-[linear-gradient(90deg,#120a0c_0%,#120a0c_30%,rgb(18_10_12/0.55)_58%,rgb(18_10_12/0.15)_100%)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#120a0c] to-transparent" />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 md:grid-cols-[1.1fr_0.9fr] md:px-8">
          <div>
            <p data-hero-in className="font-mono text-[12px] tracking-wide text-white/60">
              Android · {version ? `v${version}` : "versi terbaru"} · {size}
            </p>
            <h1 data-hero-in className="condensed mt-5 text-[clamp(3rem,7vw,5.6rem)] leading-[0.92]">
              Tahu duluan kalau oshi mulai live.
            </h1>
            <p data-hero-in className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-white/75">
              Notifikasi masuk kira-kira 15 detik setelah live IDN atau Showroom dimulai, walau aplikasinya ditutup. Di dalamnya juga ada jadwal theater, recent dan replay, video YouTube, serta posting X, TikTok, dan Instagram member yang bisa diunduh.
            </p>
            <div data-hero-in className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Glass as="a" href={apk} interactive radius={999} bezel={18} strength={40} tint="rgb(225 36 58 / 0.8)" className="inline-flex items-center gap-2.5 px-7 py-4 text-[16px] font-extrabold">
                <ArrowDownToLine className="h-5 w-5" /> Unduh APK
              </Glass>
              <a href={RELEASES} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[15px] font-semibold text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white">
                Semua rilis <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <p data-hero-in className="mt-8 text-[13px] text-white/50">Gratis, tanpa akun, tanpa iklan. Android 8 ke atas.</p>
          </div>

          <div className="relative mx-auto w-full max-w-[290px]">
            <Phone src="/apps/home.webp" alt="Beranda aplikasi JKT48Connect" data-phone />
            {/* Kartu kaca dengan data asli; bisa diseret dan membal kembali. */}
            <Springy className="absolute -left-24 top-16 hidden sm:block">
              <Glass data-float radius={22} bezel={16} strength={34} blur={10} tint="rgb(18 10 12 / 0.5)" className="w-52 p-4">
                <p className="font-mono text-[11px] text-white/70">
                  <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-[#ff4a5f]" />
                  live sekarang
                </p>
                <p className="condensed mt-1 text-[32px] leading-none">{live.data ? `${liveList.length} member` : "…"}</p>
                {liveList.length > 0 && (
                  <div className="mt-2.5 flex -space-x-2">
                    {liveList.slice(0, 5).map((l) => (
                      <img key={l.id} src={l.img || l.avatar} alt={l.name} loading="lazy" draggable={false} className="h-8 w-8 rounded-full border-2 border-white/70 object-cover object-top" />
                    ))}
                  </div>
                )}
              </Glass>
            </Springy>
            {show && (
              <Springy className="absolute -right-16 bottom-28 hidden sm:block">
                <Glass data-float radius={22} bezel={16} strength={34} blur={10} tint="rgb(18 10 12 / 0.5)" className="w-56 p-4">
                  <p className="font-mono text-[11px] text-white/70">show berikutnya</p>
                  <p className="mt-1 truncate text-[16px] font-extrabold">{show.title}</p>
                  <Countdown target={show.date} className="mt-1 block font-mono text-[13px] text-white/85" />
                </Glass>
              </Springy>
            )}
          </div>
        </div>
      </section>

      {/* ───── Data hari ini: isi yang sama dengan yang muncul di aplikasi ───── */}
      <section id="hari-ini" className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="condensed text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[0.95]">Hari ini di aplikasi</h2>
          <p className="font-mono text-[12px] text-ink-soft">data langsung · diperbarui tiap menit</p>
        </div>
        <div data-stagger className="mt-10 grid gap-4 md:grid-cols-3">
          <Panel label="Sedang live">
            {liveList.length ? (
              <ul className="space-y-3">
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
                {liveList.length > 5 && <li className="text-[13px] text-ink-soft">+{liveList.length - 5} member lain</li>}
              </ul>
            ) : (
              <p className="text-[15px] leading-relaxed text-ink-soft">{live.data ? "Belum ada yang live. Begitu ada, aplikasi langsung memberi tahu." : "Memuat…"}</p>
            )}
          </Panel>
          <Panel label="Show berikutnya">
            {show ? (
              <>
                {(show.banner || show.poster) && <img src={show.banner || show.poster} alt="" loading="lazy" className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover" />}
                <p className="text-[18px] font-extrabold leading-tight">{show.title}</p>
                <p className="mt-1 text-[14px] text-ink-soft">{new Date(show.date).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB</p>
                <Countdown target={show.date} className="mt-3 block font-mono text-[14px] font-semibold text-brand" />
                {show.members.length > 0 && (
                  <div className="mt-4 flex items-center">
                    <div className="flex -space-x-2">
                      {show.members.slice(0, 7).map((m) => (
                        <img key={m.id} src={m.img} alt={m.name} title={m.name} loading="lazy" className="h-8 w-8 rounded-full border-2 border-card object-cover object-top" />
                      ))}
                    </div>
                    {show.members.length > 7 && <span className="ml-2 text-[13px] text-ink-soft">+{show.members.length - 7}</span>}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[15px] text-ink-soft">{next.data ? "Belum ada jadwal baru." : "Memuat…"}</p>
            )}
          </Panel>
          <Panel label="Ulang tahun terdekat">
            {birthdays.data?.length ? (
              <ul className="space-y-3">
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
          </Panel>
        </div>
      </section>

      {/* ───── Galeri layar ───── */}
      <section id="isi" data-gallery data-dark className="relative overflow-hidden bg-[#120a0c] py-20 text-white md:h-screen md:py-0">
        <div className="relative flex h-full flex-col justify-center">
          <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-6 px-5 md:px-8">
            <h2 className="condensed text-[clamp(2.4rem,5vw,4rem)] leading-none">Isinya</h2>
            <p className="hidden max-w-xs text-right text-[14px] text-white/55 md:block">Tangkapan layar dari aplikasi versi terbaru, dengan data asli.</p>
          </div>
          <div data-track className="no-scrollbar mt-10 flex snap-x gap-8 overflow-x-auto px-5 pb-6 [perspective:1400px] md:overflow-visible md:px-[max(2rem,calc((100vw-72rem)/2+2rem))]">
            {SCREENS.map((s) => (
              <figure key={s.src} data-shot className="w-[230px] shrink-0 snap-center md:w-[260px]">
                <Phone src={s.src} alt={`Layar ${s.title} aplikasi JKT48Connect`} small />
                <figcaption className="mt-5">
                  <p className="text-[17px] font-extrabold">{s.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-white/60">{s.text}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Detail kecil ───── */}
      <section id="detail" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="condensed text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[0.95]">Hal-hal kecil yang bikin betah</h2>
            <div className="relative mt-10 hidden h-[420px] md:block">
              <div className="absolute left-0 top-0 w-[200px] -rotate-6"><Phone src="/apps/sosmed.webp" alt="Layar sosmed member di aplikasi" small /></div>
              <div className="absolute left-[150px] top-12 w-[200px] rotate-3"><Phone src="/apps/recent.webp" alt="Layar recent di aplikasi" small /></div>
            </div>
          </div>
          <dl data-stagger className="grid gap-x-10 sm:grid-cols-2">
            {DETAILS.map(([t, d]) => (
              <div key={t} className="border-t border-line py-6">
                <dt className="text-[17px] font-extrabold">{t}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ───── Rilis terbaru: panel kaca di atas deretan foto member ───── */}
      <section id="rilis" data-dark className="relative isolate overflow-hidden bg-[#120a0c] py-24 text-white md:py-32">
        <div aria-hidden className="absolute inset-0 -z-10 flex items-center opacity-60">
          <PhotoWall faces={faces} rows={2} big />
        </div>
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <Glass radius={34} bezel={28} strength={44} blur={14} tint="rgb(18 10 12 / 0.55)" className="mx-auto max-w-2xl p-8 md:p-11">
            <p className="font-mono text-[12px] text-white/60">
              Rilis terbaru{release.data?.publishedAt ? ` · ${fmtDate(release.data.publishedAt)}` : ""}
            </p>
            <h2 className="condensed mt-3 text-[clamp(2.4rem,5vw,3.6rem)] leading-none">{version ? `Versi ${version}` : "Versi terbaru"}</h2>
            {summary && <p className="mt-3 text-[17px] text-white/85">{summary}.</p>}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Glass as="a" href={apk} interactive radius={999} bezel={18} strength={40} tint="rgb(225 36 58 / 0.85)" className="inline-flex items-center gap-2.5 px-7 py-4 text-[16px] font-extrabold">
                <ArrowDownToLine className="h-5 w-5" /> Unduh APK · {size}
              </Glass>
              {release.data?.page && (
                <a href={release.data.page} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[15px] font-semibold text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white">
                  Catatan rilis <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>
            <p className="mt-8 border-t border-white/15 pt-6 text-[14px] leading-relaxed text-white/65">
              Pertama kali pasang APK? Buka file yang terunduh, izinkan pemasangan dari browser atau file manager bila diminta, lalu ketuk Pasang. Setelah itu, versi baru muncul sendiri di aplikasi.
            </p>
          </Glass>
        </div>
      </section>

      {/* ───── Ulasan + FAQ ───── */}
      <section id="faq" className="mx-auto grid max-w-6xl gap-16 px-5 py-24 md:grid-cols-[0.8fr_1.2fr] md:px-8 md:py-32">
        <div>
          <h2 className="condensed text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[0.95]">Sudah dipakai?</h2>
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
          <h2 className="condensed text-[clamp(1.8rem,3vw,2.4rem)] leading-none">Pertanyaan</h2>
          <div className="mt-6 border-b border-line">
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

/** Bilah atas kaca yang menempel: logo, tautan bagian, tema, dan tombol unduh. */
function TopBar({ apk, dark, onTheme }: { apk: string; dark: boolean; onTheme: () => void }) {
  // Teks putih saat bilah berada di atas bagian gelap, gelap/ikut tema di bagian terang.
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
          {[["#isi", "Isinya"], ["#detail", "Detail"], ["#rilis", "Rilis"], ["#faq", "FAQ"]].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3 py-2 opacity-75 hover:opacity-100">{label}</a>
          ))}
        </nav>
        <button type="button" onClick={onTheme} aria-label="Ganti tema" className="ml-auto grid h-10 w-10 place-items-center rounded-full opacity-80 hover:opacity-100 md:ml-1">
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <a href={apk} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-[14px] font-extrabold text-white">
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
 * Deretan foto member yang bergerak pelan (baris bergantian arah). Dipakai sebagai latar kaca,
 * supaya pembiasan di tepi kaca memperlihatkan wajah member, bukan gradien kosong.
 */
function PhotoWall({ faces, rows, big, eager }: { faces: Member[]; rows: number; big?: boolean; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const per = Math.max(1, Math.ceil(faces.length / rows));
  useEffect(() => {
    const el = ref.current;
    if (!el || !faces.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tweens = gsap.utils.toArray<HTMLElement>("[data-row]", el).map((row, i) =>
      i % 2
        ? gsap.fromTo(row, { xPercent: -50 }, { xPercent: 0, duration: 90 + i * 10, repeat: -1, ease: "none" })
        : gsap.to(row, { xPercent: -50, duration: 90 + i * 10, repeat: -1, ease: "none" }),
    );
    return () => tweens.forEach((t) => t.kill());
  }, [faces.length]);
  if (!faces.length) return null;
  return (
    <div ref={ref} className={`flex h-full w-full flex-col justify-center ${big ? "gap-5" : "gap-4"}`}>
      {Array.from({ length: rows }, (_, r) => {
        const row = faces.slice(r * per, r * per + per);
        return (
          <div key={r} data-row className={`flex w-max ${big ? "gap-5" : "gap-4"}`}>
            {[...row, ...row].map((m, i) => (
              <img
                key={`${m.id}-${i}`}
                src={m.img}
                alt=""
                loading={eager ? "eager" : "lazy"}
                draggable={false}
                className={`${big ? "h-56 w-44 rounded-[1.6rem]" : "h-40 w-32 rounded-[1.3rem]"} shrink-0 object-cover object-top`}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Bungkus yang bisa diseret: meregang mengikuti kecepatan, lalu membal kembali ke tempatnya saat dilepas. */
function Springy({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let dragging = false;
    let sx = 0, sy = 0, lx = 0, ly = 0, lt = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      el.setPointerCapture(e.pointerId);
      sx = lx = e.clientX;
      sy = ly = e.clientY;
      lt = performance.now();
      gsap.to(el, { scale: 1.05, duration: 0.25 });
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
      const stretch = Math.min(0.2, Math.hypot(vx, vy) * 0.1);
      const horizontal = Math.abs(vx) > Math.abs(vy);
      gsap.to(el, {
        x: e.clientX - sx,
        y: e.clientY - sy,
        scaleX: 1.05 + (horizontal ? stretch : -stretch * 0.6),
        scaleY: 1.05 + (horizontal ? -stretch * 0.6 : stretch),
        duration: 0.18,
        overwrite: "auto",
      });
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      gsap.to(el, { x: 0, y: 0, scaleX: 1, scaleY: 1, scale: 1, duration: 1.2, ease: "elastic.out(1.1, 0.32)" });
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <div ref={ref} className={`z-20 cursor-grab touch-none select-none active:cursor-grabbing ${className ?? ""}`}>
      {children}
    </div>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-line bg-card p-6">
      <p className="mb-5 font-mono text-[12px] text-ink-soft">{label}</p>
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
