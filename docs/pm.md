# Private Messages

Area `/pm` memiliki navigasi terpisah: pesan, beli akses, riwayat transaksi dan akun. Semua halaman membutuhkan akun, kecuali login/daftar. Paket berlaku **per member**: Harian **2 hari Rp3.000**, Mingguan **7 hari Rp8.000**, Bulanan **30 hari Rp13.000**. Masa akses mulai saat pembayaran diverifikasi; pembelian ulang menambah masa aktif yang masih tersisa.

## Setup Workers otomatis

Tambahkan secret build / GitHub Actions berikut, lalu jalankan `npm run deploy:auto`:

- `PM_API_KEY`: key JKT48 PM Gateway.
- `MYPG_API_KEY`: key proyek MYPG (gunakan test key untuk pengujian).
- `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` bila memakai CI. Token perlu izin **D1 Edit** dan izin deploy Workers yang sudah digunakan proyek ini.

Untuk deploy lokal, `deploy:auto` juga membaca `.dev.vars`; nilai environment yang sudah diatur tetap diprioritaskan.

Tidak ada key yang disertakan dalam source, screenshot, atau bundle browser. Jangan memakai awalan `VITE_` untuk secret.

`deploy:auto` mencari database `jkt48connect-pm` pada akun Cloudflare yang sedang login, membuatnya bila belum ada, menulis binding `PM_DB` beserta database ID ke konfigurasi checkout, menerapkan migrasi, lalu deploy dan menyimpan secret dari environment. Database yang sama dipakai lagi pada deploy berikutnya. Setup berhenti jika provisioning atau migrasi gagal. Gunakan akun Cloudflare yang sama untuk setiap deploy. Tidak ada penghapusan database dalam script setup.

Provisioning mengikuti [perintah D1 Wrangler resmi](https://developers.cloudflare.com/d1/wrangler-commands/). ID yang ditulis saat CI tidak perlu dikomit. `npm run pm:setup` dapat dijalankan terpisah. Deploy langsung dengan `npm run deploy` memerlukan provisioning/migrasi sebelumnya.

## Pengembangan lokal

```sh
npm ci
cp .dev.vars.example .dev.vars
# Isi PM_API_KEY dan MYPG_API_KEY di .dev.vars
npm run pm:setup:local
npm run dev
```

Vite memakai D1 lokal Wrangler yang sama dengan `npm run cf:dev`; database lokal dan produksi terpisah. Untuk Workers dev jalankan setup lokal sebelum `npm run cf:dev`. Akun lokal tidak berlaku di produksi.

Jika memakai Cloudflare Pages, buat binding D1 `PM_DB` dan dua secret PM pada project Pages. Setup otomatis di atas ditujukan ke **Workers**, sesuai deployment utama repository.

## Alur pembayaran

1. Server memvalidasi slug member dari katalog gateway dan mengambil harga/durasi dari tabel paket server.
2. Transaksi dibuat di D1 dengan ID internal sebelum memanggil MYPG.
3. Pembeli diarahkan ke `/pm/pay/:id`. UI menampilkan QR dan nominal akhir (termasuk kode unik jika gateway menggunakannya), tanpa tautan atau redirect ke halaman pembayaran MYPG.
4. Halaman memeriksa status setiap 10 detik selama pending; polling berhenti saat tab tersembunyi sesuai default React Query. Pengguna juga dapat mengecek atau membatalkan secara manual.
5. Hanya respons MYPG `SUCCESS` dengan ID transaksi dan nominal cocok yang mengaktifkan akses. Tidak ada endpoint callback tanpa verifikasi atau status dari klien yang dipercaya.
6. Grant memiliki `order_id` unik dan diaktifkan dengan satu perintah SQL atomik, sehingga polling berulang/bersamaan tidak menggandakan durasi. Status sukses tidak dapat diturunkan oleh respons pending/cancel yang terlambat.

Jika pembeli menutup halaman setelah membayar, akses disinkronkan saat transaksi dibuka kembali dari riwayat. Belum ada rekonsiliasi terjadwal/webhook karena dokumentasi gateway hanya menyediakan polling. Bila create-payment timeout setelah gateway menerima transaksi, jangan membayar QR yang tidak ditampilkan aplikasi; transaksi lokal ditandai gagal dan perlu pemeriksaan operator sebelum mencoba lagi. Tidak ada retry create-payment otomatis yang dapat membuat tagihan duplikat.

## Batas akses

Password menggunakan PBKDF2-SHA256 dengan salt acak dan 100.000 iterasi. Cookie sesi HttpOnly, Secure, SameSite=Lax berlaku tujuh hari; token disimpan sebagai SHA-256 di D1. Mutasi membutuhkan Origin situs dan JSON. Login, pembuatan transaksi, polling, dan permintaan upstream dibatasi. Batas upstream dipakai bersama seluruh pengguna Worker untuk menjaga batas 120 request/menit gateway (anggaran aplikasi 100/menit); bila penuh pengguna menerima pesan coba lagi.

Katalog tidak mengirim preview pesan member terkunci. Riwayat pesan, polling terbaru, serta setiap permintaan foto/video/audio memeriksa masa aktif dan pemilik sesi. URL media dipetakan ke proxy same-origin yang memvalidasi member/path, meneruskan byte ranges, dan menggunakan cache private/no-store. Endpoint media upstream sendiri dikelola penyedia, di luar kendali aplikasi ini.

AMR ditampilkan dengan kontrol audio serta tautan buka; dukungan playback bergantung pada browser. Polling member hanya ditampilkan, tanpa voting karena gateway tidak menyediakan endpoint voting. Registrasi memakai email/password tanpa verifikasi email dan tanpa pemulihan password; keduanya memerlukan layanan email tambahan.

## Verifikasi

```sh
npm run typecheck
npm run test:pm
npm run build
```

Tes integrasi memakai **D1 lokal asli** dan gateway mock, tanpa mengirim tagihan/pesan ke layanan eksternal. Skenario: login/daftar, CSRF, preview terkunci, nominal server, isolasi pemilik transaksi, aktivasi idempotent, perpanjangan, pembatalan, expiry, sanitasi path media dan Range requests. Screenshot preview menggunakan data contoh pada sisi browser; bukan bukti pembayaran live. Koneksi langsung ke katalog PM telah diverifikasi dengan key yang diberikan dan header `User-Agent: JKT48Connect/1.0` (3 member aktif saat pengujian).
