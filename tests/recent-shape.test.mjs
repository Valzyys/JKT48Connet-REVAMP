import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const scratch = await mkdtemp(join(tmpdir(), "jkc-recent-test-"));
await build({ entryPoints: ["src/lib/shape.ts"], bundle: true, platform: "node", format: "esm", outfile: join(scratch, "shape.mjs"), logLevel: "silent" });
const { shapeRecent } = await import(join(scratch, "shape.mjs"));
test.after(() => rm(scratch, { recursive: true, force: true }));

const AV = (id) => `https://image.showroom-cdn.com/showroom-prod/image/avatar/${id}.png`;
const LB = (n) => `https://api.jkt48connect.app/media/leaderboards/sr-1-2/${n}.png`;
const GIFT = (id) => `https://api.jkt48connect.app/media/gifts/showroom/${id}`;

// Bentuk respons Showroom upstream: fans memakai `fans_point`, pengirim gift ada di `live_info.gift.log`
// (per user_id) dengan nama & avatar di `users`, dan `gift.list` berisi seluruh katalog (num 0 = tidak terkirim).
const RAW = {
  data_id: "sr-1-2",
  type: "showroom",
  point_unit: "showroom_points",
  room_info: { name: "Member Satu", img: "https://example.test/m.jpg", url: "member-satu" },
  live_info: {
    date: { start: "2026-10-28T16:46:00.000Z", end: "2026-10-28T18:00:00.000Z" },
    duration: 4440000,
    gift: {
      status: "partial",
      next_page: true,
      list: [
        { id: 1, name: "Bear Mikoshi", img: GIFT(1), num: 0, user_count: 0 },
        { id: 2, name: "Twinkle star", img: GIFT(2), num: 66, user_count: 2 },
      ],
      log: [
        {
          user_id: "11",
          total: 70,
          gifts: [
            { id: 2, name: "Twinkle star", img: GIFT(2), num: 40 },
            { id: 2, name: "Twinkle star", img: GIFT(2), num: 26 },
            { id: 3, name: "star(red)", img: GIFT(3), image_available: false, num: 4 },
          ],
        },
        { user_id: "12", total: 216, gifts: [{ id: 4, name: "seed(purple)", img: GIFT(4), num: 0 }] },
        { user_id: "99", total: 5, gifts: [] },
      ],
    },
  },
  users: [
    { id: "11", name: "Fan Sebelas", avatar_url: AV(11), comments: 0 },
    { id: "12", name: "Fan Dua Belas", avatar_url: AV(12), comments: 2 },
  ],
  fans: [{ id: 11, name: "Fan Sebelas", avatar_url: AV(11), fans_point: 6541 }],
  leaderboard_designs: {
    photobook: { portrait: { status: "ready", url: LB("p") }, banner: { status: "pending", url: LB("pb") } },
    avonera48: { portrait: { status: "ready", url: LB("a") }, banner: { status: "ready", url: LB("ab") } },
    jkt48connect: { portrait: { status: "ready", url: LB("j") }, banner: { status: "ready", url: LB("jb") } },
    draft: { portrait: { status: "pending", url: LB("d") } },
  },
};

test("showroom gifters come from the gift log joined with users, sorted by total", () => {
  const r = shapeRecent(RAW, "sr-1-2");
  assert.deepEqual(
    r.gifters.map((g) => [g.name, g.avatar, g.total]),
    [
      ["Fan Dua Belas", AV(12), 216],
      ["Fan Sebelas", AV(11), 70],
    ],
    "the unknown user without a name is dropped",
  );
  assert.deepEqual(r.gifters[1].gifts, [
    { name: "Twinkle star", img: GIFT(2), num: 66 },
    { name: "star(red)", img: "", num: 4 },
  ], "repeated sends of the same gift are merged; unavailable images are blank");
  assert.deepEqual(r.gifters[0].gifts, [], "gifts with no count are hidden");
  assert.equal(r.giftersMore, true);
});

test("showroom fans read fans_point and the gift catalog hides unsent gifts", () => {
  const r = shapeRecent(RAW, "sr-1-2");
  assert.deepEqual(r.fans, [{ name: "Fan Sebelas", avatar: AV(11), amount: 6541 }]);
  assert.deepEqual(r.gifts.map((g) => g.name), ["Twinkle star"]);
});

test("recents without a gift log have no gifters", () => {
  const r = shapeRecent({ data_id: "idn-x", type: "idn", live_info: { gift: { list: [] } } }, "idn-x");
  assert.deepEqual(r.gifters, []);
  assert.equal(r.giftersMore, false);
});

test("recap designs list every ready portrait, JKT48Connect first, with optional banner", () => {
  const r = shapeRecent(RAW, "sr-1-2");
  assert.deepEqual(r.designs, [
    { key: "jkt48connect", label: "JKT48Connect", portrait: LB("j"), banner: LB("jb") },
    { key: "photobook", label: "Photobook", portrait: LB("p"), banner: "" },
    { key: "avonera48", label: "Avonera48", portrait: LB("a"), banner: LB("ab") },
  ]);
  assert.equal(r.leaderboard, LB("j"));
});

test("chatters are users who commented, most active first", () => {
  const r = shapeRecent(RAW, "sr-1-2");
  assert.deepEqual(r.chatters, [{ name: "Fan Dua Belas", avatar: AV(12), comments: 2 }]);
  assert.deepEqual(shapeRecent({ data_id: "idn-x", type: "idn" }, "idn-x").designs, []);
});
