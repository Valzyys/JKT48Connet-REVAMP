import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const scratch = await mkdtemp(join(tmpdir(), "jkc-download-test-"));
await build({ entryPoints: ["worker/download.ts"], bundle: true, platform: "node", format: "esm", outfile: join(scratch, "download.mjs"), logLevel: "silent" });
const { handleStreamDownload, STREAM_DOWNLOAD } = await import(join(scratch, "download.mjs"));
test.after(() => rm(scratch, { recursive: true, force: true }));

const ORIGIN = "https://jkt48connect.app";
const link = (v) => `${ORIGIN}/download/JKT48Connect-Stream${v ? `-V${v}` : ""}.apk`;
const ROOT = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download";
const FIXED = `${ROOT}/stream-latest/JKT48Connect-Stream.apk`;
const asset = (v) => `${ROOT}/stream-mobile-build-${v === "1.0.2" ? 13 : 12}/JKT48Connect-Stream-v${v}.apk`;
const APK = (v) => new Uint8Array([80, 75, 3, 4, v === "1.0.2" ? 3 : 2]);
const RELEASES = [
  { tag_name: "main-build-99", assets: [{ name: "JKT48Connect-Stream-v1.0.2.apk", browser_download_url: "https://github.com/x/other.apk" }] },
  { tag_name: "stream-mobile-build-14", draft: true, assets: [{ name: "JKT48Connect-Stream-v1.0.2.apk", browser_download_url: "https://github.com/x/draft.apk" }] },
  ...["1.0.2", "1.0.1"].map(v => ({ tag_name: `stream-mobile-build-${v === "1.0.2" ? 13 : 12}`, assets: [
    { name: "JKT48Connect-Stream-review.apk", browser_download_url: "https://github.com/x/review.apk" },
    { name: `JKT48Connect-Stream-v${v}.apk`, browser_download_url: asset(v) },
  ] })),
];

function edge() {
  const store = new Map();
  globalThis.caches = { default: {
    async match(req) { const hit = store.get(req.url); return hit && new Response(hit.body, { headers: hit.headers }); },
    async put(req, res) { store.set(req.url, { body: await res.arrayBuffer(), headers: [...res.headers] }); },
  } };
  const pending = [];
  return { store, ctx: { waitUntil: p => pending.push(p) }, settle: () => Promise.all(pending) };
}

function github(calls, { fixed = 200, api = 200, releases = RELEASES } = {}) {
  return { UPSTREAM_FETCH: async url => {
    url = String(url); calls.push(url);
    if (url === FIXED) return new Response(fixed === 200 ? APK("1.0.1") : "Unavailable", { status: fixed });
    if (url.includes("/stream-latest/")) return new Response("Not Found", { status: 404 });
    if (url.startsWith("https://api.github.com/")) return api === 200 ? Response.json(releases) : new Response("rate limited", { status: api });
    if (url === asset("1.0.2")) return new Response(APK("1.0.2"));
    if (url === asset("1.0.1")) return new Response(APK("1.0.1"));
    throw new Error(`Unexpected upstream: ${url}`);
  } };
}
const bytes = async res => [...new Uint8Array(await res.arrayBuffer())];

test("route matches generic and versioned links in any letter case", () => {
  for (const name of ["JKT48Connect-Stream.apk", "JKT48Connect-Stream-V1.0.2.apk", "jkt48connect-stream-v1.0.1.apk"]) assert.ok(STREAM_DOWNLOAD.test(`/download/${name}`));
  assert.ok(!STREAM_DOWNLOAD.test("/download/JKT48Connect-Stream-V1.0.apk"));
  assert.ok(!STREAM_DOWNLOAD.test("/download/JKT48Connect-Stream-V1.0.2.apk/x"));
});

test("generic latest uses the fixed release without the releases API and revalidates browser cache", async () => {
  const { ctx, settle } = edge();
  const calls = [];
  const res = await handleStreamDownload(new Request(link()), github(calls), ctx);
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [FIXED]);
  assert.equal(res.headers.get("content-type"), "application/vnd.android.package-archive");
  assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.deepEqual(await bytes(res), [...APK("1.0.1")]);
  await settle();
  const again = [];
  assert.deepEqual(await bytes(await handleStreamDownload(new Request(link()), github(again), ctx)), [...APK("1.0.1")]);
  assert.deepEqual(again, []);
});

test("versioned links cannot reuse generic, old-version, or legacy shared cache bytes", async () => {
  const { ctx, store, settle } = edge();
  store.set(`${ORIGIN}/__cache/v2/stream-apk/fresh`, { body: APK("1.0.1"), headers: [] });
  for (const v of [undefined, "1.0.1"]) await bytes(await handleStreamDownload(new Request(link(v)), github([]), ctx));
  await settle();
  const calls = [];
  const res = await handleStreamDownload(new Request(link("1.0.2")), github(calls), ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-disposition"), 'attachment; filename="JKT48Connect-Stream-V1.0.2.apk"');
  assert.equal(res.headers.get("x-stream-build"), "stream-mobile-build-13");
  assert.deepEqual(await bytes(res), [...APK("1.0.2")]);
  assert.ok(!calls.includes(FIXED), "versioned URLs never fetch the mutable asset");
  assert.equal(calls.at(-1), asset("1.0.2"));
  await settle();
  const again = [];
  const cached = await handleStreamDownload(new Request(link("1.0.2").toLowerCase()), github(again), ctx);
  assert.deepEqual(await bytes(cached), [...APK("1.0.2")]);
  assert.deepEqual(again, [], "case variants share the correct version cache");
});

test("missing version never falls back to a differently versioned release or stale copy", async () => {
  const { ctx, settle } = edge();
  await bytes(await handleStreamDownload(new Request(link("1.0.1")), github([]), ctx));
  await settle();
  const res = await handleStreamDownload(new Request(link("9.9.9")), github([]), ctx);
  assert.equal(res.status, 502);
});

test("an upstream outage only serves the stale copy of the requested version", async () => {
  const { ctx, store, settle } = edge();
  await bytes(await handleStreamDownload(new Request(link("1.0.2")), github([]), ctx));
  await settle();
  for (const key of [...store.keys()]) if (key.endsWith("/fresh")) store.delete(key);
  const res = await handleStreamDownload(new Request(link("1.0.2")), github([], { api: 403 }), ctx);
  assert.equal(res.status, 200);
  assert.deepEqual(await bytes(res), [...APK("1.0.2")]);
  assert.equal((await handleStreamDownload(new Request(link("1.0.1")), github([], { api: 403 }), ctx)).status, 502);
});

test("generic latest falls back to the newest published release, HEAD is empty, POST refused", async () => {
  const { ctx } = edge();
  const res = await handleStreamDownload(new Request(link()), github([], { fixed: 404 }), ctx);
  assert.deepEqual(await bytes(res), [...APK("1.0.2")]);
  const head = await handleStreamDownload(new Request(link("1.0.2"), { method: "HEAD" }), github([]), edge().ctx);
  assert.equal(head.status, 200);
  assert.equal(head.body, null);
  assert.equal((await handleStreamDownload(new Request(link(), { method: "POST" }), github([]), ctx)).status, 405);
});
