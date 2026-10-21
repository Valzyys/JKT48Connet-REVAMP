import { Link } from "@tanstack/react-router";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" className="fill-brand" />
      <text
        x="20"
        y="26.5"
        textAnchor="middle"
        fontFamily="Bricolage Grotesque Variable, sans-serif"
        fontWeight="800"
        fontSize="17"
        letterSpacing="-1"
        fill="#fff"
      >
        48
      </text>
      <circle cx="31.5" cy="8.5" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/" onClick={onClick} className="group flex items-center gap-2.5" aria-label="JKT48Connect — Beranda">
      <LogoMark className="h-8 w-8 transition-transform duration-300 group-hover:rotate-[-8deg]" />
      <span className="font-display text-[17px] font-bold tracking-tight">
        JKT48<span className="text-brand">Connect</span>
      </span>
    </Link>
  );
}
