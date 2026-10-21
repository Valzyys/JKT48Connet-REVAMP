import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { cx } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { NAV, setlistNo } from "@/lib/nav";
import { q } from "@/lib/queries";

function isActive(path: string, to: string) {
  return path === to || path.startsWith(`${to}/`);
}

function ThemeButton() {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Nyalakan lampu (mode terang)" : "Matikan lampu (mode gelap)"}
      className="grid h-9 w-9 place-items-center rounded text-ink-soft transition hover:text-ink"
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

/** Papan "ON AIR" seperti di studio siaran: menyala bila ada member yang live. */
function OnAir() {
  const live = useQuery(q.live());
  const n = live.data?.length ?? 0;
  const sign = useRef<HTMLAnchorElement>(null);

  // Kedip singkat setiap kali jumlah live berubah, seperti lampu yang baru dinyalakan.
  useEffect(() => {
    if (!sign.current || !n || prefersReducedMotion()) return;
    gsap.fromTo(sign.current, { opacity: 0.3 }, { opacity: 1, duration: 0.06, repeat: 6, yoyo: true, ease: "none" });
  }, [n]);

  return (
    <Link
      ref={sign}
      to="/live"
      aria-label={n ? `${n} member sedang live` : "Tidak ada yang live"}
      className={cx(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 transition",
        n ? "border-brand/60 hover:border-brand" : "border-line hover:border-ink-soft",
      )}
    >
      <span className={cx("led text-[15px] leading-none", !n && "led-off")}>ON AIR</span>
      {n > 0 && <span className="led text-[15px] leading-none">{String(n).padStart(2, "0")}</span>}
    </Link>
  );
}

function MobileMenu({ open, path }: { open: boolean; path: string }) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    document.body.classList.toggle("is-locked", open);
    const d = prefersReducedMotion() ? 0 : 1;
    if (open) {
      gsap.set(el, { display: "block" });
      gsap.fromTo(el, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.5 * d, ease: "power3.inOut" });
      gsap.fromTo(el.querySelectorAll("[data-m]"), { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4 * d, stagger: 0.03 * d, delay: 0.2 * d });
    } else {
      gsap.to(el, {
        clipPath: "inset(0 0 100% 0)",
        duration: 0.35 * d,
        ease: "power3.in",
        onComplete: () => void gsap.set(el, { display: "none" }),
      });
    }
  }, [open]);

  return (
    <div ref={root} style={{ display: "none" }} className="fixed inset-0 z-40 overflow-y-auto bg-bg pt-16 xl:hidden">
      <div className="container-x pb-10 pt-4">
        <p data-m className="mb-2 text-[12px] font-semibold uppercase tracking-[0.3em] text-ink-soft">
          Setlist
        </p>
        <nav>
          {NAV.map((n, i) => (
            <Link
              key={n.to}
              to={n.to}
              data-m
              className="group flex items-baseline gap-4 border-b border-line py-3"
            >
              <span className={cx("led w-12 text-[18px]", !isActive(path, n.to) && "led-off")}>{setlistNo(i)}</span>
              <span className={cx("condensed text-[38px] uppercase leading-none", isActive(path, n.to) ? "text-brand" : "text-ink")}>
                {n.label}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function Header() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menu, setMenu] = useState(false);
  const [solid, setSolid] = useState(false);
  const bar = useRef<HTMLElement>(null);

  useEffect(() => setMenu(false), [path]);

  // Latar header muncul setelah scroll; header menyingkir saat scroll turun dan kembali saat scroll naik.
  useEffect(() => {
    let last = window.scrollY;
    let hidden = false;
    const onScroll = () => {
      const y = window.scrollY;
      setSolid(y > 12);
      const hide = y > 400 && y > last && !document.body.classList.contains("is-locked");
      if (hide !== hidden && bar.current) {
        hidden = hide;
        gsap.to(bar.current, { yPercent: hide ? -100 : 0, duration: 0.4, ease: "power3.out" });
      }
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        ref={bar}
        className={cx(
          "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300",
          solid || menu ? "border-line bg-bg/85 backdrop-blur-md" : "border-transparent",
        )}
      >
        <div className="container-x flex h-16 items-center gap-6">
          <Logo />
          <nav className="mx-auto hidden items-center xl:flex" aria-label="Menu utama">
            {NAV.map((n, i) => {
              const active = isActive(path, n.to);
              return (
                <Link key={n.to} to={n.to} className="group flex items-baseline gap-1.5 px-2.5 py-2">
                  <span className={cx("led text-[11px] transition", active ? "" : "led-off group-hover:opacity-80")}>{setlistNo(i)}</span>
                  <span className={cx("text-[14px] font-semibold transition", active ? "text-brand" : "text-ink-soft group-hover:text-ink")}>
                    {n.label}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 xl:ml-0">
            <OnAir />
            <ThemeButton />
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              aria-label={menu ? "Tutup menu" : "Buka menu"}
              className="flex h-9 flex-col items-center justify-center gap-[5px] px-1 xl:hidden"
            >
              <span className={cx("block h-0.5 w-6 bg-ink transition", menu && "translate-y-[3.5px] rotate-45")} />
              <span className={cx("block h-0.5 w-6 bg-ink transition", menu && "-translate-y-[3.5px] -rotate-45")} />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu open={menu} path={path} />
    </>
  );
}
