# JKT48Connect — Revamp UI

Remake UI publik JKT48Connect dengan gaya **Fan Signal**, identitas visual yang sama dengan gambar desain
`jkt48connect` dari API. Data dari [JKT48Connect API](https://api.jkt48connect.app/docs), animasi penuh memakai
**GSAP**, siap jalan di **Cloudflare Workers** atau **Cloudflare Pages**.

![Beranda](docs/screenshots/02-home-desktop.jpg)

![Animasi](docs/demo.webp)

## Konsep

| Bagian | Wujud |
| --- | --- |
| Layout | Desktop 3 kolom: sidebar tinta di kiri, kolom utama, sidebar kanan (cari member, jadwal, birthday). HP: dock mengambang di bawah plus menu layar penuh. |
| Intro | "Oshi Roulette": layar merah, hitung mundur 3-2-1, dua baris teks raksasa bergaris tepi melaju berlawanan. 12 photocard member asli tersusun jadi cincin 3D yang berputar kencang lalu melambat dan berhenti di satu kartu acak: kartu membesar, hati berhamburan, dan nama "oshi hari ini" muncul. Lalu kartu terlempar keluar dan layar merah terbelah atas-bawah. Diputar setiap situs dibuka, bisa dilewati. |
| Navigasi | Desktop: panel tinta melayang dengan menu berkelompok (Utama/Arsip/Info) dan nomor 01–10, bisa diciutkan jadi rail ikon (tombol di bawah panel atau tombol `[`, pilihan diingat) dengan tooltip label. Pil merah meluncur (elastic) ke menu aktif, sorotan tipis mengikuti kursor, dan kartu "On air" menampilkan member yang live atau hitung mundur show berikutnya. HP: dock tinta, menu aktif melebar jadi pil merah berlabel, tombol kisi membuka menu merah layar penuh yang mekar melingkar. Ticker sinyal di topbar. |
| Hero | Carousel banner desain **jkt48connect** (kartu notifikasi live + banner jadwal show): wipe, zoom pelan, progress bar per slide, bisa digeser. Show yang desainnya masih *pending* tampil sebagai panel merah. |
| Isi | Statistik yang menghitung naik, kartu dengan tilt 3D, nomor merah "01" ala lineup, judul "JUDUL / jumlah" yang muncul huruf demi huruf, poster jadwal potret jkt48connect, dan daftar jadwal yang masuk bertahap. |
| Transisi halaman | Rana lima kolom merah menutup kolom utama dari bawah, nama halaman tujuan (dengan nomor menunya) tersusun huruf demi huruf di tengah, lalu rana terbuka ke atas dan konten baru naik. Konten baru disembunyikan sebelum paint supaya pergantian tidak terlihat. |
| Footer | Blok tinta di dasar kolom utama: tagline, kolom tautan, tombol sosial, wordmark raksasa JKT48CONNECT yang tersusun huruf demi huruf saat discroll, jam WIB, dan tombol kembali ke atas. |
| Latar | Polos (krem / gelap), tanpa pola. |

Font: **Archivo** (condensed untuk judul) dan **IBM Plex Mono** (label kecil), self-hosted via Fontsource. Palet krem +
merah JKT48Connect, dengan mode gelap opsional. Semua gambar desain (jadwal, notifikasi live, leaderboard) memakai
tema `jkt48connect`, bukan photobook.

## Halaman & endpoint

| Route | Isi | Endpoint |
| --- | --- | --- |
| `/` | Carousel banner jkt48connect, statistik, live, poster show, recent live, berita, video (+ jadwal & birthday di sidebar) | beberapa |
| `/live` | Member yang sedang live (filter Showroom / IDN) | `GET /api/now_live?group=jkt48` |
| `/theater`, `/theater/:id` | Daftar show & detail: lineup, seitansai, graduation, setlist, rekaman, poster jadwal | `GET /api/theater`, `/api/theater/:id` |
| `/schedule` | Show, exclusive, dan event per hari (WIB) | `GET /api/next_schedule`, `/api/theater` |
| `/member`, `/member/:id` | Direktori (cari, aktif/graduated) & profil | `GET /api/member`, `/api/member/:id` |
| `/birthday` | Ulang tahun terdekat + hitung mundur | `GET /api/next_birthday` |
| `/recent`, `/recent/:id` | Rekap live: durasi, penonton, gold/poin, top supporter, gift, semua cuplikan (grid / daftar rinci + penampil), leaderboard, replay yang diputar langsung di situs (terbuka 72 jam setelah live) | `GET /api/recent`, `/api/recent/:id` |
| `/news`, `/news/:id` | Berita resmi (HTML disanitasi DOMPurify) | `GET /api/news`, `/api/news/:id` |
| `/video` | Upload terbaru JKT48 & JKT48 TV | `GET /api/jkt48_youtube` |
| `/about`, `/disclaimer`, `/terms`, `/privacy` | Statis | — |

Bentuk respons sudah dicocokkan dengan output asli API (Oktober 2026) di [`src/lib/jkt48.ts`](src/lib/jkt48.ts).
Beberapa hal yang ditangani di sana:

- Waktu show di daftar theater ada di `start_date`.
- Lineup di daftar tidak membawa foto, jadi foto dicocokkan dari `/api/member`.
- `now_live` bisa memuat sesi yang sama dua kali, jadi daftarnya dideduplikasi.
- Item exclusive/event dari `next_schedule` tidak punya halaman detail (API membalas 502), jadi tampil tanpa link.
- Replay di `/recent/:id` diputar langsung dari `recordings[].url` (MP4 H.264, CORS terbuka) dengan pemutar custom ([`video-player.tsx`](src/components/video-player.tsx)): bar seek dengan buffer dan pratinjau waktu, lompat ±10 detik, volume (diingat), kecepatan 0.5–2×, picture-in-picture, layar penuh, kontrol yang menghilang sendiri, pintasan keyboard (spasi/K, J/L, ←/→, ↑/↓, M, F, 0–9), dan ketuk dua kali kiri/kanan di HP. Pemutar baru muncul 72 jam setelah `live_info.date.end` (`REPLAY_LOCK_HOURS` di `src/lib/jkt48.ts`); sebelum itu tampil panel terkunci dengan hitung mundur, dan berubah jadi pemutar dengan sendirinya saat waktunya tiba. Rekaman yang terdiri dari beberapa bagian bisa dipilih per bagian.
- Cuplikan live diambil dari `live_info.screenshot` (nama file = waktu tangkap, epoch ms). Semua cuplikan ditampilkan: grid 18 pertama (bisa dibuka semua) atau daftar rinci berisi nomor, menit ke- (dihitung dari awal live), dan jam WIB. Klik membuka penampil layar penuh dengan filmstrip, panah, keyboard ←/→/Esc, dan geser.
- Gambar di isi berita jkt48.com menolak hotlink (403 bila Referer dari domain lain, plus `Cross-Origin-Resource-Policy: same-site`), jadi dilewatkan `/api/media?url=…`.

## API key tetap di server

Sesuai docs JKT48Connect, API key **tidak boleh** ada di JavaScript browser. Browser hanya memanggil `/api/*` di
domain situs sendiri. Proxy di [`worker/proxy.ts`](worker/proxy.ts) lalu:

- menambahkan header `X-API-Key` dari secret `JKT48CONNECT_API_KEY`,
- hanya meneruskan endpoint publik yang dipakai UI (allowlist),
- meng-cache respons di edge (live 20 detik, recent 60 detik, lainnya 5 menit) agar kuota hemat,
- menyajikan salinan terakhir bila upstream error (5xx/jaringan).

`/api/media?url=…` mengambil gambar berita dari `jkt48.com` (hanya host itu) di server tanpa Referer, lalu menyajikannya dari domain situs sendiri dengan cache edge 7 hari.

Gambar (foto member, desain jadwal, gift, cuplikan) memakai URL media dari respons API dan bisa dibuka tanpa key.

## Menjalankan lokal

```sh
npm install
cp .dev.vars.example .dev.vars   # isi JKT48CONNECT_API_KEY=jkc_…
npm run dev                      # http://localhost:5173
```

Dev server meneruskan `/api/*` ke api.jkt48connect.app dengan key dari `.dev.vars`. Di jaringan yang memakai proxy
keluar, set `HTTPS_PROXY` dan dev server akan memakainya.

## Deploy ke Cloudflare

### Setup otomatis (sekali saja)

```sh
npm run cf:setup            # login wrangler, minta API key, tulis .dev.vars, simpan secret ke Workers
npm run deploy              # build + wrangler deploy
```

### Cloudflare Workers (disarankan)

Konfigurasi ada di [`wrangler.jsonc`](wrangler.jsonc): static assets dari `dist/` dengan fallback SPA, dan `/api/*`
selalu masuk Worker dulu.

```sh
npx wrangler login
npm run deploy
npm run cf:secret           # = wrangler secret put JKT48CONNECT_API_KEY
```

Uji Worker hasil build secara lokal: `npm run cf:dev`.

### Workers Builds (hubungkan repo dari dashboard Cloudflare)

Nama Worker di dashboard harus sama dengan `name` di `wrangler.jsonc` (sekarang `jkt48connet-revamp`). Pengaturan
build:

| Field | Isi |
| --- | --- |
| Build command | kosongkan (wrangler menjalankan `npm run build` sendiri lewat `build.command`) |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |

Lalu tambahkan secret `JKT48CONNECT_API_KEY` di **Worker → Settings → Variables and Secrets**.

### Cloudflare Pages

Folder [`functions/api/[[path]].ts`](functions/api/%5B%5Bpath%5D%5D.ts) memakai proxy yang sama.

```sh
npm run cf:setup -- --pages     # buat project "jkt48connect" + simpan secret
npm run deploy:pages            # build + wrangler pages deploy dist
```

Bila menghubungkan repo lewat dashboard Pages: build command `npm run build`, output `dist`, lalu tambahkan
secret `JKT48CONNECT_API_KEY` di **Settings → Variables and Secrets**.

### Auto deploy dari GitHub

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) men-deploy Worker setiap push ke `main`. Tambahkan
repository secrets berikut:

| Secret | Isi |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token dengan template "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID Cloudflare |
| `JKT48CONNECT_API_KEY` | Key `jkc_…` dari [dashboard](https://api.jkt48connect.app/dashboard/keys) |

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) menjalankan typecheck + build di setiap PR.

## Script

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Dev server dengan proxy API |
| `npm run build` | Build produksi ke `dist/` |
| `npm run typecheck` | Typecheck app & Worker |
| `npm run cf:setup` | Setup Cloudflare interaktif |
| `npm run cf:dev` | Build + `wrangler dev` |
| `npm run deploy` / `deploy:pages` | Deploy ke Workers / Pages |

## Struktur

```
src/
  components/   intro, shell (sidebar kiri, topbar, sidebar kanan, footer, dock + menu HP), carousel, motion (GSAP), kartu
  pages/        satu file per halaman (lazy-loaded)
  lib/          api.ts (klien), jkt48.ts (normalisasi respons), queries, format, gsap
  hooks/        use-reveal (ScrollTrigger), use-member-index, use-theme, use-clock
worker/         Cloudflare Worker + proxy API
functions/      Cloudflare Pages Functions
scripts/        cf-setup.mjs
docs/screenshots/
```

## Screenshot

Diambil dari dev server dengan data asli API pada 21–22 Oktober 2026.

| | |
| --- | --- |
| ![Intro: cincin photocard berputar](docs/screenshots/01-intro.jpg) | ![Intro: oshi hari ini](docs/screenshots/01b-intro-open.jpg) |
| ![Beranda gelap](docs/screenshots/02b-home-desktop-dark.jpg) | ![Live](docs/screenshots/04-live.jpg) |
| ![Theater](docs/screenshots/05-theater.jpg) | ![Detail theater](docs/screenshots/06-theater-detail.jpg) |
| ![Jadwal](docs/screenshots/07-schedule.jpg) | ![Member](docs/screenshots/08-members.jpg) |
| ![Profil member](docs/screenshots/09-member-detail.jpg) | ![Birthday](docs/screenshots/10-birthday.jpg) |
| ![Recent](docs/screenshots/11-recent.jpg) | ![Detail recent](docs/screenshots/12-recent-detail.jpg) |
| ![Replay terkunci 72 jam](docs/screenshots/22-replay-locked.jpg) | ![Pemutar replay custom](docs/screenshots/22b-replay-player.jpg) |
| ![Cuplikan: daftar rinci](docs/screenshots/23-cuplikan-daftar.jpg) | ![Cuplikan: grid](docs/screenshots/23b-cuplikan-grid.jpg) |
| ![Transisi halaman](docs/screenshots/24-transisi-halaman.jpg) | |
| ![Berita](docs/screenshots/13-news.jpg) | ![Detail berita](docs/screenshots/14-news-detail.jpg) |
| ![Beranda mobile](docs/screenshots/17-home-mobile.jpg) | ![Menu layar penuh mobile](docs/screenshots/19-mobile-menu.jpg) |
| ![Footer mobile](docs/screenshots/20-footer-mobile.jpg) | ![Sidebar desktop diciutkan](docs/screenshots/21-sidebar-collapsed.jpg) |

---

Fan-made · tidak berafiliasi dengan JKT48 Operation Team.
