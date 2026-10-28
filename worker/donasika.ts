import { gateway, HttpError, limit, validPaymentQr, type PmEnv } from './pm';
import { cleanName } from './donate';

const CAMPAIGN = 'karhutla-2026';
export const recipientFor = (total: number) => total >= 100000 ? 'Save the Children Indonesia' : 'Dompet Dhuafa';
const now = () => Math.floor(Date.now() / 1000);
type Campaign = { id: string; starts_at: number | null; ends_at: number | null; enabled: number; beneficiary: string };
type Payment = { id: string; sid: string; campaign: string; name: string; message: string; base_amount: number; amount: number | null; status: string; trx_id: string | null; qr_image: string | null; expired_at: string | null; created_at: number; paid_at: number | null; next_check: number; lease_until: number };
const open = (c: Campaign, time = now()) => !!c.enabled && c.starts_at !== null && c.ends_at !== null && time >= c.starts_at && time < c.ends_at;
const reply = (data: unknown, status = 200, cookie?: string) => Response.json(data, { status, headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', ...(cookie ? { 'set-cookie': cookie } : {}) } });
async function hash(value: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join(''); }
async function session(request: Request) {
  let token = /(?:^|;\s*)__Host-donasika=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') || '')?.[1];
  let cookie;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    cookie = `__Host-donasika=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000`;
  }
  return { sid: await hash(token), cookie };
}
function view(p: Payment, c: Campaign) { return { id: p.id, name: p.name || 'Anonim', message: p.message, amount: p.amount ?? p.base_amount, donation_amount: p.base_amount, gateway_adjustment: (p.amount ?? p.base_amount) - p.base_amount, status: p.status, qr_image: open(c) && p.status === 'PENDING' ? p.qr_image : null, expired_at: p.expired_at, paid_at: p.paid_at }; }

/** Lease prevents public polling and cron from checking/cancelling the same invoice simultaneously. */
async function reconcile(env: PmEnv, payment: Payment, campaign: Campaign): Promise<Payment> {
  const db = env.PM_DB!;
  if (payment.status !== 'PENDING' || !payment.trx_id) return payment;
  const leased = await db.prepare("UPDATE donasika_payments SET lease_until=? WHERE id=? AND status='PENDING' AND lease_until<=? AND next_check<=? RETURNING id").bind(now() + 45, payment.id, now(), now()).first();
  if (!leased) return (await db.prepare('SELECT * FROM donasika_payments WHERE id=?').bind(payment.id).first<Payment>())!;
  try {
    let result = await gateway(env, 'checkstatus', { trxid: payment.trx_id });
    if (result.trx_id !== payment.trx_id || !['PENDING', 'SUCCESS', 'EXPIRED', 'CANCELLED'].includes(result.status)) throw new HttpError(502, 'Status pembayaran tidak valid.');
    if (result.status === 'PENDING' && !open(campaign)) {
      result = await gateway(env, 'cancelpayment', { trxid: payment.trx_id });
      if (result.trx_id !== payment.trx_id || !['PENDING', 'SUCCESS', 'EXPIRED', 'CANCELLED'].includes(result.status)) throw new HttpError(502, 'Status pembatalan tidak valid.');
    }
    if (result.status === 'SUCCESS' && Number(result.amount) !== payment.amount) throw new HttpError(502, 'Nominal pembayaran tidak cocok.');
    await db.prepare("UPDATE donasika_payments SET status=?, paid_at=CASE WHEN ?='SUCCESS' THEN COALESCE(paid_at,?) ELSE paid_at END, next_check=?,lease_until=0 WHERE id=? AND status='PENDING'").bind(result.status, result.status, now(), now() + 15, payment.id).run();
  } catch (error) {
    await db.prepare('UPDATE donasika_payments SET lease_until=0,next_check=? WHERE id=?').bind(now() + 30, payment.id).run();
    throw error;
  }
  return (await db.prepare('SELECT * FROM donasika_payments WHERE id=?').bind(payment.id).first<Payment>())!;
}

export async function handleDonasika(request: Request, env: PmEnv): Promise<Response> {
  const db = env.PM_DB;
  if (!db) return reply({ message: 'Donasi belum tersedia.' }, 503);
  const url = new URL(request.url), path = url.pathname.replace(/^\/api\/donasika/, '');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.has('origin') && request.headers.get('origin') !== url.origin) return reply({ message: 'Permintaan lintas situs ditolak.' }, 403);
  try {
    const c = await db.prepare('SELECT * FROM donasika_campaigns WHERE id=?').bind(CAMPAIGN).first<Campaign>();
    if (!c) return reply({ message: 'Penggalangan belum tersedia.' }, 503);
    if ((path === '' || path === '/') && request.method === 'GET') {
      const [total, wall] = await Promise.all([
        db.prepare("SELECT COALESCE(SUM(base_amount),0) AS total,COUNT(*) AS count FROM donasika_payments WHERE campaign=? AND status='SUCCESS'").bind(CAMPAIGN).first<{ total: number; count: number }>(),
        db.prepare("SELECT name,message,base_amount AS amount,paid_at FROM donasika_payments WHERE campaign=? AND status='SUCCESS' ORDER BY paid_at DESC,id DESC LIMIT 40").bind(CAMPAIGN).all(),
      ]);
      const visitor = await session(request);
      return reply({ campaign: { id: c.id, beneficiary: recipientFor(total?.total ?? 0), beneficiary_threshold: 100000, disbursement_status: 'not_disbursed', starts_at: c.starts_at, ends_at: c.ends_at, is_open: open(c) && !!env.MYPG_API_KEY?.trim(), server_time: now() }, total_amount: total?.total ?? 0, donation_count: total?.count ?? 0, supporters: wall.results, total_note: 'Total nominal donasi terkonfirmasi, sebelum potongan/biaya gateway bila ada. Penyesuaian nominal QRIS tidak dihitung sebagai donasi.' }, 200, visitor.cookie);
    }
    const viewer = await session(request);
    if (path === '/payments' && request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin) return reply({ message: 'Origin diperlukan.' }, 403);
      if (viewer.cookie) return reply({ message: 'Sesi disiapkan. Silakan tekan lanjutkan sekali lagi.' }, 428, viewer.cookie);
      if (!env.MYPG_API_KEY?.trim()) return reply({ message: 'Pembayaran belum tersedia.' }, 503);
      if (Number(request.headers.get('content-length') || 0) > 4096) return reply({ message: 'Data terlalu besar.' }, 413);
      const raw = await request.text();
      if (raw.length > 4096) return reply({ message: 'Data terlalu besar.' }, 413);
      let input: Record<string, unknown>;
      try { input = JSON.parse(raw); } catch { return reply({ message: 'Data tidak valid.' }, 400); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ message: 'Data tidak valid.' }, 400);
      if (typeof input.amount !== 'number' || !Number.isSafeInteger(input.amount) || input.amount < 1000 || input.amount > 1000000) return reply({ message: 'Pilih nominal Rp1.000–Rp1.000.000.' }, 400);
      if (typeof input.request_key !== 'string' || !/^[a-f0-9-]{36}$/.test(input.request_key)) return reply({ message: 'Identitas pembayaran tidak valid.' }, 400);
      if (typeof input.anonymous !== 'boolean' || typeof input.message !== 'string' || input.message.length > 280) return reply({ message: 'Pesan maksimal 280 karakter.' }, 400);
      const name = input.anonymous ? '' : cleanName(input.name);
      if (!input.anonymous && !name) return reply({ message: 'Isi nama atau pilih anonim.' }, 400);
      const old = await db.prepare('SELECT * FROM donasika_payments WHERE request_key=? AND sid=?').bind(input.request_key, viewer.sid).first<Payment>();
      if (old) return reply(view(old, c), 200, viewer.cookie);
      if (!open(c)) return reply({ message: 'Penerimaan donasi telah ditutup atau belum dibuka.' }, 410);
      await limit(db, 'donasika-create:' + await hash(request.headers.get('cf-connecting-ip') || viewer.sid), 5, 600);
      await limit(db, 'donasika-session:' + viewer.sid, 3, 600);
      const current = await db.prepare("SELECT * FROM donasika_payments WHERE sid=? AND campaign=? AND status IN ('CREATING','PENDING','REVIEW') ORDER BY created_at DESC LIMIT 1").bind(viewer.sid, CAMPAIGN).first<Payment>();
      if (current) return reply({ ...view(current, c), message_info: 'Selesaikan tagihan yang masih aktif terlebih dahulu.' }, 200, viewer.cookie);
      const id = 'DK' + crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase();
      const text = input.message.normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
      const inserted = await db.prepare("INSERT INTO donasika_payments(id,campaign,sid,request_key,name,message,base_amount,created_at) SELECT ?,?,?,?,?,?,?,? FROM donasika_campaigns WHERE id=? AND enabled=1 AND starts_at<=? AND ends_at>?").bind(id, CAMPAIGN, viewer.sid, input.request_key, name, text, input.amount, now(), CAMPAIGN, now(), now()).run();
      if (!inserted.meta.changes) return reply({ message: 'Penerimaan donasi telah ditutup.' }, 410);
      let payment;
      try {
        payment = await gateway(env, 'createpayment', { amount: input.amount, ref_id: id });
        if (typeof payment.trx_id !== 'string' || !Number.isSafeInteger(payment.amount) || payment.amount < input.amount || !validPaymentQr(payment.qr_image)) throw new HttpError(502, 'Respons QRIS tidak valid.');
      } catch (error) {
        // A timeout may have created an upstream invoice: do not automatically duplicate it.
        await db.prepare("UPDATE donasika_payments SET status='REVIEW' WHERE id=?").bind(id).run();
        throw error;
      }
      await db.prepare("UPDATE donasika_payments SET status='PENDING',trx_id=?,amount=?,qr_image=?,expired_at=? WHERE id=?").bind(payment.trx_id, payment.amount, payment.qr_image, String(payment.expired_at || ''), id).run();
      let row = (await db.prepare('SELECT * FROM donasika_payments WHERE id=?').bind(id).first<Payment>())!;
      if (!open(c)) row = await reconcile(env, row, c);
      return reply(view(row, c), 201, viewer.cookie);
    }
    const match = /^\/payments\/(DK[A-F0-9]{20})$/.exec(path);
    if (match && request.method === 'GET') {
      await limit(db, 'donasika-check:' + viewer.sid, 30, 60);
      const row = await db.prepare('SELECT * FROM donasika_payments WHERE id=? AND sid=?').bind(match[1], viewer.sid).first<Payment>();
      if (!row) return reply({ message: 'Tagihan tidak ditemukan di browser ini.' }, 404);
      return reply(view(await reconcile(env, row, c), c));
    }
    return reply({ message: 'Tidak ditemukan.' }, 404);
  } catch (error) {
    if (error instanceof HttpError) return reply({ message: error.message }, error.status);
    console.error('donasika-error', error instanceof Error ? error.name : 'unknown');
    return reply({ message: 'Donasi sedang bermasalah. Silakan coba kembali.' }, 500);
  }
}

/** Existing two-minute cron settles payments even after a donor closes their browser. */
export async function reconcileDonasika(env: PmEnv) {
  if (!env.PM_DB || !env.MYPG_API_KEY?.trim()) return;
  const c = await env.PM_DB.prepare('SELECT * FROM donasika_campaigns WHERE id=?').bind(CAMPAIGN).first<Campaign>();
  if (!c) return;
  const { results } = await env.PM_DB.prepare("SELECT * FROM donasika_payments WHERE campaign=? AND status='PENDING' AND lease_until<=? AND next_check<=? ORDER BY next_check,created_at LIMIT 10").bind(CAMPAIGN, now(), now()).all<Payment>();
  await Promise.all(results.map(row => reconcile(env, row, c).catch(() => console.warn('donasika-reconcile-retry'))));
}
