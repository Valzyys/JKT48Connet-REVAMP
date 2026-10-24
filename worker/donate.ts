/**
 * Donasi dari aplikasi lewat QRIS MYPG (gateway yang sama dengan PM, lihat worker/pm.ts).
 * API key MYPG hanya ada di worker (secret MYPG_API_KEY); aplikasi memakai token aplikasi.
 *
 *   POST /api/app/donate              { amount, name? } → tagihan QRIS baru
 *   GET  /api/app/donate/<id>         → status (dicek ke MYPG selama masih PENDING)
 *   POST /api/app/donate/<id>/cancel  → batalkan tagihan yang masih PENDING
 *   GET  /api/app/donate/wall         → dinding pendukung (donasi yang sudah lunas)
 *
 * Setiap tagihan terikat ke sesi aplikasi pembuatnya: sesi lain tidak bisa melihat atau membatalkannya.
 */
import { gateway, HttpError, limit, validPaymentQr, type PmEnv } from "./pm";

export const DONATE_MIN = 1_000;
export const DONATE_MAX = 1_000_000;
const STATUSES = ["PENDING", "SUCCESS", "EXPIRED", "CANCELLED"];
const now = () => Math.floor(Date.now() / 1000);

const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
const error = (status: number, message: string) => reply({ status, message }, status);

/** Nama pendukung untuk ditampilkan publik: huruf/angka/spasi/._- saja, maks. 24 karakter; kosong = Anonim. */
export function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

/** URL halaman bayar hanya diteruskan bila memang milik MYPG (bukan tautan sembarang dari respons). */
function paymentPage(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.origin === "https://yobasepay.net" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

type Row = {
  id: string;
  sid: string;
  name: string;
  base_amount: number;
  amount: number | null;
  status: string;
  trx_id: string | null;
  qr_image: string | null;
  payment_url: string | null;
  expired_at: string | null;
  created_at: number;
  paid_at: number | null;
};

const view = (r: Row) => ({
  id: r.id,
  status: r.status,
  name: r.name,
  amount: r.amount ?? r.base_amount,
  qr_image: r.qr_image ?? "",
  payment_url: r.payment_url ?? "",
  expired_at: r.expired_at ?? "",
  paid_at: r.paid_at,
});

export async function handleDonate(request: Request, env: PmEnv, sid: string): Promise<Response> {
  const db = env.PM_DB;
  if (!db || !env.MYPG_API_KEY?.trim()) return error(503, "Donasi belum tersedia.");
  const path = new URL(request.url).pathname.replace(/^\/api\/app\/donate/, "");
  try {
    if (path === "/wall") {
      if (request.method !== "GET") return error(405, "Gunakan GET.");
      const { results } = await db
        .prepare("SELECT name, amount, paid_at FROM donations WHERE status='SUCCESS' ORDER BY paid_at DESC LIMIT 30")
        .all<{ name: string; amount: number; paid_at: number }>();
      const total = await db.prepare("SELECT COUNT(*) AS n FROM donations WHERE status='SUCCESS'").first<{ n: number }>();
      return reply({ count: total?.n ?? 0, supporters: results.map((r) => ({ name: r.name, amount: r.amount, paid_at: r.paid_at })) });
    }

    if (path === "" || path === "/") {
      if (request.method !== "POST") return error(405, "Gunakan POST.");
      const input = (await request.json().catch(() => null)) as { amount?: unknown; name?: unknown } | null;
      const amount = Number(input?.amount);
      if (!Number.isInteger(amount) || amount < DONATE_MIN || amount > DONATE_MAX) {
        return error(400, `Nominal donasi Rp${DONATE_MIN.toLocaleString("id-ID")}–Rp${DONATE_MAX.toLocaleString("id-ID")}.`);
      }
      await limit(db, `donate:${sid}`, 5, 600);
      const id = `DN${crypto.randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase()}`;
      await db
        .prepare("INSERT INTO donations(id, sid, name, base_amount, created_at) VALUES (?,?,?,?,?)")
        .bind(id, sid, cleanName(input?.name), amount, now())
        .run();
      let payment;
      try {
        payment = await gateway(env, "createpayment", { amount, ref_id: id });
      } catch (e) {
        await db.prepare("UPDATE donations SET status='FAILED' WHERE id=?").bind(id).run();
        throw e;
      }
      if (typeof payment.trx_id !== "string" || !Number.isInteger(payment.amount) || payment.amount < amount || !validPaymentQr(payment.qr_image)) {
        await db.prepare("UPDATE donations SET status='FAILED' WHERE id=?").bind(id).run();
        return error(502, "Respons pembayaran tidak valid.");
      }
      await db
        .prepare("UPDATE donations SET status='PENDING', trx_id=?, amount=?, qr_image=?, payment_url=?, expired_at=? WHERE id=?")
        .bind(payment.trx_id, payment.amount, payment.qr_image, paymentPage(payment.payment_url), String(payment.expired_at ?? ""), id)
        .run();
      const row = await db.prepare("SELECT * FROM donations WHERE id=?").bind(id).first<Row>();
      return reply(view(row!), 201);
    }

    const match = path.match(/^\/(DN[0-9A-F]{18})(\/cancel)?$/);
    if (!match) return error(404, "Tidak ditemukan.");
    const [, id, cancel] = match;
    if (cancel ? request.method !== "POST" : request.method !== "GET") return error(405, cancel ? "Gunakan POST." : "Gunakan GET.");
    let row = await db.prepare("SELECT * FROM donations WHERE id=? AND sid=?").bind(id, sid).first<Row>();
    if (!row) return error(404, "Donasi tidak ditemukan.");
    if (row.status === "PENDING" && row.trx_id) {
      await limit(db, `donate-check:${sid}`, 30, 60);
      let data = await gateway(env, "checkstatus", { trxid: row.trx_id });
      if (cancel && data.status === "PENDING") data = await gateway(env, "cancelpayment", { trxid: row.trx_id });
      if (data.trx_id !== row.trx_id || !STATUSES.includes(data.status)) return error(502, "Status pembayaran tidak valid.");
      if (data.status === "SUCCESS" && Number(data.amount) !== row.amount) return error(502, "Nominal pembayaran tidak cocok.");
      if (data.status !== row.status) {
        await db
          .prepare("UPDATE donations SET status=?, paid_at=CASE WHEN ?='SUCCESS' THEN ? ELSE paid_at END WHERE id=? AND status='PENDING'")
          .bind(data.status, data.status, now(), id)
          .run();
        row = (await db.prepare("SELECT * FROM donations WHERE id=?").bind(id).first<Row>())!;
      }
    }
    return reply(view(row));
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message);
    console.error("donate", e);
    return error(500, "Donasi sedang bermasalah. Coba lagi nanti.");
  }
}
