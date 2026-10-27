import { apiGet } from "./api";
import type {
  BirthdayEntry,
  LiveSession,
  Member,
  MemberDetail,
  NewsDetail,
  NewsItem,
  Paged,
  RecentDetail,
  RecentLive,
  TheaterDetail,
  TheaterShow,
  Video,
} from "./shape";

/*
 * Pemanggil data untuk UI. Normalisasi respons upstream dilakukan di server (src/lib/shape.ts dipanggil
 * worker/proxy.ts), jadi browser hanya menerima field yang dipakai dan tidak pernah melihat JSON mentah API.
 */

export type {
  Fan,
  GiftSummary,
  LiveSession,
  Member,
  MemberDetail,
  NewsDetail,
  NewsItem,
  Paged,
  RecentDetail,
  RecentLive,
  Recording,
  Screenshot,
  ShowMember,
  TheaterDetail,
  TheaterShow,
  Video,
} from "./shape";
export { REPLAY_LOCK_HOURS } from "./shape";

export const getMembers = () => apiGet<Member[]>("/api/member");
export const getMember = (id: string) => apiGet<MemberDetail>(`/api/member/${encodeURIComponent(id)}`);
export const getLive = () => apiGet<LiveSession[]>("/api/now_live");

export const getTheaterList = (page = 1, perpage = 12) => apiGet<Paged<TheaterShow>>("/api/theater", { page, perpage });
export const getTheater = (id: string) => apiGet<TheaterDetail>(`/api/theater/${encodeURIComponent(id)}`);
export const getNextSchedule = () => apiGet<TheaterShow[]>("/api/next_schedule");

/** Rilis APK terbaru (GitHub Releases, lewat worker) untuk halaman /apps. */
export type IosRelease = { version: string; ipa: string; size: number; publishedAt: string };
export type AppRelease = { version: string; name: string; notes: string; page: string; apk: string; size: number; publishedAt: string; ios?: IosRelease | null };
export const getAppRelease = () => apiGet<AppRelease>("/api/app_release");

export const getNewsList = (page = 1, perpage = 10) => apiGet<Paged<NewsItem>>("/api/news", { page, perpage });
export const getNews = (id: string) => apiGet<NewsDetail>(`/api/news/${encodeURIComponent(id)}`);

export const getRecentList = (page = 1, perpage = 12) => apiGet<Paged<RecentLive>>("/api/recent", { page, perpage });
export const getRecent = (id: string) => apiGet<RecentDetail>(`/api/recent/${encodeURIComponent(id)}`);

export const getVideos = () => apiGet<Video[]>("/api/jkt48_youtube");

/* ───────────────────────────── Birthday ───────────────────────────── */

export type Birthday = BirthdayEntry & { next: Date; age: number };

/** Ulang tahun berikutnya dihitung dalam tanggal WIB (birthdate API = 17:00Z hari sebelumnya). */
function withNext(b: BirthdayEntry): Birthday {
  const wib = new Date(new Date(b.birthdate).getTime() + 7 * 3600_000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), wib.getUTCMonth(), wib.getUTCDate());
  if (next < today) next = new Date(now.getFullYear() + 1, wib.getUTCMonth(), wib.getUTCDate());
  return { ...b, next, age: next.getFullYear() - wib.getUTCFullYear() };
}

export async function getBirthdays(): Promise<Birthday[]> {
  return (await apiGet<BirthdayEntry[]>("/api/next_birthday")).map(withNext).sort((a, b) => a.next.getTime() - b.next.getTime());
}

/** "idn_gold" → "Gold", "showroom_points" → "Poin". */
export function pointLabel(unit: string) {
  return unit.includes("gold") ? "Gold" : "Poin";
}
