# JKT48Connect Mobile (Flutter)

Aplikasi Android/iOS fan-made untuk mengikuti member JKT48. UI bergaya **Liquid Glass** memakai paket [`liquid_glass_easy`](https://pub.dev/packages/liquid_glass_easy): kepala atas, tab bar, segmented, kolom cari, panel profil, dan tombol pemutar adalah lensa kaca yang membiaskan isi di belakangnya.

Data diambil dari worker situs yang sama (`worker/proxy.ts`) lewat jalur khusus aplikasi `/api/app/*`.

## Isi

| Tab / halaman | Isi |
|---|---|
| Beranda | Hero dengan logo piksel yang tersusun, live sekarang (kartu foto + pil kaca LIVE), show berikutnya dengan hitung mundur, recent, ulang tahun, berita |
| Live | Semua member yang sedang live (IDN/Showroom), diperbarui tiap 30 detik, ketuk untuk membuka live |
| Jadwal | Segmented kaca: jadwal mendatang (dikelompokkan per tanggal) dan arsip theater (muat-lanjut); detail theater dengan member tampil, setlist, hitung mundur |
| Recent | Rekap live (muat-lanjut); detail berisi statistik, replay, top supporter, gift, cuplikan layar (bisa digeser/zoom) |
| Member | Grid member dengan kolom cari kaca dan pilihan aktif/lulus; profil dengan panel info kaca di atas foto, statistik live, jikoshoukai, sosial, jadwal theater |
| Ulang tahun, Berita | Dari tombol di kepala atas |

**Replay** terkunci sampai 72 jam setelah live (hitung mundur + progress). Setelah terbuka, replay diputar lewat playlist HLS dari worker, sehingga bisa langsung mulai dan seek ke menit mana pun. Kalau HLS gagal, pemutar beralih ke MP4. Kontrolnya:
- tombol play kaca;
- slider kaca;
- ketuk dua kali untuk mundur/maju 10 detik.

Private Messages belum termasuk di versi ini.

## Menjalankan

Butuh Flutter 3.47+ (diuji dengan 3.47.7).

```sh
cd mobile
flutter pub get
flutter run --dart-define=API_BASE=https://domain-situs-kamu
```

`API_BASE` adalah alamat situs JKT48Connect, yaitu worker yang melayani `/api/app/*`. Tanpa `--dart-define`, nilai bawaannya ada di `lib/core/api.dart`.

Build:

```sh
flutter build apk --release --dart-define=API_BASE=https://domain-situs-kamu      # Android
flutter build ipa --release --dart-define=API_BASE=https://domain-situs-kamu      # iOS (butuh macOS + Xcode)
```

APK rilis saat ini ditandatangani dengan kunci debug bawaan template, jadi hanya cocok untuk dicoba. Untuk Play Store, buat keystore sendiri dan atur `android/app/build.gradle.kts`.

### Unduh APK dari GitHub Releases

Workflow `.github/workflows/mobile-release.yml` membangun APK dan mengunggahnya ke halaman **Releases**. Workflow ini jalan saat:
- tag `mobile-v*` di-push (misalnya `git tag mobile-v1.0.1 && git push origin mobile-v1.0.1`);
- dijalankan manual dari tab Actions → Mobile Release → Run workflow.

Alamat API diambil dari input `api_base` saat dijalankan manual. Kalau kosong, dipakai variabel repo `API_BASE` (Settings → Secrets and variables → Actions → Variables). Kalau keduanya kosong, dipakai nilai bawaan di `lib/core/api.dart`.

## Keamanan jalur aplikasi

- `POST /api/app/session` memberi token `a1.<id>.<exp>.<sig>` (HMAC, 30 hari), dibatasi 20/menit per IP. Aplikasi menyimpannya dan meminta ulang otomatis bila ditolak (401).
- `GET /api/app/<endpoint>` memakai allowlist, cache edge, dan penjaga blokir yang sama dengan web, dibatasi 300/menit per token.
- Token replay terikat ke token aplikasi, jadi tautan replay dari satu pemasangan tidak berlaku di pemasangan lain. URL file asli tidak pernah dikirim ke aplikasi.
- API key JKT48Connect tidak ada di dalam aplikasi.

## Struktur

```
lib/
  main.dart                 tema, shader kaca dimuat di awal
  core/  api.dart           klien /api/app (token, cache memori)
         models.dart        model data (sama dengan src/lib/shape.ts)
         theme.dart         warna & tipografi (Archivo, IBM Plex Mono)
         format.dart        tanggal WIB, durasi, angka
  widgets/ glass.dart       gaya kaca, GlassChip, GlassSegmented
           common.dart      logo piksel, signal bars, skeleton, countdown, count-up
           cards.dart       kartu live/show/recent/berita
           detail_scaffold.dart  halaman detail dengan kepala kaca
  screens/ shell.dart (tab bar kaca), home, live, schedule, recent (+ pemutar replay), members, birthday, news
```
