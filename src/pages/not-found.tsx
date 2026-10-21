import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function NotFound() {
  return (
    <section className="container-x flex min-h-[80vh] flex-col items-start justify-center pt-24">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-4 font-display text-[clamp(5rem,20vw,14rem)] font-extrabold leading-[0.85] tracking-[-0.06em]">
        4<span className="text-brand">0</span>4
      </h1>
      <p className="mt-6 max-w-md text-ink-soft">Halaman yang kamu cari tidak ada atau sudah dipindahkan.</p>
      <Link to="/" className="btn btn-primary mt-8">
        <ArrowLeft className="h-4 w-4" /> Kembali ke beranda
      </Link>
    </section>
  );
}
