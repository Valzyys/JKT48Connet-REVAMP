/**
 * Data contoh untuk `npm run dev:mock` (preview UI tanpa API key / tanpa internet).
 * Bentuknya meniru respons mentah JKT48Connect API supaya normalizer di
 * src/lib/jkt48.ts ikut teruji. TIDAK dipakai di build produksi biasa.
 */
import type { Query } from "@/lib/api";

const HUES = [352, 8, 330, 20, 340, 0, 315, 25];

function portrait(name: string, i: number) {
  const h = HUES[i % HUES.length];
  const init = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h},78%,62%)'/><stop offset='1' stop-color='hsl(${(h + 30) % 360},70%,28%)'/></linearGradient></defs><rect width='400' height='500' fill='url(#g)'/><circle cx='200' cy='205' r='88' fill='rgba(255,255,255,.22)'/><path d='M60 500c10-110 70-170 140-170s130 60 140 170z' fill='rgba(255,255,255,.22)'/><text x='200' y='228' text-anchor='middle' font-family='sans-serif' font-weight='800' font-size='72' fill='rgba(255,255,255,.9)'>${init}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function banner(title: string, i: number) {
  const h = HUES[(i + 3) % HUES.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h},80%,45%)'/><stop offset='.6' stop-color='hsl(${(h + 340) % 360},70%,22%)'/><stop offset='1' stop-color='#0b0b0d'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/><circle cx='1300' cy='180' r='260' fill='rgba(255,255,255,.08)'/><circle cx='260' cy='820' r='320' fill='rgba(255,255,255,.06)'/><text x='90' y='520' font-family='sans-serif' font-weight='800' font-size='120' fill='rgba(255,255,255,.92)' letter-spacing='-4'>${title}</text><text x='94' y='600' font-family='monospace' font-size='34' fill='rgba(255,255,255,.6)' letter-spacing='8'>JKT48 THEATER</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const NAMES = [
  ["Freya Jayawardana", "Freya", "7"],
  ["Angelina Christy", "Christy", "7"],
  ["Marsha Lenathea", "Marsha", "9"],
  ["Adeline Wijaya", "Adel", "9"],
  ["Feni Fitriyanti", "Feni", "3"],
  ["Gita Sekar Andarini", "Gita", "6"],
  ["Shania Gracia", "Gracia", "3"],
  ["Jessica Chandra", "Jessi", "7"],
  ["Indah Cahya", "Indah", "8"],
  ["Cornelia Vanisa", "Oniel", "8"],
  ["Febriola Sinambela", "Olla", "8"],
  ["Lulu Salsabila", "Lulu", "7"],
  ["Michelle Alexandra", "Michie", "11"],
  ["Catherina Vallencia", "Erine", "11"],
  ["Gabriela Abigail", "Ella", "10"],
  ["Aurellia", "Lia", "10"],
];

const members = NAMES.map(([name, nick, gen], i) => ({
  name,
  nicknames: [nick],
  img: portrait(name, i),
  url_key: nick.toLowerCase(),
  generation: gen,
  is_graduate: i === 6,
  room_id: 300000 + i,
}));

const SETLISTS = ["Cara Meminum Ramune", "Pajama Drive", "Aitakatta", "Tunas di Balik Seragam", "Ingin Bertemu", "Te wo Tsunaide"];

const DAY = 86400000;
const at = (offsetDays: number, hour: number) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setUTCHours(hour - 7, 0, 0, 0); // jam WIB
  return d.toISOString();
};

const shows = Array.from({ length: 14 }, (_, i) => {
  const title = SETLISTS[i % SETLISTS.length];
  const lineup = members.filter((_, j) => (j + i) % 3 !== 0).slice(0, 12);
  return {
    id: `show-${2600 + i}`,
    title,
    banner: banner(title, i),
    poster: banner(title, i),
    date: at(i < 9 ? Math.ceil(i / 2) : -(i - 8), i % 2 ? 19 : 14),
    member_count: lineup.length,
    members: lineup.map((m) => ({ id: m.url_key, name: m.name, img: m.img, url_key: m.url_key })),
    seitansai: i % 4 === 1 ? [{ id: lineup[0].url_key, name: lineup[0].name, img: lineup[0].img }] : [],
    url: "https://jkt48.com/theater/schedule",
    setlist: {
      title,
      description: `${title} adalah salah satu setlist theater JKT48 yang membawakan 16 lagu dengan cerita tentang mimpi, persahabatan, dan perjalanan menjadi idol.`,
    },
  };
}).sort((a, b) => +new Date(b.date) - +new Date(a.date));

const upcoming = [...shows].filter((s) => +new Date(s.date) > Date.now()).sort((a, b) => +new Date(a.date) - +new Date(b.date));

const lives = members.slice(0, 6).map((m, i) => ({
  name: m.name,
  img: m.img,
  url_key: i % 2 ? m.url_key : `JKT48_${m.name.split(" ")[0]}`,
  slug: `live-${i}`,
  room_id: m.room_id,
  type: i % 2 ? "idn" : "showroom",
  started_at: new Date(Date.now() - (i + 1) * 17 * 60000).toISOString(),
  title: i % 2 ? "Ngobrol santai malam ini ✨" : "",
  viewers: { num: 1200 + i * 830 },
}));

const recents = members.slice(2, 16).map((m, i) => {
  const end = Date.now() - (i + 1) * 95 * 60000;
  const duration = (25 + ((i * 13) % 70)) * 60000;
  return {
    _id: `r${i}`,
    data_id: `rec-${8800 + i}`,
    member: { name: m.name, nickname: m.nicknames[0], img: m.img, url: m.url_key },
    type: i % 3 ? "showroom" : "idn",
    points: 12000 + i * 3500,
    live_info: {
      duration,
      viewers: { num: 2400 + i * 610 },
      date: { start: new Date(end - duration).toISOString(), end: new Date(end).toISOString() },
      gift: {
        list: ["Rose", "Bintang", "Lightstick", "Hati", "Mahkota", "Balon", "Kue", "Pita"].map((name, k) => ({
          name,
          num: 400 - k * 45,
          user_count: 60 - k * 6,
        })),
      },
    },
    users: Array.from({ length: 140 + i * 9 }),
  };
});

const NEWS = [
  ["Pengumuman Jadwal Theater Bulan November 2026", "/images/icon.cat1.png"],
  ["Pembukaan Pendaftaran Handshake Festival Single Terbaru", "/images/icon.cat2.png"],
  ["Rilis Merchandise Edisi Ulang Tahun ke-15 JKT48", "/images/icon.cat8.png"],
  ["Informasi Penjualan Tiket Konser Akhir Tahun", "/images/icon.cat2.png"],
  ["Perubahan Lineup Pertunjukan Theater Akhir Pekan Ini", "/images/icon.cat1.png"],
  ["Pengumuman Single Baru: Video Klip Tayang Perdana", "/images/icon.cat4.png"],
  ["Birthday Show Spesial untuk Member Bulan Ini", "/images/icon.cat5.png"],
  ["Ketentuan Baru Penggunaan Kamera di Area Theater", "/images/icon.cat3.png"],
];
const news = NEWS.map(([title, label], i) => ({ id: String(1900 - i), title, label, date: at(-i * 2, 10) }));

const VIDEO_TITLES = [
  "JKT48 — Official Music Video (Dance Ver.)",
  "Behind The Scene Konser Akhir Tahun",
  "JKT48 TV: Tantangan Member Edisi Spesial",
  "Theater Highlight: Pajama Drive",
  "Vlog Member: Sehari di Studio",
  "JKT48 Cover Dance Challenge",
  "Pengumuman Spesial 15th Anniversary",
  "JKT48 TV: Masak Bersama Member",
];
const videos = VIDEO_TITLES.map((title, i) => ({
  id: `v${i}`,
  title,
  url: "https://www.youtube.com/@JKT48",
  date: at(-i, 18),
  channelTitle: i % 2 ? "JKT48 TV" : "JKT48",
  thumbnails: { high: { url: banner(title.split(":")[0].slice(0, 16), i + 2) } },
}));

const birthdays = members.slice(0, 10).map((m, i) => {
  const d = new Date(Date.now() + (i * 9 + (i ? 1 : 0)) * DAY);
  return { name: m.name, img: m.img, url_key: m.url_key, birthdate: `${2002 + (i % 6)}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` };
});

const events = [
  { id: "e1", title: "JKT48 15th Anniversary Concert", date: at(12, 18), type: "Konser", url: "https://jkt48.com" },
  { id: "e2", title: "Handshake Festival — Single ke-28", date: at(5, 10), type: "Handshake", url: "https://jkt48.com" },
];

function paged(arr: unknown[], key: string, q: Query) {
  const page = Number(q.page) || 1;
  const perpage = Number(q.perpage) || 10;
  return { [key]: arr.slice((page - 1) * perpage, page * perpage), page, perpage, total_count: arr.length };
}

export async function mockGet(path: string, query: Query): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 250));
  const [, , resource, id] = path.split("/");
  switch (resource) {
    case "now_live":
      return lives;
    case "member":
      if (id) {
        const m = members.find((x) => x.url_key === id) ?? members[0];
        return {
          ...m,
          fullname: m.name,
          nickname: m.nicknames[0],
          birthdate: birthdays.find((b) => b.url_key === m.url_key)?.birthdate ?? "2004-02-26",
          bloodType: "O",
          height: "160 cm",
          jikosokai: "Senyumku akan selalu menemanimu, setiap hari dan setiap saat!",
          description: `${m.name} adalah member JKT48 generasi ke-${m.generation}. Dikenal dengan energi positif dan senyum ceria di atas panggung.`,
          socials: [
            { title: "X", url: "https://x.com/officialJKT48" },
            { title: "Instagram", url: "https://instagram.com/jkt48" },
          ],
          upcomingTheater: upcoming.slice(0, 3),
        };
      }
      return members;
    case "theater":
      if (id) return { shows: [shows.find((s) => s.id === id) ?? shows[0]] };
      return paged(shows, "theater", query);
    case "next_schedule":
      return upcoming;
    case "jkt48event":
      return events;
    case "news":
      if (id) {
        const n = news.find((x) => x.id === id) ?? news[0];
        return {
          ...n,
          content:
            "<p>Terima kasih atas dukungan kalian selalu untuk JKT48.</p><p>Berikut kami informasikan detail pengumuman terbaru. Mohon perhatikan jadwal dan ketentuan yang berlaku agar semua dapat menikmati acara dengan nyaman.</p><ul><li>Tanggal: akan diumumkan melalui situs resmi</li><li>Lokasi: JKT48 Theater, fX Sudirman</li></ul><p>Informasi lebih lanjut akan disampaikan melalui kanal resmi JKT48.</p>",
        };
      }
      return paged(news, "news", query);
    case "birthday":
      return birthdays;
    case "recent":
      if (id) return recents.find((r) => r.data_id === id) ?? recents[0];
      return paged(recents, "recents", query);
    case "jkt48_youtube":
      return videos;
    default:
      return [];
  }
}
