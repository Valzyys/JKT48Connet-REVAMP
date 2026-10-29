"use strict";
// Pemantau member yang sedang live (polling /api/app/now_live lewat klien api.js). Dipakai untuk tombol LIVE di
// title bar, tooltip & menu tray, dan notifikasi Windows saat ada member yang baru mulai live.

/** Bentuk ringkas satu sesi live untuk notifikasi & tray (dari bentuk `LiveSession` situs). */
function pick(l) {
  const str = (v) => (typeof v === "string" ? v : "");
  const https = (v) => (/^https:\/\//.test(str(v)) ? str(v) : "");
  return {
    id: str(l.id),
    name: str(l.name),
    fullname: str(l.fullname) || str(l.name),
    title: str(l.title),
    platform: str(l.platform).toLowerCase(),
    avatar: https(l.avatar) || https(l.img),
    startedAt: str(l.startedAt),
  };
}

/**
 * @param {object} o
 * @param {() => Promise<unknown>} o.load  ambil daftar live mentah (array LiveSession)
 * @param {(list: unknown[]) => void} o.onChange  daftar live lengkap terbaru (bentuk asli, untuk UI)
 * @param {(fresh: ReturnType<typeof pick>[]) => void} o.onStart  member yang baru mulai live sejak polling sebelumnya
 * @param {number} [o.interval]
 */
function createLiveWatcher({ load, onChange, onStart, interval = 60_000 }) {
  let known = null; // null = belum pernah berhasil: polling pertama tidak memicu notifikasi
  let timer = null;
  let running = false;
  let failures = 0;
  let list = [];

  async function poll() {
    try {
      const raw = await load();
      list = Array.isArray(raw) ? raw.filter((l) => l && typeof l === "object") : [];
      failures = 0;
      const picked = list.map(pick).filter((l) => l.id && l.name);
      if (known) {
        const fresh = picked.filter((l) => !known.has(l.id));
        if (fresh.length) onStart(fresh);
      }
      known = new Set(picked.map((l) => l.id));
      onChange(list);
    } catch {
      failures++;
    }
    if (!running) return; // stop() bisa dipanggil dari dalam onChange/onStart
    // Saat gagal (offline / server sibuk), mundur perlahan sampai 10 menit.
    const wait = failures ? Math.min(interval * 2 ** Math.min(failures, 4), 600_000) : interval;
    timer = setTimeout(poll, wait);
  }

  return {
    start() {
      if (running) return;
      running = true;
      timer = setTimeout(poll, 0);
    },
    stop() {
      running = false;
      clearTimeout(timer);
      timer = null;
    },
    /** Polling sekarang (mis. setelah laptop bangun dari sleep). */
    refresh() {
      if (!running) return;
      clearTimeout(timer);
      timer = setTimeout(poll, 0);
    },
    get list() {
      return list;
    },
  };
}

module.exports = { createLiveWatcher, pick };
