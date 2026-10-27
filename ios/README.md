# JKT48Connect untuk iPhone (SwiftUI)

Aplikasi iPhone native dengan isi yang sama seperti aplikasi Android: live (Showroom ditonton langsung di aplikasi,
IDN dibuka di idn.app), jadwal & detail theater, recent + replay (IDN terkunci 72 jam, Showroom langsung), member +
favorit, video YouTube JKT48 + komentar, posting sosmed member, berita, ulang tahun, dan halaman tentang.
Datanya dari jalur `/api/app` yang sama dengan aplikasi Android (token aplikasi, tanpa API key di aplikasi).

## Liquid Glass

Aplikasi dibangun dengan SDK iOS 26 (Xcode 26):

- **iOS 26 ke atas:** tab bar, bilah navigasi, menu, dan kontrol pemutar video memakai Liquid Glass bawaan sistem
  (tab bar mengambang dan mengecil saat menggulir). Kartu, pil, tombol, dan pilihan segmen memakai `glassEffect`
  (interaktif: membal saat ditekan) yang dikelompokkan dalam `GlassEffectContainer`. Lihat `JKT48Connect/UI/Glass.swift`.
- **iOS 16–25:** tampilan yang sama memakai material blur sistem (`ultraThinMaterial`).

## Memasang (.ipa)

Aplikasi tidak ada di App Store, jadi dipasang lewat *sideload*. File `jkt48connect.ipa` **tanpa tanda tangan**
ada di [GitHub Releases](https://github.com/Valzyys/JKT48Connet-REVAMP/releases?q=ios-build&expanded=true)
(tag `ios-build-N`). Alat sideload menandatanganinya dengan Apple ID kamu saat memasang.

### Sideloadly (Windows / macOS), paling mudah

1. Pasang [Sideloadly](https://sideloadly.io) dan iTunes/iCloud versi situs Apple (untuk Windows).
2. Sambungkan iPhone dengan kabel, buka Sideloadly, seret `jkt48connect.ipa` ke jendelanya.
3. Masukkan Apple ID (boleh akun gratis), klik **Start**.
4. Di iPhone: **Pengaturan → Umum → VPN & Manajemen Perangkat** → percayai Apple ID kamu.
5. iOS 16 ke atas: aktifkan **Pengaturan → Privasi & Keamanan → Mode Pengembang**, lalu mulai ulang iPhone.

### AltStore / SideStore

Pasang [AltStore](https://altstore.io) atau [SideStore](https://sidestore.io), lalu buka `jkt48connect.ipa`
dari aplikasi Files → bagikan ke AltStore/SideStore. SideStore bisa memperbarui tanda tangan tanpa komputer.

### TrollStore

Di versi iOS yang didukung [TrollStore](https://github.com/opa334/TrollStore), buka `.ipa` dengan TrollStore.
Aplikasi terpasang permanen tanpa perlu diperbarui tiap 7 hari.

### Batas Apple ID gratis

- Tanda tangan berlaku **7 hari**. Setelah itu aplikasi tidak bisa dibuka sampai dipasang ulang
  (Sideloadly: ulangi langkah di atas; AltStore/SideStore: *Refresh*). Data & favorit tetap tersimpan.
- Maksimal 3 aplikasi sideload aktif per perangkat.
- Akun Apple Developer berbayar memperpanjang masa berlaku menjadi 1 tahun.

## Build

Proyek Xcode dibuat dari `project.yml` oleh [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```sh
brew install xcodegen
cd ios && xcodegen generate
open JKT48Connect.xcodeproj   # Xcode 26
```

`.ipa` tanpa tanda tangan (sama dengan CI):

```sh
xcodebuild -project JKT48Connect.xcodeproj -scheme JKT48Connect -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
mkdir -p out/Payload && cp -R build/Build/Products/Release-iphoneos/JKT48Connect.app out/Payload/
(cd out && zip -qry jkt48connect.ipa Payload)
```

### CI

- `.github/workflows/ios.yml`: tiap push ke cabang (selain `main`) yang mengubah `ios/**`, build `.ipa` dan ambil
  tangkapan layar simulator. Hasilnya diunggah ke prerelease **`ios-preview`**.
- `.github/workflows/ios-release.yml`: tiap perubahan `ios/**` di `main`, rilis **`ios-build-N`** berisi
  `jkt48connect.ipa`. Rilis ini **tidak** ditandai *latest*, supaya `releases/latest/download/jkt48connect.apk`
  (tombol unduh Android dan cek update aplikasi Android) tetap menunjuk rilis APK.

Untuk tangkapan layar, aplikasi membaca variabel lingkungan `JKC_TAB` (`home`, `live`, `schedule`, `recent`,
`members`) dan `JKC_ROUTE` (`videos`, `social`, `news`, `birthdays`, `about`).

## Struktur

```
ios/
├── project.yml              # definisi proyek XcodeGen
└── JKT48Connect/
    ├── App.swift            # titik masuk, tab bar, rute, favorit
    ├── Core/                # klien /api/app, model, format WIB, cache gambar
    ├── UI/                  # tema, Liquid Glass, komponen, pemutar video, loader
    └── Screens/             # Beranda, Live/Tonton, Jadwal, Recent, Member, Video, Sosmed, Berita, Tentang
```
