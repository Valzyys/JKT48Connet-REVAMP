import { apiGet } from "./api";

/*
 * Bentuk respons JKT48Connect API berbeda per endpoint (lihat docs: "jangan
 * mengasumsikan semua respons memiliki properti `data` yang sama"). Semua
 * fungsi di sini menormalkan respons ke tipe milik UI, supaya komponen tidak
 * perlu tahu variasi nama field dari sumber data.
 */

type Raw = Record<string, any>;

/** Ambil array dari respons yang bisa berupa array langsung atau dibungkus key tertentu. */
function list(data: unknown, ...keys: string[]): Raw[] {
  if (Array.isArray(data)) return data.filter(Boolean);
  if (data && typeof data === "object") {
    for (const k of [...keys, "data", "results", "items"]) {
      const v = (data as Raw)[k];
      if (Array.isArray(v)) return v.filter(Boolean);
    }
  }
  return [];
}

function str(...vals: unknown[]): string {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  for (const v of vals) if (typeof v === "number") return String(v);
  return "";
}

function num(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v;
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return null;
}

function imgOf(o: Raw | undefined | null): string {
  if (!o) return "";
  return str(o.img, o.img_alt, o.image, o.image_url, o.photo, o.avatar, o.thumbnail);
}

type DesignImage = { status?: string; url?: string | null };
/** Pilih gambar desain (schedule/leaderboard/notification) yang sudah `ready`. */
function readyDesign(designs: Raw | undefined, layout: "banner" | "portrait"): string {
  if (!designs) return "";
  for (const theme of ["jkt48connect", "photobook", "avonera48"]) {
    const img = designs[theme]?.[layout] as DesignImage | undefined;
    if (img?.status === "ready" && img.url) return img.url;
  }
  return "";
}

export type Paged<T> = { items: T[]; page: number; perpage: number; total: number };

function paged<T>(data: unknown, key: string, map: (r: Raw) => T, page: number, perpage: number): Paged<T> {
  const items = list(data, key).map(map);
  const total = num((data as Raw)?.total_count, (data as Raw)?.total) ?? items.length;
  return { items, page: num((data as Raw)?.page) ?? page, perpage: num((data as Raw)?.perpage) ?? perpage, total };
}

/* ───────────────────────────── Member ───────────────────────────── */

export type Member = {
  id: string;
  name: string;
  nickname: string;
  img: string;
  generation: string;
  team: string;
  isGraduate: boolean;
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
};

function mapMember(m: Raw): Member {
  const nicknames = Array.isArray(m.nicknames) ? m.nicknames : [];
  return {
    id: str(m.url_key, m.url, m.id, m._id, m.slug, m.name),
    name: str(m.name, m.fullname),
    nickname: str(m.nickname, nicknames[0]),
    img: imgOf(m),
    generation: str(m.generation, m.gen),
    team: str(m.team?.name, m.team, m.type),
    isGraduate: Boolean(m.is_graduate ?? m.graduated),
  };
}

export async function getMembers(): Promise<Member[]> {
  const data = await apiGet("/api/member");
  return list(data, "members", "member")
    .map(mapMember)
    .filter((m) => m.name);
}

export async function getMember(id: string): Promise<MemberDetail> {
  const raw = await apiGet<Raw>(`/api/member/${encodeURIComponent(id)}`);
  const m: Raw = raw?.member ?? raw?.data ?? raw ?? {};
  const base = mapMember(m);
  return {
    ...base,
    id: base.id || id,
    fullname: str(m.fullname, m.full_name, m.name),
    birthdate: str(m.birthdate, m.birthday),
    bloodType: str(m.bloodType, m.blood_type),
    height: str(m.height),
    description: str(m.description),
    jikosokai: str(m.jikosokai),
    socials: list(m.socials)
      .map((s) => ({ title: str(s.title, s.name), url: str(s.url) }))
      .filter((s) => s.url),
    upcomingShows: list(m.upcomingTheater ?? m.upcoming_theater).map(mapShow),
    recentShows: list(m.recentTheater ?? m.recent_theater).map(mapShow),
  };
}

/* ───────────────────────────── Live ───────────────────────────── */

export type LiveSession = {
  id: string;
  name: string;
  img: string;
  platform: "showroom" | "idn" | string;
  startedAt: string;
  title: string;
  viewers: number | null;
  link: string;
  banner: string;
};

function liveLink(l: Raw, platform: string): string {
  const direct = str(l.url, l.live_url, l.share_url);
  if (direct.startsWith("http")) return direct;
  if (platform === "idn") {
    const user = str(l.idn?.username, l.username, l.url_key);
    const slug = str(l.idn?.slug, l.slug);
    return user && slug ? `https://www.idn.app/${user}/live/${slug}` : "https://www.idn.app";
  }
  const key = str(l.room_url_key, l.url_key);
  return key ? `https://www.showroom-live.com/r/${key}` : "https://www.showroom-live.com";
}

function mapLive(l: Raw): LiveSession {
  const platform = str(l.type, l.platform).toLowerCase();
  return {
    id: str(l.data_id, l.notification_data_id, l.room_id, l.slug, l.url_key, l.name),
    name: str(l.name, l.member?.name),
    img: str(l.img, l.img_alt, l.member?.img, l.image),
    platform,
    startedAt: str(l.started_at, l.start_date, l.live_at),
    title: str(l.title, l.idn?.title),
    viewers: num(l.viewers?.num, l.viewers, l.view_count, l.view_num),
    link: liveLink(l, platform),
    banner: readyDesign(l.notification_designs, "banner") || str(l.image, l.idn?.image, l.thumbnail),
  };
}

export async function getLive(): Promise<LiveSession[]> {
  const data = await apiGet("/api/now_live", { group: "jkt48" });
  return list(data, "lives", "live")
    .map(mapLive)
    .filter((l) => l.name);
}

/* ───────────────────────────── Theater ───────────────────────────── */

export type ShowMember = { id: string; name: string; img: string };

export type TheaterShow = {
  id: string;
  title: string;
  date: string;
  banner: string;
  poster: string;
  memberCount: number | null;
  members: ShowMember[];
  birthday: ShowMember[];
  url: string;
};

export type TheaterRecording = { title: string; youtubeUrl: string; thumbnail: string; startedAt: string };

export type TheaterDetail = TheaterShow & {
  setlistTitle: string;
  setlistDescription: string;
  graduation: ShowMember[];
  designBanner: string;
  recordings: TheaterRecording[];
  otherShows: TheaterShow[];
};

function mapShowMember(m: Raw): ShowMember {
  return { id: str(m.url_key, m.id, m.member_id, m.name), name: str(m.name), img: imgOf(m) };
}

function mapShow(s: Raw): TheaterShow {
  const members = list(s.members ?? s.member ?? s.lineup ?? s.jkt48_member).map(mapShowMember);
  const seitansai = list(s.seitansai ?? s.birthday_members ?? s.birthday).map(mapShowMember);
  return {
    id: str(s.id, s.reference_code, s.code, s.schedule_id),
    title: str(s.title, s.setlist?.title, s.name),
    date: str(s.date, s.show_date, s.start_date),
    banner: readyDesign(s.schedule_designs, "banner") || str(s.banner, s.setlist?.banner, s.image),
    poster: str(s.poster, s.setlist?.poster, s.banner, s.setlist?.banner),
    memberCount: num(s.member_count, members.length || undefined),
    members,
    birthday: seitansai,
    url: str(s.url, s.link),
  };
}

export async function getTheaterList(page = 1, perpage = 12): Promise<Paged<TheaterShow>> {
  const data = await apiGet("/api/theater", { page, perpage });
  return paged(data, "theater", mapShow, page, perpage);
}

export async function getTheater(id: string): Promise<TheaterDetail> {
  const raw = await apiGet<Raw>(`/api/theater/${encodeURIComponent(id)}`);
  const shows = list(raw, "shows");
  const s: Raw = shows[0] ?? raw?.show ?? raw ?? {};
  const base = mapShow(s);
  return {
    ...base,
    id: base.id || id,
    setlistTitle: str(s.setlist?.title, s.title),
    setlistDescription: str(s.setlist?.description, s.short_description, s.description),
    graduation: list(s.graduation).map(mapShowMember),
    designBanner: readyDesign(s.schedule_designs, "banner"),
    recordings: list(s.recordings)
      .filter((r) => r.youtube_url)
      .map((r) => ({
        title: str(r.title, base.title),
        youtubeUrl: str(r.youtube_url),
        thumbnail: str(list(r.screenshots)[0]?.url, r.thumbnail),
        startedAt: str(r.started_at),
      })),
    otherShows: shows.slice(1).map(mapShow),
  };
}

export async function getNextSchedule(): Promise<TheaterShow[]> {
  const data = await apiGet("/api/next_schedule");
  return list(data, "shows", "theater", "schedule").map(mapShow).filter((s) => s.title);
}

/* ───────────────────────────── Event ───────────────────────────── */

export type EventItem = { id: string; title: string; date: string; url: string; img: string; type: string };

function mapEvent(e: Raw): EventItem {
  return {
    id: str(e.id, e._id, e.code, e.title),
    title: str(e.title, e.name),
    date: str(e.date, e.start_date, e.event_date),
    url: str(e.url, e.link),
    img: str(e.banner, e.img, e.image, e.poster),
    type: str(e.type, e.category, e.label),
  };
}

export async function getEvents(): Promise<EventItem[]> {
  const data = await apiGet("/api/jkt48event");
  return list(data, "events", "event").map(mapEvent).filter((e) => e.title);
}

/* ───────────────────────────── News ───────────────────────────── */

export type NewsItem = { id: string; title: string; date: string; category: string; url: string; img: string };
export type NewsDetail = NewsItem & { content: string };

/** Label berita resmi berupa path ikon (mis. "/images/icon.cat2.png"). */
const NEWS_LABELS: Record<string, string> = {
  cat1: "Theater",
  cat2: "Event",
  cat3: "Lainnya",
  cat4: "Release",
  cat5: "Birthday",
  cat8: "Merchandise",
};

function newsCategory(n: Raw): string {
  const raw = str(n.category, n.label, n.type);
  const m = /cat\d+/.exec(raw);
  if (m) return NEWS_LABELS[m[0]] ?? "Berita";
  return raw && !raw.includes("/") ? raw : "Berita";
}

function mapNews(n: Raw): NewsItem {
  return {
    id: str(n.id, n.news_id, n.slug, n._id),
    title: str(n.title),
    date: str(n.date, n.published_at, n.created_at),
    category: newsCategory(n),
    url: str(n.url, n.link),
    img: str(n.background_image, n.image, n.img, n.thumbnail),
  };
}

export async function getNewsList(page = 1, perpage = 10): Promise<Paged<NewsItem>> {
  const data = await apiGet("/api/news", { page, perpage });
  return paged(data, "news", mapNews, page, perpage);
}

export async function getNews(id: string): Promise<NewsDetail> {
  const raw = await apiGet<Raw>(`/api/news/${encodeURIComponent(id)}`);
  const n: Raw = raw?.news ?? raw?.data ?? raw ?? {};
  return { ...mapNews(n), id: str(n.id, id), content: str(n.content, n.content_body, n.body, n.description) };
}

/* ───────────────────────────── Birthday ───────────────────────────── */

export type Birthday = { id: string; name: string; img: string; birthdate: string; next: Date; age: number | null };

function nextBirthday(birthdate: string, now = new Date()): Date {
  const b = new Date(birthdate);
  const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return next;
}

function mapBirthday(b: Raw): Birthday {
  const birthdate = str(b.birthdate, b.birthday, b.date);
  const next = b.next_birthday ? new Date(b.next_birthday) : nextBirthday(birthdate);
  const year = new Date(birthdate).getFullYear();
  return {
    id: str(b.url_key, b.id, b.name),
    name: str(b.name),
    img: imgOf(b),
    birthdate,
    next,
    age: Number.isFinite(year) ? next.getFullYear() - year : num(b.age_after_birthday),
  };
}

export async function getBirthdays(): Promise<Birthday[]> {
  const data = await apiGet("/api/birthday");
  return list(data, "birthday", "birthdays", "members")
    .map(mapBirthday)
    .filter((b) => b.name && b.birthdate)
    .sort((a, b) => a.next.getTime() - b.next.getTime());
}

/* ───────────────────────────── Recent ───────────────────────────── */

export type RecentLive = {
  id: string;
  name: string;
  nickname: string;
  img: string;
  platform: string;
  start: string;
  end: string;
  durationMs: number;
  viewers: number | null;
  points: number | null;
  title: string;
};

export type GiftSummary = { name: string; img: string; num: number | null; users: number | null };

export type RecentDetail = RecentLive & {
  gifts: GiftSummary[];
  leaderboard: string;
  replayUrl: string;
  screenshots: string[];
  supporters: number | null;
  partial: boolean;
};

function mapRecent(r: Raw): RecentLive {
  const info: Raw = r.live_info ?? {};
  const start = str(info.date?.start, r.start_date, r.created_at);
  const end = str(info.date?.end, r.end_date);
  const durationMs =
    num(info.duration) ?? (start && end ? Math.max(0, new Date(end).getTime() - new Date(start).getTime()) : 0);
  return {
    id: str(r.data_id, r._id, r.id),
    name: str(r.member?.name, r.name),
    nickname: str(r.member?.nickname, r.nickname),
    img: str(r.member?.img_alt, r.member?.img, r.img),
    platform: str(r.type, r.platform).toLowerCase(),
    start,
    end,
    durationMs: durationMs ?? 0,
    viewers: num(info.viewers?.num, info.viewers, info.viewer),
    points: num(r.points, info.gift?.gold_summary?.reported_gold, r.total_gift),
    title: str(r.idn?.title, r.title),
  };
}

export async function getRecentList(page = 1, perpage = 12): Promise<Paged<RecentLive>> {
  const data = await apiGet("/api/recent", { page, perpage });
  return paged(data, "recents", mapRecent, page, perpage);
}

export async function getRecent(id: string): Promise<RecentDetail> {
  const raw = await apiGet<Raw>(`/api/recent/${encodeURIComponent(id)}`);
  const r: Raw = raw?.data ?? raw ?? {};
  const info: Raw = r.live_info ?? {};
  const shot: Raw | undefined = info.screenshot;
  const shots: string[] =
    shot?.base_url && Array.isArray(shot.list)
      ? shot.list.map((t: unknown) => `${shot.base_url}/${t}.${shot.format || "jpg"}`)
      : [];
  const recordings = list(r.recordings);
  return {
    ...mapRecent(r),
    id: str(r.data_id, id),
    gifts: list(info.gift?.list ?? info.gift)
      .map((g) => ({
        name: str(g.name),
        img: str(g.img, g.image),
        num: num(g.num),
        users: num(g.user_count),
      }))
      .filter((g) => g.name),
    leaderboard: readyDesign(r.leaderboard_designs, "portrait"),
    replayUrl: str(recordings[0]?.player_url, r.recording?.player_url),
    screenshots: shots,
    supporters: num(r.users?.length, info.users, r.fans?.length),
    partial: Boolean(r.recording?.partial ?? recordings.some((x) => x.partial)),
  };
}

/* ───────────────────────────── YouTube ───────────────────────────── */

export type Video = { id: string; title: string; url: string; date: string; thumbnail: string; channel: string };

export async function getVideos(): Promise<Video[]> {
  const data = await apiGet("/api/jkt48_youtube");
  return list(data, "videos").map((v) => {
    const thumbs: Raw = v.thumbnails ?? {};
    const id = str(v.id, v.video_id);
    return {
      id,
      title: str(v.title),
      url: str(v.url, id && `https://www.youtube.com/watch?v=${id}`),
      date: str(v.date, v.published_at),
      thumbnail: str(
        thumbs.high?.url,
        thumbs.medium?.url,
        Array.isArray(thumbs) ? thumbs[0]?.url : undefined,
        v.thumbnail,
        id && `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      ),
      channel: str(v.channelTitle, v.author, "JKT48"),
    };
  });
}
