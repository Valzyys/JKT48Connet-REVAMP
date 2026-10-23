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
- Dipakai di kepala atas, pintasan beranda, menu, chip sosial, tombol play, dan panel profil member.

**Tab kaca (`LiquidTabs`)**
- Pilnya bisa diseret dengan pegas teredam dan meregang sesuai kecepatan.
- Ikon di bawah pil tampil merah lewat lensa.
- Dipakai untuk tab bar bawah, pilihan Mendatang/Theater, Aktif/Lulus, dan tema.

**Sakelar kaca (`LiquidToggle`)**
- Jempol putih berubah jadi lensa saat ditekan, bisa diseret, dan warna track mengikuti posisinya.
- Dipakai untuk pengaturan notifikasi di halaman Tentang.

**Slider kaca (`LiquidSlider`)**
- Jempolnya berupa lensa yang membesar saat diseret dan membiaskan video di belakangnya.
- Dipakai untuk seek replay.

**Lembar menu**
- Kaca di atas kaca lewat `exportedBackdrop`. Tarik ke bawah untuk menutup.

**Lapisan backdrop**
- Latar ambient (cahaya merah muda yang melayang) direkam sebagai backdrop untuk kaca di dalam halaman.
- Latar ambient dan isi halaman digabung (`rememberCombinedBackdrop`) untuk kaca yang mengapung di atasnya.

**Dukungan versi Android**
- Efek lensa butuh Android 13+, dan blur butuh Android 12+.
- Di versi yang lebih lama, kaca tampil sebagai panel buram pekat supaya teks tetap terbaca.

## Isi

| Tab / halaman | Isi |
|---|---|
| Beranda | Hero merah dengan logo piksel yang tersusun, pintasan kaca, live sekarang, show berikutnya (hitung mundur), recent, ulang tahun, berita |
| Live | Semua member yang sedang live (IDN/Showroom), diperbarui tiap 30 detik |
| Jadwal | Mendatang (dikelompokkan per tanggal) dan arsip theater (muat-lanjut); detail theater dengan member tampil, setlist, hitung mundur |
| Recent | Rekap live; detail berisi statistik, replay, top supporter, gift, cuplikan layar (geser & cubit untuk zoom) |
| Member | Grid dengan kolom cari kaca dan pilihan aktif/lulus; profil dengan panel kaca di atas foto, theater mendatang, theater terakhir, dan live terakhir |
| Ulang tahun, Berita | Dari tombol menu di kepala atas; isi berita menampilkan gambar dari jkt48.com |
| Tentang | Versi, pengaturan notifikasi & tema, tautan, kredit, dan penafian (dari menu) |

**Intro**
- Splash sistem Android 12+ berwarna merah dengan salib piksel, lalu disambung intro Compose: logo mengecil sambil memancarkan gelombang sinyal, wordmark naik, dan layar terangkat seperti tirai. Ketuk untuk melewati.

**Notifikasi**
- Memberi tahu saat member mulai live, satu jam sebelum show/event, ulang tahun member (mulai pukul 07.00 WIB), dan berita baru.
- Tanpa server push: `JobScheduler` memeriksa API tiap ±15 menit saat ada internet, dan tetap terjadwal setelah reboot.
- ID yang sudah diberitahukan disimpan di perangkat. Pemeriksaan pertama hanya mencatat, supaya tidak membanjiri.
- Tiap jenis punya channel sendiri dan bisa dimatikan di halaman Tentang. Izin (Android 13+) ditanyakan sekali setelah intro.
- Mengetuk notifikasi membuka halaman terkait (tab Live, detail show, ulang tahun, atau isi berita).

**Kecepatan**
- Respons API disimpan di memori dan disk. Halaman tampil seketika dari data terakhir lalu diperbarui, dan tetap bisa dibuka saat offline.
- Saat aplikasi dibuka, recent, arsip theater, jadwal, member, berita, dan ulang tahun dimuat lebih dulu di latar.

**Kepala atas**
- Terdiri dari kapsul merek (subjudul berganti per tab), pil status live (kaca merah saat ada yang live), dan tombol menu.
- Mengecil saat isi digulir.

**Muat ulang**
- Tarik layar ke bawah. Indikatornya lensa kaca berisi logo piksel.

**Tema**
- Pilihannya Sistem, Putih, atau Gelap, diatur di menu dan disimpan di perangkat.

**Replay**
- Terkunci sampai 72 jam setelah live.
- Diputar dengan Media3 lewat playlist HLS dari worker, dengan MP4 sebagai cadangan.
- Ketuk dua kali untuk mundur atau maju 10 detik.

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

APK rilis ditandatangani dengan kunci debug, jadi hanya cocok untuk dicoba. Untuk Play Store, buat keystore sendiri dan atur `signingConfigs` di `app/build.gradle.kts`.

### Unduh APK dari GitHub Releases

Workflow `.github/workflows/mobile-release.yml` membangun APK dan mengunggahnya ke halaman **Releases**. Workflow ini jalan saat:
- ada perubahan di `mobile/**` yang masuk ke `main` (release bernama `mobile-build-<nomor>`);
- tag `mobile-v*` di-push;
- dijalankan manual dari tab Actions → Mobile Release → Run workflow.

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
         Notify.kt         notifikasi live/show/ultah/berita (JobScheduler, channel per jenis)
         Models.kt         model data (sama dengan src/lib/shape.ts), org.json
         Format.kt         tanggal WIB, durasi, angka, hitung mundur
         Images.kt         pemuat gambar ringan (cache memori + disk, satu unduhan per URL, decode diperkecil)
  ui/    App.kt            lapisan backdrop, kepala atas, tab bar kaca, lembar menu, transisi halaman
         Navigation.kt     tab + tumpukan halaman, status muat data (cache dulu, lalu jaringan)
         Intro.kt          animasi intro saat aplikasi dibuka
         glass/            LiquidButton, LiquidTabs, LiquidSlider, LiquidToggle, gestur seret/kilau (dari catalog Backdrop)
         components/       logo piksel, sinyal, kartu, tarik-untuk-muat-ulang, latar ambient
         screens/          Home, Lists (live, jadwal, recent, member, ulang tahun, berita), Details, About
         theme/            tema putih & gelap, tipografi (Archivo, IBM Plex Mono — sudah di-subset)
```
