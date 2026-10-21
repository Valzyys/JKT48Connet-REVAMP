import {
  Building2,
  Cake,
  CalendarDays,
  History,
  Home,
  Info,
  Newspaper,
  PlayCircle,
  Radio,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon; desc?: string };

/** Menu utama yang tampil langsung di header desktop. */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Beranda", icon: Home },
  { to: "/live", label: "Live", icon: Radio, desc: "Member yang sedang siaran" },
  { to: "/theater", label: "Theater", icon: Building2, desc: "Jadwal & detail show" },
  { to: "/member", label: "Member", icon: Users, desc: "Direktori member JKT48" },
  { to: "/schedule", label: "Jadwal", icon: CalendarDays, desc: "Theater & event per tanggal" },
  { to: "/news", label: "Berita", icon: Newspaper, desc: "Kabar resmi terbaru" },
];

/** Menu tambahan di dropdown "Lainnya" & menu mobile. */
export const MORE_NAV: NavItem[] = [
  { to: "/birthday", label: "Birthday", icon: Cake, desc: "Ulang tahun member terdekat" },
  { to: "/recent", label: "Recent Live", icon: History, desc: "Live yang baru selesai" },
  { to: "/video", label: "Video", icon: PlayCircle, desc: "Upload terbaru kanal resmi" },
  { to: "/about", label: "Tentang", icon: Info, desc: "Tentang JKT48Connect" },
];

export const SOCIALS = [
  { label: "X · @JKT48Connect", href: "https://x.com/JKT48Connect" },
  { label: "Discord Bot", href: "https://discord.com/discovery/applications/1305141693477027891" },
];
