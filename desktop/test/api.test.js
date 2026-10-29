"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApi } = require("../src/api");

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function fakeServer(routes) {
  const calls = [];
  let tokens = 0;
  const fetch = async (url, opts = {}) => {
    const p = new URL(url).pathname + new URL(url).search;
    calls.push(`${opts.method || "GET"} ${p} ${opts.headers?.authorization || ""}`.trim());
    if (p === "/api/app/session") return json(200, { token: `a1.t${++tokens}`, exp: Date.now() / 1000 + 3600 });
    const r = routes[p.replace(/^\/api\/app/, "")];
    const step = Array.isArray(r) ? r.shift() : r;
    if (step instanceof Error) throw step;
    return typeof step === "number" ? json(step, { message: "Tidak ditemukan" }) : json(200, step);
  };
  return { fetch, calls };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "jkc-api-"));

test("one app token is shared by requests and renewed once on 401", async () => {
  const s = fakeServer({ "/now_live": [401, []], "/member": [[{ id: "a" }]] });
  const api = createApi({ fetch: s.fetch, userAgent: "t", cacheDir: tmp() });
  assert.deepEqual((await api.get("/now_live")).data, []);
  assert.deepEqual((await api.get("/member")).data, [{ id: "a" }]);
  assert.deepEqual(s.calls, ["POST /api/app/session", "GET /api/app/now_live Bearer a1.t1", "POST /api/app/session", "GET /api/app/now_live Bearer a1.t2", "GET /api/app/member Bearer a1.t2"]);
});

test("fresh data is cached in memory; offline falls back to the last good copy on disk", async () => {
  const dir = tmp();
  const s1 = fakeServer({ "/recent?page=1&perpage=12": [{ items: [1] }] });
  const a = createApi({ fetch: s1.fetch, userAgent: "t", cacheDir: dir });
  await a.get("/recent?page=1&perpage=12");
  assert.deepEqual(await a.get("/recent?page=1&perpage=12"), { data: { items: [1] }, stale: false });
  assert.equal(s1.calls.filter((c) => c.includes("/recent")).length, 1, "second read comes from memory");

  const s2 = fakeServer({ "/recent?page=1&perpage=12": [new Error("offline")] });
  const b = createApi({ fetch: s2.fetch, userAgent: "t", cacheDir: dir });
  assert.deepEqual(await b.get("/recent?page=1&perpage=12"), { data: { items: [1] }, stale: true });
});

test("only known data paths are allowed and 404 is not masked by cache", async () => {
  const s = fakeServer({ "/recent/x": [404] });
  const api = createApi({ fetch: s.fetch, userAgent: "t", cacheDir: tmp() });
  await assert.rejects(api.get("/donate"), /Jalur tidak dikenal/);
  await assert.rejects(api.get("/replay?t=x"), /Jalur tidak dikenal/);
  await assert.rejects(api.get("https://evil.test/"), /Jalur tidak dikenal/);
  await assert.rejects(api.get("/recent/x"), (e) => e.status === 404);
});
