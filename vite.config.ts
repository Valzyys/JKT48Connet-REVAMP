import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { HttpsProxyAgent } from "https-proxy-agent";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

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

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...devVars() };
  const upstream = env.API_UPSTREAM || "https://api.jkt48connect.app";
  const key = env.JKT48CONNECT_API_KEY ?? "";

  // Di balik proxy keluar (kantor/CI), request ke upstream lewat HTTPS_PROXY.
  const outbound = process.env.HTTPS_PROXY || process.env.https_proxy;

  // Proxy lokal meniru worker/proxy.ts: key ditambahkan di server dev, bukan di browser.
  const proxy = {
    "/api": {
      target: upstream,
      changeOrigin: true,
      headers: key ? { "X-API-Key": key } : {},
      agent: outbound ? new HttpsProxyAgent(outbound) : undefined,
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { proxy },
    preview: { proxy },
  };
});
