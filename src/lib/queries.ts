import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import * as api from "./jkt48";
import type { Member } from "./jkt48";

const MEMBERS_KEY = "jkt48c:members-v1";

/** Daftar member (data publik: nama, nickname, foto) disimpan di localStorage untuk kunjungan berikutnya. */
function loadMembers(): Member[] | undefined {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    const list = raw ? (JSON.parse(raw) as Member[]) : undefined;
    return Array.isArray(list) && list.length ? list : undefined;
  } catch {
    return undefined;
  }
}

function saveMembers(list: Member[]) {
  try {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* storage penuh/diblokir: tetap jalan tanpa salinan */
  }
  return list;
}

/** Satu sumber query key & interval refetch, supaya halaman yang berbagi data berbagi cache. */
export const q = {
  live: () => queryOptions({ queryKey: ["live"], queryFn: api.getLive, refetchInterval: 60_000, staleTime: 20_000 }),
  members: () =>
    queryOptions({
      queryKey: ["members"],
      queryFn: async () => saveMembers(await api.getMembers()),
      staleTime: 30 * 60_000,
      // Salinan terakhir dari perangkat ini: intro & sidebar langsung punya foto, lalu data segar dimuat di belakang.
      initialData: loadMembers,
      initialDataUpdatedAt: 0,
    }),
  member: (id: string) => queryOptions({ queryKey: ["member", id], queryFn: () => api.getMember(id) }),
  theaterList: (page: number, perpage = 12) =>
    queryOptions({
      queryKey: ["theater", page, perpage],
      queryFn: () => api.getTheaterList(page, perpage),
      placeholderData: keepPreviousData,
    }),
  theater: (id: string) => queryOptions({ queryKey: ["theater-detail", id], queryFn: () => api.getTheater(id) }),
  nextSchedule: () => queryOptions({ queryKey: ["next-schedule"], queryFn: api.getNextSchedule }),
  newsList: (page: number, perpage = 10) =>
    queryOptions({
      queryKey: ["news", page, perpage],
      queryFn: () => api.getNewsList(page, perpage),
      placeholderData: keepPreviousData,
    }),
  news: (id: string) => queryOptions({ queryKey: ["news-detail", id], queryFn: () => api.getNews(id) }),
  birthdays: () => queryOptions({ queryKey: ["birthdays"], queryFn: api.getBirthdays, staleTime: 60 * 60_000 }),
  recentList: (page: number, perpage = 12) =>
    queryOptions({
      queryKey: ["recent", page, perpage],
      queryFn: () => api.getRecentList(page, perpage),
      placeholderData: keepPreviousData,
    }),
  recent: (id: string) => queryOptions({ queryKey: ["recent-detail", id], queryFn: () => api.getRecent(id) }),
  videos: () => queryOptions({ queryKey: ["videos"], queryFn: api.getVideos, staleTime: 3 * 60_000 }),
};
