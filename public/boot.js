// Terapkan tema & lebar sidebar sebelum render pertama supaya tidak berkedip.
// File terpisah (bukan <script> inline) supaya Content-Security-Policy bisa melarang script inline.
document.documentElement.classList.add("js");
try {
  // Default terang (kertas krem brand); mode gelap bila dipilih.
  document.documentElement.classList.toggle("dark", localStorage.getItem("jkt48c:theme") === "dark");
  if (localStorage.getItem("jkt48c:side") === "collapsed") document.documentElement.dataset.side = "collapsed";
} catch (e) {}

// Situs versi lama pernah memasang Service Worker yang menjawab /api/* dari cache-nya sendiri (JSON lama),
// sehingga data tidak tampil. Situs ini tidak memakai Service Worker: hapus semuanya beserta cache-nya,
// lalu muat ulang sekali supaya halaman tidak lagi dikendalikan Service Worker lama.
(function () {
  try {
    if (!("serviceWorker" in navigator)) return;
    var controlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      var jobs = regs.map(function (r) { return r.unregister(); });
      if (window.caches && caches.keys) {
        jobs.push(caches.keys().then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); }));
      }
      return Promise.all(jobs).then(function () {
        if (controlled && regs.length && !sessionStorage.getItem("jc-sw-cleared")) {
          sessionStorage.setItem("jc-sw-cleared", "1");
          location.reload();
        }
      });
    }).catch(function () {});
  } catch (e) {}
})();
