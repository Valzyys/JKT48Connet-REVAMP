import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { getPlatformProxy } from "wrangler";

test("app donations: QRIS via MYPG, bound to the app session, with a supporters wall (real local D1)", async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "jkc-donate-test-"));
  await build({ entryPoints: ["worker/proxy.ts"], bundle: true, platform: "node", format: "esm", external: ["cloudflare:*"], outfile: join(scratch, "proxy.mjs"), logLevel: "silent" });
  const { handleApi } = await import(join(scratch, "proxy.mjs"));
  const configPath = join(scratch, "wrangler.json");
  await writeFile(configPath, JSON.stringify({ name: "donate-test", compatibility_date: "2026-10-01", d1_databases: [{ binding: "PM_DB", database_name: "donate-test", database_id: "donate-test" }] }));
  const platform = await getPlatformProxy({ configPath, persist: { path: join(scratch, "state") } });
  const db = platform.env.PM_DB;
  for (const file of ["migrations/0001_pm.sql", "migrations/0002_donations.sql"]) await db.exec((await readFile(file, "utf8")).replace(/^--.*$/gm, "").replace(/\n/g, " "));

  // MYPG tiruan: status & nominal yang dikembalikan checkstatus diatur per pengujian.
  const gatewayCalls = [];
  let checkStatus = "PENDING";
  let checkAmount;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.host !== "yobasepay.net") throw new Error(`unexpected fetch ${url}`);
    const data = Object.fromEntries(new URLSearchParams(String(init.body)));
    assert.equal(data.api_key, "test-mypg-secret");
    const action = url.searchParams.get("action");
    gatewayCalls.push({ action, ...data });
    if (action === "createpayment")
      return Response.json({
        status: true,
        data: {
          trx_id: `MY-${data.ref_id}`,
          payment_token: "tok",
          amount: Number(data.amount) + 12,
          qr_image: "https://api.qrserver.com/v1/create-qr-code/?data=x",
          payment_url: "https://yobasepay.net/index?page=pay_my&slug=tok",
          expired_at: "2026-12-31 23:59:59",
        },
      });
    if (action === "checkstatus") return Response.json({ status: true, data: { status: checkStatus, trx_id: data.trxid, amount: checkAmount } });
    if (action === "cancelpayment") return Response.json({ status: true, data: { status: "CANCELLED", trx_id: data.trxid } });
    return new Response("bad action", { status: 400 });
  };
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await platform.dispose();
    await rm(scratch, { recursive: true, force: true });
  });

  const env = { JKT48CONNECT_API_KEY: "k", SESSION_SECRET: "s".repeat(40), GUARD_DISABLED: "1", PM_DB: db, MYPG_API_KEY: "test-mypg-secret" };
  const ctx = { waitUntil() {} };
  const call = (path, { token, method = "GET", body, e = env } = {}) =>
    handleApi(
      new Request(`https://app.test${path}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : method === "POST" ? { body: "{}" } : {}),
      }),
      e,
      ctx,
    );
  const newToken = async () => (await (await call("/api/app/session", { method: "POST" })).json()).token;
  const token = await newToken();
  const other = await newToken();

  assert.equal((await call("/api/app/donate", { method: "POST", body: { amount: 5000 } })).status, 401, "app token required");
  assert.equal((await call("/api/app/donate", { token, method: "POST", body: { amount: 5000 }, e: { ...env, MYPG_API_KEY: "" } })).status, 503, "disabled without the MYPG secret");
  assert.equal((await call("/api/app/donate", { token, method: "POST", body: { amount: 500 } })).status, 400, "minimum amount");
  assert.equal((await call("/api/app/donate", { token, method: "POST", body: { amount: 2_000_000 } })).status, 400, "maximum amount");

  const created = await call("/api/app/donate", { token, method: "POST", body: { amount: 10_000, name: "  Rina <script>alert(1)</script>  " } });
  assert.equal(created.status, 201);
  const d = await created.json();
  assert.match(d.id, /^DN[0-9A-F]{18}$/);
  assert.equal(d.status, "PENDING");
  assert.equal(d.amount, 10_012, "amount includes the unique code");
  assert.equal(d.name, "Rina scriptalert1script");
  assert.equal(d.qr_image, "https://api.qrserver.com/v1/create-qr-code/?data=x");
  assert.equal(d.payment_url, "https://yobasepay.net/index?page=pay_my&slug=tok");
  assert.equal(gatewayCalls[0].amount, "10000");
  assert.equal(gatewayCalls[0].ref_id, d.id);

  assert.equal((await call(`/api/app/donate/${d.id}`, { token: other })).status, 404, "another session cannot see it");
  assert.equal((await call(`/api/app/donate/${d.id}/cancel`, { token: other, method: "POST" })).status, 404, "another session cannot cancel it");

  assert.equal((await (await call(`/api/app/donate/${d.id}`, { token })).json()).status, "PENDING");
  checkStatus = "SUCCESS";
  checkAmount = 9_999;
  assert.equal((await call(`/api/app/donate/${d.id}`, { token })).status, 502, "a mismatched paid amount is rejected");
  checkAmount = 10_012;
  const paid = await (await call(`/api/app/donate/${d.id}`, { token })).json();
  assert.equal(paid.status, "SUCCESS");
  assert.ok(paid.paid_at > 0);
  const checks = gatewayCalls.filter((c) => c.action === "checkstatus").length;
  await call(`/api/app/donate/${d.id}`, { token });
  assert.equal(gatewayCalls.filter((c) => c.action === "checkstatus").length, checks, "settled donations are not re-checked");

  checkStatus = "PENDING";
  const second = await (await call("/api/app/donate", { token, method: "POST", body: { amount: 5_000 } })).json();
  assert.equal(second.name, "", "no name = anonymous");
  const cancelled = await (await call(`/api/app/donate/${second.id}/cancel`, { token, method: "POST" })).json();
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(gatewayCalls.at(-1).action, "cancelpayment");

  const wall = await (await call("/api/app/donate/wall", { token })).json();
  assert.equal(wall.count, 1, "only paid donations are listed");
  assert.deepEqual(
    wall.supporters.map((s) => [s.name, s.amount]),
    [["Rina scriptalert1script", 10_012]],
  );
  assert.ok(!JSON.stringify(wall).includes("sid"), "session ids never leave the worker");
});
