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

const LINK = "https://jkt48connect.app/download/JKT48Connect-Stream-V1.0.0.apk";
const FIXED = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/stream-latest/JKT48Connect-Stream-v1.0.0.apk";
const BUILD9 = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/stream-mobile-build-9/JKT48Connect-Stream-v1.0.0.apk";
const RELEASES = [
  { tag_name: "v2.6.1", assets: [{ name: "jkt48connect.apk", browser_download_url: "https://github.com/x/main.apk" }] },
  { tag_name: "stream-mobile-build-10", draft: true, assets: [{ name: "JKT48Connect-Stream-v1.0.0.apk", browser_download_url: "https://github.com/x/draft.apk" }] },
  { tag_name: "stream-mobile-build-9", assets: [
    { name: "JKT48Connect-Stream-review.apk", browser_download_url: "https://github.com/x/review.apk" },
    { name: "JKT48Connect-Stream-v1.0.0.apk", browser_download_url: BUILD9 },
  ] },
];
const APK = new Uint8Array([80, 75, 3, 4]);

/** Cache edge tiruan (Map) dan waitUntil yang bisa ditunggu. */
function edge() {
  const store = new Map();
  globalThis.caches = { default: {
    async match(req) { const hit = store.get(req.url); return hit && new Response(hit.body, { headers: hit.headers }); },
    async put(req, res) { store.set(req.url, { body: await res.arrayBuffer(), headers: [...res.headers] }); },
  } };
  const pending = [];
  return { store, ctx: { waitUntil: (p) => pending.push(p) }, settle: () => Promise.all(pending) };
}

/** GitHub tiruan: `fixed` = status rilis tetap, `api` = status API rilis. */
function github(calls, { fixed = 200, api = 200, file = 200 } = {}) {
  return { UPSTREAM_FETCH: async (url) => {
    url = String(url); calls.push(url);
    if (url === FIXED) return fixed === 200 ? new Response(APK, { headers: { "content-length": "4" } }) : new Response("Not Found", { status: fixed });
    if (url.startsWith("https://api.github.com/")) return api === 200 ? Response.json(RELEASES) : new Response("rate limited", { status: api });
    return file === 200 ? new Response(APK, { headers: { "content-length": "4" } }) : new Response("x", { status: file });
  } };
}

test("route matches the public link, any letter case", () => {
  assert.ok(STREAM_DOWNLOAD.test("/download/JKT48Connect-Stream-V1.0.0.apk"));
  assert.ok(STREAM_DOWNLOAD.test("/download/jkt48connect-stream-v1.0.0.apk"));
  assert.ok(!STREAM_DOWNLOAD.test("/download/JKT48Connect-Stream-V1.0.0.apk/x"));
});

test("serves the fixed stream-latest asset without touching the GitHub API, as an APK download", async () => {
  const { ctx, settle } = edge();
  const calls = [];
  const res = await handleStreamDownload(new Request(LINK), github(calls), ctx);
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [FIXED]);
  assert.equal(res.headers.get("content-type"), "application/vnd.android.package-archive");
  assert.equal(res.headers.get("content-disposition"), 'attachment; filename="JKT48Connect-Stream-V1.0.0.apk"');
  assert.equal(res.headers.get("x-stream-build"), "stream-latest");
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [80, 75, 3, 4]);
  await settle();
  const again = [];
  const cached = await handleStreamDownload(new Request(LINK), github(again), ctx);
  assert.equal((await cached.arrayBuffer()).byteLength, 4);
  assert.deepEqual(again, [], "second request comes from the edge cache");
});

test("without the fixed release it falls back to the newest published build via the API", async () => {
  const { ctx } = edge();
  const calls = [];
  const res = await handleStreamDownload(new Request(LINK), github(calls, { fixed: 404 }), ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-stream-build"), "stream-mobile-build-9");
  assert.equal(calls.at(-1), BUILD9);
});

test("when GitHub fails (rate limit) the last good copy is served", async () => {
  const { store, ctx, settle } = edge();
  await (await handleStreamDownload(new Request(LINK), github([]), ctx)).arrayBuffer();
  await settle();
  for (const key of [...store.keys()]) if (key.endsWith("/fresh")) store.delete(key);
  const res = await handleStreamDownload(new Request(LINK), github([], { fixed: 404, api: 403 }), ctx);
  assert.equal(res.status, 200);
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [80, 75, 3, 4]);
});

test("nothing available → 502 with a readable message; HEAD has no body; POST refused", async () => {
  const { ctx } = edge();
  const res = await handleStreamDownload(new Request(LINK), github([], { fixed: 404, api: 403 }), ctx);
  assert.equal(res.status, 502);
  const head = await handleStreamDownload(new Request(LINK, { method: "HEAD" }), github([]), edge().ctx);
  assert.equal(head.status, 200);
  assert.equal(head.body, null);
  const post = await handleStreamDownload(new Request(LINK, { method: "POST" }), github([]), ctx);
  assert.equal(post.status, 405);
});
