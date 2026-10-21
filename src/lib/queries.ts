import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import * as api from "./jkt48";

/** Satu sumber query key & interval refetch, supaya halaman yang berbagi data berbagi cache. */
export const q = {
  live: () => queryOptions({ queryKey: ["live"], queryFn: api.getLive, refetchInterval: 60_000, staleTime: 20_000 }),
  members: () => queryOptions({ queryKey: ["members"], queryFn: api.getMembers, staleTime: 30 * 60_000 }),
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
