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

Panduan yang sama (dengan tautan yang bisa disalin dan tombol sekali ketuk untuk Feather) ada di situs: **[jkt48connect.app/apps#panduan-iphone](https://jkt48connect.app/apps#panduan-iphone)**.

Aplikasi tidak ada di App Store, jadi dipasang lewat *sideload*. Semua cara di bawah bisa langsung dari iPhone,
**tanpa PC dan tanpa kabel**. Tautan tetap (selalu versi terbaru, prerelease `ios-latest`):

| Untuk | Tautan |
| --- | --- |
| File aplikasi | `https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest/jkt48connect.ipa` |
| Repo Scarlet | `https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest/scarlet.json` |
| Sumber ESign / Feather / SideStore / AltStore | `https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest/repo.json` |

> **Penting soal sertifikat.** iPhone hanya menjalankan aplikasi yang ditandatangani sertifikat Apple. Pemasang di
> iPhone memakai sertifikat milik layanan pihak ketiga (Scarlet) atau sertifikat yang kamu impor (ESign/Feather).
> Apple kadang mencabut sertifikat bersama tersebut; kalau itu terjadi, JKT48Connect (dan aplikasi lain dari
> pemasang yang sama) tidak bisa dibuka sampai pemasangnya mendapat sertifikat baru dan aplikasi dipasang ulang.
> Data dan favorit tetap tersimpan. Aplikasi ini tidak butuh login atau izin khusus.

### Cara 1 · Scarlet (paling mudah)

1. Di Safari iPhone, buka situs resmi Scarlet (`usescarlet.com`) lalu pasang Scarlet dari sana.
2. Buka **Pengaturan → Umum → VPN & Manajemen Perangkat**, ketuk profil Scarlet, lalu **Percayai**.
3. iOS 16 ke atas: aktifkan **Pengaturan → Privasi & Keamanan → Mode Pengembang**. iPhone akan mulai ulang.
4. Pilih salah satu:
   - **Lewat repo (bisa update):** di Scarlet buka **Repos → +**, tempel tautan *Repo Scarlet* di atas, lalu
     ketuk JKT48Connect → **Get**.
   - **Lewat file:** unduh *File aplikasi* di Safari, buka di aplikasi **File**, ketuk lama `jkt48connect.ipa` →
     **Bagikan → Scarlet** → **Install**.
5. Kalau ada versi baru, buka repo di Scarlet lalu pasang lagi di atas versi lama (data tetap ada).

### Cara 2 · ESign

1. Pasang ESign beserta sertifikatnya (file `.p12` + `.mobileprovision` dan kata sandinya: sertifikat developer
   sendiri atau dari penyedia sertifikat), lalu impor sertifikat di menu ESign.
2. Tambahkan sumber: **Sources → +** → tempel tautan *Sumber ESign/Feather* di atas. Atau unduh *File aplikasi*
   di Safari lalu **Bagikan → ESign**.
3. Ketuk JKT48Connect → **Signature** → **Install**.

### Cara 3 · Feather

1. Pasang [Feather](https://github.com/claration/Feather) dan impor sertifikatmu (`.p12` + `.mobileprovision`).
2. Tambahkan sumber dengan membuka tautan ini di Safari (langsung membuka Feather):
   `feather://source/https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/ios-latest/repo.json`.
   Atau unduh *File aplikasi* lalu **Bagikan → Feather**.
3. Pilih JKT48Connect → **Sign** → **Install**.

### Cara 4 · SideStore (Apple ID sendiri, tanpa sertifikat pihak ketiga)

Setelah SideStore terpasang (pemasangan awalnya butuh komputer sekali), aplikasi bisa dipasang dan diperbarui dari
iPhone: **Sources → +** → tempel tautan *Sumber … SideStore* di atas. Dengan Apple ID gratis, ketuk **Refresh** di
SideStore paling lambat tiap 7 hari (bisa otomatis di latar).

### Cara lain

- **TrollStore** (iOS versi tertentu): buka `jkt48connect.ipa` dengan TrollStore. Terpasang permanen.
- **Dari komputer:** Sideloadly / AltStore dengan Apple ID sendiri (sambungkan kabel, seret `.ipa`).
  Dengan Apple ID gratis, pasang ulang tiap 7 hari.

### Kalau aplikasi tidak bisa dibuka

- *"Pengembang Tidak Dipercaya"*: percayai profil di **Pengaturan → Umum → VPN & Manajemen Perangkat**.
- *"Tidak Lagi Tersedia" / langsung tertutup*: sertifikatnya kedaluwarsa atau dicabut. Pasang ulang dari
  pemasang yang sama setelah sertifikatnya diperbarui, atau pakai cara lain di atas.
- *Mode Pengembang tidak muncul*: pasang aplikasinya dulu sekali, lalu menu itu akan muncul.

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
  `jkt48connect.ipa` (versi `mayor.minor.N`), lalu memperbarui prerelease tetap **`ios-latest`**:
  `jkt48connect.ipa`, `icon.png`, `repo.json`, dan `scarlet.json` (dibuat oleh `scripts/repo.py`).
  Keduanya **tidak** ditandai *latest*, supaya `releases/latest/download/jkt48connect.apk`
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
