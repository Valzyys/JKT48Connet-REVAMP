# JKT48Connect Stream — Android

Aplikasi Kotlin / Jetpack Compose terpisah, berbasis `mobile/` main pada commit f208131 (Android 2.6.1). Package `app.jkt48connect.stream`; aplikasi JKT48Connect utama tidak diubah.

Komponen Liquid Glass (`ui/glass`), ambient, dan font berasal dari basis tersebut. Source yang tidak digunakan tidak disertakan dalam variant Stream.

## Tampilan

Isi halaman mengikuti 2.6.1 (kartu kaca putih tembus, ShowTile, RecentTile, LiveCard, grup inset), warna mengikuti token website (krem `#f3eee6`, merah `#e1243a`, gelap hitam hangat). Chrome-nya khas Stream:

| Bagian | Wujud | File |
| --- | --- | --- |
| Ikon | Set garis 2px (Beranda = lengkung panggung, Live = gelombang siaran, Theater = tiket, Replay = putar ulang, Akun = orang dalam lingkaran, menu = kisi piksel). Ikon launcher: salib piksel merah di atas hitam hangat dengan segitiga play putih di tengah. | `StreamIcons.kt`, `res/drawable/ic_launcher_*` |
| Navigasi | Model iPhone: tiap tab punya tumpukan halaman sendiri, ketuk tab aktif = kembali ke akar, push/pop bergeser horizontal. Tab bar = `LiquidTabs` 2.6.1 (Interactive Glass Bottom Bar dari [Backdrop](https://kyant.gitbook.io/backdrop)): pil kaca yang bisa diseret dengan pegas, meregang sesuai kecepatan, ikon di bawah pil merah lewat lensa; memakai ikon garis Stream. | `StreamRoot.kt`, `ui/glass/Liquid.kt` |
| Bilah atas | Logo piksel + wordmark, pil liquid glass merah "ON AIR · n" (ke tab Live), tombol kisi kaca (menu panel kaca, baris tombol liquid glass). Halaman detail: tombol kembali kaca bulat + judul condensed. | `StreamRoot.kt` |
| Liquid Glass | Tetap memakai komponen kaca 2.6.1 (`ui/glass`): dua lapis backdrop (latar ambient + isi halaman) untuk kaca yang mengapung; chip & tombol di hero membiaskan foto member; saat video tampil kaca hanya membiaskan latar supaya video mulus. | `StreamRoot.kt`, `StreamScreens.kt` |
| Judul | Gaya website: "01 —— label", judul condensed besar, "/ jumlah" merah. | `StreamKit.kt` |
| Beranda | Hero "ON AIR" (carousel live, berganti otomatis seperti Stories) atau "OFF AIR" (hitung mundur show), ticker sinyal, ubin Live/Show/Pass. | `StreamScreens.kt` |
| Detail replay | Setara 2.6.1: statistik (durasi, penonton, gold/poin, komentar), pemutar di halaman dengan pilihan bagian, top supporter, gift, cuplikan 9 petak + "+N". Data dari `GET /api/app/recent/{id}`. | `StreamScreens.kt` |
| Theater | Detail dengan hitung mundur & beli tiket; halaman tonton berisi lineup dan obrolan penonton realtime (pesan sendiri = gelembung merah). | `StreamScreens.kt`, `StreamPlayer.kt` |
| Pemutar | Kontrol 2.6.1 (−10/+10 detik, ketuk dua kali, kecepatan, bar posisi, mode live) dan layar penuh (geser ke bawah untuk keluar). Live & theater: video selebar layar, isi halaman tidak direkam ke lapisan kaca selama video tampil, kualitas dipilih hati-hati, mulai setelah 2 detik cadangan dan menunggu 6 detik setelah tersendat, sambung ulang sendiri bila jaringan tersendat. | `StreamPlayer.kt` |
| Komentar live | Halaman live Showroom/IDN menampilkan komentar penonton realtime (hanya baca) dari relay JKT48Connect, lewat `GET /api/app/live/{id}/comments` (long-poll). | `StreamPlayer.kt`, `server.py` |
| Layar penuh gambar | Cuplikan, poster, foto replay, dan lineup: geser, filmstrip, cubit/ketuk dua kali untuk zoom, geser ke bawah untuk menutup. | `StreamViewer.kt` |
| Pengenalan & masuk | "Tiga babak" di layar merah dengan tirai yang terangkat; halaman masuk berbentuk tiket (stub ADMIT ONE, nomor kursi, garis sobek, barcode). | `StreamAuth.kt` |
| Bayar | Tagihan QRIS di kartu kaca di atas latar merah: status berdenyut, nominal, QR, hitung mundur, simpan QR, animasi berhasil. | `StreamPay.kt` |

## Build

JDK 17, Android SDK 37.0, AGP 9.2.1 dan Gradle wrapper 9.4.1. compileSdk memakai minorApiLevel 0 karena platform diterbitkan sebagai android-37.0; targetSdk tetap 36. Dependensi Compose/Backdrop tetap mengikuti basis.

```
ANDROID_HOME=/path/to/sdk ./gradlew :app:assembleDebug
./gradlew :app:assembleRelease -PapiBase=https://stream.jkt48connect.app
```

Unduhan langsung APK terbaru: https://jkt48connect.app/download/JKT48Connect-Stream-V1.0.1.apk (versi apa pun di nama tautan, atau `/download/JKT48Connect-Stream.apk`, selalu memberi build terbaru). Versi diatur `versionName`/`versionCode` di `app/build.gradle.kts` dan `RELEASE` di `stream-backend/server.py` (popup update). Worker website mengambil `JKT48Connect-Stream.apk` dari rilis tetap `stream-latest` yang ditimpa setiap build, tanpa API GitHub; cadangan: rilis `stream-mobile-build-N` terbaru lalu salinan terakhir di edge. `worker/download.ts`).

Untuk rilis tetap: `SIGNING_STORE_FILE`, `SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD` disimpan privat. Jangan commit keystore. Workflow memakai secret signing Android yang sudah tersedia di repository; identitas package Stream tetap terpisah. Release Stream tidak ditandai latest agar pembaruan aplikasi utama tidak tertukar.

## Alur

- Onboarding tiga tahap, lalu login/register wajib.
- Akun password lama memakai hash bcrypt asli hasil migrasi. Akun OAuth/SSO tanpa hash tetap tersimpan, tetapi login dengan penyedia lama/pemulihan membutuhkan setup penyedia identitas; tidak dibuat password sembarangan.
- Katalog theater dari IDN Plus, lineup dicocokkan ke API JKT48Connect. Arsip cadangan ditandai dan tidak dijual sebagai siaran live.
- Live IDN/Showroom dan replay member melalui server; replay member tidak memakai jeda 72 jam pada produk ini.
- Akses theater diperiksa di server, termasuk setiap request playlist/segmen. Tiket Rp4.000/show; mingguan Rp10.000/7 hari, bulanan Rp20.000/30 hari, tahunan Rp120.000/365 hari.
- QRIS berasal dari gateway, pembayaran divalidasi server setiap 4 detik untuk tagihan pending. Aplikasi membaca status setiap 4 detik saat checkout aktif. Harga dan status dari klien tidak dipercaya.
- Live member Showroom/IDN (siaran publik) diputar langsung dari CDN sumbernya supaya cepat mulai dan lancar; token sesi hanya dikirim ke server Stream. Theater dan replay tetap lewat tiket media. Playlist & segmen HLS bertiket (theater, replay HLS) diambil sekali dari origin lalu dibagi ke semua penonton, dan 3 segmen berikutnya diambil lebih dulu (cache memori 96 MB). Replay memakai MP4 utuh bila tersedia.
- Komentar live Showroom/IDN: server membuka satu WebSocket per siaran ke relay JKT48Connect (API key tetap di server, dibagi semua penonton, berhenti 90 detik setelah tidak ada yang menonton; saat WebSocket terputus memakai snapshot). Butuh paket `websockets` (requirements).
- Live chat penonton menggunakan long-poll yang segera bangun saat pesan masuk, bukan polling rapat terus-menerus. Kiriman langsung membangunkan semua penonton di ruang yang sama, dan balasan kiriman berisi pesannya sehingga pengirim melihatnya seketika. Penonton baru menerima 50 pesan terakhir. Ruang theater memerlukan akses. Long-poll memakai event di memori, jadi server dijalankan dengan satu worker uvicorn (bawaan service).
- Pembayaran terus diproses server setelah aplikasi ditutup. Job Android mengecek pemberitahuan minimal 15 menit sesuai batas OS; ini bukan jaminan push instan saat aplikasi ditutup. Push FCM khusus package baru belum dikonfigurasi.
- Cek update saat membuka aplikasi; popup tersedia bila version code server lebih tinggi.

## Keamanan

Token pengguna dienkripsi dengan Android Keystore. API key gateway/upstream tidak terdapat di APK. URL source HLS tetap di server, semua URI manifest termasuk key/map/variant diganti tiket terenkripsi yang terikat sesi. Salinan URL tanpa sesi ditolak. Ini tidak mencegah pengguna sah merekam data video yang diterima perangkat.

`FLAG_SECURE` aktif pada release: screenshot, task preview dan perekaman layar Android standar diblokir. Debug mengizinkan screenshot untuk review UI. Perangkat root/OS termodifikasi dan kamera eksternal tidak dapat dijamin. Tidak mengklaim DRM/Widevine.
