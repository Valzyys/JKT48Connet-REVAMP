"use strict";
const PIXELS = [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [2, 4]];
const cross = document.getElementById("cross");
PIXELS.forEach(([x, y], i) => {
  const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  Object.entries({ x: x * 10 + 0.5, y: y * 10 + 0.5, width: 9, height: 9, rx: 1.6 }).forEach(([k, v]) => r.setAttribute(k, v));
  r.style.animationDelay = `${(0.05 + i * 0.045).toFixed(3)}s`;
  cross.append(r);
});

const v = new URLSearchParams(location.search).get("v");
if (v && /^[\d.]+$/.test(v)) document.getElementById("ver").textContent = `v${v}`;

// Progres palsu yang pelan-pelan naik sampai sinyal asli datang dari main (tidak pernah mentok 100% sendiri).
let shown = 0.08;
const bar = document.getElementById("bar");
const set = (p) => {
  shown = Math.max(shown, Math.min(1, p));
  bar.style.width = `${(shown * 100).toFixed(1)}%`;
};
const creep = setInterval(() => set(shown + (0.9 - shown) * 0.04), 220);
set(0.12);

window.jkc?.on("splash", (m) => {
  if (m.text) document.getElementById("status").textContent = m.text;
  if (typeof m.progress === "number") set(m.progress);
  if (m.done) {
    clearInterval(creep);
    set(1);
    setTimeout(() => document.getElementById("card").classList.add("out"), 60);
  }
});
