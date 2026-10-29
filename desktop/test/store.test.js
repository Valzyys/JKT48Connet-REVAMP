"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createStore, visibleBounds } = require("../src/store");

test("settings persist, ignore unknown keys, and survive a corrupt file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jkc-store-"));
  const a = createStore(dir);
  assert.equal(a.get("notifyLive"), true);
  a.set("closeToTray", true);
  a.set("evil", 1);
  assert.equal(createStore(dir).get("closeToTray"), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf8")).evil, undefined);
  fs.writeFileSync(path.join(dir, "settings.json"), "{nope");
  assert.equal(createStore(dir).get("closeToTray"), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("saved window bounds are reused only while they are on a connected screen", () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }];
  assert.deepEqual(visibleBounds({ x: 100, y: 80, width: 1300, height: 860 }, displays), { x: 100, y: 80, width: 1300, height: 860 });
  assert.equal(visibleBounds({ x: 2400, y: 80, width: 1300, height: 860 }, displays), null, "window on an unplugged second monitor");
  assert.equal(visibleBounds({ x: 0, y: 0, width: NaN, height: 1 }, displays), null);
  assert.equal(visibleBounds(null, displays), null);
});
