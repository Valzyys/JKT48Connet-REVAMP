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
 *        FCM_SERVICE_ACCOUNT, FCM_ANDROID_APP_ID, FCM_ANDROID_API_KEY
 *                              ← dari env bila diisi: server push ke aplikasi Android (cron tiap 2 menit).
 *                                FCM_SERVICE_ACCOUNT boleh berisi JSON-nya atau path ke file .json.
 *                                Ganti dua yang terakhir dengan FCM_GOOGLE_SERVICES (isi/path google-services.json):
 *                                App ID & API key aplikasi app.jkt48connect diambil otomatis dari situ.
 *
 *   npm run deploy:auto
 *   JKT48CONNECT_API_KEY=jkc_… npm run deploy:auto
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { setupPm } from "./pm-setup.mjs";

if (existsSync(".dev.vars")) loadEnvFile(".dev.vars");

const win = process.platform === "win32";
const run = (args, opts = {}) =>
  spawnSync("npx", ["wrangler", ...args], {
    shell: win,
    encoding: "utf8",
    ...opts,
  });

console.log("\n◆ JKT48Connect · deploy otomatis\n");

setupPm();

const deploy = run(["deploy", "--keep-vars"], { stdio: "inherit" });
if (deploy.status !== 0) {
  console.error("✗ wrangler deploy gagal");
  process.exit(deploy.status ?? 1);
}

const list = run(["secret", "list", "--format", "json"]);
let existing = new Set();
try {
  existing = new Set(JSON.parse(list.stdout).map((s) => s.name));
} catch {
  console.warn(
    "! Tidak bisa membaca daftar secret (token tanpa izin?). Secret yang sudah ada tidak akan ditimpa.",
  );
}

function put(name, value) {
  const r = run(["secret", "put", name], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
  });
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
  console.warn(
    "! JKT48CONNECT_API_KEY belum ada. Isi variabel env JKT48CONNECT_API_KEY lalu jalankan ulang, atau `npm run cf:secret`.",
  );
}

if (list.status === 0 && !existing.has("SESSION_SECRET"))
  put("SESSION_SECRET", randomBytes(32).toString("base64url"));
else console.log("✓ SESSION_SECRET sudah ada");

for (const name of ["PM_API_KEY", "MYPG_API_KEY"]) {
  if (process.env[name]) put(name, process.env[name]);
  else if (!existing.has(name))
    console.warn(
      `! ${name} belum diatur. Fitur PM terkait belum bisa dipakai.`,
    );
}

if (process.env.TURNSTILE_SECRET_KEY)
  put("TURNSTILE_SECRET_KEY", process.env.TURNSTILE_SECRET_KEY);

const adminToken = process.env.GUARD_ADMIN_TOKEN ?? "";
if (adminToken) {
  if (adminToken.length < 24) {
    console.error(
      "✗ GUARD_ADMIN_TOKEN minimal 24 karakter (contoh: openssl rand -base64 32)",
    );
    process.exit(1);
  }
  put("GUARD_ADMIN_TOKEN", adminToken);
}

// Server push (worker/push.ts): ketiganya harus ada supaya aktif; tanpa itu cron tidak berbuat apa-apa.
const fcm = process.env.FCM_SERVICE_ACCOUNT ?? "";
if (fcm) {
  const json = fcm.trim().startsWith("{") ? fcm : readFileSync(fcm, "utf8");
  let sa;
  try {
    sa = JSON.parse(json);
  } catch {
    console.error("✗ FCM_SERVICE_ACCOUNT bukan JSON service account yang valid");
    process.exit(1);
  }
  if (!sa.project_id || !sa.client_email || !String(sa.private_key ?? "").includes("PRIVATE KEY")) {
    console.error("✗ FCM_SERVICE_ACCOUNT harus JSON service account Firebase (project_id, client_email, private_key)");
    process.exit(1);
  }
  put("FCM_SERVICE_ACCOUNT", JSON.stringify(sa));
}
const gs = process.env.FCM_GOOGLE_SERVICES ?? "";
if (gs) {
  let client;
  try {
    const json = JSON.parse(gs.trim().startsWith("{") ? gs : readFileSync(gs, "utf8"));
    client = (json.client ?? []).find((c) => c.client_info?.android_client_info?.package_name === "app.jkt48connect");
  } catch {
    console.error("✗ FCM_GOOGLE_SERVICES bukan isi google-services.json yang valid");
    process.exit(1);
  }
  const appId = client?.client_info?.mobilesdk_app_id;
  const apiKey = client?.api_key?.[0]?.current_key;
  if (!appId || !apiKey) {
    console.error("✗ google-services.json tidak memuat aplikasi Android app.jkt48connect (cek package name di Firebase)");
    process.exit(1);
  }
  put("FCM_ANDROID_APP_ID", appId);
  put("FCM_ANDROID_API_KEY", apiKey);
}
for (const name of ["FCM_ANDROID_APP_ID", "FCM_ANDROID_API_KEY"]) {
  if (process.env[name] && !gs) put(name, process.env[name]);
}
if (!fcm && !existing.has("FCM_SERVICE_ACCOUNT"))
  console.log("· Server push belum diatur (opsional). Lihat README → Server push.");

console.log("\n✓ Selesai.\n");
