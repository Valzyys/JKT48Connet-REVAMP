import { handleApi, type ProxyEnv } from "./proxy";

interface Env extends ProxyEnv {
  ASSETS: Fetcher;
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) return handleApi(request, env, ctx);
    // Selain /api, sajikan file statis hasil `vite build` (SPA fallback diatur di wrangler.jsonc).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
