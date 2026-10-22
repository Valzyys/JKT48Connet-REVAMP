import type { D1Database } from "@cloudflare/workers-types/index.ts";
export interface PmEnv {
  PM_DB?: D1Database;
  PM_API_KEY?: string;
  MYPG_API_KEY?: string;
}
const PLANS = {
  daily: { name: "Harian", days: 2, price: 3000 },
  weekly: { name: "Mingguan", days: 7, price: 8000 },
  monthly: { name: "Bulanan", days: 30, price: 13000 },
};
const BASE = "https://privatemessageraffz.my.id";
const now = () => Math.floor(Date.now() / 1000);
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const json = (data: unknown, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), (n) => n.toString(16).padStart(2, "0")).join(
    "",
  );
async function hash(value: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}
async function password(value: string, salt: string) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      k,
      256,
    ),
  );
}
function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++)
    diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function body(request: Request): Promise<Record<string, string>> {
  if (Number(request.headers.get("Content-Length") || 0) > 8192)
    fail(413, "Permintaan terlalu besar.");
  const raw = await request.text();
  if (raw.length > 8192) fail(413, "Permintaan terlalu besar.");
  try {
    const data = JSON.parse(raw);
    if (!data || Array.isArray(data) || typeof data !== "object") throw Error();
    return data;
  } catch {
    return fail(400, "Data tidak valid.");
  }
}
async function limit(
  db: D1Database,
  key: string,
  max: number,
  seconds: number,
) {
  const row = await db
    .prepare(
      "INSERT INTO pm_limits(key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count",
    )
    .bind(key, now() + seconds, now(), now())
    .first<{ count: number }>();
  if (!row || row.count > max)
    fail(429, "Terlalu banyak permintaan. Coba lagi sebentar.");
}
async function upstream(env: PmEnv, path: string) {
  if (!env.PM_API_KEY) fail(503, "Layanan PM belum dikonfigurasi.");
  await limit(env.PM_DB!, "upstream", 100, 60);
  const res = await fetch(BASE + path, {
    headers: {
      "X-API-Key": env.PM_API_KEY!,
      Accept: "application/json",
      "User-Agent": "JKT48Connect/1.0",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!res.ok)
    fail(
      res.status === 429 ? 429 : 502,
      "Layanan pesan sedang tidak tersedia.",
    );
  const data = (await res.json()) as any;
  if (!data.success) fail(502, "Layanan pesan sedang tidak tersedia.");
  return data;
}
async function gateway(
  env: PmEnv,
  action: string,
  values: Record<string, string | number>,
) {
  if (!env.MYPG_API_KEY) fail(503, "Pembayaran belum dikonfigurasi.");
  const res = await fetch(`https://yobasepay.net/api_my?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: env.MYPG_API_KEY, ...values }),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  const data = (await res.json()) as any;
  if (!res.ok || data.status !== true || !data.data)
    fail(502, "Gateway pembayaran belum dapat memproses permintaan.");
  return data.data;
}
async function hasAccess(db: D1Database, user: string, member: string) {
  const row = await db
    .prepare(
      "SELECT MAX(expires_at) AS until FROM pm_grants WHERE user_id=? AND member=?",
    )
    .bind(user, member)
    .first<{ until: number }>();
  return !!row?.until && row.until > now();
}
function mediaPath(value: string, slug: string) {
  try {
    const url = new URL(value, BASE),
      bits = url.pathname.split("/");
    if (
      url.origin !== BASE ||
      url.search ||
      url.hash ||
      bits.length !== 6 ||
      bits.slice(0, 4).join("/") !== "/api/v1/media" ||
      decodeURIComponent(bits[4]) !== slug ||
      !/^[\w.-]+\.(jpg|jpeg|png|gif|webp|mp4|m4a|amr|mp3|ogg|wav)$/i.test(
        bits[5],
      ) ||
      bits[5].includes("..")
    )
      return null;
    return `/api/pm/media/${encodeURIComponent(slug)}/${bits[5]}`;
  } catch {
    return null;
  }
}
function message(m: any, slug: string) {
  const media = m.media_urls ?? m.media_files ?? [];
  return {
    message_id: m.message_id,
    sequence_order: m.sequence_order,
    created_at: m.created_at,
    text: typeof m.text === "string" ? m.text : "",
    is_poll: m.is_poll,
    poll: m.poll,
    media_urls: Array.isArray(media)
      ? media
          .map((p: any) => {
            const s = typeof p === "string" ? p : (p?.url ?? p?.filename);
            return typeof s === "string"
              ? mediaPath(
                  s.startsWith("/") || s.startsWith("http")
                    ? s
                    : `/api/v1/media/${slug}/${s}`,
                  slug,
                )
              : null;
          })
          .filter(Boolean)
      : [],
  };
}
export async function handlePm(
  request: Request,
  env: PmEnv,
): Promise<Response> {
  try {
    const db = env.PM_DB;
    if (!db)
      return json({ error: "Database PM belum siap. Jalankan setup D1." }, 503);
    const url = new URL(request.url),
      path = url.pathname.slice("/api/pm".length);
    if (!["GET", "POST"].includes(request.method))
      fail(405, "Metode tidak didukung.");
    if (
      request.method === "POST" &&
      (request.headers.get("Origin") !== url.origin ||
        !request.headers.get("Content-Type")?.includes("application/json"))
    )
      fail(403, "Permintaan tidak diizinkan.");
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    await limit(db, `ip:${ip}`, 300, 60);
    if (Math.random() < 0.01)
      await db.batch([
        db.prepare("DELETE FROM pm_limits WHERE reset_at<?").bind(now() - 3600),
        db.prepare("DELETE FROM pm_sessions WHERE expires_at<?").bind(now()),
      ]);
    if (path === "/auth/login" || path === "/auth/register") {
      if (request.method !== "POST") fail(405, "Gunakan POST.");
      await limit(db, `auth:${ip}`, 12, 900);
      const input = await body(request),
        email =
          typeof input.email === "string"
            ? input.email.trim().toLowerCase()
            : "",
        pass = typeof input.password === "string" ? input.password : "";
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        pass.length < 10 ||
        pass.length > 128
      )
        fail(400, "Gunakan email valid dan kata sandi 10–128 karakter.");
      await limit(db, `email:${await hash(email)}`, 15, 900);
      let user: { id: string; name: string; password: string } | null;
      if (path.endsWith("register")) {
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (name.length < 2 || name.length > 60)
          fail(400, "Nama harus 2–60 karakter.");
        const salt = crypto.randomUUID(),
          id = crypto.randomUUID(),
          encoded = `${salt}:${await password(pass, salt)}`;
        try {
          await db
            .prepare("INSERT INTO pm_users VALUES (?,?,?,?,?)")
            .bind(id, name, email, encoded, now())
            .run();
        } catch (e) {
          if (String(e).includes("UNIQUE"))
            return fail(409, "Email sudah terdaftar. Silakan masuk.");
          throw e;
        }
        user = { id, name, password: encoded };
      } else {
        user = await db
          .prepare("SELECT id,name,password FROM pm_users WHERE email=?")
          .bind(email)
          .first();
        const [salt, expected] = (user?.password ?? "dummy:invalid").split(":");
        const actual = await password(pass, salt);
        if (!user || !equal(actual, expected))
          fail(401, "Email atau kata sandi salah.");
      }
      const token = crypto.randomUUID() + crypto.randomUUID();
      await db
        .prepare("INSERT INTO pm_sessions VALUES (?,?,?)")
        .bind(await hash(token), user!.id, now() + 604800)
        .run();
      return json({ user: { id: user!.id, name: user!.name, email } }, 200, {
        "Set-Cookie": `pm_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/api/pm; Max-Age=604800`,
      });
    }
    const token = request.headers
      .get("Cookie")
      ?.match(/(?:^|;\s*)pm_session=([^;]+)/)?.[1];
    const user = token
      ? await db
          .prepare(
            "SELECT u.id,u.name,u.email FROM pm_users u JOIN pm_sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires_at>?",
          )
          .bind(await hash(token), now())
          .first<{ id: string; name: string; email: string }>()
      : null;
    if (path === "/me") return json({ user, plans: PLANS });
    if (!user) fail(401, "Silakan masuk untuk membuka PM.");
    if (path === "/auth/logout" && request.method === "POST") {
      await db
        .prepare("DELETE FROM pm_sessions WHERE token=?")
        .bind(await hash(token!))
        .run();
      return json({ ok: true }, 200, {
        "Set-Cookie":
          "pm_session=; HttpOnly; Secure; SameSite=Lax; Path=/api/pm; Max-Age=0",
      });
    }
    if (path === "/conversations" && request.method === "GET") {
      await limit(db, `members:${user.id}`, 20, 60);
      const data = await upstream(env, "/api/v1/conversations");
      const grants = await db
        .prepare(
          "SELECT member,MAX(expires_at) AS expires_at FROM pm_grants WHERE user_id=? GROUP BY member",
        )
        .bind(user.id)
        .all<{ member: string; expires_at: number }>();
      return json({
        data: data.data.map((m: any) => ({
          member: m.member,
          slug: m.slug,
          avatar:
            typeof m.avatar === "string" && m.avatar.startsWith("https://")
              ? m.avatar
              : null,
          expires_at:
            grants.results.find((g) => g.member === m.slug)?.expires_at ?? null,
        })),
      });
    }
    if (path === "/orders" && request.method === "GET")
      return json({
        data: (
          await db
            .prepare(
              "SELECT * FROM pm_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
            )
            .bind(user.id)
            .all()
        ).results,
      });
    if (path === "/orders" && request.method === "POST") {
      const input = await body(request),
        plan =
          typeof input.plan === "string" && Object.hasOwn(PLANS, input.plan)
            ? PLANS[input.plan as keyof typeof PLANS]
            : undefined;
      if (!plan || typeof input.member !== "string")
        fail(400, "Pilih member dan paket yang valid.");
      await limit(db, `create:${user.id}`, 5, 300);
      const catalog = await upstream(env, "/api/v1/conversations"),
        member = catalog.data.find((m: any) => m.slug === input.member);
      if (!member) fail(404, "Member tidak ditemukan.");
      const id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO pm_orders (id,user_id,member,member_name,plan,days,price,created_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          user.id,
          member.slug,
          member.member,
          input.plan,
          plan.days,
          plan.price,
          now(),
        )
        .run();
      let payment;
      try {
        payment = await gateway(env, "createpayment", {
          amount: plan.price,
          ref_id: id,
        });
      } catch (e) {
        await db
          .prepare("UPDATE pm_orders SET status='FAILED' WHERE id=?")
          .bind(id)
          .run();
        throw e;
      }
      if (
        typeof payment.trx_id !== "string" ||
        !Number.isInteger(payment.amount) ||
        payment.amount < plan.price ||
        typeof payment.qr_image !== "string" ||
        !payment.qr_image.startsWith("https://yobasepay.net/")
      )
        fail(502, "Respons pembayaran tidak valid.");
      await db
        .prepare(
          "UPDATE pm_orders SET status='PENDING',trx_id=?,amount=?,qr_image=?,expired_at=? WHERE id=?",
        )
        .bind(
          payment.trx_id,
          payment.amount,
          payment.qr_image,
          payment.expired_at,
          id,
        )
        .run();
      return json({ id }, 201);
    }
    const orderMatch = path.match(/^\/orders\/([\w-]+)(?:\/(check|cancel))?$/);
    if (orderMatch) {
      const [, id, action] = orderMatch;
      const order = await db
        .prepare("SELECT * FROM pm_orders WHERE id=? AND user_id=?")
        .bind(id, user.id)
        .first<any>();
      if (!order) fail(404, "Transaksi tidak ditemukan.");
      if (action && request.method !== "POST") fail(405, "Gunakan POST.");
      if (action && order.status === "PENDING") {
        await limit(db, `check:${user.id}`, 12, 60);
        let data = await gateway(env, "checkstatus", { trxid: order.trx_id });
        if (action === "cancel" && data.status === "PENDING")
          data = await gateway(env, "cancelpayment", { trxid: order.trx_id });
        if (
          data.trx_id !== order.trx_id ||
          !["PENDING", "SUCCESS", "EXPIRED", "CANCELLED"].includes(data.status)
        )
          fail(502, "Status pembayaran tidak valid.");
        if (data.status === "SUCCESS" && Number(data.amount) !== order.amount)
          fail(502, "Nominal pembayaran tidak cocok.");
        await db
          .prepare(
            "UPDATE pm_orders SET status=? WHERE id=? AND (status='PENDING' OR ?='SUCCESS')",
          )
          .bind(data.status, id, data.status)
          .run();
      }
      // One atomic statement + unique order_id: concurrent polling cannot grant twice.
      await db
        .prepare(
          `INSERT OR IGNORE INTO pm_grants(order_id,user_id,member,expires_at) SELECT id,user_id,member,MAX(?,COALESCE((SELECT MAX(g.expires_at) FROM pm_grants g WHERE g.user_id=o.user_id AND g.member=o.member),0))+days*86400 FROM pm_orders o WHERE id=? AND status='SUCCESS'`,
        )
        .bind(now(), id)
        .run();
      return json({
        data: await db
          .prepare("SELECT * FROM pm_orders WHERE id=? AND user_id=?")
          .bind(id, user.id)
          .first(),
      });
    }
    const messages = path.match(/^\/messages\/([\w-]+)(\/latest)?$/);
    if (messages && request.method === "GET") {
      const slug = messages[1];
      if (!(await hasAccess(db, user.id, slug)))
        fail(403, "Akses member belum aktif atau sudah berakhir.");
      await limit(db, `messages:${user.id}`, 30, 60);
      const params = new URLSearchParams();
      if (messages[2]) {
        const id = url.searchParams.get("afterId");
        if (id && /^[\w-]{1,100}$/.test(id)) params.set("afterId", id);
      } else {
        params.set(
          "page",
          String(
            Math.min(
              100000,
              Math.max(
                1,
                Math.floor(Number(url.searchParams.get("page")) || 1),
              ),
            ),
          ),
        );
        params.set("limit", "25");
        params.set("sort", "desc");
      }
      const data = await upstream(
        env,
        `/api/v1/messages/${encodeURIComponent(slug)}${messages[2] || ""}?${params}`,
      );
      return json({
        messages: data.messages.map((m: any) => message(m, slug)),
        pagination: data.pagination,
      });
    }
    if (path.startsWith("/media/") && request.method === "GET") {
      const parts = path.split("/"),
        slug = decodeURIComponent(parts[2] || "");
      if (
        parts.length !== 4 ||
        !mediaPath(
          `/api/v1/media/${encodeURIComponent(slug)}/${parts[3]}`,
          slug,
        )
      )
        fail(404, "Media tidak ditemukan.");
      if (!(await hasAccess(db, user.id, slug)))
        fail(403, "Akses member sudah berakhir.");
      if (!env.PM_API_KEY) fail(503, "Layanan PM belum dikonfigurasi.");
      const headers = new Headers({
        "X-API-Key": env.PM_API_KEY!,
        "User-Agent": "JKT48Connect/1.0",
      });
      if (request.headers.has("Range"))
        headers.set("Range", request.headers.get("Range")!);
      await limit(db, "upstream", 100, 60);
      const res = await fetch(
        `${BASE}/api/v1/media/${encodeURIComponent(slug)}/${parts[3]}`,
        { headers, redirect: "error", signal: AbortSignal.timeout(20000) },
      );
      if (![200, 206, 416].includes(res.status))
        fail(502, "Media belum dapat dimuat.");
      const out = new Headers({
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      });
      for (const key of [
        "Content-Type",
        "Content-Length",
        "Content-Range",
        "Accept-Ranges",
      ])
        if (res.headers.has(key)) out.set(key, res.headers.get(key)!);
      if (
        res.status !== 416 &&
        !/^(image\/(jpeg|png|gif|webp)|video\/mp4|audio\/)/.test(
          out.get("Content-Type") || "",
        )
      )
        fail(502, "Format media tidak didukung.");
      return new Response(res.body, { status: res.status, headers: out });
    }
    return json({ error: "Halaman tidak ditemukan." }, 404);
  } catch (e) {
    return json(
      {
        error:
          e instanceof HttpError
            ? e.message
            : "Layanan sedang bermasalah. Silakan coba lagi.",
      },
      e instanceof HttpError ? e.status : 500,
    );
  }
}
