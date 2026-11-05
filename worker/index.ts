import {activityDocument} from "./games/document";
import {handleGames,type GamesEnv} from "./games/api";
export {GameRoom} from "./games/room";
import { handleDiscord, type DiscordEnv } from "./discord";
import { handleApi, type ProxyEnv } from "./proxy";
import { handleStreamDownload, STREAM_DOWNLOAD } from "./download";

export { Guard } from "./guard-do";
export { PushState } from "./push-do";
import type { PushState } from "./push-do";

import { handlePm, type PmEnv } from "./pm";
import { handleDonasika, reconcileDonasika } from "./donasika";
import type { DonasikaEnv } from "./donasika-gateway";
import { handleLlms, handleNotFound, handlePage, handleRobots, handleSecurityTxt, handleSitemap, isPage, isSpaRoute, siteOrigin, type SeoEnv } from "./seo";
import { handleImg, IMG_PATH } from "./img";
import { handleAi, type AiEnv } from "./ai";

interface Env extends ProxyEnv, PmEnv, SeoEnv, DiscordEnv, GamesEnv, DonasikaEnv, AiEnv {
  ASSETS: Fetcher;
  PUSH?: DurableObjectNamespace<PushState>;
}

export default {
  async fetch(request, env, ctx) {
    const activityUrl=new URL(request.url);
    const { pathname } = activityUrl;
    // Satu host saja di indeks: www.jkt48connect.app → jkt48connect.app (301).
    if (activityUrl.hostname.startsWith("www.") && (request.method === "GET" || request.method === "HEAD"))
      return Response.redirect(`https://${activityUrl.hostname.slice(4)}${pathname}${activityUrl.search}`, 301);
    if (pathname === "/api/donasika" || pathname.startsWith("/api/donasika/")) return handleDonasika(request, env);
    if((request.method==="GET"||request.method==="HEAD")&&(pathname==="/activity"||pathname==="/activity/"||pathname==="/"&&activityUrl.searchParams.has("frame_id")))return activityDocument(request,env.ASSETS,env.DISCORD_CLIENT_ID||"1305141693477027891");
    if (pathname.startsWith("/api/games/")) return handleGames(request,env);
    // Obrolan AI (worker/ai.ts): key gateway hanya di Worker.
    if (pathname.startsWith("/api/ai/")) return handleAi(request, env, ctx);
    if (pathname.startsWith("/api/discord/")) return handleDiscord(request, env);
    if (pathname === "/api/pm" || pathname.startsWith("/api/pm/"))
      return handlePm(request, env);
    if (pathname.startsWith("/api/")) return handleApi(request, env, ctx);
    // Unduhan langsung APK JKT48Connect Stream dari rilis GitHub terbaru (worker/download.ts).
    if (STREAM_DOWNLOAD.test(pathname)) return handleStreamDownload(request, env, ctx);
    // SEO (worker/seo.ts): robots, sitemap, dan meta per halaman di HTML awal.
    if (pathname === "/robots.txt") return handleRobots(request, env);
    if (pathname === "/llms.txt") return handleLlms(request, env);
    if (pathname === "/.well-known/security.txt") return handleSecurityTxt(request, env);
    if (pathname === IMG_PATH && (request.method === "GET" || request.method === "HEAD")) return handleImg(request);
    if (pathname === "/sitemap.xml") return handleSitemap(request, env, ctx);
    if (request.method === "GET" || request.method === "HEAD") {
      // "/member/" → "/member": satu URL per halaman (tidak ada duplikat di indeks).
      if (pathname.length > 1 && pathname.endsWith("/") && isPage(pathname.slice(0, -1))) {
        const { search } = new URL(request.url);
        return Response.redirect(`${siteOrigin(request, env)}${pathname.slice(0, -1)}${search}`, 301);
      }
      if (isPage(pathname)) return handlePage(request, env, ctx);
      // "/MEMBER" → "/member": varian huruf besar bukan URL terpisah.
      const lower = pathname.toLowerCase();
      if (lower !== pathname && (isPage(lower) || isSpaRoute(lower))) return Response.redirect(`${siteOrigin(request, env)}${lower}${activityUrl.search}`, 301);
      // Bukan halaman & bukan rute SPA: file statis bila ada, selain itu 404 sungguhan (bukan shell SPA 200).
      if (!isSpaRoute(pathname) && !pathname.startsWith("/cdn-cgi/")) {
        const asset = await env.ASSETS.fetch(request);
        const isShell = (asset.headers.get("content-type") ?? "").includes("text/html") && !pathname.endsWith(".html");
        if (!isShell) return asset;
        return handleNotFound(request, env);
      }
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
