import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CreditCard,
  Heart,
  History,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import "./pm.css";

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
const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const date = (n: number) =>
  new Date(n * 1000).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " WIB";
const statusLabel: Record<string, string> = {
  PENDING: "Menunggu pembayaran",
  SUCCESS: "Berhasil",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  FAILED: "Gagal",
  CREATING: "Memproses",
};
const active = (m: Member) =>
  !!m.expires_at && m.expires_at * 1000 > Date.now();
function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <p className="pm-error" role="alert">
      {error instanceof Error ? error.message : "Terjadi kesalahan."}
    </p>
  ) : null;
}
function Avatar({ member }: { member: Member }) {
  const [broken, setBroken] = useState(false);
  return member.avatar && !broken ? (
    <img
      className="pm-avatar"
      src={member.avatar}
      alt={member.member}
      onError={() => setBroken(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <span className="pm-avatar pm-initial">{member.member.slice(0, 1)}</span>
  );
}
function Auth({ register, onDone }: { register: boolean; onDone: () => void }) {
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api(
        "/auth/" + (register ? "register" : "login"),
        Object.fromEntries(form),
      );
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pm-auth">
      <section className="pm-auth-story">
        <span className="pm-eyebrow">JKT48CONNECT / PRIVATE MESSAGES</span>
        <div className="pm-orbit">
          <Heart size={76} strokeWidth={1.2} />
          <span>48</span>
        </div>
        <h1>
          Lebih dekat.
          <br />
          <em>Setiap cerita.</em>
        </h1>
        <p>Tempat kecil untuk kabar, foto, dan momen dari member favoritmu.</p>
        <div className="pm-trust">
          <ShieldCheck size={18} /> Akun pribadi · akses pilihanmu
        </div>
      </section>
      <section className="pm-auth-form">
        <span className="pm-eyebrow">YOUR OSHI, YOUR SPACE</span>
        <h2>{register ? "Mulai cerita kamu." : "Senang kamu kembali."}</h2>
        <p>
          {register
            ? "Buat akun untuk memilih member dan membuka pesan."
            : "Masuk untuk melanjutkan membaca pesan member favoritmu."}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Nama
              <input
                name="name"
                required
                minLength={2}
                maxLength={60}
                autoComplete="name"
                placeholder="Nama panggilan kamu"
              />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder="kamu@email.com"
            />
          </label>
          <label>
            Kata sandi
            <input
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="Minimal 10 karakter"
            />
          </label>
          <ErrorBox error={error} />
          <button className="pm-button" disabled={busy}>
            {busy ? "Sebentar…" : register ? "Buat akun" : "Masuk ke PM"}
            <ArrowUpRight size={18} />
          </button>
        </form>
        <p className="pm-auth-switch">
          {register ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
          <a href={register ? "/pm/login" : "/pm/register"}>
            {register ? "Masuk" : "Daftar sekarang"}
          </a>
        </p>
        <small>Fan-made. Tidak berafiliasi dengan JKT48 Operation Team.</small>
      </section>
    </div>
  );
}
function Shop({
  members,
  plans,
}: {
  members: Member[];
  plans: Record<string, Plan>;
}) {
  const [member, setMember] = useState(""),
    [plan, setPlan] = useState("monthly"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const selected = members.find((m) => m.slug === member);
  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>("/orders", { member, plan });
      window.location.assign("/pm/pay/" + r.id);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  return (
    <>
      <div className="pm-heading">
        <span className="pm-eyebrow">PILIH KONEKSIMU</span>
        <h1>
          Satu member.
          <br />
          <em>Banyak cerita.</em>
        </h1>
        <p>Setiap paket membuka pesan dan media dari satu member pilihanmu.</p>
      </div>
      <div className="pm-shop">
        <section className="pm-panel">
          <span className="pm-step">01 / MEMBER FAVORIT</span>
          <label>
            Pilih member
            <select value={member} onChange={(e) => setMember(e.target.value)}>
              <option value="">Pilih member kamu</option>
              {members.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.member}
                  {active(m) ? " · Akses aktif" : ""}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="pm-selected">
              <Avatar member={selected} />
              <div>
                <strong>{selected.member}</strong>
                <p>
                  {active(selected)
                    ? `Aktif sampai ${date(selected.expires_at!)}`
                    : "Siap untuk mengenal lebih dekat?"}
                </p>
              </div>
            </div>
          )}
          <span className="pm-step">02 / DURASI AKSES</span>
          <div className="pm-plans">
            {Object.entries(plans).map(([key, p]) => (
              <button
                className={"pm-plan " + (plan === key ? "selected" : "")}
                key={key}
                onClick={() => setPlan(key)}
                aria-pressed={plan === key}
              >
                {key === "monthly" && (
                  <span className="pm-badge">PALING HEMAT</span>
                )}
                <strong>{p.name}</strong>
                <span>{p.days} hari akses</span>
                <b>{rupiah(p.price)}</b>
                <span>{plan === key ? "● Dipilih" : "○ Pilih paket"}</span>
              </button>
            ))}
          </div>
        </section>
        <aside className="pm-panel pm-summary">
          <span className="pm-step">RINGKASAN PILIHAN</span>
          <Heart size={36} />
          <h2>{selected?.member || "Oshi pilihanmu"}</h2>
          <p>
            {plans[plan]?.name} · {plans[plan]?.days} hari
          </p>
          <div className="pm-total">
            <span>Total paket</span>
            <strong>{rupiah(plans[plan]?.price || 0)}</strong>
          </div>
          <p className="pm-muted">
            Nominal QR dapat mencakup kode unik dari gateway. Akses aktif
            setelah pembayaran terverifikasi. Pembelian ulang menambah masa
            aktif.
          </p>
          <ErrorBox error={error} />
          <button
            className="pm-button"
            disabled={!member || busy}
            onClick={buy}
          >
            {busy ? "Menyiapkan QR…" : "Lanjut pembayaran"}
            <ArrowUpRight size={18} />
          </button>
          <small>
            <ShieldCheck size={15} /> Bayar QR di halaman JKT48Connect
          </small>
        </aside>
      </div>
    </>
  );
}
function Pay({ id }: { id: string }) {
  const client = useQueryClient();
  const [actionError, setActionError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now());
  const query = useQuery({
    queryKey: ["pm", "order", id],
    queryFn: () => api<{ data: Order }>("/orders/" + id + "/check", {}),
    refetchInterval: (q) =>
      q.state.data?.data.status === "PENDING" ? 10000 : false,
    retry: false,
  });
  const order = query.data?.data;
  useEffect(() => {
    const t = window.setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (order?.status === "SUCCESS")
      void client.invalidateQueries({ queryKey: ["pm", "members"] });
  }, [order?.status, client]);
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
  const expiry = order?.expired_at
    ? new Date(order.expired_at.replace(" ", "T") + "+07:00").getTime()
    : NaN;
  const seconds = Math.max(0, Math.ceil((expiry - clock) / 1000));
  return (
    <>
      <div className="pm-heading">
        <span className="pm-eyebrow">CHECKOUT / QR PAYMENT</span>
        <h1>
          {order?.status === "SUCCESS"
            ? "Cerita baru menantimu."
            : "Satu langkah lagi."}
        </h1>
        <p>Akses kamu diaktifkan setelah status pembayaran dikonfirmasi.</p>
      </div>
      <ErrorBox error={query.error || actionError} />
      {query.isPending ? (
        <p role="status">Memuat pembayaran…</p>
      ) : (
        order && (
          <div className="pm-checkout">
            <section className="pm-panel pm-qr">
              <span className={"pm-status " + order.status}>
                {statusLabel[order.status] || order.status}
              </span>
              {order.status === "PENDING" && order.qr_image ? (
                <>
                  <img
                    src={order.qr_image}
                    alt="Kode QR pembayaran"
                    referrerPolicy="no-referrer"
                  />
                  <p>Scan dengan aplikasi bank atau dompet digital.</p>
                  {Number.isFinite(expiry) && (
                    <strong className="pm-timer">
                      {seconds > 0
                        ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
                        : "Waktu QR habis · menunggu konfirmasi gateway"}
                    </strong>
                  )}
                </>
              ) : (
                <div className="pm-payment-result">
                  {order.status === "SUCCESS" ? (
                    <Check size={72} />
                  ) : (
                    <CreditCard size={72} />
                  )}
                  <h2>{statusLabel[order.status]}</h2>
                  {order.status === "SUCCESS" && (
                    <a className="pm-button" href={"/pm/chat/" + order.member}>
                      Buka pesan
                      <ArrowUpRight size={18} />
                    </a>
                  )}
                </div>
              )}
            </section>
            <section className="pm-panel pm-summary">
              <span className="pm-step">DETAIL TRANSAKSI</span>
              <h2>{order.member_name}</h2>
              <p>{order.days} hari akses</p>
              <dl>
                <dt>Harga paket</dt>
                <dd>{rupiah(order.price)}</dd>
                <dt>Kode unik / penyesuaian</dt>
                <dd>{rupiah((order.amount ?? order.price) - order.price)}</dd>
                <dt>Total bayar</dt>
                <dd>
                  <strong>{rupiah(order.amount ?? order.price)}</strong>
                </dd>
                <dt>ID transaksi</dt>
                <dd className="pm-break">{order.id}</dd>
                <dt>Dibuat</dt>
                <dd>{date(order.created_at)}</dd>
              </dl>
              {order.status === "PENDING" && (
                <>
                  <button
                    className="pm-button"
                    disabled={query.isFetching || busy}
                    onClick={() => void query.refetch()}
                  >
                    {query.isFetching ? "Memeriksa…" : "Cek pembayaran"}
                  </button>
                  <button
                    className="pm-text-button"
                    disabled={busy || query.isFetching}
                    onClick={cancel}
                  >
                    {busy ? "Memproses…" : "Batalkan transaksi"}
                  </button>
                </>
              )}
              <a href="/pm/transactions">Lihat riwayat transaksi →</a>
            </section>
          </div>
        )
      )}
    </>
  );
}
function Transactions() {
  const q = useQuery({
    queryKey: ["pm", "orders"],
    queryFn: () => api<{ data: Order[] }>("/orders"),
  });
  return (
    <>
      <div className="pm-heading">
        <span className="pm-eyebrow">CATATAN KONEKSI</span>
        <h1>Riwayat transaksi.</h1>
        <p>
          Pantau pembayaran dan buka kembali QR yang masih aktif. Menampilkan
          100 transaksi terbaru.
        </p>
      </div>
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <p role="status">Memuat transaksi…</p>
      ) : q.data?.data.length ? (
        <div className="pm-transactions">
          {q.data.data.map((o) => (
            <a
              key={o.id}
              className="pm-panel pm-transaction"
              href={"/pm/pay/" + o.id}
            >
              <CreditCard />
              <div>
                <strong>{o.member_name}</strong>
                <p>
                  {o.days} hari · {date(o.created_at)}
                </p>
              </div>
              <b>{rupiah(o.amount ?? o.price)}</b>
              <span className={"pm-status " + o.status}>
                {statusLabel[o.status] || o.status}
              </span>
              <ArrowUpRight size={18} />
            </a>
          ))}
        </div>
      ) : (
        !q.error && (
          <div className="pm-empty">
            <History size={48} />
            <h2>Belum ada transaksi.</h2>
            <p>Pilih member dan paket untuk memulai.</p>
            <a className="pm-button" href="/pm/shop">
              Pilih akses
            </a>
          </div>
        )
      )}
    </>
  );
}
function Chat({ slug, member }: { slug: string; member?: Member }) {
  const [live, setLive] = useState<Message[]>([]),
    [error, setError] = useState<unknown>(null);
  const after = useRef("");
  const q = useInfiniteQuery({
    queryKey: ["pm", "messages", slug],
    queryFn: ({ pageParam }) =>
      api<Messages>(`/messages/${encodeURIComponent(slug)}?page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) =>
      last.pagination?.has_next ? all.length + 1 : undefined,
    retry: false,
  });
  const messages = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of [
      ...(q.data?.pages.flatMap((p) => p.messages) || []),
      ...live,
    ])
      map.set(m.message_id, m);
    return [...map.values()].sort(
      (a, b) => a.sequence_order - b.sequence_order,
    );
  }, [q.data, live]);
  after.current = messages.at(-1)?.message_id || "";
  useEffect(() => {
    let stopped = false,
      working = false;
    const t = window.setInterval(async () => {
      if (document.hidden || working || !after.current) return;
      working = true;
      try {
        const r = await api<Messages>(
          `/messages/${encodeURIComponent(slug)}/latest?afterId=${encodeURIComponent(after.current)}`,
        );
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
  return (
    <div className="pm-chat">
      <div className="pm-chat-title">
        <a href="/pm" aria-label="Kembali ke daftar member">
          <ArrowLeft />
        </a>
        {member && <Avatar member={member} />}
        <div>
          <h1>{member?.member || slug.replaceAll("_", " ")}</h1>
          <p>PRIVATE MESSAGES · Pembaruan otomatis</p>
        </div>
        <LockKeyhole size={18} />
      </div>
      <div className="pm-chat-feed">
        <ErrorBox error={q.error || error} />
        {q.isPending ? (
          <p role="status">Memuat pesan…</p>
        ) : (
          q.hasNextPage && (
            <button
              className="pm-load"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? "Memuat…" : "Muat pesan sebelumnya"}
            </button>
          )
        )}
        {!q.isPending && !q.error && !messages.length && (
          <div className="pm-empty">
            <MessageCircle size={40} />
            <h2>Belum ada pesan.</h2>
            <p>Kabar baru akan muncul di sini.</p>
          </div>
        )}
        {messages.map((m) => (
          <article className="pm-bubble" key={m.message_id}>
            {m.media_urls.map((src) =>
              /\.mp4$/i.test(src) ? (
                <video
                  key={src}
                  src={src}
                  controls
                  playsInline
                  preload="none"
                />
              ) : /\.(m4a|amr|mp3|ogg|wav)$/i.test(src) ? (
                <div key={src}>
                  <audio src={src} controls preload="none" />
                  <a href={src} target="_blank" rel="noreferrer">
                    Buka audio
                  </a>
                </div>
              ) : (
                <a href={src} key={src} target="_blank" rel="noreferrer">
                  <img
                    src={src}
                    alt={"Media dari " + (member?.member || slug)}
                    loading="lazy"
                  />
                </a>
              ),
            )}
            {m.text && <p>{m.text}</p>}
            {m.is_poll && (
              <div className="pm-poll">
                <strong>Polling member</strong>
                <p>
                  {typeof m.poll === "object" && m.poll
                    ? String(
                        (m.poll as Record<string, unknown>).question ||
                          "Lihat pesan member untuk detail polling.",
                      )
                    : "Lihat pesan member untuk detail polling."}
                </p>
                <small>Voting tidak tersedia melalui layanan ini.</small>
              </div>
            )}
            <time>{m.created_at}</time>
          </article>
        ))}
      </div>
      <div className="pm-chat-note">
        <LockKeyhole size={14} /> Pesan satu arah dari member. Balasan tidak
        tersedia.
      </div>
    </div>
  );
}
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
    queryFn: () =>
      api<{ user: User | null; plans: Record<string, Plan> }>("/me"),
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
  const [search, setSearch] = useState(""),
    [logoutError, setLogoutError] = useState<unknown>(null);
  const members = catalog.data?.data || [],
    chat = path.startsWith("/pm/chat/")
      ? decodeURIComponent(path.slice("/pm/chat/".length))
      : null;
  const nav = [
    { href: "/pm", label: "Pesan", icon: MessageCircle },
    { href: "/pm/shop", label: "Beli akses", icon: Heart },
    { href: "/pm/transactions", label: "Transaksi", icon: History },
    { href: "/pm/account", label: "Akun", icon: Users },
  ];
  const auth = path === "/pm/register" || path === "/pm/login";
  return (
    <div className="pm-app">
      <header className="pm-top">
        <Link to="/" className="pm-brand">
          JKT48<span>CONNECT</span>
          <b>PM</b>
        </Link>
        <a className="pm-back" href="/">
          <ArrowLeft size={15} /> Ke situs utama
        </a>
      </header>
      {me.isPending ? (
        <div className="pm-empty" role="status">
          Menyiapkan ruang kamu…
        </div>
      ) : me.error ? (
        <div className="pm-content">
          <ErrorBox error={me.error} />
          <button className="pm-button" onClick={() => void me.refetch()}>
            Coba lagi
          </button>
        </div>
      ) : !user || auth ? (
        <Auth
          register={path === "/pm/register"}
          onDone={() => {
            client.clear();
            window.location.assign("/pm");
          }}
        />
      ) : (
        <>
          <div className="pm-body">
            <aside className="pm-sidebar">
              <span className="pm-eyebrow">YOUR PRIVATE SPACE</span>
              <h2>
                Halo, {user.name.split(" ")[0]}
                <span className="pm-dot" />
              </h2>
              <nav aria-label="Navigasi Private Messages">
                {nav.map((n) => (
                  <a
                    key={n.href}
                    href={n.href}
                    aria-current={
                      (
                        n.href === "/pm"
                          ? path === "/pm" || !!chat
                          : path.startsWith(n.href)
                      )
                        ? "page"
                        : undefined
                    }
                  >
                    <n.icon size={19} />
                    {n.label}
                    <ArrowUpRight size={16} />
                  </a>
                ))}
              </nav>
              <div className="pm-side-card">
                <Sparkles size={24} />
                <h3>
                  Kabar kecil.
                  <br />
                  Rasa dekat.
                </h3>
                <p>Pilih member favoritmu dan ikuti ceritanya setiap hari.</p>
                <a href="/pm/shop">Temukan koneksimu ↗</a>
              </div>
              <span className="pm-side-foot">
                FAN-MADE, WITH LOVE.
                <br />
                JKT48CONNECT © 2026
              </span>
            </aside>
            <main className="pm-content" id="konten">
              {path === "/pm/shop" ? (
                <>
                  <ErrorBox error={catalog.error} />
                  {catalog.isPending ? (
                    <p role="status">Memuat pilihan member…</p>
                  ) : (
                    <Shop members={members} plans={me.data!.plans} />
                  )}
                </>
              ) : path.startsWith("/pm/pay/") ? (
                <Pay key={path} id={path.slice("/pm/pay/".length)} />
              ) : path === "/pm/transactions" ? (
                <Transactions />
              ) : path === "/pm/account" ? (
                <>
                  <div className="pm-heading">
                    <span className="pm-eyebrow">RUANG PRIBADI</span>
                    <h1>Akun kamu.</h1>
                  </div>
                  <section className="pm-panel">
                    <h2>{user.name}</h2>
                    <p>{user.email}</p>
                    <h3>Akses aktif</h3>
                    {members.filter(active).map((m) => (
                      <div className="pm-account-member" key={m.slug}>
                        <Avatar member={m} />
                        <div>
                          <a href={"/pm/chat/" + m.slug}>{m.member} ↗</a>
                          <p>Sampai {date(m.expires_at!)}</p>
                        </div>
                      </div>
                    ))}
                    {!members.some(active) && (
                      <p>
                        Belum ada akses aktif.{" "}
                        <a href="/pm/shop">Pilih paket →</a>
                      </p>
                    )}
                    <ErrorBox error={logoutError} />
                    <button
                      className="pm-button"
                      onClick={async () => {
                        try {
                          await api("/auth/logout", {});
                          client.clear();
                          window.location.assign("/pm/login");
                        } catch (e) {
                          setLogoutError(e);
                        }
                      }}
                    >
                      <LogOut size={18} /> Keluar dari akun
                    </button>
                  </section>
                </>
              ) : chat ? (
                <Chat
                  key={chat}
                  slug={chat}
                  member={members.find((m) => m.slug === chat)}
                />
              ) : (
                <>
                  <div className="pm-heading pm-home-heading">
                    <div>
                      <span className="pm-eyebrow">
                        A LITTLE CLOSER, EVERY DAY
                      </span>
                      <h1>
                        Pesan dari
                        <br />
                        <em>oshi kamu.</em>
                        <span className="pm-heading-dot">✳</span>
                      </h1>
                      <p>
                        Potongan hari, cerita kecil, dan momen yang terasa
                        dekat.
                      </p>
                    </div>
                    <div className="pm-home-count">
                      <b>
                        {members
                          .filter(active)
                          .length.toString()
                          .padStart(2, "0")}
                      </b>
                      <span>AKSES AKTIF</span>
                    </div>
                  </div>
                  <div className="pm-section-head">
                    <h2>
                      Temukan member <span>/ {members.length}</span>
                    </h2>
                    <label className="pm-search">
                      <Search size={18} />
                      <input
                        aria-label="Cari member"
                        placeholder="Cari oshi kamu…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  <ErrorBox error={catalog.error} />
                  {catalog.isPending ? (
                    <p role="status">Memuat member…</p>
                  ) : (
                    <div className="pm-member-grid">
                      {members
                        .filter((m) =>
                          m.member.toLowerCase().includes(search.toLowerCase()),
                        )
                        .map((m, i) => (
                          <a
                            className="pm-member-card"
                            href={active(m) ? "/pm/chat/" + m.slug : "/pm/shop"}
                            key={m.slug}
                          >
                            <div className="pm-member-photo">
                              <Avatar member={m} />
                              <span className="pm-member-number">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span
                                className={
                                  "pm-member-lock " +
                                  (active(m) ? "unlocked" : "")
                                }
                              >
                                {active(m) ? (
                                  <Check size={16} />
                                ) : (
                                  <LockKeyhole size={16} />
                                )}
                              </span>
                            </div>
                            <div className="pm-member-info">
                              <h3>{m.member}</h3>
                              <p>
                                {active(m)
                                  ? "Buka pesan"
                                  : "Pilih akses member"}
                                <ArrowUpRight size={17} />
                              </p>
                            </div>
                          </a>
                        ))}
                    </div>
                  )}
                  {!catalog.isPending &&
                    !catalog.error &&
                    (!members.length ||
                      !members.some((m) =>
                        m.member.toLowerCase().includes(search.toLowerCase()),
                      )) && (
                      <div className="pm-empty">
                        <Search size={32} />
                        <p>
                          {members.length
                            ? "Member tidak ditemukan."
                            : "Belum ada member tersedia."}
                        </p>
                      </div>
                    )}
                </>
              )}
            </main>
          </div>
          <nav className="pm-mobile-nav" aria-label="Navigasi PM mobile">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                aria-current={
                  (
                    n.href === "/pm"
                      ? path === "/pm" || !!chat
                      : path.startsWith(n.href)
                  )
                    ? "page"
                    : undefined
                }
              >
                <n.icon size={21} />
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
