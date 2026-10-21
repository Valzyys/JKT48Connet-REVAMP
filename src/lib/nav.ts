export type NavItem = { to: string; label: string };

/** Menu situs, bernomor seperti urutan lagu di setlist theater (M01, M02, …). */
export const NAV: NavItem[] = [
  { to: "/live", label: "Live" },
  { to: "/theater", label: "Theater" },
  { to: "/schedule", label: "Jadwal" },
  { to: "/member", label: "Member" },
  { to: "/news", label: "Berita" },
  { to: "/recent", label: "Recent" },
  { to: "/birthday", label: "Birthday" },
  { to: "/video", label: "Video" },
  { to: "/about", label: "Tentang" },
];

/** "M03" untuk item ke-3. */
export function setlistNo(i: number) {
  return `M${String(i + 1).padStart(2, "0")}`;
}

/** Nomor setlist untuk path halaman (dipakai judul halaman). */
export function setlistNoFor(path: string) {
  const i = NAV.findIndex((n) => path === n.to || path.startsWith(`${n.to}/`));
  return i >= 0 ? setlistNo(i) : "";
}

export const SOCIALS = [
  { label: "X @JKT48Connect", href: "https://x.com/JKT48Connect" },
  { label: "Bot Discord", href: "https://discord.com/discovery/applications/1305141693477027891" },
];
