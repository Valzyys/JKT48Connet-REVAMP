import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <section className="container-x pt-10">
      <div className="border-b-2 border-brand pb-5">
        <h1 className="condensed text-[clamp(4rem,14vw,9rem)] uppercase leading-[0.85]">404</h1>
        <p className="mt-3 text-ink-soft">Halaman ini tidak ada atau sudah dipindahkan.</p>
      </div>
      <Link to="/" className="link-arrow mt-5 inline-block">
        ← Kembali ke beranda
      </Link>
    </section>
  );
}
