import { gateway, HttpError, type PmEnv } from './pm';

export interface DonasikaEnv extends PmEnv { DONASIKA_PG_KEY?: string }
export type InvoiceProvider = 'jkc' | 'mypg';
export class PaymentRejected extends HttpError {
  constructor(message: string) { super(502, message); }
}
const BASE = 'https://pg.jkt48connect.app';
const states: Record<string, string> = { pending: 'PENDING', paid: 'SUCCESS', cancelled: 'CANCELLED', expired: 'EXPIRED' };

/** The original MYPG adapter is only needed for invoices created before migration. */
export async function donationGateway(env: DonasikaEnv, provider: InvoiceProvider, action: 'createpayment' | 'checkstatus' | 'cancelpayment' | 'findpayment', values: { id?: string; amount?: number; trxid?: string; endsAt?: number }) {
  if (provider === 'mypg') return gateway(env, action, action === 'createpayment' ? { amount: values.amount!, ref_id: values.id! } : { trxid: values.trxid! });
  if (!env.DONASIKA_PG_KEY?.trim()) throw new PaymentRejected('Koneksi QRIS belum dikonfigurasi.');
  const creating = action === 'createpayment';
  const finding = action === 'findpayment';
  const path = '/api/v1/transactions' + (finding ? '?reference=' + encodeURIComponent(values.id!) : creating ? '' : '/' + encodeURIComponent(values.trxid!) + (action === 'cancelpayment' ? '/cancel' : ''));
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method: action === 'checkstatus' || finding ? 'GET' : 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { 'X-API-Key': env.DONASIKA_PG_KEY.trim(), 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(creating ? { body: JSON.stringify({ amount: values.amount, reference: values.id, description: 'Donasika - bantuan karhutla', expires_in: Math.max(120, Math.min(900, (values.endsAt || Infinity) - Math.floor(Date.now() / 1000))) }) } : action === 'cancelpayment' ? { body: '{}' } : {}),
    });
  } catch { throw new HttpError(502, 'Koneksi QRIS terputus. Status tagihan diperiksa otomatis; jangan membayar ulang.'); }
  if (!response.ok) {
    if ([400, 401, 403, 422].includes(response.status)) throw new PaymentRejected('Gateway QRIS menolak pembuatan tagihan. Silakan coba lagi atau hubungi pengelola.');
    throw new HttpError(502, 'Gateway QRIS sedang sibuk. Tagihan yang sama akan diperiksa kembali.');
  }
  const payload = await response.json().catch(() => null) as { data?: any } | null;
  if (finding && Array.isArray(payload?.data) && !payload.data.length) return null;
  const tx = finding && Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  if (!tx || typeof tx.id !== 'string' || !/^trx_[A-Za-z0-9]+$/.test(tx.id) || !Number.isSafeInteger(tx.amount_total) || !states[tx.status]) throw new HttpError(502, 'Respons QRIS belum dapat diverifikasi.');
  if ((creating || finding) && (tx.reference !== values.id || tx.amount !== values.amount)) throw new HttpError(502, 'Referensi atau nominal tagihan tidak cocok.');
  if (!creating && !finding && tx.id !== values.trxid) throw new HttpError(502, 'Identitas tagihan tidak cocok.');
  const expectedQr = `${BASE}/api/public/transactions/${tx.id}/qr.svg`;
  if (creating && tx.qr_svg_url !== expectedQr) throw new HttpError(502, 'Alamat QRIS tidak valid.');
  return { trx_id: tx.id, amount: tx.amount_total, status: states[tx.status], qr_image: expectedQr, expired_at: String(tx.expires_at || '') };
}

export function validDonationQr(value: unknown, provider: InvoiceProvider): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return !u.username && !u.password && (provider === 'jkc' ? u.origin === BASE && /^\/api\/public\/transactions\/trx_[A-Za-z0-9]+\/qr\.svg$/.test(u.pathname) && !u.search && !u.hash : ['https://yobasepay.net', 'https://api.qrserver.com'].includes(u.origin));
  } catch { return false; }
}
