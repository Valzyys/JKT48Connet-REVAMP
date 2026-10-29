import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
  BirthdayEntry,
  LiveComments,
  LiveSession,
  Member,
  MemberDetail,
  NewsDetail,
  NewsItem,
  Paged,
  RecentDetail,
  RecentLive,
  SocialPage,
  SocialPlatform,
  TheaterDetail,
  TheaterShow,
  Video,
  VideoComments,
  VideoDetail,
} from "@shared/shape";
import { call } from "./bridge";

export type * from "@shared/shape";

const enc = encodeURIComponent;

function paged<T>(key: string, path: string, perpage: number) {
  return infiniteQueryOptions({
    queryKey: [key],
    queryFn: ({ pageParam }) => call<Paged<T>>(`${path}?page=${pageParam}&perpage=${perpage}`),
    initialPageParam: 1,
    getNextPageParam: (last: Paged<T>) => (last.page * last.perpage < last.total && last.items.length ? last.page + 1 : undefined),
  });
}

export type Birthday = BirthdayEntry & { next: Date; age: number };

/** Ulang tahun berikutnya dalam tanggal WIB (birthdate API = 17:00Z hari sebelumnya), sama dengan situs. */
function withNext(b: BirthdayEntry): Birthday {
  const wib = new Date(new Date(b.birthdate).getTime() + 7 * 3600_000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), wib.getUTCMonth(), wib.getUTCDate());
  if (next < today) next = new Date(now.getFullYear() + 1, wib.getUTCMonth(), wib.getUTCDate());
  return { ...b, next, age: next.getFullYear() - wib.getUTCFullYear() };
}

export const q = {
  live: () => queryOptions({ queryKey: ["live"], queryFn: () => call<LiveSession[]>("/now_live"), refetchInterval: 30_000 }),
  liveComments: (room: string) =>
    queryOptions({ queryKey: ["live-comments", room], queryFn: () => call<LiveComments>(`/showroom-comments/${room}`, true), refetchInterval: 3000, staleTime: 0, enabled: !!room }),
  members: () => queryOptions({ queryKey: ["members"], queryFn: () => call<Member[]>("/member"), staleTime: 30 * 60_000 }),
  member: (id: string) => queryOptions({ queryKey: ["member", id], queryFn: () => call<MemberDetail>(`/member/${enc(id)}`) }),
  nextSchedule: () => queryOptions({ queryKey: ["next_schedule"], queryFn: () => call<TheaterShow[]>("/next_schedule"), staleTime: 5 * 60_000 }),
  theaterList: () => paged<TheaterShow>("theater", "/theater", 12),
  theater: (id: string) => queryOptions({ queryKey: ["theater", id], queryFn: () => call<TheaterDetail>(`/theater/${enc(id)}`) }),
  recentList: () => paged<RecentLive>("recent", "/recent", 12),
  recent: (id: string) => queryOptions({ queryKey: ["recent", id], queryFn: () => call<RecentDetail>(`/recent/${enc(id)}`) }),
  newsList: () => paged<NewsItem>("news", "/news", 10),
  news: (id: string) => queryOptions({ queryKey: ["news", id], queryFn: () => call<NewsDetail>(`/news/${enc(id)}`) }),
  birthdays: () =>
    queryOptions({
      queryKey: ["birthdays"],
      queryFn: async () => (await call<BirthdayEntry[]>("/next_birthday")).map(withNext).sort((a, b) => a.next.getTime() - b.next.getTime()),
      staleTime: 60 * 60_000,
    }),
  videos: () => queryOptions({ queryKey: ["videos"], queryFn: () => call<Video[]>("/jkt48_youtube"), staleTime: 3 * 60_000 }),
  video: (id: string) => queryOptions({ queryKey: ["video", id], queryFn: () => call<VideoDetail>(`/jkt48_youtube/${enc(id)}`) }),
  videoComments: (id: string) =>
    infiniteQueryOptions({
      queryKey: ["video-comments", id],
      queryFn: ({ pageParam }) => call<VideoComments>(`/jkt48_youtube/${enc(id)}/comments${pageParam ? `?cursor=${enc(pageParam)}` : ""}`),
      initialPageParam: "",
      getNextPageParam: (last: VideoComments) => (last.hasMore && last.cursor ? last.cursor : undefined),
    }),
  social: (platform: SocialPlatform, member: string) =>
    infiniteQueryOptions({
      queryKey: ["social", platform, member],
      queryFn: ({ pageParam }) => {
        const path = { x: "/x/tweets", tiktok: "/tiktok/posts", instagram: "/instagram/posts" }[platform];
        const qs = [member && `member=${enc(member)}`, pageParam && `before=${enc(pageParam)}`].filter(Boolean).join("&");
        return call<SocialPage>(`${path}${qs ? `?${qs}` : ""}`);
      },
      initialPageParam: "",
      getNextPageParam: (last: SocialPage) => (last.hasMore && last.cursor ? last.cursor : undefined),
    }),
};

/** "idn_gold" → "Gold", "showroom_points" → "Poin". */
export const pointLabel = (unit: string) => (unit.includes("gold") ? "Gold" : "Poin");
export const platformLabel = (p: string) => (p === "showroom" ? "Showroom" : p === "idn" ? "IDN Live" : p || "Live");

/** Gambar jkt48.com (menolak hotlink) lewat proxy aplikasi; token disisipkan main process. */
export const mediaUrl = (u: string) => (u ? `https://jkt48connect.app/api/app/media?url=${enc(u)}` : "");
