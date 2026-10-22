import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CreditCard,
  Download,
  Heart,
  History,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  ZoomIn,
} from "lucide-react";
import { PixelCross } from "@/components/logo";
import { CountUp, SignalBars, SplitText, Tilt } from "@/components/motion";
import { Page } from "@/components/page";
import { Skeleton, cx } from "@/components/ui";
import { gsap } from "@/lib/gsap";

type User = { id: string; name: string; email: string };
type Member = {
  member: string;
  slug: string;
  avatar: string | null;
  expires_at: number | null;
};
type Plan = { name: string; days: number; price: number };
type Order = {
  id: string;
  member: string;
  member_name: string;
  plan: string;
  days: number;
  price: number;
  amount: number | null;
  status: string;
  qr_image: string | null;
  expired_at: string | null;
  created_at: number;
};
type Message = {
  message_id: string;
  sequence_order: number;
  created_at: string;
  text: string;
  is_poll?: boolean;
  poll?: unknown;
  media_urls: string[];
};
type Messages = { messages: Message[]; pagination?: { has_next: boolean } };

async function api<T>(path: string, data?: unknown): Promise<T> {
  const res = await fetch("/api/pm" + path, {
    credentials: "same-origin",
    ...(data !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : {}),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "Permintaan gagal.");
  return result;
}

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const date = (n: number) =>
  new Date(n * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) + " WIB";
const statusLabel: Record<string, string> = {
  PENDING: "Menunggu pembayaran",
  SUCCESS: "Berhasil",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  FAILED: "Gagal",
  CREATING: "Memproses",
};
const statusStyle: Record<string, string> = {
  PENDING: "bg-butter text-[#7a4b00]",
  SUCCESS: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  FAILED: "bg-blush text-brand",
  CREATING: "bg-surface text-ink-soft",
};
const active = (m: Member) => !!m.expires_at && m.expires_at * 1000 > Date.now();

/** Rute /pm didaftarkan lewat map di router, jadi path-nya tidak bertipe literal; tautan memakai string biasa. */
function PmLink({ to, ...rest }: Omit<ComponentProps<"a">, "href"> & { to: string }) {
  return <Link to={to as never} {...(rest as object)} />;
}

/* ───────────────────────────── Bagian kecil ───────────────────────────── */

function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <p className="rounded-2xl border border-brand/30 bg-blush px-4 py-3 text-[14px] font-semibold text-brand" role="alert">
      {error instanceof Error ? error.message : "Terjadi kesalahan."}
    </p>
  ) : null;
}

function Status({ status }: { status: string }) {
  return <span className={cx("pill", statusStyle[status] ?? "bg-surface text-ink-soft")}>{statusLabel[status] || status}</span>;
}

function Avatar({ member, className = "h-12 w-12 rounded-2xl" }: { member: Member; className?: string }) {
  const [broken, setBroken] = useState(false);
  return member.avatar && !broken ? (
    <img
      className={cx("shrink-0 bg-surface object-cover object-top", className)}
      src={member.avatar}
      alt={member.member}
      onError={() => setBroken(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className={cx("grid shrink-0 place-items-center bg-blush font-extrabold uppercase text-brand", className)}>{member.member.slice(0, 1)}</span>
  );
}

function Heading({ label, title, desc, aside }: { label: string; title: string; desc?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="micro mb-2 flex items-center gap-2 text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          {label}
        </p>
        <h2 className="condensed text-[clamp(2rem,5vw,3rem)] uppercase leading-[0.9]">
          <SplitText text={title} />
        </h2>
        {desc && <p className="mt-2 max-w-xl text-ink-soft">{desc}</p>}
      </div>
      {aside}
    </div>
  );
}

const input =
  "h-12 w-full rounded-2xl border border-line bg-bg px-4 text-[15px] outline-none transition placeholder:text-ink-soft/70 focus:border-brand focus:ring-4 focus:ring-brand/10";

/** Hati kecil yang berhamburan dari sebuah elemen (dipakai saat pembayaran berhasil). */
function burst(from: HTMLElement | null) {
  if (!from) return;
  const r = from.getBoundingClientRect();
  for (let i = 0; i < 18; i++) {
    const h = document.createElement("span");
    h.textContent = "♥";
    h.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;z-index:80;pointer-events:none;font-size:${14 + Math.random() * 16}px;color:${i % 3 ? "#e1243a" : "#f5b942"}`;
    document.body.appendChild(h);
    gsap.fromTo(
      h,
      { x: 0, y: 0, scale: 0, opacity: 1 },
      {
        x: gsap.utils.random(-180, 180),
        y: gsap.utils.random(-200, 60),
        rotate: gsap.utils.random(-60, 60),
        scale: 1,
        opacity: 0,
        duration: gsap.utils.random(0.9, 1.4),
        ease: "power3.out",
        onComplete: () => h.remove(),
      },
    );
  }
}

/* ───────────────────────────── Masuk / daftar ───────────────────────────── */

function Auth({ register, onDone }: { register: boolean; onDone: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const story = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = story.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.to("[data-orbit]", { rotate: 360, duration: 24, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
      gsap.to("[data-orbit-item]", { rotate: -360, duration: 24, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
      gsap.fromTo("[data-core]", { scale: 0.92 }, { scale: 1.06, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.fromTo("[data-pulse]", { scale: 0.7, opacity: 0.6 }, { scale: 1.9, opacity: 0, duration: 2.4, repeat: -1, stagger: 0.8, ease: "power2.out" });
    }, el);
    return () => ctx.revert();
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api("/auth/" + (register ? "register" : "login"), Object.fromEntries(form));
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <div className="container-x grid gap-5 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section ref={story} data-reveal className="relative overflow-hidden rounded-[32px] bg-nav p-7 text-white sm:p-10">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
          <p className="micro relative text-butter">JKT48Connect · Private Messages</p>
          <div className="relative mx-auto my-8 grid h-56 w-56 place-items-center sm:h-64 sm:w-64">
            {[0, 1, 2].map((i) => (
              <span key={i} data-pulse className="absolute h-28 w-28 rounded-full border-2 border-brand" />
            ))}
            <div data-orbit className="absolute inset-0 rounded-full border border-dashed border-white/15">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 -ml-4 -mt-4"
                  style={{ transform: `rotate(${i * 60}deg) translate(0, -112px)` }}
                >
                  <span data-orbit-item className={cx("grid h-8 w-8 place-items-center rounded-full", i % 2 ? "bg-white/10" : "bg-brand")}>
                    {i % 2 ? <MessageCircle className="h-4 w-4" /> : <Heart className="h-4 w-4 fill-white" />}
                  </span>
                </span>
              ))}
            </div>
            <div data-core className="grid h-28 w-28 place-items-center rounded-full bg-brand shadow-[0_0_60px_-10px_#e1243a]">
              <PixelCross className="h-12 w-12" cellClass="fill-white" />
            </div>
          </div>
          <h1 className="condensed relative text-[clamp(2.4rem,5vw,3.6rem)] uppercase leading-[0.9]">
            <SplitText text="Lebih dekat." />
            <br />
            <span className="text-brand">
              <SplitText text="Setiap cerita." />
            </span>
          </h1>
          <p className="relative mt-3 max-w-md text-white/70">Tempat kecil untuk kabar, foto, dan momen dari member favoritmu.</p>
          <p className="relative mt-5 flex items-center gap-2 text-[13px] text-white/60">
            <ShieldCheck className="h-4 w-4 text-brand" /> Akun pribadi · akses pilihanmu
          </p>
        </section>

        <section data-reveal className="panel flex flex-col justify-center p-7 sm:p-10">
          <p className="micro text-ink-soft">Your oshi, your space</p>
          <h2 className="condensed mt-2 text-[clamp(2rem,4vw,2.8rem)] uppercase leading-[0.92]">{register ? "Mulai cerita kamu." : "Senang kamu kembali."}</h2>
          <p className="mt-2 text-ink-soft">
            {register ? "Buat akun untuk memilih member dan membuka pesan." : "Masuk untuk melanjutkan membaca pesan member favoritmu."}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {register && (
              <label className="block text-[13px] font-bold">
                Nama
                <input name="name" required minLength={2} maxLength={60} autoComplete="name" placeholder="Nama panggilan kamu" className={cx(input, "mt-1.5")} />
              </label>
            )}
            <label className="block text-[13px] font-bold">
              Email
              <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="kamu@email.com" className={cx(input, "mt-1.5")} />
            </label>
            <label className="block text-[13px] font-bold">
              Kata sandi
              <input
                name="password"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="Minimal 10 karakter"
                className={cx(input, "mt-1.5")}
              />
            </label>
            <ErrorBox error={error} />
            <button className="btn btn-primary group w-full py-3" disabled={busy}>
              {busy ? "Sebentar…" : register ? "Buat akun" : "Masuk ke PM"}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          </form>
          <p className="mt-5 text-[14px] text-ink-soft">
            {register ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
            <PmLink to={register ? "/pm/login" : "/pm/register"} className="font-bold text-brand underline-offset-4 hover:underline">
              {register ? "Masuk" : "Daftar sekarang"}
            </PmLink>
          </p>
          <p className="mt-6 text-[12px] text-ink-soft">Fan-made. Tidak berafiliasi dengan JKT48 Operation Team.</p>
        </section>
      </div>
    </Page>
  );
}

/* ───────────────────────────── Kepala area PM + tab ───────────────────────────── */

const TABS = [
  { href: "/pm", label: "Pesan", icon: MessageCircle },
  { href: "/pm/shop", label: "Beli akses", icon: Heart },
  { href: "/pm/transactions", label: "Transaksi", icon: History },
  { href: "/pm/account", label: "Akun", icon: UserRound },
] as const;

function PmHeader({ user, members, path, chat }: { user: User; members: Member[]; path: string; chat: string | null }) {
  const hero = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const current = TABS.find((t) => (t.href === "/pm" ? path === "/pm" || !!chat : path.startsWith(t.href)))?.href;

  useLayoutEffect(() => {
    const el = hero.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-hero-in]", { y: 24, opacity: 0, duration: 0.6, stagger: 0.08, ease: "power3.out" });
      gsap.to("[data-float]", { y: (i) => (i % 2 ? -10 : 10), rotate: (i) => (i % 2 ? 8 : -8), duration: 2.4, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: 0.3 });
    }, el);
    return () => ctx.revert();
  }, []);

  // Pil merah tab meluncur (elastic) ke tab aktif.
  useLayoutEffect(() => {
    const nav = tabs.current;
    const p = pill.current;
    const link = nav?.querySelector<HTMLElement>(`[data-tab="${current}"]`);
    if (!nav || !p) return;
    if (!link) return void gsap.to(p, { opacity: 0, duration: 0.2 });
    const first = !p.dataset.ready;
    p.dataset.ready = "1";
    gsap.to(p, { x: link.offsetLeft, width: link.offsetWidth, opacity: 1, duration: first ? 0 : 0.6, ease: "elastic.out(1, 0.75)" });
    // Lebar tab ikut layar (dan font yang baru selesai dimuat), jadi pil disejajarkan ulang tanpa animasi.
    let initial = true; // panggilan pertama ResizeObserver langsung saat observe; jangan potong animasi luncur
    const ro = new ResizeObserver(() => {
      if (initial) return void (initial = false);
      gsap.killTweensOf(p);
      gsap.set(p, { x: link.offsetLeft, width: link.offsetWidth, opacity: 1 });
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, [current]);

  const activeCount = members.filter(active).length;
  return (
    <div className="container-x pt-6">
      <div ref={hero} className="relative overflow-hidden rounded-[28px] bg-nav px-6 py-7 text-white sm:px-9 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
        <Heart data-float className="pointer-events-none absolute right-[38%] top-6 hidden h-6 w-6 fill-brand text-brand opacity-70 sm:block" />
        <MessageCircle data-float className="pointer-events-none absolute bottom-6 right-[30%] hidden h-5 w-5 text-white/30 sm:block" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p data-hero-in className="micro flex items-center gap-2 text-butter">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              Private Messages
            </p>
            <h1 data-hero-in className="condensed mt-3 text-[clamp(2.2rem,5vw,3.6rem)] uppercase leading-[0.9]">
              Halo, <span className="text-brand">{user.name.split(" ")[0]}</span>
            </h1>
            <p data-hero-in className="mt-2 max-w-md text-white/65">
              Potongan hari, cerita kecil, dan momen yang terasa dekat dari oshi kamu.
            </p>
          </div>
          <div className="flex gap-3">
            <div data-hero-in className="rounded-2xl bg-brand px-5 py-4">
              <p className="micro text-white/80">Akses aktif</p>
              <p className="condensed mt-1 text-[40px] leading-none">
                <CountUp value={activeCount} />
              </p>
            </div>
            <div data-hero-in className="rounded-2xl bg-white/[0.07] px-5 py-4">
              <p className="micro text-white/60">Member</p>
              <p className="condensed mt-1 text-[40px] leading-none">
                <CountUp value={members.length} />
              </p>
            </div>
          </div>
        </div>
      </div>

      <nav ref={tabs} aria-label="Navigasi Private Messages" className="no-scrollbar relative mt-4 flex w-full gap-1 overflow-x-auto rounded-full border border-line bg-card p-1 sm:w-max">
        <span ref={pill} className="pointer-events-none absolute bottom-1 left-0 top-1 w-0 rounded-full bg-brand opacity-0 shadow-[0_8px_20px_-8px_var(--brand)]" />
        {TABS.map((t) => {
          const on = current === t.href;
          return (
            <PmLink
              key={t.href}
              to={t.href}
              data-tab={t.href}
              aria-current={on ? "page" : undefined}
              className={cx("relative z-[1] flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-bold transition-colors sm:flex-none sm:px-4 sm:text-[14px]", on ? "text-white" : "text-ink-soft hover:text-ink")}
            >
              <t.icon className="hidden h-4 w-4 min-[400px]:block" />
              {t.label}
            </PmLink>
          );
        })}
      </nav>
    </div>
  );
}

/* ───────────────────────────── Daftar member ───────────────────────────── */

function Home({ members, loading, error }: { members: Member[]; loading: boolean; error: unknown }) {
  const [search, setSearch] = useState("");
  const shown = members.filter((m) => m.member.toLowerCase().includes(search.toLowerCase()));
  return (
    <Page deps={[members.length, search]}>
      <div className="container-x pt-8">
        <Heading
          label="A little closer, every day"
          title="Pesan dari oshi kamu"
          desc="Pilih member untuk membuka pesannya. Member terkunci butuh paket akses."
          aside={
            <label className="flex h-12 w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 transition focus-within:border-brand sm:w-72">
              <Search className="h-4 w-4 text-ink-soft" />
              <input aria-label="Cari member" placeholder="Cari oshi kamu…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-soft" />
            </label>
          }
        />
        <ErrorBox error={error} />
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        ) : shown.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {shown.map((m, i) => {
              const on = active(m);
              return (
                <PmLink key={m.slug} to={on ? `/pm/chat/${m.slug}` : `/pm/shop?member=${m.slug}`} data-reveal className="group block">
                  <Tilt className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-surface">
                    <Avatar member={m} className="h-full w-full text-[56px] transition duration-500 group-hover:scale-105" />
                    <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-brand px-2 font-mono text-[10px] font-semibold text-white">{String(i + 1).padStart(2, "0")}</span>
                    <span className={cx("absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full", on ? "bg-emerald-500 text-white" : "bg-nav/80 text-white backdrop-blur")}>
                      {on ? <Check className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                    </span>
                    <span className="absolute inset-x-3 bottom-3 text-white">
                      <span className="block truncate text-[16px] font-extrabold leading-tight">{m.member}</span>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-white/75">
                        {on ? `s/d ${new Date(m.expires_at! * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}` : "Terkunci"}
                      </span>
                    </span>
                  </Tilt>
                  <p className="link-more mt-2 flex items-center justify-between group-hover:text-brand">
                    {on ? "Buka pesan" : "Pilih akses"}
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </p>
                </PmLink>
              );
            })}
          </div>
        ) : (
          !error && (
            <div className="panel grid place-items-center gap-2 px-6 py-14 text-center">
              <Search className="h-8 w-8 text-ink-soft" />
              <p className="text-ink-soft">{members.length ? "Member tidak ditemukan." : "Belum ada member tersedia."}</p>
            </div>
          )
        )}
      </div>
    </Page>
  );
}

/* ───────────────────────────── Beli akses ───────────────────────────── */

function Shop({ members, plans }: { members: Member[]; plans: Record<string, Plan> }) {
  const navigate = useNavigate();
  const preset = new URLSearchParams(window.location.search).get("member") ?? "";
  const [member, setMember] = useState(members.some((m) => m.slug === preset) ? preset : "");
  const [plan, setPlan] = useState("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const selected = members.find((m) => m.slug === member);
  const total = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const price = plans[plan]?.price ?? 0;

  // Total paket menghitung ke nilai baru saat paket diganti.
  useEffect(() => {
    const el = total.current;
    if (!el) return;
    const o = { v: shown.current };
    const t = gsap.to(o, { v: price, duration: 0.6, ease: "power3.out", onUpdate: () => void (el.textContent = rupiah(Math.round(o.v))) });
    shown.current = price;
    return () => void t.kill();
  }, [price]);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>("/orders", { member, plan });
      void navigate({ to: `/pm/pay/${r.id}` as never });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Page deps={[members.length]}>
      <div className="container-x pt-8">
        <Heading label="Pilih koneksimu" title="Satu member, banyak cerita" desc="Setiap paket membuka pesan dan media dari satu member pilihanmu." />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section data-reveal className="panel p-5 sm:p-6">
              <p className="micro mb-4 text-brand">01 · Member favorit</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {members.map((m) => {
                  const on = member === m.slug;
                  return (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => setMember(m.slug)}
                      aria-pressed={on}
                      className={cx(
                        "flex items-center gap-3 rounded-2xl border p-2.5 text-left transition",
                        on ? "border-brand bg-blush ring-2 ring-brand/30" : "border-line hover:border-brand/50",
                      )}
                    >
                      <Avatar member={m} className="h-11 w-11 rounded-xl" />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-bold">{m.member}</span>
                        <span className={cx("block font-mono text-[10px] uppercase tracking-[0.1em]", active(m) ? "text-emerald-600" : "text-ink-soft")}>
                          {active(m) ? "Akses aktif" : "Terkunci"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section data-reveal className="panel p-5 sm:p-6">
              <p className="micro mb-4 text-brand">02 · Durasi akses</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(plans).map(([key, p]) => {
                  const on = plan === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlan(key)}
                      aria-pressed={on}
                      className={cx(
                        "relative overflow-hidden rounded-2xl border p-4 text-left transition",
                        on ? "border-brand bg-brand text-white shadow-[0_14px_30px_-14px_var(--brand)]" : "border-line hover:-translate-y-0.5 hover:border-brand/50",
                      )}
                    >
                      {key === "monthly" && <span className={cx("pill absolute right-3 top-3", on ? "bg-white text-brand" : "bg-butter text-[#7a4b00]")}>Paling hemat</span>}
                      <span className="block text-[15px] font-extrabold">{p.name}</span>
                      <span className={cx("block text-[13px]", on ? "text-white/80" : "text-ink-soft")}>{p.days} hari akses</span>
                      <span className="condensed mt-4 block text-[30px] leading-none">{rupiah(p.price)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside data-reveal className="relative overflow-hidden rounded-[24px] bg-nav p-6 text-white lg:sticky lg:top-20">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/30 blur-2xl" />
            <p className="micro relative text-white/50">Ringkasan pilihan</p>
            <div className="relative mt-4 flex items-center gap-3">
              {selected ? (
                <Avatar member={selected} className="h-14 w-14 rounded-2xl" />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
                  <Heart className="h-6 w-6 text-brand" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[20px] font-extrabold">{selected?.member || "Oshi pilihanmu"}</p>
                <p className="text-[13px] text-white/60">
                  {plans[plan]?.name} · {plans[plan]?.days} hari
                </p>
              </div>
            </div>
            {selected && active(selected) && <p className="relative mt-3 text-[13px] text-butter">Aktif sampai {date(selected.expires_at!)}. Pembelian ini menambah masa aktif.</p>}
            <div className="relative mt-5 flex items-end justify-between border-t border-white/10 pt-4">
              <span className="text-[13px] text-white/60">Total paket</span>
              <span ref={total} className="condensed text-[34px] leading-none">
                {rupiah(price)}
              </span>
            </div>
            <p className="relative mt-3 text-[12px] leading-relaxed text-white/50">
              Nominal QR dapat mencakup kode unik dari gateway. Akses aktif setelah pembayaran terverifikasi.
            </p>
            <div className="relative mt-4">
              <ErrorBox error={error} />
            </div>
            <button className="btn btn-primary group relative mt-4 w-full py-3" disabled={!member || busy} onClick={buy}>
              {busy ? "Menyiapkan QR…" : member ? "Lanjut pembayaran" : "Pilih member dulu"}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
            <p className="relative mt-3 flex items-center gap-2 text-[12px] text-white/50">
              <ShieldCheck className="h-4 w-4 text-brand" /> Bayar QR di halaman JKT48Connect
            </p>
          </aside>
        </div>
      </div>
    </Page>
  );
}

/* ───────────────────────────── Pembayaran ───────────────────────────── */

function Pay({ id }: { id: string }) {
  const client = useQueryClient();
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const qrBox = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ["pm", "order", id],
    queryFn: () => api<{ data: Order }>("/orders/" + id + "/check", {}),
    refetchInterval: (q) => (q.state.data?.data.status === "PENDING" ? 10000 : false),
    retry: false,
  });
  const order = query.data?.data;

  useEffect(() => {
    const t = window.setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (order?.status === "SUCCESS") void client.invalidateQueries({ queryKey: ["pm", "members"] });
  }, [order?.status, client]);

  // Garis pindai di atas QR; hasil (berhasil/gagal) muncul memantul, dan berhasil memancarkan hati.
  useLayoutEffect(() => {
    const el = qrBox.current?.querySelector("[data-scan]");
    if (!el) return;
    const t = gsap.fromTo(el, { yPercent: 0 }, { yPercent: 2400, duration: 2.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
    return () => void t.kill();
  }, [order?.status]);
  useLayoutEffect(() => {
    const el = result.current;
    if (!el) return;
    gsap.fromTo(el.querySelector("[data-result-icon]"), { scale: 0, rotate: -45 }, { scale: 1, rotate: 0, duration: 0.7, ease: "back.out(2.5)" });
    if (order?.status === "SUCCESS") burst(el.querySelector("[data-result-icon]"));
  }, [order?.status]);

  async function cancel() {
    setBusy(true);
    setActionError(null);
    try {
      const r = await api<{ data: Order }>("/orders/" + id + "/cancel", {});
      client.setQueryData(["pm", "order", id], r);
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }

  const expiry = order?.expired_at ? new Date(order.expired_at.replace(" ", "T") + "+07:00").getTime() : NaN;
  const seconds = Math.max(0, Math.ceil((expiry - clock) / 1000));
  const created = order ? order.created_at * 1000 : 0;
  const window_ = Number.isFinite(expiry) && created ? Math.max(1, expiry - created) : 1;
  const ring = Number.isFinite(expiry) ? Math.min(1, Math.max(0, (expiry - clock) / window_)) : 0;

  return (
    <Page deps={[order?.status]}>
      <div className="container-x pt-8">
        <Heading
          label="Checkout · QR payment"
          title={order?.status === "SUCCESS" ? "Cerita baru menantimu" : "Satu langkah lagi"}
          desc="Akses kamu diaktifkan setelah status pembayaran dikonfirmasi."
        />
        <div className="mb-4">
          <ErrorBox error={query.error || actionError} />
        </div>
        {query.isPending ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-[460px] rounded-3xl" />
            <Skeleton className="h-[460px] rounded-3xl" />
          </div>
        ) : (
          order && (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section data-reveal className="panel p-6 text-center sm:p-8">
                <Status status={order.status} />
                {order.status === "PENDING" && order.qr_image ? (
                  <>
                    <div ref={qrBox} className="relative mx-auto mt-6 w-full max-w-[300px] overflow-hidden rounded-3xl border-[10px] border-white bg-white shadow-[0_20px_50px_-24px_rgb(0_0_0/0.4)]">
                      <img src={order.qr_image} alt="Kode QR pembayaran" referrerPolicy="no-referrer" className="block aspect-square w-full" />
                      <span data-scan className="pointer-events-none absolute inset-x-0 top-0 h-[4%] bg-gradient-to-b from-transparent via-brand/50 to-transparent" />
                      {["left-0 top-0 border-l-4 border-t-4 rounded-tl-xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"].map((c) => (
                        <span key={c} className={cx("pointer-events-none absolute h-8 w-8 border-brand", c)} />
                      ))}
                    </div>
                    <p className="mt-4 text-ink-soft">Scan dengan aplikasi bank atau dompet digital.</p>
                    {Number.isFinite(expiry) && (
                      <div className="mt-4 inline-flex items-center gap-3 rounded-full bg-surface py-2 pl-2 pr-4">
                        <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="4" />
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            fill="none"
                            stroke="var(--brand)"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={94.25}
                            strokeDashoffset={94.25 * (1 - ring)}
                            style={{ transition: "stroke-dashoffset 1s linear" }}
                          />
                        </svg>
                        <span className="num font-mono text-[15px] font-bold">
                          {seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Waktu QR habis · menunggu konfirmasi"}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div ref={result} className="grid place-items-center py-10">
                    <span
                      data-result-icon
                      className={cx("grid h-24 w-24 place-items-center rounded-full", order.status === "SUCCESS" ? "bg-emerald-500 text-white" : "bg-surface text-ink-soft")}
                    >
                      {order.status === "SUCCESS" ? <Check className="h-12 w-12" /> : order.status === "CANCELLED" ? <X className="h-12 w-12" /> : <CreditCard className="h-12 w-12" />}
                    </span>
                    <h3 className="condensed mt-5 text-[30px] uppercase leading-none">{statusLabel[order.status] || order.status}</h3>
                    {order.status === "SUCCESS" && (
                      <PmLink to={`/pm/chat/${order.member}`} className="btn btn-primary group mt-5">
                        Buka pesan
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </PmLink>
                    )}
                  </div>
                )}
              </section>

              <section data-reveal className="panel p-6 sm:p-8">
                <p className="micro text-ink-soft">Detail transaksi</p>
                <p className="mt-2 text-[24px] font-extrabold">{order.member_name}</p>
                <p className="text-ink-soft">{order.days} hari akses</p>
                <dl className="mt-5 divide-y divide-line border-y border-line text-[14px]">
                  {[
                    ["Harga paket", rupiah(order.price)],
                    ["Kode unik / penyesuaian", rupiah((order.amount ?? order.price) - order.price)],
                    ["ID transaksi", order.id],
                    ["Dibuat", date(order.created_at)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2.5">
                      <dt className="text-ink-soft">{k}</dt>
                      <dd className="break-all text-right font-semibold">{v}</dd>
                    </div>
                  ))}
                  <div className="flex items-end justify-between gap-4 py-3">
                    <dt className="font-bold">Total bayar</dt>
                    <dd className="condensed text-[30px] leading-none text-brand">{rupiah(order.amount ?? order.price)}</dd>
                  </div>
                </dl>
                {order.status === "PENDING" && (
                  <div className="mt-5 grid gap-2">
                    <button className="btn btn-primary py-3" disabled={query.isFetching || busy} onClick={() => void query.refetch()}>
                      {query.isFetching ? "Memeriksa…" : "Cek pembayaran"}
                    </button>
                    <button className="btn btn-ghost" disabled={busy || query.isFetching} onClick={cancel}>
                      {busy ? "Memproses…" : "Batalkan transaksi"}
                    </button>
                  </div>
                )}
                <PmLink to="/pm/transactions" className="link-more mt-5 inline-flex items-center gap-1.5">
                  Lihat riwayat transaksi <ArrowUpRight className="h-3.5 w-3.5" />
                </PmLink>
              </section>
            </div>
          )
        )}
      </div>
    </Page>
  );
}

/* ───────────────────────────── Riwayat transaksi ───────────────────────────── */

function Transactions() {
  const q = useQuery({ queryKey: ["pm", "orders"], queryFn: () => api<{ data: Order[] }>("/orders") });
  return (
    <Page deps={[q.data]}>
      <div className="container-x pt-8">
        <Heading label="Catatan koneksi" title="Riwayat transaksi" desc="Pantau pembayaran dan buka kembali QR yang masih aktif. Menampilkan 100 transaksi terbaru." />
        <ErrorBox error={q.error} />
        {q.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : q.data?.data.length ? (
          <div className="panel overflow-hidden">
            {q.data.data.map((o, i) => (
              <PmLink
                key={o.id}
                to={`/pm/pay/${o.id}`}
                data-reveal
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 border-t border-line px-4 py-4 transition-colors first:border-t-0 hover:bg-surface sm:grid-cols-[auto_1fr_auto_auto_auto] sm:px-5"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blush text-brand">
                  <CreditCard className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-brand">{String(i + 1).padStart(2, "0")}</span>
                    <span className="truncate font-extrabold">{o.member_name}</span>
                  </span>
                  <span className="block text-[13px] text-ink-soft">
                    {o.days} hari · {date(o.created_at)}
                  </span>
                  <span className="mt-1 block sm:hidden">
                    <Status status={o.status} />
                  </span>
                </span>
                <span className="condensed text-right text-[22px] leading-none">{rupiah(o.amount ?? o.price)}</span>
                <span className="hidden sm:block">
                  <Status status={o.status} />
                </span>
                <ArrowUpRight className="hidden h-4 w-4 text-ink-soft transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand sm:block" />
              </PmLink>
            ))}
          </div>
        ) : (
          !q.error && (
            <div data-reveal className="panel grid place-items-center gap-3 px-6 py-14 text-center">
              <History className="h-10 w-10 text-brand" />
              <p className="text-[18px] font-extrabold">Belum ada transaksi.</p>
              <p className="text-ink-soft">Pilih member dan paket untuk memulai.</p>
              <PmLink to="/pm/shop" className="btn btn-primary mt-2">
                Pilih akses
              </PmLink>
            </div>
          )
        )}
      </div>
    </Page>
  );
}

/* ───────────────────────────── Akun ───────────────────────────── */

function Account({ user, members }: { user: User; members: Member[] }) {
  const client = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const actives = members.filter(active);
  return (
    <Page deps={[members.length]}>
      <div className="container-x pt-8">
        <Heading label="Ruang pribadi" title="Akun kamu" />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section data-reveal className="panel p-6">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand text-[28px] font-extrabold uppercase text-white">{user.name.slice(0, 1)}</span>
            <p className="mt-4 text-[22px] font-extrabold">{user.name}</p>
            <p className="text-ink-soft">{user.email}</p>
            <div className="mt-5">
              <ErrorBox error={error} />
            </div>
            <button
              className="btn btn-ghost mt-3 w-full"
              onClick={async () => {
                try {
                  await api("/auth/logout", {});
                  client.clear();
                  window.location.assign("/pm/login");
                } catch (e) {
                  setError(e);
                }
              }}
            >
              <LogOut className="h-4 w-4" /> Keluar dari akun
            </button>
          </section>
          <section data-reveal className="panel overflow-hidden">
            <p className="micro px-6 pb-3 pt-5 text-ink-soft">Akses aktif · {actives.length}</p>
            {actives.length ? (
              actives.map((m) => (
                <PmLink key={m.slug} to={`/pm/chat/${m.slug}`} className="group flex items-center gap-4 border-t border-line px-6 py-3 transition-colors hover:bg-surface">
                  <Avatar member={m} className="h-12 w-12 rounded-2xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold group-hover:text-brand">{m.member}</span>
                    <span className="block text-[13px] text-ink-soft">Sampai {date(m.expires_at!)}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-ink-soft transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
                </PmLink>
              ))
            ) : (
              <div className="border-t border-line px-6 py-8 text-ink-soft">
                Belum ada akses aktif.{" "}
                <PmLink to="/pm/shop" className="font-bold text-brand">
                  Pilih paket →
                </PmLink>
              </div>
            )}
          </section>
        </div>
      </div>
    </Page>
  );
}

/* ───────────────────────────── Media obrolan ───────────────────────────── */

/**
 * Media diambil lewat fetch() (worker menolak navigasi/embed langsung) lalu ditampilkan sebagai blob,
 * jadi alamat media tidak muncul di halaman dan tidak bisa dibuka di tab baru. Satu blob per alamat,
 * dibebaskan saat obrolan ditutup.
 */
const blobs = new Map<string, Promise<{ url: string; blob: Blob }>>();
function loadMedia(src: string) {
  let p = blobs.get(src);
  if (!p) {
    p = fetch(src, { credentials: "same-origin" }).then(async (r) => {
      if (!r.ok) throw new Error("Media belum dapat dimuat.");
      const blob = await r.blob();
      return { url: URL.createObjectURL(blob), blob };
    });
    p.catch(() => blobs.delete(src));
    blobs.set(src, p);
  }
  return p;
}
function releaseMedia() {
  for (const p of blobs.values()) void p.then((b) => URL.revokeObjectURL(b.url), () => {});
  blobs.clear();
}
function useMedia(src: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadMedia(src).then(
      (b) => live && setUrl(b.url),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [src]);
  return { url, failed };
}
const fileName = (src: string, member: string) => `JKT48Connect-${member.replace(/\s+/g, "_")}-${src.split("/").pop()}`;
const guard = {
  onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
  style: { WebkitTouchCallout: "none" } as const,
};

function SaveButton({ src, name, className, label }: { src: string; name: string; className?: string; label?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const icon = useRef<HTMLSpanElement>(null);
  async function save(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await loadMedia(src);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDone(true);
      gsap.fromTo(icon.current, { scale: 0.4, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.5, ease: "back.out(3)" });
      window.setTimeout(() => setDone(false), 1800);
    } catch {
      /* gagal diam-diam; tombol bisa dicoba lagi */
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={save}
      aria-label={"Simpan " + name}
      title="Simpan ke perangkat"
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-bold transition",
        label ? "bg-brand px-4 py-2 text-[13px] text-white hover:bg-brand-strong" : "h-9 w-9 justify-center bg-nav/75 text-white backdrop-blur hover:bg-brand",
        className,
      )}
    >
      <span ref={icon} className="grid place-items-center">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      </span>
      {label && (done ? "Tersimpan" : "Simpan")}
    </button>
  );
}

function Lightbox({ src, name, alt, onClose }: { src: string; name: string; alt: string; onClose: () => void }) {
  const { url } = useMedia(src);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(el.querySelector("[data-lb-img]"), { scale: 0.9, y: 20 }, { scale: 1, y: 0, duration: 0.45, ease: "power3.out" });
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  // Di-portal ke <body>: leluhur dengan transform (animasi GSAP) akan memotong position:fixed.
  return createPortal(
    <div ref={root} role="dialog" aria-modal="true" aria-label={alt} onClick={onClose} className="fixed inset-0 z-[90] flex flex-col bg-black/90 p-4 backdrop-blur-sm" {...guard}>
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <SaveButton src={src} name={name} label />
        <button type="button" onClick={onClose} aria-label="Tutup" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center py-4">
        {url ? (
          <img data-lb-img src={url} alt={alt} draggable={false} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full select-none rounded-2xl object-contain" {...guard} />
        ) : (
          <LoaderCircle data-lb-img className="h-8 w-8 animate-spin text-white/60" />
        )}
      </div>
    </div>,
    document.body,
  );
}

function ChatImage({ src, name, alt }: { src: string; name: string; alt: string }) {
  const { url, failed } = useMedia(src);
  const [open, setOpen] = useState(false);
  return (
    <div className="group/media relative mb-2 overflow-hidden rounded-2xl bg-surface" {...guard}>
      {url ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={"Perbesar " + alt} className="block w-full cursor-zoom-in">
          <img src={url} alt={alt} draggable={false} className="max-h-[420px] w-full select-none object-cover transition duration-500 group-hover/media:scale-[1.03]" {...guard} />
          <span className="pointer-events-none absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full bg-nav/60 text-white opacity-0 backdrop-blur transition group-hover/media:opacity-100">
            <ZoomIn className="h-4 w-4" />
          </span>
        </button>
      ) : failed ? (
        <p className="px-4 py-8 text-center text-[13px] text-ink-soft">Gambar belum dapat dimuat.</p>
      ) : (
        <Skeleton className="h-56 w-full rounded-none" />
      )}
      {url && <SaveButton src={src} name={name} className="absolute right-2 top-2" />}
      {open && <Lightbox src={src} name={name} alt={alt} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ChatMedia({ src, member }: { src: string; member: string }) {
  const name = fileName(src, member);
  if (/\.mp4$/i.test(src))
    return (
      <div className="relative mb-2" {...guard}>
        <video src={src} controls controlsList="nodownload" disablePictureInPicture playsInline preload="none" className="max-h-[420px] w-full rounded-2xl bg-black" {...guard} />
        <SaveButton src={src} name={name} className="absolute right-2 top-2" />
      </div>
    );
  if (/\.(m4a|amr|mp3|ogg|wav)$/i.test(src))
    return (
      <div className="mb-2 flex items-center gap-2" {...guard}>
        <audio src={src} controls controlsList="nodownload" preload="none" className="min-w-0 flex-1" />
        <SaveButton src={src} name={name} className="!bg-surface !text-ink hover:!bg-brand hover:!text-white" />
      </div>
    );
  return <ChatImage src={src} name={name} alt={"Foto dari " + member} />;
}

/* ───────────────────────────── Obrolan ───────────────────────────── */

function Chat({ slug, member }: { slug: string; member?: Member }) {
  const [live, setLive] = useState<Message[]>([]);
  const [error, setError] = useState<unknown>(null);
  const after = useRef("");
  const feed = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  useEffect(() => releaseMedia, [slug]);
  const q = useInfiniteQuery({
    queryKey: ["pm", "messages", slug],
    queryFn: ({ pageParam }) => api<Messages>(`/messages/${encodeURIComponent(slug)}?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.pagination?.has_next ? all.length + 1 : undefined),
    retry: false,
  });
  const messages = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of [...(q.data?.pages.flatMap((p) => p.messages) || []), ...live]) map.set(m.message_id, m);
    return [...map.values()].sort((a, b) => a.sequence_order - b.sequence_order);
  }, [q.data, live]);
  after.current = messages.at(-1)?.message_id || "";

  useEffect(() => {
    let stopped = false,
      working = false;
    const t = window.setInterval(async () => {
      if (document.hidden || working || !after.current) return;
      working = true;
      try {
        const r = await api<Messages>(`/messages/${encodeURIComponent(slug)}/latest?afterId=${encodeURIComponent(after.current)}`);
        if (!stopped) {
          setLive((v) => [...v, ...r.messages]);
          setError(null);
        }
      } catch (e) {
        if (!stopped) setError(e);
      } finally {
        working = false;
      }
    }, 20000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [slug]);

  // Gelembung baru masuk bertahap; pertama kali dan saat ada pesan baru, gulir ke bawah.
  useLayoutEffect(() => {
    const el = feed.current;
    if (!el || !messages.length) return;
    const fresh = [...el.querySelectorAll<HTMLElement>("[data-bubble]")].filter((b) => !seen.current.has(b.dataset.bubble!));
    const firstPaint = seen.current.size === 0;
    const newest = messages.at(-1)!.message_id;
    const atEnd = fresh.some((b) => b.dataset.bubble === newest);
    fresh.forEach((b) => seen.current.add(b.dataset.bubble!));
    gsap.fromTo(fresh.slice(-12), { opacity: 0, y: 18, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.04, ease: "power3.out", clearProps: "transform" });
    if (firstPaint || atEnd) el.scrollTo({ top: el.scrollHeight, behavior: firstPaint ? "auto" : "smooth" });
  }, [messages]);

  // Media yang selesai dimuat menambah tinggi feed; tetap menempel di bawah bila pembaca memang di bawah.
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    let stick = true;
    const onScroll = () => void (stick = el.scrollHeight - el.scrollTop - el.clientHeight < 120);
    const onLoad = () => void (stick && (el.scrollTop = el.scrollHeight));
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("load", onLoad, true);
    el.addEventListener("loadedmetadata", onLoad, true);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("load", onLoad, true);
      el.removeEventListener("loadedmetadata", onLoad, true);
    };
  }, []);

  return (
    <div className="container-x pt-6">
      <section className="panel flex h-[calc(100dvh-240px)] min-h-[440px] flex-col overflow-hidden lg:h-[calc(100dvh-120px)]">
        <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-5">
          <PmLink to="/pm" aria-label="Kembali ke daftar member" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-surface hover:text-brand">
            <ArrowLeft className="h-5 w-5" />
          </PmLink>
          {member && <Avatar member={member} className="h-11 w-11 rounded-full ring-2 ring-brand" />}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[18px] font-extrabold leading-tight">{member?.member || slug.replaceAll("_", " ")}</h1>
            <p className="micro flex items-center gap-2 text-ink-soft">
              <SignalBars className="text-brand" /> Private messages · pembaruan otomatis
            </p>
          </div>
          <LockKeyhole className="h-4 w-4 text-ink-soft" />
        </header>

        <div ref={feed} className="thin-scrollbar flex-1 space-y-3 overflow-y-auto bg-bg px-3 py-5 sm:px-6">
          <ErrorBox error={q.error || error} />
          {q.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-3xl" />
              ))}
            </div>
          ) : (
            q.hasNextPage && (
              <div className="text-center">
                <button className="btn btn-ghost" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                  {q.isFetchingNextPage ? "Memuat…" : "Muat pesan sebelumnya"}
                </button>
              </div>
            )
          )}
          {!q.isPending && !q.error && !messages.length && (
            <div className="grid h-full place-items-center text-center">
              <div>
                <MessageCircle className="mx-auto h-10 w-10 text-brand" />
                <p className="mt-3 text-[18px] font-extrabold">Belum ada pesan.</p>
                <p className="text-ink-soft">Kabar baru akan muncul di sini.</p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <article key={m.message_id} data-bubble={m.message_id} className="flex max-w-[min(560px,88%)] items-end gap-2">
              {member ? <Avatar member={member} className="h-8 w-8 rounded-full" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-blush" />}
              <div className="min-w-0 rounded-3xl rounded-bl-md border border-line bg-card p-3 shadow-[0_8px_20px_-16px_rgb(0_0_0/0.4)]">
                {m.media_urls.map((src) => (
                  <ChatMedia key={src} src={src} member={member?.member || slug.replaceAll("_", " ")} />
                ))}
                {m.text && <p className="whitespace-pre-wrap break-words px-1 text-[15px] leading-relaxed">{m.text}</p>}
                {m.is_poll && (
                  <div className="mt-2 rounded-2xl bg-blush p-3">
                    <p className="micro text-brand">Polling member</p>
                    <p className="mt-1 font-semibold">
                      {typeof m.poll === "object" && m.poll
                        ? String((m.poll as Record<string, unknown>).question || "Lihat pesan member untuk detail polling.")
                        : "Lihat pesan member untuk detail polling."}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-soft">Voting tidak tersedia melalui layanan ini.</p>
                  </div>
                )}
                <time className="mt-1.5 block px-1 font-mono text-[10px] text-ink-soft">{m.created_at}</time>
              </div>
            </article>
          ))}
        </div>

        <footer className="flex items-center justify-center gap-2 border-t border-line bg-card px-4 py-3 text-[12px] text-ink-soft">
          <LockKeyhole className="h-3.5 w-3.5" /> Pesan satu arah dari member. Balasan tidak tersedia.
        </footer>
      </section>
    </div>
  );
}

/* ───────────────────────────── Halaman ───────────────────────────── */

export function PmPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Private Messages — JKT48Connect";
    return () => {
      document.title = previous;
    };
  }, []);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ["pm", "me"],
    queryFn: () => api<{ user: User | null; plans: Record<string, Plan> }>("/me"),
    retry: false,
  });
  const user = me.data?.user;
  const catalog = useQuery({
    queryKey: ["pm", "members"],
    queryFn: () => api<{ data: Member[] }>("/conversations"),
    enabled: !!user,
    refetchInterval: 60000,
    retry: false,
  });
  const members = catalog.data?.data || [];
  const chat = path.startsWith("/pm/chat/") ? decodeURIComponent(path.slice("/pm/chat/".length)) : null;
  const auth = path === "/pm/register" || path === "/pm/login";
  const body = useRef<HTMLDivElement>(null);

  // Ganti tab: konten masuk dari bawah.
  useLayoutEffect(() => {
    if (!body.current) return;
    gsap.fromTo(body.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", clearProps: "transform,opacity" });
  }, [path]);

  if (me.isPending) {
    return (
      <div className="container-x space-y-4 pt-6" role="status" aria-label="Menyiapkan ruang kamu">
        <Skeleton className="h-44 rounded-[28px]" />
        <Skeleton className="h-12 w-80 rounded-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (me.error) {
    return (
      <div className="container-x space-y-3 pt-8">
        <ErrorBox error={me.error} />
        <button className="btn btn-primary" onClick={() => void me.refetch()}>
          Coba lagi
        </button>
      </div>
    );
  }
  if (!user || auth) {
    return (
      <Auth
        register={path === "/pm/register"}
        onDone={() => {
          client.clear();
          window.location.assign("/pm");
        }}
      />
    );
  }

  return (
    <>
      {!chat && <PmHeader user={user} members={members} path={path} chat={chat} />}
      <div ref={body}>
        {path === "/pm/shop" ? (
          catalog.isPending ? (
            <div className="container-x pt-8">
              <Skeleton className="h-[420px] rounded-3xl" />
            </div>
          ) : (
            <>
              <div className="container-x">
                <ErrorBox error={catalog.error} />
              </div>
              <Shop members={members} plans={me.data!.plans} />
            </>
          )
        ) : path.startsWith("/pm/pay/") ? (
          <Pay key={path} id={path.slice("/pm/pay/".length)} />
        ) : path === "/pm/transactions" ? (
          <Transactions />
        ) : path === "/pm/account" ? (
          <Account user={user} members={members} />
        ) : chat ? (
          <Chat key={chat} slug={chat} member={members.find((m) => m.slug === chat)} />
        ) : (
          <Home members={members} loading={catalog.isPending} error={catalog.error} />
        )}
      </div>
      {!chat && (
        <div className="container-x pt-10">
          <p data-reveal className="flex items-center gap-2 text-[12px] text-ink-soft">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Fan-made, with love. Tidak berafiliasi dengan JKT48 Operation Team.
          </p>
        </div>
      )}
    </>
  );
}
