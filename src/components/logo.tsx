import { Link } from "@tanstack/react-router";

/** Logo: potongan tiket theater bertuliskan "48". */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`ticket grid h-8 w-12 place-items-center rounded-[4px] bg-brand text-white ${className}`}
      style={{ ["--cut" as string]: "68%", ["--r" as string]: "4px" }}
      aria-hidden
    >
      <span className="led text-[17px] leading-none text-white [text-shadow:none]">48</span>
    </span>
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/" onClick={onClick} className="group flex items-center gap-2.5" aria-label="JKT48Connect, ke beranda">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6" />
      <span className="condensed text-[20px] uppercase leading-none">
        JKT48<span className="hidden text-ink-soft sm:inline">Connect</span>
      </span>
    </Link>
  );
}
