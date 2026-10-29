"use strict";
// JKT48Connect untuk Windows: aplikasi dengan UI sendiri (React, renderer/), bukan situs yang dibungkus.
//
// - UI dimuat dari berkas lokal lewat protokol app://jkc/ (ui/app, hasil build renderer).
// - Data diambil main process dari https://jkt48connect.app/api/app/* dengan token aplikasi (api.js), sama dengan
//   aplikasi Android/iPhone; renderer memintanya lewat IPC. Tanpa API key di aplikasi.
// - Gambar & video (replay, live Showroom, video YouTube JKT48) diputar langsung di renderer; token aplikasi
//   disisipkan main ke permintaan /api/app/* (replay, gambar berita) sehingga tidak pernah ada di JavaScript UI.
// - Ditambah splash bermerek, tray, notifikasi Windows saat member mulai live, dan update otomatis.

const { app, BrowserWindow, Menu, Tray, Notification, nativeImage, shell, ipcMain, screen, session, net, dialog, powerMonitor, protocol } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createStore, visibleBounds } = require("./store");
const { createApi, SITE } = require("./api");
const { createLiveWatcher } = require("./live");

const UI = path.join(__dirname, "..", "ui");
const APP_DIR = path.join(UI, "app");
const PRELOAD = path.join(__dirname, "preload.js");
const ICON = path.join(UI, "icon.png");
const APP_ID = "app.jkt48connect.desktop";
const APP_URL = "app://jkc/index.html";

/** Warna title bar bawaan Windows (tombol min/max/tutup) per tema UI. */
const OVERLAY = {
  light: { color: "#f3eee6", symbolColor: "#1d1517" },
  dark: { color: "#141012", symbolColor: "#f3ece6" },
};
const BAR = 52;

/** Host media yang boleh dibaca pemutar (hls.js memakai XHR): situs/API JKT48Connect dan CDN Showroom. */
const MEDIA_HOSTS = [/(^|\.)jkt48connect\.app$/, /(^|\.)showroom-(live|cdn|txlive)\.com$/];

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }]);
app.setAppUserModelId(APP_ID); // wajib untuk notifikasi Windows (sama dengan appId installer)
Menu.setApplicationMenu(null);

let store;
let api;
let win = null;
let splash = null;
let tray = null;
let live = null;
let updater = null;
let updateState = null;
let liveList = [];
let quitting = false;
let revealed = false;
let trayHinted = false;
const toasts = new Set();

/* ───────────────────────────── Util ───────────────────────────── */

function openExternal(u) {
  try {
    const x = new URL(u);
    if (["https:", "http:", "mailto:"].includes(x.protocol)) shell.openExternal(x.href);
  } catch {
    /* bukan URL */
  }
}

const platformLabel = (p) => (p === "showroom" ? "Showroom" : p === "idn" ? "IDN Live" : p ? p.toUpperCase() : "");

/** Minta renderer membuka rute (mis. "/watch/abc") lalu tampilkan jendela. */
function go(route) {
  showMain();
  if (typeof route !== "string" || !route.startsWith("/")) return;
  const send = () => win?.webContents.send("jkc:navigate", route);
  if (win?.webContents.isLoading()) win.webContents.once("did-finish-load", () => setTimeout(send, 300));
  else send();
}

/* ───────────────────────────── Protokol app:// & jaringan ───────────────────────────── */

function serveApp() {
  protocol.handle("app", async (req) => {
    const u = new URL(req.url);
    if (u.host !== "jkc") return new Response("Not found", { status: 404 });
    let rel = decodeURIComponent(u.pathname);
    if (rel === "/" || !path.extname(rel)) rel = "/index.html"; // rute UI memakai hash, tapi jaga-jaga
    const file = path.normalize(path.join(APP_DIR, rel));
    if (!file.startsWith(APP_DIR + path.sep) || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });
}

function setupSession() {
  const ses = session.defaultSession;
  // Token aplikasi untuk replay & gambar berita (/api/app/*) disisipkan di sini, tidak pernah dipegang renderer.
  ses.webRequest.onBeforeSendHeaders({ urls: [`${SITE}/api/app/*`] }, (d, cb) => {
    if (!win || d.webContentsId !== win.webContents.id) return cb({});
    api
      .session()
      .then((t) => cb({ requestHeaders: { ...d.requestHeaders, Authorization: `Bearer ${t}` } }))
      .catch(() => cb({}));
  });
  // Pemutar HLS membaca playlist lewat XHR dari origin app://jkc: izinkan CORS hanya untuk host media yang dikenal.
  ses.webRequest.onHeadersReceived({ urls: ["https://*/*"] }, (d, cb) => {
    let host = "";
    try {
      host = new URL(d.url).hostname;
    } catch {
      /* abaikan */
    }
    if (!win || d.webContentsId !== win.webContents.id || !MEDIA_HOSTS.some((re) => re.test(host))) return cb({});
    const headers = Object.fromEntries(Object.entries(d.responseHeaders ?? {}).filter(([k]) => k.toLowerCase() !== "access-control-allow-origin"));
    cb({ responseHeaders: { ...headers, "Access-Control-Allow-Origin": ["*"] } });
  });
  const allowed = (perm) => perm === "fullscreen" || perm === "clipboard-sanitized-write";
  ses.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed(perm)));
  ses.setPermissionCheckHandler((_wc, perm) => allowed(perm));
  ses.setUserAgent(`${ses.getUserAgent().replace(/\s(Electron|jkt48connect-desktop|JKT48Connect)\/\S+/gi, "")} JKT48ConnectDesktop/${app.getVersion()}`);
}

/* ───────────────────────────── Splash ───────────────────────────── */

function createSplash() {
  splash = new BrowserWindow({
    width: 560,
    height: 340,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    center: true,
    backgroundColor: "#00000000",
    icon: ICON,
    title: "JKT48Connect",
    webPreferences: { preload: PRELOAD, sandbox: true, contextIsolation: true, spellcheck: false },
  });
  splash.loadFile(path.join(UI, "splash.html"), { query: { v: app.getVersion() } });
  splash.once("ready-to-show", () => splash?.show());
  splash.on("closed", () => (splash = null));
}

function splashStatus(text, progress, done = false) {
  splash?.webContents.send("jkc:splash", { text, progress, done });
}

/* ───────────────────────────── Jendela utama ───────────────────────────── */

function createWindow() {
  const saved = visibleBounds(store.get("bounds"), screen.getAllDisplays());
  const theme = store.get("theme") === "dark" ? "dark" : "light";
  revealed = false;
  win = new BrowserWindow({
    width: saved?.width ?? 1380,
    height: saved?.height ?? 880,
    ...(saved ? { x: saved.x, y: saved.y } : { center: true }),
    minWidth: 1000,
    minHeight: 640,
    show: false,
    title: "JKT48Connect",
    icon: ICON,
    backgroundColor: OVERLAY[theme].color,
    titleBarStyle: "hidden",
    titleBarOverlay: { ...OVERLAY[theme], height: BAR },
    webPreferences: { preload: PRELOAD, sandbox: true, contextIsolation: true, spellcheck: false },
  });
  const wc = win.webContents;
  wc.setZoomLevel(store.get("zoom") || 0);
  // UI lokal tidak pernah berpindah ke situs lain: tautan luar dibuka di browser.
  wc.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e) => {
    if (!e.url.startsWith("app://jkc/")) {
      e.preventDefault();
      openExternal(e.url);
    }
  });
  wc.on("before-input-event", onKeys);
  wc.on("did-finish-load", () => {
    splashStatus("Memuat data…", 0.7);
    setTimeout(reveal, 900);
  });
  wc.on("render-process-gone", (_e, d) => {
    if (d.reason !== "clean-exit" && !quitting) wc.reload();
  });
  // Pengembangan: JKC_ROUTE membuka rute tertentu langsung (untuk tangkapan layar).
  const route = !app.isPackaged && /^\/[\w/.-]*$/.test(process.env.JKC_ROUTE || "") ? `#${process.env.JKC_ROUTE}` : "";
  win.loadURL(`${APP_URL}?theme=${theme}${route}`);
  splashStatus("Menyiapkan tampilan…", 0.35);
  setTimeout(reveal, 12_000);

  let saveTimer;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveBounds, 600);
  };
  win.on("resize", saveSoon);
  win.on("move", saveSoon);
  win.on("enter-full-screen", push);
  win.on("leave-full-screen", push);
  win.on("close", (e) => {
    saveBounds();
    if (!quitting && store.get("closeToTray") && tray) {
      e.preventDefault();
      win.hide();
      if (!trayHinted) {
        trayHinted = true;
        toast({ title: "JKT48Connect masih berjalan", body: "Aplikasi ada di tray dan tetap mengirim notifikasi live. Klik ikon tray untuk membuka lagi." });
      }
    }
  });
  win.on("closed", () => (win = null));
}

function saveBounds() {
  if (!win || win.isDestroyed() || win.isFullScreen()) return;
  store.set("maximized", win.isMaximized());
  if (!win.isMaximized() && !win.isMinimized()) store.set("bounds", win.getBounds());
}

function reveal() {
  if (revealed || !win) return;
  revealed = true;
  if (store.get("maximized")) win.maximize();
  win.show();
  win.focus();
  if (splash) {
    splashStatus("Siap!", 1, true);
    setTimeout(() => splash?.close(), 420);
  }
}

function showMain() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}

function zoom(step) {
  const level = step === 0 ? 0 : Math.max(-2, Math.min(3, (store.get("zoom") || 0) + step * 0.5));
  store.set("zoom", level);
  win?.webContents.setZoomLevel(level);
}

function onKeys(e, input) {
  if (input.type !== "keyDown") return;
  const k = input.key;
  const ctrl = input.control || input.meta;
  let done = true;
  if (ctrl && (k === "=" || k === "+")) zoom(1);
  else if (ctrl && k === "-") zoom(-1);
  else if (ctrl && k === "0") zoom(0);
  else if (k === "F11") win?.setFullScreen(!win.isFullScreen());
  else if (k === "F12" && !app.isPackaged) win?.webContents.openDevTools({ mode: "detach" });
  else done = false;
  if (done) e.preventDefault();
}

/* ───────────────────────────── State untuk UI ───────────────────────────── */

function loginEnabled() {
  return process.platform === "win32" ? app.getLoginItemSettings({ args: ["--hidden"] }).openAtLogin : false;
}

function state() {
  return {
    version: app.getVersion(),
    platform: process.platform,
    notifyLive: !!store.get("notifyLive"),
    closeToTray: !!store.get("closeToTray"),
    openAtLogin: loginEnabled(),
    canLogin: process.platform === "win32",
    theme: store.get("theme") === "dark" ? "dark" : "light",
    zoom: store.get("zoom") || 0,
    fullscreen: !!win?.isFullScreen(),
    update: updateState,
    canUpdate: !!updater,
  };
}

function push() {
  if (win && !win.isDestroyed()) win.webContents.send("jkc:state", state());
  updateTray();
}

function setSetting(key, value) {
  if (key === "notifyLive" || key === "closeToTray") store.set(key, !!value);
  else if (key === "openAtLogin" && process.platform === "win32") {
    app.setLoginItemSettings({ openAtLogin: !!value, args: ["--hidden"] });
    // Dibuka diam-diam saat Windows mulai hanya berguna bila aplikasi boleh tinggal di tray.
    if (value) store.set("closeToTray", true);
  } else if (key === "theme" && (value === "light" || value === "dark")) {
    store.set("theme", value);
    win?.setTitleBarOverlay?.({ ...OVERLAY[value], height: BAR });
    win?.setBackgroundColor(OVERLAY[value].color);
  } else return;
  push();
}

/* ───────────────────────────── Menu ───────────────────────────── */

function settingsItems() {
  const s = state();
  return [
    { label: "Notifikasi saat member live", type: "checkbox", checked: s.notifyLive, click: (i) => setSetting("notifyLive", i.checked) },
    { label: "Tetap berjalan di tray saat ditutup", type: "checkbox", checked: s.closeToTray, click: (i) => setSetting("closeToTray", i.checked) },
    ...(s.canLogin ? [{ label: "Jalankan saat Windows dinyalakan", type: "checkbox", checked: s.openAtLogin, click: (i) => setSetting("openAtLogin", i.checked) }] : []),
  ];
}

function updateItem() {
  if (updateState?.ready) return { label: `Pasang update ${updateState.version} & mulai ulang`, click: installUpdate };
  if (updateState) return { label: `Mengunduh update ${updateState.version}…`, enabled: false };
  return { label: "Cek update", enabled: !!updater, click: () => checkUpdate(true) };
}

function appMenu() {
  const z = store.get("zoom") || 0;
  return Menu.buildFromTemplate([
    { label: "Perbesar tampilan", accelerator: "CmdOrCtrl+=", click: () => zoom(1) },
    { label: "Perkecil tampilan", accelerator: "CmdOrCtrl+-", click: () => zoom(-1) },
    { label: "Ukuran asli", accelerator: "CmdOrCtrl+0", enabled: z !== 0, click: () => zoom(0) },
    { label: "Layar penuh", accelerator: "F11", click: () => win?.setFullScreen(!win.isFullScreen()) },
    { type: "separator" },
    ...settingsItems(),
    { type: "separator" },
    updateItem(),
    { label: "Pengaturan & tentang", click: () => go("/settings") },
    { type: "separator" },
    { label: "Keluar", click: quit },
  ]);
}

/* ───────────────────────────── Tray & notifikasi ───────────────────────────── */

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(UI, "tray.png")));
  tray.on("click", showMain);
  tray.on("double-click", showMain);
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const n = liveList.length;
  tray.setToolTip(n ? `JKT48Connect · ${n} member sedang live` : "JKT48Connect");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Buka JKT48Connect", click: showMain },
      { label: n ? `Live sekarang (${n})` : "Live sekarang", click: () => go("/live") },
      ...liveList.slice(0, 6).map((l) => ({ label: `     ${l.name} · ${platformLabel(String(l.platform || "").toLowerCase())}`, click: () => go(`/watch/${encodeURIComponent(l.id)}`) })),
      { label: "Jadwal theater", click: () => go("/schedule") },
      { label: "Recent", click: () => go("/recent") },
      { type: "separator" },
      ...settingsItems(),
      { type: "separator" },
      updateItem(),
      { label: "Keluar", click: quit },
    ]),
  );
}

function toast(opts, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ icon: nativeImage.createFromPath(ICON), ...opts });
  toasts.add(n); // simpan referensi supaya klik notifikasi masih tertangkap
  n.on("click", () => onClick?.());
  n.on("close", () => toasts.delete(n));
  n.show();
  setTimeout(() => toasts.delete(n), 10 * 60_000);
}

async function avatar(url) {
  if (!url) return null;
  try {
    const res = await net.fetch(url, { headers: { accept: "image/*" } });
    if (!res.ok) return null;
    const img = nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer()));
    return img.isEmpty() ? null : img.resize({ width: 128, height: 128, quality: "best" });
  } catch {
    return null;
  }
}

async function notifyStarted(fresh) {
  if (!store.get("notifyLive")) return;
  for (const l of fresh.slice(0, 3)) {
    const icon = await avatar(l.avatar);
    toast(
      { title: `${l.name} sedang live`, body: [platformLabel(l.platform), l.title].filter(Boolean).join(" · ") || "Tonton sekarang di JKT48Connect", ...(icon ? { icon } : {}) },
      () => go(`/watch/${encodeURIComponent(l.id)}`),
    );
  }
  if (fresh.length > 3) {
    toast({ title: `${fresh.length - 3} member lain juga mulai live`, body: fresh.slice(3).map((l) => l.name).join(", ") }, () => go("/live"));
  }
}

function startLive() {
  live = createLiveWatcher({
    load: async () => (await api.get("/now_live", { fresh: true })).data,
    onChange(list) {
      liveList = list;
      updateTray();
      win?.webContents.send("jkc:live", list);
    },
    onStart: notifyStarted,
  });
  live.start();
  powerMonitor.on("resume", () => live.refresh());
}

/* ───────────────────────────── Update otomatis ───────────────────────────── */

let manualCheck = false;

function startUpdater() {
  if (!app.isPackaged || process.platform !== "win32") return;
  try {
    ({ autoUpdater: updater } = require("electron-updater"));
  } catch {
    return;
  }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = null;
  updater.on("update-available", (i) => {
    updateState = { version: i.version, ready: false };
    push();
  });
  updater.on("update-downloaded", (i) => {
    updateState = { version: i.version, ready: true };
    push();
  });
  updater.on("update-not-available", () => {
    if (manualCheck) dialog.showMessageBox(win ?? undefined, { type: "info", title: "JKT48Connect", message: "Kamu sudah memakai versi terbaru.", detail: `Versi ${app.getVersion()}` });
    manualCheck = false;
  });
  updater.on("error", () => {
    if (manualCheck) dialog.showMessageBox(win ?? undefined, { type: "warning", title: "JKT48Connect", message: "Update belum bisa dicek.", detail: "Periksa koneksi internet lalu coba lagi." });
    manualCheck = false;
  });
  setTimeout(() => checkUpdate(false), 20_000);
  setInterval(() => checkUpdate(false), 6 * 3600_000);
}

function checkUpdate(manual) {
  if (!updater) return;
  manualCheck = manual;
  updater.checkForUpdates().catch(() => {});
}

function installUpdate() {
  if (!updateState?.ready || !updater) return;
  quitting = true;
  updater.quitAndInstall(false, true);
}

/* ───────────────────────────── Stream Showroom ───────────────────────────── */

async function showroomStreams(room) {
  try {
    const res = await net.fetch(`https://www.showroom-live.com/api/live/streaming_url?room_id=${room}&abr_available=1`, { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const body = await res.json();
    const seen = new Set();
    return (Array.isArray(body?.streaming_url_list) ? body.streaming_url_list : [])
      .map((s) => ({ label: String(s?.label ?? ""), quality: Number(s?.quality) || 0, url: String(s?.url ?? "") }))
      .filter((s) => {
        try {
          const u = new URL(s.url);
          const ok = u.protocol === "https:" && u.pathname.endsWith(".m3u8") && MEDIA_HOSTS.some((re) => re.test(u.hostname)) && !seen.has(s.url);
          seen.add(s.url);
          return ok;
        } catch {
          return false;
        }
      })
      .sort((a, b) => b.quality - a.quality);
  } catch {
    return [];
  }
}

/* ───────────────────────────── IPC ───────────────────────────── */

const fromUi = (e) => (win && e.sender === win.webContents) || (splash && e.sender === splash.webContents);

function wireIpc() {
  ipcMain.handle("jkc:api", async (e, p, o) => {
    if (!fromUi(e)) return { error: { status: 403, message: "Ditolak" } };
    try {
      return await api.get(p, { fresh: !!o?.fresh });
    } catch (err) {
      return { error: { status: err.status ?? 0, message: err.status ? err.message : "Tidak ada koneksi internet" } };
    }
  });
  // Cadangan bila daftar live belum membawa URL stream: ambil langsung dari API publik Showroom (tanpa login).
  ipcMain.handle("jkc:sr-streams", async (e, room) => (fromUi(e) && /^\d{1,12}$/.test(String(room)) ? showroomStreams(String(room)) : []));
  ipcMain.handle("jkc:state", (e) => (fromUi(e) ? state() : null));
  ipcMain.handle("jkc:live", (e) => (fromUi(e) ? liveList : []));

  const on = (ch, fn) => ipcMain.on(`jkc:${ch}`, (e, ...a) => fromUi(e) && fn(...a));
  on("set", (k, v) => setSetting(k, v));
  on("open-external", openExternal);
  on("menu", (at) => appMenu().popup({ window: win, x: Math.round(at?.x ?? 0), y: Math.round(at?.y ?? BAR) }));
  on("update-install", installUpdate);
  on("update-check", () => checkUpdate(true));
  on("fullscreen", (v) => win?.setFullScreen(!!v));
}

/* ───────────────────────────── Siklus aplikasi ───────────────────────────── */

function quit() {
  quitting = true;
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showMain);
  app.on("before-quit", () => {
    quitting = true;
    saveBounds();
  });
  app.on("window-all-closed", () => {
    if (!store.get("closeToTray")) app.quit();
  });

  app.whenReady().then(() => {
    store = createStore(app.getPath("userData"));
    api = createApi({
      fetch: (...a) => net.fetch(...a),
      userAgent: `JKT48Connect-Desktop/${app.getVersion()} (${process.platform})`,
      cacheDir: path.join(app.getPath("userData"), "data-cache"),
    });
    serveApp();
    setupSession();
    wireIpc();
    createTray();
    startLive();
    startUpdater();
    // Dibuka otomatis saat Windows mulai (--hidden): langsung ke tray, tanpa jendela.
    if (!(process.argv.includes("--hidden") && store.get("closeToTray"))) {
      createSplash();
      createWindow();
    }
  });
}
