import { Link } from "@tanstack/react-router";

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="link-arrow">
      ← {label}
    </Link>
  );
}
