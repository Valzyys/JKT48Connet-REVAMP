/*
 * Normalisasi respons JKT48Connect API ke tipe milik UI.
 * Dijalankan di SERVER (worker/proxy.ts): browser hanya menerima field yang dipakai UI,
 * bukan JSON mentah upstream. File ini murni (tanpa DOM/fetch) supaya bisa dipakai Worker dan app.
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

/** Hanya URL http(s) absolut yang boleh sampai ke `href`/`src`; selain itu (javascript:, data:, rusak) jadi "". */
export function httpUrl(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v !== "string" || !v.trim()) continue;
    try {
      const u = new URL(v.trim());
      if (u.protocol === "https:" || u.protocol === "http:") return u.href;
    } catch {
      /* coba nilai berikutnya */
    }
  }
  return "";
}

/**
 * Gambar desain (jadwal/leaderboard/notifikasi) yang statusnya sudah `ready`.
 * Tema "jkt48connect" (Fan Signal) dipakai lebih dulu; photobook hanya cadangan.
 */
function readyDesign(designs: Raw | undefined, layout: "banner" | "portrait"): string {
  if (!designs) return "";
  for (const t of ["jkt48connect", "photobook"]) {
    const img = designs[t]?.[layout];
    if (img?.status === "ready" && img.url) return httpUrl(img.url);
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
    img: httpUrl(m.img, m.img_alt),
    isGraduate: Boolean(m.is_graduate),
    // Dipakai sebagai path https://www.idn.app/<username>.
    idnUsername: /^[A-Za-z0-9._-]{1,64}$/.test(str(m.idn_username)) ? str(m.idn_username) : "",
  };
}

export function shapeMembers(raw: unknown): Member[] {
  return list(raw)
    .map(mapMember)
    .filter((m) => m.name && m.id);
}

export function shapeMember(m: Raw, id: string): MemberDetail {
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
      .map((s) => ({ title: str(s.title), url: httpUrl(s.url) }))
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
      ? `https://www.idn.app/${encodeURIComponent(str(l.url_key))}/live/${encodeURIComponent(str(l.slug))}`
      : `https://www.showroom-live.com/r/${encodeURIComponent(str(l.room_url_key, l.url_key))}`;
  return {
    id: str(l.notification_data_id, l.slug, l.room_id, l.url_key),
    name: str(l.name),
    fullname: titleParts.length ? who.trim() : str(l.name),
    img: httpUrl(l.img, l.img_alt),
    avatar: httpUrl(l.img_alt, l.img),
    platform,
    startedAt: str(l.started_at),
    title: titleParts.join(" — ").trim(),
    link: httpUrl(url, fallbackLink),
    banner: readyDesign(l.notification_designs, "banner"),
  };
}

export function shapeLive(raw: unknown): LiveSession[] {
  // now_live bisa memuat sesi yang sama dua kali (versi nama panggilan & nama lengkap).
  const seen = new Set<string>();
  return list(raw)
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
  return { id: str(m.url_key, m.id), name: str(m.name), img: httpUrl(m.img) };
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
    url: httpUrl(s.url),
  };
}

export function shapeTheaterList(raw: Raw, page: number, perpage: number): Paged<TheaterShow> {
  return paged(raw, "theater", mapShow, page, perpage);
}

export function shapeTheater(raw: Raw, id: string): TheaterDetail {
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
      .map((r) => ({
        title: str(r.title, s.title),
        youtubeUrl: httpUrl(r.youtube_url),
        thumbnail: httpUrl(list(r.screenshots)[0]?.url),
      }))
      .filter((r) => r.youtubeUrl),
  };
}

/** Jadwal mendatang: show theater, event exclusive, dan event umum. */
export function shapeNextSchedule(raw: unknown): TheaterShow[] {
  return list(raw)
    .map(mapShow)
    .filter((s) => s.title && s.date);
}

/* ───────────────────────────── News ───────────────────────────── */

export type NewsItem = { id: string; title: string; date: string; category: string; url: string };
export type NewsDetail = NewsItem & { content: string };

function mapNews(n: Raw): NewsItem {
  return { id: str(n.id), title: str(n.title), date: str(n.date), category: str(n.category, "Berita"), url: httpUrl(n.url) };
}

export function shapeNewsList(raw: Raw, page: number, perpage: number): Paged<NewsItem> {
  return paged(raw, "news", mapNews, page, perpage);
}

/** `content` tetap HTML mentah dari jkt48.com; disanitasi DOMPurify di browser sebelum dirender. */
export function shapeNews(n: Raw, id: string): NewsDetail {
  return { ...mapNews(n), id: str(n.id, id), content: str(n.content) };
}

/* ───────────────────────────── Birthday ───────────────────────────── */

/** Tanggal ulang tahun berikutnya dihitung di browser (zona waktu pengunjung). */
export type BirthdayEntry = { id: string; name: string; img: string; birthdate: string };

export function shapeBirthdays(raw: unknown): BirthdayEntry[] {
  return list(raw)
    .map((b) => ({ id: str(b.url_key, b.name), name: str(b.name), img: httpUrl(b.img), birthdate: str(b.birthdate) }))
    .filter((b) => b.name && b.birthdate);
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

/** Cuplikan layar live; `at` = waktu tangkap (ISO), diambil dari nama file (epoch ms). */
export type Screenshot = { url: string; at: string };

/**
 * `url` di sini adalah URL `/api/replay?t=…` milik situs (token terenkripsi, terikat sesi, kedaluwarsa),
 * bukan URL file asli. Diisi server hanya setelah masa kunci lewat.
 */
/** `hls`: playlist byte-range dari upstream (indeks potongan untuk seek cepat); diganti token oleh worker. */
export type Recording = { url: string; hls?: string; durationMs: number; startedAt: string; partial: boolean };

/** Replay baru boleh diputar di situs setelah jeda ini sejak live selesai. Ditegakkan di server. */
export const REPLAY_LOCK_HOURS = 72;

export type RecentDetail = RecentLive & {
  gifts: GiftSummary[];
  giftsPartial: boolean;
  fans: Fan[];
  comments: number | null;
  commenters: number | null;
  leaderboard: string;
  /** Kosong selama masa kunci (server tidak mengirim URL apa pun). */
  recordings: Recording[];
  /** Jumlah bagian rekaman yang ada, juga selama masa kunci (untuk panel terkunci). */
  recordingCount: number;
  /** Waktu replay terbuka: akhir live + REPLAY_LOCK_HOURS. */
  replayUnlockAt: string;
  recordingPartial: boolean;
  screenshots: Screenshot[];
};

function mapRecent(r: Raw): RecentLive {
  const info: Raw = r.live_info ?? {};
  const member: Raw = r.member ?? r.room_info ?? {};
  return {
    id: str(r.data_id, r._id),
    name: str(member.name),
    memberId: str(member.url),
    img: httpUrl(member.img, member.img_alt),
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

export function shapeRecentList(raw: Raw, page: number, perpage: number): Paged<RecentLive> {
  return paged(raw, "recents", mapRecent, page, perpage);
}

/**
 * Detail recent. `recordings[].url` di hasil fungsi ini masih URL file asli upstream:
 * worker/proxy.ts WAJIB menggantinya (token) atau mengosongkannya (masa kunci) sebelum dikirim ke browser.
 */
export function shapeRecent(r: Raw, id: string): RecentDetail {
  const info: Raw = r.live_info ?? {};
  const shot: Raw | undefined = info.screenshot;
  const recordings = list(r.recordings);
  const base = mapRecent(r);
  const endMs = Date.parse(base.end) || Date.parse(base.start) + base.durationMs;
  const shotBase = httpUrl(shot?.base_url).replace(/\/+$/, "");
  const shotFormat = /^[a-z0-9]{2,5}$/i.test(str(shot?.format)) ? str(shot?.format) : "jpg";
  const files = recordings
    .map((x) => {
      const hls = httpUrl(x.stream_url);
      return {
        url: httpUrl(x.url),
        ...(new URL(hls || "https://x.invalid").pathname.endsWith(".m3u8") ? { hls } : {}),
        durationMs: num(x.duration_ms) ?? 0,
        startedAt: str(x.started_at),
        partial: !!x.partial,
      };
    })
    .filter((x) => new URL(x.url || "https://x.invalid").pathname.endsWith(".mp4"));
  return {
    ...base,
    id: str(r.data_id, id),
    gifts: list(info.gift?.list)
      .map((g) => ({ name: str(g.name), img: g.image_available === false ? "" : httpUrl(g.img), num: num(g.num), users: num(g.user_count) }))
      .filter((g) => g.name)
      .sort((a, b) => (b.num ?? 0) - (a.num ?? 0)),
    // Rincian gift bisa kosong walau total gold ada (`gift_events_not_captured`): tetap ditandai parsial.
    giftsPartial: info.gift?.status === "partial" || info.gift?.reason === "gift_events_not_captured",
    fans: list(r.fans)
      .map((f) => ({ name: str(f.name), avatar: httpUrl(f.avatar_url), amount: num(f.gold, f.point, f.reported_gold) }))
      .filter((f) => f.name),
    comments: num(info.comments?.num),
    commenters: num(info.comments?.users),
    leaderboard: readyDesign(r.leaderboard_designs, "portrait"),
    recordings: files,
    recordingCount: files.length,
    replayUnlockAt: Number.isFinite(endMs) ? new Date(endMs + REPLAY_LOCK_HOURS * 3_600_000).toISOString() : "",
    recordingPartial: r.recording_session?.status === "partial" || recordings.some((x) => x.partial),
    screenshots:
      shotBase && Array.isArray(shot?.list)
        ? shot.list
            .filter((t: unknown) => /^[A-Za-z0-9_-]{1,64}$/.test(String(t)))
            .map((t: unknown) => {
              const ms = Number(t);
              return { url: `${shotBase}/${t}.${shotFormat}`, at: Number.isFinite(ms) && ms > 1e12 ? new Date(ms).toISOString() : "" };
            })
        : [],
  };
}

/* ───────────────────────────── YouTube ───────────────────────────── */

/** `playable`: upstream menyediakan HLS publik (diputar di aplikasi lewat detail, bukan dari daftar). */
export type Video = { id: string; title: string; url: string; date: string; thumbnail: string; channel: string; views: number | null; playable: boolean };

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

/** URL pemutar hanya dari domain API JKT48Connect (playlist bertiket, tanpa API key). */
function playbackUrl(v: unknown): string {
  const u = httpUrl(v);
  if (!u) return "";
  const host = new URL(u).hostname;
  return u.startsWith("https://") && (host === "jkt48connect.app" || host.endsWith(".jkt48connect.app")) ? u : "";
}

export function shapeVideos(raw: unknown): Video[] {
  return list(raw)
    .map((v) => {
      const id = /^[A-Za-z0-9_-]{6,20}$/.test(str(v.id)) ? str(v.id) : "";
      return {
        id,
        title: str(v.title),
        url: httpUrl(v.url, id && `https://www.youtube.com/watch?v=${id}`),
        date: str(v.date),
        thumbnail: httpUrl(v.thumbnails?.high?.url, id && `https://i.ytimg.com/vi/${id}/hqdefault.jpg`),
        channel: str(v.channelTitle, "JKT48"),
        views: num(v.statistics?.viewCount),
        playable: v.playback?.format === "m3u8" && !!playbackUrl(v.playback?.url),
      };
    })
    .filter((v) => v.url);
}

export type VideoPlayback = { url: string; qualities: number[]; expiresAt: number | null };
export type VideoDetail = Video & { description: string; duration: number | null; comments: number | null; playback: VideoPlayback | null };

/** Detail video: `playback.url` = playlist HLS bertiket (± 3 jam), audio dan video dalam segmen yang sama. */
export function shapeVideo(v: Raw, id: string): VideoDetail {
  const vid = YT_ID.test(str(v.id)) ? str(v.id) : id;
  const url = v.playback?.format === "m3u8" ? playbackUrl(v.playback?.url) : "";
  return {
    id: vid,
    title: str(v.title),
    url: httpUrl(v.url, `https://www.youtube.com/watch?v=${vid}`),
    date: str(v.date, v.published_at, v.upload_date),
    thumbnail: httpUrl(v.thumbnail, `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`),
    channel: str(v.channel_title, v.channelTitle, "JKT48"),
    views: num(v.view_count, v.statistics?.viewCount),
    playable: !!url,
    description: str(v.description).slice(0, 4000),
    duration: num(v.duration),
    comments: num(v.comment_count),
    playback: url
      ? {
          url,
          qualities: (Array.isArray(v.playback?.qualities) ? (v.playback.qualities as unknown[]) : []).map((q) => num(q)).filter((q): q is number => q !== null),
          expiresAt: num(v.playback?.expires_at),
        }
      : null,
  };
}

export type VideoComment = { id: string; text: string; author: string; avatar: string; uploader: boolean; when: string; likes: number | null; replies: number | null };
export type VideoComments = { status: string; total: number | null; items: VideoComment[]; cursor: string; hasMore: boolean };

export function shapeVideoComments(raw: Raw): VideoComments {
  return {
    status: str(raw?.status, "available"),
    total: num(raw?.total_count),
    items: list(raw?.comments)
      .map((c) => ({
        id: str(c.id),
        text: str(c.text).slice(0, 2000),
        author: str(c.author?.name),
        avatar: httpUrl(c.author?.avatar),
        uploader: c.author?.is_uploader === true,
        when: str(c.published_text),
        likes: num(c.likes),
        replies: num(c.reply_count),
      }))
      .filter((c) => c.id && c.text),
    cursor: /^[A-Za-z0-9_.=~-]{1,500}$/.test(str(raw?.next_cursor)) ? str(raw.next_cursor) : "",
    hasMore: raw?.has_more === true,
  };
}

/* ───────────────────────────── Sosial media member (X, TikTok, Instagram) ───────────────────────────── */

export type SocialPlatform = "x" | "tiktok" | "instagram";
export type SocialMedia = { type: "image" | "video"; url: string; thumb: string; width: number | null; height: number | null };
export type SocialPost = {
  platform: SocialPlatform;
  id: string;
  url: string;
  text: string;
  /** Waktu unggah; bila sumber tidak memberikannya, waktu pertama kali terlihat (`dateApprox`). */
  date: string;
  dateApprox: boolean;
  member: { id: string; name: string; img: string };
  author: { username: string; name: string; avatar: string };
  likes: number | null;
  comments: number | null;
  reposts: number | null;
  views: number | null;
  media: SocialMedia[];
};
export type SocialPage = { items: SocialPost[]; cursor: string; hasMore: boolean };

/** Media arsip R2 (`{status, url}`) yang sudah siap. */
function ready(m: Raw | null | undefined): string {
  return m?.status === "ready" ? httpUrl(m.url) : "";
}

function socialPage(raw: Raw, key: string, map: (p: Raw) => SocialPost): SocialPage {
  return {
    items: list(raw, key)
      .map(map)
      .filter((p) => p.id && p.url),
    cursor: /^\d{1,25}$/.test(str(raw?.next_cursor)) ? str(raw.next_cursor) : "",
    hasMore: raw?.has_more === true,
  };
}

const digits = (v: unknown) => (/^\d{1,25}$/.test(str(v)) ? str(v) : "");

export function shapeTweets(raw: Raw): SocialPage {
  return socialPage(raw, "tweets", (t) => {
    const m: Raw = t.member ?? {};
    return {
      platform: "x",
      id: digits(t.id),
      url: httpUrl(t.url),
      text: str(t.text).slice(0, 4000),
      date: str(t.created_at, t.first_seen_at),
      dateApprox: !str(t.created_at),
      member: { id: str(m.id), name: str(m.name, t.author?.name), img: httpUrl(m.img) },
      // Avatar `_normal` X berukuran 48 px; varian 200 px lebih tajam di layar HP.
      author: { username: str(t.author?.username), name: str(t.author?.name), avatar: httpUrl(t.author?.avatar).replace("_normal.", "_200x200.") },
      likes: num(t.metrics?.likes),
      comments: num(t.metrics?.replies),
      reposts: num(t.metrics?.reposts),
      views: num(t.metrics?.views),
      media: list(t.media)
        .map((x): SocialMedia | null => {
          const thumb = httpUrl(x.url);
          if (x.type === "photo") return thumb ? { type: "image", url: thumb, thumb, width: null, height: null } : null;
          // Video/GIF: MP4 progresif bitrate tertinggi yang masih ringan untuk HP (≤ 2,5 Mbps).
          const mp4 = list(x.variants)
            .filter((v) => v.content_type === "video/mp4" && httpUrl(v.url))
            .sort((a, b) => (num(b.bitrate) ?? 0) - (num(a.bitrate) ?? 0));
          const pick = mp4.find((v) => (num(v.bitrate) ?? 0) <= 2_500_000) ?? mp4[mp4.length - 1];
          return pick ? { type: "video", url: httpUrl(pick.url), thumb, width: null, height: null } : null;
        })
        .filter((x): x is SocialMedia => !!x),
    };
  });
}

export function shapeTiktokPosts(raw: Raw): SocialPage {
  return socialPage(raw, "posts", (p) => {
    const md: Raw = p.media ?? {};
    const thumb = ready(md.thumbnail);
    const video = ready(md.video);
    const images = list(md.images).map(ready).filter(Boolean);
    return {
      platform: "tiktok",
      id: digits(p.id),
      url: httpUrl(p.url),
      text: str(p.text).slice(0, 4000),
      date: str(p.created_at, p.first_seen_at),
      dateApprox: !str(p.created_at),
      member: { id: str(p.member?.member), name: str(p.member?.name, p.author?.name), img: "" },
      author: { username: str(p.author?.username), name: str(p.author?.name), avatar: "" },
      likes: num(p.metrics?.likes),
      comments: num(p.metrics?.comments),
      reposts: num(p.metrics?.shares),
      views: num(p.metrics?.views),
      media: video
        ? [{ type: "video", url: video, thumb, width: num(md.width), height: num(md.height) }]
        : images.length
          ? images.map((u) => ({ type: "image" as const, url: u, thumb: u, width: null, height: null }))
          : thumb
            ? [{ type: "image", url: thumb, thumb, width: num(md.width), height: num(md.height) }]
            : [],
    };
  });
}

export function shapeInstagramPosts(raw: Raw): SocialPage {
  return socialPage(raw, "posts", (p) => {
    const md: Raw = p.media ?? {};
    const thumb = ready(md.thumbnail);
    const video = ready(md.video);
    let media: SocialMedia[] = list(md.items)
      .map((it): SocialMedia | null => {
        const t = ready(it.thumbnail);
        const v = ready(it.video);
        if (it.type === "video" && v) return { type: "video", url: v, thumb: t, width: num(it.width), height: num(it.height) };
        return t ? { type: "image", url: t, thumb: t, width: num(it.width), height: num(it.height) } : null;
      })
      .filter((x): x is SocialMedia => !!x);
    if (!media.length && video) media = [{ type: "video", url: video, thumb, width: num(md.width), height: num(md.height) }];
    if (!media.length) media = list(md.images).map(ready).filter(Boolean).map((u) => ({ type: "image", url: u, thumb: u, width: null, height: null }));
    if (!media.length && thumb) media = [{ type: "image", url: thumb, thumb, width: num(md.width), height: num(md.height) }];
    return {
      platform: "instagram",
      id: digits(p.id),
      url: httpUrl(p.url),
      text: str(p.text).slice(0, 4000),
      date: str(p.created_at, p.first_seen_at),
      dateApprox: !str(p.created_at),
      member: { id: str(p.member?.member), name: str(p.member?.name, p.author?.name), img: "" },
      author: { username: str(p.author?.username), name: str(p.author?.name), avatar: "" },
      likes: num(p.metrics?.likes),
      comments: num(p.metrics?.comments),
      reposts: null,
      views: num(p.metrics?.views),
      media,
    };
  });
}
