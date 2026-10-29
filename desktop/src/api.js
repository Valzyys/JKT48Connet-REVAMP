"use strict";
// Klien data aplikasi: `https://jkt48connect.app/api/app/*` dengan token aplikasi (POST /api/app/session), sama
// dengan aplikasi Android/iPhone. Tidak ada API key di aplikasi. Hasil JSON di-cache di memori (TTL per jalur) dan
// di disk, supaya aplikasi tetap menampilkan data terakhir saat offline.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SITE = "https://jkt48connect.app";

/** Umur cache memori per awalan jalur (detik), mengikuti aplikasi iPhone (ios/JKT48Connect/Core/Api.swift). */
const TTL = [
  [/^\/now_live/, 20],
  [/^\/showroom-comments\//, 2],
  [/^\/member$/, 1800],
  [/^\/member\//, 600],
  [/^\/next_schedule/, 300],
  [/^\/theater/, 300],
  [/^\/recent/, 180],
  [/^\/news\//, 3600],
  [/^\/news/, 600],
  [/^\/next_birthday/, 3600],
  [/^\/jkt48_youtube\/[^/]+\/comments/, 120],
  [/^\/jkt48_youtube\//, 900],
  [/^\/jkt48_youtube/, 180],
  [/^\/(x|tiktok|instagram)\//, 60],
];
const ttlOf = (p) => (TTL.find(([re]) => re.test(p))?.[1] ?? 60) * 1000;

/** Hanya jalur data yang memang dipakai aplikasi (tanpa donasi/replay/media: itu lewat pemutar/gambar). */
const ALLOWED = /^\/(now_live|showroom-comments\/\d{1,12}|member(\/[\w.-]{1,80})?|next_schedule|theater(\/[\w.-]{1,80})?|recent(\/[\w.-]{1,120})?|news(\/[\w.-]{1,80})?|next_birthday|jkt48_youtube(\/[\w-]{6,20}(\/comments)?)?|x\/tweets|tiktok\/posts|instagram\/posts)(\?[\w.=&%-]{0,300})?$/;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createApi({ fetch, userAgent, cacheDir }) {
  let token = "";
  let exp = 0;
  let pending = null;
  const memory = new Map();
  const inflight = new Map();

  async function session() {
    if (token && exp - 120 > Date.now() / 1000) return token;
    if (!pending) {
      pending = (async () => {
        const res = await fetch(`${SITE}/api/app/session`, { method: "POST", headers: { "user-agent": userAgent, accept: "application/json" } });
        if (!res.ok) throw new ApiError(res.status, res.status === 429 ? "Terlalu banyak permintaan, coba lagi sebentar" : "Tidak bisa terhubung ke server");
        const body = await res.json();
        if (typeof body.token !== "string") throw new ApiError(502, "Respons sesi tidak valid");
        token = body.token;
        exp = Number(body.exp) || Date.now() / 1000 + 3600;
        return token;
      })().finally(() => (pending = null));
    }
    return pending;
  }

  async function request(p, retry = true) {
    const t = await session();
    const res = await fetch(`${SITE}/api/app${p}`, { headers: { authorization: `Bearer ${t}`, "user-agent": userAgent, accept: "application/json" } });
    if (res.status === 401 && retry) {
      token = "";
      return request(p, false);
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* bukan JSON */
    }
    if (!res.ok) throw new ApiError(res.status, (body && typeof body.message === "string" && body.message) || `Server menjawab ${res.status}`);
    return body;
  }

  const file = (p) => path.join(cacheDir, `${crypto.createHash("sha1").update(p).digest("hex")}.json`);
  function fromDisk(p) {
    try {
      return JSON.parse(fs.readFileSync(file(p), "utf8"));
    } catch {
      return undefined;
    }
  }
  function toDisk(p, v) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(file(p), JSON.stringify(v));
    } catch {
      /* cache hanya pelengkap */
    }
  }

  /**
   * @param {string} p   jalur setelah /api/app, mis. "/recent?page=1&perpage=12"
   * @param {{fresh?: boolean}} [o]  fresh: abaikan cache memori (tarik-untuk-segarkan, polling live)
   * @returns {Promise<{data: unknown, stale: boolean}>}
   */
  async function get(p, o = {}) {
    if (typeof p !== "string" || !ALLOWED.test(p)) throw new ApiError(400, "Jalur tidak dikenal");
    const hit = memory.get(p);
    if (!o.fresh && hit && Date.now() - hit.at < ttlOf(p)) return { data: hit.data, stale: false };
    if (!inflight.has(p)) {
      inflight.set(
        p,
        request(p)
          .then((data) => {
            memory.set(p, { at: Date.now(), data });
            toDisk(p, data);
            return data;
          })
          .finally(() => inflight.delete(p)),
      );
    }
    try {
      return { data: await inflight.get(p), stale: false };
    } catch (err) {
      // Offline / server sibuk: pakai data terakhir yang pernah berhasil.
      const old = hit?.data ?? fromDisk(p);
      if (old !== undefined && !(err instanceof ApiError && err.status === 404)) return { data: old, stale: true };
      throw err;
    }
  }

  return { get, session, ApiError };
}

module.exports = { createApi, ApiError, ALLOWED, SITE };
