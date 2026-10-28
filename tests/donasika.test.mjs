import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { getPlatformProxy } from 'wrangler';

test('Donasika: verified QRIS, anonymous public wall, idempotency, independent ledger and immutable seven-day close', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'jkc-donasika-'));
  await build({ entryPoints: ['worker/donasika.ts'], bundle: true, platform: 'node', format: 'esm', outfile: join(scratch, 'api.mjs'), logLevel: 'silent' });
  const { handleDonasika, reconcileDonasika, recipientFor } = await import(join(scratch, 'api.mjs'));
  assert.equal(recipientFor(99999), 'Dompet Dhuafa');
  assert.equal(recipientFor(100000), 'Save the Children Indonesia');
  const configPath = join(scratch, 'wrangler.json');
  await writeFile(configPath, JSON.stringify({ name: 'donasika-test', compatibility_date: '2026-10-01', d1_databases: [{ binding: 'PM_DB', database_name: 'donasika-test', database_id: 'donasika-test' }] }));
  const platform = await getPlatformProxy({ configPath, persist: { path: join(scratch, 'state') } });
  const db = platform.env.PM_DB;
  for (const file of ['migrations/0001_pm.sql', 'migrations/0002_donations.sql', 'migrations/0004_donasika.sql', 'migrations/0005_donasika_gateway.sql']) await db.exec((await readFile(file, 'utf8')).replace(/^--.*$/gm, '').replace(/\n/g, ' '));
  const epoch = Math.floor(Date.now() / 1000);
  await db.prepare("UPDATE donasika_campaigns SET starts_at=?,ends_at=?,enabled=1 WHERE id='karhutla-2026'").bind(epoch - 5, epoch - 5 + 604800).run();
  let status = 'PENDING', mismatch = false, failCreate = false;
  const calls = [], realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const u = new URL(String(input));
    assert.equal(u.origin, 'https://yobasepay.net');
    const body = Object.fromEntries(new URLSearchParams(String(init.body)));
    assert.equal(body.api_key, 'private-test-key');
    const action = u.searchParams.get('action'); calls.push(action);
    if (action === 'createpayment') {
      if (failCreate) throw Error('network timeout');
      return Response.json({ status: true, data: { trx_id: 'TRX-' + body.ref_id, amount: Number(body.amount) + 12, qr_image: 'https://api.qrserver.com/v1/create-qr-code/?data=test', expired_at: '2026-12-01 12:00:00' } });
    }
    return Response.json({ status: true, data: { trx_id: body.trxid, status: action === 'cancelpayment' ? 'CANCELLED' : status, amount: mismatch ? 1 : 25012 } });
  };
  t.after(async () => { globalThis.fetch = realFetch; await platform.dispose(); await rm(scratch, { recursive: true, force: true }); });
  const env = { PM_DB: db, MYPG_API_KEY: 'private-test-key' };
  const request = (path = '', { cookie, method = 'GET', body, origin = 'https://site.test' } = {}) => new Request('https://site.test/api/donasika' + path, { method, headers: { origin, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const call = (path, options) => handleDonasika(request(path, options), env);
  const sessionResponse = await call('');
  const cookie = sessionResponse.headers.get('set-cookie').split(';')[0];
  assert.match(sessionResponse.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax/);
  const summary = await sessionResponse.json();
  assert.equal(summary.campaign.is_open, true);
  assert.equal(summary.campaign.beneficiary, 'Dompet Dhuafa');
  assert.equal(summary.campaign.ends_at - summary.campaign.starts_at, 604800);
  assert.equal((await call('/payments', { method: 'POST', body: {} })).status, 428, 'no invoice before establishing a stable browser cookie');
  const input = { amount: 25000, name: 'PRIVATE REAL NAME', anonymous: true, message: 'Semoga lekas pulih.\nTetap kuat! <script>alert(1)</script>', request_key: crypto.randomUUID() };
  assert.equal((await call('/payments', { cookie, method: 'POST', origin: 'https://other.test', body: input })).status, 403);
  const response = await call('/payments', { cookie, method: 'POST', body: input });
  assert.equal(response.status, 201);
  const invoice = await response.json();
  assert.equal(invoice.name, 'Anonim');
  assert.equal(invoice.amount, 25012);
  assert.equal(invoice.gateway_adjustment, 12);
  assert.equal((await db.prepare('SELECT name FROM donasika_payments WHERE id=?').bind(invoice.id).first()).name, '');
  const duplicate = await (await call('/payments', { cookie, method: 'POST', body: input })).json();
  assert.equal(duplicate.id, invoice.id);
  assert.equal(calls.filter(c => c === 'createpayment').length, 1);
  assert.equal((await call('/payments/' + invoice.id)).status, 404, 'other browser cannot read invoice');
  assert.equal((await (await call('')).json()).total_amount, 0, 'pending is never counted');
  status = 'SUCCESS'; mismatch = true;
  await db.prepare('UPDATE donasika_payments SET next_check=0 WHERE id=?').bind(invoice.id).run();
  assert.equal((await call('/payments/' + invoice.id, { cookie })).status, 502, 'mismatched amounts cannot confirm a payment');
  assert.equal((await (await call('')).json()).total_amount, 0);
  mismatch = false;
  await db.prepare('UPDATE donasika_payments SET next_check=0').run();
  await reconcileDonasika(env);
  const paid = await (await call('/payments/' + invoice.id, { cookie })).json();
  assert.equal(paid.status, 'SUCCESS', 'cron confirms payment without the donor browser');
  assert.equal(paid.qr_image, null);
  const wall = await (await call('')).json();
  assert.equal(wall.total_amount, 25000, 'adjustment excluded from campaign total');
  assert.equal(wall.donation_count, 1);
  assert.equal(wall.supporters[0].name, '');
  assert.equal(wall.supporters[0].message, input.message, 'message stays plain data; React escapes it');
  assert.equal(JSON.stringify(wall).includes('PRIVATE REAL NAME'), false);
  assert.equal(JSON.stringify(wall).includes(invoice.id), false);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM donations').first()).n, 0, 'app donations stay independent');
  status = 'PENDING';
  const otherCookie = (await call('')).headers.get('set-cookie').split(';')[0];
  const pending = await (await call('/payments', { cookie: otherCookie, method: 'POST', body: { ...input, request_key: crypto.randomUUID() } })).json();
  await db.prepare("UPDATE donasika_campaigns SET starts_at=?,ends_at=? WHERE id='karhutla-2026'").bind(epoch - 604801, epoch - 1).run();
  assert.equal((await (await call('')).json()).campaign.is_open, false);
  assert.equal((await call('/payments', { cookie, method: 'POST', body: { ...input, request_key: crypto.randomUUID() } })).status, 410);
  await reconcileDonasika(env);
  const ended = await (await call('/payments/' + pending.id, { cookie: otherCookie })).json();
  assert.equal(ended.status, 'CANCELLED');
  assert.equal(ended.qr_image, null);
  assert.equal((await (await call('')).json()).total_amount, 25000);
  // Applying the additive migration again must not reopen/reset the campaign.
  await db.exec((await readFile('migrations/0004_donasika.sql', 'utf8')).replace(/^--.*$/gm, '').replace(/\n/g, ' '));
  assert.equal((await (await call('')).json()).campaign.is_open, false);
  await db.prepare("UPDATE donasika_campaigns SET starts_at=?,ends_at=? WHERE id='karhutla-2026'").bind(epoch - 5, epoch - 5 + 604800).run();
  failCreate = true;
  const reviewInput = { ...input, request_key: crypto.randomUUID() };
  assert.equal((await call('/payments', { cookie: otherCookie, method: 'POST', body: reviewInput })).status, 502);
  const before = calls.filter(c => c === 'createpayment').length;
  const review = await (await call('/payments', { cookie: otherCookie, method: 'POST', body: reviewInput })).json();
  assert.equal(review.status, 'REVIEW');
  assert.equal(calls.filter(c => c === 'createpayment').length, before, 'ambiguous create timeout never creates a duplicate invoice');

  // The replacement PG uses the stored merchant QRIS and idempotent references.
  await db.prepare("UPDATE donasika_payments SET status='REVIEW_LEGACY' WHERE status='REVIEW' AND provider='mypg' AND trx_id IS NULL").run();
  env.DONASIKA_PG_KEY = 'private-own-gateway-key';
  const transactions = new Map(); let dropResponse = true, created = 0;
  globalThis.fetch = async (input, init = {}) => {
    const u = new URL(String(input));
    assert.equal(u.origin, 'https://pg.jkt48connect.app');
    assert.equal(new Headers(init.headers).get('X-API-Key'), 'private-own-gateway-key');
    assert.equal(init.redirect, 'manual');
    if (init.method === 'POST' && u.pathname === '/api/v1/transactions') {
      const body = JSON.parse(init.body);
      let tx = transactions.get(body.reference);
      if (!tx) {
        created++;
        tx = { id: 'trx_TEST' + created, reference: body.reference, amount: body.amount, amount_total: body.amount + 7, status: 'pending', expires_at: new Date(Date.now() + 900000).toISOString() };
        tx.qr_svg_url = 'https://pg.jkt48connect.app/api/public/transactions/' + tx.id + '/qr.svg';
        transactions.set(body.reference, tx);
      }
      if (dropResponse) { dropResponse = false; throw Error('response lost after invoice creation'); }
      return Response.json({ data: tx });
    }
    if (u.searchParams.has('reference')) return Response.json({ data: [...transactions.values()].filter(tx => tx.reference === u.searchParams.get('reference')) });
    const tx = [...transactions.values()].find(tx => u.pathname.endsWith(tx.id) || u.pathname.endsWith(tx.id + '/cancel'));
    assert.ok(tx);
    if (u.pathname.endsWith('/cancel')) tx.status = 'cancelled';
    return Response.json({ data: tx });
  };
  const ownCookie = (await call('')).headers.get('set-cookie').split(';')[0];
  const ownInput = { ...input, request_key: crypto.randomUUID() };
  assert.equal((await call('/payments', { cookie: ownCookie, method: 'POST', body: ownInput })).status, 502);
  const ownRow = await db.prepare("SELECT * FROM donasika_payments WHERE provider='jkc'").first();
  assert.equal(ownRow.status, 'REVIEW');
  await db.prepare('UPDATE donasika_payments SET next_check=0 WHERE id=?').bind(ownRow.id).run();
  const recovered = await (await call('/payments/' + ownRow.id, { cookie: ownCookie })).json();
  assert.equal(recovered.status, 'PENDING');
  assert.equal(recovered.qr_image, 'https://pg.jkt48connect.app/api/public/transactions/trx_TEST1/qr.svg');
  assert.equal(created, 1, 'lost gateway responses are recovered with the same reference, never a second transaction');
  assert.equal(recovered.amount, 25007);
  transactions.get(ownRow.id).status = 'paid';
  assert.equal((await (await call('/payments/' + ownRow.id, { cookie: ownCookie })).json()).status, 'SUCCESS');
  assert.equal((await (await call('')).json()).total_amount, 50000);
});
