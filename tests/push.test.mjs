import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const scratch = await mkdtemp(join(tmpdir(), "jkc-push-test-"));
await build({ entryPoints: ["worker/push.ts"], bundle: true, platform: "node", format: "esm", outfile: join(scratch, "push.mjs"), logLevel: "silent" });
const { planPush, runPush, pushClientConfig, parseServiceAccount, TOPIC_PREFIX } = await import(join(scratch, "push.mjs"));
test.after(() => rm(scratch, { recursive: true, force: true }));

const NOW = Date.parse("2026-10-23T05:00:00Z"); // 12.00 WIB
const live = (id, name = "Aurellia") => ({ id, name, fullname: name, img: "https://img.test/a.jpg", avatar: "", platform: "idn", startedAt: "2026-10-23T04:59:00Z", title: "Ngobrol", link: "", banner: "" });
const show = (id, minutesFromNow) => ({ id, title: "Pertaruhan Cinta", date: new Date(NOW + minutesFromNow * 60_000).toISOString(), team: "", category: "show", banner: "https://img.test/b.png", poster: "", memberCount: 12, members: [], birthday: [], url: "" });

test("first round only records, later rounds push what is new", () => {
  const snap = { live: [live("a")], news: [{ id: "n1", title: "Berita 1", date: "", category: "Event", url: "" }], release: { version: "2.1.0", notes: "" } };
  const first = planPush({}, snap, NOW);
  assert.deepEqual(first.messages, [], "nothing is pushed on the seeding round");
  assert.deepEqual(first.memory.live, ["a|2026-10-23T04:59:00Z"]);
  assert.equal(first.memory.update, "2.1.0");

  const second = planPush(first.memory, { ...snap, live: [live("a"), live("b", "Freya")], news: [{ id: "n2", title: "Berita 2", date: "2026-10-23", category: "Event", url: "" }, ...snap.news], release: { version: "2.2.0", notes: "Fitur baru\n\n---\nPasang …" } }, NOW);
  assert.deepEqual(second.messages.map((m) => [m.kind, m.title]), [
    ["live", "Freya sedang live"],
    ["news", "Berita 2"],
    ["update", "Update JKT48Connect 2.2.0 tersedia"],
  ]);
  assert.equal(second.messages[0].open, "tab:1");
  assert.equal(second.messages[1].open, "news:n2|2026-10-23|Berita 2");
  assert.equal(second.messages[2].body, "Fitur baru");
  assert.deepEqual(planPush(second.memory, { ...snap, live: [live("a"), live("b", "Freya")] }, NOW).messages, [], "already pushed items (and an older release) are not repeated");
  assert.equal(planPush(second.memory, { release: { version: "2.1.0", notes: "" } }, NOW).memory.update, "2.2.0", "an older 'latest' release does not lower the version");
});

test("shows are pushed once, within 65 minutes of the start", () => {
  const { messages, memory } = planPush({}, { shows: [show("SH1", 30), show("SH2", 120), show("SH3", -5)] }, NOW);
  assert.deepEqual(messages.map((m) => m.id), ["SH1"]);
  assert.equal(messages[0].title, "Pertaruhan Cinta dimulai 12.30 WIB");
  assert.equal(messages[0].open, "theater:SH1|Pertaruhan Cinta");
  assert.deepEqual(planPush(memory, { shows: [show("SH1", 28)] }, NOW).messages, []);
});

test("birthdays use the WIB date, from 07.00 WIB, once per year", () => {
  // 17.00Z kemarin = 00.00 WIB hari ini (cara upstream menyimpan tanggal lahir).
  const b = { id: "aurellia", name: "Aurellia", img: "", birthdate: "2005-10-22T17:00:00.000Z" };
  const { messages, memory } = planPush({}, { birthdays: [b] }, NOW);
  assert.deepEqual(messages.map((m) => m.title), ["Selamat ulang tahun, Aurellia! 🎂"]);
  assert.match(messages[0].body, /ke-21/);
  assert.deepEqual(planPush(memory, { birthdays: [b] }, NOW).messages, []);
  assert.deepEqual(planPush({}, { birthdays: [b] }, Date.parse("2026-10-22T23:00:00Z")).messages, [], "06.00 WIB is too early");
});

test("client config exposes only public identifiers, and only when push is configured", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = JSON.stringify({ project_id: "jkc-test", client_email: "push@jkc-test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });
  assert.deepEqual(pushClientConfig({}), { enabled: false });
  assert.deepEqual(pushClientConfig({ FCM_SERVICE_ACCOUNT: "{bad", FCM_ANDROID_APP_ID: "1:123:android:abc", FCM_ANDROID_API_KEY: "AIzaSyTestTestTestTestTestTest123" }), { enabled: false });
  const cfg = pushClientConfig({ FCM_SERVICE_ACCOUNT: sa, FCM_ANDROID_APP_ID: "1:123456:android:abc123", FCM_ANDROID_API_KEY: "AIzaSyTestTestTestTestTestTest123" });
  assert.deepEqual(cfg, { enabled: true, appId: "1:123456:android:abc123", apiKey: "AIzaSyTestTestTestTestTestTest123", projectId: "jkc-test", senderId: "123456", topicPrefix: TOPIC_PREFIX });
  assert.ok(!JSON.stringify(cfg).includes("PRIVATE"), "the service account key never leaves the worker");
});

test("a cron round signs a valid JWT, reuses the token, and sends data messages to topics", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = parseServiceAccount(JSON.stringify({ project_id: "jkc-test", client_email: "push@jkc-test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }));
  const sent = [];
  let tokenCalls = 0;
  const doFetch = async (url, init) => {
    if (url === "https://oauth2.googleapis.com/token") {
      tokenCalls++;
      const jwt = new URLSearchParams(String(init.body)).get("assertion");
      const [h, c, s] = jwt.split(".");
      const ok = createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url"));
      assert.ok(ok, "JWT signature verifies with the service account public key");
      const claims = JSON.parse(Buffer.from(c, "base64url"));
      assert.equal(claims.iss, "push@jkc-test.iam.gserviceaccount.com");
      assert.equal(claims.scope, "https://www.googleapis.com/auth/firebase.messaging");
      return Response.json({ access_token: "ya29.test", expires_in: 3600 });
    }
    if (url === "https://fcm.googleapis.com/v1/projects/jkc-test/messages:send") {
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer ya29.test");
      sent.push(JSON.parse(init.body).message);
      return Response.json({ name: "projects/jkc-test/messages/1" });
    }
    throw new Error(`unexpected ${url}`);
  };
  let lives = [];
  const fetchers = {
    upstream: async (path) => (path.startsWith("/api/now_live") ? lives : path.startsWith("/api/theater") ? { theater: [], total: 0 } : path.startsWith("/api/news") ? { news: [], total: 0 } : []),
    latestRelease: async () => ({ version: "2.1.0", notes: "" }),
  };
  lives = [{ notification_data_id: "x1", name: "Aurellia", type: "idn", started_at: "2026-10-23T04:00:00Z", img: "https://img.test/a.jpg" }];
  const r1 = await runPush({ sa, memory: {}, fetchers, now: NOW, heavy: false, doFetch });
  assert.equal(r1.sent, 0, "seeding round");
  assert.equal(tokenCalls, 0, "no token needed when nothing is sent");

  lives = [...lives, { notification_data_id: "x2", name: "Freya", type: "showroom", started_at: "2026-10-23T04:58:00Z", img: "https://img.test/f.jpg" }];
  const r2 = await runPush({ sa, memory: r1.memory, fetchers, now: NOW, heavy: false, doFetch });
  assert.equal(r2.sent, 1);
  assert.deepEqual(sent[0].data, { kind: "live", id: "x2|2026-10-23T04:58:00Z", title: "Freya sedang live", body: "Live di Showroom · Showroom", open: "tab:1", image: "https://img.test/f.jpg" });
  assert.equal(sent[0].topic, "jkc-live");
  assert.deepEqual(sent[0].android, { priority: "HIGH", ttl: "1800s" });

  lives = [...lives, { notification_data_id: "x3", name: "Gita", type: "idn", started_at: "2026-10-23T05:00:00Z", img: "" }];
  const r3 = await runPush({ sa, memory: r2.memory, token: r2.token, fetchers, now: NOW + 60_000, heavy: false, doFetch });
  assert.equal(r3.sent, 1);
  assert.equal(tokenCalls, 1, "the access token is reused while valid");
});
