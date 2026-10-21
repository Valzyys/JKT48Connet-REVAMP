import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="link-more group inline-flex items-center gap-1.5">
      <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" /> {label}
    </Link>
  );
}
