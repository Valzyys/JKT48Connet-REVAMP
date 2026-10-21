# JKT48Connect — Revamp UI

Remake UI publik JKT48Connect dengan konsep **pertunjukan theater**. Data dari
[JKT48Connect API](https://api.jkt48connect.app/docs), animasi memakai **GSAP**, dan situs siap jalan di
**Cloudflare Workers** atau **Cloudflare Pages**.

![Beranda](docs/screenshots/02-home-desktop-dark.jpg)

## Konsep

Semua bagian situs meminjam bahasa visual JKT48 Theater, bukan template landing page biasa:

| Bagian | Wujud |
| --- | --- |
| Intro | Tirai beludru tertutup, lampu sorot menyapu panggung, papan LED "JKT48CONNECT" menyala huruf demi huruf, lalu tirai dibuka (GSAP). Sekali per sesi, bisa dilewati, otomatis mati untuk _reduced motion_. |
| Header & navigasi | Logo potongan tiket. Menu bernomor seperti setlist theater (`M01 Live`, `M02 Theater`, …). Papan **ON AIR** LED menyala dan berkedip saat ada member yang live. Di HP, menu terbuka sebagai kartu setlist. |
| Hero | Tiket fisik untuk show berikutnya: garis sobek dengan takik, kode show sebagai nomor tiket, barcode, hitung mundur, cap "Seitansai". Di sebelahnya panggung ON AIR berisi member yang live dengan cincin penlight. Lampu sorot latar mengikuti kursor. |
| Footer | _Curtain call_: rumbai tirai, "Terima kasih sudah datang ke theater", hitung mundur ke show berikutnya. |
| Isi halaman | Daftar bergaya papan jadwal: tanggal besar, garis tipis, kolom angka sejajar. |

Font: **Archivo** (variable, versi condensed untuk judul) dan **Doto** (dot-matrix untuk papan LED), self-hosted via
Fontsource. Tema gelap ("lampu theater dimatikan") jadi default; tema terang berwarna kertas tiket.

## Halaman & endpoint

| Route | Isi | Endpoint |
| --- | --- | --- |
| `/` | Tiket show berikutnya, ON AIR, jadwal theater, recent live, berita, ulang tahun, video | beberapa |
| `/live` | Member yang sedang live (filter Showroom / IDN) | `GET /api/now_live?group=jkt48` |
| `/theater`, `/theater/:id` | Daftar show & detail: lineup, seitansai, graduation, setlist, rekaman, poster jadwal | `GET /api/theater`, `/api/theater/:id` |
| `/schedule` | Show, exclusive, dan event per hari (WIB) | `GET /api/next_schedule`, `/api/theater` |
| `/member`, `/member/:id` | Direktori (cari, aktif/graduated) & profil | `GET /api/member`, `/api/member/:id` |
| `/birthday` | Ulang tahun terdekat + hitung mundur | `GET /api/next_birthday` |
| `/recent`, `/recent/:id` | Rekap live: durasi, penonton, gold/poin, top supporter, gift, cuplikan, leaderboard, replay | `GET /api/recent`, `/api/recent/:id` |
| `/news`, `/news/:id` | Berita resmi (HTML disanitasi DOMPurify) | `GET /api/news`, `/api/news/:id` |
| `/video` | Upload terbaru JKT48 & JKT48 TV | `GET /api/jkt48_youtube` |
| `/about`, `/disclaimer`, `/terms`, `/privacy` | Statis | — |

Bentuk respons sudah dicocokkan dengan output asli API (Oktober 2026) di [`src/lib/jkt48.ts`](src/lib/jkt48.ts).
Beberapa hal yang ditangani di sana:

- Waktu show di daftar theater ada di `start_date`.
- Lineup di daftar tidak membawa foto, jadi foto dicocokkan dari `/api/member`.
- `now_live` bisa memuat sesi yang sama dua kali, jadi daftarnya dideduplikasi.
- Item exclusive/event dari `next_schedule` tidak punya halaman detail (API membalas 502), jadi tampil tanpa link.

## API key tetap di server

Sesuai docs JKT48Connect, API key **tidak boleh** ada di JavaScript browser. Browser hanya memanggil `/api/*` di
domain situs sendiri. Proxy di [`worker/proxy.ts`](worker/proxy.ts) lalu:

- menambahkan header `X-API-Key` dari secret `JKT48CONNECT_API_KEY`,
- hanya meneruskan endpoint publik yang dipakai UI (allowlist),
- meng-cache respons di edge (live 20 detik, recent 60 detik, lainnya 5 menit) agar kuota hemat,
- menyajikan salinan terakhir bila upstream error (5xx/jaringan).

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
  components/   intro (tirai), header (setlist + ON AIR), hero (tiket), footer (curtain call), baris & kartu
  pages/        satu file per halaman (lazy-loaded)
  lib/          api.ts (klien), jkt48.ts (normalisasi respons), queries, format, gsap
  hooks/        use-reveal (ScrollTrigger), use-member-index, use-theme
worker/         Cloudflare Worker + proxy API
functions/      Cloudflare Pages Functions
scripts/        cf-setup.mjs
docs/screenshots/
```

## Screenshot

Diambil dari dev server dengan data asli API pada 21 Oktober 2026.

| | |
| --- | --- |
| ![Intro: tirai & papan LED](docs/screenshots/01-intro.jpg) | ![Intro: tirai dibuka](docs/screenshots/01b-intro-open.jpg) |
| ![Beranda terang](docs/screenshots/03-home-desktop-light.jpg) | ![Live](docs/screenshots/04-live.jpg) |
| ![Theater](docs/screenshots/05-theater.jpg) | ![Detail theater](docs/screenshots/06-theater-detail.jpg) |
| ![Jadwal](docs/screenshots/07-schedule.jpg) | ![Member](docs/screenshots/08-members.jpg) |
| ![Profil member](docs/screenshots/09-member-detail.jpg) | ![Birthday](docs/screenshots/10-birthday.jpg) |
| ![Recent](docs/screenshots/11-recent.jpg) | ![Detail recent](docs/screenshots/12-recent-detail.jpg) |
| ![Berita](docs/screenshots/13-news.jpg) | ![Detail berita](docs/screenshots/14-news-detail.jpg) |
| ![Beranda mobile](docs/screenshots/17-home-mobile.jpg) | ![Menu setlist mobile](docs/screenshots/19-mobile-menu.jpg) |

---

Fan-made · tidak berafiliasi dengan JKT48 Operation Team.
