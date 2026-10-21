import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { LiveDot, cx } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { MORE_NAV, PRIMARY_NAV, SOCIALS } from "@/lib/nav";
import { q } from "@/lib/queries";

function isActive(path: string, to: string) {
  return to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`);
}

function ThemeButton() {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Mode terang" : "Mode gelap"}
      className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card/70 transition hover:border-ink"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function LiveBadge() {
  const live = useQuery(q.live());
  const n = live.data?.length ?? 0;
  return (
    <Link
      to="/live"
      className={cx(
        "hidden h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition sm:inline-flex",
        n > 0 ? "bg-brand text-white hover:bg-brand-strong" : "border border-line bg-card/70 text-ink-soft hover:border-ink",
      )}
    >
      {n > 0 ? <LiveDot /> : <span className="h-2 w-2 rounded-full bg-ink-soft/50" />}
      <span className="num">{n}</span> live
    </Link>
  );
}

function MoreMenu({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => setOpen(false), [path]);

  const active = MORE_NAV.some((n) => isActive(path, n.to));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cx(
          "inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-semibold transition",
          active ? "text-ink" : "text-ink-soft hover:text-ink",
        )}
      >
        Lainnya <ChevronDown className={cx("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      <div
        className={cx(
          "absolute right-0 top-full mt-3 w-72 origin-top-right rounded-3xl border border-line bg-card p-2 shadow-2xl shadow-black/10 transition duration-200",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        {MORE_NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cx(
              "flex items-start gap-3 rounded-2xl p-3 transition hover:bg-surface",
              isActive(path, n.to) && "bg-surface",
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <n.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{n.label}</span>
              <span className="block text-xs text-ink-soft">{n.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MobileMenu({ open, onClose, path }: { open: boolean; onClose: () => void; path: string }) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    document.body.classList.toggle("is-locked", open);
    const reduce = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (open) {
        gsap.set(el, { display: "flex" });
        gsap.fromTo(el, { clipPath: "circle(0% at 100% 0%)" }, { clipPath: "circle(150% at 100% 0%)", duration: reduce ? 0 : 0.7, ease: "power3.inOut" });
        gsap.fromTo("[data-m-item]", { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.04, duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.25 });
      } else {
        gsap.to(el, {
          clipPath: "circle(0% at 100% 0%)",
          duration: reduce ? 0 : 0.5,
          ease: "power3.inOut",
          onComplete: () => gsap.set(el, { display: "none" }),
        });
      }
    }, el);
    return () => ctx.kill();
  }, [open]);

  useEffect(() => {
    if (open) onClose();
    // Tutup menu tiap kali pindah halaman.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <div
      ref={root}
      style={{ display: "none" }}
      className="fixed inset-0 z-40 flex-col overflow-y-auto bg-bg px-5 pb-10 pt-24 lg:hidden"
    >
      <nav className="flex flex-col">
        {[...PRIMARY_NAV, ...MORE_NAV].map((n, i) => (
          <Link
            key={n.to}
            to={n.to}
            data-m-item
            className={cx(
              "flex items-center justify-between border-b border-line py-4 font-display text-3xl font-extrabold tracking-tight",
              isActive(path, n.to) ? "text-brand" : "text-ink",
            )}
          >
            {n.label}
            <span className="num text-xs font-medium text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
          </Link>
        ))}
      </nav>
      <div data-m-item className="mt-8 flex flex-wrap gap-3">
        {SOCIALS.map((s) => (
          <a key={s.href} href={s.href} target="_blank" rel="noreferrer" className="btn btn-ghost">
            {s.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function Header() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const bar = useRef<HTMLElement>(null);

  // Header menyembunyikan diri saat scroll ke bawah dan muncul lagi saat scroll ke atas.
  useEffect(() => {
    let last = window.scrollY;
    let hidden = false;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      const hide = y > 320 && y > last && !document.body.classList.contains("is-locked");
      if (hide !== hidden && bar.current) {
        hidden = hide;
        gsap.to(bar.current, { yPercent: hide ? -110 : 0, duration: 0.45, ease: "power3.out" });
      }
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header ref={bar} className="fixed inset-x-0 top-0 z-50">
        <div
          className={cx(
            "transition-[background-color,border-color,backdrop-filter] duration-300",
            scrolled || menu ? "border-b border-line bg-bg/80 backdrop-blur-xl" : "border-b border-transparent",
          )}
        >
          <div className="container-x flex h-[72px] items-center gap-4">
            <Logo onClick={() => setMenu(false)} />

            <nav className="mx-auto hidden items-center gap-0.5 rounded-full border border-line bg-card/60 p-1 backdrop-blur lg:flex">
              {PRIMARY_NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cx(
                    "rounded-full px-3.5 py-2 text-[13px] font-semibold transition",
                    isActive(path, n.to) ? "bg-ink text-bg" : "text-ink-soft hover:text-ink",
                  )}
                >
                  {n.label}
                </Link>
              ))}
              <MoreMenu path={path} />
            </nav>

            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <LiveBadge />
              <ThemeButton />
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                aria-label={menu ? "Tutup menu" : "Buka menu"}
                aria-expanded={menu}
                className="grid h-10 w-10 place-items-center rounded-full bg-ink text-bg lg:hidden"
              >
                {menu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>
      <MobileMenu open={menu} onClose={() => setMenu(false)} path={path} />
    </>
  );
}
