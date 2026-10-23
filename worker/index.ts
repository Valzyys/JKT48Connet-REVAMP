import { handleApi, type ProxyEnv } from "./proxy";

export { Guard } from "./guard-do";
export { PushState } from "./push-do";
import type { PushState } from "./push-do";

import { handlePm, type PmEnv } from "./pm";

interface Env extends ProxyEnv, PmEnv {
  ASSETS: Fetcher;
  PUSH?: DurableObjectNamespace<PushState>;
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/pm" || pathname.startsWith("/api/pm/"))
      return handlePm(request, env);
    if (pathname.startsWith("/api/")) return handleApi(request, env, ctx);
    // Selain /api, sajikan file statis hasil `vite build` (SPA fallback diatur di wrangler.jsonc).
    return env.ASSETS.fetch(request);
  },
  // Cron (wrangler.jsonc → triggers.crons): jadwal/ultah/berita/update + menyalakan alarm live 15 detik (worker/push-do.ts).
  async scheduled(controller, env, ctx) {
    if (!env.PUSH || !env.FCM_SERVICE_ACCOUNT) return;
    ctx.waitUntil(env.PUSH.get(env.PUSH.idFromName("main")).tick(controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
