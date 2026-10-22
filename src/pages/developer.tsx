import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BarChart3, Bell, Bot, Check, Copy, KeyRound, LayoutDashboard, Server, Terminal } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { PixelCross } from "@/components/logo";
import { CountUp, SignalBars, SplitText } from "@/components/motion";
import { Page } from "@/components/page";
import { SectionHead, Segmented, cx } from "@/components/ui";
import { gsap } from "@/lib/gsap";
import { q } from "@/lib/queries";

const BASE = "https://api.jkt48connect.app";
const DOCS = `${BASE}/docs`;
const KEYS = `${BASE}/dashboard/keys`;

/** Endpoint yang dipakai situs ini, sesuai docs api.jkt48connect.app. */
const ENDPOINTS: { path: string; desc: string; to: string; page: string }[] = [
  { path: "/api/now_live?group=jkt48", desc: "Member yang sedang live di Showroom dan IDN, lengkap dengan kartu notifikasi bertema jkt48connect.", to: "/live", page: "Live" },
  { path: "/api/theater", desc: "Daftar show theater dengan paginasi, plus detail per show: lineup, seitansai, setlist, dan rekaman.", to: "/theater", page: "Theater" },
  { path: "/api/next_schedule", desc: "Jadwal mendatang: show, event exclusive, dan event umum, beserta desain poster jadwal.", to: "/schedule", page: "Jadwal" },
  { path: "/api/member", desc: "Direktori member aktif dan graduated, dengan profil, sosial media, dan riwayat show.", to: "/member", page: "Member" },
  { path: "/api/next_birthday", desc: "Ulang tahun member terdekat beserta umurnya.", to: "/birthday", page: "Birthday" },
  { path: "/api/recent", desc: "Rekap live yang sudah selesai: durasi, penonton, gift, top supporter, cuplikan, dan rekaman.", to: "/recent", page: "Recent" },
  { path: "/api/news", desc: "Berita dan pengumuman resmi, lengkap dengan isi artikel.", to: "/news", page: "Berita" },
  { path: "/api/jkt48_youtube", desc: "Upload terbaru dari kanal YouTube JKT48 dan JKT48 TV.", to: "/video", page: "Video" },
];

const SNIPPETS = {
  curl: `curl "${BASE}/api/now_live?group=jkt48" \\
  -H "X-API-Key: $JKT48CONNECT_API_KEY"`,
  js: `// Jalankan di server (Node, Worker, bot), bukan di browser.
const res = await fetch("${BASE}/api/next_schedule", {
  headers: { "X-API-Key": process.env.JKT48CONNECT_API_KEY },
});
const jadwal = await res.json();`,
  python: `import os, requests

res = requests.get(
    "${BASE}/api/member",
    headers={"X-API-Key": os.environ["JKT48CONNECT_API_KEY"]},
)
member = res.json()`,
} as const;
type Lang = keyof typeof SNIPPETS;
const LANGS = [
  { id: "curl", label: "cURL" },
  { id: "js", label: "JavaScript" },
  { id: "python", label: "Python" },
] as const;

const STEPS = [
  { icon: KeyRound, title: "Ambil API key", body: "Masuk ke dashboard api.jkt48connect.app dan buat key baru. Formatnya diawali jkc_." },
  { icon: Terminal, title: "Kirim header X-API-Key", body: "Sertakan key di header setiap request ke api.jkt48connect.app, lalu baca respons JSON-nya." },
  { icon: Server, title: "Simpan key di server", body: "Jangan taruh key di JavaScript browser. Panggil API dari server, Worker, atau bot, seperti situs ini lewat proxy-nya." },
];

const IDEAS = [
  { icon: Bot, title: "Bot komunitas", body: "Notifikasi live dan jadwal theater untuk server Discord, grup, atau akun X fanbase." },
  { icon: Bell, title: "Pengingat oshi", body: "Kabari saat oshi mulai live, tampil di theater, atau berulang tahun." },
  { icon: LayoutDashboard, title: "Widget & situs", body: "Pasang jadwal, daftar live, atau poster show di situs dan aplikasimu sendiri." },
  { icon: BarChart3, title: "Statistik & riset", body: "Olah rekap live, penonton, dan gift untuk grafik atau analisis fanbase." },
];

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      aria-label={done ? "Tersalin" : "Salin"}
      className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold transition", className)}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Tersalin" : "Salin"}
    </button>
  );
}

/** Terminal yang "mengetik" request contoh; angkanya diambil dari data API yang sedang tampil di situs ini. */
function LiveTerminal() {
  const root = useRef<HTMLDivElement>(null);
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const members = useQuery(q.members());
  const ready = live.isSuccess && next.isSuccess && members.isSuccess;

  const lines: { cmd: string; out: string }[] = [
    { cmd: "GET /api/now_live?group=jkt48", out: `${live.data?.length ?? "…"} member sedang live` },
    { cmd: "GET /api/next_schedule", out: `${next.data?.length ?? "…"} jadwal mendatang` },
    { cmd: "GET /api/member", out: `${members.data?.filter((m) => !m.isGraduate).length ?? "…"} member aktif` },
  ];

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !ready) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.3 });
      gsap.utils.toArray<HTMLElement>("[data-tl]").forEach((row) => {
        const cmd = row.querySelector("[data-cmd]");
        const out = row.querySelector("[data-out]");
        const n = cmd?.textContent?.length ?? 20;
        tl.fromTo(cmd, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: n * 0.025, ease: `steps(${n})` })
          .fromTo(out, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.3 }, "+=0.15");
      });
    }, el);
    return () => ctx.revert();
  }, [ready]);

  return (
    <div ref={root} className="overflow-hidden rounded-3xl bg-nav text-white shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-brand" />
        <span className="h-2.5 w-2.5 rounded-full bg-butter" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
        <span className="ml-3 font-mono text-[11px] text-white/50">api.jkt48connect.app</span>
        <SignalBars className="ml-auto text-brand" />
      </div>
      <div className="space-y-4 p-5 font-mono text-[12.5px] leading-relaxed sm:p-6 sm:text-[13px]">
        <p className="text-white/40"># angka di bawah diambil dari API saat halaman ini dibuka</p>
        {lines.map((l) => (
          <div key={l.cmd} data-tl>
            <p data-cmd className="whitespace-nowrap">
              <span className="text-brand">$</span> <span className="text-butter">curl</span> {l.cmd}
            </p>
            <p data-out className="mt-1 text-white/75">
              <span className="text-[#7ee2a8]">200 OK</span> → {l.out}
            </p>
          </div>
        ))}
        <p className="flex items-center gap-1 text-white/40">
          <span className="text-brand">$</span>
          <span className="inline-block h-4 w-2 animate-pulse bg-white/70" />
        </p>
      </div>
    </div>
  );
}

export function DeveloperPage() {
  const [lang, setLang] = useState<Lang>("curl");
  const members = useQuery(q.members());
  const next = useQuery(q.nextSchedule());
  const live = useQuery(q.live());
  const recent = useQuery(q.recentList(1, 1));

  const stats = [
    { label: "Member aktif", value: members.data?.filter((m) => !m.isGraduate).length ?? 0 },
    { label: "Jadwal mendatang", value: next.data?.length ?? 0 },
    { label: "Sedang live", value: live.data?.length ?? 0 },
    { label: "Live tercatat", value: recent.data?.total ?? 0 },
  ];

  return (
    <Page deps={[members.data, next.data, live.data, recent.data]}>
      {/* Hero */}
      <section className="container-x grid items-center gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div data-reveal>
          <p className="micro mb-3 flex items-center gap-2 text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Public API · layanan JKT48Connect
          </p>
          <h1 className="condensed text-[clamp(2.75rem,7vw,5rem)] uppercase leading-[0.88]">
            <SplitText text="Pakai data ini" />
            <br />
            <span className="text-brand">
              <SplitText text="di proyekmu" />
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-soft">
            Semua yang tampil di situs ini, dari live, theater, member, birthday, rekap live, sampai berita, berasal dari{" "}
            <b className="text-ink">api.jkt48connect.app</b>. API ini layanan dari JKT48Connect dan terbuka juga untuk developer
            lain: bot, aplikasi, widget, atau situs fanbase.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-4 pr-1 font-mono text-[13px]">
              {BASE}
              <CopyButton text={BASE} className="bg-surface text-ink hover:bg-blush hover:text-brand" />
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={DOCS} target="_blank" rel="noreferrer" className="btn btn-primary group">
              Baca dokumentasi
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <a href={KEYS} target="_blank" rel="noreferrer" className="btn btn-ghost group">
              Ambil API key
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
        <div data-reveal>
          <LiveTerminal />
        </div>
      </section>

      {/* Angka hidup */}
      <section className="container-x pt-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} data-reveal className={i === 0 ? "rounded-2xl bg-brand p-4 text-white" : "panel p-4"}>
              <p className={i === 0 ? "micro text-white/80" : "micro text-ink-soft"}>{s.label}</p>
              <p className="condensed mt-2 text-[36px] leading-none">
                <CountUp value={s.value} />
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-soft">Data hidup dari API yang sama, diperbarui otomatis.</p>
      </section>

      {/* Endpoint */}
      <section className="container-x pt-14">
        <SectionHead label="Yang dipakai situs ini" title="Endpoint" count={ENDPOINTS.length} />
        <div className="grid gap-3 md:grid-cols-2">
          {ENDPOINTS.map((e) => (
            <div key={e.path} data-reveal className="panel group flex flex-col p-5 transition-colors hover:border-brand">
              <p className="flex items-center gap-2 font-mono text-[13px]">
                <span className="pill bg-brand text-white">GET</span>
                <span className="truncate font-semibold">{e.path}</span>
              </p>
              <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-soft">{e.desc}</p>
              <Link to={e.to} className="link-more mt-4 inline-flex items-center gap-1.5">
                Lihat di halaman {e.page} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-ink-soft">
          Daftar lengkap endpoint, parameter, dan contoh respons ada di{" "}
          <a href={DOCS} target="_blank" rel="noreferrer" className="font-semibold text-brand underline-offset-4 hover:underline">
            dokumentasi
          </a>
          .
        </p>
      </section>

      {/* Langkah + kode */}
      <section className="container-x grid gap-10 pt-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <SectionHead label="Mulai" title="Tiga langkah" />
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} data-reveal className="panel flex gap-4 p-5">
                <span className="condensed text-[44px] leading-none text-brand">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="flex items-center gap-2 font-extrabold">
                    <s.icon className="h-4 w-4 text-brand" /> {s.title}
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div data-reveal className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="micro mb-1.5 text-ink-soft">Contoh request</p>
              <h2 className="condensed text-[30px] uppercase leading-none">Kode</h2>
            </div>
            <Segmented value={lang} options={LANGS} onChange={setLang} />
          </div>
          <div className="overflow-hidden rounded-3xl bg-nav text-white">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-2.5">
              <span className="font-mono text-[11px] text-white/50">{LANGS.find((l) => l.id === lang)?.label}</span>
              <CopyButton text={SNIPPETS[lang]} className="bg-white/10 text-white hover:bg-white/20" />
            </div>
            <pre key={lang} className="thin-scrollbar overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-white/90">
              <code>{SNIPPETS[lang]}</code>
            </pre>
          </div>
          <p className="mt-3 text-[13px] text-ink-soft">
            Simpan key di variabel lingkungan <code className="font-mono text-ink">JKT48CONNECT_API_KEY</code>. Situs ini juga begitu:
            browser hanya memanggil server situs, lalu server yang menambahkan key.
          </p>
        </div>
      </section>

      {/* Ide */}
      <section className="container-x pt-14">
        <SectionHead label="Inspirasi" title="Bisa dipakai untuk" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {IDEAS.map((idea) => (
            <div key={idea.title} data-reveal className="panel p-5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blush text-brand">
                <idea.icon className="h-5 w-5" />
              </span>
              <p className="mt-4 font-extrabold">{idea.title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{idea.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ajakan */}
      <section className="container-x pt-14">
        <div data-reveal className="relative overflow-hidden rounded-3xl bg-brand p-7 text-white sm:p-10">
          <PixelCross className="absolute -right-8 -top-8 h-44 w-44 opacity-15" cellClass="fill-white" />
          <p className="micro text-white/80">JKT48Connect API</p>
          <p className="condensed mt-3 max-w-2xl text-[clamp(2rem,5vw,3.25rem)] uppercase leading-[0.9]">Siap bikin sesuatu untuk sesama fans?</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={DOCS} target="_blank" rel="noreferrer" className="btn bg-white text-brand hover:bg-butter">
              Buka dokumentasi <ArrowUpRight className="h-4 w-4" />
            </a>
            <a href={KEYS} target="_blank" rel="noreferrer" className="btn bg-white/15 text-white hover:bg-white/25">
              Dashboard API key <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </Page>
  );
}
