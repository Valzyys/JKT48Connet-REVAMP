"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLiveWatcher, pick } = require("../src/live");

const L = (id, name, extra = {}) => ({ id, name, platform: "showroom", avatar: `https://cdn.test/${id}.jpg`, ...extra });

function run(sequence, polls) {
  return new Promise((resolve) => {
    let i = 0;
    const changes = [];
    const started = [];
    const w = createLiveWatcher({
      interval: 1,
      load: async () => {
        const step = sequence[Math.min(i++, sequence.length - 1)];
        if (step instanceof Error) throw step;
        return step;
      },
      onChange: (list) => {
        changes.push(list.map((l) => l.id));
        if (changes.length === polls) {
          w.stop();
          resolve({ changes, started });
        }
      },
      onStart: (fresh) => started.push(fresh.map((l) => l.id)),
    });
    w.start();
  });
}

test("first poll seeds silently; later polls report only members who newly went live", async () => {
  const r = await run([[L("a", "Aralie")], [L("a", "Aralie"), L("b", "Lana")], [L("b", "Lana")], [L("b", "Lana"), L("a", "Aralie")]], 4);
  assert.deepEqual(r.changes, [["a"], ["a", "b"], ["b"], ["b", "a"]]);
  assert.deepEqual(r.started, [["b"], ["a"]], "a member who ends and starts again is announced again");
});

test("a failed poll keeps the known list, so recovering does not re-announce everyone", async () => {
  const r = await run([[L("a", "Aralie")], new Error("offline"), [L("a", "Aralie")]], 2);
  assert.deepEqual(r.changes, [["a"], ["a"]]);
  assert.deepEqual(r.started, []);
});

test("pick keeps only https avatars and normalises the platform", () => {
  assert.deepEqual(pick({ id: "x", name: "Gita", platform: "IDN", avatar: "http://insecure/a.jpg", img: "https://cdn.test/g.jpg", title: 7 }), {
    id: "x",
    name: "Gita",
    fullname: "Gita",
    title: "",
    platform: "idn",
    avatar: "https://cdn.test/g.jpg",
    startedAt: "",
  });
});
