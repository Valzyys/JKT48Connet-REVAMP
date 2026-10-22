// Pengganti Service Worker situs versi lama: hapus semua cache, lepas pendaftaran, lalu muat ulang tab
// yang masih dikendalikannya. Situs ini tidak memakai Service Worker.
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
    })(),
  );
});
