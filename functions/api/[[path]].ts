// Cloudflare Pages Function: semua request /api/* diteruskan lewat proxy yang sama dengan Workers.
import { handleApi, type ProxyEnv } from "../../worker/proxy";

export const onRequest: PagesFunction<ProxyEnv> = (context) => handleApi(context.request, context.env, context);
