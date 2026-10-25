/**
 * Judul & deskripsi halaman, dipakai dua tempat supaya selalu sama:
 * - worker/seo.ts menyisipkannya ke HTML awal (yang dibaca Google sebelum JavaScript jalan);
 * - root layout mengganti document.title saat pengguna berpindah halaman.
 */
export const SITE_NAME = "JKT48Connect";
export const SITE_TAGLINE = "Live Member, Jadwal Theater & Berita JKT48";
export const SITE_DESCRIPTION =
  "Pantau member JKT48 yang sedang live di IDN & Showroom, jadwal show theater, rekap live dan replay, ulang tahun member, serta berita terbaru JKT48 secara real-time.";

export type PageMeta = { title: string; description: string; h1: string };

/** Halaman statis; urutan ini juga dipakai untuk navigasi di HTML awal (membantu Google memilih sitelink). */
export const STATIC_PAGES: Record<string, PageMeta & { nav?: string }> = {
  "/": { title: `${SITE_NAME} — ${SITE_TAGLINE}`, h1: SITE_NAME, description: SITE_DESCRIPTION },
  "/live": {
    nav: "Live",
    title: "Member JKT48 yang Sedang Live di IDN & Showroom",
    h1: "Live sekarang",
    description: "Daftar member JKT48 yang sedang live di IDN Live dan Showroom saat ini, diperbarui otomatis setiap beberapa detik.",
  },
  "/theater": {
    nav: "Theater",
    title: "Jadwal Theater JKT48 — Show, Setlist & Member Tampil",
    h1: "Jadwal theater JKT48",
    description: "Jadwal show theater JKT48 terbaru dan arsip lengkap: tanggal, jam (WIB), setlist, dan member yang tampil di setiap show.",
  },
  "/schedule": {
    nav: "Jadwal",
    title: "Jadwal Event & Show JKT48 Mendatang",
    h1: "Jadwal mendatang",
    description: "Kalender show theater, event, dan meet & greet JKT48 yang akan datang, lengkap dengan hitung mundur.",
  },
  "/member": {
    nav: "Member",
    title: "Daftar Member JKT48 — Profil, Ulang Tahun & Sosial Media",
    h1: "Member JKT48",
    description: "Profil semua member JKT48 aktif dan lulus: nama lengkap, tanggal lahir, tinggi, golongan darah, jikoshoukai, dan akun sosial media.",
  },
  "/recent": {
    nav: "Recent",
    title: "Rekap Live Member JKT48 — Penonton, Gift & Replay",
    h1: "Rekap live",
    description: "Rekap live member JKT48 di IDN dan Showroom: durasi, jumlah penonton, gift, top supporter, cuplikan layar, dan replay.",
  },
  "/birthday": {
    nav: "Ulang tahun",
    title: "Ulang Tahun Member JKT48",
    h1: "Ulang tahun member",
    description: "Daftar ulang tahun member JKT48 terdekat beserta hitung mundurnya.",
  },
  "/news": {
    nav: "Berita",
    title: "Berita JKT48 Terbaru",
    h1: "Berita JKT48",
    description: "Kumpulan berita dan pengumuman resmi terbaru dari JKT48.",
  },
  "/video": {
    nav: "Video",
    title: "Video JKT48 Terbaru di YouTube",
    h1: "Video JKT48",
    description: "Video terbaru dari kanal YouTube resmi JKT48.",
  },
  "/discord": {title:"Dashboard Bot Discord JKT48Connect",h1:"Discord",description:"Tambahkan JKT48Connect ke server Discord dan kelola channel, role mention, serta notifikasi komunitasmu."},
  "/developer": {
    title: "JKT48Connect API untuk Developer",
    h1: "JKT48Connect API",
    description: "Pakai data live, theater, member, recent, dan berita JKT48 untuk bot, aplikasi, atau situsmu sendiri lewat JKT48Connect API.",
  },
  "/about": {
    nav: "Tentang",
    title: "Tentang JKT48Connect",
    h1: "Tentang JKT48Connect",
    description: "JKT48Connect adalah proyek komunitas fans JKT48: situs, aplikasi Android, bot X & Discord, dan Public API.",
  },
  "/disclaimer": { title: "Disclaimer", h1: "Disclaimer", description: "JKT48Connect adalah proyek penggemar yang tidak berafiliasi dengan JKT48 Operation Team." },
  "/terms": { title: "Syarat Penggunaan", h1: "Syarat penggunaan", description: "Syarat penggunaan situs dan layanan JKT48Connect." },
  "/privacy": { title: "Kebijakan Privasi", h1: "Kebijakan privasi", description: "Bagaimana JKT48Connect memperlakukan data pengunjung." },
};

/** "Judul" → "Judul | JKT48Connect" (beranda sudah memuat nama situs). */
export function fullTitle(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
}

/** Potong deskripsi di batas kata, maks. ±160 karakter (panjang yang ditampilkan Google). */
export function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,.;:\s]+$/, "")}…`;
}
