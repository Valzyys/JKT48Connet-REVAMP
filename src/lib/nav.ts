import {
  Cake,
  CalendarDays,
  History,
  House,
  Info,
  Newspaper,
  PlayCircle,
  Radio,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { to: "/", label: "Beranda", icon: House },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/theater", label: "Theater", icon: Ticket },
  { to: "/schedule", label: "Jadwal", icon: CalendarDays },
  { to: "/member", label: "Member", icon: Users },
  { to: "/recent", label: "Recent", icon: History },
  { to: "/news", label: "Berita", icon: Newspaper },
  { to: "/birthday", label: "Birthday", icon: Cake },
  { to: "/video", label: "Video", icon: PlayCircle },
  { to: "/about", label: "Tentang", icon: Info },
];

/** Empat menu utama di navigasi bawah (HP); sisanya masuk "Lainnya". */
export const MOBILE_MAIN = ["/", "/live", "/schedule", "/member"];

export function isActive(path: string, to: string) {
  return to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);
}

export function navFor(path: string) {
  return NAV.find((n) => n.to !== "/" && isActive(path, n.to)) ?? NAV[0];
}

export const SOCIALS = [
  { label: "X @JKT48Connect", href: "https://x.com/JKT48Connect" },
  { label: "Bot Discord", href: "https://discord.com/discovery/applications/1305141693477027891" },
  { label: "Public API", href: "https://api.jkt48connect.app/docs" },
];
