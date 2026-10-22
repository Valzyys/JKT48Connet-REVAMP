import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BarChart3, Bell, Bot, Check, Copy, KeyRound, LayoutDashboard, Server, Terminal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PIXELS, PixelCross } from "@/components/logo";
import { CountUp, SignalBars, SplitText, Ticker, Tilt } from "@/components/motion";
import { Page } from "@/components/page";
import { Segmented, cx } from "@/components/ui";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { q } from "@/lib/queries";

const BASE = "https://api.jkt48connect.app";
const DOCS = `${BASE}/docs`;
const KEYS = `${BASE}/dashboard/keys`;

/** Endpoint yang dipakai situs ini, sesuai docs api.jkt48connect.app. */
const ENDPOINTS: { path: string; short: string; desc: string; to: string; page: string }[] = [
  { path: "/api/now_live?group=jkt48", short: "Live", desc: "Member yang sedang live di Showroom dan IDN, lengkap dengan kartu notifikasi bertema jkt48connect.", to: "/live", page: "Live" },
  { path: "/api/theater", short: "Theater", desc: "Daftar show theater dengan paginasi, plus detail per show: lineup, seitansai, setlist, dan rekaman.", to: "/theater", page: "Theater" },
  { path: "/api/next_schedule", short: "Jadwal", desc: "Jadwal mendatang: show, event exclusive, dan event umum, beserta desain poster jadwal.", to: "/schedule", page: "Jadwal" },
  { path: "/api/member", short: "Member", desc: "Direktori member aktif dan graduated, dengan profil, sosial media, dan riwayat show.", to: "/member", page: "Member" },
  { path: "/api/next_birthday", short: "Birthday", desc: "Ulang tahun member terdekat beserta umurnya.", to: "/birthday", page: "Birthday" },
  { path: "/api/recent", short: "Recent", desc: "Rekap live yang sudah selesai: durasi, penonton, gift, top supporter, cuplikan, dan rekaman.", to: "/recent", page: "Recent" },
  { path: "/api/news", short: "Berita", desc: "Berita dan pengumuman resmi, lengkap dengan isi artikel.", to: "/news", page: "Berita" },
  { path: "/api/jkt48_youtube", short: "Video", desc: "Upload terbaru dari kanal YouTube JKT48 dan JKT48 TV.", to: "/video", page: "Video" },
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

/** Angka hidup dari API (lewat proxy situs), dipakai orbit, terminal, dan statistik. */
function useApiNumbers() {
  const live = useQuery(q.live());
  const next = useQuery(q.nextSchedule());
  const members = useQuery(q.members());
  const recent = useQuery(q.recentList(1, 1));
  const bday = useQuery(q.birthdays());
  return {
    ready: live.isSuccess && next.isSuccess && members.isSuccess,
    live: live.data?.length,
    schedule: next.data?.length,
    members: members.data?.filter((m) => !m.isGraduate).length,
    recent: recent.data?.total,
    birthday: bday.data?.length,
  };
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          if (ref.current) gsap.fromTo(ref.current, { scale: 0.85 }, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" });
          setTimeout(() => setDone(false), 1500);
        });
      }}
      aria-label={done ? "Tersalin" : "Salin"}
      className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors", className)}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Tersalin" : "Salin"}
    </button>
  );
}

/* ───────────────────────────── Orbit API ───────────────────────────── */

const NODE_R = 41; // % dari pusat
const angleOf = (i: number) => (i / ENDPOINTS.length) * Math.PI * 2 - Math.PI / 2;

/**
 * Inti "API" di tengah dengan 8 endpoint mengorbit. Paket data meluncur dari inti ke tiap endpoint,
 * cincin putus-putus berputar, inti berdenyut. Label memuat angka hidup bila tersedia.
 */
function ApiOrbit({ n }: { n: ReturnType<typeof useApiNumbers> }) {
  const root = useRef<HTMLDivElement>(null);
  const counts: Record<string, number | undefined> = { Live: n.live, Jadwal: n.schedule, Member: n.members, Recent: n.recent, Birthday: n.birthday };

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-node]", { scale: 0, opacity: 0, duration: 0.6, stagger: 0.07, ease: "back.out(2)", delay: 0.4 });
      gsap.from("[data-line]", { attr: { "stroke-dashoffset": 200 }, duration: 0.9, stagger: 0.05, ease: "power2.out", delay: 0.3 });
      gsap.to("[data-ring]", { rotate: 360, duration: 40, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
      gsap.to("[data-ring2]", { rotate: -360, duration: 60, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
      gsap.fromTo("[data-pulse]", { scale: 0.6, opacity: 0.7 }, { scale: 1.8, opacity: 0, duration: 2.2, repeat: -1, stagger: 0.7, ease: "power2.out", transformOrigin: "50% 50%" });
      gsap.to("[data-core]", { scale: 1.06, duration: 1.1, yoyo: true, repeat: -1, ease: "sine.inOut", transformOrigin: "50% 50%" });
      // Paket data: tiap garis mengirim paket berulang dengan jeda acak.
      gsap.utils.toArray<SVGCircleElement>("[data-packet]").forEach((p, i) => {
        const a = angleOf(i % ENDPOINTS.length);
        gsap.fromTo(
          p,
          { attr: { cx: 200, cy: 200 }, opacity: 0 },
          {
            attr: { cx: 200 + Math.cos(a) * 160, cy: 200 + Math.sin(a) * 160 },
            opacity: 1,
            duration: gsap.utils.random(1.1, 1.8),
            ease: "power1.in",
            repeat: -1,
            repeatDelay: gsap.utils.random(0.4, 2.2),
            delay: 0.8 + gsap.utils.random(0, 2),
          },
        );
      });
      gsap.to("[data-node]", { y: (i) => (i % 2 ? -4 : 4), duration: 2, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 1.2, stagger: 0.15 });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="relative mx-auto aspect-square w-[82%] max-w-[440px] sm:w-full">
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
        <g data-ring>
          <circle cx="200" cy="200" r="178" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeDasharray="2 10" strokeWidth="2" />
        </g>
        <g data-ring2>
          <circle cx="200" cy="200" r="120" fill="none" stroke="rgb(225 36 58 / 0.35)" strokeDasharray="30 14" strokeWidth="1.5" />
        </g>
        {ENDPOINTS.map((_, i) => {
          const a = angleOf(i);
          return (
            <line
              key={i}
              data-line
              x1="200"
              y1="200"
              x2={200 + Math.cos(a) * 164}
              y2={200 + Math.sin(a) * 164}
              stroke="rgb(255 255 255 / 0.16)"
              strokeWidth="1.5"
              strokeDasharray="200"
              strokeDashoffset="0"
            />
          );
        })}
        {[...ENDPOINTS, ...ENDPOINTS].map((_, i) => (
          <circle key={i} data-packet cx="200" cy="200" r={i < ENDPOINTS.length ? 4 : 3} fill={i % 3 ? "#e1243a" : "#fde6b0"} opacity="0" />
        ))}
        {[0, 1, 2].map((i) => (
          <circle key={i} data-pulse cx="200" cy="200" r="46" fill="none" stroke="#e1243a" strokeWidth="2" opacity="0" />
        ))}
      </svg>

      <div data-core className="absolute left-1/2 top-1/2 -ml-[52px] -mt-[52px] grid h-[104px] w-[104px] place-items-center rounded-full bg-brand shadow-[0_0_60px_-10px_#e1243a]">
        <div className="text-center">
          <PixelCross className="mx-auto h-9 w-9" cellClass="fill-white" />
          <p className="mt-1 font-mono text-[10px] font-bold tracking-[0.2em]">API</p>
        </div>
      </div>

      {ENDPOINTS.map((e, i) => {
        const a = angleOf(i);
        const c = counts[e.short];
        return (
          <div
            key={e.path}
            className="absolute"
            style={{ left: `${50 + Math.cos(a) * NODE_R}%`, top: `${50 + Math.sin(a) * NODE_R}%`, transform: "translate(-50%, -50%)" }}
          >
            <Link
              to={e.to}
              data-node
              className="block whitespace-nowrap rounded-full border border-white/15 bg-[#2a2124] px-3 py-1.5 text-center font-mono text-[11px] font-semibold text-white shadow-lg transition-colors hover:border-brand hover:bg-brand sm:text-[12px]"
            >
              {e.short}
              {c != null && <span className="ml-1.5 text-butter">{c}</span>}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── Terminal berputar ───────────────────────────── */

/** Terminal yang terus mengetik request ke endpoint bergantian; hasilnya angka hidup bila ada. */
function LoopTerminal({ n }: { n: ReturnType<typeof useApiNumbers> }) {
  const [rows, setRows] = useState<{ cmd: string; out: string; key: number }[]>([]);
  const [typing, setTyping] = useState("");
  const latest = useRef(n);
  latest.current = n;

  useEffect(() => {
    const items: { path: string; out: () => string }[] = [
      { path: "/api/now_live?group=jkt48", out: () => `${latest.current.live ?? "…"} member sedang live` },
      { path: "/api/next_schedule", out: () => `${latest.current.schedule ?? "…"} jadwal mendatang` },
      { path: "/api/member", out: () => `${latest.current.members ?? "…"} member aktif` },
      { path: "/api/recent", out: () => `${latest.current.recent ?? "…"} live tercatat` },
      { path: "/api/next_birthday", out: () => `${latest.current.birthday ?? "…"} ulang tahun terdekat` },
      { path: "/api/news", out: () => "berita resmi terbaru" },
    ];
    let i = 0;
    let key = 0;
    let tween: gsap.core.Tween | null = null;
    let timer = 0;
    let alive = true;
    const step = () => {
      if (!alive) return;
      const item = items[i % items.length];
      const cmd = `curl ${item.path}`;
      const o = { n: 0 };
      tween = gsap.to(o, {
        n: cmd.length,
        duration: cmd.length * 0.028,
        ease: "none",
        onUpdate: () => setTyping(cmd.slice(0, Math.round(o.n))),
        onComplete: () => {
          timer = window.setTimeout(() => {
            setTyping("");
            setRows((r) => [...r, { cmd, out: item.out(), key: key++ }].slice(-4));
            i++;
            timer = window.setTimeout(step, 1100);
          }, 280);
        },
      });
    };
    timer = window.setTimeout(step, 600);
    return () => {
      alive = false;
      tween?.kill();
      clearTimeout(timer);
    };
  }, []);

  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const last = body.current?.querySelector("[data-row]:last-of-type");
    if (last) gsap.fromTo(last, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" });
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-3xl bg-nav text-white shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-brand" />
        <span className="h-2.5 w-2.5 rounded-full bg-butter" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
        <span className="ml-3 font-mono text-[11px] text-white/50">api.jkt48connect.app</span>
        <SignalBars className="ml-auto text-brand" />
      </div>
      <div ref={body} className="h-[350px] space-y-3 overflow-hidden p-5 sm:h-[310px] font-mono text-[12.5px] leading-relaxed sm:p-6 sm:text-[13px]">
        <p className="text-white/40"># angka diambil dari API saat halaman ini dibuka</p>
        {rows.map((r) => (
          <div key={r.key} data-row>
            <p className="truncate">
              <span className="text-brand">$</span> <span className="text-butter">curl</span> {r.cmd.slice(5)}
            </p>
            <p className="mt-0.5 text-white/75">
              <span className="text-[#7ee2a8]">200 OK</span> → {r.out}
            </p>
          </div>
        ))}
        <p className="flex items-center gap-1 truncate">
          <span className="text-brand">$</span>
          {typing && (
            <span>
              {" "}
              <span className="text-butter">{typing.slice(0, 4)}</span>
              {typing.slice(4)}
            </span>
          )}
          <span className="inline-block h-4 w-2 animate-pulse bg-white/70" />
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────── Kartu sorot ───────────────────────────── */

/** Kartu dengan sorotan merah yang mengikuti kursor. */
function Spotlight({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      className={cx(
        "group relative overflow-hidden rounded-[20px] border border-line bg-card transition-colors hover:border-brand/50",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100",
        "before:bg-[radial-gradient(260px_circle_at_var(--x)_var(--y),rgb(225_36_58/0.14),transparent_70%)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ───────────────────────────── Kode mengetik ───────────────────────────── */

function TypedCode({ code }: { code: string }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = { n: 0 };
    const t = gsap.to(o, { n: code.length, duration: Math.min(1.2, code.length * 0.008), ease: "none", onUpdate: () => void (el.textContent = code.slice(0, Math.round(o.n))) });
    return () => void t.kill();
  }, [code]);
  return <code ref={ref}>{code}</code>;
}

/* ───────────────────────────── Halaman ───────────────────────────── */

export function DeveloperPage() {
  const [lang, setLang] = useState<Lang>("curl");
  const n = useApiNumbers();
  const steps = useRef<HTMLOListElement>(null);
  const cta = useRef<HTMLDivElement>(null);

  const stats = [
    { label: "Member aktif", value: n.members ?? 0 },
    { label: "Jadwal mendatang", value: n.schedule ?? 0 },
    { label: "Sedang live", value: n.live ?? 0 },
    { label: "Live tercatat", value: n.recent ?? 0 },
  ];

  // Garis langkah tergambar mengikuti scroll; nomor memantul saat garis mencapainya.
  useLayoutEffect(() => {
    const el = steps.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-progress]", { scaleY: 0 }, { scaleY: 1, ease: "none", transformOrigin: "50% 0%", scrollTrigger: { trigger: el, start: "top 75%", end: "bottom 60%", scrub: 0.5 } });
      gsap.utils.toArray<HTMLElement>("[data-step-num]").forEach((num) => {
        gsap.fromTo(num, { scale: 0.4, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.6, ease: "back.out(3)", scrollTrigger: { trigger: num, start: "top 70%", once: true } });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  // Piksel logo di panel ajakan beterbangan masuk lalu melayang.
  useLayoutEffect(() => {
    const el = cta.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const px = gsap.utils.toArray<SVGRectElement>("[data-cta-px]");
      gsap.from(px, {
        x: () => gsap.utils.random(-260, 120),
        y: () => gsap.utils.random(-160, 160),
        rotate: () => gsap.utils.random(-180, 180),
        opacity: 0,
        duration: 1.1,
        ease: "expo.out",
        stagger: { each: 0.04, from: "random" },
        scrollTrigger: { trigger: el, start: "top 80%", once: true },
        onComplete: () => void gsap.to(px, { y: (i) => (i % 2 ? -5 : 5), duration: 1.8, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: 0.1 }),
      });
    }, el);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => clearTimeout(t);
  }, [n.ready]);

  return (
    <Page deps={[n.ready, n.recent]}>
      {/* Hero */}
      <section className="container-x pt-6">
        <div className="relative overflow-hidden rounded-[32px] bg-nav px-6 py-10 text-white sm:px-10 lg:py-12">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-butter/10 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div data-reveal>
              <p className="micro mb-4 flex items-center gap-2 text-butter">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                </span>
                Public API · layanan JKT48Connect
              </p>
              <h1 className="condensed text-[clamp(2.75rem,5vw,4.25rem)] uppercase leading-[0.88]">
                <SplitText text="Pakai data ini" />
                <br />
                <span className="text-brand">
                  <SplitText text="di proyekmu" />
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/70">
                Semua yang tampil di situs ini, dari live, theater, member, birthday, rekap live, sampai berita, berasal dari{" "}
                <b className="text-white">api.jkt48connect.app</b>. API ini layanan dari JKT48Connect dan terbuka juga untuk developer
                lain: bot, aplikasi, widget, atau situs fanbase.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1 pl-4 pr-1 font-mono text-[13px]">
                {BASE}
                <CopyButton text={BASE} className="bg-white/10 text-white hover:bg-brand" />
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <a href={DOCS} target="_blank" rel="noreferrer" className="btn btn-primary group">
                  Baca dokumentasi
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
                <a href={KEYS} target="_blank" rel="noreferrer" className="btn group bg-white/[0.08] text-white hover:bg-white/[0.16]">
                  Ambil API key
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>
            <div data-reveal>
              <ApiOrbit n={n} />
            </div>
          </div>
        </div>
      </section>

      {/* Pita endpoint berjalan */}
      <section className="overflow-hidden py-3">
        <div className="-mx-4 mt-3 -rotate-1 border-y border-line bg-card py-3">
          <Ticker speed={50}>
            {ENDPOINTS.map((e) => (
              <span key={e.path} className="flex items-center gap-2 px-4 font-mono text-[13px]">
                <span className="pill bg-brand text-white">GET</span>
                {e.path}
                <PixelCross className="ml-4 h-3 w-3" />
              </span>
            ))}
          </Ticker>
        </div>
      </section>

      {/* Terminal + statistik */}
      <section className="container-x grid items-start gap-6 pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div data-reveal className="min-w-0">
          <LoopTerminal n={n} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <Tilt key={s.label} className={i === 0 ? "rounded-2xl bg-brand p-5 text-white" : "panel p-5"}>
              <div data-reveal>
                <p className={i === 0 ? "micro text-white/80" : "micro text-ink-soft"}>{s.label}</p>
                <p className="condensed mt-3 text-[44px] leading-none">
                  <CountUp value={s.value} />
                </p>
              </div>
            </Tilt>
          ))}
          <p className="col-span-2 text-[13px] text-ink-soft">Data hidup dari API yang sama, diperbarui otomatis.</p>
        </div>
      </section>

      {/* Endpoint */}
      <section className="container-x pt-14">
        <div className="mb-4">
          <p className="micro mb-1.5 text-ink-soft">Yang dipakai situs ini</p>
          <h2 className="condensed flex items-baseline gap-2 text-[30px] uppercase leading-none">
            <SplitText text="Endpoint" />
            <span className="text-brand">/ {ENDPOINTS.length}</span>
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {ENDPOINTS.map((e, i) => (
            <div key={e.path} data-reveal>
              <Spotlight className="flex h-full flex-col p-5">
                <p className="relative flex items-center gap-2 font-mono text-[13px]">
                  <span className="font-semibold text-brand">{String(i + 1).padStart(2, "0")}</span>
                  <span className="pill bg-brand text-white">GET</span>
                  <span className="truncate font-semibold">{e.path}</span>
                </p>
                <p className="relative mt-3 flex-1 text-[14px] leading-relaxed text-ink-soft">{e.desc}</p>
                <Link to={e.to} className="link-more relative mt-4 inline-flex items-center gap-1.5">
                  Lihat di halaman {e.page} <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </Spotlight>
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
          <p className="micro mb-1.5 text-ink-soft">Mulai</p>
          <h2 className="condensed mb-5 text-[30px] uppercase leading-none">
            <SplitText text="Tiga langkah" />
          </h2>
          <ol ref={steps} className="relative space-y-4 pl-16">
            <span className="absolute bottom-6 left-[27px] top-6 w-[3px] rounded-full bg-line" />
            <span data-progress className="absolute bottom-6 left-[27px] top-6 w-[3px] rounded-full bg-brand" />
            {STEPS.map((s, i) => (
              <li key={s.title} data-reveal className="relative">
                <span data-step-num className="absolute -left-16 top-1 grid h-14 w-14 place-items-center rounded-2xl bg-brand font-mono text-[18px] font-bold text-white shadow-[0_10px_24px_-10px_var(--brand)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Spotlight className="p-5">
                  <p className="relative flex items-center gap-2 font-extrabold">
                    <s.icon className="h-4 w-4 text-brand" /> {s.title}
                  </p>
                  <p className="relative mt-1 text-[14px] leading-relaxed text-ink-soft">{s.body}</p>
                </Spotlight>
              </li>
            ))}
          </ol>
        </div>
        <div data-reveal className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
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
            <pre className="thin-scrollbar min-h-[190px] overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-white/90">
              <TypedCode code={SNIPPETS[lang]} />
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
        <p className="micro mb-1.5 text-ink-soft">Inspirasi</p>
        <h2 className="condensed mb-4 text-[30px] uppercase leading-none">
          <SplitText text="Bisa dipakai untuk" />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {IDEAS.map((idea) => (
            <div key={idea.title} data-reveal>
              <Tilt className="h-full">
                <Spotlight className="h-full p-5">
                  <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-blush text-brand transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                    <idea.icon className="h-5 w-5" />
                  </span>
                  <p className="relative mt-4 font-extrabold">{idea.title}</p>
                  <p className="relative mt-1 text-[14px] leading-relaxed text-ink-soft">{idea.body}</p>
                </Spotlight>
              </Tilt>
            </div>
          ))}
        </div>
      </section>

      {/* Ajakan */}
      <section className="container-x pt-14">
        <div ref={cta} data-reveal className="relative overflow-hidden rounded-3xl bg-brand p-7 text-white sm:p-10">
          <svg viewBox="0 0 50 50" className="pointer-events-none absolute -right-4 top-1/2 h-56 w-56 -translate-y-1/2 opacity-25 sm:right-6" aria-hidden>
            {PIXELS.map(([x, y]) => (
              <rect key={`${x}-${y}`} data-cta-px x={x * 10} y={y * 10} width="10" height="10" rx="1.5" fill="#fff" />
            ))}
          </svg>
          <p className="micro relative text-white/80">JKT48Connect API</p>
          <p className="condensed relative mt-3 max-w-2xl text-[clamp(2rem,5vw,3.25rem)] uppercase leading-[0.9]">Siap bikin sesuatu untuk sesama fans?</p>
          <div className="relative mt-6 flex flex-wrap gap-2">
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
