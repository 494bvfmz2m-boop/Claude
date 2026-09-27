"""Galactus: an admin-only cosmic set, shipped as its own zip (galactus_set.zip).

Armor: nebula plate painted by the armor-set painter, with a 3D 'Singularity'
helmet (a sleek closed void helm, a wraparound scanner visor, swept-back gold
horns and a hovering black hole with an accretion disk). Weapons: sword, axe, pickaxe, shovel, hoe, mace, spear and
trident as real cuboid models on the handheld diagonal (like mace.py), plus a
cosmic bow. Glowing parts use light_emission and an animated nebula texture.
Run: python3 itemsadder/galactus.py
"""
import math
import os
import shutil
import sys
import zipfile

from PIL import Image, ImageDraw, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_pack as B  # noqa: E402  (animate, write, MCMETA, build_model, CU)
import armor_engine as AE  # noqa: E402
import tool_forge as TF  # noqa: E402
from armor_engine import mirror, part  # noqa: E402

NS = "galactus"
OUT = os.path.join(HERE, "build_galactus")
ZIP = os.path.join(HERE, "galactus_set.zip")

# ------------------------------------------------------------------ palette
SPACE = [(4, 3, 14), (12, 8, 34), (24, 14, 62), (40, 24, 96)]
NEB_M = [(120, 40, 170), (190, 70, 210), (240, 130, 240)]      # magenta clouds
NEB_B = [(40, 70, 190), (70, 130, 240), (140, 200, 255)]       # blue clouds
STAR = [(200, 220, 255), (255, 255, 255)]
GLOW_C = [(90, 230, 255), (190, 250, 255)]                     # cyan energy
GLOW_M = [(255, 90, 230), (255, 190, 245)]
GOLD = [(130, 84, 24), (200, 150, 50), (245, 205, 100), (255, 240, 175)]
STEEL = [(20, 16, 44), (36, 30, 74), (58, 50, 110), (96, 88, 160)]


def h(x, y, k=0):
    n = (x * 374761393 + y * 668265263 + k * 97531) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65536


FRAMES = 16          # hand-made animation loop for every Galactus texture
FIRE = [(255, 255, 255), (190, 250, 255), (90, 200, 255), (70, 110, 255), (130, 60, 230), (90, 30, 170)]


def nebula_px(x, y, k=0, f=0):
    """Deep space: drifting magenta/blue clouds, twinkling stars."""
    r = h(x, y, 60 + k)
    if r > 0.93:                                             # stars twinkle out of phase
        phase = (h(x, y, 90 + k) + f / FRAMES) % 1
        if phase < 0.55:
            return STAR[1] if r > 0.965 else STAR[0]
        if phase < 0.75:
            return NEB_B[2]
    xs = x + f * 0.5                                          # clouds drift along the texture
    m = math.sin(xs * 0.45 + y * 0.2 + k) + math.sin(y * 0.55 - xs * 0.3 + h(int(xs) // 4, y // 4, 61 + k) * 2.5)
    b = math.sin(xs * 0.3 - y * 0.5 + 2 + k) + math.sin(xs * 0.6 + y * 0.35 + h(int(xs) // 5, y // 5, 62 + k) * 2)
    if m > 1.3:
        return NEB_M[2] if m > 1.75 else NEB_M[1]
    if b > 1.3:
        return NEB_B[2] if b > 1.75 else NEB_B[1]
    if m > 0.6:
        return NEB_M[0]
    if b > 0.6:
        return NEB_B[0]
    return SPACE[3] if r > 0.6 else SPACE[2] if r > 0.3 else SPACE[1]


def lerp(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


# ------------------------------------------------------------------ animated atlas
REG = {}


def atlas(f=0):
    """One animation frame of the shared 64x64 Galactus atlas."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()
    pulse = 0.5 + 0.5 * math.sin(2 * math.pi * f / FRAMES)

    def region(name, x0, y0, w, hh, fn):
        REG[name] = (x0, y0, w, hh)
        for y in range(hh):
            for x in range(w):
                c = fn(x, y, w, hh)
                if c is not None:
                    px[x0 + x, y0 + y] = (c + (255,)) if len(c) == 3 else c

    def bevel(ramp, glint=False):
        def fn(x, y, w, hh):
            if glint and (x + y - f) % FRAMES == 0:
                return (255, 250, 220)                        # a glint running across the gold
            if y == 0 or x == 0:
                return ramp[-1]
            if y == hh - 1 or x == w - 1:
                return ramp[0]
            return ramp[2] if (x + y) % 5 else ramp[1]
        return fn

    def flame(x, y, w, hh):                                   # flickering cosmic fire, holes are see-through
        t = 1 - y / (hh - 1)                                  # 0 at the base, 1 at the top
        wob = math.sin(y * 0.9 + f * 1.3 + x * 0.4) * 1.6 + (h(x, y // 2, f % 8) - 0.5) * 2
        width = (1 - t) ** 0.8 * (w / 2 - 0.5)
        d = abs(x - w / 2 + 0.5 + wob * t)
        if d > width:
            return None
        k = d / max(width, 0.01) * 0.6 + t * 0.7 + (h(x, y, 40 + f) - 0.5) * 0.3
        return FIRE[min(len(FIRE) - 1, max(0, int(k * len(FIRE))))]

    def eye(x, y, w, hh):                                     # a cosmic eye that blinks every loop
        blink = f in (11, 12)
        cx, cy = 3.5, 3.5
        if blink:
            return GOLD[2] if y == 3 or y == 4 else STEEL[1]
        r = math.hypot(x - cx, (y - cy) * 1.4)
        if r > 3.6:
            return STEEL[1]
        if r < 1.1:
            return (10, 4, 20)
        if r < 2.2:
            return lerp(GLOW_M[0], GLOW_C[0], pulse)
        return (230, 230, 255)

    def ring(x, y, w, hh):                                    # lights running around the orbit rings
        if y in (0, hh - 1):
            return GOLD[2]
        return STAR[1] if (x - f * 2) % 8 == 0 else GLOW_C[1] if (x - f * 2) % 8 in (1, 7) else GLOW_C[0]

    def runes(x, y, w, hh):
        if y in (0, hh - 1):
            return GOLD[1]
        on = (x + f) % 5 in (0, 1) and (x * 3 + y) % 2 == 0
        return GLOW_M[1] if on else (40, 10, 60)

    def plasma(x, y, w, hh):                                  # colour-cycling energy
        hue = (x + y + f) % 6
        return [GLOW_C[0], GLOW_C[1], STAR[1], GLOW_M[1], GLOW_M[0], NEB_B[2]][hue]

    region("nebula", 0, 0, 16, 16, lambda x, y, w, hh: nebula_px(x, y, 0, f))
    region("nebula2", 16, 0, 16, 16, lambda x, y, w, hh: nebula_px(x, y, 3, f))
    region("gold", 32, 0, 8, 8, bevel(GOLD, glint=True))
    region("gold_d", 40, 0, 8, 8, bevel(GOLD[:3]))
    region("steel", 48, 0, 8, 8, bevel(STEEL))
    region("steel_l", 56, 0, 8, 8, bevel(STEEL[1:] + [(140, 130, 200)]))
    region("glow_c", 32, 8, 8, 8, lambda *a: lerp(GLOW_C[0], GLOW_C[1], pulse))
    region("glow_m", 40, 8, 8, 8, lambda *a: lerp(GLOW_M[0], GLOW_M[1], 1 - pulse))
    region("glow_w", 48, 8, 8, 8, lambda *a: lerp(STAR[0], STAR[1], pulse))
    region("grip", 56, 8, 8, 8, lambda x, y, w, hh: GLOW_C[1] if (y - f) % 4 == 0 else (STEEL[1] if (x + y) % 3 else STEEL[0]))
    region("planet", 0, 16, 8, 8, lambda x, y, w, hh: [(200, 120, 60), (230, 170, 90), (170, 90, 50), (240, 200, 130)][(y + (x + f) // 4) % 4])
    region("moon", 8, 16, 8, 8, lambda x, y, w, hh: (190, 190, 210) if h(x, y, 70) > 0.3 else (130, 130, 160))
    region("ring", 16, 16, 32, 4, ring)
    region("crystal", 48, 16, 8, 8, lambda x, y, w, hh: [NEB_M[1], NEB_M[2], GLOW_M[1], NEB_B[2]][((x + y + f) // 2 + (x - y + 8) // 3) % 4])
    region("runes", 16, 20, 32, 4, runes)
    region("flame", 0, 24, 16, 16, flame)
    region("eye", 32, 24, 8, 8, eye)
    region("plasma", 40, 24, 8, 8, plasma)
    region("flame2", 48, 24, 16, 16, lambda x, y, w, hh: flame((x + 5) % w, y, w, hh))

    def visor(x, y, w, hh):                                   # colour-shifting visor with a sweeping scan line
        base = lerp(GLOW_C[0], GLOW_M[0], 0.5 + 0.5 * math.sin(2 * math.pi * (f / FRAMES) + x * 0.15))
        d = (x - f * 2) % 16
        if d == 0:
            return STAR[1]
        if d in (1, 15):
            return lerp(base, STAR[1], 0.6)
        return base

    def horn(x, y, w, hh):                                    # gold horn with energy pulsing base to tip
        d = (x - f) % 8
        if d == 0:
            return GLOW_C[1]
        if d == 1:
            return lerp(GOLD[3], GLOW_C[0], 0.5)
        return GOLD[2] if (x + y) % 5 else GOLD[1]

    def disk(x, y, w, hh):                                    # accretion disk: hot streaks racing round
        d = (x + f * 2) % 8
        return [STAR[1], (255, 220, 170), (255, 150, 90), GLOW_M[0], (150, 50, 200), GLOW_M[0], (255, 150, 90),
                (255, 220, 170)][d]

    def void(x, y, w, hh):                                    # the black hole: a rotating two-armed spiral
        cx, cy = (w - 1) / 2, (hh - 1) / 2
        r = math.hypot(x - cx, y - cy)
        a = math.atan2(y - cy, x - cx) + f * 2 * math.pi / FRAMES
        arm = math.sin(2 * a - r * 0.9)
        if r < 1.6:
            return (0, 0, 0)
        if arm > 0.75:
            return GLOW_M[1] if r < 4 else NEB_M[1]
        if arm > 0.4:
            return (60, 20, 90)
        return (6, 2, 12)

    region("visor", 0, 40, 32, 4, visor)
    region("horn", 0, 44, 32, 4, horn)
    region("disk", 0, 48, 32, 4, disk)
    region("void", 32, 40, 16, 16, void)
    return img


def strip():
    """All frames stacked vertically (read by the .mcmeta animation)."""
    frames = [atlas(f) for f in range(FRAMES)]
    out = Image.new("RGBA", (64, 64 * FRAMES), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        out.paste(fr, (0, i * 64))
    return out


MCMETA = {"animation": {"frametime": 2}}


def face_px(p, f):
    x0, y0, w, hh = REG[p["mat"]]
    (a, b, c), (d, e, g) = p["from"], p["to"]
    dx, dy, dz = d - a, e - b, g - c
    fw, fh = {"north": (dx, dy), "south": (dx, dy), "east": (dz, dy), "west": (dz, dy),
              "up": (dx, dz), "down": (dx, dz)}[f]
    fw, fh = max(0.5, min(w, fw)), max(0.5, min(hh, fh))
    ox = (w - fw) * h(len(p["name"]), len(f), 7)
    oy = (hh - fh) * h(len(f), len(p["name"]), 8)
    return x0 + ox, y0 + oy, fw, fh


FACES = ("north", "south", "east", "west", "up", "down")


class Parts(list):
    def box(self, name, frm, to, mat, glow=False):
        self.append({"name": name, "from": list(frm), "to": list(to), "mat": mat, "glow": glow})

    def column(self, name, y0, y1, w, mat, glow=False, d=None):
        d = w if d is None else d
        self.box(name, (8 - w / 2, y0, 8 - d / 2), (8 + w / 2, y1, 8 + d / 2), mat, glow)

    def ring(self, name, y0, y1, r, t, mat, glow=False):
        self.box(name + "_n", (8 - r, y0, 8 - r), (8 + r, y1, 8 - r + t), mat, glow)
        self.box(name + "_s", (8 - r, y0, 8 + r - t), (8 + r, y1, 8 + r), mat, glow)
        self.box(name + "_w", (8 - r, y0, 8 - r + t), (8 - r + t, y1, 8 + r - t), mat, glow)
        self.box(name + "_e", (8 + r - t, y0, 8 - r + t), (8 + r, y1, 8 + r - t), mat, glow)

    def plate(self, name, x0, x1, y0, y1, mat, glow=False, t=0.8):
        """A flat piece in the x-y plane (faces the camera like a sword texture)."""
        self.box(name, (x0, y0, 8 - t / 2), (x1, y1, 8 + t / 2), mat, glow)

    def fire(self, name, x, y, hgt=3, w=1.6, mat="flame"):
        """Crossed planes of animated cosmic fire."""
        self.box(name + "_a", (x - w / 2, y, 7.95), (x + w / 2, y + hgt, 8.05), mat, True)
        self.box(name + "_b", (x - 0.05, y, 8 - w / 2), (x + 0.05, y + hgt, 8 + w / 2), mat, True)

    def handle(self, y0, y1, w=1.3):
        self.column("pommel_star", y0 - 1.6, y0 - 0.2, 1.8, "gold")
        self.column("pommel_gem", y0 - 2.4, y0 - 1.6, 0.8, "glow_c", True)
        self.column("grip", y0, y1, w, "grip")
        for i, y in enumerate((y0 + 1, y0 + (y1 - y0) / 2, y1 - 1.2)):
            self.column(f"grip_band{i}", y, y + 0.5, w + 0.4, "gold_d")


# ------------------------------------------------------------------ weapon designs (upright, then turned -45)
def sword():
    p = Parts()
    p.handle(-6, 1.5)
    p.plate("guard", 3.4, 12.6, 1.5, 3, "gold")
    p.plate("guard_lo", 4.6, 11.4, 1, 1.5, "gold_d")
    for sx in (-1, 1):                                        # crescent guard tips curling up
        x = 8 + sx * 4.6
        p.plate(f"guard_tip{sx}", min(x, x + sx * 1.2), max(x, x + sx * 1.2), 3, 4.4, "gold")
        p.plate(f"guard_tip2{sx}", min(x + sx * 0.8, x + sx * 1.6), max(x + sx * 0.8, x + sx * 1.6), 4.4, 5.6, "glow_c", True)
    p.column("planet", 1.1, 3.9, 2.4, "planet", d=1.6)
    p.ring("planet_ring", 2.3, 2.6, 2.2, 0.3, "ring", True)
    # blade: nebula core, glowing edges and fuller, stepped point
    p.plate("blade", 6.9, 9.1, 3, 23, "nebula", True, t=0.7)
    p.plate("edge_l", 6.5, 6.9, 3.4, 22.4, "glow_c", True, t=0.5)
    p.plate("edge_r", 9.1, 9.5, 3.4, 22.4, "glow_c", True, t=0.5)
    p.plate("fuller", 7.8, 8.2, 4, 19, "glow_w", True, t=0.75)
    p.plate("tip0", 7.2, 8.8, 23, 25, "nebula2", True, t=0.7)
    p.plate("tip1", 7.6, 8.4, 25, 26.6, "glow_c", True, t=0.6)
    for i, y in enumerate((5, 10, 15)):                       # blue fire licking up both edges
        p.fire(f"fire_l{i}", 6.0, y, 4.2, 1.2, "flame" if i % 2 else "flame2")
        p.fire(f"fire_r{i}", 10.0, y + 2, 4.2, 1.2, "flame2" if i % 2 else "flame")
    p.column("pommel_eye", -8.6, -7.8, 1.0, "eye", True)
    for i, (x, y) in enumerate(((5.2, 12), (10.6, 16), (5.6, 19.5), (10.3, 9))):   # stars drifting off the blade
        p.box(f"star{i}", (x - 0.3, y - 0.3, 7.7), (x + 0.3, y + 0.3, 8.3), "glow_w", True)
    return p


def axe():
    p = Parts()
    p.handle(-6, 16)
    p.column("socket", 13.6, 18.4, 1.8, "gold")
    for i in range(15):                                       # smooth crescent bit, one row per unit
        y = 8.6 + i
        t = (y + 0.5 - 16) / 7.4
        reach = 3.2 + 3.4 * math.sqrt(max(0, 1 - t * t))
        x0 = 8 - 0.9 - reach
        p.plate(f"bit{i}", x0 + 0.45, 7.1, y, y + 1.01, "nebula" if i % 2 else "nebula2", True)
        p.plate(f"bit_edge{i}", x0, x0 + 0.45, y, y + 1.01, "glow_c", True, t=0.6)
    p.plate("bit_rune", 4.2, 4.6, 12, 20, "glow_w", True, t=0.85)
    p.plate("back_spike0", 9, 10.8, 14.6, 17.4, "steel")
    p.plate("back_spike1", 10.8, 12.4, 15.3, 16.7, "steel_l")
    p.plate("back_spike2", 12.4, 13.2, 15.7, 16.3, "glow_m", True)
    p.column("top_spike", 18.4, 20.8, 0.8, "gold")
    p.column("top_glow", 20.8, 21.8, 0.4, "glow_c", True)
    for i, y in enumerate((9, 13.5, 18)):
        p.fire(f"edge_fire{i}", 0.9, y, 4, 1.4, "flame" if i % 2 else "flame2")
    return p


def pickaxe():
    p = Parts()
    p.handle(-6, 17)
    p.column("socket", 16, 19.6, 1.9, "gold")
    for sx in (-1, 1):
        for j in range(5):
            x0 = 8 + sx * (1 + j * 1.5)
            y = 18.6 - j * j * 0.28
            lo, hi = sorted((x0, x0 + sx * 1.5))
            p.plate(f"arm{sx}_{j}", lo, hi, y - 0.9, y + 0.9 - j * 0.08, "nebula" if j % 2 else "nebula2", True)
        tip = 8 + sx * 8.6
        p.plate(f"tip{sx}", min(tip, tip + sx * 0.8), max(tip, tip + sx * 0.8), 11.9, 13.1, "glow_c", True)
    p.column("core", 18, 20.2, 1.2, "plasma", True)
    p.fire("tip_fire_l", -0.7, 13, 3, 1.2)
    p.fire("tip_fire_r", 16.7, 13, 3, 1.2, "flame2")
    p.fire("core_fire", 8, 20.2, 3, 1.4)
    return p


def shovel():
    p = Parts()
    p.handle(-6, 12)
    p.column("collar", 11.4, 13, 2, "gold")
    widths = (3.4, 4.6, 5.2, 5.2, 4.8, 4, 2.8, 1.4)
    for j, w in enumerate(widths):
        p.plate(f"blade{j}", 8 - w / 2, 8 + w / 2, 13 + j * 1.3, 14.3 + j * 1.3, "nebula" if j % 2 else "nebula2", True)
    p.plate("rim_l", 8 - 2.8, 8 - 2.6, 14, 21, "glow_c", True, t=0.9)
    p.plate("rim_r", 8 + 2.6, 8 + 2.8, 14, 21, "glow_c", True, t=0.9)
    p.plate("rune", 7.8, 8.2, 13.5, 21, "glow_w", True, t=0.9)
    p.fire("blade_fire", 8, 23.4, 4, 2)
    return p


def hoe():
    p = Parts()
    p.handle(-6, 18)
    p.column("socket", 17, 20.4, 1.9, "gold")
    for i in range(9):                                        # scythe blade sweeping out and down
        x1 = 7.1 - i
        y = 19.2 - (i / 8) ** 2 * 7
        hgt = 1.8 - i * 0.12
        p.plate(f"blade{i}", x1 - 1.01, x1, y - hgt, y, "nebula" if i % 2 else "nebula2", True)
        p.plate(f"edge{i}", x1 - 1.01, x1, y - hgt - 0.35, y - hgt, "glow_c", True, t=0.6)
    p.plate("tip", -1.6, -0.9, 10.6, 12.6, "glow_w", True, t=0.6)
    p.plate("back", 9, 10.6, 18.4, 19.8, "steel_l")
    p.plate("back_glow", 10.6, 11.4, 18.7, 19.5, "glow_m", True)
    p.fire("tip_fire", -1.2, 12.6, 3.2, 1.4)
    p.fire("socket_fire", 8, 20.4, 2.6, 1.4, "flame2")
    return p


def mace():
    p = Parts()
    p.handle(-6, 11)
    p.column("collar", 10.4, 11.6, 3, "gold")
    p.column("core", 11.6, 18.8, 5.6, "nebula", True)
    p.column("core_mid", 12.6, 17.8, 6.6, "nebula2", True)
    p.column("band_lo", 11.6, 12.2, 6, "gold")
    p.column("band_hi", 18.2, 18.8, 6, "gold")
    for nm, (dx, dz) in (("e", (1, 0)), ("w", (-1, 0)), ("s", (0, 1)), ("n", (0, -1))):   # moons on every side
        cx, cz = 8 + dx * 4.3, 8 + dz * 4.3
        p.box(f"moon_{nm}", (cx - 0.8, 14.4, cz - 0.8), (cx + 0.8, 16, cz + 0.8), "moon")
        cx, cz = 8 + dx * 5.4, 8 + dz * 5.4
        p.box(f"moon_spike_{nm}", (cx - 0.35, 14.85, cz - 0.35), (cx + 0.35, 15.55, cz + 0.35), "glow_c", True)
    p.ring("orbit", 15, 15.4, 7, 0.35, "ring", True)
    for dx, dz in ((7, 7), (-7, 7), (7, -7), (-7, -7)):
        p.box(f"sat{dx}{dz}", (8 + dx - 0.5, 14.7, 8 + dz - 0.5), (8 + dx + 0.5, 15.7, 8 + dz + 0.5), "crystal", True)
    p.column("crown", 18.8, 19.6, 3.4, "gold_d")
    p.column("spire0", 19.6, 21.6, 1.4, "steel_l")
    p.column("spire1", 21.6, 23.2, 0.7, "glow_c", True)
    p.column("star", 24.2, 25.6, 1.4, "plasma", True)
    p.column("eye", 14.2, 16.2, 6.7, "eye", True, d=1.2)
    for i, (x, z) in enumerate(((5.8, 8), (10.2, 8), (8, 5.8), (8, 10.2))):
        p.box(f"crown_fire{i}_a", (x - 0.8, 18.8, z - 0.05), (x + 0.8, 22.4, z + 0.05), "flame" if i % 2 else "flame2", True)
        p.box(f"crown_fire{i}_b", (x - 0.05, 18.8, z - 0.8), (x + 0.05, 22.4, z + 0.8), "flame2" if i % 2 else "flame", True)
    return p


def spear():
    p = Parts()
    p.column("butt", -9, -7.6, 1.2, "gold")
    p.column("shaft", -7.6, 16, 0.9, "steel")
    for i, y in enumerate((-4, 0, 4, 8, 12)):
        p.column(f"band{i}", y, y + 0.5, 1.3, "grip")
    p.column("collar", 16, 17.2, 1.8, "gold")
    p.ring("guard_ring", 16.4, 16.8, 2.2, 0.3, "ring", True)
    for j, w in enumerate((2.6, 3.4, 3, 2.3, 1.5, 0.8)):      # leaf spearhead
        p.plate(f"head{j}", 8 - w / 2, 8 + w / 2, 17.2 + j * 1.6, 18.8 + j * 1.6, "nebula" if j % 2 else "nebula2", True, t=0.7)
    p.plate("head_core", 7.8, 8.2, 17.4, 26, "glow_w", True, t=0.8)
    p.plate("head_tip", 7.7, 8.3, 26.8, 28.4, "glow_c", True, t=0.6)
    p.plate("ribbon0", 8.9, 9.5, 11.5, 16, "glow_m", True, t=0.3)
    p.plate("ribbon1", 9.3, 9.9, 9, 11.5, "glow_m", True, t=0.3)
    p.fire("comet_tail", 8, 16.8, 5, 2.4)
    p.fire("head_fire", 8, 28.4, 3, 1.2, "flame2")
    return p


def trident():
    p = Parts()
    p.column("butt", -9, -7.6, 1.4, "gold")
    p.column("shaft", -7.6, 14.5, 1, "steel")
    for i, y in enumerate((-4, 1, 6, 11)):
        p.column(f"band{i}", y, y + 0.5, 1.4, "grip")
    p.column("collar", 14.5, 15.7, 2, "gold")
    p.plate("crossbar", 8 - 4.6, 8 + 4.6, 15.7, 17, "gold")
    p.column("planet", 15.2, 17.6, 2.2, "planet", d=1.8)
    for sx, h0 in ((-1, 7.5), (0, 10), (1, 7.5)):             # three prongs, the middle one longest
        x = 8 + sx * 3.8
        p.plate(f"prong{sx}", x - 0.55, x + 0.55, 17, 17 + h0, "nebula" if sx else "nebula2", True, t=0.7)
        p.plate(f"prong_edge{sx}", x - 0.15, x + 0.15, 17.5, 17 + h0 - 0.4, "glow_c", True, t=0.75)
        p.plate(f"prong_tip{sx}", x - 0.3, x + 0.3, 17 + h0, 18.4 + h0, "glow_w", True, t=0.6)
        if sx:
            p.plate(f"barb{sx}", min(x, x + sx * 1.2), max(x, x + sx * 1.2), 17 + h0 - 2, 17 + h0 - 1.2, "gold_d")
        p.fire(f"prong_fire{sx}", x, 18.4 + h0, 2.8, 1.2, "flame" if sx else "flame2")
    p.column("planet_eye", 15.6, 17.2, 2.3, "eye", True, d=0.4)
    return p


WEAPONS = {  # id: (builder, material, display scale, damage, speed, extra, name)
    "sword": (sword, "NETHERITE_SWORD", 0.8, 32, 2.0, {}, "Galactic Blade"),
    "axe": (axe, "NETHERITE_AXE", 0.8, 38, 1.2, {}, "Star-Cleaver Axe"),
    "pickaxe": (pickaxe, "NETHERITE_PICKAXE", 0.8, 20, 1.6, {}, "Worldbreaker Pickaxe"),
    "shovel": (shovel, "NETHERITE_SHOVEL", 0.8, 20, 1.4, {}, "Moondust Shovel"),
    "hoe": (hoe, "NETHERITE_HOE", 0.8, 18, 4.0, {}, "Harvester of Worlds"),
    "mace": (mace, "MACE", 0.72, 30, 1.0, {"knockbackResistance": 0.5}, "Planetcrusher Mace"),
    "spear": (spear, "NETHERITE_SPEAR", 0.8, 30, 1.4, {"movementSpeed": 0.02}, "Comet Spear"),
    "trident": (trident, "TRIDENT", 0.8, 30, 1.4, {}, "Tidebringer of Andromeda"),
}


def weapon_model(parts, ref, scale, centre):
    elements = []
    for p in parts:
        el = {"name": p["name"], "from": [round(v, 3) for v in p["from"]], "to": [round(v, 3) for v in p["to"]],
              "rotation": {"angle": -45, "axis": "z", "origin": [8, centre, 8]}, "faces": {}}
        for f in FACES:
            x, y, w, hh = face_px(p, f)
            el["faces"][f] = {"uv": [round(x / 4, 3), round(y / 4, 3), round((x + w) / 4, 3), round((y + hh) / 4, 3)],
                              "texture": "#tex"}
        if p["glow"]:
            el["light_emission"] = 15
        elements.append(el)
    k = scale
    return {
        "texture_size": [64, 64], "textures": {"tex": ref, "particle": ref}, "gui_light": "front",
        "elements": elements,
        "display": {
            "thirdperson_righthand": {"rotation": [0, -90, 55], "translation": [0, 6, 1.5], "scale": [k, k, k]},
            "thirdperson_lefthand": {"rotation": [0, 90, -55], "translation": [0, 6, 1.5], "scale": [k, k, k]},
            "firstperson_righthand": {"rotation": [0, -90, 25], "translation": [1.13, 4.2, 1.13], "scale": [k * 0.8] * 3},
            "firstperson_lefthand": {"rotation": [0, 90, -25], "translation": [1.13, 4.2, 1.13], "scale": [k * 0.8] * 3},
            "gui": {"rotation": [0, 0, 0], "translation": [0, -1, 0], "scale": [0.55] * 3},
            "ground": {"translation": [0, 2, 0], "scale": [0.4] * 3},
            "fixed": {"rotation": [0, 180, 0], "translation": [0, -1, 0], "scale": [0.6] * 3},
        },
    }


def centre_of(parts):
    ys = [v for p in parts for v in (p["from"][1], p["to"][1])]
    return round((min(ys) + max(ys)) / 2, 2)


# ------------------------------------------------------------------ armor
PAL = dict(o=(6, 4, 16), d=(18, 12, 44), b=(34, 22, 84), m=(80, 40, 150), l=(200, 210, 255), t=GOLD[2],
           t2=GOLD[1], a=GLOW_C[0], g=GLOW_C[1], s1=NEB_M[1], s2=NEB_B[1])
SET = dict(id="galactus", name="Galactus", color="&5&l", pattern="nebula", secondary="stars", cover="full",
           pal=PAL, emblem=["...gg...", "..g..g..", ".g.aa.g.", "..g..g..", "...gg..."],
           look=dict(chest="core", shoulders="layered", arms="gauntlet", belt="tassets", legs="greaves",
                     boots="sabaton", trim="gem", back="circle"), arm_cut="both")


def cross_flame(name, x, y, z, w=1.6, hgt=3.0, mat="flame"):
    """Two crossed planes of animated fire: reads as a flame from every side."""
    return [part(name + "_a", (x - w / 2, y, z - 0.05), (x + w / 2, y + hgt, z + 0.05), mat, glow=True),
            part(name + "_b", (x - 0.05, y, z - w / 2), (x + 0.05, y + hgt, z + w / 2), mat, glow=True)]


def helmet_parts():
    """'Singularity': a sleek closed void helm, one wraparound scanner visor, two swept-back
    horns, a hovering black hole with an accretion disk, a high gorget and angular pauldrons."""
    p = [
        # closed helm: void steel, slightly rounded top
        part("helm_front", (-4.7, 24.4, -5), (4.7, 32, -4.6), "steel"),
        part("helm_back", (-4.7, 24.4, 4.6), (4.7, 32, 5), "steel"),
        part("helm_top", (-4.7, 32, -4.7), (4.7, 32.6, 4.7), "steel"),
        part("helm_crest", (-3.6, 32.6, -3.6), (3.6, 33.1, 3.6), "steel"),
        # nebula inlay stripe from brow over the crown to the neck
        part("inlay_front", (-0.8, 29.4, -5.08), (0.8, 32, -5), "nebula", glow=True),
        part("inlay_top", (-0.8, 33.1, -3.6), (0.8, 33.25, 3.6), "nebula", glow=True),
        part("inlay_crest", (-0.8, 32.6, -4.75), (0.8, 33.1, 4.75), "nebula", glow=True),
        part("inlay_back", (-0.8, 25.6, 5), (0.8, 32, 5.08), "nebula", glow=True),
        # V-shaped scanner visor, swept up towards the temples
        part("visor_r", (0, 27.3, -5.14), (4.9, 28.4, -4.98), "visor", glow=True, rot=("z", 22.5, (0, 27.85, -5.06))),
        part("visor_l", (-4.9, 27.3, -5.14), (0, 28.4, -4.98), "visor", glow=True, rot=("z", -22.5, (0, 27.85, -5.06))),
        part("visor_rim_r", (0, 26.9, -5.1), (4.9, 27.3, -4.95), "gold", rot=("z", 22.5, (0, 27.85, -5.06))),
        part("visor_rim_l", (-4.9, 26.9, -5.1), (0, 27.3, -4.95), "gold", rot=("z", -22.5, (0, 27.85, -5.06))),
        part("prow", (-0.35, 24.4, -5.25), (0.35, 27, -5.02), "gold"),
        part("beam", (-0.12, 33.25, -0.12), (0.12, 37.4, 0.12), "glow_c", glow=True),
        # high gorget
        part("gorget_front", (-4.4, 23.2, -4.4), (4.4, 24.6, -3.2), "gold"),
        part("gorget_back", (-4.4, 23.2, 3.2), (4.4, 24.6, 4.4), "gold"),
        part("gorget_glow", (-3.6, 23.5, -4.45), (3.6, 23.8, -4.4), "glow_c", glow=True),
        # the black hole hovering above the head
        part("chin_point", (-1.3, 23.3, -5.35), (1.3, 24.4, -4.9), "gold"),
        part("chin_glow", (-0.4, 23.5, -5.4), (0.4, 24.1, -5.35), "glow_c", glow=True),
        part("singularity", (-1.3, 37.4, -1.3), (1.3, 40, 1.3), "void", glow=True),
    ]
    o = (0, 38.7, 0)                                          # double accretion disk, tilted
    for ring_name, r, t, mat in (("disk", 4.2, 0.6, "disk"), ("disk_inner", 2.6, 0.4, "plasma")):
        for nm, frm, to in (("n", (-r, 38.55, -r), (r, 38.85, -r + t)), ("s", (-r, 38.55, r - t), (r, 38.85, r)),
                            ("w", (-r, 38.55, -r + t), (-r + t, 38.85, r - t)),
                            ("e", (r - t, 38.55, -r + t), (r, 38.85, r - t))):
            p.append(part(f"{ring_name}_{nm}", frm, to, mat, glow=True, rot=("x", 22.5, o)))
    p += mirror([
        part("helm_side", (4.4, 24.4, -4.6), (4.9, 32, 4.6), "steel"),
        part("visor_side", (4.9, 27.3, -4.7), (5.02, 28.5, 1.5), "visor", glow=True),
        part("gorget_side", (3.2, 23.2, -3.2), (4.4, 24.6, 3.2), "gold"),
        part("side_panel", (4.9, 28.9, -3.2), (5.02, 31.7, 3.2), "nebula", glow=True),
        part("side_frame", (4.9, 31.7, -3.4), (5.05, 32, 3.4), "gold"),
        # big swept-back horns from the temples
        part("horn0", (4.5, 29.2, -1.6), (6.4, 31.6, 2), "horn", glow=True),
        part("horn1", (5, 30.5, 1.6), (6.4, 32.3, 6.4), "horn", glow=True, rot=("x", -22.5, (5.7, 31.4, 1.6))),
        part("horn2", (5.3, 32.2, 5.8), (6.2, 33.6, 10), "horn", glow=True, rot=("x", -45, (5.75, 32.9, 5.8))),
        part("horn3", (5.45, 35, 7.8), (6.05, 38.4, 8.6), "horn", glow=True),
        part("horn_tip", (5.5, 38.4, 7.9), (6, 39.6, 8.5), "glow_c", glow=True),
        part("horn_edge", (6.4, 29.5, -1.2), (6.55, 31.3, 1.6), "glow_c", glow=True),
        part("horn_line", (5.6, 32.3, 1.8), (5.8, 32.45, 6.2), "glow_c", glow=True, rot=("x", -22.5, (5.7, 31.4, 1.6))),
        part("horn_low", (4.8, 26.8, 0.6), (5.6, 27.8, 3.8), "horn", glow=True, rot=("x", -22.5, (5.2, 27.3, 0.6))),
        part("horn_low_tip", (4.95, 28.7, 3.6), (5.45, 29.5, 4.1), "glow_c", glow=True),
        part("jaw", (3.1, 24.4, -5.5), (4.9, 27, -4.9), "steel_l", rot=("y", 22.5, (4.9, 25.7, -4.9))),
        # angular pauldrons with glowing edge lines
        part("pauldron", (4.4, 25, -2.6), (8.9, 26.2, 2.6), "steel"),
        part("pauldron_upper", (5, 26.2, -2), (8.3, 27, 2), "steel_l"),
        part("pauldron_edge", (8.9, 24.4, -2.6), (9.1, 26.2, 2.6), "glow_c", glow=True),
        part("pauldron_line", (5, 27, -0.25), (8.3, 27.15, 0.25), "glow_m", glow=True),
        part("pauldron_trim", (4.4, 24.7, -2.7), (8.9, 25, 2.7), "gold")])
    return p


def resolve_faces(parts):
    """Per-face texture rects at 1 px per unit (player units), from the animated atlas."""
    for q in parts:
        q["faces"] = {f: face_px(q, f) for f in FACES}
    return parts


# ------------------------------------------------------------------ bow (sprite-based: bows need pull frames)
BOW = dict(metal=(80, 40, 150), handle=(20, 14, 44), accent=GOLD[2], glow=GLOW_C[1], outline=(6, 4, 16),
           bow="wing", bow_tips="gem", bow_mat="metal", string=GLOW_C[0], bow_studs=True)


# ------------------------------------------------------------------ configs
LORE = ["&f", "&o&7Forged in the heart of a dying star,", "&o&7worn by the one who devours worlds.", "&f",
        "&4Admin only"]
ARMOR = {"helmet": (8, "head"), "chestplate": (14, "CHEST"), "leggings": (12, "LEGS"), "boots": (8, "FEET")}
ARMOR_EXTRA = {"armorToughness": 8, "knockbackResistance": 0.3, "maxHealth": 10, "movementSpeed": 0.01,
               "attackDamage": 2}


def lore_yml(lines):
    return "    lore:\n" + "".join("      - '" + s.replace("'", "''") + "'\n" for s in lines)


def items_yml():
    stats = "".join(f"\n        {k}: {v}" for k, v in ARMOR_EXTRA.items())
    perk = ["&f", "&d+5 hearts, +8 toughness, +10% speed, +2 damage per piece"]
    out = []
    for piece, (armor, slot) in ARMOR.items():
        if piece == "helmet":
            out.append(f"""  galactus_helmet:
    enabled: true
    display_name: '&5&lGalactus Helmet'
{lore_yml(LORE[:4] + perk[1:] + LORE[3:])}    permission: galactus.helmet
    behaviours:
      hat: true
    resource:
      material: LEATHER_HORSE_ARMOR
      generate: false
      model_path: item/galactus_helmet
    durability:
      max_custom_durability: 99999
    attribute_modifiers:
      head:
        armor: {armor}{stats}""")
        else:
            out.append(f"""  galactus_{piece}:
    enabled: true
    display_name: '&5&lGalactus {piece.capitalize()}'
{lore_yml(LORE[:4] + perk[1:] + LORE[3:])}    permission: galactus.{piece}
    resource:
      material: NETHERITE_{piece.upper()}
      generate: true
      textures:
        - item/galactus_{piece}
    durability:
      max_custom_durability: 99999
    equipment:
      id: galactus:galactus_armor
      slot: {slot}
      slot_attribute_modifiers:
        armor: {armor}{stats}""")
    for wid, (_, mat, _, dmg, spd, extra, name) in WEAPONS.items():
        ex = "".join(f"\n        {k}: {v}" for k, v in extra.items())
        out.append(f"""  galactus_{wid}:
    enabled: true
    display_name: '&5&l{name}'
{lore_yml(LORE[:4] + [f"&d+{dmg} attack damage"] + LORE[3:])}    permission: galactus.{wid}
    resource:
      material: {mat}
      generate: false
      model_path: item/galactus_{wid}
    durability:
      max_custom_durability: 99999
    attribute_modifiers:
      mainhand:
        attackDamage: {dmg}
        attackSpeed: {spd}{ex}""")
    out.append(f"""  galactus_bow:
    enabled: true
    display_name: '&5&lNebula Bow'
{lore_yml(LORE)}    permission: galactus.bow
    resource:
      material: BOW
      generate: false
      model_path: item/galactus_bow
      icon: item/galactus_bow_icon
    durability:
      max_custom_durability: 99999""")
    out.append(f"""  galactus_shield:
    enabled: true
    display_name: '&5&lEvent Horizon Shield'
{lore_yml(LORE[:4] + ["&d+50% knockback resistance, +4 toughness in the offhand"] + LORE[3:])}    permission: galactus.shield
    resource:
      material: SHIELD
      generate: false
      model_path: item/galactus_shield
    durability:
      max_custom_durability: 99999
    attribute_modifiers:
      offhand:
        knockbackResistance: 0.5
        armorToughness: 4""")
    return f"info:\n  namespace: {NS}\nitems:\n" + "\n".join(out) + "\n"


def build():
    shutil.rmtree(OUT, ignore_errors=True)
    base = f"{OUT}/{NS}"
    W = B.write
    # armor layers, icons and 3D helmet
    l1, l2 = AE.layers(SET)
    W(f"{base}/textures/armor/galactus_armor/layer_1.png", l1)
    W(f"{base}/textures/armor/galactus_armor/layer_2.png", l2)
    icons = AE.icons(SET)
    for piece in ("chestplate", "leggings", "boots"):
        W(f"{base}/textures/item/galactus_{piece}.png", icons[piece])
    atlas(0)                                                  # fills REG
    W(f"{base}/textures/item/galactus_fx.png", strip())
    W(f"{base}/textures/item/galactus_fx.png.mcmeta", MCMETA)
    ref = f"{NS}:item/galactus_fx"
    hparts = resolve_faces(helmet_parts())
    W(f"{base}/models/item/galactus_helmet.json", AE.hat_model(hparts, ref, 0.4))
    weapon_parts = {}
    for wid, (fn, _, scale, *_rest) in WEAPONS.items():
        parts = fn()
        weapon_parts[wid] = parts
        model = weapon_model(parts, ref, scale, centre_of(parts))
        W(f"{base}/models/item/galactus_{wid}.json", model)
        if wid in ("trident", "spear"):   # a holding variant, same as the held model
            W(f"{base}/models/item/galactus_{wid}_holding.json", model)
        if wid == "trident":   # ItemsAdder also loads <model>_throwing for the trident's charge-up pose
            k = scale
            throw = dict(model, display=dict(model["display"], **{
                "thirdperson_righthand": {"rotation": [0, -90, 145], "translation": [0, 8, 1.5], "scale": [k, k, k]},
                "thirdperson_lefthand": {"rotation": [0, 90, -145], "translation": [0, 8, 1.5], "scale": [k, k, k]},
                "firstperson_righthand": {"rotation": [0, -90, 70], "translation": [1.13, 6, 1.13], "scale": [k * 0.8] * 3},
                "firstperson_lefthand": {"rotation": [0, 90, -70], "translation": [1.13, 6, 1.13], "scale": [k * 0.8] * 3}}))
            W(f"{base}/models/item/galactus_trident_throwing.json", throw)
    img = atlas(0)
    # bow
    P = TF.Pal(BOW)
    for state, suffix in (("bow", ""), ("bow_pulling_0", "_0"), ("bow_pulling_1", "_1"), ("bow_pulling_2", "_2")):
        tex = ImageOps.mirror(TF.bow(BOW, state))
        name = f"galactus_bow{suffix}"
        ref = f"{NS}:item/{name}"
        if not suffix:
            W(f"{base}/textures/item/{name}_icon.png", tex)
        W(f"{base}/textures/item/{name}.png", B.animate(tex, P.glow_set(), P.shimmer_set()))
        W(f"{base}/textures/item/{name}.png.mcmeta", B.MCMETA)
        W(f"{base}/models/item/{name}.json", {
            "texture_size": list(tex.size), "textures": {"layer0": ref, "particle": ref}, "gui_light": "front",
            "elements": B.CU.tool_elements(tex, flat=True, glow=P.glow_set()), "display": B.build_model.BOW_DISPLAY})
    # shield: nebula face animated over the same 16-frame loop
    import shield_forge as SF
    sh_frames = [SF.texture(SET, "spiked", lambda x, y, f=f: nebula_px(x, y, 7, f)) for f in range(FRAMES)]
    sh_strip = Image.new("RGBA", (64, 64 * FRAMES), (0, 0, 0, 0))
    for i, fr in enumerate(sh_frames):
        sh_strip.paste(fr, (0, i * 64))
    W(f"{base}/textures/item/galactus_shield.png", sh_strip)
    W(f"{base}/textures/item/galactus_shield.png.mcmeta", MCMETA)
    held, blocking = SF.models(f"{NS}:item/galactus_shield", glow=True)
    W(f"{base}/models/item/galactus_shield.json", held)
    W(f"{base}/models/item/galactus_shield_blocking.json", blocking)
    # configs
    W(f"{base}/configs/items.yml", items_yml())
    W(f"{base}/configs/equipments.yml", f"""info:
  namespace: {NS}
equipments:
  galactus_armor:
    type: armor
    layer_1: armor/galactus_armor/layer_1
    layer_2: armor/galactus_armor/layer_2
""")
    ids = [f"galactus_{p}" for p in ARMOR] + [f"galactus_{w}" for w in WEAPONS] + ["galactus_bow", "galactus_shield"]
    W(f"{base}/configs/categories.yml", f"""info:
  namespace: {NS}
categories:
  galactus:
    enabled: true
    name: '&5&lGalactus'
    icon: {NS}:galactus_sword
    permission: ia.menu.galactus
    items:
""" + "".join(f"      - {NS}:{i}\n" for i in ids))
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for folder, _, files in sorted(os.walk(OUT)):
            rel = os.path.relpath(folder, OUT)
            if rel != ".":
                z.write(folder, rel + "/")
            for f in sorted(files):
                z.write(os.path.join(folder, f), os.path.join(rel, f))
    return dict(l1=l1, l2=l2, hparts=hparts, icons=icons, img=img, weapons=weapon_parts)


# ------------------------------------------------------------------ previews (not part of the pack)
def render_weapon(img, parts, yaw=-30, tilt=14, size=560, scale=13, diagonal=True):
    import preview as PV
    c = centre_of(parts)
    yr, pr = math.radians(yaw), math.radians(tilt)

    def cam(q):
        X, Y, Z = q[0] - 8, q[1] - c, q[2] - 8
        x1 = X * math.cos(yr) + Z * math.sin(yr)
        z1 = -X * math.sin(yr) + Z * math.cos(yr)
        return x1, Y * math.cos(pr) - z1 * math.sin(pr), Y * math.sin(pr) + z1 * math.cos(pr)

    rot = ("z", -45, (8, c, 8)) if diagonal else None
    polys = []
    for p in parts:
        for f in FACES:
            n1 = PV.rotate(PV.NORMALS[f], (rot[0], rot[1], (0, 0, 0))) if rot else PV.NORMALS[f]
            if cam(n1)[2] - cam((0, 0, 0))[2] >= 0:
                continue
            x0, y0, w, hh = face_px(p, f)
            P = PV.face_fn(f, (p["from"], p["to"]))
            nu, nv = max(1, round(w)), max(1, round(hh))
            for i in range(nu):
                for j in range(nv):
                    col = img.getpixel((min(63, int(x0 + (i + 0.5) * w / nu)), min(63, int(y0 + (j + 0.5) * hh / nv))))
                    if col[3] == 0:
                        continue                                  # see-through (fire outline)
                    pts = [cam(PV.rotate(P(a / nu, b / nv), rot)) for a, b in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
                    light = 1.0 if p["glow"] else PV.LIGHT[f]
                    polys.append((sum(q[2] for q in pts) / 4, [(q[0], q[1]) for q in pts],
                                  tuple(min(255, int(v * light)) for v in col[:3])))
    polys.sort(key=lambda q: -q[0])
    out = Image.new("RGB", (size, size), (10, 8, 22))
    d = ImageDraw.Draw(out)
    for _, pts, col in polys:
        d.polygon([(size / 2 + x * scale, size / 2 - y * scale) for x, y in pts], fill=col)
    return out


if __name__ == "__main__":
    import preview as PV
    r = build()
    prev = os.path.join(HERE, "previews")
    sheet = PV.sheet(r["l1"], r["l2"], r["img"], r["hparts"], list(r["icons"].values()))
    bow = Image.new("RGBA", (32, 32), (10, 8, 22, 255))
    bow.alpha_composite(TF.bow(BOW, "bow"))
    tiles = [render_weapon(r["img"], parts) for parts in r["weapons"].values()]
    tiles.append(bow.convert("RGB").resize((560, 560), Image.NEAREST))
    grid = Image.new("RGB", (560 * 3, 560 * 3), (10, 8, 22))
    dr = ImageDraw.Draw(grid)
    for i, (t, name) in enumerate(zip(tiles, [w[6] for w in WEAPONS.values()] + ["Nebula Bow"])):
        grid.paste(t, ((i % 3) * 560, (i // 3) * 560))
        dr.text(((i % 3) * 560 + 12, (i // 3) * 560 + 530), name, fill=(230, 220, 255))
    sheet.save(os.path.join(prev, "galactus_armor.png"))
    grid.save(os.path.join(prev, "galactus_weapons.png"))
    print(ZIP)
