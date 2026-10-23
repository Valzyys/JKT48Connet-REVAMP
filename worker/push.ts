/**
 * Server push ke aplikasi Android lewat Firebase Cloud Messaging (FCM HTTP v1).
 *
 * Cron Cloudflare (wrangler.jsonc → triggers.crons) memanggil Durable Object `PushState` (push-do.ts) tiap 2 menit.
 * Tiap putaran: ambil data upstream → bandingkan dengan yang sudah dikirim → kirim ke topik FCM.
 *   - live      : tiap putaran (member mulai live)
 *   - show      : tiap 10 menit (show/event dimulai ≤ 65 menit lagi)
 *   - birthday  : tiap 10 menit, mulai 07.00 WIB (sekali per member per tahun)
 *   - news      : tiap 10 menit (berita baru di halaman 1)
 *   - update    : tiap 10 menit (release "latest" GitHub dengan versi baru)
 * Aplikasi berlangganan topik `jkc-<jenis>` sesuai sakelar notifikasinya, jadi worker tidak menyimpan token perangkat.
 * Pertama kali (memori kosong) hanya mencatat, supaya tidak membanjiri.
 *
 * File ini tanpa import Cloudflare supaya bisa dites di Node; pengambilan data disuntikkan oleh push-do.ts.
 */
import {
  shapeBirthdays,
  shapeLive,
  shapeNewsList,
  shapeNextSchedule,
  shapeTheaterList,
  type BirthdayEntry,
  type LiveSession,
  type NewsItem,
  type TheaterShow,
} from "../src/lib/shape";

export interface PushEnv {
  /** Secret: isi JSON service account Firebase (Project settings → Service accounts → Generate new private key). */
  FCM_SERVICE_ACCOUNT?: string;
  /** "App ID" aplikasi Android di Firebase (1:<nomor proyek>:android:<hash>), dari google-services.json. */
  FCM_ANDROID_APP_ID?: string;
  /** "Web API key" / `current_key` di google-services.json (pengenal publik, bukan rahasia). */
  FCM_ANDROID_API_KEY?: string;
}

export type PushKind = "live" | "show" | "birthday" | "news" | "update";
export const TOPIC_PREFIX = "jkc-";

export type PushMessage = { kind: PushKind; id: string; title: string; body: string; open: string; image: string; ttl: number };
export type PushMemory = { live?: string[]; show?: string[]; birthday?: string[]; news?: string[]; update?: string };
export type Release = { version: string; notes: string };
/** Data satu putaran; field yang tidak diambil/gagal = undefined (memorinya dibiarkan). */
export type Snapshot = { live?: LiveSession[]; shows?: TheaterShow[]; birthdays?: BirthdayEntry[]; news?: NewsItem[]; release?: Release };

const WIB = 7 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");
const wib = (ms: number) => new Date(ms + WIB);
const platformLabel = (p: string) => (p === "idn" ? "IDN Live" : p === "showroom" ? "Showroom" : p.toUpperCase());
/** "2.10.0" > "2.9.3" (bagian yang hilang = 0). */
export function newerVersion(a: string, b: string): boolean {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

/** Simpan ID terbaru di depan; ID lama hanya mengisi sisa kuota. */
const keep = (fresh: string[], older: string[] = [], max = 100) => [...fresh, ...older.filter((x) => !fresh.includes(x))].slice(0, max);

/** Tentukan pesan yang perlu dikirim dan memori berikutnya. Murni (tanpa jaringan), untuk dites. */
export function planPush(mem: PushMemory, snap: Snapshot, now: number): { messages: PushMessage[]; memory: PushMemory } {
  const messages: PushMessage[] = [];
  const next: PushMemory = { ...mem };

  if (snap.live) {
    const key = (l: LiveSession) => `${l.id}|${l.startedAt}`;
    const keys = snap.live.map(key);
    if (mem.live) {
      for (const l of snap.live.filter((l) => !mem.live!.includes(key(l))).slice(0, 5)) {
        messages.push({
          kind: "live",
          id: key(l),
          title: `${l.name} sedang live`,
          body: `${l.title || `Live di ${platformLabel(l.platform)}`} · ${platformLabel(l.platform)}`,
          open: "tab:1",
          image: l.banner || l.img || l.avatar,
          ttl: 30 * 60,
        });
      }
    }
    next.live = keep(keys, mem.live);
  }

  if (snap.shows) {
    const sent = mem.show ?? [];
    const soon = snap.shows.filter((s) => {
      const start = Date.parse(s.date);
      return Number.isFinite(start) && start - now >= 0 && start - now <= 65 * 60_000 && !sent.includes(s.id);
    });
    for (const s of soon.slice(0, 3)) {
      const t = wib(Date.parse(s.date));
      const who = s.team || (s.members.length ? `${s.members.length} member tampil` : "");
      messages.push({
        kind: "show",
        id: s.id,
        title: `${s.title} dimulai ${pad(t.getUTCHours())}.${pad(t.getUTCMinutes())} WIB`,
        body: ["Show akan segera dimulai", who].filter(Boolean).join(" · "),
        open: `theater:${s.id}|${s.title}`,
        image: s.banner || s.poster,
        ttl: 60 * 60,
      });
    }
    next.show = keep(soon.map((s) => s.id), sent, 60);
  }

  if (snap.birthdays && wib(now).getUTCHours() >= 7) {
    const today = wib(now);
    const year = today.getUTCFullYear();
    const sent = mem.birthday ?? [];
    const todays = snap.birthdays.filter((b) => {
      const ms = Date.parse(b.birthdate);
      if (!Number.isFinite(ms)) return false;
      const d = wib(ms);
      return d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate() && !sent.includes(`${b.id}-${year}`);
    });
    for (const b of todays) {
      const age = year - wib(Date.parse(b.birthdate)).getUTCFullYear();
      messages.push({
        kind: "birthday",
        id: `${b.id}-${year}`,
        title: `Selamat ulang tahun, ${b.name}! 🎂`,
        body: age >= 10 && age <= 60 ? `Hari ini ${b.name} berulang tahun ke-${age}.` : `Hari ini ${b.name} berulang tahun.`,
        open: "route:birthday",
        image: b.img,
        ttl: 12 * 3600,
      });
    }
    next.birthday = keep(todays.map((b) => `${b.id}-${year}`), sent, 60);
  }

  if (snap.news) {
    const ids = snap.news.map((n) => n.id).filter(Boolean);
    if (mem.news) {
      for (const n of snap.news.filter((n) => n.id && !mem.news!.includes(n.id)).slice(0, 3)) {
        messages.push({
          kind: "news",
          id: n.id,
          title: n.title,
          body: `Berita ${n.category || "baru"} · jkt48.com`,
          open: `news:${n.id}|${n.date}|${n.title}`,
          image: "",
          ttl: 24 * 3600,
        });
      }
    }
    next.news = keep(ids, mem.news, 60);
  }

  if (snap.release?.version) {
    const v = snap.release.version;
    // Hanya versi yang lebih baru (release terbaru dihapus → versi lama jadi "latest" lagi: tidak dikirim).
    if (mem.update !== undefined && newerVersion(v, mem.update)) {
      const notes = snap.release.notes.split("\n---")[0].trim().split("\n")[0].slice(0, 160);
      messages.push({ kind: "update", id: `update-${v}`, title: `Update JKT48Connect ${v} tersedia`, body: notes || "Ketuk untuk memperbarui aplikasi.", open: "update", image: "", ttl: 7 * 24 * 3600 });
    }
    next.update = mem.update !== undefined && !newerVersion(v, mem.update) ? mem.update : v;
  }

  return { messages, memory: next };
}

/* ───────────────────────────── Pengambilan data ───────────────────────────── */

export type Fetchers = {
  /** GET upstream JKT48Connect (path + query), hasil JSON mentah, atau null bila gagal. */
  upstream(path: string): Promise<unknown | null>;
  latestRelease(): Promise<Release | null>;
};

/** Kumpulkan data satu putaran. `heavy` = putaran 10 menitan (jadwal, ulang tahun, berita, versi). */
export async function collect(f: Fetchers, heavy: boolean): Promise<Snapshot> {
  const get = async <T>(path: string, shape: (raw: any) => T): Promise<T | undefined> => {
    try {
      const raw = await f.upstream(path);
      return raw == null ? undefined : shape(raw);
    } catch {
      return undefined;
    }
  };
  const live = get("/api/now_live?group=jkt48", shapeLive);
  if (!heavy) return { live: await live };
  const [l, next, theater, birthdays, news, release] = await Promise.all([
    live,
    get("/api/next_schedule", shapeNextSchedule),
    get("/api/theater?page=1&perpage=12", (r) => shapeTheaterList(r, 1, 12).items),
    get("/api/next_birthday", shapeBirthdays),
    get("/api/news?page=1&perpage=10", (r) => shapeNewsList(r, 1, 10).items),
    f.latestRelease().catch(() => null),
  ]);
  const shows = next || theater ? [...(next ?? []), ...(theater ?? [])].filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i) : undefined;
  return { live: l, shows, birthdays, news, release: release ?? undefined };
}

/* ───────────────────────────── FCM HTTP v1 ───────────────────────────── */

export type ServiceAccount = { project_id: string; client_email: string; private_key: string };
export type AccessToken = { token: string; exp: number };

export function parseServiceAccount(raw?: string): ServiceAccount | null {
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as Partial<ServiceAccount>;
    return sa.project_id && sa.client_email && sa.private_key?.includes("PRIVATE KEY") ? (sa as ServiceAccount) : null;
  } catch {
    return null;
  }
}

/** Konfigurasi Firebase untuk aplikasi (`GET /api/app/push`): hanya pengenal publik, tanpa kunci service account. */
export function pushClientConfig(env: PushEnv) {
  const sa = parseServiceAccount(env.FCM_SERVICE_ACCOUNT);
  const appId = env.FCM_ANDROID_APP_ID ?? "";
  const senderId = /^1:(\d+):android:[0-9a-f]+$/.exec(appId)?.[1] ?? "";
  const apiKey = env.FCM_ANDROID_API_KEY ?? "";
  const enabled = Boolean(sa && senderId && /^[\w-]{20,60}$/.test(apiKey));
  return enabled ? { enabled, appId, apiKey, projectId: sa!.project_id, senderId, topicPrefix: TOPIC_PREFIX } : { enabled: false };
}

const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Token akses OAuth (1 jam) dari JWT RS256 yang ditandatangani kunci service account. */
export async function fcmAccessToken(sa: ServiceAccount, doFetch: typeof fetch = fetch, now = Date.now()): Promise<AccessToken> {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }),
  );
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await doFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`token FCM ditolak (${res.status})`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("token FCM kosong");
  return { token: body.access_token, exp: now + ((body.expires_in ?? 3600) - 120) * 1000 };
}

/** Kirim satu pesan data (prioritas tinggi) ke topik; aplikasi yang menyusun notifikasinya. Status HTTP dikembalikan. */
export async function fcmSend(sa: ServiceAccount, token: string, m: PushMessage, doFetch: typeof fetch = fetch): Promise<number> {
  const res = await doFetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        topic: TOPIC_PREFIX + m.kind,
        data: { kind: m.kind, id: m.id, title: m.title, body: m.body, open: m.open, image: m.image },
        android: { priority: "HIGH", ttl: `${m.ttl}s` },
      },
    }),
  });
  if (!res.ok) console.error("FCM send", res.status, m.kind, (await res.text().catch(() => "")).slice(0, 300));
  return res.status;
}

/** Satu putaran lengkap: kumpulkan → rencanakan → kirim. Token akses dipakai ulang selama masih berlaku. */
export async function runPush(opts: {
  sa: ServiceAccount;
  memory: PushMemory;
  token?: AccessToken;
  fetchers: Fetchers;
  now: number;
  heavy: boolean;
  doFetch?: typeof fetch;
}): Promise<{ memory: PushMemory; token?: AccessToken; sent: number; failed: number }> {
  const { sa, fetchers, now, doFetch = fetch } = opts;
  // Memori kosong (pertama kali / setelah reset) → ambil semua jenis sekaligus untuk dicatat.
  const heavy = opts.heavy || Object.keys(opts.memory).length === 0;
  const plan = planPush(opts.memory, await collect(fetchers, heavy), now);
  let token = opts.token && opts.token.exp > now ? opts.token : undefined;
  let sent = 0;
  let failed = 0;
  for (const m of plan.messages) {
    try {
      token ??= await fcmAccessToken(sa, doFetch, now);
      let status = await fcmSend(sa, token.token, m, doFetch);
      if (status === 401) {
        token = await fcmAccessToken(sa, doFetch, now);
        status = await fcmSend(sa, token.token, m, doFetch);
      }
      if (status >= 200 && status < 300) sent++;
      else failed++;
    } catch (err) {
      console.error("FCM", m.kind, err);
      failed++;
    }
  }
  return { memory: plan.memory, token, sent, failed };
}
