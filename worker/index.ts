import {activityDocument} from "./games/document";
import {handleGames,type GamesEnv} from "./games/api";
export {GameRoom} from "./games/room";
import { handleDiscord, type DiscordEnv } from "./discord";
import { handleApi, type ProxyEnv } from "./proxy";

export { Guard } from "./guard-do";
export { PushState } from "./push-do";
import type { PushState } from "./push-do";

import { handlePm, type PmEnv } from "./pm";
import { handleDonasika, reconcileDonasika } from "./donasika";
import type { DonasikaEnv } from "./donasika-gateway";
import { handlePage, handleRobots, handleSitemap, isPage, siteOrigin, type SeoEnv } from "./seo";

interface Env extends ProxyEnv, PmEnv, SeoEnv, DiscordEnv, GamesEnv, DonasikaEnv {
  ASSETS: Fetcher;
  PUSH?: DurableObjectNamespace<PushState>;
}

export default {
  async fetch(request, env, ctx) {
    const activityUrl=new URL(request.url);
    const { pathname } = activityUrl;
    if (pathname === "/api/donasika" || pathname.startsWith("/api/donasika/")) return handleDonasika(request, env);
    if((request.method==="GET"||request.method==="HEAD")&&(pathname==="/activity"||pathname==="/activity/"||pathname==="/"&&activityUrl.searchParams.has("frame_id")))return activityDocument(request,env.ASSETS,env.DISCORD_CLIENT_ID||"1305141693477027891");
    if (pathname.startsWith("/api/games/")) return handleGames(request,env);
    if (pathname.startsWith("/api/discord/")) return handleDiscord(request, env);
    if (pathname === "/api/pm" || pathname.startsWith("/api/pm/"))
      return handlePm(request, env);
    if (pathname.startsWith("/api/")) return handleApi(request, env, ctx);
    // SEO (worker/seo.ts): robots, sitemap, dan meta per halaman di HTML awal.
    if (pathname === "/robots.txt") return handleRobots(request, env);
    if (pathname === "/sitemap.xml") return handleSitemap(request, env, ctx);
    if (request.method === "GET" || request.method === "HEAD") {
      // "/member/" → "/member": satu URL per halaman (tidak ada duplikat di indeks).
      if (pathname.length > 1 && pathname.endsWith("/") && isPage(pathname.slice(0, -1))) {
        const { search } = new URL(request.url);
        return Response.redirect(`${siteOrigin(request, env)}${pathname.slice(0, -1)}${search}`, 301);
      }
      if (isPage(pathname)) return handlePage(request, env, ctx);
    }
    // Selain /api, sajikan file statis hasil `vite build` (SPA fallback diatur di wrangler.jsonc).
    return env.ASSETS.fetch(request);
  },
  // Cron (wrangler.jsonc → triggers.crons): jadwal/ultah/berita/update + menyalakan alarm live 15 detik (worker/push-do.ts).
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(reconcileDonasika(env));
    if (!env.PUSH || !env.FCM_SERVICE_ACCOUNT) return;
    ctx.waitUntil(env.PUSH.get(env.PUSH.idFromName("main")).tick(controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
