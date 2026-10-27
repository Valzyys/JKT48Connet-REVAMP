import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { RootLayout } from "@/components/root-layout";
import { NotFound } from "@/pages/not-found";

/** `?page=2` → 2, nilai tidak valid → 1. */
const pageSearch = (s: Record<string, unknown>): { page?: number } => {
  const n = Number(s.page);
  return Number.isInteger(n) && n > 1 ? { page: n } : {};
};

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});
const parent = () => rootRoute;

// Setiap halaman di-load terpisah (code splitting) supaya bundle awal tetap ringan.

const homeRoute = createRoute({
  getParentRoute: parent,
  path: "/",
  component: lazyRouteComponent(() => import("@/pages/home"), "HomePage"),
});

const liveRoute = createRoute({
  getParentRoute: parent,
  path: "/live",
  component: lazyRouteComponent(() => import("@/pages/live"), "LivePage"),
});

const theaterRoute = createRoute({
  getParentRoute: parent,
  path: "/theater",
  validateSearch: pageSearch,
  component: lazyRouteComponent(() => import("@/pages/theater"), "TheaterPage"),
});

const theaterDetailRoute = createRoute({
  getParentRoute: parent,
  path: "/theater/$id",
  component: lazyRouteComponent(
    () => import("@/pages/theater-detail"),
    "TheaterDetailPage",
  ),
});

const scheduleRoute = createRoute({
  getParentRoute: parent,
  path: "/schedule",
  component: lazyRouteComponent(
    () => import("@/pages/schedule"),
    "SchedulePage",
  ),
});

const membersRoute = createRoute({
  getParentRoute: parent,
  path: "/member",
  component: lazyRouteComponent(() => import("@/pages/members"), "MembersPage"),
});

const memberDetailRoute = createRoute({
  getParentRoute: parent,
  path: "/member/$id",
  component: lazyRouteComponent(
    () => import("@/pages/member-detail"),
    "MemberDetailPage",
  ),
});

const birthdayRoute = createRoute({
  getParentRoute: parent,
  path: "/birthday",
  component: lazyRouteComponent(
    () => import("@/pages/birthday"),
    "BirthdayPage",
  ),
});

const recentRoute = createRoute({
  getParentRoute: parent,
  path: "/recent",
  validateSearch: pageSearch,
  component: lazyRouteComponent(() => import("@/pages/recent"), "RecentPage"),
});

const recentDetailRoute = createRoute({
  getParentRoute: parent,
  path: "/recent/$id",
  component: lazyRouteComponent(
    () => import("@/pages/recent-detail"),
    "RecentDetailPage",
  ),
});

const newsRoute = createRoute({
  getParentRoute: parent,
  path: "/news",
  validateSearch: pageSearch,
  component: lazyRouteComponent(() => import("@/pages/news"), "NewsPage"),
});

const newsDetailRoute = createRoute({
  getParentRoute: parent,
  path: "/news/$id",
  component: lazyRouteComponent(
    () => import("@/pages/news-detail"),
    "NewsDetailPage",
  ),
});

const videoRoute = createRoute({
  getParentRoute: parent,
  path: "/video",
  component: lazyRouteComponent(() => import("@/pages/video"), "VideoPage"),
});

const developerRoute = createRoute({
  getParentRoute: parent,
  path: "/developer",
  component: lazyRouteComponent(
    () => import("@/pages/developer"),
    "DeveloperPage",
  ),
});

const aboutRoute = createRoute({
  getParentRoute: parent,
  path: "/about",
  component: lazyRouteComponent(() => import("@/pages/about"), "AboutPage"),
});

const disclaimerRoute = createRoute({
  getParentRoute: parent,
  path: "/disclaimer",
  component: lazyRouteComponent(
    () => import("@/pages/legal"),
    "DisclaimerPage",
  ),
});

const termsRoute = createRoute({
  getParentRoute: parent,
  path: "/terms",
  component: lazyRouteComponent(() => import("@/pages/legal"), "TermsPage"),
});

const privacyRoute = createRoute({
  getParentRoute: parent,
  path: "/privacy",
  component: lazyRouteComponent(() => import("@/pages/legal"), "PrivacyPage"),
});

const pmRoutes = [
  "/pm",
  "/pm/login",
  "/pm/register",
  "/pm/shop",
  "/pm/account",
  "/pm/transactions",
  "/pm/chat/$slug",
  "/pm/pay/$id",
].map((path) =>
  createRoute({
    getParentRoute: parent,
    path,
    component: lazyRouteComponent(() => import("@/pages/pm"), "PmPage"),
  }),
);

const gamesRoute=createRoute({getParentRoute:parent,path:"/games",component:lazyRouteComponent(()=>import("@/pages/games"),"GamesPage")});
const activityRoute=createRoute({getParentRoute:parent,path:"/activity",component:lazyRouteComponent(()=>import("@/pages/games"),"GamesPage")});
const discordRoute=createRoute({getParentRoute:parent,path:"/discord",component:lazyRouteComponent(()=>import("@/pages/discord"),"DiscordPage")});
const discordGuildRoute=createRoute({getParentRoute:parent,path:"/discord/$guild",component:lazyRouteComponent(()=>import("@/pages/discord"),"DiscordPage")});

const appsRoute = createRoute({
  getParentRoute: parent,
  path: "/apps",
  component: lazyRouteComponent(() => import("@/pages/apps"), "AppsPage"),
});

const routeTree = rootRoute.addChildren([
  appsRoute,
  gamesRoute,activityRoute,
  discordRoute,
  discordGuildRoute,
  ...pmRoutes,
  homeRoute,
  liveRoute,
  theaterRoute,
  theaterDetailRoute,
  scheduleRoute,
  membersRoute,
  memberDetailRoute,
  birthdayRoute,
  recentRoute,
  recentDetailRoute,
  newsRoute,
  newsDetailRoute,
  videoRoute,
  developerRoute,
  aboutRoute,
  disclaimerRoute,
  termsRoute,
  privacyRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
