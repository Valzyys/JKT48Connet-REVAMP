#!/usr/bin/env node
/**
 * Buka blokir penjaga anti-iseng lewat `POST /api/admin/unblock`.
 *
 *   GUARD_ADMIN_TOKEN=… npm run guard:unblock -- --site https://situsmu.workers.dev --incident JC-AB12-CD34
 *   GUARD_ADMIN_TOKEN=… npm run guard:unblock -- --site https://situsmu.workers.dev --ip 203.0.113.7
 *   GUARD_ADMIN_TOKEN=… npm run guard:unblock -- --site https://situsmu.workers.dev            (IP sendiri)
 *
 * Token juga dibaca dari .dev.vars bila variabel env tidak diisi. Situs default: SITE_URL atau http://localhost:5173.
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function fromDevVars(name) {
  try {
    const line = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith(`${name}=`));
    return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

const token = process.env.GUARD_ADMIN_TOKEN || fromDevVars("GUARD_ADMIN_TOKEN");
const site = (opt("site") || process.env.SITE_URL || "http://localhost:5173").replace(/\/+$/, "");
const incident = opt("incident");
const ip = opt("ip");

if (!token) {
  console.error("✗ GUARD_ADMIN_TOKEN belum diisi (env atau .dev.vars).");
  process.exit(1);
}

const body = incident ? { incident } : ip ? { ip } : {};
const res = await fetch(`${site}/api/admin/unblock`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify(body),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`✗ ${res.status} ${out.message ?? res.statusText}`);
  process.exit(1);
}
console.log(`✓ ${out.message} · IP ${out.ip}${out.incident ? ` · insiden ${out.incident}` : ""}`);
console.log("  Isolate lain menyusul dalam ±30 detik. Minta pengguna memuat ulang halaman.");
