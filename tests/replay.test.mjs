import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const scratch = await mkdtemp(join(tmpdir(), "jkc-replay-test-"));
await build({
  entryPoints: ["worker/proxy.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["cloudflare:*"],
  outfile: join(scratch, "proxy.mjs"),
  logLevel: "silent",
});
const { rewriteHlsPlaylist } = await import(join(scratch, "proxy.mjs"));
test.after(() => rm(scratch, { recursive: true, force: true }));

const FILE = "https://api.example.test/media/live/x/video-1.mp4";
// Bentuk playlist byte-range upstream: init 1282 byte, lalu fragmen ±1,9 detik berurutan.
const segs = Array.from({ length: 16 }, (_, i) => ({ dur: i === 1 ? 3.8 : 1.9, len: 300000 + i }));
let off = 1282;
const upstream = [
  "#EXTM3U",
  "#EXT-X-VERSION:7",
  "#EXT-X-PLAYLIST-TYPE:VOD",
  "#EXT-X-TARGETDURATION:12",
  "#EXT-X-MEDIA-SEQUENCE:0",
  `#EXT-X-MAP:URI="${FILE}",BYTERANGE="1282@0"`,
  ...segs.flatMap((s) => {
    const out = [`#EXTINF:${s.dur.toFixed(6)},`, `#EXT-X-BYTERANGE:${s.len}@${off}`, FILE];
    off += s.len;
    return out;
  }),
  "#EXT-X-ENDLIST",
  "",
].join("\n");

test("byte-range fragments are merged into ~8s chunks and every file URL is replaced", () => {
  const out = rewriteHlsPlaylist(upstream, "https://api.example.test/media/live/x/video-1.m3u8", (u) => (u === FILE ? "/api/replay?t=TOKEN" : "BAD"));
  assert.ok(out, "playlist accepted");
  assert.doesNotMatch(out, /example\.test|BAD/);
  assert.match(out, /#EXT-X-MAP:URI="\/api\/replay\?t=TOKEN",BYTERANGE="1282@0"/);
  assert.match(out, /#EXT-X-ENDLIST\n$/);
  const durs = [...out.matchAll(/#EXTINF:([\d.]+),/g)].map((m) => Number(m[1]));
  const ranges = [...out.matchAll(/#EXT-X-BYTERANGE:(\d+)@(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(durs.length < segs.length, `merged ${segs.length} → ${durs.length}`);
  assert.ok(durs[0] >= 4 && durs[0] < 6, `first chunk starts playback quickly: ${durs[0]}`);
  assert.ok(durs.slice(1, -1).every((d) => d >= 8 && d < 10), `chunk durations ${durs}`);
  // Total durasi dan byte tidak berubah, potongan tetap bersambung tanpa celah.
  assert.equal(durs.reduce((a, b) => a + b, 0).toFixed(3), segs.reduce((a, s) => a + s.dur, 0).toFixed(3));
  let next = 1282;
  for (const [len, start] of ranges) {
    assert.equal(start, next);
    next += len;
  }
  assert.equal(next, off);
  const target = Number(out.match(/#EXT-X-TARGETDURATION:(\d+)/)[1]);
  assert.ok(target >= Math.max(...durs));
});

test("live, malformed or foreign playlists are rejected", () => {
  const base = "https://api.example.test/media/live/x/video-1.m3u8";
  const ok = (u) => "/api/replay?t=T";
  assert.equal(rewriteHlsPlaylist(upstream.replace("#EXT-X-ENDLIST", ""), base, ok), null, "no ENDLIST = not VOD");
  assert.equal(rewriteHlsPlaylist("<html>", base, ok), null);
  assert.equal(rewriteHlsPlaylist(upstream.replaceAll(FILE, "http://api.example.test/v.mp4"), base, ok), null, "plain http");
  assert.equal(rewriteHlsPlaylist(upstream.replaceAll(FILE, "https://api.example.test/v.ts"), base, ok), null, "non-mp4");
  assert.equal(rewriteHlsPlaylist(upstream.replace("#EXT-X-BYTERANGE:300000@1282", "#EXT-X-BYTERANGE:-5@1282"), base, ok), null, "bad range");
});

test("relative segment URIs resolve against the playlist", () => {
  const rel = upstream.replaceAll(FILE, "video-1.mp4");
  const seen = new Set();
  const out = rewriteHlsPlaylist(rel, "https://api.example.test/media/live/x/video-1.m3u8", (u) => (seen.add(u), "/api/replay?t=T"));
  assert.ok(out);
  assert.deepEqual([...seen], [FILE]);
});
