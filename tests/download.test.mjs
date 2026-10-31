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

const ctx = { waitUntil() {} };
const APK = "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/stream-mobile-build-9/JKT48Connect-Stream-v1.0.0.apk";
const RELEASES = [
  { tag_name: "v2.6.1", assets: [{ name: "jkt48connect.apk", browser_download_url: "https://github.com/x/main.apk" }] },
  { tag_name: "stream-mobile-build-10", draft: true, assets: [{ name: "JKT48Connect-Stream-v1.0.0.apk", browser_download_url: "https://github.com/x/draft.apk" }] },
  { tag_name: "stream-mobile-build-9", assets: [
    { name: "JKT48Connect-Stream-review.apk", browser_download_url: "https://github.com/x/review.apk" },
    { name: "JKT48Connect-Stream-v1.0.0.apk", browser_download_url: APK },
  ] },
  { tag_name: "stream-mobile-build-8", assets: [{ name: "JKT48Connect-Stream-v1.0.0.apk", browser_download_url: "https://github.com/x/old.apk" }] },
];

function env(calls) {
  return {
    UPSTREAM_FETCH: async (url) => {
      calls.push(String(url));
      if (String(url).startsWith("https://api.github.com/")) return Response.json(RELEASES);
      return new Response(new Uint8Array([80, 75, 3, 4]), { headers: { "content-length": "4" } });
    },
  };
}

test("route matches the public link, any letter case", () => {
  assert.ok(STREAM_DOWNLOAD.test("/download/JKT48Connect-Stream-V1.0.0.apk"));
  assert.ok(STREAM_DOWNLOAD.test("/download/jkt48connect-stream-v1.0.0.apk"));
  assert.ok(!STREAM_DOWNLOAD.test("/download/JKT48Connect-Stream-V1.0.0.apk/x"));
});

test("serves the release APK of the newest published Stream build as an APK download", async () => {
  const calls = [];
  const res = await handleStreamDownload(new Request("https://jkt48connect.app/download/JKT48Connect-Stream-V1.0.0.apk"), env(calls), ctx);
  assert.equal(res.status, 200);
  assert.deepEqual(calls.slice(1), [APK]);
  assert.equal(res.headers.get("content-type"), "application/vnd.android.package-archive");
  assert.equal(res.headers.get("content-disposition"), 'attachment; filename="JKT48Connect-Stream-V1.0.0.apk"');
  assert.equal(res.headers.get("x-stream-build"), "stream-mobile-build-9");
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [80, 75, 3, 4]);
});

test("HEAD has headers only and other methods are refused", async () => {
  const head = await handleStreamDownload(new Request("https://jkt48connect.app/download/JKT48Connect-Stream-V1.0.0.apk", { method: "HEAD" }), env([]), ctx);
  assert.equal(head.status, 200);
  assert.equal(head.body, null);
  const post = await handleStreamDownload(new Request("https://jkt48connect.app/download/JKT48Connect-Stream-V1.0.0.apk", { method: "POST" }), env([]), ctx);
  assert.equal(post.status, 405);
});

test("no Stream release yet → 502 with a readable message", async () => {
  const res = await handleStreamDownload(new Request("https://jkt48connect.app/download/JKT48Connect-Stream-V1.0.0.apk"), { UPSTREAM_FETCH: async () => Response.json([]) }, ctx);
  assert.equal(res.status, 502);
});
