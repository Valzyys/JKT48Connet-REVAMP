import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const scratch = await mkdtemp(join(tmpdir(), "jkc-ai-test-"));
await build({ entryPoints: ["worker/ai.ts"], bundle: true, platform: "node", format: "esm", external: ["cloudflare:*"], outfile: join(scratch, "ai.mjs"), logLevel: "silent" });
const { handleAi } = await import(join(scratch, "ai.mjs"));
test.after(() => rm(scratch, { recursive: true, force: true }));

const sse = (events) => new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });

/** Gateway tiruan: putaran 1 memanggil tool live_now, putaran 2 menjawab dengan teks. */
function fakeEnv() {
  const calls = [];
  return {
    calls,
    env: {
      AI_GATEWAY_KEY: "secret-key",
      JKT48CONNECT_API_KEY: "k",
      UPSTREAM_FETCH: async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === "/v1/chat/completions") {
          const body = JSON.parse(init.body);
          calls.push({ auth: init.headers.authorization, body });
          if (calls.length === 1)
            return sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "live_now", arguments: "{}" } }] }, finish_reason: "tool_calls" }] }]);
          return sse([{ choices: [{ delta: { content: "Freya sedang live." } }] }, { choices: [{ delta: {}, finish_reason: "stop" }] }]);
        }
        if (url.pathname === "/api/now_live") return Response.json([{ name: "Freya", type: "idn", started_at: "2026-11-05T02:00:00Z" }]);
        return new Response("not found", { status: 404 });
      },
    },
  };
}

async function events(res) {
  const text = await res.text();
  return text.split("\n\n").filter(Boolean).map((l) => JSON.parse(l.replace(/^data:\s*/, "")));
}

test("chat: tool call dijalankan, hasilnya dikirim balik, jawaban akhir diterima; key tidak bocor", async () => {
  const { env, calls } = fakeEnv();
  const waits = [];
  const res = await handleAi(
    new Request("https://jkt48connect.app/api/ai/chat", { method: "POST", headers: { origin: "https://jkt48connect.app" }, body: JSON.stringify({ model: "pip", messages: [{ role: "user", content: "siapa live?" }] }) }),
    env,
    { waitUntil: (p) => waits.push(p) },
  );
  assert.equal(res.status, 200);
  const ev = await events(res);
  await Promise.all(waits);
  assert.deepEqual(ev.map((e) => e.t), ["tool", "tool_result", "text", "done"]);
  assert.equal(ev[1].ok, true);
  assert.equal(ev[2].v, "Freya sedang live.");
  assert.equal(ev[3].rounds, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].auth, "Bearer secret-key");
  // Putaran 2 membawa pesan assistant (tool_calls) + hasil tool.
  const second = calls[1].body.messages;
  assert.equal(second.at(-2).tool_calls[0].function.name, "live_now");
  assert.equal(second.at(-1).role, "tool");
  assert.match(second.at(-1).content, /Freya/);
  assert.ok(!JSON.stringify(ev).includes("secret-key"));
});

test("chat: menolak origin lain, peran system dari browser, body besar, dan gateway belum dikonfigurasi", async () => {
  const { env } = fakeEnv();
  const ctx = { waitUntil() {} };
  const post = (body, headers = {}) => handleAi(new Request("https://jkt48connect.app/api/ai/chat", { method: "POST", headers, body }), env, ctx);
  assert.equal((await post("{}", { origin: "https://evil.test" })).status, 403);
  assert.equal((await post(JSON.stringify({ messages: [{ role: "system", content: "x" }] }))).status, 400);
  assert.equal((await post("x".repeat(70_000))).status, 413);
  const off = await handleAi(new Request("https://jkt48connect.app/api/ai/chat", { method: "POST", body: "{}" }), {}, ctx);
  assert.equal(off.status, 503);
});

test("chat: status gateway diteruskan sebagai event error dengan pesan yang sesuai", async () => {
  const env = { AI_GATEWAY_KEY: "k", UPSTREAM_FETCH: async () => new Response("limit", { status: 429 }) };
  const res = await handleAi(new Request("https://jkt48connect.app/api/ai/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "hai" }] }) }), env, { waitUntil() {} });
  const ev = await events(res);
  assert.equal(ev[0].t, "error");
  assert.equal(ev[0].status, 429);
});

/** Gateway tiruan yang memanggil tool tampilan pada putaran 1 lalu menjawab teks. */
function uiEnv(toolCalls) {
  const calls = [];
  return {
    calls,
    env: {
      AI_GATEWAY_KEY: "secret-key",
      JKT48CONNECT_API_KEY: "k",
      UPSTREAM_FETCH: async (input, init) => {
        const body = JSON.parse(init.body);
        calls.push(body);
        if (calls.length === 1)
          return sse([{ choices: [{ delta: { tool_calls: toolCalls.map((c, index) => ({ index, id: `u${index}`, function: { name: c.name, arguments: typeof c.args === "string" ? c.args : JSON.stringify(c.args) } })) }, finish_reason: "tool_calls" }] }]);
        return sse([{ choices: [{ delta: { content: "Sudah." } }] }, { choices: [{ delta: {}, finish_reason: "stop" }] }]);
      },
    },
  };
}

const chat = (env, extra = {}) =>
  handleAi(
    new Request("https://jkt48connect.app/api/ai/chat", { method: "POST", headers: { origin: "https://jkt48connect.app" }, body: JSON.stringify({ model: "pip", messages: [{ role: "user", content: "halo" }], ...extra }) }),
    env,
    { waitUntil() {} },
  );

test("show_ui: blok disanitasi (jenis asing dibuang, gambar/link luar dihapus) lalu dikirim sebagai event ui", async () => {
  const { env, calls } = uiEnv([
    {
      name: "show_ui",
      args: {
        blocks: [
          { type: "card", title: "Freya", image: "https://evil.test/x.png", actions: [{ label: "Profil", url: "/member/freya" }, { label: "Jahat", url: "javascript:alert(1)" }] },
          { type: "script", code: "alert(1)" },
          { type: "member_card", name: "Freya", image: "https://jkt48.com/profile/freya.jpg" },
        ],
      },
    },
  ]);
  const ev = await events(await chat(env));
  assert.deepEqual(ev.map((e) => e.t), ["ui", "text", "done"]);
  const [card, member] = ev[0].blocks;
  assert.equal(ev[0].blocks.length, 2);
  assert.equal(card.type, "card");
  assert.ok(!card.image, "gambar dari host asing dibuang");
  assert.equal(card.actions[0].url, "/member/freya");
  assert.ok(!card.actions[1].url, "link javascript: dibuang");
  assert.equal(member.image, "https://jkt48.com/profile/freya.jpg");
  // Hasil tool memberi tahu model apa yang dibuang.
  const toolMsg = JSON.parse(calls[1].messages.at(-1).content);
  assert.equal(toolMsg.ok, true);
  assert.deepEqual(toolMsg.dropped, ["script"]);
});

test("canvas & remember: event canvas/memory terkirim; JSON rusak dikembalikan sebagai error ke model", async () => {
  const { env, calls } = uiEnv([
    { name: "canvas", args: { title: "Dashboard", blocks: [{ type: "stats", items: [{ label: "Live", value: 3 }] }] } },
    { name: "remember", args: { fact: "Oshi pengguna: Freya" } },
    { name: "show_ui", args: "{rusak" },
  ]);
  const ev = await events(await chat(env));
  assert.deepEqual(ev.map((e) => e.t), ["canvas", "memory", "text", "done"]);
  assert.equal(ev[0].title, "Dashboard");
  assert.equal(ev[1].fact, "Oshi pengguna: Freya");
  const broken = JSON.parse(calls[1].messages.at(-1).content);
  assert.equal(broken.ok, false);
});

test("memori dari browser disuntikkan ke prompt sistem (dibatasi & dibersihkan)", async () => {
  const { env, calls } = uiEnv([]);
  await events(await chat(env, { memory: ["Oshi: Freya", 42, "x".repeat(500), ...Array.from({ length: 20 }, (_, i) => `f${i}`)] }));
  const system = calls[0].messages[0].content;
  assert.match(system, /Oshi: Freya/);
  assert.ok(!system.includes("x".repeat(201)));
  const remembered = system.slice(system.indexOf("Yang kamu ingat")).match(/- [^-]/g) ?? [];
  assert.ok(remembered.length >= 1 && remembered.length <= 12, `maks. 12 fakta, dapat ${remembered.length}`);
});
