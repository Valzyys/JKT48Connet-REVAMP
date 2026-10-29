import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
const SR = "https://shard902-cdn.showroom-txlive.com/live/abc_510000";
// Satu live Showroom (stream diputar langsung) dan satu live IDN (selalu dibuka di idn.app).
const LIVE = [
  {
    name: "Erine",
    type: "showroom",
    url_key: "JKT48_Erine",
    room_id: 510000,
    started_at: "2026-10-27T14:10:42.000Z",
    notification_data_id: "sr-510000-1",
    streaming_url_list: [
      { label: "low quality", quality: 100, url: `${SR}_low.m3u8` },
      { label: "original quality", quality: 1000, url: `${SR}_main.m3u8` },
      { label: "dup", quality: 1000, url: `${SR}_main.m3u8` },
      { label: "evil", quality: 2000, url: "javascript:alert(1)" },
      { label: "plain http", quality: 500, url: "http://cdn.test/a.m3u8" },
    ],
  },
  {
    name: "Aralie",
    type: "idn",
    url_key: "jkt48_aralie",
    slug: "live-aralie",
    started_at: "2026-10-27T14:00:00.000Z",
    notification_data_id: "idn-1",
    streaming_url_list: [{ label: "hd", quality: 720, url: "https://pull.idn.test/aralie.m3u8" }],
  },
];
const MP4 = "https://media.test/live/v.mp4";
const env = {
  JKT48CONNECT_API_KEY: "test-key",
  SESSION_SECRET: "s".repeat(40),
  GUARD_DISABLED: "1",
  UPSTREAM_FETCH: async (input, init = {}) => {
    const url = new URL(String(input));
    upstreamCalls.push({ url: url.href, range: new Headers(init.headers).get("Range") });
    if (url.pathname === "/api/now_live") return Response.json(LIVE);
    if (url.pathname === "/api/showroom-comments/510000")
      return Response.json({
        room_id: 510000,
        data_id: "sr-510000-1",
        status: "connected",
        partial: true,
        updated_at: "2026-10-29T01:00:00.250Z",
        cursor: 43,
        gap: false,
        comments: [
          { id: "e43", sequence: 43, user: { id: "2", name: "Fan Dua", avatar_id: 2, avatar_url: "https://image.showroom-cdn.com/showroom-prod/image/avatar/2.png" }, comment: "<b>Halo</b> kak!", observed_at: "2026-10-29T01:00:00.000Z" },
          { id: "e42", sequence: 42, user: { id: "1", name: "Fan Satu", avatar_id: null, avatar_url: null }, comment: "Semangat", observed_at: "2026-10-29T00:59:59.000Z" },
          { id: "e41", sequence: 41, user: { id: "3", name: "Kosong" }, comment: "" },
        ],
      });
    if (url.pathname === "/api/jkt48_youtube/hAHv54gxD60")
      return Response.json({
        id: "hAHv54gxD60",
        title: "Mini Live",
        channel_title: "JKT48",
        duration: 7165,
        view_count: 354082,
        comment_count: 459,
        url: "https://www.youtube.com/watch?v=hAHv54gxD60",
        playback: { status: "ready", format: "m3u8", qualities: [360, 720], expires_at: 1793093535, url: "https://api.jkt48connect.app/media/youtube/hAHv54gxD60/1793093535.sig/index.m3u8" },
      });
    if (url.pathname === "/api/jkt48_youtube/evilVideo1")
      return Response.json({ id: "evilVideo1", title: "x", playback: { format: "m3u8", url: "https://evil.test/a.m3u8" } });
    if (url.pathname === "/api/jkt48_youtube/hAHv54gxD60/comments")
      return Response.json({
        status: "available",
        total_count: 459,
        comments: [{ id: "c1", text: "Keren!", author: { name: "@fan", avatar: "https://yt3.ggpht.com/a", is_uploader: false }, published_text: "2 days ago", likes: 3, reply_count: 1 }],
        next_cursor: url.searchParams.get("cursor") ? "" : "s1Hz_next-1",
        has_more: !url.searchParams.get("cursor"),
      });
    if (url.pathname === "/api/x/tweets")
      return Response.json({
        tweets: [
          {
            id: "2114965881151524905",
            url: "https://x.com/Levi_JKT48/status/2114965881151524905",
            text: "BALIKPAPAN",
            created_at: "2026-10-27T06:22:14Z",
            author: { username: "Levi_JKT48", name: "Michelle Levia", avatar: "https://pbs.twimg.com/profile_images/1/a_normal.jpg" },
            metrics: { likes: 211, reposts: 22, replies: 25, views: "5526" },
            media: [
              {
                type: "video",
                url: "https://pbs.twimg.com/thumb.jpg",
                variants: [
                  { url: "https://video.twimg.com/a.m3u8", content_type: "application/x-mpegURL", bitrate: null },
                  { url: "https://video.twimg.com/360.mp4", content_type: "video/mp4", bitrate: 832000 },
                  { url: "https://video.twimg.com/720.mp4", content_type: "video/mp4", bitrate: 2176000 },
                  { url: "https://video.twimg.com/1080.mp4", content_type: "video/mp4", bitrate: 8000000 },
                ],
              },
              { type: "photo", url: "javascript:alert(1)" },
            ],
            member: { id: "michelle-levia", name: "Michelle Levia", img: "https://api.jkt48connect.app/media/levi.jpg" },
          },
        ],
        next_cursor: "2114961101884674151",
        has_more: true,
      });
    if (url.pathname === "/api/instagram/posts")
      return Response.json({
        posts: [
          {
            id: "4016457109647055400",
            url: "https://www.instagram.com/p/De9UnYMGtoo/",
            text: "Princess",
            created_at: null,
            first_seen_at: "2026-10-26T12:55:00Z",
            author: { username: "jkt48.olla" },
            member: { member: "febriola-sinambela", name: "Febriola Sinambela" },
            metrics: { likes: 11429, comments: 175, views: null },
            media: {
              type: "carousel",
              thumbnail: { status: "ready", url: "https://api.jkt48connect.app/media/instagram/x/thumbnail" },
              items: [
                { type: "image", width: 3071, height: 4096, thumbnail: { status: "ready", url: "https://api.jkt48connect.app/media/instagram/x/image-0" } },
                { type: "video", thumbnail: { status: "ready", url: "https://api.jkt48connect.app/media/instagram/x/image-1" }, video: { status: "ready", url: "https://api.jkt48connect.app/media/instagram/x/video-1" } },
                { type: "image", thumbnail: { status: "pending", url: null } },
              ],
            },
          },
        ],
        next_cursor: null,
        has_more: false,
      });
    // Live yang baru selesai 1 jam lalu: replay Showroom langsung terbuka, replay IDN masih terkunci 72 jam.
    if (url.pathname === "/api/recent/sr-fresh" || url.pathname === "/api/recent/idn-fresh")
      return Response.json({
        data_id: url.pathname.split("/").pop(),
        type: url.pathname.includes("/sr-") ? "showroom" : "idn",
        member: { name: "Fresh" },
        live_info: { date: { start: new Date(Date.now() - 2 * 3_600_000).toISOString(), end: new Date(Date.now() - 3_600_000).toISOString() } },
        recordings: [{ url: MP4, stream_url: "https://media.test/live/v.m3u8", duration_ms: 60000 }],
      });
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
    if (url.href === "https://api.github.com/repos/Valzyys/JKT48Connet-REVAMP/releases/tags/ios-latest")
      return Response.json({
        tag_name: "ios-latest",
        name: "JKT48Connect iOS 1.0.4 (terbaru)",
        published_at: "2026-10-27T00:00:00Z",
        assets: [
          { name: "repo.json", size: 1, browser_download_url: "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest/repo.json" },
          { name: "jkt48connect.ipa", size: 1800000, browser_download_url: "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest/jkt48connect.ipa" },
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
  const [sr, idn] = await live.json();
  assert.deepEqual(
    sr.streams.map((s) => s.url),
    [`${SR}_main.m3u8`, `${SR}_low.m3u8`],
    "Showroom: https only, deduplicated, highest quality first",
  );
  assert.equal(sr.link, "https://www.showroom-live.com/r/JKT48_Erine");
  assert.deepEqual(idn.streams, [], "IDN lives are never played in-app");

  // /watch memutar stream ini di browser: CSP situs harus mengizinkan host-nya untuk fetch (hls.js) dan <video>.
  const csp = (await readFile("public/_headers", "utf8")).match(/Content-Security-Policy: (.+)/)[1];
  const allows = (directive, url) => {
    const host = new URL(url).host;
    const sources = csp.split(";").map((d) => d.trim().split(/\s+/)).find(([name]) => name === directive).slice(1);
    return sources.some((src) => src.startsWith("https://*.") ? host.endsWith(src.slice("https://*".length)) : src === `https://${host}`);
  };
  for (const s of sr.streams) {
    assert.ok(allows("connect-src", s.url), `connect-src allows ${s.url}`);
    assert.ok(allows("media-src", s.url), `media-src allows ${s.url}`);
  }
  assert.match(idn.link, /^https:\/\/www\.idn\.app\//);
  assert.equal((await call("/api/app/does_not_exist", { token })).status, 404);
  assert.equal((await call("/api/app/now_live?x=1", { token })).status, 400, "unknown query params are rejected");
});

test("replay lock: Showroom replays open as soon as the live ends, IDN replays stay locked for 72 hours", async () => {
  const token = await newToken();
  const sr = await (await call("/api/app/recent/sr-fresh", { token })).json();
  assert.equal(sr.recordings.length, 1, "Showroom replay is playable right away");
  assert.match(sr.recordings[0].url, /^\/api\/app\/replay\?t=/);
  assert.ok(Date.parse(sr.replayUnlockAt) <= Date.now());

  const idn = await (await call("/api/app/recent/idn-fresh", { token })).json();
  assert.deepEqual(idn.recordings, [], "IDN replay sends no URL during the lock");
  assert.equal(idn.recordingCount, 1);
  const hours = (Date.parse(idn.replayUnlockAt) - Date.now()) / 3_600_000;
  assert.ok(hours > 70 && hours < 72, `IDN unlocks ~71 h from now (got ${hours.toFixed(2)})`);
  assert.doesNotMatch(JSON.stringify(idn), /media\.test/);
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
  // Rilis iPhone ikut dilaporkan untuk halaman /apps (aplikasi Android mengabaikannya).
  assert.deepEqual(info.ios, {
    version: "1.0.4",
    ipa: "https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest/jkt48connect.ipa",
    size: 1800000,
    publishedAt: "2026-10-27T00:00:00Z",
  });
  assert.equal((await call("/api/app/update?x=1", { token })).status, 400);
});

test("app push config is disabled until Firebase is configured on the worker", async () => {
  assert.equal((await call("/api/app/push")).status, 401);
  const res = await call("/api/app/push", { token: await newToken() });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { enabled: false });
});

test("Showroom live comments: room id on the live session, latest comments as plain text, oldest first", async () => {
  const token = await newToken();
  const live = await (await call("/api/app/now_live", { token })).json();
  assert.equal(live.find((l) => l.platform === "showroom").roomId, "510000");
  assert.equal(live.find((l) => l.platform === "idn").roomId, "", "IDN has no Showroom room");
  const r = await call("/api/app/showroom-comments/510000", { token });
  assert.equal(r.status, 200);
  const c = await r.json();
  assert.equal(c.status, "connected");
  assert.equal(c.cursor, 43);
  assert.deepEqual(
    c.comments.map((x) => [x.seq, x.name, x.text, x.avatar]),
    [
      [42, "Fan Satu", "Semangat", ""],
      [43, "Fan Dua", "<b>Halo</b> kak!", "https://image.showroom-cdn.com/showroom-prod/image/avatar/2.png"],
    ],
    "empty comments are dropped; text is passed through as plain text for the UI to render safely",
  );
  assert.equal((await call("/api/app/showroom-comments/510000", {})).status, 401, "needs the app token");
  assert.equal((await call("/api/app/showroom-comments/abc", { token })).status, 404);
});

test("YouTube detail returns a playable HLS link from the API domain only; comments page with a cursor", async () => {
  const token = await newToken();
  const v = await (await call("/api/app/jkt48_youtube/hAHv54gxD60", { token })).json();
  assert.equal(v.playable, true);
  assert.equal(v.duration, 7165);
  assert.equal(v.comments, 459);
  assert.match(v.playback.url, /^https:\/\/api\.jkt48connect\.app\/media\/youtube\/hAHv54gxD60\/.+\/index\.m3u8$/);
  assert.deepEqual(v.playback.qualities, [360, 720]);

  const evil = await (await call("/api/app/jkt48_youtube/evilVideo1", { token })).json();
  assert.equal(evil.playable, false, "playlists from other hosts are dropped");
  assert.equal(evil.playback, null);

  const c1 = await (await call("/api/app/jkt48_youtube/hAHv54gxD60/comments", { token })).json();
  assert.equal(c1.items[0].text, "Keren!");
  assert.equal(c1.cursor, "s1Hz_next-1");
  assert.equal(c1.hasMore, true);
  await call(`/api/app/jkt48_youtube/hAHv54gxD60/comments?cursor=${c1.cursor}`, { token });
  assert.equal(new URL(upstreamCalls.at(-1).url).searchParams.get("cursor"), "s1Hz_next-1", "cursor is forwarded");
  assert.equal((await call("/api/app/jkt48_youtube/hAHv54gxD60/comments?cursor=a%20b", { token })).status, 400);
  assert.equal((await call("/api/app/jkt48_youtube/bad.id!", { token })).status, 404);
});

test("member social feeds: one post shape for X / Instagram, safe media, validated filters", async () => {
  const token = await newToken();
  const x = await (await call("/api/app/x/tweets?member=michelle-levia&limit=10", { token })).json();
  const sent = new URL(upstreamCalls.at(-1).url);
  assert.equal(sent.pathname, "/api/x/tweets");
  assert.equal(sent.searchParams.get("member"), "michelle-levia");
  assert.equal(sent.searchParams.get("before"), null, "empty cursor is not forwarded");
  const t = x.items[0];
  assert.equal(t.platform, "x");
  assert.equal(t.views, 5526);
  assert.equal(t.author.avatar, "https://pbs.twimg.com/profile_images/1/a_200x200.jpg");
  assert.deepEqual(t.media, [{ type: "video", url: "https://video.twimg.com/720.mp4", thumb: "https://pbs.twimg.com/thumb.jpg", width: null, height: null }]);
  assert.equal(x.cursor, "2114961101884674151");

  await call(`/api/app/x/tweets?before=${x.cursor}`, { token });
  assert.equal(new URL(upstreamCalls.at(-1).url).searchParams.get("before"), "2114961101884674151");
  assert.equal((await call("/api/app/x/tweets?before=abc", { token })).status, 400);
  assert.equal((await call("/api/app/x/tweets?member=../etc", { token })).status, 400);
  assert.equal((await call("/api/app/x/tweets?limit=500", { token })).status, 400);

  const ig = await (await call("/api/app/instagram/posts", { token })).json();
  const p = ig.items[0];
  assert.equal(p.platform, "instagram");
  assert.equal(p.date, "2026-10-26T12:55:00Z");
  assert.equal(p.dateApprox, true);
  assert.equal(p.member.id, "febriola-sinambela");
  assert.deepEqual(p.media.map((m) => m.type), ["image", "video"], "pending items are skipped");
  assert.equal(ig.hasMore, false);
});

test("an app newer than the worker is not blocked: unknown app endpoints/params do not add guard points", async () => {
  // Penjaga aktif (memori) — tes lain mematikannya lewat GUARD_DISABLED.
  const guarded = { ...env, GUARD_DISABLED: undefined };
  const req = (path, token) => handleApi(new Request(`https://app.test${path}`, { headers: { Authorization: `Bearer ${token}`, "cf-connecting-ip": "198.51.100.77" } }), guarded, ctx);
  const token = await newToken();
  for (let i = 0; i < 12; i++) {
    assert.equal((await req("/api/app/future_endpoint", token)).status, 404);
    assert.equal((await req("/api/app/now_live?future=1", token)).status, 400);
  }
  const ok = await req("/api/app/now_live", token);
  assert.equal(ok.status, 200, "24 unknown requests later the app still works");
});
