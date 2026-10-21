import { apiGet } from "./api";

/*
 * Normalisasi respons JKT48Connect API ke tipe milik UI.
 * Bentuk field mengikuti respons asli api.jkt48connect.app (dicek Oktober 2026);
 * fallback kecil tetap ada untuk field yang berbeda antara IDN dan Showroom.
 */

type Raw = Record<string, any>;

function list(data: unknown, key?: string): Raw[] {
  const arr = Array.isArray(data) ? data : key && data && typeof data === "object" ? (data as Raw)[key] : null;
  return Array.isArray(arr) ? arr.filter((x) => x && typeof x === "object") : [];
}

function str(...vals: unknown[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  for (const v of vals) if (typeof v === "number") return String(v);
  return "";
}

function num(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = typeof v === "string" && v.trim() ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Gambar desain (jadwal/leaderboard/notifikasi) yang statusnya sudah `ready`.
 * Tema "jkt48connect" (Fan Signal) dipakai lebih dulu; photobook hanya cadangan.
 */
function readyDesign(designs: Raw | undefined, layout: "banner" | "portrait"): string {
  if (!designs) return "";
  for (const t of ["jkt48connect", "photobook"]) {
    const img = designs[t]?.[layout];
    if (img?.status === "ready" && img.url) return img.url;
  }
  return "";
}

export type Paged<T> = { items: T[]; page: number; perpage: number; total: number };

function paged<T>(data: Raw, key: string, map: (r: Raw) => T, page: number, perpage: number): Paged<T> {
  const items = list(data, key).map(map);
  return {
    items,
    page: num(data?.page) ?? page,
    perpage: num(data?.perpage) ?? perpage,
    total: num(data?.total_count) ?? items.length,
  };
}

/* ───────────────────────────── Member ───────────────────────────── */

export type Member = {
  id: string;
  name: string;
  nickname: string;
  img: string;
  isGraduate: boolean;
  idnUsername: string;
};

export type MemberDetail = Member & {
  fullname: string;
  birthdate: string;
  bloodType: string;
  height: string;
  description: string;
  jikosokai: string;
  socials: { title: string; url: string }[];
  upcomingShows: TheaterShow[];
  recentShows: TheaterShow[];
  totalLive: { showroom: number; idn: number } | null;
};

function mapMember(m: Raw): Member {
  return {
    id: str(m.url, m.url_key, m._id),
    name: str(m.name),
    nickname: str(m.nickname, m.nicknames?.[0]),
    img: str(m.img, m.img_alt),
    isGraduate: Boolean(m.is_graduate),
    idnUsername: str(m.idn_username),
  };
}

export async function getMembers(): Promise<Member[]> {
  return list(await apiGet("/api/member"))
    .map(mapMember)
    .filter((m) => m.name && m.id);
}

export async function getMember(id: string): Promise<MemberDetail> {
  const m = await apiGet<Raw>(`/api/member/${encodeURIComponent(id)}`);
  const total = m.stats?.total_live;
  return {
    ...mapMember(m),
    id: str(m.url, id),
    fullname: str(m.fullname, m.name),
    birthdate: str(m.birthdate),
    bloodType: str(m.bloodType),
    height: str(m.height),
    description: str(m.description),
    jikosokai: str(m.jikosokai),
    socials: list(m.socials)
      .map((s) => ({ title: str(s.title), url: str(s.url) }))
      .filter((s) => s.url),
    upcomingShows: list(m.upcomingTheater).map(mapShow),
    recentShows: list(m.recentTheater).map(mapShow),
    totalLive: total ? { showroom: num(total.showroom) ?? 0, idn: num(total.idn) ?? 0 } : null,
  };
}

/* ───────────────────────────── Live ───────────────────────────── */

export type LiveSession = {
  id: string;
  name: string;
  fullname: string;
  img: string;
  avatar: string;
  platform: "showroom" | "idn" | string;
  startedAt: string;
  title: string;
  link: string;
  /** Kartu notifikasi live tema jkt48connect (1600×900), bila sudah dirender. */
  banner: string;
};

function mapLive(l: Raw): LiveSession {
  const platform = str(l.type).toLowerCase();
  // notification_caption: "🔴 Nama Lengkap — Judul live\nhttps://…"
  const caption = str(l.notification_caption);
  const [head = "", url = ""] = caption.split("\n");
  const [who, ...titleParts] = head.replace(/^\S*\s*/, "").split(" — ");
  const fallbackLink =
    platform === "idn"
      ? `https://www.idn.app/${l.url_key}/live/${l.slug}`
      : `https://www.showroom-live.com/r/${str(l.room_url_key, l.url_key)}`;
  return {
    id: str(l.notification_data_id, l.slug, l.room_id, l.url_key),
    name: str(l.name),
    fullname: titleParts.length ? who.trim() : str(l.name),
    img: str(l.img, l.img_alt),
    avatar: str(l.img_alt, l.img),
    platform,
    startedAt: str(l.started_at),
    title: titleParts.join(" — ").trim(),
    link: url.startsWith("http") ? url.trim() : fallbackLink,
    banner: readyDesign(l.notification_designs, "banner"),
  };
}

export async function getLive(): Promise<LiveSession[]> {
  // now_live bisa memuat sesi yang sama dua kali (versi nama panggilan & nama lengkap).
  const seen = new Set<string>();
  return list(await apiGet("/api/now_live", { group: "jkt48" }))
    .map(mapLive)
    .filter((l) => l.name && !seen.has(l.id) && seen.add(l.id));
}

/* ───────────────────────────── Theater ───────────────────────────── */

export type ShowMember = { id: string; name: string; img: string };

export type TheaterShow = {
  id: string;
  title: string;
  date: string;
  team: string;
  /** "show" | "exclusive" | "general" (dari next_schedule); daftar theater selalu "show". */
  category: string;
  banner: string;
  poster: string;
  memberCount: number | null;
  members: ShowMember[];
  birthday: ShowMember[];
  url: string;
};

export type TheaterDetail = TheaterShow & {
  songs: string[];
  graduation: ShowMember[];
  recordings: { title: string; youtubeUrl: string; thumbnail: string }[];
};

function mapShowMember(m: Raw): ShowMember {
  return { id: str(m.url_key, m.id), name: str(m.name), img: str(m.img) };
}

function members(v: unknown) {
  return list(v)
    .map(mapShowMember)
    .filter((m) => m.name);
}

function mapShow(s: Raw): TheaterShow {
  const ms = members(s.members);
  return {
    id: str(s.code, s.id),
    title: str(s.title, s.setlist?.title),
    date: str(s.start_date, s.date),
    team: str(s.team),
    category: str(s.category, "show"),
    banner: readyDesign(s.schedule_designs, "banner"),
    poster: readyDesign(s.schedule_designs, "portrait"),
    memberCount: num(s.member_count) ?? (ms.length || null),
    members: ms,
    birthday: members(s.seitansai),
    url: str(s.url),
  };
}

export async function getTheaterList(page = 1, perpage = 12): Promise<Paged<TheaterShow>> {
  return paged(await apiGet<Raw>("/api/theater", { page, perpage }), "theater", mapShow, page, perpage);
}

export async function getTheater(id: string): Promise<TheaterDetail> {
  const raw = await apiGet<Raw>(`/api/theater/${encodeURIComponent(id)}`);
  const s = list(raw, "shows")[0] ?? {};
  const songs = list(s.setlist?.songs)
    .map((x) => str(x.title, x.name))
    .concat((Array.isArray(s.setlist?.songs) ? s.setlist.songs : []).filter((x: unknown) => typeof x === "string"))
    .filter(Boolean);
  return {
    ...mapShow(s),
    id: str(s.id, id),
    songs,
    graduation: members(s.graduation),
    recordings: list(s.recordings)
      .filter((r) => r.youtube_url)
      .map((r) => ({
        title: str(r.title, s.title),
        youtubeUrl: str(r.youtube_url),
        thumbnail: str(list(r.screenshots)[0]?.url),
      })),
  };
}

/** Jadwal mendatang: show theater, event exclusive, dan event umum. */
export async function getNextSchedule(): Promise<TheaterShow[]> {
  return list(await apiGet("/api/next_schedule"))
    .map(mapShow)
    .filter((s) => s.title && s.date);
}

/* ───────────────────────────── News ───────────────────────────── */

export type NewsItem = { id: string; title: string; date: string; category: string; url: string };
export type NewsDetail = NewsItem & { content: string };

function mapNews(n: Raw): NewsItem {
  return { id: str(n.id), title: str(n.title), date: str(n.date), category: str(n.category, "Berita"), url: str(n.url) };
}

export async function getNewsList(page = 1, perpage = 10): Promise<Paged<NewsItem>> {
  return paged(await apiGet<Raw>("/api/news", { page, perpage }), "news", mapNews, page, perpage);
}

export async function getNews(id: string): Promise<NewsDetail> {
  const n = await apiGet<Raw>(`/api/news/${encodeURIComponent(id)}`);
  return { ...mapNews(n), id: str(n.id, id), content: str(n.content) };
}

/* ───────────────────────────── Birthday ───────────────────────────── */

export type Birthday = { id: string; name: string; img: string; birthdate: string; next: Date; age: number };

/** Ulang tahun berikutnya dihitung dalam tanggal WIB (birthdate API = 17:00Z hari sebelumnya). */
function mapBirthday(b: Raw): Birthday {
  const birthdate = str(b.birthdate);
  const wib = new Date(new Date(birthdate).getTime() + 7 * 3600_000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), wib.getUTCMonth(), wib.getUTCDate());
  if (next < today) next = new Date(now.getFullYear() + 1, wib.getUTCMonth(), wib.getUTCDate());
  return { id: str(b.url_key, b.name), name: str(b.name), img: str(b.img), birthdate, next, age: next.getFullYear() - wib.getUTCFullYear() };
}

export async function getBirthdays(): Promise<Birthday[]> {
  return list(await apiGet("/api/next_birthday"))
    .map(mapBirthday)
    .filter((b) => b.name && b.birthdate)
    .sort((a, b) => a.next.getTime() - b.next.getTime());
}

/* ───────────────────────────── Recent ───────────────────────────── */

export type RecentLive = {
  id: string;
  name: string;
  memberId: string;
  img: string;
  platform: string;
  start: string;
  end: string;
  durationMs: number;
  viewers: number | null;
  points: number | null;
  pointUnit: string;
  title: string;
};

export type Fan = { name: string; avatar: string; amount: number | null };
export type GiftSummary = { name: string; img: string; num: number | null; users: number | null };

export type RecentDetail = RecentLive & {
  gifts: GiftSummary[];
  giftsPartial: boolean;
  fans: Fan[];
  comments: number | null;
  commenters: number | null;
  leaderboard: string;
  replayUrl: string;
  recordingPartial: boolean;
  screenshots: string[];
};

/** "idn_gold" → "Gold", "showroom_points" → "Poin". */
export function pointLabel(unit: string) {
  return unit.includes("gold") ? "Gold" : "Poin";
}

function mapRecent(r: Raw): RecentLive {
  const info: Raw = r.live_info ?? {};
  const member: Raw = r.member ?? r.room_info ?? {};
  return {
    id: str(r.data_id, r._id),
    name: str(member.name),
    memberId: str(member.url),
    img: str(member.img, member.img_alt),
    platform: str(r.type).toLowerCase(),
    start: str(info.date?.start),
    end: str(info.date?.end, r.created_at),
    durationMs: num(info.duration) ?? 0,
    viewers: num(info.viewers?.num),
    points: num(r.points, r.total_gifts),
    pointUnit: str(r.point_unit, r.type === "idn" ? "idn_gold" : "showroom_points"),
    title: str(r.idn?.title),
  };
}

export async function getRecentList(page = 1, perpage = 12): Promise<Paged<RecentLive>> {
  return paged(await apiGet<Raw>("/api/recent", { page, perpage }), "recents", mapRecent, page, perpage);
}

export async function getRecent(id: string): Promise<RecentDetail> {
  const r = await apiGet<Raw>(`/api/recent/${encodeURIComponent(id)}`);
  const info: Raw = r.live_info ?? {};
  const shot: Raw | undefined = info.screenshot;
  const recordings = list(r.recordings);
  return {
    ...mapRecent(r),
    id: str(r.data_id, id),
    gifts: list(info.gift?.list)
      .map((g) => ({ name: str(g.name), img: g.image_available === false ? "" : str(g.img), num: num(g.num), users: num(g.user_count) }))
      .filter((g) => g.name)
      .sort((a, b) => (b.num ?? 0) - (a.num ?? 0)),
    giftsPartial: info.gift?.status === "partial",
    fans: list(r.fans)
      .map((f) => ({ name: str(f.name), avatar: str(f.avatar_url), amount: num(f.gold, f.point, f.reported_gold) }))
      .filter((f) => f.name),
    comments: num(info.comments?.num),
    commenters: num(info.comments?.users),
    leaderboard: readyDesign(r.leaderboard_designs, "portrait"),
    replayUrl: str(recordings[0]?.player_url),
    recordingPartial: r.recording_session?.status === "partial" || recordings.some((x) => x.partial),
    screenshots:
      shot?.base_url && Array.isArray(shot.list)
        ? shot.list.map((t: unknown) => `${shot.base_url}/${t}.${shot.format || "jpg"}`)
        : [],
  };
}

/* ───────────────────────────── YouTube ───────────────────────────── */

export type Video = { id: string; title: string; url: string; date: string; thumbnail: string; channel: string; views: number | null };

export async function getVideos(): Promise<Video[]> {
  return list(await apiGet("/api/jkt48_youtube")).map((v) => ({
    id: str(v.id),
    title: str(v.title),
    url: str(v.url, `https://www.youtube.com/watch?v=${v.id}`),
    date: str(v.date),
    thumbnail: str(v.thumbnails?.high?.url, `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`),
    channel: str(v.channelTitle, "JKT48"),
    views: num(v.statistics?.viewCount),
  }));
}
