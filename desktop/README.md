# JKT48Connect untuk Windows

Aplikasi desktop dengan **UI sendiri** (React, `renderer/`), bukan situs yang dibungkus. Data diambil dari jalur
`/api/app/*` yang sama dengan aplikasi Android/iPhone (token aplikasi, tanpa API key di aplikasi).

- **Beranda "panggung"**: hero gelap dengan sorot lampu bergerak, judul show yang muncul per huruf, hitung mundur
  bergulir, kartu banner 3D yang mengikuti kursor, lineup, dan ticker jadwal.
- **Live**: live Showroom diputar langsung di aplikasi (pemutar custom: progres, ±10 dtk, volume, kualitas, kecepatan,
  picture-in-picture, layar penuh, pintasan keyboard) plus **komentar live Showroom**; live IDN dibuka di IDN Live.
- Jadwal, Theater + lineup, Recent + replay (IDN terkunci 72 jam), Member + favorit, Video YouTube + komentar, Berita,
  Ulang tahun, Sosmed, Pengaturan; tema terang/gelap.
- Splash bermerek, **notifikasi Windows saat member mulai live**, tetap berjalan di tray, jalan saat Windows mulai,
  dan **update otomatis** (electron-updater dari prerelease `desktop-latest`).

## Memasang

Unduh `JKT48Connect-Setup.exe` dari [jkt48connect.app/apps](https://jkt48connect.app/apps#windows) (tautan tetap:
`https://github.com/Valzyys/JKT48Connet-REVAMP/releases/download/desktop-latest/JKT48Connect-Setup.exe`), jalankan, lalu
ikuti installer. Installer belum bertanda tangan digital, jadi Windows SmartScreen bisa menampilkan
"Windows protected your PC": klik **More info → Run anyway**.

## Pengembangan

```sh
cd desktop
npm ci
npm start            # build UI (Vite) lalu jalankan Electron
npm run typecheck && npm test
npm run dist         # installer NSIS di dist/ (di Windows; di Linux butuh Wine 32-bit)
python3 scripts/icons.py   # gambar ulang ikon & bitmap installer
```

`JKC_ROUTE=/recent` membuka rute tertentu saat pengembangan (tidak berlaku di aplikasi terpasang).

## Struktur

```
desktop/
├── src/            # main process: jendela, protokol app://, token & cache data (api.js), live + notifikasi, tray, updater
├── renderer/       # UI React + Tailwind (dibangun ke ui/app)
├── ui/             # splash, font, ikon tray
├── build/          # ikon .ico, bitmap & teks installer NSIS
└── electron-builder.yml
```

## Rilis

- `.github/workflows/desktop.yml`: tiap PR/cabang yang mengubah `desktop/**` → tes + installer sebagai artifact.
- `.github/workflows/desktop-release.yml`: tiap perubahan di `main` → release `desktop-build-N` dan memperbarui
  prerelease tetap `desktop-latest` (`JKT48Connect-Setup.exe`, `.blockmap`, `latest.yml`). Tidak ditandai *latest*.
