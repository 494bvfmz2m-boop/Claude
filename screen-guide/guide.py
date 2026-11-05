#!/usr/bin/env python3
"""Screen guide: screenshot the screen and point at things on it.

    python3 screen-guide/guide.py shot
        Full-screen capture -> screen-guide/latest.png
        (plus latest-grid.png: the same image with a labelled percentage grid,
        handy for reading off coordinates).

    python3 screen-guide/guide.py point X Y "Label"
        X and Y are percentages of the screenshot's width and height (0-100).
        Draws a big red-orange arrow with a white outline whose TIP sits exactly
        on (X%, Y%) of latest.png, puts the label in a dark pill by the tail,
        saves screen-guide/pointed.png (+ pointed-zoom.png, a close-up of the
        tip) and opens it (Preview on macOS, the default viewer elsewhere).
        Add --no-open to skip opening it.

Standard library + Pillow. Pillow is installed automatically if it's missing.
Screenshots: macOS `screencapture`; Windows/Linux Pillow's ImageGrab.
"""
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LATEST = os.path.join(HERE, "latest.png")
GRID = os.path.join(HERE, "latest-grid.png")
POINTED = os.path.join(HERE, "pointed.png")
ZOOM = os.path.join(HERE, "pointed-zoom.png")

ARROW = (255, 82, 27)        # red-orange
OUTLINE = (255, 255, 255)
PILL = (18, 20, 28, 235)
SS = 3                       # supersampling factor for smooth edges


# ------------------------------------------------------------------ Pillow
def ensure_pillow():
    try:
        import PIL  # noqa: F401
        return
    except ImportError:
        pass
    print("Pillow isn't installed; installing it now…", flush=True)
    in_venv = sys.prefix != getattr(sys, "base_prefix", sys.prefix)
    base = [sys.executable, "-m", "pip", "install", "--quiet", "Pillow"]
    attempts = [base] if in_venv else [base + ["--user"], base + ["--user", "--break-system-packages"], base]
    for cmd in attempts:
        if subprocess.run(cmd).returncode == 0:
            import importlib
            import site
            importlib.invalidate_caches()
            user_site = site.getusersitepackages() if hasattr(site, "getusersitepackages") else None
            if user_site and user_site not in sys.path:
                sys.path.append(user_site)
            try:
                import PIL  # noqa: F401
                return
            except ImportError:
                continue
    sys.exit("Couldn't install Pillow automatically. Run:  python3 -m pip install --user Pillow")


ensure_pillow()
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageGrab  # noqa: E402


# ------------------------------------------------------------------ helpers
def font(px):
    candidates = [
        "/System/Library/Fonts/SFNS.ttf", "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, px)
            except OSError:
                continue
    try:
        return ImageFont.load_default(size=px)
    except TypeError:
        return ImageFont.load_default()


def open_file(path):
    try:
        if sys.platform == "darwin":
            subprocess.run(["open", "-a", "Preview", path], check=False)
        elif os.name == "nt":
            os.startfile(path)  # default image viewer
        else:
            subprocess.Popen(["xdg-open", path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"(Couldn't open the image automatically: {e})")


# ------------------------------------------------------------------ shot
def shot():
    os.makedirs(HERE, exist_ok=True)
    if sys.platform == "darwin":
        # -x: no shutter sound; -m: the main display. Needs Screen Recording permission
        # for your terminal (System Settings > Privacy & Security > Screen Recording).
        r = subprocess.run(["screencapture", "-x", "-m", LATEST])
        if r.returncode != 0 or not os.path.exists(LATEST):
            sys.exit("screencapture failed. Give your terminal Screen Recording permission and try again.")
    else:
        ImageGrab.grab().save(LATEST)
    img = Image.open(LATEST).convert("RGB")
    make_grid(img).save(GRID)
    print(f"Saved {LATEST} ({img.width}x{img.height}) and {GRID}")


def make_grid(img):
    """Overlay a percentage grid (every 5%, labelled every 10%) for reading coordinates."""
    W, H = img.size
    out = img.copy()
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font(max(12, H // 70))
    for i in range(1, 20):
        major = i % 2 == 0
        col = (255, 0, 255, 170) if major else (0, 255, 255, 90)
        w = max(1, H // (900 if major else 1400))
        x, y = round(W * i / 20), round(H * i / 20)
        d.line([(x, 0), (x, H)], fill=col, width=w)
        d.line([(0, y), (W, y)], fill=col, width=w)
        if major:
            for tx, ty, text in ((x + 4, 4, f"{i * 5}"), (4, y + 2, f"{i * 5}")):
                box = d.textbbox((tx, ty), text, font=f)
                d.rectangle([box[0] - 3, box[1] - 2, box[2] + 3, box[3] + 2], fill=(0, 0, 0, 190))
                d.text((tx, ty), text, font=f, fill=(255, 255, 255, 255))
    return Image.alpha_composite(out.convert("RGBA"), layer).convert("RGB")


# ------------------------------------------------------------------ point
def arrow_polygon(tip, u, length, head_len, head_half, shaft_half):
    """Arrow with its tip exactly at `tip`; `u` is the unit vector from the tip toward the tail."""
    tx, ty = tip
    ux, uy = u
    px, py = -uy, ux                                 # perpendicular
    bx, by = tx + ux * head_len, ty + uy * head_len  # centre of the head's base
    ex, ey = tx + ux * length, ty + uy * length      # tail end
    return [
        (tx, ty),
        (bx + px * head_half, by + py * head_half),
        (bx + px * shaft_half, by + py * shaft_half),
        (ex + px * shaft_half, ey + py * shaft_half),
        (ex - px * shaft_half, ey - py * shaft_half),
        (bx - px * shaft_half, by - py * shaft_half),
        (bx - px * head_half, by - py * head_half),
    ]


def point(x_pct, y_pct, label, show=True):
    if not os.path.exists(LATEST):
        sys.exit("No screenshot yet: run `guide.py shot` first.")
    if not (0 <= x_pct <= 100 and 0 <= y_pct <= 100):
        sys.exit("x and y are percentages: both must be between 0 and 100.")
    img = Image.open(LATEST).convert("RGBA")
    W, H = img.size
    tip = (x_pct / 100 * W, y_pct / 100 * H)

    # The tail points toward the middle of the screen, so the arrow stays on screen.
    cx, cy = W / 2 - tip[0], H / 2 - tip[1]
    dist = math.hypot(cx, cy)
    u = (cx / dist, cy / dist) if dist > 1 else (0.7071, 0.7071)
    if dist <= 1:
        u = (-u[0], -u[1]) if tip[0] > W / 2 else u

    base = min(W, H)
    length = max(150.0, base * 0.17)
    head_len, head_half, shaft_half = length * 0.34, length * 0.17, length * 0.055
    o = max(4.0, base * 0.0042)                      # white outline thickness

    # White shape's tip is exactly on the target; the red fill sits inside it.
    theta = math.atan2(head_half, head_len)          # half-angle of the head at the tip
    inset = o / math.sin(theta)
    outer = arrow_polygon(tip, u, length, head_len, head_half, shaft_half)
    red_tip = (tip[0] + u[0] * inset, tip[1] + u[1] * inset)
    inner = arrow_polygon(red_tip, u, length - inset - o, head_len - inset + o * 0.4,
                          head_half - o * 1.15, shaft_half - o)

    # label pill beyond the tail
    f = font(max(18, round(H * 0.024)))
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    tb = probe.textbbox((0, 0), label, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    pad_x, pad_y = th * 0.9, th * 0.55
    pw, ph = tw + 2 * pad_x, th + 2 * pad_y
    tail = (tip[0] + u[0] * length, tip[1] + u[1] * length)
    reach = abs(u[0]) * pw / 2 + abs(u[1]) * ph / 2 + o * 3
    pcx, pcy = tail[0] + u[0] * reach, tail[1] + u[1] * reach
    margin = o * 3
    pcx = min(max(pcx, pw / 2 + margin), W - pw / 2 - margin)
    pcy = min(max(pcy, ph / 2 + margin), H - ph / 2 - margin)
    pill = (pcx - pw / 2, pcy - ph / 2, pcx + pw / 2, pcy + ph / 2)

    # Draw everything on a supersampled patch covering just the arrow + pill, then paste it.
    xs = [p[0] for p in outer] + [pill[0], pill[2]]
    ys = [p[1] for p in outer] + [pill[1], pill[3]]
    pad = int(o * 8)
    x0, y0 = max(0, int(min(xs)) - pad), max(0, int(min(ys)) - pad)
    x1, y1 = min(W, int(max(xs)) + pad), min(H, int(max(ys)) + pad)
    pw_, ph_ = (x1 - x0) * SS, (y1 - y0) * SS
    S = lambda pts, dx=0, dy=0: [((px - x0 + dx) * SS, (py - y0 + dy) * SS) for px, py in pts]

    shadow = Image.new("RGBA", (pw_, ph_), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon(S(outer, o * 0.6, o * 0.9), fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(o * SS * 1.2))
    layer = Image.new("RGBA", (pw_, ph_), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.polygon(S(outer), fill=OUTLINE + (255,))
    d.polygon(S(inner), fill=ARROW + (255,))
    rect = S([(pill[0], pill[1]), (pill[2], pill[3])])
    d.rounded_rectangle([rect[0], rect[1]], radius=ph / 2 * SS, fill=PILL,
                        outline=(255, 255, 255, 70), width=max(1, int(o * SS * 0.35)))
    fs = font(max(18, round(H * 0.024)) * SS)
    d.text(((pcx - x0) * SS, (pcy - y0) * SS), label, font=fs, fill=(255, 255, 255, 255), anchor="mm")
    patch = Image.alpha_composite(shadow, layer).resize((x1 - x0, y1 - y0), Image.LANCZOS)
    img.alpha_composite(patch, (x0, y0))

    out = img.convert("RGB")
    out.save(POINTED)
    # close-up of the tip so the placement can be double-checked
    r = int(base * 0.12)
    zx0, zy0 = max(0, int(tip[0]) - r), max(0, int(tip[1]) - r)
    out.crop((zx0, zy0, min(W, int(tip[0]) + r), min(H, int(tip[1]) + r))).save(ZOOM)
    print(f"Pointed at ({x_pct:g}%, {y_pct:g}%) = pixel ({tip[0]:.0f}, {tip[1]:.0f}) of {W}x{H}: {label!r}")
    print(f"Saved {POINTED} and {ZOOM}")
    if show:
        open_file(POINTED)


def main(argv):
    if len(argv) >= 1 and argv[0] == "shot":
        return shot()
    if len(argv) >= 3 and argv[0] == "point":
        rest = [a for a in argv[1:] if a != "--no-open"]
        try:
            x, y = float(rest[0].rstrip("%")), float(rest[1].rstrip("%"))
        except (ValueError, IndexError):
            sys.exit('usage: guide.py point X Y "Label"   (X, Y in percent)')
        label = " ".join(rest[2:]).strip() or "Here"
        return point(x, y, label, show="--no-open" not in argv)
    sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
