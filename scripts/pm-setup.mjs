#!/usr/bin/env node
/** Idempotent D1 provisioning. Uses Wrangler's existing Cloudflare login/token. */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const run = (args, capture = false) => {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0)
    throw new Error(
      capture ? result.stderr || "Wrangler gagal." : "Setup D1 gagal.",
    );
  return result.stdout;
};
export function setupPm(local = false) {
  const file = new URL("../wrangler.jsonc", import.meta.url);
  let config = readFileSync(file, "utf8");
  const match = config.match(/\{\s*"binding":\s*"PM_DB"[^}]*\}/);
  if (!match) throw new Error("Binding PM_DB tidak ditemukan.");
  const name = JSON.parse(match[0]).database_name;
  if (!local) {
    const list = () => JSON.parse(run(["d1", "list", "--json"], true));
    let database = list().find((d) => d.name === name);
    if (!database) {
      run([
        "d1",
        "create",
        name,
        "--location",
        "apac",
        "--update-config=false",
      ]);
      database = list().find((d) => d.name === name);
    }
    if (!database?.uuid)
      throw new Error("Database D1 tidak ditemukan setelah setup.");
    const entry = { ...JSON.parse(match[0]), database_id: database.uuid };
    config = config.replace(match[0], JSON.stringify(entry));
    writeFileSync(file, config);
  }
  run(["d1", "migrations", "apply", "PM_DB", local ? "--local" : "--remote"]);
  console.log(`✓ PM D1 ${local ? "lokal" : "remote"} siap`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    setupPm(process.argv.includes("--local"));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
