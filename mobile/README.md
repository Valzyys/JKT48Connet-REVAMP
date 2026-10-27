# JKT48Connect Android (Kotlin + Jetpack Compose)

Aplikasi Android native fan-made untuk mengikuti member JKT48. UI bergaya **Liquid Glass** memakai library [Backdrop](https://kyant.gitbook.io/backdrop) (`io.github.kyant0:backdrop`).
- Kaca digambar langsung oleh `RenderEffect`/`RuntimeShader` Android, jadi ringan.
- APK rilis sekitar 2 MB.

Data diambil dari worker situs yang sama (`worker/proxy.ts`) lewat jalur khusus aplikasi `/api/app/*`.

## Liquid glass

Komponen interaktifnya diadaptasi dari catalog Backdrop (Apache 2.0) dan ada di `ui/glass/`.

**Tombol kaca (`LiquidButton`, `LiquidIconButton`)**
- Membesar saat ditekan, dengan kilau putih yang mengikuti jari.
- Kaca ikut tertarik dan meregang ke arah tarikan, lalu membal kembali saat dilepas.
- Dipakai untuk semua tombol: bilah atas, item menu "•••", "Semua ›", "Coba lagi", pintasan beranda, "Tonton", bintang favorit, chip sosial, unduh media, bagian replay, dan tombol di halaman detail.

**Tab kaca (`LiquidTabs`)**
- Pilnya bisa diseret dengan pegas teredam dan meregang sesuai kecepatan.
- Ikon di bawah pil tampil merah lewat lensa.
- Dipakai untuk tab bar bawah (pil abu bening) dan semua pilihan segmen lewat `GlassSegmented`: Mendatang/Theater, Aktif/Lulus/Favorit, kanal video, platform sosmed, dan tema (pil kaca bertint merah).

**Sakelar kaca (`LiquidToggle`)**
- Jempol putih berubah jadi lensa saat ditekan, bisa diseret, dan warna track mengikuti posisinya.
- Dipakai untuk pengaturan notifikasi di halaman Tentang.

**Slider kaca (`LiquidSlider`)**
- Jempolnya berupa lensa yang membesar saat diseret dan membiaskan video di belakangnya.
- Dipakai untuk seek replay.

**Menu "•••"**
- Panel kaca kecil yang mekar dari pojok kanan atas, seperti `Menu` di aplikasi iPhone: Video, Sosmed, Berita, Ulang tahun, Donasi, Tentang. Ketuk di luar panel untuk menutup.
- Tiap item adalah tombol liquid glass yang membiaskan panel di bawahnya (kaca di atas kaca lewat `exportedBackdrop`).

**Sama dengan aplikasi iPhone**
- Tata letak, judul, kartu, dan warna mengikuti aplikasi iPhone (`ios/`): judul besar di tiap tab, judul bagian dengan pil kaca "Semua ›", dan latar ambient (sedikit lebih lembut dari iOS).
- Kartu isi memakai kaca seperti `glassCard()` iOS: putih 62% (gelap: 11%) dengan tepi terang setipis rambut, nilainya diukur dari tangkapan layar aplikasi iPhone. Tanpa blur per kartu supaya daftar panjang tetap ringan.
- Kaca yang mengapung (tab bar, tombol bilah atas) bening dengan blur tipis: isi di belakangnya tetap terlihat dan terbiaskan lensa.

**Lapisan backdrop**
- Latar ambient (cahaya merah muda yang melayang) direkam sebagai backdrop untuk kaca di dalam halaman.
- Latar ambient dan isi halaman digabung (`rememberCombinedBackdrop`) untuk kaca yang mengapung di atasnya.

**Dukungan versi Android**
- Efek lensa butuh Android 13+, dan blur butuh Android 12+.
- Di versi yang lebih lama, kaca tampil sebagai panel buram pekat supaya teks tetap terbaca.

## Isi

| Tab / halaman | Isi |
|---|---|
| Beranda | Kartu status merah (siapa yang sedang live + show berikutnya dengan hitung mundur), pintasan kaca (Video, Sosmed, Ultah, Berita), oshi, live sekarang, video terbaru, posting member, recent dan berita dalam daftar inset. Bagian kosong disembunyikan |
| Video | Video terbaru kanal YouTube JKT48 & JKT48 TV (filter per kanal). Diputar langsung di aplikasi (HLS dengan audio, pilihan kualitas Auto/360p–1080p, layar penuh), dengan deskripsi dan komentar publik (muat-lanjut) |
| Sosmed | Posting publik member di X, TikTok, dan Instagram (arsip JKT48Connect): teks, foto/carousel, video yang bisa diputar, angka interaksi; bisa dibuka per member dari profilnya. Foto/video bisa **diunduh** (ikon unduh di kartu, atau "Unduh foto/video" & "Unduh semua" di detail) ke `Download/JKT48Connect` lewat DownloadManager (Android 8–9 meminta izin penyimpanan) |
| Live | Semua member yang sedang live (IDN/Showroom), diperbarui tiap 30 detik |
| Jadwal | Mendatang (dikelompokkan per tanggal) dan arsip theater (muat-lanjut); detail theater dengan member tampil, setlist, hitung mundur |
| Recent | Rekap live; detail berisi statistik, replay, top supporter, gift, cuplikan layar (9 petak + "+N"; penampil layar penuh gelap: geser kiri/kanan, filmstrip, ketuk dua kali/cubit untuk zoom, geser ke bawah untuk menutup) |
| Member | Grid dengan kolom cari kaca dan pilihan aktif/lulus; profil dengan panel kaca di atas foto, theater mendatang, theater terakhir, dan live terakhir |
| Ulang tahun, Berita | Dari menu "•••" di bilah atas; isi berita menampilkan gambar dari jkt48.com |
| Donasi | Hero merah-merah muda dengan hati melayang, chip nominal kaca, kolom nama, tagihan QRIS di jendela kaca (simpan QR ke galeri, halaman bayar, hitung mundur, cek status tiap 4 detik, animasi terima kasih), dan dinding pendukung (dari menu & Tentang) |
| Favorit | Ketuk ☆ di profil member untuk menjadikannya oshi; tampil di tab Favorit (daftar member) dan baris "Favoritmu" di beranda, dengan penanda LIVE |
| Tentang | Pembuat (@Valzyys), ekosistem JKT48Connect (situs, bot X, bot Discord, Public API), fitur, versi & update, notifikasi, tema, sumber resmi, kredit, dan penafian (dari menu) |

**Intro**
- Splash sistem Android 12+ berwarna merah dengan salib piksel, lalu disambung intro Compose: logo mengecil sambil memancarkan gelombang sinyal, wordmark naik, dan layar terangkat seperti tirai. Ketuk untuk melewati.

**Notifikasi**
- Memberi tahu saat member mulai live, satu jam sebelum show/event, ulang tahun member (mulai pukul 07.00 WIB), dan berita baru.
- **Server push** (bila diatur di worker, lihat README utama → Server push): cron Cloudflare mengirim pesan FCM ke topik yang dilanggan aplikasi, sehingga notifikasi live datang dalam ±15 detik walau aplikasi tertutup (server mengecek tiap 15 detik). Konfigurasi Firebase diambil dari `/api/app/push` saat runtime, tanpa `google-services.json` di APK.
- **Cadangan tanpa push**: `JobScheduler` memeriksa API tiap ±15 menit saat ada internet, dan tetap terjadwal setelah reboot. Cadangan ini mati otomatis selama push aktif, supaya tidak ada notifikasi ganda.
- ID yang sudah diberitahukan disimpan di perangkat. Pemeriksaan pertama hanya mencatat, supaya tidak membanjiri.
- Tiap jenis punya channel sendiri dan bisa dimatikan di halaman Tentang. Izin (Android 13+) ditanyakan sekali setelah intro.
- Mengetuk notifikasi membuka halaman terkait (tab Live, detail show, ulang tahun, atau isi berita).

**Update otomatis**
- Setiap aplikasi dibuka, versi terpasang dibandingkan dengan release terbaru di GitHub (`GET /api/app/update`, di-cache 15 menit). Bila ada versi baru, muncul pop-up kaca berisi catatan rilis.
- "Update sekarang" mengunduh APK lewat DownloadManager (dengan progres), lalu membuka pemasang Android. "Nanti" menunda pop-up versi itu 12 jam.
- Versi baru juga diberitahukan lewat notifikasi (sekali per versi), dan bisa dicek manual di halaman Tentang.
- Pemicu update adalah `versionName` di `app/build.gradle.kts`. Naikkan nilainya (mis. 2.1.0 → 2.2.0) supaya aplikasi lama menawarkan update.

**Kecepatan**
- Respons API disimpan di memori dan disk. Halaman tampil seketika dari data terakhir lalu diperbarui, dan tetap bisa dibuka saat offline.
- Saat aplikasi dibuka, recent, arsip theater, jadwal, member, berita, dan ulang tahun dimuat lebih dulu di latar.

**Bilah atas**
- Seperti bilah navigasi iOS 26: tombol kaca bulat "•••" merah di kanan, tombol kembali bulat di halaman detail, dan judul di tengah (halaman detail, atau tab setelah judul besarnya tergulir).
- Tepi atas memudar saat isi digulir, supaya isi tidak bertabrakan dengan bilah.

**Muat ulang**
- Tarik layar ke bawah. Indikatornya lensa kaca berisi logo piksel.

**Tema**
- Pilihannya Sistem, Putih, atau Gelap, diatur di menu dan disimpan di perangkat.

**Tampilan**
- Latar ambient di belakang kaca sengaja diam: latar bergerak memaksa semua kaca dihitung ulang di setiap frame. Animasi masuk kartu hanya diputar sesaat setelah halaman dibuka, bukan setiap baris muncul saat digulir.
- Palet ala iOS: latar abu sistem dengan kartu putih (tema terang), hitam pekat dengan kartu abu tua (gelap).
- Judul halaman besar dan tebal, judul bagian dengan "Semua ›", daftar inset bergaris rambut seperti aplikasi iPhone.

**Replay & video**
- Satu pemutar (`ui/player/MediaPlayer.kt`) untuk replay, YouTube, dan video member.
- Replay terkunci sampai 72 jam setelah live.
- Diputar dengan Media3 lewat playlist HLS dari worker, dengan MP4 sebagai cadangan.
- Kontrol kaca: judul & bagian, kecepatan (0,5×–2×), mundur/maju 10 detik, play, dan slider lensa; ketuk dua kali di sisi kiri/kanan untuk −10/+10 detik.
- **Layar penuh** di jendela tersendiri: bilah sistem disembunyikan, video lanskap (Showroom) memutar layar ke lanskap. Kembali, tombol keluar, atau geser ke bawah untuk menutup. Pemutar yang sama dipakai (tidak mulai ulang).
- Jeda otomatis saat aplikasi ke latar; layar tetap menyala selama diputar.

## Menjalankan

Butuh JDK 17+ dan Android SDK (compileSdk 37; Gradle mengunduh platform yang kurang).

```sh
cd mobile
./gradlew :app:installDebug -PapiBase=https://domain-situs-kamu      # pasang ke HP/emulator
./gradlew :app:assembleRelease -PapiBase=https://domain-situs-kamu   # APK rilis: app/build/outputs/apk/release/
```

`apiBase` adalah alamat situs JKT48Connect, yaitu worker yang melayani `/api/app/*`.
- Bisa juga diatur lewat variabel lingkungan `API_BASE`.
- Tanpa keduanya, dipakai nilai bawaan di `app/build.gradle.kts`.

### Kunci tanda tangan rilis (wajib untuk update otomatis)

Android hanya mau memperbarui aplikasi bila APK baru ditandatangani kunci yang sama. Tanpa kunci tetap, tiap build CI memakai kunci debug acak, sehingga update harus hapus-pasang. Buat kuncinya sekali:

```sh
cd mobile && ./scripts/buat-keystore.sh      # menghasilkan jkt48connect-release.jks + .base64
```

Lalu tambahkan dua secret di GitHub → Settings → Secrets and variables → Actions: `ANDROID_KEYSTORE_BASE64` (isi file `.base64`) dan `ANDROID_KEYSTORE_PASSWORD`. `ANDROID_KEY_ALIAS` dan `ANDROID_KEY_PASSWORD` opsional; bawaannya `jkt48connect` dan password keystore. Simpan file `.jks` dan password-nya di tempat aman, jangan di-commit (sudah di `.gitignore`). Kalau kunci hilang, pengguna harus hapus-pasang sekali lagi.

Pengguna yang memasang APK lama (bertanda tangan kunci debug acak) perlu hapus-pasang satu kali ke versi berkunci tetap. Setelah itu update berikutnya bisa langsung dari pop-up. Aplikasi mendeteksi kunci yang berbeda dan menjelaskannya di pop-up.

Workflow **Mobile Release berhenti dengan error** bila kedua secret belum diatur atau keystore tidak bisa dibuka dengan password-nya. Ini disengaja: rilis berkunci acak memaksa semua pengguna hapus-pasang. Setelah secret diisi, jalankan ulang workflow dari tab Actions.

Build lokal tanpa secret tetap memakai kunci debug (cukup untuk dicoba).

### Unduh APK dari GitHub Releases

Workflow `.github/workflows/mobile-release.yml` membangun APK dan mengunggahnya ke halaman **Releases**. Workflow ini jalan saat:
- ada perubahan di `mobile/**` yang masuk ke `main` (release bernama `mobile-build-<nomor>`);
- tag `mobile-v*` di-push;
- dijalankan manual dari tab Actions → Mobile Release → Run workflow.

Release dibuat sebagai "latest" dengan catatan rilis dari pesan commit. Itulah yang dibaca pop-up update di aplikasi.

Alamat API diambil dari input `api_base` saat dijalankan manual. Kalau kosong, dipakai variabel repo `API_BASE` (Settings → Secrets and variables → Actions → Variables).

## Keamanan jalur aplikasi

**Token aplikasi**
- `POST /api/app/session` memberi token `a1.<id>.<exp>.<sig>` (HMAC, 30 hari), dibatasi 20/menit per IP.
- Aplikasi menyimpan token itu dan meminta ulang otomatis bila ditolak (401).

**Data**
- `GET /api/app/<endpoint>` memakai allowlist, cache edge, dan penjaga blokir yang sama dengan web.
- Dibatasi 300/menit per token.

**Replay**
- Token replay terikat ke token aplikasi, jadi tautan replay dari satu pemasangan tidak berlaku di pemasangan lain.
- URL file asli tidak pernah dikirim ke aplikasi.

**Gambar berita**
- Gambar jkt48.com menolak hotlink, jadi aplikasi memuatnya lewat `GET /api/app/media?url=` (host di-allowlist, butuh token aplikasi), sama dengan `/api/media` di web.

**API key**
- API key JKT48Connect tidak ada di dalam aplikasi.

## Struktur

```
app/src/main/java/app/jkt48connect/
  MainActivity.kt          edge-to-edge, warna ikon sistem ikut tema, tujuan dari notifikasi
  core/  Api.kt            klien /api/app (token, cache memori + disk), tanpa library HTTP
         Notify.kt         notifikasi live/show/ultah/berita/update (channel per jenis, cadangan JobScheduler)
         Push.kt           server push FCM: konfigurasi dari worker, topik sesuai sakelar, penerima pesan
         Updater.kt        cek versi baru, unduh APK (DownloadManager), cek kunci, buka pemasang
         Models.kt         model data (sama dengan src/lib/shape.ts), org.json
         Format.kt         tanggal WIB, durasi, angka, hitung mundur
         Images.kt         pemuat gambar ringan (cache memori + disk, satu unduhan per URL, decode diperkecil)
  ui/    App.kt            lapisan backdrop, bilah atas, tab bar kaca, menu "•••", transisi halaman
         player/           pemutar video Media3 bersama (replay, YouTube, video member): kualitas, kecepatan, layar penuh
         Navigation.kt     tab + tumpukan halaman, status muat data (cache dulu, lalu jaringan)
         Intro.kt          animasi intro saat aplikasi dibuka
         UpdateDialog.kt   pop-up kaca "Update tersedia"
         glass/            LiquidButton, LiquidTabs, LiquidSlider, LiquidToggle, gestur seret/kilau (dari catalog Backdrop)
         components/       logo piksel, sinyal, kartu, tarik-untuk-muat-ulang, latar ambient
         screens/          Home, Lists (live, jadwal, recent, member, ulang tahun, berita), Details, Media (video, sosmed), About
         theme/            tema putih & gelap, tipografi (Archivo, IBM Plex Mono — sudah di-subset)
```
