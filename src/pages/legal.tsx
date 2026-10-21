import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Page } from "@/components/page";
import { PageHero } from "@/components/ui";

function LegalLayout({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <Page>
      <PageHero eyebrow={eyebrow} title={title} desc="Berlaku 2026." />
      <section className="container-x pt-12">
        <article data-reveal className="prose-legal max-w-3xl text-[15px]">
          {children}
        </article>
      </section>
    </Page>
  );
}

export function DisclaimerPage() {
  return (
    <LegalLayout eyebrow="Transparansi" title="Disclaimer.">
      <p>
        JKT48Connect adalah proyek komunitas fan-made untuk membantu fans membaca jadwal, informasi live member, theater,
        birthday, dan berita yang tersedia secara publik.
      </p>
      <p>
        Situs ini <strong>bukan situs resmi JKT48</strong>, tidak dioperasikan oleh JKT48 Operation Team, dan tidak
        berafiliasi dengan Indonesia Entertainment Group atau pihak resmi terkait.
      </p>
      <p>
        Kami tidak pernah meminta password atau kredensial dari layanan resmi JKT48 mana pun. Foto member, berita, dan
        metadata lain tetap menjadi milik pemiliknya masing-masing.
      </p>
      <p>
        Jika kamu mencari informasi resmi, gunakan kanal resmi JKT48. Untuk kontak komunitas JKT48Connect, gunakan
        tautan media sosial yang tersedia di footer.
      </p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Syarat & ketentuan.">
      <p>
        Dengan mengakses atau menggunakan JKT48Connect (“Layanan”), Anda setuju untuk terikat pada syarat dan ketentuan
        berikut. Bila Anda tidak setuju, mohon berhenti menggunakan Layanan.
      </p>
      <h2>1. Sifat Layanan</h2>
      <p>
        JKT48Connect adalah proyek komunitas fan-made yang menampilkan data publik seputar JKT48 (jadwal, live, berita,
        dan sebagainya). Layanan ini <strong>tidak berafiliasi</strong> dengan JKT48 Operation Team, IDN, Showroom,
        maupun pihak resmi lainnya.
      </p>
      <h2>2. Akun Pengguna</h2>
      <p>
        Akun JKT48Connect bersifat opsional dan hanya diperlukan untuk fitur komunitas. Anda bertanggung jawab menjaga
        kerahasiaan kredensial akun Anda. Kami tidak akan pernah meminta password layanan lain (IDN, JKT48 official,
        media sosial, dsb).
      </p>
      <h2>3. Perilaku Pengguna</h2>
      <p>Anda setuju untuk tidak:</p>
      <ul>
        <li>Menyalahgunakan Layanan untuk spam, ujaran kebencian, pelecehan, atau tindakan ilegal.</li>
        <li>Melakukan reverse engineering, scraping berlebih, atau upaya membobol sistem.</li>
        <li>Mengunggah konten yang melanggar hak cipta atau privasi orang lain.</li>
        <li>Menyamar sebagai admin, member JKT48, atau pihak resmi lainnya.</li>
      </ul>
      <h2>4. Konten Pihak Ketiga</h2>
      <p>
        Stream video, gambar member, berita, dan metadata lain berasal dari sumber pihak ketiga. Hak cipta atas konten
        tersebut tetap milik pemiliknya masing-masing. JKT48Connect tidak mengklaim kepemilikan atas materi tersebut.
      </p>
      <h2>5. Batasan Tanggung Jawab</h2>
      <p>
        Layanan disediakan “sebagaimana adanya”. Kami tidak menjamin ketersediaan tanpa gangguan, akurasi data yang
        berasal dari API publik, atau kelanjutan fitur tertentu. Kami tidak bertanggung jawab atas kerugian tidak
        langsung yang timbul dari penggunaan Layanan.
      </p>
      <h2>6. Perubahan Ketentuan</h2>
      <p>Kami dapat memperbarui ketentuan ini sewaktu-waktu. Perubahan berlaku sejak dipublikasikan di halaman ini.</p>
      <h2>7. Kontak</h2>
      <p>
        Untuk pertanyaan terkait ketentuan ini, hubungi kami melalui kanal komunitas di halaman{" "}
        <Link to="/about">Tentang</Link>.
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Kebijakan privasi.">
      <p>
        Kebijakan ini menjelaskan bagaimana JKT48Connect mengumpulkan, menggunakan, dan melindungi data Anda saat
        menggunakan Layanan.
      </p>
      <h2>1. Data yang Kami Kumpulkan</h2>
      <ul>
        <li>
          <strong>Data akun</strong>: email, nama tampilan, foto profil, dan preferensi profil yang Anda isi sendiri.
        </li>
        <li>
          <strong>Data teknis</strong>: alamat IP, user-agent, dan log permintaan minimum untuk keamanan dan pencegahan
          abuse.
        </li>
      </ul>
      <h2>2. Cara Kami Menggunakan Data</h2>
      <ul>
        <li>Menjalankan fitur komunitas.</li>
        <li>Memelihara keamanan sistem dan mencegah penyalahgunaan.</li>
        <li>Memenuhi kewajiban hukum bila diperlukan.</li>
      </ul>
      <p>
        Kami <strong>tidak menjual</strong> data pribadi Anda kepada pihak ketiga dan tidak menggunakannya untuk iklan
        lintas situs.
      </p>
      <h2>3. Cookies & Penyimpanan Lokal</h2>
      <p>
        Situs ini memakai penyimpanan lokal browser untuk preferensi tampilan (mode terang/gelap) dan menandai intro yang
        sudah ditonton. Anda dapat menghapusnya kapan saja melalui pengaturan browser.
      </p>
      <h2>4. Penyimpanan & Keamanan</h2>
      <p>
        Data disimpan di infrastruktur yang terenkripsi saat transit dan saat idle. Akses internal dibatasi berdasarkan
        peran. Tidak ada sistem yang 100% aman; kami akan memberi tahu bila terjadi insiden keamanan material yang
        memengaruhi data Anda.
      </p>
      <h2>5. Hak Anda</h2>
      <ul>
        <li>Mengakses dan memperbarui data profil Anda.</li>
        <li>Meminta ekspor atau penghapusan data Anda.</li>
        <li>Menarik persetujuan atas pemrosesan opsional.</li>
      </ul>
      <h2>6. Anak di Bawah Umur</h2>
      <p>
        Layanan tidak ditujukan untuk anak di bawah 13 tahun. Jika Anda merasa anak Anda telah memberikan data pribadi
        kepada kami, silakan hubungi kami untuk penghapusan.
      </p>
      <h2>7. Kontak</h2>
      <p>
        Untuk permintaan terkait data pribadi, hubungi kami melalui kanal komunitas di halaman <Link to="/about">Tentang</Link>.
      </p>
    </LegalLayout>
  );
}
