import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2 text-sm font-semibold text-ink-soft transition hover:text-ink">
      <span className="grid h-8 w-8 place-items-center rounded-full border border-line transition group-hover:border-ink">
        <ArrowLeft className="h-4 w-4" />
      </span>
      {label}
    </Link>
  );
}
