// Terapkan tema & lebar sidebar sebelum render pertama supaya tidak berkedip.
// File terpisah (bukan <script> inline) supaya Content-Security-Policy bisa melarang script inline.
document.documentElement.classList.add("js");
try {
  // Default terang (kertas krem brand); mode gelap bila dipilih.
  document.documentElement.classList.toggle("dark", localStorage.getItem("jkt48c:theme") === "dark");
  if (localStorage.getItem("jkt48c:side") === "collapsed") document.documentElement.dataset.side = "collapsed";
} catch (e) {}
