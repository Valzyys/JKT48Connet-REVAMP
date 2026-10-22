import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { getPlatformProxy } from "wrangler";

test("PM account, billing, authorization and media integration with real local D1", async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "jkc-pm-test-"));
  await build({
    entryPoints: ["worker/pm.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(scratch, "pm.mjs"),
  });
  const { handlePm } = await import(join(scratch, "pm.mjs"));
  const configPath = join(scratch, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "pm-test",
      compatibility_date: "2026-10-01",
      d1_databases: [
        { binding: "PM_DB", database_name: "pm-test", database_id: "pm-test" },
      ],
    }),
  );
  const platform = await getPlatformProxy({
    configPath,
    persist: { path: join(scratch, "state") },
  });
  const db = platform.env.PM_DB;
  const originalFetch = globalThis.fetch;
  let paymentStatus = "PENDING",
    checkAmount = 3001,
    checkTrxOverride,
    charged,
    range,
    upstreamCalls = 0;
  const slug = "Lily_JKT48";
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    upstreamCalls++;
    if (url.host === "yobasepay.net") {
      assert.equal(init.method, "POST");
      assert.match(
        new Headers(init.headers).get("Content-Type"),
        /^application\/x-www-form-urlencoded/,
      );
      const data = Object.fromEntries(new URLSearchParams(String(init.body)));
      assert.equal(data.api_key, "test-gateway-secret");
      const action = url.searchParams.get("action");
      if (action === "createpayment") {
        charged = data;
        return Response.json({
          status: true,
          data: {
            trx_id: "MY-" + data.ref_id,
            amount: 3001,
            qr_image: "https://yobasepay.net/qr_render?payload=test",
            payment_url: "https://should-never-reach-browser.invalid",
            expired_at: "2026-12-31 23:59:59",
          },
        });
      }
      if (action === "cancelpayment") paymentStatus = "CANCELLED";
      return Response.json({
        status: true,
        data: {
          trx_id: checkTrxOverride ?? data.trxid,
          amount: checkAmount,
          status: paymentStatus,
        },
      });
    }
    assert.equal(new Headers(init.headers).get("X-API-Key"), "test-pm-secret");
    if (url.pathname === "/api/v1/conversations")
      return Response.json({
        success: true,
        data: [
          {
            member: "Lily JKT48",
            slug,
            avatar: "https://jkt48.com/lily.jpg",
            last_message: { text: "PRIVATE PREVIEW" },
          },
        ],
      });
    if (url.pathname.startsWith("/api/v1/messages"))
      return Response.json({
        success: true,
        messages: [
          {
            message_id: "msg-1",
            sequence_order: 1,
            text: "Test message",
            created_at: "22/10/2026, 13.15.22 WIB",
            media_urls: [
              `/api/v1/media/${slug}/photo.jpg`,
              "https://evil.invalid/payload.jpg",
              `/api/v1/media/Other_JKT48/private.jpg`,
            ],
          },
        ],
        pagination: { has_next: false },
      });
    range = new Headers(init.headers).get("Range");
    return new Response(new Uint8Array([1, 2, 3]), {
      status: range ? 206 : 200,
      headers: { "Content-Type": "image/jpeg", "Content-Range": "bytes 0-2/3" },
    });
  };
  const env = {
    PM_DB: db,
    PM_API_KEY: "test-pm-secret",
    MYPG_API_KEY: "test-gateway-secret",
  };
  const call = (
    path,
    { cookie = "", data, origin = "https://app.test", headers = {} } = {},
  ) =>
    handlePm(
      new Request("https://app.test/api/pm" + path, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(data === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      }),
      env,
    );
  try {
    await db.exec(await readFile("migrations/0001_pm.sql", "utf8"));
    await t.test(
      "anonymous and cross-origin requests are rejected",
      async () => {
        assert.equal((await call("/messages/" + slug)).status, 401);
        assert.equal(
          (
            await call("/auth/register", {
              origin: "https://evil.test",
              data: {},
            })
          ).status,
          403,
        );
      },
    );
    let cookie, userId;
    await t.test(
      "registration stores a password hash and issues HttpOnly cookie",
      async () => {
        const r = await call("/auth/register", {
          data: {
            name: "Test Fan",
            email: "fan@example.test",
            password: "safe-test-password",
          },
        });
        assert.equal(r.status, 200);
        cookie = r.headers.get("Set-Cookie").split(";")[0];
        assert.match(
          r.headers.get("Set-Cookie"),
          /HttpOnly; Secure; SameSite=Lax/,
        );
        userId = (await r.json()).user.id;
        const row = await db
          .prepare("SELECT password FROM pm_users WHERE id=?")
          .bind(userId)
          .first();
        assert.notEqual(row.password, "safe-test-password");
        assert.equal(
          (
            await call("/auth/login", {
              data: { email: "fan@example.test", password: "wrong-password" },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await call("/auth/login", {
              data: {
                email: "fan@example.test",
                password: "safe-test-password",
              },
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "catalog excludes private previews; unpurchased messages and media are denied",
      async () => {
        const r = await call("/conversations", { cookie });
        assert.equal(r.status, 200);
        assert.doesNotMatch(
          await r.text(),
          /PRIVATE PREVIEW|last_message|test-pm-secret/,
        );
        assert.equal((await call("/messages/" + slug, { cookie })).status, 403);
        assert.equal(
          (await call("/media/" + slug + "/photo.jpg", { cookie })).status,
          403,
        );
      },
    );
    let orderId, firstExpiry;
    await t.test(
      "server fixes price, member and duration; checkout excludes external payment URL",
      async () => {
        const r = await call("/orders", {
          cookie,
          data: { member: slug, plan: "daily", amount: 1, days: 999, price: 1 },
        });
        assert.equal(r.status, 201);
        orderId = (await r.json()).id;
        assert.equal(charged.amount, "3000");
        assert.equal(charged.ref_id, orderId);
        const order = await call("/orders/" + orderId, { cookie });
        const text = await order.text();
        assert.doesNotMatch(
          text,
          /payment_url|test-gateway-secret|payment_token/,
        );
        const data = JSON.parse(text).data;
        assert.equal(data.days, 2);
        assert.equal(data.price, 3000);
        assert.equal(
          (
            await call("/orders", {
              cookie,
              data: { member: slug, plan: "toString" },
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "one user cannot access another user transaction",
      async () => {
        const r = await call("/auth/register", {
          data: {
            name: "Other Fan",
            email: "other@example.test",
            password: "safe-test-password",
          },
        });
        const other = r.headers.get("Set-Cookie").split(";")[0];
        assert.equal(
          (await call("/orders/" + orderId, { cookie: other })).status,
          404,
        );
      },
    );
    await t.test(
      "gateway amount and transaction ID must match before granting",
      async () => {
        paymentStatus = "SUCCESS";
        checkAmount = 1;
        assert.equal(
          (await call("/orders/" + orderId + "/check", { cookie, data: {} }))
            .status,
          502,
        );
        checkAmount = 3001;
        checkTrxOverride = "MY-WRONG";
        assert.equal(
          (await call("/orders/" + orderId + "/check", { cookie, data: {} }))
            .status,
          502,
        );
        const grant = await db
          .prepare("SELECT order_id FROM pm_grants WHERE order_id=?")
          .bind(orderId)
          .first();
        assert.equal(grant, null);
        checkTrxOverride = undefined;
        paymentStatus = "PENDING";
      },
    );
    await t.test(
      "pending grants nothing; verified success grants once under concurrent checks",
      async () => {
        assert.equal(
          (await call("/orders/" + orderId + "/check", { cookie, data: {} }))
            .status,
          200,
        );
        assert.equal((await call("/messages/" + slug, { cookie })).status, 403);
        paymentStatus = "SUCCESS";
        const before = Math.floor(Date.now() / 1000);
        const results = await Promise.all(
          Array.from({ length: 4 }, () =>
            call("/orders/" + orderId + "/check", { cookie, data: {} }),
          ),
        );
        for (const r of results) assert.equal(r.status, 200);
        const count = await db
          .prepare("SELECT COUNT(*) AS n FROM pm_grants WHERE order_id=?")
          .bind(orderId)
          .first();
        assert.equal(count.n, 1);
        const grant = await db
          .prepare("SELECT expires_at FROM pm_grants WHERE order_id=?")
          .bind(orderId)
          .first();
        firstExpiry = grant.expires_at;
        assert.ok(firstExpiry >= before + 2 * 86400);
        assert.ok(firstExpiry <= Math.floor(Date.now() / 1000) + 2 * 86400);
      },
    );
    await t.test(
      "message media stays behind access proxy; byte ranges forwarded",
      async () => {
        const r = await call("/messages/" + slug, { cookie });
        assert.equal(r.status, 200);
        const m = (await r.json()).messages[0];
        assert.deepEqual(m.media_urls, [`/api/pm/media/${slug}/photo.jpg`]);
        const media = await call("/media/" + slug + "/photo.jpg", {
          cookie,
          headers: { Range: "bytes=0-2" },
        });
        assert.equal(media.status, 206);
        assert.equal(range, "bytes=0-2");
        assert.equal(media.headers.get("Cache-Control"), "private, no-store");
        assert.equal(
          (await call("/media/" + slug + "/unsafe.svg", { cookie })).status,
          404,
        );
      },
    );
    await t.test(
      "renewal extends access; cancellation grants nothing",
      async () => {
        const create = await call("/orders", {
          cookie,
          data: { member: slug, plan: "daily" },
        });
        const second = (await create.json()).id;
        await call("/orders/" + second + "/check", { cookie, data: {} });
        const row = await db
          .prepare(
            "SELECT MAX(expires_at) AS expiry FROM pm_grants WHERE user_id=?",
          )
          .bind(userId)
          .first();
        assert.equal(row.expiry, firstExpiry + 2 * 86400);
        paymentStatus = "PENDING";
        const r = await call("/orders", {
          cookie,
          data: { member: slug, plan: "daily" },
        });
        const third = (await r.json()).id;
        await call("/orders/" + third + "/cancel", { cookie, data: {} });
        const count = await db
          .prepare("SELECT COUNT(*) AS n FROM pm_grants WHERE order_id=?")
          .bind(third)
          .first();
        assert.equal(count.n, 0);
      },
    );
    await t.test(
      "expired access is denied; logout invalidates session",
      async () => {
        await db
          .prepare("UPDATE pm_grants SET expires_at=1 WHERE user_id=?")
          .bind(userId)
          .run();
        const before = upstreamCalls;
        assert.equal((await call("/messages/" + slug, { cookie })).status, 403);
        assert.equal(
          (await call("/media/" + slug + "/photo.jpg", { cookie })).status,
          403,
        );
        assert.equal(upstreamCalls, before);
        await call("/auth/logout", { cookie, data: {} });
        assert.equal((await call("/messages/" + slug, { cookie })).status, 401);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    await platform.dispose();
    await rm(scratch, { recursive: true, force: true });
  }
});

// Node's fetch accepts redirect: "error"; workerd rejects it before any subrequest.
// Exercise the handler inside the same runtime as production, with mocked network only.
test("PM external requests in the Cloudflare runtime", async (t) => {
  const { Miniflare, convertV4MiniflareOptions } = await import("miniflare");
  const bundle = await build({
    stdin: {
      contents:
        'import { handlePm } from "./worker/pm.ts"; export default { fetch: handlePm };',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
  });
  let mode = "json";
  let qrImage =
    "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=test-payment";
  const requests = [];
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      compatibilityDate: "2026-10-01",
      script: bundle.outputFiles[0].text,
      d1Databases: ["PM_DB"],
      bindings: {
        PM_API_KEY: "test-pm-secret",
        MYPG_API_KEY: "test-gateway-secret",
      },
      outboundService: async (request) => {
        const url = new URL(request.url);
        requests.push(url);
        if (mode === "redirect")
          return new Response(null, {
            status: 302,
            headers: { Location: "https://untrusted.test/" },
          });
        if (mode === "html")
          return new Response("<html>Service unavailable</html>", {
            headers: { "Content-Type": "text/html" },
          });
        if (mode === "shape")
          return Response.json({ success: true, data: null, messages: null });
        if (url.hostname === "yobasepay.net") {
          // The live MYPG endpoint reads PHP form fields, not a JSON request body.
          if (
            !request.headers
              .get("Content-Type")
              ?.startsWith("application/x-www-form-urlencoded")
          )
            return Response.json({
              status: false,
              message: "API Key required",
            });
          assert.equal(request.method, "POST");
          const body = Object.fromEntries(await request.formData());
          assert.equal(body.api_key, "test-gateway-secret");
          if (url.searchParams.get("action") === "createpayment") {
            assert.equal(body.amount, "3000");
            return Response.json({
              status: true,
              data: {
                trx_id: `MY-${body.ref_id}`,
                amount: 3000,
                qr_image: qrImage,
                expired_at: "2026-12-31 23:59:59",
              },
            });
          }
          return Response.json({
            status: true,
            data: {
              trx_id: body.trxid,
              amount: 3000,
              status:
                url.searchParams.get("action") === "cancelpayment"
                  ? "CANCELLED"
                  : "PENDING",
            },
          });
        }
        assert.equal(url.hostname, "privatemessageraffz.my.id");
        assert.equal(request.headers.get("X-API-Key"), "test-pm-secret");
        if (url.pathname === "/api/v1/conversations")
          return Response.json({
            success: true,
            data: [
              {
                member: "Lily JKT48",
                slug: "Lily_JKT48",
                last_message: { text: "PRIVATE" },
              },
            ],
          });
        if (url.pathname.startsWith("/api/v1/messages/"))
          return Response.json({
            success: true,
            messages: [
              {
                message_id: "msg-1",
                sequence_order: 1,
                text: "Fixture",
                media_urls: [],
              },
            ],
            pagination: { has_next: false },
          });
        return new Response(new Uint8Array([1, 2, 3]), {
          status: request.headers.has("Range") ? 206 : 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Range": "bytes 0-2/3",
          },
        });
      },
    }),
  );
  try {
    const db = await mf.getD1Database("PM_DB");
    await db.exec(await readFile("migrations/0001_pm.sql", "utf8"));
    let cookie;
    const call = (path, data, extra = {}) =>
      mf.dispatchFetch(`https://app.test/api/pm${path}`, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          Origin: "https://app.test",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(data === undefined ? {} : { "Content-Type": "application/json" }),
          ...extra,
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    const registered = await call("/auth/register", {
      name: "Runtime Test",
      email: "runtime@example.test",
      password: "runtime-test-password",
    });
    assert.equal(registered.status, 200);
    cookie = registered.headers.get("Set-Cookie").split(";")[0];
    const user = (await registered.json()).user;
    await db
      .prepare(
        "INSERT INTO pm_orders(id,user_id,member,member_name,plan,days,price,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        "seed-order",
        user.id,
        "Lily_JKT48",
        "Lily JKT48",
        "daily",
        2,
        3000,
        "SUCCESS",
        1,
      )
      .run();
    await db
      .prepare("INSERT INTO pm_grants VALUES (?,?,?,?)")
      .bind(
        "seed-order",
        user.id,
        "Lily_JKT48",
        Math.floor(Date.now() / 1000) + 86400,
      )
      .run();
    await t.test(
      "catalog, history, polling and media make valid runtime subrequests",
      async () => {
        for (const path of [
          "/conversations",
          "/messages/Lily_JKT48",
          "/messages/Lily_JKT48/latest?afterId=msg-1",
          "/media/Lily_JKT48/photo.jpg",
        ]) {
          const result = await call(path);
          assert.equal(result.status, 200, `${path}: ${await result.text()}`);
        }
        assert.equal(
          (
            await call("/media/Lily_JKT48/photo.jpg", undefined, {
              Range: "bytes=0-2",
            })
          ).status,
          206,
        );
      },
    );
    await t.test(
      "MYPG form creation, verification and cancellation work inside workerd",
      async () => {
        const created = await call("/orders", {
          member: "Lily_JKT48",
          plan: "daily",
        });
        const data = await created.json();
        assert.equal(created.status, 201, JSON.stringify(data));
        const order = await call(`/orders/${data.id}`);
        assert.equal((await order.json()).data.qr_image, qrImage);
        const verified = await call(`/orders/${data.id}/check`, {});
        assert.equal(verified.status, 200);
        assert.equal((await verified.json()).data.status, "PENDING");
        const cancelled = await call(`/orders/${data.id}/cancel`, {});
        assert.equal(cancelled.status, 200);
        assert.equal((await cancelled.json()).data.status, "CANCELLED");
      },
    );
    await t.test("checkout rejects untrusted QR origins", async () => {
      const previous = qrImage;
      for (const value of [
        "https://api.qrserver.com.evil.test/qr",
        "javascript:alert(1)",
        "https://user:password@api.qrserver.com/qr",
      ]) {
        qrImage = value;
        const result = await call("/orders", {
          member: "Lily_JKT48",
          plan: "daily",
        });
        assert.equal(result.status, 502);
        assert.match(
          (await result.json()).error,
          /Respons pembayaran tidak valid/,
        );
      }
      qrImage = previous;
    });
    await t.test(
      "upstream redirects never forward API credentials to another host",
      async () => {
        mode = "redirect";
        const count = requests.length;
        assert.equal((await call("/conversations")).status, 502);
        assert.equal((await call("/media/Lily_JKT48/photo.jpg")).status, 502);
        assert.equal(requests.length, count + 2);
        assert.ok(requests.every((url) => url.hostname !== "untrusted.test"));
        mode = "json";
      },
    );
    await t.test(
      "non-JSON and malformed upstream payloads return gateway errors",
      async () => {
        for (const variant of ["html", "shape"]) {
          mode = variant;
          assert.equal((await call("/conversations")).status, 502);
          assert.equal((await call("/messages/Lily_JKT48")).status, 502);
        }
        mode = "json";
      },
    );
  } finally {
    await mf.dispose();
  }
});
