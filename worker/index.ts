import { handleApi, type ProxyEnv } from "./proxy";

export { Guard } from "./guard-do";

import { handlePm, type PmEnv } from "./pm";

interface Env extends ProxyEnv, PmEnv {
  ASSETS: Fetcher;
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
} satisfies ExportedHandler<Env>;
