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
| Intro | "Oshi Roulette": layar merah, hitung mundur 3-2-1, dua baris teks raksasa bergaris tepi melaju berlawanan. 12 photocard member asli tersusun jadi cincin 3D yang berputar kencang lalu melambat dan berhenti di satu kartu acak: kartu membesar, hati berhamburan, dan nama "oshi hari ini" muncul. Lalu kartu terlempar keluar dan layar merah terbelah atas-bawah. Putaran kartu baru dimulai setelah foto lineup selesai dimuat (paling lama 4,5 detik, dengan tanda "Memuat lineup…"), dan daftar member terakhir disimpan di perangkat sehingga kunjungan berikutnya langsung punya foto. Diputar setiap situs dibuka, bisa dilewati. |
| Navigasi | Desktop: panel tinta melayang dengan menu berkelompok (Utama/Arsip/Info) dan nomor 01–10, bisa diciutkan jadi rail ikon (tombol di bawah panel atau tombol `[`, pilihan diingat) dengan tooltip label. Pil merah meluncur (elastic) ke menu aktif, sorotan tipis mengikuti kursor, dan kartu "On air" menampilkan member yang live atau hitung mundur show berikutnya. HP: dock tinta, menu aktif melebar jadi pil merah berlabel, tombol kisi membuka menu merah layar penuh yang mekar melingkar. Ticker sinyal di topbar. |
| Hero | Carousel banner desain **jkt48connect** (kartu notifikasi live + banner jadwal show): wipe, zoom pelan, progress bar per slide, bisa digeser. Show yang desainnya masih *pending* tampil sebagai panel merah. |
| Isi | Statistik yang menghitung naik, kartu dengan tilt 3D, nomor merah "01" ala lineup, judul "JUDUL / jumlah" yang muncul huruf demi huruf, poster jadwal potret jkt48connect, dan daftar jadwal yang masuk bertahap. |
| Transisi halaman | "Signal burst" dari titik yang diklik: tiga cincin sinyal memancar dan pecahan piksel terlempar, gelombang merah lalu merah tua menutup kolom utama, logo piksel berputar dengan nomor dan nama halaman tujuan, lalu halaman baru mekar melingkar dengan tepi cincin kuning. Tanpa klik (keyboard, tombol back) pusatnya tengah kolom utama. Konten baru disembunyikan dengan clip sebelum paint. |
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
| `/developer` | Info JKT48Connect API untuk developer: terminal dengan angka hidup dari API, daftar endpoint yang dipakai situs, tiga langkah mulai, contoh kode (cURL/JavaScript/Python), ide pemakaian, tautan docs & dashboard key | beberapa (lewat proxy situs) |
| `/about`, `/disclaimer`, `/terms`, `/privacy` | Statis | — |

Bentuk respons sudah dicocokkan dengan output asli API (Oktober 2026) di [`src/lib/shape.ts`](src/lib/shape.ts) (dijalankan di server).
Beberapa hal yang ditangani di sana:

- Waktu show di daftar theater ada di `start_date`.
- Lineup di daftar tidak membawa foto, jadi foto dicocokkan dari `/api/member`.
- `now_live` bisa memuat sesi yang sama dua kali, jadi daftarnya dideduplikasi.
- Item exclusive/event dari `next_schedule` tidak punya halaman detail (API membalas 502), jadi tampil tanpa link.
- Replay di `/recent/:id` di-stream lewat `/api/replay` (token terenkripsi milik sesi, bukan URL MP4 asli) dengan pemutar custom ([`video-player.tsx`](src/components/video-player.tsx)): bar seek dengan buffer dan pratinjau waktu, lompat ±10 detik, volume (diingat), kecepatan 0.5–2×, picture-in-picture, layar penuh, kontrol yang menghilang sendiri, pintasan keyboard (spasi/K, J/L, ←/→, ↑/↓, M, F, 0–9), dan ketuk dua kali kiri/kanan di HP. Pemutar baru muncul 72 jam setelah `live_info.date.end` (`REPLAY_LOCK_HOURS` di `src/lib/shape.ts`, ditegakkan server); sebelum itu tampil panel terkunci dengan hitung mundur, dan berubah jadi pemutar dengan sendirinya saat waktunya tiba. Rekaman yang terdiri dari beberapa bagian bisa dipilih per bagian.
- Cuplikan live diambil dari `live_info.screenshot` (nama file = waktu tangkap, epoch ms). Semua cuplikan ditampilkan: grid 18 pertama (bisa dibuka semua) atau daftar rinci berisi nomor, menit ke- (dihitung dari awal live), dan jam WIB. Klik membuka penampil layar penuh dengan filmstrip, panah, keyboard ←/→/Esc, dan geser.
- Gambar di isi berita jkt48.com menolak hotlink (403 bila Referer dari domain lain, plus `Cross-Origin-Resource-Policy: same-site`), jadi dilewatkan `/api/media?url=…`.

## Keamanan: semua `/api/*` privat

API key **tidak pernah** sampai ke browser, dan data dari API diperlakukan sebagai resource privat. Browser hanya memanggil
`/api/*` di domain situs sendiri; proxy di [`worker/proxy.ts`](worker/proxy.ts) (dibantu [`worker/security.ts`](worker/security.ts))
menerapkan lapisan berikut:

| Lapisan | Detail |
| --- | --- |
| Penjaga anti-iseng | Setiap upaya mengakali (tanda tangan request dipalsukan, request diputar ulang, probing endpoint/parameter, token replay milik orang lain, banjir request, akses dari situs lain atau langsung di address bar) memberi poin curiga ke IP ([`worker/guard.ts`](worker/guard.ts)). ≥ 10 poin dalam 15 menit → IP diblokir 1 jam (berulang: 6 jam, 24 jam). Seluruh situs lalu menampilkan **halaman blokir** berisi ID insiden, alasan, waktu, dan ajakan screenshot untuk dikirim ke admin. State disimpan di Durable Object `Guard` (dibuat otomatis saat deploy); setiap pelanggaran tercatat di log Worker (`{"guard":"strike",…}`) sehingga ID insiden bisa dicari. Hal yang bisa terjadi pada pengunjung biasa tidak diberi poin: cookie kedaluwarsa atau tidak cocok (mis. setelah `SESSION_SECRET` diganti) cukup membuat sesi baru, jam perangkat yang meleset disinkron ulang, dan browser tanpa header asal ditolak tanpa poin. Blokir selalu sementara: halaman blokir menampilkan hitung mundur dan memuat ulang sendiri saat waktunya habis. Membuka lebih cepat: lihat [Membuka blokir](#membuka-blokir). |
| Sesi wajib | `POST /api/session` memberi cookie `__Host-jc_s` (HttpOnly, Secure, SameSite=Strict, ditandatangani HMAC-SHA256, 12 jam, diperpanjang otomatis). Tanpa cookie valid semua `/api/*` membalas 401. |
| Tukar kunci ECDH | Saat membuat sesi browser mengirim kunci publik ECDH P-256 (kunci privat tidak bisa diekspor). Server membungkus rahasia sesi dengan kunci hasil ECDH, sehingga kunci sesi tidak pernah lewat jaringan dalam bentuk terbaca dan disimpan browser sebagai `CryptoKey` yang tidak bisa diekspor ([`src/lib/wire.ts`](src/lib/wire.ts)). |
| Request bertanda tangan | Setiap request data membawa HMAC-SHA256 atas method, path+query, timestamp, dan nonce acak. Tanda tangan salah, timestamp > 60 detik, atau nonce yang dipakai ulang ditolak (dan diberi poin) → request yang disalin ("Copy as cURL") tidak bisa diputar ulang, dan request tanpa kunci sesi tidak bisa dibuat. |
| Respons terenkripsi | Isi setiap respons data dienkripsi AES-256-GCM dengan kunci sesi (AAD = path+query). Di tab Network/HAR hanya terlihat `{"v":1,"d":"…"}`; respons tidak bisa dibuka sesi lain, diubah, atau ditukar antar endpoint. |
| Turnstile (opsional) | Bila `TURNSTILE_SECRET_KEY` (server) dan `VITE_TURNSTILE_SITE_KEY` (build) diisi, sesi baru hanya diberikan setelah lolos Cloudflare Turnstile, sehingga bot/skrip tidak bisa membuat sesi. |
| Same-origin | Permintaan lintas situs ditolak 403 (`Sec-Fetch-Site`, cadangan Origin/Referer): tidak bisa di-embed/hotlink dari domain lain, tidak ada CSRF. |
| Rate limit | Binding Workers `API_LIMITER` (300/menit per sesi) dan `SESSION_LIMITER` (30 sesi/menit per IP), lihat `wrangler.jsonc`. |
| Allowlist ketat | Hanya route yang dipakai UI, ID divalidasi, parameter query di-allowlist & dibatasi (`perpage` ≤ 40). Parameter lain → 400, jadi URL acak tidak bisa memaksa cache miss dan menghabiskan kuota API key. |
| Normalisasi di server | Respons upstream dibentuk ulang di server ([`src/lib/shape.ts`](src/lib/shape.ts)); browser hanya menerima field yang dipakai UI, URL selain http(s) dibuang. |
| Cache edge + stale-while-revalidate | Respons yang sudah dibentuk disimpan di cache edge per endpoint (live 20 detik, recent 60 detik, lainnya 5 menit). Begitu kedaluwarsa, salinan lama yang masih cukup baru (≤ 10 menit untuk data cepat basi, ≤ 6 jam untuk lainnya) langsung dikirim dan upstream diperbarui di latar belakang, jadi pengunjung tidak menunggu upstream (± 1–3 detik). Request identik yang berjalan bersamaan digabung jadi satu fetch per isolate. |
| Replay dikunci server | Selama 72 jam setelah live, server **tidak mengirim URL rekaman apa pun**. Setelahnya URL MP4 asli diganti `/api/replay?t=…`: token AES-256-GCM (URL asli tidak terbaca), terikat ke sesi (tautan yang dibagikan tidak berlaku di browser lain), kedaluwarsa 6 jam, dan video di-stream lewat Worker (mendukung Range/seek). |
| Media | `/api/media?url=…` hanya `https://*.jkt48.com`, redirect dicek tiap lompatan, hanya JPEG/PNG/WebP/GIF/AVIF (SVG ditolak), maks. 8 MB. |
| Header | Aset statis: [`public/_headers`](public/_headers) (CSP tanpa script inline, `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP). `/api/*`: CSP `sandbox`, CORP same-origin, `Cache-Control: private`. |
| Error generik | Pesan/isi error upstream tidak diteruskan ke browser; detail hanya di log Worker. |

Secret Worker:

| Secret | Wajib | Isi |
| --- | --- | --- |
| `JKT48CONNECT_API_KEY` | ya | Key `jkc_…` |
| `SESSION_SECRET` | disarankan | String acak ≥ 32 karakter untuk menandatangani sesi & token replay. Bila kosong diturunkan (HKDF) dari API key. Mengganti nilainya membatalkan semua sesi. |
| `TURNSTILE_SECRET_KEY` | opsional | Secret key Turnstile; pasangkan dengan variabel build `VITE_TURNSTILE_SITE_KEY`. |
| `GUARD_ADMIN_TOKEN` | opsional | Token admin acak ≥ 24 karakter (mis. `openssl rand -base64 32`) untuk membuka blokir lewat `npm run guard:unblock`. Tanpa token ini endpoint admin tidak ada. |

Batasan yang perlu diketahui: semua yang ditampilkan di layar pada akhirnya dibuka oleh browser pengunjung sendiri, jadi
pemilik browser yang sangat niat tetap bisa membaca data miliknya lewat DevTools; enkripsi & tanda tangan mencegah data
dibaca dari jaringan/HAR, dipakai sesi lain, diputar ulang, atau di-scrape massal. Tanpa Turnstile, skrip yang meniru
browser penuh tetap bisa membuat sesi (dibatasi rate limit dan penjaga).
Gambar (foto member, desain jadwal, cuplikan) memakai URL CDN dari API yang memang publik di sisi upstream. Rekaman
yang sudah terbuka tetap bisa direkam layar; perlindungan penuh butuh DRM (mis. Cloudflare Stream dengan signed token)
dan URL bertanda tangan dari upstream.

### Membuka blokir

Blokir penjaga tidak permanen: 1 jam, lalu 6 jam, lalu 24 jam untuk pelanggar berulang (level kembali ke awal setelah 7
hari bersih). Pengunjung yang terblokir melihat hitung mundur dan situs terbuka sendiri saat waktunya habis. Untuk
membuka lebih cepat:

| Cara | Kapan | Langkah |
| --- | --- | --- |
| Per ID insiden | Pengguna mengirim screenshot halaman blokir | `GUARD_ADMIN_TOKEN=… npm run guard:unblock -- --site https://situsmu --incident JC-XXXX-XXXX`. Server mencari IP pemilik insiden (indeks disimpan 8 hari) lalu menghapus poin & blokirnya. |
| Per IP | IP diketahui dari log Worker (`{"guard":"strike",…}`) | `… npm run guard:unblock -- --site https://situsmu --ip 203.0.113.7` |
| IP sendiri | Admin ikut terblokir | `… npm run guard:unblock -- --site https://situsmu` (endpoint admin tetap bisa dipakai walau IP-mu sedang diblokir) |
| Semua sekaligus | Salah blokir massal | Ubah variabel Worker `GUARD_EPOCH` (mis. `1` → `2`) di **Settings → Variables**. Semua poin & blokir lama tidak dipakai lagi, tanpa deploy kode. |
| Matikan sementara | Darurat | Variabel `GUARD_DISABLED=1`: pelanggaran tetap ditolak, tapi tidak ada yang diblokir. |

Script memanggil `POST /api/admin/unblock` dengan header `Authorization: Bearer <GUARD_ADMIN_TOKEN>`. Token salah
memberi poin curiga seperti percobaan mengakali lainnya, dan endpoint dibatasi 10 percobaan per menit per IP. Perubahan
langsung berlaku di isolate yang menerima permintaan; isolate lain menyusul paling lama 30 detik, lalu pengguna cukup
memuat ulang halaman.

## Menjalankan lokal

```sh
npm install
cp .dev.vars.example .dev.vars   # isi JKT48CONNECT_API_KEY=jkc_…
npm run dev                      # http://localhost:5173
```

Dev server menjalankan proxy yang sama dengan produksi (`worker/proxy.ts`: sesi, allowlist, normalisasi, kunci replay)
dengan key dari `.dev.vars`. Di jaringan yang memakai proxy
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

### Workers Builds (hubungkan repo dari dashboard Cloudflare) — auto setup

Nama Worker di dashboard harus sama dengan `name` di `wrangler.jsonc` (sekarang `jkt48connet-revamp`). Pengaturan
**Settings → Build**:

| Field | Isi |
| --- | --- |
| Build command | *(kosongkan)* — `wrangler deploy` menjalankan `npm run build` sendiri |
| Deploy command | `npm run deploy:auto` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Root directory | `/` |

**Build variables and secrets** (Settings → Build → Variables):

| Nama | Jenis | Isi |
| --- | --- | --- |
| `JKT48CONNECT_API_KEY` | Secret | Key `jkc_…` (wajib) |
| `TURNSTILE_SECRET_KEY` | Secret | Opsional |
| `VITE_TURNSTILE_SITE_KEY` | Text | Opsional, pasangan Turnstile |

`npm run deploy:auto` ([`scripts/deploy.mjs`](scripts/deploy.mjs)) melakukan semuanya: build, deploy Worker + aset,
membuat Durable Object `Guard` dan binding rate limit, menyimpan `JKT48CONNECT_API_KEY`/`TURNSTILE_SECRET_KEY` sebagai
secret Worker, dan membuat `SESSION_SECRET` acak bila belum ada (tidak pernah ditimpa). Perintah yang sama bisa
dijalankan lokal setelah `npx wrangler login`:

```sh
JKT48CONNECT_API_KEY=jkc_… npm run deploy:auto
```

### Cloudflare Pages

Folder [`functions/api/[[path]].ts`](functions/api/%5B%5Bpath%5D%5D.ts) memakai proxy yang sama. Pages tidak mendukung
Durable Object dan binding rate limit, jadi poin curiga & batas request di Pages hanya per-isolate (kurang kuat);
untuk perlindungan penuh gunakan Workers.

```sh
npm run cf:setup -- --pages     # buat project "jkt48connect" + simpan secret
npm run deploy:pages            # build + wrangler pages deploy dist
```

Bila menghubungkan repo lewat dashboard Pages: build command `npm run build`, output `dist`, lalu tambahkan
secret `JKT48CONNECT_API_KEY` di **Settings → Variables and Secrets**.

### Auto deploy dari GitHub

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) menjalankan `npm run deploy:auto` setiap push ke `main`
(jangan aktifkan bersamaan dengan Workers Builds agar tidak deploy dua kali). Tambahkan repository secrets berikut:

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
| `npm run deploy:auto` | Deploy Workers + setup otomatis (Durable Object, rate limit, secret) |
| `npm run guard:unblock` | Buka blokir penjaga anti-iseng (per ID insiden, IP, atau IP sendiri) |
| `npm run deploy` / `deploy:pages` | Deploy ke Workers / Pages |

## Struktur

```
src/
  components/   intro, shell (sidebar kiri, topbar, sidebar kanan, footer, dock + menu HP), carousel, motion (GSAP), kartu
  pages/        satu file per halaman (lazy-loaded)
  lib/          api.ts (klien: sesi, tanda tangan, dekripsi), wire.ts (protokol kripto bersama), shape.ts (normalisasi, dipakai Worker), blocked.ts, jkt48.ts, queries, format, gsap
  hooks/        use-reveal (ScrollTrigger), use-member-index, use-theme, use-clock
worker/         Cloudflare Worker: proxy API privat (proxy.ts), keamanan (security.ts), penjaga anti-iseng (guard.ts, guard-do.ts)
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
| ![Transisi halaman](docs/screenshots/24-transisi-halaman.jpg) | ![API untuk developer (HP)](docs/screenshots/25b-developer-mobile.jpg) |
| ![API untuk developer](docs/screenshots/25-developer.jpg) | ![Halaman blokir dengan hitung mundur](docs/screenshots/26-blokir.jpg) |
| ![Berita](docs/screenshots/13-news.jpg) | ![Detail berita](docs/screenshots/14-news-detail.jpg) |
| ![Beranda mobile](docs/screenshots/17-home-mobile.jpg) | ![Menu layar penuh mobile](docs/screenshots/19-mobile-menu.jpg) |
| ![Footer mobile](docs/screenshots/20-footer-mobile.jpg) | ![Sidebar desktop diciutkan](docs/screenshots/21-sidebar-collapsed.jpg) |

---

Fan-made · tidak berafiliasi dengan JKT48 Operation Team.
