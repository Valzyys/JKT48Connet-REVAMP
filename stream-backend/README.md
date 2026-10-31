# Backend JKT48Connect Stream

Layanan baru di baremetal `127.0.0.1:8801`; systemd `jkt48connect-stream.service`. Edge Worker terpisah `jkt48connect-stream` melayani `https://stream.jkt48connect.app`. API memakai pola `/api/app/*` aplikasi utama; bearer di sini adalah sesi akun yang sudah login. Bridge ke baremetal memerlukan secret khusus; akses langsung tanpa bridge ditolak. Nginx ditambah satu location; service lama tidak dihentikan.

## Migrasi

`migrate.py` membaca output data-only pg_restore tanpa mengeksekusi fungsi/SQL dari backup. Backup lengkap dan archive SQLite tersimpan privat root di `/var/lib/jkt48connect-stream-import`. Semua tabel berisi data diarsipkan; tidak ada data sumber di git.

`prepare_runtime.py` menurunkan DB aplikasi dengan akun/hash, akses, profil, pembelian, snapshot, replay dan chat terkait. Token sesi, API key, vault dan integrasi produk lama tidak diaktifkan. User service tidak dapat membaca archive root. Akun banned/revoked/expired tidak diberi akses. Tanggal PostgreSQL `+00` dinormalisasi dan akses show_id dipetakan ke slug IDN Plus.

Akun dengan hash password dapat login memakai password lama. Akun OAuth tanpa password memerlukan penyedia OAuth/pemulihan yang diverifikasi; impor data bukan pemberian akses tanpa bukti identitas.

## Endpoint

- POST `/api/app/auth/register`, `/auth/login`, `/auth/logout`
- GET `/api/app/me`, `/catalog`, `/live`, `/recent?page=1`, `/plans`
- POST `/api/app/me/avatar` (body = gambar JPG/PNG/WebP mentah, maks. 5 MB; disimpan persegi 512 px tanpa metadata), POST `/api/app/me/avatar/remove`, GET `/api/app/avatar/{id}`
- GET `/api/app/live/{id}/comments?after=&wait=`: komentar live Showroom/IDN (hanya baca)
- POST `/api/app/playback/{theater|live|recent}/{id}`
- GET `/api/app/media/{opaque}`: playlist/segmen/MP4 bertiket; tidak mengembalikan redirect origin
- GET `/api/app/image/{id}`: gambar diproxy dengan autentikasi
- POST `/api/app/checkout`: plan, target (slug show), request_id (idempotency)
- GET `/api/app/payments`, `/payments/{id}`, `/payments/{id}/qr.png`
- GET `/api/app/notices`
- GET/POST `/api/app/chat/{slug}`: after, wait <=20 detik / message
- GET `/api/app/update`, `/downloads/JKT48Connect-Stream.apk`

Harga dimiliki server. Pembayaran dikonfirmasi ulang melalui PG dengan kecocokan id/reference/amount; entitlement dan pemberitahuan dibuat dalam transaksi SQLite idempoten. Tidak percaya status pembayaran dari aplikasi. Tagihan uji untuk screenshot tidak dibayar/dikonfirmasi manual.

## Operasi

Env root 600 `/etc/jkt48connect-stream.env`. State service 700, file 600; API key hanya di server. `release.json` di state: version, code, apk, notes. Pantau `journalctl -u jkt48connect-stream`; access log dimatikan agar URL tiket tidak masuk log. Backup SQLite dengan API backup; jangan menyalin DB aktif tanpa snapshot.

Tes: `python -m unittest discover -s tests -v`.
