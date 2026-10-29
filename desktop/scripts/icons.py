"""Gambar ikon & bitmap installer aplikasi desktop dari logo piksel JKT48Connect (grid 5×5).

Keluaran (di-commit, jadi CI tidak perlu Pillow):
- build/icon.ico          : ikon aplikasi/installer, 16–256 px (ukuran kecil digambar ulang per piksel supaya tajam)
- build/icon.png          : 512 px, untuk electron-builder & jendela Linux saat pengembangan
- ui/tray.png, tray@2x    : ikon tray (16/32 px)
- build/installerSidebar.bmp, uninstallerSidebar.bmp (164×314) dan installerHeader.bmp (150×57)

Pemakaian: python3 scripts/icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
UI = ROOT / "ui"
FONT = ROOT / "ui" / "fonts" / "archivo.woff2"

RED = (225, 36, 58)
RED_DEEP = (150, 14, 32)
INK = (29, 21, 23)
CREAM = (243, 238, 230)
BUTTER = (253, 230, 176)
WHITE = (255, 255, 255)

# Sel logo salib piksel (x, y) pada grid 5×5 — sama dengan src/components/logo.tsx di situs.
PIXELS = [(2, 0), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (3, 2), (4, 2), (1, 3), (2, 3), (3, 3), (2, 4)]


def cross(draw: ImageDraw.ImageDraw, x0: float, y0: float, size: float, color, gap: float = 0.08, radius: float = 0.16):
    cell = size / 5
    for px, py in PIXELS:
        g = cell * gap / 2
        box = (x0 + px * cell + g, y0 + py * cell + g, x0 + (px + 1) * cell - g, y0 + (py + 1) * cell - g)
        draw.rounded_rectangle(box, radius=cell * radius, fill=color)


def app_icon(size: int) -> Image.Image:
    """Kotak merah membulat + salib putih. Di bawah 48 px digambar pada kisi piksel penuh supaya tidak kabur."""
    if size <= 32:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=max(2, size // 5), fill=RED)
        cell = {16: 2, 20: 3, 24: 3, 32: 4}.get(size, max(2, size // 8))
        off = (size - cell * 5) // 2
        for px, py in PIXELS:
            d.rectangle((off + px * cell, off + py * cell, off + (px + 1) * cell - 1, off + (py + 1) * cell - 1), fill=WHITE)
        return img
    s = 4  # supersampling
    big = Image.new("RGBA", (size * s, size * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    d.rounded_rectangle((0, 0, size * s - 1, size * s - 1), radius=size * s * 0.22, fill=RED)
    inner = size * s * 0.6
    cross(d, (size * s - inner) / 2, (size * s - inner) / 2, inner, WHITE, gap=0.06, radius=0.18)
    return big.resize((size, size), Image.LANCZOS)


def tray_icon(size: int) -> Image.Image:
    """Salib merah tanpa latar (lebih jelas di taskbar gelap maupun terang)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cell = size // 5
    off = (size - cell * 5) // 2
    for px, py in PIXELS:
        d.rectangle((off + px * cell, off + py * cell, off + (px + 1) * cell - 1, off + (py + 1) * cell - 1), fill=RED)
    return img


def font(size: int, weight: int = 800, width: int = 75) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    try:
        f.set_variation_by_axes([weight, width])  # sumbu Archivo: Weight, Width
    except Exception:
        pass
    return f


def sidebar(uninstall: bool = False) -> Image.Image:
    """Panel kiri halaman sambutan/selesai (164×314): merah brand, salib besar, teks condensed."""
    w, h = 164, 314
    s = 3
    img = Image.new("RGB", (w * s, h * s), RED)
    d = ImageDraw.Draw(img)
    # Gradasi halus ke merah tua di bawah.
    for y in range(h * s):
        t = y / (h * s)
        c = tuple(int(RED[i] + (RED_DEEP[i] - RED[i]) * t * 0.75) for i in range(3))
        d.line([(0, y), (w * s, y)], fill=c)
    # Teks raksasa bergaris tepi di belakang (seperti intro situs): hanya garis, isi tetap tembus.
    big = font(62 * s, 900, 62)
    outer = Image.new("L", img.size, 0)
    inner = Image.new("L", img.size, 0)
    for i, word in enumerate(["LIVE", "FRONT", "ROW"]):
        at = (-6 * s, (196 + i * 50) * s)
        ImageDraw.Draw(outer).text(at, word, font=big, fill=255, stroke_width=s, stroke_fill=255)
        ImageDraw.Draw(inner).text(at, word, font=big, fill=255)
    line = Image.eval(Image.composite(Image.new("L", img.size, 0), outer, inner), lambda v: v * 45 // 100)
    img.paste(Image.new("RGB", img.size, WHITE), (0, 0), line)
    # Salib piksel putih.
    cross(d, 22 * s, 30 * s, 64 * s, WHITE, gap=0.08, radius=0.2)
    # Nama.
    d.text((22 * s, 108 * s), "JKT48", font=font(30 * s, 900, 75), fill=WHITE)
    d.text((22 * s, 136 * s), "CONNECT", font=font(30 * s, 900, 75), fill=INK)
    d.rectangle((22 * s, 172 * s, 46 * s, 174 * s), fill=BUTTER)
    mono = font(8 * s, 700, 100)
    d.text((22 * s, 180 * s), "SAMPAI JUMPA LAGI" if uninstall else "FAN SIGNAL · WINDOWS", font=mono, fill=BUTTER)
    return img.resize((w, h), Image.LANCZOS)


def header() -> Image.Image:
    """Gambar header halaman (150×57) di latar krem: salib + nama."""
    w, h = 150, 57
    s = 3
    img = Image.new("RGB", (w * s, h * s), CREAM)
    d = ImageDraw.Draw(img)
    cross(d, 8 * s, 14 * s, 28 * s, RED, gap=0.08, radius=0.2)
    d.text((43 * s, 15 * s), "JKT48Connect", font=font(14 * s, 800, 82), fill=INK)
    d.text((43 * s, 34 * s), "UNTUK WINDOWS", font=font(7 * s, 600, 100), fill=(119, 107, 102))
    return img.resize((w, h), Image.LANCZOS)


def main():
    BUILD.mkdir(exist_ok=True)
    sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
    icons = [app_icon(n) for n in sizes]
    icons[-1].save(BUILD / "icon.ico", sizes=[(n, n) for n in sizes], append_images=icons[:-1])
    app_icon(512).save(BUILD / "icon.png")
    app_icon(256).save(UI / "icon.png")
    tray_icon(16).save(UI / "tray.png")
    tray_icon(32).save(UI / "tray@2x.png")
    sidebar().save(BUILD / "installerSidebar.bmp")
    sidebar(uninstall=True).save(BUILD / "uninstallerSidebar.bmp")
    header().save(BUILD / "installerHeader.bmp")
    print("ok:", ", ".join(p.name for p in sorted(BUILD.iterdir())))


if __name__ == "__main__":
    main()
