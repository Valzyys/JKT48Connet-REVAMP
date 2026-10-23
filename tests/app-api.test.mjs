import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const scratch = await mkdtemp(join(tmpdir(), "jkc-app-test-"));
await build({
  entryPoints: ["worker/proxy.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["cloudflare:*"],
  outfile: join(scratch, "proxy.mjs"),
  logLevel: "silent",
});
const { handleApi } = await import(join(scratch, "proxy.mjs"));
test.after(() => rm(scratch, { recursive: true, force: true }));

const upstreamCalls = [];
const MP4 = "https://media.test/live/v.mp4";
const env = {
  JKT48CONNECT_API_KEY: "test-key",
  SESSION_SECRET: "s".repeat(40),
  GUARD_DISABLED: "1",
  UPSTREAM_FETCH: async (input, init = {}) => {
    const url = new URL(String(input));
    upstreamCalls.push({ url: url.href, range: new Headers(init.headers).get("Range") });
    if (url.pathname === "/api/now_live") return Response.json([]);
    if (url.pathname === "/api/recent/idn-x")
      return Response.json({
        data_id: "idn-x",
        member: { name: "Test Member" },
        live_info: { date: { start: "2026-01-01T10:00:00.000Z", end: "2026-01-01T11:00:00.000Z" } },
        recordings: [{ url: MP4, stream_url: "https://media.test/live/v.m3u8", duration_ms: 60000 }],
      });
    if (url.pathname === "/live/v.m3u8")
      return new Response(
        ["#EXTM3U", "#EXT-X-PLAYLIST-TYPE:VOD", `#EXT-X-MAP:URI="${MP4}",BYTERANGE="100@0"`, "#EXTINF:2,", "#EXT-X-BYTERANGE:500@100", MP4, "#EXTINF:2,", "#EXT-X-BYTERANGE:500@600", MP4, "#EXT-X-ENDLIST", ""].join("\n"),
      );
    if (url.href === "https://api.github.com/repos/Valzyys/JKT48Connet-REVAMP/releases/latest")
      return Response.json({
        tag_name: "mobile-build-7",
        name: "JKT48Connect Android 2.2.0 (mobile-build-7)",
        body: "Perbaikan",
        html_url: "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/tag/mobile-build-7",
        published_at: "2026-10-24T00:00:00Z",
        assets: [
          { name: "notes.txt", size: 1, browser_download_url: "https://github.com/x/notes.txt" },
          { name: "jkt48connect.apk", size: 2000000, browser_download_url: "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/mobile-build-7/jkt48connect.apk" },
        ],
      });
    if (url.href === "https://jkt48.com/images/news/a.jpg") return new Response(new Uint8Array([255, 216, 255]), { headers: { "content-type": "image/jpeg" } });
    if (url.href === MP4) return new Response(new Uint8Array(10), { status: 206, headers: { "content-range": "bytes 0-9/1100", "content-length": "10" } });
    return new Response("not found", { status: 404 });
  },
};
const ctx = { waitUntil() {} };
const call = (path, { token, method = "GET", headers = {} } = {}) =>
  handleApi(
    new Request(`https://app.test${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      ...(method === "POST" ? { body: "{}" } : {}),
    }),
    env,
    ctx,
  );
const newToken = async () => (await (await call("/api/app/session", { method: "POST" })).json()).token;

test("app session issues a bearer token; data requires it", async () => {
  const res = await call("/api/app/session", { method: "POST" });
  assert.equal(res.status, 200);
  const { token, exp } = await res.json();
  assert.match(token, /^a1\.[\w-]{22}\.\d{10}\.[\w-]{43}$/);
  assert.ok(exp > Date.now() / 1000 + 29 * 86400);
  assert.equal((await call("/api/app/session")).status, 405, "GET session is not allowed");

  assert.equal((await call("/api/app/now_live")).status, 401);
  assert.equal((await call("/api/app/now_live", { token: token.replace(/^a1/, "v1") })).status, 401, "cookie-format tokens are rejected");
  assert.equal((await call("/api/app/now_live", { token: token.slice(0, -2) + "xx" })).status, 401, "tampered tokens are rejected");

  const live = await call("/api/app/now_live", { token });
  assert.equal(live.status, 200);
  assert.match(live.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await live.json(), []);
  assert.equal((await call("/api/app/does_not_exist", { token })).status, 404);
  assert.equal((await call("/api/app/now_live?x=1", { token })).status, 400, "unknown query params are rejected");
});

test("replay links point to the app endpoints and are bound to the app token", async () => {
  const token = await newToken();
  const other = await newToken();
  const detail = await (await call("/api/app/recent/idn-x", { token })).json();
  const rec = detail.recordings[0];
  assert.match(rec.url, /^\/api\/app\/replay\?t=/);
  assert.match(rec.hls, /^\/api\/app\/replay\/hls\?t=/);
  assert.doesNotMatch(JSON.stringify(detail), /media\.test/, "upstream file URLs never reach the app");

  const pl = await call(rec.hls, { token });
  assert.equal(pl.status, 200);
  const text = await pl.text();
  assert.match(text, /#EXT-X-MAP:URI="\/api\/app\/replay\?t=/);
  assert.doesNotMatch(text, /media\.test/);
  const segment = text.split("\n").find((l) => l.startsWith("/api/app/replay?t="));

  const media = await call(segment, { token, headers: { Range: "bytes=0-9" } });
  assert.equal(media.status, 206);
  assert.equal(upstreamCalls.at(-1).range, "bytes=0-9");
  assert.equal((await call(segment, { token: other })).status, 403, "another install cannot reuse the link");
  assert.equal((await call(rec.url)).status, 401, "no token, no replay");
});

test("app media proxies jkt48.com images only, with the app token", async () => {
  const token = await newToken();
  const img = "/api/app/media?url=" + encodeURIComponent("https://jkt48.com/images/news/a.jpg");
  assert.equal((await call(img)).status, 401, "no token, no image");
  const ok = await call(img, { token });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/jpeg");
  const evil = "/api/app/media?url=" + encodeURIComponent("https://evil.test/a.jpg");
  assert.equal((await call(evil, { token })).status, 403, "other hosts are refused");
});

test("app update reports the latest GitHub release, with the app token", async () => {
  assert.equal((await call("/api/app/update")).status, 401);
  const token = await newToken();
  const res = await call("/api/app/update", { token });
  assert.equal(res.status, 200);
  const info = await res.json();
  assert.equal(info.version, "2.2.0");
  assert.equal(info.apk, "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/mobile-build-7/jkt48connect.apk");
  assert.equal(info.size, 2000000);
  assert.equal(info.notes, "Perbaikan");
  assert.equal((await call("/api/app/update?x=1", { token })).status, 400);
});
