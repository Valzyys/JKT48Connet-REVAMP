/**
 * UI generatif Pip (dipakai bersama oleh worker/ai.ts dan src/components/genui).
 *
 * Model tidak pernah membuat HTML/JS. Ia memanggil tool `show_ui` / `canvas` dengan daftar blok JSON
 * `{ type, ...props }`. Worker membersihkannya dengan `sanitizeBlocks` (jenis yang diizinkan, panjang teks,
 * jumlah elemen, kedalaman, URL gambar & tautan dari host tepercaya), lalu browser menampilkannya dengan
 * komponen React milik situs.
 */

export const UI_TYPES = [
  // dasar
  "text", "buttons", "chips", "callout", "card", "kv", "divider", "progress",
  // data JKT48
  "member_card", "live_card", "schedule", "countdown", "stats", "member_grid", "compare",
  // visual
  "chart", "table", "heatmap", "timeline", "gallery", "tree", "before_after",
  // input & permainan
  "form", "quiz", "poll", "checklist", "personality", "simulator", "rating",
  "guess_member", "roulette", "leaderboard", "tier_list", "sortable",
  // tata letak
  "tabs", "accordion",
  // media
  "youtube", "music", "karaoke", "live_preview", "watch_party",
  // praktis & agent
  "calendar", "reminder", "share_card", "calculator", "plan", "sources", "api_tester", "json",
  // spesial
  "stories", "holo_cards", "bar_race",
] as const;
export type UiType = (typeof UI_TYPES)[number];
export type UiBlock = { type: UiType; [k: string]: unknown };

const TYPES = new Set<string>(UI_TYPES);
const NESTED_KEYS = new Set(["blocks", "content"]);
const MAX_BLOCKS = 16;
const MAX_DEPTH = 3;
const MAX_ARRAY = 60;
const MAX_KEYS = 40;
const MAX_TEXT = 900;
const LONG_TEXT_KEYS = new Set(["md", "text", "body", "description", "explanation"]);
const MAX_LONG_TEXT = 4000;
const MAX_JSON = 60_000;

const IMG_KEYS = /^(img|image|src|avatar|cover|photo|before|after|poster|thumbnail|banner|logo)$/i;
const LINK_KEYS = /^(href|url|link|to)$/i;

const hostIs = (h: string, base: string) => h === base || h.endsWith(`.${base}`);
const IMG_HOSTS = ["jkt48connect.app", "jkt48.com", "ytimg.com", "showroom-live.com", "showroom-cdn.com", "idn.app", "idntimes.com", "googleusercontent.com"];
const LINK_HOSTS = [...IMG_HOSTS, "youtube.com", "youtu.be", "x.com", "twitter.com", "instagram.com", "tiktok.com", "calendar.google.com", "github.com"];

/** Gambar hanya https dari host tepercaya (media JKT48Connect, jkt48.com, YouTube, Showroom, IDN). */
export function safeImage(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" && IMG_HOSTS.some((h) => hostIs(u.hostname, h)) ? u.toString() : "";
  } catch {
    return "";
  }
}

/** Tautan: path internal situs ("/member/x") atau https ke host yang diizinkan. */
export function safeLink(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  if (/^\/(?!\/)[A-Za-z0-9/_\-.?=&%#]*$/.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && LINK_HOSTS.some((h) => hostIs(u.hostname, h)) ? u.toString() : "";
  } catch {
    return "";
  }
}

function cleanValue(v: unknown, key: string, depth: number, dropped: string[]): unknown {
  if (v === null || typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? Math.max(-1e12, Math.min(1e12, v)) : undefined;
  if (typeof v === "string") {
    if (IMG_KEYS.test(key)) return safeImage(v) || undefined;
    if (LINK_KEYS.test(key)) return safeLink(v) || undefined;
    return v.slice(0, LONG_TEXT_KEYS.has(key) ? MAX_LONG_TEXT : MAX_TEXT);
  }
  if (Array.isArray(v)) {
    if (NESTED_KEYS.has(key)) return cleanBlocks(v, depth + 1, dropped);
    return v.slice(0, MAX_ARRAY).map((x) => cleanValue(x, key, depth, dropped)).filter((x) => x !== undefined);
  }
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, MAX_KEYS)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      const c = cleanValue(val, k, depth, dropped);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}

function cleanBlocks(raw: unknown, depth: number, dropped: string[]): UiBlock[] {
  if (!Array.isArray(raw) || depth > MAX_DEPTH) return [];
  const out: UiBlock[] = [];
  for (const b of raw.slice(0, MAX_BLOCKS)) {
    const type = (b as { type?: unknown })?.type;
    if (typeof type !== "string" || !TYPES.has(type)) {
      dropped.push(String(type ?? "?"));
      continue;
    }
    out.push(cleanValue(b, "", depth, dropped) as UiBlock);
  }
  return out;
}

/** Bersihkan blok dari model. `dropped` = jenis yang tidak dikenal (dilaporkan balik ke model). */
export function sanitizeBlocks(raw: unknown): { blocks: UiBlock[]; dropped: string[] } {
  const dropped: string[] = [];
  let blocks = cleanBlocks(raw, 0, dropped);
  while (blocks.length && JSON.stringify(blocks).length > MAX_JSON) blocks = blocks.slice(0, -1);
  return { blocks, dropped };
}

/** Katalog komponen untuk deskripsi tool (dibaca model). */
export const UI_CATALOG = `Setiap blok: {"type": ..., ...props}. Aksi tombol: {"label","action":"send"|"link"|"copy","value","style":"primary"|"secondary"|"ghost"} (send = kirim value sebagai pesan pengguna, link = buka value: path situs "/member/<id>" atau https, copy = salin value).
DASAR: text{md} · buttons{items:[aksi]} · chips{items:[string]} (klik = kirim) · callout{tone:info|warn|success|error,title,text} · card{title,subtitle,image,text,actions:[aksi]} · kv{title,items:[{k,v}]} · divider{} · progress{label,value,max}
DATA JKT48: member_card{name,nickname,image,status,info:[{k,v}],id,actions} · live_card{name,platform:idn|showroom,image,since,viewers,title,href} · schedule{title,items:[{date(ISO),title,team,members,href}]} · countdown{title,to(ISO),actions} · stats{items:[{label,value,delta,hint}]} · member_grid{title,items:[{name,image,id,tags:[string]}],filters:[string]} · compare{left:{name,image},right:{name,image},rows:[{label,left:number,right:number}]}
VISUAL: chart{kind:bar|line|area|donut,title,labels:[..],series:[{name,values:[number]}]} · table{columns:[string],rows:[[..]]} (bisa diurutkan) · heatmap{title,values:[0..4],cols} · timeline{title,items:[{time,title,text}]} · gallery{images:[{src,caption}]} · tree{root,children:[{name,highlight,children:[{name,image}]}]} · before_after{before,after,beforeLabel,afterLabel,caption}
INPUT & GAME (hasilnya dikirim kembali ke kamu sebagai pesan): form{title,fields:[{name,label,kind:text|number|select|slider|toggle,options,min,max,value}],submit} · quiz{title,questions:[{q,options:[..],answer:index,explain}]} · poll{q,options:[..]} · checklist{title,items:[string]} · personality{title,questions:[{q,options:[{label,result}]}],results:{key:{title,image,text,traits:[..]}}} · simulator{title,items:[{name,value}],unit} · rating{label} · guess_member{rounds:[{image,options:[..],answer:index}]} · roulette{title,items:[string]} · leaderboard{title,items:[{name,value,image}]} · tier_list{title,tiers:["S","A","B","C"],items:[{name,image}]} · sortable{title,items:[{title,meta}],submit}
TATA LETAK: tabs{tabs:[{label,blocks:[..]}]} · accordion{items:[{title,blocks:[..]}]}
MEDIA: youtube{id,title} (id video YouTube) · music{query} atau music{id} (pemutar lagu) · karaoke{id,translations:[string]} (lirik sinkron + terjemahan per baris) · live_preview{name,image,href,viewers,platform} · watch_party{name,image,room(id room Showroom),href}
PRAKTIS & AGENT: calendar{title,month(YYYY-MM),events:[{date,title,kind:show|birthday|event}]} · reminder{title,at(ISO),minutesBefore} · share_card{title,subtitle,image,theme:red|dark|butter} · calculator{title,items:[{label,price,qty}],days} · plan{title,steps:[{text,done}]} · sources{items:[{label,href}]} · api_tester{path} (path endpoint /api/... JKT48Connect) · json{title,data}
SPESIAL: stories{slides:[{kicker,big,title,text,image,theme:red|dark|butter|black}]} · holo_cards{cards:[{name,subtitle,image,rarity:R|SR|UR,stats:[{label,value}]}]} · bar_race{title,frames:[{label,items:[{name,value,image}]}]}`;
