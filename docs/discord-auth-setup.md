# Dashboard Discord — setup dan penggunaan

Halaman: **https://jkt48connect.app/discord**. Menggunakan shell, token warna,
Archivo/IBM Plex Mono, komponen `Page`, `PageHeader`, `panel`, `btn`, dan reveal
GSAP situs yang sama. Tidak memakai tema dashboard terpisah.

## Beberapa channel dan filter member

Setiap jenis notifikasi mendukung sampai 10 channel tujuan. Tambahkan channel
melalui **Tambah channel**, pilih role mention (maksimal 5), lalu atur **Semua
member** atau **Member pilihan** pada masing-masing channel. Live, recent, X,
TikTok, dan Instagram mendukung filter ini secara terpisah. Pencarian, checkbox,
dan halaman daftar member tidak menghapus pilihan pada halaman lain.

**Semua member** juga mencakup member baru. **Member pilihan** yang kosong
berarti channel tidak menerima notifikasi member; bukan otomatis semua member.
Channel lama tetap menerima semua member sampai admin mengganti pilihannya.
Tekan **Simpan pengaturan**, kemudian **Tes channel tersimpan** pada channel
yang ingin diperiksa. Tes tidak disebarkan ke channel lain.

Alternatif di Discord: `/notifikasi atur`. Panel privat menyediakan dropdown jenis
notifikasi/channel, menu member per halaman, pencarian nama, dan role mention.
Pilihan pada panel Discord langsung tersimpan. Perubahan filter hanya berlaku
untuk pengiriman berikutnya; pesan yang sudah terkirim tidak dihapus atau dikirim
ulang. Tidak diperlukan setup OAuth atau izin login tambahan.

## Dua tingkat pengaturan

- Admin server: masuk dengan Discord, memilih server yang memiliki izin Kelola
  Server, Administrator, atau pemilik server. Menambahkan bot, channel/role per
  jenis notifikasi, platform, style banner, media, dan mengirim tes ke channel.
- Valzyy/pemilik bot: control admin di api.jkt48connect.app tetap mengatur proses,
  sumber/interval global, daftar seluruh server, blokir server, log dan histori.
  Hak pemilik bot tidak diberikan kepada admin server lain.

Pengaturan web dan slash command memakai data konfigurasi bot yang sama.
Masing-masing kategori mendukung sampai 10 channel dan 5 role per channel.
Live dan recent berbagi tujuan seperti bot sebelumnya. Channel dan role lama
masih digunakan sampai admin server mengubahnya. Perubahan hanya menyentuh
server yang sedang dipilih. Mematikan satu kategori dari web mempertahankan
pilihan channel/role agar dapat diaktifkan lagi.

## 1. Discord Developer Portal

1. Buka https://discord.com/developers/applications dan pilih aplikasi bot
   **JKT48Connect**, Application ID `1305141693477027891`.
2. **OAuth2 → Redirects**: tambahkan persis
   `https://jkt48connect.app/api/discord/auth/callback`, lalu Save Changes.
3. Ambil **OAuth2 Client Secret**. Ini berbeda dengan Bot Token.
4. Bot tetap **Public Bot**, **Requires OAuth2 Code Grant OFF**. Halaman login
   memakai Authorization Code + PKCE sendiri; alur install bot terpisah.
5. Aktifkan **Guild Install**, scope instalasi `bot` dan `applications.commands`.
   Izin instalasi: View Channels, Send Messages, Embed Links, Read Message History
   (permission integer `84992`). Tidak meminta Administrator atau Manage Roles.
6. Role yang dipilih harus mentionable, atau admin secara terpisah memberi bot
   izin Mention Everyone di channel tujuan. `@everyone` tidak bisa dipilih.
7. View Audit Log bersifat opsional untuk melihat pemasang bot di panel pemilik;
   tidak diperlukan untuk login atau pengaturan notifikasi.

Sumber resmi: https://docs.discord.com/developers/topics/oauth2 dan
https://docs.discord.com/developers/resources/user#get-current-user-guilds.

## 2. Secrets Worker website

Worker **jkt48connet-revamp** (sesuai nama yang sudah ada):

| Nama | Nilai/kegunaan |
| --- | --- |
| `DISCORD_CLIENT_ID` | `1305141693477027891` (bukan rahasia) |
| `DISCORD_CLIENT_SECRET` | OAuth2 Client Secret dari aplikasi di atas |
| `DISCORD_REDIRECT_URI` | `https://jkt48connect.app/api/discord/auth/callback` |
| `DISCORD_BOT_API_URL` | `https://dash.jkt48connect.com/internal/discord-guild` |
| `DISCORD_BOT_API_TOKEN` | Token privat bridge yang dibuat pada VPS |
| `SESSION_SECRET` | Secret sesi situs yang SUDAH ada; jangan diganti |
| `PM_DB` | Binding D1 yang SUDAH ada; jangan membuat database pengganti |

Simpan melalui Cloudflare → Workers & Pages → jkt48connet-revamp → Settings →
Variables and Secrets, atau `npx wrangler secret put NAMA`. Jangan memakai prefix
`VITE_` untuk secret. Jangan menyimpan secret di wrangler.jsonc atau commit.

Di VPS, secret OAuth hanya disimpan sementara/untuk setup di
`/etc/jkt48-discord-oauth.env` (root, mode 600). Proses bot tidak memerlukan Client
Secret; Worker website yang menukar authorization code. Bot Token tetap hanya
berada pada env bot di VPS. Client Secret bukan token login pengguna.

## 3. Database dan deploy

```bash
npm ci
npx wrangler d1 migrations apply PM_DB --remote
npm run typecheck
node --test tests/discord.test.mjs
npm run build
npx wrangler deploy --keep-vars
```

Migration `0003_discord.sql` menambahkan tabel `discord_oauth_states`,
`discord_sessions`, dan `discord_limits`. Tidak mengubah tabel pesan/transaksi PM. Jika migrasi belum dijalankan, modul Discord juga membuat tabel-tabel baru ini secara idempoten melalui binding aplikasi saat pertama aktif; tidak membutuhkan endpoint admin/migrasi publik.
Deploy mempertahankan secret, binding D1, Durable Objects, dan konfigurasi push
situs. Jangan menjalankan reset database atau mengganti SESSION_SECRET.

## 4. Bridge di baremetal

`jkt48-discord-guild-api.service` mendengarkan **127.0.0.1:8797** dan Nginx HTTPS
meneruskan `/internal/discord-guild/`. Setiap request membutuhkan token khusus
`DISCORD_GUILD_API_TOKEN` dari `/etc/jkt48-discord-guild-api.env` (mode 600).
Ini bukan controller pemilik: tidak ada on/off/restart, daftar seluruh pengguna,
akses env, atau perubahan pengaturan global pada endpoint ini.

Worker memeriksa guild melalui OAuth pengguna sebelum meneruskan request. Bridge
memeriksa ulang anggota server, izin Kelola Server/Administrator, kepemilikan
channel/role dan permission overwrites bot. Pengguna yang izinnya dicabut tidak
bisa menyimpan pengaturan. Riwayat hanya mencakup channel yang dapat dilihat
pengguna pada server tersebut. Server yang diblokir pemilik tetap tidak menerima
notifikasi meskipun admin server mengubah pengaturannya.

## 5. Alur AUTH dan penggunaan

1. Pengguna klik **Masuk dengan Discord**. Scope: `identify guilds` saja, tanpa
   email, pesan pribadi, password, atau `guilds.join`.
2. State acak sekali pakai + cookie HttpOnly SameSite=Lax + PKCE S256 melindungi
   callback. `redirect_uri` dikunci ke origin situs; tidak menerima return URL
   arbitrer. Discord code ditukar hanya oleh Worker memakai Client Secret.
3. Access token terenkripsi AES-GCM di D1. Browser hanya menerima cookie sesi
   opaque HttpOnly, Secure, host-only; token tidak disimpan di localStorage.
   Sesi maksimum 12 jam atau hingga access token berakhir, mana yang lebih cepat.
   Setelah itu pengguna login lagi. Refresh token tidak disimpan.
4. Daftar server difilter berdasarkan izin pengguna. Server yang belum memasang
   bot menampilkan **Tambahkan bot**. Install terjadi melalui persetujuan Discord,
   bukan otomatis diam-diam.
5. Setelah install, kembali ke dashboard dan klik **Perbarui server**. Buka
   **Atur notifikasi**, pilih channel dan role, lalu simpan. Tes memakai konfigurasi
   yang sudah disimpan dan hanya dikirim ke channel pertama kategori itu.
6. Setiap simpan memeriksa ulang izin Discord + Origin + CSRF. Tes dibatasi sekali
   per menit per pengguna/server. Discord rate limit dihormati.
7. Logout menghapus sesi situs. Untuk mencabut akses OAuth sepenuhnya, gunakan
   Discord User Settings → Authorized Apps → JKT48Connect → Deauthorize.

## 6. Pengujian setelah setup

- Buka /discord, login, pastikan nama/avatar benar dan server yang ditampilkan
  memang milik/dikelola akun tersebut.
- Tambahkan ke satu server uji; refresh; simpan satu channel tanpa role dahulu.
- Tekan tes: hanya channel yang dipilih menerima pesan, tidak ada broadcast ke
  server lain. Lalu uji role mention yang memang diizinkan.
- Ubah izin akun menjadi anggota biasa: refresh/simpan harus ditolak.
- Ganti ID guild/channel dari request dengan server lain: harus 403/400.
- Logout: tidak bisa membuka konfigurasi melalui request lama. Pastikan token
  OAuth, bot, dan bridge tidak muncul di network JSON frontend.

## Pengembangan lokal

Gunakan `.dev.vars` (diabaikan git), `npm run pm:setup:local`, dan tambahkan redirect
pengembangan terpisah `http://localhost:5173/api/discord/auth/callback` pada aplikasi
Discord. `DISCORD_REDIRECT_URI` lokal harus sama persis. Gunakan bot/server uji
untuk menghindari perubahan konfigurasi server produksi.
