"""Demon Armor: flat armor layers, GUI icons, and 3D parts (horns, bat wings,
tail, fangs, claws) exported as Blockbench models plus a native Java 3D
helmet model.

Player space (Blockbench entity coords): y up, feet at y=0, the player faces
-z (north), the player's right side is +x. Run: python3 demon.py
"""
import base64
import io
import json
import math
import os
import random
import uuid

from PIL import Image

OUT = os.path.dirname(os.path.abspath(__file__))

# --- palette: charred black-red plate, blood leather, bone, hellfire -------
INK = (10, 4, 4)
OBS0 = (22, 8, 8)
OBS1 = (38, 12, 12)
OBS2 = (58, 16, 16)
OBS3 = (86, 22, 20)
OBS4 = (122, 34, 28)
LAVA0 = (140, 20, 4)
LAVA1 = (230, 70, 10)
LAVA2 = (255, 150, 20)
LAVA3 = (255, 236, 130)
BONE0 = (120, 100, 84)
BONE1 = (176, 156, 132)
BONE2 = (226, 212, 186)
BONE3 = (248, 240, 222)
HORN0 = (28, 18, 16)      # blackened horn tips
HORN1 = (52, 34, 30)
SKIN0 = (70, 8, 10)       # wing / tail leather
SKIN1 = (112, 14, 16)
SKIN2 = (150, 26, 24)
OUTLINE = (54, 20, 22)    # icon outline (lighter than INK so it reads in 3D)

rng = random.Random(666)


# --- small canvas helper -------------------------------------------------
class Tex:
    def __init__(self, w, h):
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def put(self, x, y, c):
        self.px[x, y] = c + (255,)

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.put(i, j, c)

    def plate(self, x0, y0, w, h, light=0, cracks=0.0):
        """Charred plate: mild two-tone texture, bevel, optional lava cracks."""
        shades = [OBS0, OBS1, OBS2, OBS3, OBS4]
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                i = 1 + light + (1 if (x * 7 + y * 3) % 11 == 0 else 0)
                self.put(x, y, shades[min(4, i)])
        for x in range(x0, x0 + w):
            self.put(x, y0, shades[min(4, 3 + light)])
            self.put(x, y0 + h - 1, OBS0)
        for y in range(y0 + 1, y0 + h - 1):
            self.put(x0, y, shades[min(4, 2 + light)])
            self.put(x0 + w - 1, y, OBS0)
        for _ in range(int(w * h * cracks / 4)):
            x, y = rng.randrange(x0 + 1, x0 + w - 1), rng.randrange(y0 + 1, y0 + h - 1)
            for k in range(4):
                self.put(x, y, LAVA2 if k == 1 else LAVA1)
                x = min(x0 + w - 2, max(x0 + 1, x + rng.choice((-1, 1))))
                y = min(y0 + h - 2, y + 1)

    def seam(self, x0, y, w):
        for x in range(x0, x0 + w):
            self.put(x, y, LAVA2 if (x - x0) % 3 == 1 else LAVA1)

    def dark(self, x0, y0, w, h):
        self.rect(x0, y0, w, h, INK)

    def pixels(self, x0, y0, spec):
        """spec: {color: [(dx, dy), ...]} relative to (x0, y0)."""
        for c, pts in spec.items():
            for dx, dy in pts:
                self.put(x0 + dx, y0 + dy, c)


# --- flat armor layers (64x32 vanilla layout) ------------------------------
def box_faces(u, v, w, h, d):
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
            "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
            "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h)}


HEAD = box_faces(0, 0, 8, 8, 8)
BODY = box_faces(16, 16, 8, 12, 4)
ARM = box_faces(40, 16, 4, 12, 4)
LEG = box_faces(0, 16, 4, 12, 4)


def layer_1():
    t = Tex(64, 32)
    # helmet: demon skull
    x, y, w, h = HEAD["top"]
    t.plate(x, y, w, h, light=1)
    for i in range(0, 8, 2):
        t.put(x + 3, y + i, OBS4); t.put(x + 4, y + i, OBS3)          # crest ridge
    t.dark(*HEAD["bottom"])
    for side in ("right", "left"):
        x, y, w, h = HEAD[side]
        t.plate(x, y, w, h)
        front = x + w - 1 if side == "right" else x
        step = -1 if side == "right" else 1
        for dx, dy in ((1, 2), (2, 2), (2, 1), (3, 1), (3, 0), (4, 0)):
            t.put(front + step * dx, y + dy + 1, BONE2)                # horn root
        t.put(front + step * 1, y + 5, INK); t.put(front + step * 2, y + 5, LAVA1)  # jaw hinge
        t.seam(x, y + 7, w)
    x, y, w, h = HEAD["front"]
    t.plate(x, y, w, h, light=1)
    t.pixels(x, y, {
        OBS0: [(0, 1), (1, 1), (2, 2), (5, 2), (6, 1), (7, 1), (3, 1), (4, 1)],  # scowling brow
        INK: [(1, 2), (6, 2), (1, 4), (2, 4), (5, 4), (6, 4), (3, 4), (4, 5),
              (0, 6), (7, 6), (2, 7), (3, 7), (4, 7), (5, 7)],
        LAVA3: [(2, 3), (5, 3)],                                        # burning eyes
        LAVA2: [(1, 3), (6, 3)],
        OBS3: [(3, 3), (4, 3)],
        BONE3: [(1, 6), (2, 6), (5, 6), (6, 6)],                        # fangs
        BONE2: [(3, 6), (4, 6), (1, 7), (6, 7)],
        LAVA1: [(3, 5)],
    })
    x, y, w, h = HEAD["back"]
    t.plate(x, y, w, h, cracks=0.06)
    t.seam(x, y + 7, w)

    # chestplate: body with a demon face (eyes on the pecs, fanged maw)
    t.plate(*BODY["top"], light=1)
    t.dark(BODY["top"][0] + 2, BODY["top"][1] + 1, 4, 2)
    t.dark(*BODY["bottom"])
    x, y, w, h = BODY["front"]
    t.plate(x, y, w, h, light=1)
    t.seam(x, y + 1, w)
    t.pixels(x, y, {
        OBS0: [(0, 2), (1, 2), (6, 2), (7, 2), (3, 3), (4, 3)],
        LAVA3: [(2, 3), (5, 3)],
        LAVA1: [(1, 3), (6, 3)],
        INK: [(2, 4), (5, 4)] + [(i, 6) for i in range(1, 7)] + [(i, 9) for i in range(1, 7)]
             + [(1, 7), (6, 7), (1, 8), (6, 8)],
        BONE0: [(3, 4), (4, 4), (3, 5), (4, 5)],                        # nose ridge
        BONE3: [(1, 6), (3, 6), (4, 6), (6, 6), (2, 9), (5, 9)],        # upper + lower fangs
        BONE2: [(2, 7), (5, 7), (2, 8), (5, 8)],
        LAVA2: [(3, 7), (4, 7)],                                        # fire in the throat
        LAVA3: [(3, 8), (4, 8)],
    })
    t.seam(x, y + 10, w)
    t.rect(x, y + 11, w, 1, OBS0)
    for side in ("right", "left"):
        t.plate(*BODY[side])
        for ry in (3, 5, 7):
            t.put(BODY[side][0] + 1, BODY[side][1] + ry, BONE1)        # rib ends
            t.put(BODY[side][0] + 2, BODY[side][1] + ry, BONE0)
        t.seam(BODY[side][0], BODY[side][1] + 10, 4)
    x, y, w, h = BODY["back"]
    t.plate(x, y, w, h, cracks=0.06)
    for ry in range(y + 1, y + 11, 2):                                 # spine
        t.put(x + 3, ry, BONE1); t.put(x + 4, ry, BONE2)
        t.put(x + 3, ry + 1, OBS0); t.put(x + 4, ry + 1, OBS0)
    t.seam(x, y + 10, w)
    # arms
    t.plate(*ARM["top"], light=2)
    t.dark(*ARM["bottom"])
    for side in ("right", "front", "left", "back"):
        x, y, w, h = ARM[side]
        t.plate(x, y, w, 4, light=2)                                   # pauldron
        t.seam(x, y + 4, w)
        for j in range(y + 5, y + 8):
            for i in range(x, x + w):
                t.put(i, j, SKIN1 if (i + j) % 2 else SKIN0)           # leather
        t.plate(x, y + 8, w, 4, light=1)                               # clawed gauntlet
        t.put(x + 1, y + 11, BONE2); t.put(x + 3, y + 11, BONE2)
    # boots
    t.dark(*LEG["bottom"])
    for side in ("right", "front", "left", "back"):
        x, y, w, h = LEG[side]
        t.seam(x, y + 6, w)
        t.plate(x, y + 7, w, 4, light=1)
        t.rect(x, y + 11, w, 1, OBS0)
    fx, fy = LEG["front"][:2]
    for i in (0, 1, 3):
        t.put(fx + i, fy + 11, BONE2)                                  # claw roots
    return t.img


def layer_2():
    t = Tex(64, 32)
    for side in ("right", "front", "left", "back"):
        x, y, w, h = BODY[side]
        t.dark(x, y + 7, w, 1)
        t.seam(x, y + 8, w)
        t.plate(x, y + 9, w, 3, light=1)
    fx, fy = BODY["front"][:2]
    t.pixels(fx, fy, {BONE2: [(3, 8), (4, 8)], LAVA3: [(3, 9), (4, 9)]})  # skull buckle
    t.plate(*LEG["top"])
    t.dark(*LEG["bottom"])
    for side in ("right", "front", "left", "back"):
        x, y, w, h = LEG[side]
        t.plate(x, y, w, 5, light=0 if side == "left" else 1)
        t.seam(x, y + 5, w)
        t.plate(x, y + 6, w, 6, light=0 if side == "left" else 1, cracks=0.1)
    fx, fy = LEG["front"][:2]
    t.pixels(fx, fy, {BONE2: [(1, 6), (2, 6)], BONE1: [(1, 7)], LAVA2: [(2, 7)]})
    return t.img


# --- 3D parts atlas (64x64) ----------------------------------------------
SW = {"horn0": (0, 16), "horn1": (8, 16), "horn2": (16, 16), "spike": (24, 16),
      "plate": (32, 16), "core": (40, 16), "bone": (48, 16), "claw": (56, 16),
      "skin": (32, 24), "spade": (40, 24)}
WING = (0, 32, 32, 32)   # atlas region holding the right bat wing


def wing_texture():
    """32x32 bat wing seen from behind, body side on the left (u=0)."""
    W = 32
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    wrist, root_top, root_bot = (14, 2), (0, 11), (0, 25)
    tips = [(31, 3), (29, 13), (22, 23), (11, 29)]

    def scallop(a, b, n=8, sag=0.22):
        out = []
        for i in range(1, n + 1):
            t = i / n
            lx, ly = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            s = sag * math.sin(math.pi * t)
            out.append((lx + (wrist[0] - lx) * s, ly + (wrist[1] - ly) * s))
        return out

    poly = [root_top, wrist, tips[0]]
    for a, b in zip(tips, tips[1:]):
        poly += scallop(a, b)
    poly += scallop(tips[-1], root_bot, sag=0.15)

    def inside(x, y):
        c = False
        for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                c = not c
        return c

    def seg_dist(px, py, a, b):
        (ax, ay), (bx, by) = a, b
        t = max(0, min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) /
                       ((bx - ax) ** 2 + (by - ay) ** 2)))
        return math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay)), t

    for y in range(W):
        for x in range(W):
            cx, cy = x + 0.5, y + 0.5
            c = None
            if inside(cx, cy):
                d_edge = min(seg_dist(cx, cy, a, b)[0] for a, b in zip(poly, poly[1:] + poly[:1]))
                c = SKIN0 if d_edge < 1.2 else (SKIN2 if (x * 3 + y * 5) % 13 == 0 else SKIN1)
            d_arm, _ = seg_dist(cx, cy, (0.5, 14), wrist)
            if d_arm <= 1.3:
                c = BONE2 if cy < wrist[1] + (14 - wrist[1]) * (1 - cx / wrist[0]) else BONE1
            for tip in tips:
                d, t = seg_dist(cx, cy, wrist, tip)
                if d <= 0.75:
                    c = BONE1 if t < 0.85 else HORN0
            if math.hypot(cx - 15, cy - 0.8) <= 1.1:
                c = BONE3                                             # thumb claw
            if c:
                img.putpixel((x, y), c + (255,))
    return img


def atlas(l1):
    t = Tex(64, 64)
    t.img.paste(l1.crop((0, 0, 32, 16)), (0, 0))   # helmet shell = flat helmet art

    def swatch(name, fn):
        sx, sy = SW[name]
        for j in range(8):
            for i in range(8):
                t.put(sx + i, sy + j, fn(i, j))

    swatch("horn0", lambda i, j: BONE1 if j % 3 == 0 else (BONE3 if i < 2 else BONE2))
    swatch("horn1", lambda i, j: BONE0 if j % 3 == 0 else (BONE2 if i < 2 else BONE1))
    swatch("horn2", lambda i, j: HORN0 if j % 3 == 0 else (HORN1 if i > 1 else HORN0))
    swatch("spike", lambda i, j: LAVA1 if (i + j) == 7 else (OBS3 if i < 3 else OBS2 if j > 2 else OBS1))
    swatch("plate", lambda i, j: (OBS4 if j == 0 else LAVA1 if j == 7 else
                                  LAVA2 if (j == 6 and i % 3 == 1) else
                                  BONE2 if (i, j) in ((1, 2), (6, 2)) else OBS2 if i < 4 else OBS1))
    swatch("core", lambda i, j: (lambda d: LAVA3 if d < 1.5 else LAVA2 if d < 2.6 else
                                 LAVA1 if d < 3.4 else LAVA0)(((i - 3.5) ** 2 + (j - 3.5) ** 2) ** 0.5))
    swatch("bone", lambda i, j: BONE3 if i < 2 else (BONE2 if j < 6 else BONE1))
    swatch("claw", lambda i, j: BONE3 if j < 2 else BONE2 if j < 4 else BONE1 if j < 6 else HORN1)
    swatch("skin", lambda i, j: SKIN2 if j == 0 else SKIN0 if j == 7 or (i + j) % 4 == 0 else SKIN1)
    swatch("spade", lambda i, j: LAVA1 if abs(i - 3.5) < 1 and j > 1 else (SKIN2 if i < 4 else SKIN0))
    t.img.paste(wing_texture(), WING[:2])
    return t.img


# --- 3D geometry -----------------------------------------------------------
def part(name, bone, frm, to, mat, faces=None):
    return {"name": name, "bone": bone, "from": list(frm), "to": list(to),
            "mat": mat, "faces": faces}


def mirror(p, bone):
    (x0, y0, z0), (x1, y1, z1) = p["from"], p["to"]
    return dict(p, name=p["name"].replace("right", "left"), bone=bone,
                **{"from": [-x1, y0, z0], "to": [-x0, y1, z1]})


def wing_parts(atlas_img):
    """Membrane as thin slabs, one per horizontal run of wing texels."""
    ax, ay, n, _ = WING
    s = 0.5                          # model units per texel
    X0, Y0, Z0, Z1 = 1.5, 33.0, 3.3, 3.8
    parts = []
    for r in range(n):
        c = 0
        while c < n:
            if atlas_img.getpixel((ax + c, ay + r))[3] == 0:
                c += 1
                continue
            c0 = c
            while c < n and atlas_img.getpixel((ax + c, ay + r))[3] > 0:
                c += 1
            ln = c - c0
            u, v = ax + c0, ay + r
            fwd, rev = (u, v, ln, 1), (u + ln, v, -ln, 1)
            x0, x1 = X0 + c0 * s, X0 + c * s
            y0, y1 = Y0 - (r + 1) * s, Y0 - r * s
            ends = {"east": (u + ln - 1, v, 1, 1), "west": (u, v, 1, 1), "up": fwd, "down": fwd}
            parts.append(part(f"right_wing_{r}_{c0}", "body", (x0, y0, Z0), (x1, y1, Z1), None,
                              faces={"south": fwd, "north": rev, **ends}))
            parts.append(part(f"left_wing_{r}_{c0}", "body", (-x1, y0, Z0), (-x0, y1, Z1), None,
                              faces={"south": rev, "north": fwd, "east": ends["west"],
                                     "west": ends["east"], "up": rev, "down": rev}))
    return parts


def geometry(atlas_img):
    parts = []
    # helmet shell, textured with the flat helmet art (inflated 1px like vanilla)
    parts.append(part("helmet_shell", "head", (-5, 23, -5), (5, 33, 5), None,
                      faces={f: HEAD[k] for f, k in (("north", "front"), ("south", "back"),
                             ("east", "right"), ("west", "left"), ("up", "top"))}))
    horn = [  # right horn: big bone horn out from the temple, up, hooking forward to a black tip
        ((4.5, 28, -2.2), (8.5, 32.5, 2), "horn0"),
        ((8, 29, -1.8), (11, 33, 1.8), "horn0"),
        ((10.5, 30.5, -1.5), (13, 34.5, 1.5), "horn0"),
        ((12, 33, -1.3), (14.3, 37, 1.2), "horn1"),
        ((12.6, 36, -1.2), (14.6, 39.5, 0.8), "horn1"),
        ((12.4, 38.8, -1.4), (14.2, 41.8, 0.4), "horn1"),
        ((11.6, 41, -1.8), (13.4, 43.5, -0.2), "horn2"),
        ((10.6, 42.8, -2.4), (12.2, 44.8, -0.9), "horn2"),
        ((9.6, 44, -3), (11, 45.6, -1.7), "horn2"),
    ]
    for i, (f, t, m) in enumerate(horn):
        p = part(f"right_horn_{i}", "head", f, t, m)
        parts += [p, mirror(p, "head")]
    for p in (part("right_brow_horn_0", "head", (1.3, 32.5, -4.8), (3.2, 35.5, -2.8), "horn0"),
              part("right_brow_horn_1", "head", (1.7, 35.3, -4.6), (2.8, 37.5, -3.2), "horn1"),
              part("right_brow_horn_2", "head", (1.9, 37.3, -4.3), (2.6, 38.6, -3.5), "horn2"),
              part("right_fang_0", "head", (0.5, 21.2, -5.6), (1.4, 23.2, -4.8), "bone"),
              part("right_fang_1", "head", (2.6, 20.6, -5.6), (3.6, 23.2, -4.8), "bone"),
              part("right_tusk", "head", (3.9, 21.5, -6), (4.9, 24, -5), "bone"),
              part("right_tusk_tip", "head", (4, 23.8, -6.8), (4.7, 25.6, -6), "claw"),
              part("right_jaw_spike", "head", (5, 23.4, -1), (7, 24.6, 0), "spike"),
              part("right_jaw_spike_tip", "head", (6.8, 23.7, -0.8), (8.6, 24.3, -0.2), "horn2")):
        parts += [p, mirror(p, "head")]
    parts.append(part("brow_ridge", "head", (-5.5, 29, -5.8), (5.5, 30, -5), "spike"))

    # chestplate: maw fangs, spine horns, pauldron horns, clawed gauntlets, bat wings
    for p in (part("right_maw_fang_0", "body", (2.6, 15.6, -3.6), (3.6, 17.4, -3), "bone"),
              part("right_maw_fang_1", "body", (0.2, 15.9, -3.5), (1.0, 17.4, -3), "bone"),
              part("right_maw_fang_low", "body", (1.4, 13.6, -3.5), (2.4, 15.2, -3), "bone")):
        parts += [p, mirror(p, "body")]
    for i, y in enumerate((20.5, 17, 13.5)):
        parts.append(part(f"spine_spike_{i}_base", "body", (-1, y, 3), (1, y + 2, 5), "horn0"))
        parts.append(part(f"spine_spike_{i}_tip", "body", (-0.6, y + 1, 4.8), (0.6, y + 2.4, 6.6), "horn2"))
    for p in (part("right_pauldron", "right_arm", (3.5, 21.5, -3), (9.5, 25.5, 3), "plate"),
              part("right_pauldron_horn_0", "right_arm", (6.8, 25.5, -1.2), (9, 28.5, 1), "horn0"),
              part("right_pauldron_horn_0_tip", "right_arm", (7.3, 28.3, -0.7), (8.5, 31, 0.5), "horn2"),
              part("right_pauldron_horn_1", "right_arm", (4.8, 25.5, 0.9), (6.6, 27.8, 2.6), "horn0"),
              part("right_pauldron_horn_1_tip", "right_arm", (5.2, 27.6, 1.3), (6.2, 29.6, 2.3), "horn2"),
              part("right_pauldron_horn_2", "right_arm", (9.5, 23, -0.7), (12, 24.5, 0.7), "horn0"),
              part("right_pauldron_horn_2_tip", "right_arm", (11.8, 23.3, -0.4), (13.5, 24.2, 0.4), "horn2"),
              part("right_bracer_blade", "right_arm", (8.9, 13.5, -0.5), (10.4, 17, 0.5), "spike"),
              part("right_talon_0", "right_arm", (4.4, 8.8, -2.9), (5.2, 11, -1.9), "claw"),
              part("right_talon_1", "right_arm", (5.8, 8.2, -2.9), (6.6, 11, -1.9), "claw"),
              part("right_talon_2", "right_arm", (7.2, 8.8, -2.9), (8, 11, -1.9), "claw")):
        parts += [p, mirror(p, "left_arm")]
    parts += wing_parts(atlas_img)

    # leggings: curved bone knee horns and a spade-tipped tail
    for p in (part("right_knee_guard", "right_leg", (0.2, 5, -3.3), (3.8, 8, -2.5), "plate"),
              part("right_knee_horn_0", "right_leg", (1.2, 6, -4.6), (2.8, 7.8, -3.3), "horn0"),
              part("right_knee_horn_1", "right_leg", (1.5, 6.8, -5.6), (2.5, 8.8, -4.5), "horn1"),
              part("right_knee_horn_2", "right_leg", (1.7, 8.4, -6.2), (2.3, 10, -5.4), "horn2")):
        parts += [p, mirror(p, "left_leg")]
    tail = [((-0.9, 10.5, 2.2), (0.9, 12.5, 4.5)), ((-0.8, 9.2, 4), (0.8, 11, 6.5)),
            ((-0.7, 7.8, 6), (0.7, 9.6, 8.5)), ((-0.6, 6.6, 8), (0.6, 8.2, 10.5)),
            ((-0.55, 6, 10), (0.55, 7.2, 12.5)), ((-0.5, 6.2, 12), (0.5, 7.4, 14))]
    for i, (f, t) in enumerate(tail):
        parts.append(part(f"tail_{i}", "body", f, t, "skin"))
    for i, (f, t) in enumerate((((-2, 6.3, 14), (2, 7.3, 15.5)), ((-1.3, 6.4, 15.5), (1.3, 7.2, 17)),
                                ((-0.5, 6.5, 17), (0.5, 7.1, 18.2)))):
        parts.append(part(f"tail_spade_{i}", "body", f, t, "spade"))

    # boots: big toe claws, heel spur, ankle spike
    for p in (part("right_claw_0", "right_leg", (-0.2, -0.5, -5), (1.2, 1.5, -3), "claw"),
              part("right_claw_1", "right_leg", (1.3, -0.5, -5.8), (2.7, 1.8, -3), "claw"),
              part("right_claw_2", "right_leg", (2.8, -0.5, -5), (4.2, 1.5, -3), "claw"),
              part("right_heel_spur", "right_leg", (1.5, 2, 3), (2.5, 3, 5.5), "spike"),
              part("right_ankle_spike", "right_leg", (5, 4, -0.6), (7.2, 5.2, 0.6), "horn2")):
        parts += [p, mirror(p, "left_leg")]
    return parts


def piece_of(p):
    n = p["name"]
    if p["bone"] == "head":
        return "helmet"
    if any(k in n for k in ("claw", "heel", "ankle")):
        return "boots"
    if "knee" in n or "tail" in n:
        return "leggings"
    return "chestplate"


def face_rects(p):
    """Atlas rect (x, y, w, h) per face; negative w means the texture is mirrored."""
    if p["faces"]:
        return p["faces"]
    sx, sy = SW[p["mat"]]
    return {f: (sx, sy, 8, 8) for f in ("north", "south", "east", "west", "up", "down")}


# --- exports ---------------------------------------------------------------
BONES = {"head": [0, 24, 0], "body": [0, 24, 0], "right_arm": [5, 22, 0],
         "left_arm": [-5, 22, 0], "right_leg": [1.9, 12, 0], "left_leg": [-1.9, 12, 0]}


def export_bbmodel(parts, atlas_img, path):
    buf = io.BytesIO()
    atlas_img.save(buf, "PNG")
    elements, groups = [], {b: [] for b in BONES}
    for p in parts:
        uid = str(uuid.uuid5(uuid.NAMESPACE_URL, "demon/" + p["name"]))
        elements.append({
            "name": p["name"], "type": "cube", "uuid": uid, "box_uv": False,
            "rescale": False, "locked": False, "render_order": "default",
            "from": p["from"], "to": p["to"], "autouv": 0, "color": 0,
            "origin": BONES[p["bone"]],
            "faces": {f: {"uv": [x, y, x + w, y + h], "texture": 0}
                      for f, (x, y, w, h) in face_rects(p).items()},
        })
        groups[p["bone"]].append(uid)
    model = {
        "meta": {"format_version": "4.10", "model_format": "free", "box_uv": False},
        "name": "demon_armor", "model_identifier": "demon_armor",
        "resolution": {"width": 64, "height": 64},
        "elements": elements,
        "outliner": [{"name": b, "origin": o, "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, "demon-bone/" + b)),
                      "export": True, "isOpen": True, "children": groups[b]}
                     for b, o in BONES.items() if groups[b]],
        "textures": [{"name": "demon_armor_parts.png", "id": "0", "width": 64, "height": 64,
                      "uv_width": 64, "uv_height": 64, "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, "demon-tex")),
                      "source": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()}],
    }
    with open(path, "w") as f:
        json.dump(model, f, indent=1)


ITEM_K = 0.8   # player units -> item units; the head display scales it back up


def to_item_space(v):
    # head centre (0, 28, 0) -> (8, 8, 8); keeps the tall horns inside Java's -16..32 limit
    return [round((c - o) * ITEM_K + 8, 4) for c, o in zip(v, (0, 28, 0))]


def export_helmet_model(parts, path):
    elements = []
    for p in parts:
        if p["bone"] != "head":
            continue
        faces = {}
        for f, (x, y, w, h) in face_rects(p).items():
            faces[f] = {"uv": [x / 4, y / 4, (x + w) / 4, (y + h) / 4], "texture": "#parts"}
            if f == "up":
                faces[f]["rotation"] = 180  # entity top faces are flipped vs block models
        elements.append({"name": p["name"], "from": to_item_space(p["from"]),
                         "to": to_item_space(p["to"]), "faces": faces})
    ref = "minecraft:item/demon_armor_parts"
    k = round(1.6 / ITEM_K, 4)   # the inflated 10px helmet = 16 item units at scale 1
    model = {
        "texture_size": [64, 64],
        "textures": {"parts": ref, "particle": ref},
        "elements": elements,
        "display": {
            "head": {"rotation": [0, 0, 0], "translation": [0, 0, 0], "scale": [k, k, k]},
            "thirdperson_righthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.6, 0.6, 0.6]},
            "thirdperson_lefthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.6, 0.6, 0.6]},
            "firstperson_righthand": {"rotation": [0, 45, 0], "translation": [0, 0, 0], "scale": [0.7, 0.7, 0.7]},
            "firstperson_lefthand": {"rotation": [0, 45, 0], "translation": [0, 0, 0], "scale": [0.7, 0.7, 0.7]},
            "gui": {"rotation": [30, 225, 0], "translation": [0, -2, 0], "scale": [0.9, 0.9, 0.9]},
            "ground": {"translation": [0, 3, 0], "scale": [0.6, 0.6, 0.6]},
            "fixed": {"rotation": [0, 180, 0], "scale": [1, 1, 1]},
        },
    }
    with open(path, "w") as f:
        json.dump(model, f, indent=1)


# --- GUI icons (16x16, on the Lode Studio template silhouettes) ------------
KEY = {"o": OUTLINE, "x": OBS1, "b": OBS1, "m": OBS2, "h": OBS3, "s": OBS4,
       "W": BONE3, "l": LAVA1, "L": LAVA2, "y": LAVA3, "n": BONE1, "N": BONE2,
       "r": BONE2, "R": HORN0, "k": SKIN0, "K": SKIN1, "i": INK}

ICONS = {
    "helmet": [
        ".R............R.",
        ".rr..........rr.",
        "..rr........rr..",
        "..orroxxxxorro..",
        "....ossshhmo....",
        "...osWmshhmmo...",
        "...oiiihhiiio...",
        "...xLyiooiyLo...",
        "...xhiohhoiho...",
        "...omoiiiobmo...",
        "...oiNNNNNNio...",
        "....oo....oo....",
        "................",
        "................",
        "................",
        "................",
    ],
    "chestplate": [
        "kK............Kk",
        "kKKxxx....xxxKKk",
        ".kxxxx....xxxxk.",
        ".xWssx....xWssx.",
        ".xshhhx..xWssbx.",
        ".xbhhhhxxhhhbbx.",
        ".xliyhhhhhhyilx.",
        "..obWhhnnhhhbo..",
        "...oiNiNNiNio...",
        "...oiiLyyLiio...",
        "...oiNiiiiNio...",
        "...obmhhhhmbo...",
        "...obmhhhhmbo...",
        "....obbhhbbo....",
        ".....oooooo.....",
        "................",
    ],
    "leggings": [
        "................",
        "..xxxx....xxxx..",
        "..xmbxxxxxxbbx..",
        "..xlLllNNllLlo..",
        "..xshhhyyhhhmo..",
        "..xshhhhhhhhmo..",
        "..xshhhmmhhhmo..",
        "..xshhmoobhhmo..",
        ".NxNhmo..xhNmxN.",
        "..xnnmo..xnnmo..",
        "..omlmo..ohlmo..",
        "..obmbo..obmbo..",
        "..obbbo..obbbo..",
        "...oooo..oooo...",
        "................",
        "................",
    ],
    "boots": [
        "................",
        "................",
        "................",
        "...xxxx..xxxx...",
        "...xlLo..xlLo...",
        "...xsmo..xmmo...",
        "...xsho..xhso...",
        "...xhlo..xhlo...",
        "...xhmo..xhho...",
        "..xhhmo..xmsmo..",
        ".xshmmo..xmmhmo.",
        "NxmmmooN.oommbxN",
        "NNNoo....N.ooNNN",
        "................",
        "................",
        "................",
    ],
}


def icon(rows):
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), rows
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), KEY[ch] + (255,))
    return img


# --- main --------------------------------------------------------------------
def main():
    for d in ("items", "models", "item_definitions", "3d"):
        os.makedirs(f"{OUT}/{d}", exist_ok=True)
    l1, l2 = layer_1(), layer_2()
    l1.save(f"{OUT}/demon_layer_1.png")
    l2.save(f"{OUT}/demon_layer_2.png")
    for name, rows in ICONS.items():
        icon(rows).save(f"{OUT}/items/demon_{name}.png")

    at = atlas(l1)
    at.save(f"{OUT}/3d/demon_armor_parts.png")
    parts = geometry(at)
    export_bbmodel(parts, at, f"{OUT}/3d/demon_armor.bbmodel")
    for piece in ("helmet", "chestplate", "leggings", "boots"):
        export_bbmodel([p for p in parts if piece_of(p) == piece], at,
                       f"{OUT}/3d/demon_{piece}.bbmodel")
    export_helmet_model(parts, f"{OUT}/models/demon_helmet_3d.json")
    with open(f"{OUT}/models/demon_helmet_icon.json", "w") as f:
        json.dump({"parent": "minecraft:item/generated",
                   "textures": {"layer0": "minecraft:item/demon_helmet"}}, f, indent=1)
    with open(f"{OUT}/item_definitions/demon_helmet.json", "w") as f:
        json.dump({"model": {
            "type": "minecraft:select", "property": "minecraft:display_context",
            "cases": [{"when": ["gui", "ground", "fixed"],
                       "model": {"type": "minecraft:model", "model": "minecraft:item/demon_helmet_icon"}}],
            "fallback": {"type": "minecraft:model", "model": "minecraft:item/demon_helmet_3d"}}}, f, indent=1)
    print(len(parts), "3D parts")


if __name__ == "__main__":
    main()
