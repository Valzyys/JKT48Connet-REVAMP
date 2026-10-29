"use strict";
// Pengaturan kecil aplikasi (JSON di folder userData). Ditulis sinkron & atomik: data sedikit, jarang berubah.
const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = {
  /** Notifikasi Windows saat member mulai live. */
  notifyLive: true,
  /** Tombol tutup menyembunyikan jendela ke tray (aplikasi tetap jalan untuk notifikasi). */
  closeToTray: false,
  /** Ukuran & posisi jendela terakhir. */
  bounds: null,
  maximized: false,
  zoom: 0,
  /** Tema UI: "light" (kertas krem brand, bawaan) atau "dark". */
  theme: "light",
};

function createStore(dir) {
  const file = path.join(dir, "settings.json");
  let data = { ...DEFAULTS };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw && typeof raw === "object") {
      for (const k of Object.keys(DEFAULTS)) if (k in raw) data[k] = raw[k];
    }
  } catch {
    /* belum ada / rusak → pakai bawaan */
  }

  return {
    get: (k) => data[k],
    set(k, v) {
      if (!(k in DEFAULTS) || data[k] === v) return;
      data[k] = v;
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
        fs.renameSync(`${file}.tmp`, file);
      } catch {
        /* disk penuh / tanpa izin: pengaturan berlaku untuk sesi ini saja */
      }
    },
  };
}

/** Pulihkan ukuran jendela hanya bila masih terlihat di salah satu layar (layar kedua bisa sudah dicabut). */
function visibleBounds(bounds, displays) {
  if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) return null;
  const onScreen = displays.some(({ workArea: a }) => bounds.x < a.x + a.width - 80 && bounds.x + bounds.width > a.x + 80 && bounds.y >= a.y - 10 && bounds.y < a.y + a.height - 60);
  return onScreen ? bounds : null;
}

module.exports = { createStore, visibleBounds, DEFAULTS };
