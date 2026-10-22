#!/usr/bin/env node
/**
 * Deploy + setup otomatis (dipakai Workers Builds, GitHub Actions, atau lokal):
 *   1. `wrangler deploy` — build Vite (build.command), upload Worker + aset, buat Durable Object `Guard`
 *      dan binding rate limit sesuai wrangler.jsonc. Tidak ada resource yang perlu dibuat manual.
 *   2. Pastikan secret Worker ada:
 *        JKT48CONNECT_API_KEY  ← dari env (wajib saat pertama kali; berikutnya tidak perlu)
 *        SESSION_SECRET        ← dibuat acak bila belum ada (TIDAK pernah ditimpa: menimpa = semua sesi batal)
 *        TURNSTILE_SECRET_KEY  ← dari env bila diisi
 *        GUARD_ADMIN_TOKEN     ← dari env bila diisi (≥ 24 karakter), untuk `npm run guard:unblock`
 *
 *   npm run deploy:auto
 *   JKT48CONNECT_API_KEY=jkc_… npm run deploy:auto
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const win = process.platform === "win32";
const run = (args, opts = {}) => spawnSync("npx", ["wrangler", ...args], { shell: win, encoding: "utf8", ...opts });

console.log("\n◆ JKT48Connect · deploy otomatis\n");

const deploy = run(["deploy"], { stdio: "inherit" });
if (deploy.status !== 0) {
  console.error("✗ wrangler deploy gagal");
  process.exit(deploy.status ?? 1);
}

const list = run(["secret", "list", "--format", "json"]);
let existing = new Set();
try {
  existing = new Set(JSON.parse(list.stdout).map((s) => s.name));
} catch {
  console.warn("! Tidak bisa membaca daftar secret (token tanpa izin?). Secret yang sudah ada tidak akan ditimpa.");
}

function put(name, value) {
  const r = run(["secret", "put", name], { input: value, stdio: ["pipe", "inherit", "inherit"] });
  if (r.status !== 0) {
    console.error(`✗ Gagal menyimpan secret ${name}`);
    process.exit(r.status ?? 1);
  }
  console.log(`✓ secret ${name} disimpan`);
}

const apiKey = process.env.JKT48CONNECT_API_KEY ?? "";
if (apiKey) {
  if (!/^jkc_[a-f0-9]{40}$/.test(apiKey)) {
    console.error("✗ JKT48CONNECT_API_KEY harus jkc_ + 40 karakter hex");
    process.exit(1);
  }
  put("JKT48CONNECT_API_KEY", apiKey);
} else if (!existing.has("JKT48CONNECT_API_KEY")) {
  console.warn("! JKT48CONNECT_API_KEY belum ada. Isi variabel env JKT48CONNECT_API_KEY lalu jalankan ulang, atau `npm run cf:secret`.");
}

if (list.status === 0 && !existing.has("SESSION_SECRET")) put("SESSION_SECRET", randomBytes(32).toString("base64url"));
else console.log("✓ SESSION_SECRET sudah ada");

if (process.env.TURNSTILE_SECRET_KEY) put("TURNSTILE_SECRET_KEY", process.env.TURNSTILE_SECRET_KEY);

const adminToken = process.env.GUARD_ADMIN_TOKEN ?? "";
if (adminToken) {
  if (adminToken.length < 24) {
    console.error("✗ GUARD_ADMIN_TOKEN minimal 24 karakter (contoh: openssl rand -base64 32)");
    process.exit(1);
  }
  put("GUARD_ADMIN_TOKEN", adminToken);
}

console.log("\n✓ Selesai.\n");
