import {
  Braces,
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

export type NavItem = { to: string; label: string; icon: LucideIcon; group: NavGroup };
export type NavGroup = "Utama" | "Arsip" | "Info";

export const NAV: NavItem[] = [
  { to: "/", label: "Beranda", icon: House, group: "Utama" },
  { to: "/live", label: "Live", icon: Radio, group: "Utama" },
  { to: "/theater", label: "Theater", icon: Ticket, group: "Utama" },
  { to: "/schedule", label: "Jadwal", icon: CalendarDays, group: "Utama" },
  { to: "/member", label: "Member", icon: Users, group: "Utama" },
  { to: "/recent", label: "Recent", icon: History, group: "Arsip" },
  { to: "/news", label: "Berita", icon: Newspaper, group: "Arsip" },
  { to: "/birthday", label: "Birthday", icon: Cake, group: "Arsip" },
  { to: "/video", label: "Video", icon: PlayCircle, group: "Arsip" },
  { to: "/developer", label: "API", icon: Braces, group: "Info" },
  { to: "/about", label: "Tentang", icon: Info, group: "Info" },
];

export const NAV_GROUPS: NavGroup[] = ["Utama", "Arsip", "Info"];

/** Empat menu utama di dock bawah (HP); semua menu ada di layar menu penuh. */
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
