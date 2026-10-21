import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Bot, Globe, MessageSquare, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { Page } from "@/components/page";
import { PageHero } from "@/components/ui";

function Product({ n, icon, title, children }: { n: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div data-reveal className="flex flex-col rounded-[32px] border border-line bg-card p-7">
      <div className="flex items-center justify-between">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white">{icon}</span>
        <span className="num text-sm text-ink-soft">{n}</span>
      </div>
      <h3 className="mt-6 font-display text-2xl font-extrabold tracking-tight">{title}</h3>
      <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

export function AboutPage() {
  return (
    <Page>
      <PageHero
        eyebrow="Tentang"
        title={
          <>
            Satu ekosistem, <span className="text-brand">untuk fans.</span>
          </>
        }
        desc="JKT48Connect adalah ekosistem komunitas fan-made yang membantu fans JKT48 mengikuti aktivitas member secara real-time — tanpa harus memantau banyak platform sekaligus."
      />

      <section className="container-x pt-16">
        <div className="grid gap-4 md:grid-cols-3">
          <Product n="01" icon={<Radio className="h-5 w-5" />} title="Bot X (Twitter)">
            <p>Notifier otomatis: memantau saat member memulai live di IDN atau Showroom lalu mem-posting notifikasi ke timeline.</p>
            <p>Juga mem-posting jadwal theater harian agar fans tidak ketinggalan.</p>
          </Product>
          <Product n="02" icon={<MessageSquare className="h-5 w-5" />} title="Bot Discord">
            <p>Notifikasi live dan jadwal, plus perintah untuk mengambil berita, detail theater, live, rekap live, birthday, dan profil member.</p>
            <p>Dipakai banyak server komunitas fanbase Indonesia.</p>
          </Product>
          <Product n="03" icon={<Globe className="h-5 w-5" />} title="Web hub">
            <p>Situs ini: akses visual ke live member, jadwal theater, berita, birthday, rekap live, dan direktori member.</p>
            <p>Dibangun dengan fokus pada kecepatan dan keandalan data.</p>
          </Product>
        </div>
      </section>

      <section className="container-x grid gap-10 pt-24 lg:grid-cols-[1fr_1.2fr]">
        <div data-reveal>
          <p className="eyebrow">Konteks singkat</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight">Siapa itu JKT48?</h2>
        </div>
        <div data-reveal className="space-y-4 text-[15px] leading-relaxed text-ink-soft">
          <p>
            <strong className="text-ink">JKT48</strong> adalah grup idol Indonesia yang berbasis di Jakarta, sister group dari
            AKB48 asal Jepang, resmi debut pada 2011 dengan konsep <em>“idol you can meet”</em> — lewat pertunjukan theater
            harian, live streaming di IDN dan Showroom, serta rilisan single & album.
          </p>
          <p>
            JKT48Connect bukan situs resmi dan tidak berafiliasi dengan JKT48 Operation Team. Semua data berasal dari sumber
            publik melalui{" "}
            <a href="https://api.jkt48connect.app/docs" target="_blank" rel="noreferrer" className="font-semibold text-brand underline underline-offset-4">
              JKT48Connect API
            </a>
            .
          </p>
        </div>
      </section>

      <section className="container-x pt-20">
        <div data-reveal className="flex flex-wrap gap-3">
          <a href="https://x.com/JKT48Connect" target="_blank" rel="noreferrer" className="btn btn-primary">
            <Bot className="h-4 w-4" /> Bot X <ArrowUpRight className="h-4 w-4" />
          </a>
          <a href="https://discord.com/discovery/applications/1305141693477027891" target="_blank" rel="noreferrer" className="btn btn-ghost">
            Bot Discord <ArrowUpRight className="h-4 w-4" />
          </a>
          <a href="https://api.jkt48connect.app/docs" target="_blank" rel="noreferrer" className="btn btn-ghost">
            Public API <ArrowUpRight className="h-4 w-4" />
          </a>
          <Link to="/disclaimer" className="btn btn-ghost">
            Disclaimer
          </Link>
        </div>
      </section>
    </Page>
  );
}
