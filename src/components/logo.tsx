import { Link } from "@tanstack/react-router";

/**
 * Sel-sel piksel logo salib JKT48Connect pada grid 5×5 (x, y).
 * Diekspor supaya intro bisa menyusun logo yang sama dari piksel-piksel ini.
 */
export const PIXELS: [number, number][] = [
  [2, 0],
  [1, 1],
  [2, 1],
  [3, 1],
  [0, 2],
  [1, 2],
  [3, 2],
  [4, 2],
  [1, 3],
  [2, 3],
  [3, 3],
  [2, 4],
];

export function PixelCross({ className = "h-8 w-8", cellClass = "fill-brand" }: { className?: string; cellClass?: string }) {
  return (
    <svg viewBox="0 0 50 50" className={className} aria-hidden>
      {PIXELS.map(([x, y]) => (
        <rect key={`${x}-${y}`} data-px x={x * 10} y={y * 10} width="10" height="10" rx="1.5" className={cellClass} />
      ))}
    </svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="JKT48Connect, ke beranda">
      <PixelCross className="h-8 w-8 transition-transform duration-500 group-hover:rotate-90" />
      {!compact && <span className="text-[17px] font-extrabold tracking-tight">JKT48Connect</span>}
    </Link>
  );
}
