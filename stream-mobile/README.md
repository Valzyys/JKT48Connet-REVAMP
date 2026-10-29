# JKT48Connect Stream — Android

Aplikasi Kotlin / Jetpack Compose terpisah, berbasis `mobile/` main pada commit f208131 (Android 2.6.1). Package `app.jkt48connect.stream`; aplikasi JKT48Connect utama tidak diubah.

Komponen Liquid Glass `LiquidButton`, `LiquidTabs`, glass/Backdrop, gesture spring, ambient, tema dan font berasal dari basis tersebut. Pemutar memakai Media3/PlayerView tanpa blur. Source yang tidak digunakan tidak disertakan dalam variant Stream.

## Build

JDK 17, Android SDK 36 dan Gradle wrapper 9.3.1. SDK 37 pada basis belum tersedia di SDK Manager saat pengerjaan; variant ini memakai compileSdk/targetSdk 36. Dependensi Compose/Backdrop tetap mengikuti basis.

```
ANDROID_HOME=/path/to/sdk ./gradlew :app:assembleDebug
./gradlew :app:assembleRelease -PapiBase=https://stream.jkt48connect.app
```

Untuk rilis tetap: `SIGNING_STORE_FILE`, `SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD` disimpan privat. Jangan commit keystore. Workflow memakai secret signing Android yang sudah tersedia di repository; identitas package Stream tetap terpisah. Release Stream tidak ditandai latest agar pembaruan aplikasi utama tidak tertukar.

## Alur

- Onboarding tiga tahap, lalu login/register wajib.
- Akun password lama memakai hash bcrypt asli hasil migrasi. Akun OAuth/SSO tanpa hash tetap tersimpan, tetapi login dengan penyedia lama/pemulihan membutuhkan setup penyedia identitas; tidak dibuat password sembarangan.
- Katalog theater dari IDN Plus, lineup dicocokkan ke API JKT48Connect. Arsip cadangan ditandai dan tidak dijual sebagai siaran live.
- Live IDN/Showroom dan replay member melalui server; replay member tidak memakai jeda 72 jam pada produk ini.
- Akses theater diperiksa di server, termasuk setiap request playlist/segmen. Tiket Rp4.000/show; mingguan Rp10.000/7 hari, bulanan Rp20.000/30 hari, tahunan Rp120.000/365 hari.
- QRIS berasal dari gateway, pembayaran divalidasi server setiap 4 detik untuk tagihan pending. Aplikasi membaca status setiap 4 detik saat checkout aktif. Harga dan status dari klien tidak dipercaya.
- Live chat penonton menggunakan long-poll yang segera bangun saat pesan masuk, bukan polling rapat terus-menerus. Ruang theater memerlukan akses.
- Pembayaran terus diproses server setelah aplikasi ditutup. Job Android mengecek pemberitahuan minimal 15 menit sesuai batas OS; ini bukan jaminan push instan saat aplikasi ditutup. Push FCM khusus package baru belum dikonfigurasi.
- Cek update saat membuka aplikasi; popup tersedia bila version code server lebih tinggi.

## Keamanan

Token pengguna dienkripsi dengan Android Keystore. API key gateway/upstream tidak terdapat di APK. URL source HLS tetap di server, semua URI manifest termasuk key/map/variant diganti tiket terenkripsi yang terikat sesi. Salinan URL tanpa sesi ditolak. Ini tidak mencegah pengguna sah merekam data video yang diterima perangkat.

`FLAG_SECURE` aktif pada release: screenshot, task preview dan perekaman layar Android standar diblokir. Debug mengizinkan screenshot untuk review UI. Perangkat root/OS termodifikasi dan kamera eksternal tidak dapat dijamin. Tidak mengklaim DRM/Widevine.
