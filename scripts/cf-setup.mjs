#!/usr/bin/env node
/**
 * Setup Cloudflare sekali jalan:
 *   1. Pastikan sudah login wrangler (membuka browser bila belum).
 *   2. Minta API key JKT48Connect (jkc_…) dan validasi formatnya.
 *   3. Tulis `.dev.vars` untuk development lokal.
 *   4. Simpan key sebagai secret di Cloudflare (Workers, atau Pages dengan --pages).
 *   5. Buat SESSION_SECRET acak (penanda tangan sesi & token replay) dan simpan juga sebagai secret.
 *
 * Pemakaian:
 *   npm run cf:setup                 # Workers (default)
 *   npm run cf:setup -- --pages      # Cloudflare Pages (project "jkt48connect")
 *   JKT48CONNECT_API_KEY=jkc_… npm run cf:setup -- --yes   # non-interaktif (CI)
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const KEY_FORMAT = /^jkc_[a-f0-9]{40}$/;
const args = new Set(process.argv.slice(2));
const pages = args.has("--pages");
const project = process.env.CF_PAGES_PROJECT || "jkt48connect";

function wrangler(cmdArgs, opts = {}) {
  return spawnSync("npx", ["wrangler", ...cmdArgs], { stdio: "inherit", shell: process.platform === "win32", ...opts });
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

console.log("\n◆ JKT48Connect · setup Cloudflare\n");

// 1. Login
const who = spawnSync("npx", ["wrangler", "whoami"], { encoding: "utf8", shell: process.platform === "win32" });
if (!/You are logged in|associated with the email/i.test(`${who.stdout}${who.stderr}`)) {
  console.log("→ Belum login ke Cloudflare, membuka `wrangler login`…");
  if (wrangler(["login"]).status !== 0) process.exit(1);
}

// 2. API key
let key = process.env.JKT48CONNECT_API_KEY ?? "";
if (!key && existsSync(".dev.vars")) {
  key = /JKT48CONNECT_API_KEY=(\S+)/.exec(readFileSync(".dev.vars", "utf8"))?.[1] ?? "";
  if (key && !args.has("--yes")) {
    const reuse = await ask(`Pakai key dari .dev.vars (${key.slice(0, 8)}…${key.slice(-4)})? [Y/n] `);
    if (/^n/i.test(reuse)) key = "";
  }
}
while (!KEY_FORMAT.test(key)) {
  if (key) console.log("✗ Format key salah. Harus jkc_ + 40 karakter hex (buat di https://api.jkt48connect.app/dashboard/keys).");
  if (args.has("--yes")) process.exit(1);
  key = await ask("API key JKT48Connect (jkc_…): ");
}

// 3. .dev.vars (SESSION_SECRET lama dipakai ulang supaya sesi yang ada tetap berlaku)
const sessionSecret =
  (existsSync(".dev.vars") && /SESSION_SECRET=(\S+)/.exec(readFileSync(".dev.vars", "utf8"))?.[1]) || randomBytes(32).toString("base64url");
writeFileSync(".dev.vars", `JKT48CONNECT_API_KEY=${key}\nSESSION_SECRET=${sessionSecret}\n`);
console.log("✓ .dev.vars ditulis (dipakai `npm run dev` & `wrangler dev`)");

// 4. Secret di Cloudflare
const secretArgs = (name) => (pages ? ["pages", "secret", "put", name, "--project-name", project] : ["secret", "put", name]);

if (pages) {
  // Project Pages harus ada sebelum secret bisa disimpan.
  spawnSync("npx", ["wrangler", "pages", "project", "create", project, "--production-branch", "main"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
}

for (const [name, value] of [
  ["JKT48CONNECT_API_KEY", key],
  ["SESSION_SECRET", sessionSecret],
]) {
  const put = spawnSync("npx", ["wrangler", ...secretArgs(name)], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
  if (put.status !== 0) {
    console.log("✗ Gagal menyimpan secret. Untuk Workers, deploy sekali dulu (`npm run deploy`) lalu ulangi.");
    process.exit(put.status ?? 1);
  }
}

console.log(`\n✓ Selesai. Deploy dengan: ${pages ? "npm run deploy:pages" : "npm run deploy"}\n`);
