import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

/** Rute aplikasi memakai hash (#/recent/abc) supaya riwayat Kembali/Maju bawaan browser tetap jalan. */
function read() {
  const raw = decodeURI(location.hash.replace(/^#/, "")) || "/";
  const [path, query = ""] = raw.split("?");
  return { path: path || "/", query: new URLSearchParams(query) };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return { ...route, parts: route.path.split("/").filter(Boolean).map(decodeURIComponent) };
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = `#${to}`;
  if (location.hash === hash) return;
  if (opts.replace) location.replace(hash);
  else location.hash = to;
}

export const back = () => history.back();
export const forward = () => history.forward();

export function Link({ to, onClick, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & { to: string; onClick?: () => void; [data: `data-${string}`]: unknown }) {
  return (
    <a
      {...rest}
      href={`#${to}`}
      draggable={false}
      onClick={(e: MouseEvent) => {
        onClick?.();
        if (e.ctrlKey || e.metaKey) e.preventDefault();
      }}
    />
  );
}

/** Aktif bila rute saat ini berada di bawah `to` ("/" hanya cocok dengan beranda). */
export function isActive(path: string, to: string) {
  return to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);
}
