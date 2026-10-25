# JKT48Connect Arcade — Discord Activities dan website

Empat game siap dimainkan melalui `https://jkt48connect.app/games`:

| Game | Solo | Multiplayer |
| --- | --- | --- |
| Tebak Member | 8 ronde, potongan foto | Soal/timer bersama, jawaban tercepat mendapat lebih banyak poin |
| Quiz JKT48 | 8 soal | Soal/timer bersama, satu jawaban per pemain per ronde |
| Memory Card | 6 pasangan, skor + jumlah percobaan | Bergiliran, pasangan benar memberi giliran tambahan |
| Tebak Lagu | 8 ronde dari 4 lagu | Cuplikan yang sama, jawaban dan timer diperiksa server |

Solo bisa menggunakan sesi tamu. Multiplayer memakai identitas Discord.
Room maksimum 16 pemain dan berlaku 2 jam. Tidak ada leaderboard global, hadiah,
transaksi, atau penyimpanan riwayat skor permanen dalam versi ini.

## Yang perlu Valzyy atur di Discord Developer Portal

Aplikasi yang sama dengan bot: **1305141693477027891**. Tidak perlu membuat bot
baru atau mengganti Client Secret/Bot Token yang sudah tersimpan.

1. Buka https://discord.com/developers/applications/1305141693477027891.
2. **Activities → Settings → Enable Activities: ON**.
3. **Activities → URL Mappings**: buat mapping berikut:

   | Prefix | Target |
   | --- | --- |
   | `/` | `jkt48connect.app` |

   Target berupa hostname tanpa `https://` dan tanpa tambahan `/activity`.
   Mapping root ini melayani frontend, `/assets`, foto, audio, `/api/games`, dan
   WebSocket dari origin yang sama. Jangan memetakan root langsung ke
   `jkt48connect.app/activity`, karena itu akan mengubah path aset/API.
4. **OAuth2 → Redirects**: pertahankan callback dashboard yang SUDAH ada:
   `https://jkt48connect.app/api/discord/auth/callback`.
   Tambahkan juga placeholder Activity sesuai panduan Discord:
   `https://127.0.0.1`. Embedded App SDK mengembalikan pengguna ke Activity
   melalui RPC; jangan mengubah callback dashboard menjadi placeholder.
5. **Installation → Guild Install: ON**. User Install dapat diaktifkan jika ingin
   membuka Activity di DM/Group DM juga. Bot tetap Public; **Requires OAuth2 Code
   Grant tetap OFF**. OAuth untuk Activity menggunakan alur SDK tersendiri.
6. Setelah Activities diaktifkan, Discord membuat **Entry Point / Launch**.
   Pertahankan handler **Discord Launch Activity**. Bot notifier mempertahankan
   entry point tipe 4 saat menyinkronkan slash command, termasuk sesudah restart.
7. Aktifkan **Developer Mode** pada akun Discord yang dipakai untuk pengujian.
   Jika aplikasi dimiliki team, akun penguji harus menjadi anggota team selama
   Activity belum didistribusikan.
8. Buka Apps di text/voice channel server uji → JKT48Connect → **Launch**.
   UI Arcade akan muncul di dalam Discord. Pilih game dan Buat room. Teman yang
   membuka Activity pada instance yang sama masuk ke room yang sama. Host dapat
   memilih game di lobby. Solo membuat sesi tersendiri.
9. Untuk pengguna publik, selesaikan checklist distribusi Activities yang
   ditampilkan Developer Portal. Public Bot atau dashboard website saja tidak
   otomatis membuat Activity yang masih development tersedia untuk semua orang.
   Ikuti persyaratan verifikasi/distribusi yang berlaku pada aplikasi Anda.

Dokumentasi resmi:
- https://docs.discord.com/developers/activities/building-an-activity
- https://docs.discord.com/developers/activities/development-guides/multiplayer-experience
- https://docs.discord.com/developers/activities/development-guides/networking

## Yang sudah disiapkan pada hosting

- Website `/games`; tampilan iframe di `/activity` atau root yang membawa
  parameter `frame_id` dari Discord. Tidak memuat sidebar situs dalam iframe. Header frame-ancestors hanya dilonggarkan pada dokumen Activity untuk origin Discord; halaman website biasa tetap memakai X-Frame-Options DENY.
- Worker memakai secret OAuth yang sudah ada; tidak menaruh Client Secret atau
  token bot dalam bundle frontend.
- Binding Durable Object **GAME_ROOM / GameRoom**, migration **v3-games**,
  limiter GAME_LIMITER. Binding PM, push, GUARD dan secrets lama dipertahankan.
- Room dan skor dikelola Cloudflare, bukan proses baru di VPS. VPS bot hanya
  memverifikasi keanggotaan instance Activity melalui bridge privat yang ada.
- Slash command `/games` membuka halaman permainan. Native Launch disediakan
  Discord setelah pengaturan di atas selesai.

## Autentikasi dan sinkronisasi

Website meminta identitas dari sesi Discord yang sudah login. Activity memakai
Embedded App SDK (`identify` saja), menukar code di server, lalu bot memeriksa
bahwa user benar-benar terdaftar pada Activity instance tersebut. Access token
berizin `identify` dikirim ke SDK authenticate dan hanya berada di memori; tidak
ada token bot, Client Secret, atau refresh token di browser.

Game memakai token HMAC terpisah yang diturunkan dari SESSION_SECRET dengan HKDF
konteks khusus. Masa berlaku paling lama dua jam. Token tamu disimpan pada
sessionStorage tab untuk melanjutkan solo setelah reload; token OAuth tidak
pernah disimpan di sana. Guest tidak boleh membuat/masuk room multiplayer.

WebSocket tidak memakai token di URL: identitas dikirim pada pesan auth pertama.
Origin diperiksa, koneksi tanpa auth ditutup, jumlah pemain/koneksi/aksi dibatasi.
Klien tidak menerima jawaban benar sebelum reveal ataupun isi kartu yang masih
tertutup. Server memeriksa giliran, satu jawaban per ronde dan deadline. Klien
hanya menampilkan sisa waktu memakai selisih jam server.

Koneksi putus akan mencoba reconnect dengan backoff. Akun yang sama melanjutkan
skor dan jawaban sebelumnya. Membuka identitas yang sama di tab kedua menutup
koneksi tab lama. Pemain baru hanya boleh masuk selama lobby. Jika host keluar
dari lobby, pemain online berikutnya mengambil alih. Saat permainan berlangsung,
player yang disconnect tetap tercatat dan bisa reconnect; timer tetap berjalan.

State room disimpan di Durable Object SQLite dan dihapus setelah kedaluwarsa.
WebSocket memakai Hibernation API dan alarm untuk pergantian ronde; tidak ada
polling API PM, live, recent, ataupun loop permanen VPS untuk permainan.

## Aset dan isi game

57 foto member diambil dari katalog publik situs pada 25 Oktober 2026. Foto
bernama ID opaque pada URL proxy, tanpa menyalin ulang semua foto ke repository. Tebak Lagu memakai cuplikan 8 detik Rapsodi,
Flying High, Magic Hour, dan Heavy Rotation dari MV resmi JKT48, disiapkan atas
permintaan dan konfirmasi izin oleh pemilik deployment. Metadata sumber berada
di `worker/games/catalog.ts`; tidak ada unduhan lagu saat pemain membuka game.
Foto memakai objek media R2 yang sudah ada melalui proxy foto ber-ID opaque dan cache Cloudflare; audio dilayani Cloudflare Static Assets.

Untuk menambah lagu, siapkan MP3 cuplikan yang diizinkan di `public/games/audio`,
lalu tambahkan ID, judul, URL aset dan sumber pada `SONGS` di catalog. Empat atau
lebih judul diperlukan untuk pilihan jawaban. Untuk memperbarui member,
perbarui `worker/games/members.json` dengan sumber foto publik R2 yang bersesuaian. Jangan
menaruh kredensial sumber API di katalog.

## Pengembangan dan pengujian

```bash
npm ci
npm run typecheck
npm run test:games
npm run build
npx wrangler dev --local --port 8799
```

Buka http://localhost:8799/games. Untuk UI hot reload, jalankan juga `npm run dev`;
Vite meneruskan `/api/games` dan WebSocket ke runtime lokal 8799. Gunakan
SESSION_SECRET sintetis/private `.dev.vars` untuk lokal; jangan menyalin secret
production ke tes/commit. Discord Activity yang asli membutuhkan URL mapping
HTTPS ke runtime pengembangan dan akun team penguji.

Deploy memakai `npx wrangler deploy --keep-vars`. Jangan menghapus database PM,
mengubah SESSION_SECRET yang sudah ada, atau menghapus migration/binding lama.

Checklist uji manual sebelum distribusi publik:
- Mainkan keempat game secara solo, termasuk audio play di desktop/mobile.
- Dua akun Discord masuk room yang sama, bergantian menjadi host/pemain.
- Satu akun menjawab salah/benar, mencoba menjawab dua kali, dan reconnect.
- Memory: mismatch menutup, giliran pindah, pasangan benar memberi poin sekali.
- Launch di Discord desktop/web/mobile; pastikan URL mapping memuat audio/foto
  serta WebSocket tanpa CSP error. Uji login nyata membutuhkan akun Discord.
