import {handleGames,type GamesEnv} from "../../worker/games/api";
// Cloudflare Pages Function: semua request /api/* diteruskan lewat proxy yang sama dengan Workers.
import { handleApi, type ProxyEnv } from "../../worker/proxy";

import { handleDiscord, type DiscordEnv } from "../../worker/discord";
import { handlePm, type PmEnv } from "../../worker/pm";

export const onRequest: PagesFunction<ProxyEnv & PmEnv & DiscordEnv & GamesEnv> = (context) => {
  const path = new URL(context.request.url).pathname;
  if(path.startsWith("/api/games/")) return handleGames(context.request,context.env);
  if(path.startsWith("/api/discord/")) return handleDiscord(context.request, context.env);
  return path === "/api/pm" || path.startsWith("/api/pm/")
    ? handlePm(context.request, context.env)
    : handleApi(context.request, context.env, context);
};
