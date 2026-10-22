import { Link } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { PageHeader } from "@/components/ui";

const CHANNELS = [
  {
    name: "Bot X",
    href: "https://x.com/JKT48Connect",
    desc: "Memposting notifikasi saat member mulai live di IDN atau Showroom, plus jadwal theater harian.",
  },
  {
    name: "Bot Discord",
    href: "https://discord.com/discovery/applications/1305141693477027891",
    desc: "Notifikasi live dan jadwal untuk server fanbase, dengan perintah untuk berita, theater, rekap live, birthday, dan profil member.",
  },
  {
    name: "Public API",
    href: "https://api.jkt48connect.app/docs",
    desc: "Data yang sama dengan situs ini, terbuka untuk website, aplikasi, dan bot komunitas lain.",
  },
];

export function AboutPage() {
  return (
    <Page>
      <PageHeader title="Tentang" />
      <section className="container-x grid gap-x-12 gap-y-10 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div data-reveal className="prose-body max-w-xl text-[16px]">
          <p>
            <strong>JKT48Connect</strong> adalah proyek komunitas untuk mengikuti aktivitas JKT48 tanpa harus membuka banyak
            aplikasi: siapa yang sedang live, show theater berikutnya, rekap live yang baru selesai, ulang tahun member, dan
            pengumuman resmi.
          </p>
          <p>
            Situs ini bukan situs resmi dan tidak berafiliasi dengan JKT48 Operation Team. Semua data berasal dari sumber publik
            melalui JKT48Connect API. Untuk informasi resmi dan pembelian tiket, gunakan{" "}
            <a href="https://jkt48.com" target="_blank" rel="noreferrer">
              jkt48.com
            </a>
            . Baca juga <Link to="/disclaimer">disclaimer</Link>.
          </p>
          <p>
            Mau memakai data yang sama untuk bot, aplikasi, atau situsmu sendiri? Lihat halaman{" "}
            <Link to="/developer">JKT48Connect API untuk developer</Link>.
          </p>
        </div>
        <div>
          {CHANNELS.map((c) => (
            <a key={c.name} href={c.href} target="_blank" rel="noreferrer" data-reveal className="group block border-b border-line py-4 first:border-t">
              <p className="flex justify-between font-semibold group-hover:text-brand">
                {c.name} <span className="text-ink-soft">↗</span>
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{c.desc}</p>
            </a>
          ))}
        </div>
      </section>
    </Page>
  );
}
