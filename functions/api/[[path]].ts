// Cloudflare Pages Function: semua request /api/* diteruskan lewat proxy yang sama dengan Workers.
import { handleApi, type ProxyEnv } from "../../worker/proxy";

import { handlePm, type PmEnv } from "../../worker/pm";

export const onRequest: PagesFunction<ProxyEnv & PmEnv> = (context) => {
  const path = new URL(context.request.url).pathname;
  return path === "/api/pm" || path.startsWith("/api/pm/")
    ? handlePm(context.request, context.env)
    : handleApi(context.request, context.env, context);
};
