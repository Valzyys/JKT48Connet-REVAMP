import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { HttpsProxyAgent } from "https-proxy-agent";
import { readFileSync } from "node:fs";
import https from "node:https";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath, URL } from "node:url";
import { handleApi, type ProxyEnv } from "./worker/proxy";

/** Baca `.dev.vars` (format KEY=VALUE, sama dengan yang dipakai wrangler). */
function devVars(): Record<string, string> {
  try {
    const text = readFileSync(new URL("./.dev.vars", import.meta.url), "utf8");
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

/** fetch untuk Node yang lewat proxy keluar (kantor/CI); fetch bawaan Node 22 mengabaikan HTTPS_PROXY. */
function proxiedFetch(agent: HttpsProxyAgent<string>): typeof fetch {
  return ((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    if (url.protocol !== "https:") return fetch(input, init);
    return new Promise<Response>((resolve, reject) => {
      const req = https.request(url, { method: init.method ?? "GET", headers: Object.fromEntries(new Headers(init.headers)), agent }, (res) => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
        const status = res.statusCode ?? 502;
        const empty = [101, 204, 205, 304].includes(status) || init.method === "HEAD";
        resolve(new Response(empty ? null : (Readable.toWeb(res) as ReadableStream), { status, headers }));
      });
      req.on("error", reject);
      req.end();
    });
  }) as typeof fetch;
}

/**
 * Dev/preview server menjalankan worker/proxy.ts yang SAMA dengan produksi (sesi, allowlist,
 * normalisasi, kunci replay), bukan meneruskan request mentah ke upstream.
 */
function apiPlugin(env: ProxyEnv): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/api/")) return next();
    (async () => {
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined && !k.startsWith(":")) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
      let body: Uint8Array<ArrayBuffer> | undefined;
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        body = new Uint8Array(Buffer.concat(chunks));
      }
      const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, { method: req.method, headers, body });
      const response = await handleApi(request, env, { waitUntil: () => {} });
      res.statusCode = response.status;
      response.headers.forEach((v, k) => k !== "set-cookie" && res.setHeader(k, v));
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader("set-cookie", cookies);
      if (response.body && req.method !== "HEAD") Readable.fromWeb(response.body as NodeReadableStream).pipe(res);
      else res.end();
    })().catch(next);
  };
  return {
    name: "jkt48connect-api",
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...devVars() };

  // Di balik proxy keluar (kantor/CI), request ke upstream lewat HTTPS_PROXY.
  const outbound = process.env.HTTPS_PROXY || process.env.https_proxy;

  const apiEnv: ProxyEnv = {
    JKT48CONNECT_API_KEY: env.JKT48CONNECT_API_KEY,
    SESSION_SECRET: env.SESSION_SECRET,
    TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
    GUARD_ADMIN_TOKEN: env.GUARD_ADMIN_TOKEN,
    GUARD_EPOCH: env.GUARD_EPOCH,
    GUARD_DISABLED: env.GUARD_DISABLED,
    API_UPSTREAM: env.API_UPSTREAM || "https://api.jkt48connect.app",
    UPSTREAM_FETCH: outbound ? proxiedFetch(new HttpsProxyAgent(outbound)) : undefined,
  };

  return {
    plugins: [react(), tailwindcss(), apiPlugin(apiEnv)],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  };
});
