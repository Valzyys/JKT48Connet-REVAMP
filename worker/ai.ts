/**
 * JKT48Connect AI (/api/ai/*): obrolan dengan model "pip" lewat gateway OpenAI-compatible di
 * api.jkt48connect.app/v1. API key gateway hanya ada di Worker (secret AI_GATEWAY_KEY), tidak pernah ke browser.
 *
 * Alur satu pesan: Worker men-stream jawaban model ke browser (SSE). Bila model memanggil tool (data live,
 * jadwal theater, profil member, ulang tahun, berita), Worker menjalankannya ke API JKT48Connect, mengirim
 * hasilnya kembali ke model, lalu melanjutkan stream sampai jawaban akhir diterima (maks. MAX_ROUNDS putaran).
 *
 * Event SSE ke browser: {t:"text",v} · {t:"tool",id,name,args} · {t:"tool_result",id,name,ok,summary}
 * · {t:"done",model,rounds} · {t:"error",status,message}.
 */
import { shapeBirthdays, shapeLive, shapeMember, shapeMembers, shapeNewsList, shapeTheaterList } from "../src/lib/shape";
import { fetchUpstream, type ProxyEnv } from "./proxy";
import type { Limiter } from "./security";

export interface AiEnv extends ProxyEnv {
  /** Secret: `wrangler secret put AI_GATEWAY_KEY` (key gateway AI JKT48Connect). */
  AI_GATEWAY_KEY?: string;
  /** Opsional, default `${API_UPSTREAM}/v1`. */
  AI_GATEWAY_URL?: string;
  /** Batas per IP untuk /api/ai/chat (wrangler.jsonc → ratelimits). */
  AI_LIMITER?: Limiter;
}

type Ctx = { waitUntil(p: Promise<unknown>): void };

export const AI_MODELS = [
  { id: "pip", label: "Pip", desc: "Asisten umum JKT48: live, jadwal, member, berita." },
  { id: "pip-code", label: "Pip Code", desc: "Fokus kode: integrasi API JKT48Connect, bot, script." },
  { id: "pip-docs", label: "Pip Docs", desc: "Fokus dokumentasi: menjelaskan endpoint & cara pakai." },
] as const;

const MAX_ROUNDS = 4;
const MAX_TOKENS = 2048;
const MAX_MESSAGES = 24;
const MAX_CHARS = 24_000;
const MAX_BODY = 64 * 1024;

const STATUS_TEXT: Record<number, string> = {
  400: "Input atau fitur tidak didukung.",
  401: "API key gateway tidak valid atau sudah dicabut.",
  413: "Percakapan terlalu panjang, mulai obrolan baru atau ringkas konteks.",
  429: "Batas pemakaian AI sedang tercapai. Coba lagi sebentar lagi.",
  501: "Penghitungan token persis tidak tersedia.",
  502: "Layanan AI sedang gagal atau sesinya kedaluwarsa. Coba lagi nanti.",
  503: "Gateway AI sedang nonaktif atau belum dikonfigurasi.",
};

const SYSTEM = [
  "Kamu adalah Pip, asisten AI JKT48Connect (proyek komunitas penggemar JKT48, tidak berafiliasi dengan JKT48 Operation Team).",
  "Jawab dalam bahasa Indonesia yang santai, ringkas, dan akurat. Pakai Markdown sederhana (daftar, **tebal**, blok kode).",
  "Untuk data terkini (siapa yang live, jadwal theater, profil member, ulang tahun, berita) SELALU panggil tool yang tersedia; jangan menebak.",
  "Waktu memakai WIB (Asia/Jakarta). Bila data tidak ditemukan, katakan terus terang.",
  "Jangan pernah meminta atau menampilkan API key, password, atau secret.",
].join(" ");

const TOOLS = [
  {
    type: "function",
    function: { name: "live_now", description: "Member JKT48 yang sedang live sekarang di IDN Live dan Showroom.", parameters: { type: "object", properties: {} } },
  },
  {
    type: "function",
    function: {
      name: "theater_schedule",
      description: "Jadwal show theater JKT48 terbaru/mendatang beserta member yang tampil.",
      parameters: { type: "object", properties: { limit: { type: "integer", description: "Jumlah show (1-10)", minimum: 1, maximum: 10 } } },
    },
  },
  {
    type: "function",
    function: {
      name: "member_profile",
      description: "Profil member JKT48: nama lengkap, panggilan, tanggal lahir, tinggi, golongan darah, status, sosial media, jadwal theater member.",
      parameters: { type: "object", properties: { name: { type: "string", description: "Nama atau nama panggilan member" } }, required: ["name"] },
    },
  },
  {
    type: "function",
    function: { name: "upcoming_birthdays", description: "Ulang tahun member JKT48 terdekat.", parameters: { type: "object", properties: {} } },
  },
  {
    type: "function",
    function: {
      name: "latest_news",
      description: "Berita dan pengumuman resmi JKT48 terbaru.",
      parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 10 } } },
    },
  },
] as const;

const wib = (iso: string) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms)
    ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "short" }).format(ms) + " WIB"
    : "";
};
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Menjalankan satu tool ke API JKT48Connect; hasil ringkas (JSON) untuk model + ringkasan satu baris untuk UI. */
export async function runTool(name: string, rawArgs: string, env: AiEnv): Promise<{ ok: boolean; result: unknown; summary: string }> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    /* argumen rusak → pakai bawaan */
  }
  const lim = (v: unknown, d: number) => Math.min(10, Math.max(1, Number(v) || d));
  const fail = (summary: string) => ({ ok: false, result: { error: summary }, summary });

  if (name === "live_now") {
    const r = await fetchUpstream("/api/now_live?group=jkt48", env);
    if (!r.ok) return fail("Data live tidak bisa diambil");
    const live = shapeLive(r.data).map((l) => ({ name: l.fullname || l.name, platform: l.platform === "idn" ? "IDN Live" : "Showroom", since: wib(l.startedAt), title: l.title }));
    return { ok: true, result: { count: live.length, live }, summary: live.length ? `${live.length} member sedang live` : "Tidak ada yang live" };
  }
  if (name === "theater_schedule") {
    const n = lim(args.limit, 5);
    const r = await fetchUpstream(`/api/theater?page=1&perpage=${n}`, env);
    if (!r.ok) return fail("Jadwal theater tidak bisa diambil");
    const shows = shapeTheaterList(r.data as never, 1, n).items.map((s) => ({ title: s.title, when: wib(s.date), team: s.team, members: s.members.map((m) => m.name) }));
    return { ok: true, result: { shows }, summary: `${shows.length} show theater` };
  }
  if (name === "member_profile") {
    const q = norm(String(args.name ?? ""));
    if (!q) return fail("Nama member kosong");
    const list = await fetchUpstream("/api/member", env);
    if (!list.ok) return fail("Daftar member tidak bisa diambil");
    const members = shapeMembers(list.data);
    const hit =
      members.find((m) => norm(m.name) === q || norm(m.nickname ?? "") === q) ??
      members.find((m) => norm(m.name).includes(q) || norm(m.nickname ?? "").includes(q) || q.includes(norm(m.nickname ?? "~")));
    if (!hit) return fail(`Member "${String(args.name)}" tidak ditemukan`);
    const d = await fetchUpstream(`/api/member/${encodeURIComponent(hit.id)}`, env);
    if (!d.ok) return fail("Profil member tidak bisa diambil");
    const m = shapeMember(d.data as never, hit.id);
    return {
      ok: true,
      result: {
        name: m.fullname || m.name,
        nickname: m.nickname,
        status: m.isGraduate ? "graduated" : "aktif",
        birthdate: m.birthdate,
        height: m.height,
        bloodType: m.bloodType,
        jikosokai: m.jikosokai,
        socials: m.socials.map((s) => s.url),
        upcomingShows: m.upcomingShows.slice(0, 5).map((s) => ({ title: s.title, when: wib(s.date) })),
        page: `https://jkt48connect.app/member/${m.id || hit.id}`,
      },
      summary: `Profil ${m.fullname || m.name}`,
    };
  }
  if (name === "upcoming_birthdays") {
    const r = await fetchUpstream("/api/next_birthday", env);
    if (!r.ok) return fail("Data ulang tahun tidak bisa diambil");
    const list = shapeBirthdays(r.data).slice(0, 8).map((b) => ({ name: b.name, birthdate: b.birthdate }));
    return { ok: true, result: { birthdays: list }, summary: `${list.length} ulang tahun terdekat` };
  }
  if (name === "latest_news") {
    const n = lim(args.limit, 5);
    const r = await fetchUpstream(`/api/news?page=1&perpage=${n}`, env);
    if (!r.ok) return fail("Berita tidak bisa diambil");
    const news = shapeNewsList(r.data as never, 1, n).items.map((a) => ({ title: a.title, date: a.date, category: a.category, page: `https://jkt48connect.app/news/${a.id}` }));
    return { ok: true, result: { news }, summary: `${news.length} berita terbaru` };
  }
  return fail(`Tool ${name} tidak dikenal`);
}

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string; name?: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/** Validasi input browser: hanya peran user/assistant berisi teks, panjang dibatasi. */
function readMessages(body: unknown): Msg[] | string {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return "Pesan kosong.";
  if (raw.length > MAX_MESSAGES) return "Percakapan terlalu panjang. Mulai obrolan baru.";
  let total = 0;
  const out: Msg[] = [];
  for (const m of raw) {
    const role = (m as { role?: unknown })?.role;
    const content = (m as { content?: unknown })?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return "Format pesan tidak valid.";
    total += content.length;
    out.push({ role, content: content.slice(0, 8000) });
  }
  if (total > MAX_CHARS) return "Percakapan terlalu panjang. Mulai obrolan baru.";
  if (out[out.length - 1].role !== "user") return "Pesan terakhir harus dari pengguna.";
  return out;
}

export async function handleAi(request: Request, env: AiEnv, ctx: Ctx): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/ai/models" && request.method === "GET") {
    return json(200, { enabled: Boolean(env.AI_GATEWAY_KEY), models: AI_MODELS, limits: { perMinute: 20, perDay: 500, maxOutputTokens: 16384 } });
  }
  if (url.pathname !== "/api/ai/chat") return json(404, { error: "Endpoint tidak ditemukan." });
  if (request.method !== "POST") return json(405, { error: "Gunakan POST." });
  if (!env.AI_GATEWAY_KEY) return json(503, { error: STATUS_TEXT[503] });
  // Hanya dari situs sendiri (bukan proxy AI gratis untuk pihak lain).
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json(403, { error: "Asal permintaan tidak diizinkan." });
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  if (env.AI_LIMITER && !(await env.AI_LIMITER.limit({ key: `ai:${ip}` })).success)
    return json(429, { error: "Terlalu sering. Tunggu sebentar sebelum bertanya lagi." });

  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { error: STATUS_TEXT[413] });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "Body harus JSON." });
  }
  const model = AI_MODELS.find((m) => m.id === (body as { model?: unknown })?.model)?.id ?? "pip";
  const msgs = readMessages(body);
  if (typeof msgs === "string") return json(400, { error: msgs });

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = (ev: Record<string, unknown>) => writer.write(enc.encode(`data: ${JSON.stringify(ev)}\n\n`)).catch(() => undefined);
  ctx.waitUntil(converse(env, model, [{ role: "system", content: SYSTEM }, ...msgs], send).finally(() => writer.close().catch(() => undefined)));
  return new Response(readable, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

/** Loop percakapan: stream jawaban; bila ada tool call, jalankan & ulangi sampai jawaban akhir. */
async function converse(env: AiEnv, model: string, messages: Msg[], send: (ev: Record<string, unknown>) => Promise<unknown>) {
  const base = (env.AI_GATEWAY_URL || `${(env.API_UPSTREAM || "https://api.jkt48connect.app").replace(/\/+$/, "")}/v1`).replace(/\/+$/, "");
  const doFetch = env.UPSTREAM_FETCH ?? fetch;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let res: Response;
    try {
      res = await doFetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.AI_GATEWAY_KEY}`, "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ model, messages, stream: true, max_tokens: MAX_TOKENS, temperature: 0.4, tools: TOOLS, tool_choice: round < MAX_ROUNDS ? "auto" : "none" }),
      });
    } catch {
      await send({ t: "error", status: 502, message: STATUS_TEXT[502] });
      return;
    }
    if (!res.ok || !res.body) {
      const status = [400, 401, 413, 429, 501, 502, 503].includes(res.status) ? res.status : 502;
      await send({ t: "error", status, message: STATUS_TEXT[status] });
      return;
    }

    let content = "";
    const calls: ToolCall[] = [];
    let finish = "";
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let chunk: { choices?: { delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[] };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const d = choice.delta ?? {};
        if (d.content) {
          content += d.content;
          await send({ t: "text", v: d.content });
        }
        for (const tc of d.tool_calls ?? []) {
          const c = (calls[tc.index] ??= { id: tc.id ?? `call_${round}_${tc.index}`, type: "function", function: { name: "", arguments: "" } });
          if (tc.id) c.id = tc.id;
          if (tc.function?.name) c.function.name += tc.function.name;
          if (tc.function?.arguments) c.function.arguments += tc.function.arguments;
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
    }

    const toolCalls = calls.filter(Boolean);
    if (!toolCalls.length || (finish && finish !== "tool_calls")) {
      await send({ t: "done", model, rounds: round });
      return;
    }
    messages.push({ role: "assistant", content: content || null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      await send({ t: "tool", id: call.id, name: call.function.name, args: call.function.arguments });
      const out = await runTool(call.function.name, call.function.arguments, env).catch(() => ({ ok: false, result: { error: "Tool gagal" }, summary: "Tool gagal" }));
      await send({ t: "tool_result", id: call.id, name: call.function.name, ok: out.ok, summary: out.summary });
      messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify(out.result).slice(0, 12_000) });
    }
  }
  await send({ t: "done", model, rounds: MAX_ROUNDS });
}
