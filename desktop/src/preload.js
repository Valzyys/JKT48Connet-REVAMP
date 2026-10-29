"use strict";
// Jembatan sempit antara UI (renderer, tanpa akses Node) dan main process. Hanya kanal di bawah yang tersedia.
const { contextBridge, ipcRenderer } = require("electron");

const SEND = new Set(["set", "open-external", "menu", "update-install", "update-check", "fullscreen"]);
const ON = new Set(["state", "live", "navigate", "splash"]);

contextBridge.exposeInMainWorld("jkc", {
  /** Data JSON `/api/app<path>` → { data, stale } atau { error: { status, message } }. */
  api: (path, opts) => ipcRenderer.invoke("jkc:api", String(path), { fresh: !!opts?.fresh }),
  state: () => ipcRenderer.invoke("jkc:state"),
  /** URL stream HLS live Showroom untuk room tertentu (cadangan bila daftar live belum memuatnya). */
  showroomStreams: (room) => ipcRenderer.invoke("jkc:sr-streams", String(room)),
  live: () => ipcRenderer.invoke("jkc:live"),
  send(channel, ...args) {
    if (SEND.has(channel)) ipcRenderer.send(`jkc:${channel}`, ...args);
  },
  on(channel, fn) {
    if (!ON.has(channel)) return () => {};
    const handler = (_e, ...args) => fn(...args);
    ipcRenderer.on(`jkc:${channel}`, handler);
    return () => ipcRenderer.removeListener(`jkc:${channel}`, handler);
  },
});
