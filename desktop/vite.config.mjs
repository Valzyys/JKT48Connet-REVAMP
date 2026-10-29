import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// UI aplikasi desktop (renderer). Hasil build masuk ui/app dan dimuat main process lewat app://jkc/.
export default defineConfig({
  root: r("./renderer"),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": r("./renderer/src"),
      // Tipe data & format yang sama dengan situs (file murni, tanpa DOM/fetch).
      "@shared": r("../src/lib"),
    },
  },
  build: {
    outDir: r("./ui/app"),
    emptyOutDir: true,
    target: "chrome130",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
});
