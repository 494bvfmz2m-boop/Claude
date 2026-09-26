"""Generates Crimson Armor textures (armor_layer_1.png / armor_layer_2.png).

Standard 64x32 Minecraft humanoid armor layout. Run: python3 generate.py
"""
import os
import random
from PIL import Image

OUT = __file__.rsplit("/", 1)[0]

# --- palette -------------------------------------------------------------
OUTLINE = (28, 4, 8)
VOID = (44, 8, 14)
DEEP = (78, 10, 20)
BASE = (122, 16, 28)
MID = (158, 26, 38)
HI = (198, 52, 58)
SHINE = (236, 108, 96)
VEIN = (255, 64, 52)
GLOW = (255, 150, 110)
GOLD_D = (120, 72, 22)
GOLD = (196, 142, 44)
GOLD_L = (246, 204, 96)
STEM_D = (96, 36, 66)     # crimson stem bark
STEM = (148, 62, 98)
STEM_L = (196, 104, 140)
WART = (170, 12, 22)      # nether-wart leaves
WART_L = (224, 40, 44)
SHROOM = (255, 196, 110)  # shroomlight buds
SWORD_OUTLINE = (66, 12, 22)  # lighter so it doesn't read as holes when extruded

rng = random.Random(1337)


class Tex:
    def __init__(self):
        self.img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
        self.px = self.img.load()

    def put(self, x, y, c):
        self.px[x, y] = c + (255,)

    def get(self, x, y):
        return self.px[x, y][:3]

    def rect(self, x0, y0, w, h, c):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.put(x, y, c)

    def hline(self, x0, y, w, c):
        self.rect(x0, y, w, 1, c)

    def plate(self, x0, y0, w, h, light=0, veins=0.06, bevel=True):
        """Brushed crimson plate with dithered noise, glowing cracks and bevel."""
        shades = [VOID, DEEP, BASE, MID, HI, SHINE]
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                r = rng.random()
                i = 2 + light
                if r < 0.12:
                    i -= 1
                elif r > 0.88:
                    i += 1
                self.put(x, y, shades[max(0, min(5, i))])
        # glowing cracks: short random walks
        n = int(w * h * veins / 3)
        for _ in range(n):
            x, y = rng.randrange(x0, x0 + w), rng.randrange(y0, y0 + h)
            for _ in range(3):
                self.put(x, y, VEIN if rng.random() < 0.7 else DEEP)
                x = min(x0 + w - 1, max(x0, x + rng.choice((-1, 0, 1))))
                y = min(y0 + h - 1, max(y0, y + 1))
        if bevel:
            # top highlight only: dark bottom/right edges outline every face and
            # make the armor read as a bulky box
            for x in range(x0, x0 + w):
                self.put(x, y0, shades[min(5, 4 + light)])

    def dark(self, x0, y0, w, h):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.put(x, y, OUTLINE if rng.random() < 0.35 else VOID)

    def gold_row(self, x0, y, w, studs=()):
        for x in range(x0, x0 + w):
            self.put(x, y, GOLD if (x - x0) % 3 else GOLD_L)
        for s in studs:
            self.put(x0 + s, y, GOLD_L)

    def gold_col(self, x, y0, h):
        for y in range(y0, y0 + h):
            self.put(x, y, GOLD if (y - y0) % 3 else GOLD_L)

    def branch(self, pts, clip, thick=()):
        """Draw crimson stem through pts; bark shading, lit on the left."""
        pts = list(pts)
        cx, cy, cw, ch = clip
        for x, y in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1)):
                n = (x + dx, y + dy)
                inside = cx <= n[0] < cx + cw and cy <= n[1] < cy + ch
                if inside and n not in pts and self.get(*n) not in (GOLD, GOLD_L, GOLD_D):
                    self.put(*n, OUTLINE)
        for x, y in pts:
            self.put(x, y, STEM)
        for x, y in pts:
            if (x - 1, y) not in pts and rng.random() < 0.6:
                self.put(x, y, STEM_L)
        for x, y in thick:
            self.put(x, y, STEM_D)

    def leaf(self, x, y, bright=False):
        self.put(x, y, WART_L if bright else WART)

    def bud(self, x, y):
        self.put(x, y, SHROOM)


def helmet(t):
    # top: crest
    t.plate(8, 0, 8, 8, light=1)
    t.gold_col(11, 0, 8)
    t.gold_col(12, 0, 8)
    for y in range(0, 8, 2):
        t.put(12, y, GOLD_D)
    # bottom
    t.dark(16, 0, 8, 8)

    # sides: right (0,8) front edge x=7 ; left (16,8) front edge x=16
    for x0, front_x, back_x in ((0, 7, 0), (16, 16, 23)):
        t.plate(x0, 8, 8, 8)
        t.gold_col(front_x, 8, 8)
        t.gold_row(x0, 15, 8)
        # swept fin lines
        step = 1 if front_x > back_x else -1
        for i in range(4):
            t.put(front_x - step * (2 + i), 10 + i // 2, HI)
            t.put(front_x - step * (2 + i), 11 + i // 2, DEEP)
        # ear vent with ember glow
        vx = x0 + 3
        t.put(vx, 12, OUTLINE); t.put(vx + 1, 12, OUTLINE)
        t.put(vx, 13, VEIN); t.put(vx + 1, 13, OUTLINE)

    # front: full visor
    t.plate(8, 8, 8, 8, light=1)
    t.hline(8, 8, 8, HI)
    t.gold_col(11, 8, 3); t.gold_col(12, 8, 3)         # nose-guard crest
    t.hline(8, 11, 8, OUTLINE)                          # eye slit
    t.hline(9, 12, 6, OUTLINE)
    t.put(9, 11, GLOW); t.put(10, 11, VEIN)             # glowing eyes
    t.put(14, 11, GLOW); t.put(13, 11, VEIN)
    t.put(11, 11, GOLD_D); t.put(12, 11, GOLD_D)
    t.put(11, 12, GOLD); t.put(12, 12, GOLD)
    for x in (10, 13):                                  # mouth grille
        t.put(x, 13, OUTLINE); t.put(x, 14, OUTLINE)
    t.put(11, 14, DEEP); t.put(12, 14, DEEP)
    t.gold_row(8, 15, 8)

    # back: plate with a sprouting vine
    t.plate(24, 8, 8, 8, light=-1)
    t.gold_row(24, 15, 8)
    t.branch([(28, 14), (28, 13), (27, 12), (27, 11), (28, 10), (29, 9)], clip=(24, 8, 8, 8))
    t.leaf(26, 11); t.leaf(29, 12, True); t.bud(30, 9)


def chestplate(t):
    # body top (20,16,8,4): shoulders; back edge row 16
    t.plate(20, 16, 8, 4, light=1)
    t.gold_row(20, 19, 8)
    t.dark(22, 17, 4, 2)                     # neck hole
    t.bud(20, 16); t.bud(27, 16)             # branch tips poking over shoulders
    t.leaf(21, 16, True); t.leaf(26, 16, True)
    # body bottom
    t.dark(28, 16, 8, 4)

    # front (20,20,8,12)
    t.plate(20, 20, 8, 12, light=1, veins=0.05)
    t.gold_row(20, 20, 8)
    # pecs
    for x in (20, 21, 26, 27):
        t.put(x, 21, SHINE)
    t.put(20, 22, HI); t.put(27, 22, HI)
    for x in (21, 22, 25, 26):
        t.put(x, 25, DEEP)
    # crimson heart gem in gold setting
    for x, y in ((23, 21), (24, 21), (22, 22), (25, 22), (21, 23), (26, 23),
                 (22, 24), (25, 24), (23, 25), (24, 25)):
        t.put(x, y, GOLD)
    t.put(23, 21, GOLD_L)
    t.put(23, 22, GLOW); t.put(24, 22, SHINE)
    t.put(22, 23, WART_L); t.put(23, 23, VEIN); t.put(24, 23, VEIN); t.put(25, 23, WART)
    t.put(23, 24, WART); t.put(24, 24, DEEP)
    # ab plates
    for y in (27, 29):
        t.hline(21, y, 6, DEEP)
        t.hline(21, y + 1, 6, HI)
    t.put(23, 28, OUTLINE); t.put(24, 28, OUTLINE)
    t.put(23, 30, OUTLINE); t.put(24, 30, OUTLINE)
    t.hline(20, 31, 8, OUTLINE)
    t.put(21, 31, GOLD_L); t.put(26, 31, GOLD_L)

    # sides
    for x0 in (16, 28):
        t.plate(x0, 20, 4, 12)
        t.gold_row(x0, 20, 4)
        for y in (24, 27, 30):
            t.hline(x0, y, 4, DEEP)
        t.hline(x0, 31, 4, OUTLINE)

    # back (32,20,8,12): darker plate so the branch pops
    t.plate(32, 20, 8, 12, light=-1, veins=0.03)
    t.gold_row(32, 20, 8)
    t.hline(32, 31, 8, OUTLINE)
    # spine
    for y in range(21, 31):
        if t.get(35, y) != VEIN:
            t.put(35, y, DEEP)
    # the branch: trunk from lower spine, splits at the shoulder blades
    trunk = [(35, 30), (36, 30), (35, 29), (36, 29), (35, 28), (36, 28), (35, 27), (36, 27), (36, 26), (35, 26)]
    left = [(34, 25), (34, 24), (33, 23), (33, 22), (32, 21)]
    right = [(37, 25), (37, 24), (38, 23), (38, 22), (39, 21)]
    twig_l = [(35, 24), (35, 23), (35, 22)]
    twig_r = [(36, 23), (36, 22), (37, 21)]
    t.branch(trunk + left + right + twig_l + twig_r, clip=(32, 20, 8, 12),
             thick=[(36, 30), (36, 29), (36, 27), (34, 25), (37, 25)])
    for x, y in ((32, 20), (39, 20)):
        t.put(x, y, STEM)                     # pierces the gold collar
    t.bud(35, 21); t.bud(37, 20)
    for x, y, b in ((32, 23, True), (34, 22, False), (39, 23, True), (37, 22, False),
                    (33, 25, False), (38, 25, True), (34, 27, True), (37, 28, False)):
        t.leaf(x, y, b)
    # roots at the base
    t.put(34, 30, STEM_D); t.put(37, 30, STEM_D); t.put(33, 30, STEM)


def arms(t):
    # top (44,16,4,4): pauldron cap, branch creeping over it
    t.plate(44, 16, 4, 4, light=2)
    for x in range(44, 48):
        t.put(x, 16, GOLD); t.put(x, 19, GOLD)
    t.put(45, 17, GOLD_L)
    t.branch([(47, 16), (47, 17), (46, 18)], clip=(44, 16, 4, 4))
    t.bud(46, 17); t.leaf(44, 18, True)
    # bottom
    t.dark(48, 16, 4, 4)

    faces = {"outer": 40, "front": 44, "inner": 48, "back": 52}
    for name, x0 in faces.items():
        # pauldron rows 20-23
        t.plate(x0, 20, 4, 4, light=2 if name != "inner" else 0)
        t.gold_row(x0, 23, 4)
        t.hline(x0, 21, 4, MID)
        # undersuit rows 24-27 (chainmail-ish)
        for y in range(24, 28):
            for x in range(x0, x0 + 4):
                t.put(x, y, DEEP if (x + y) % 2 else VOID)
        # vambrace rows 28-31
        t.plate(x0, 28, 4, 4, light=1)
        t.gold_row(x0, 28, 4)
        t.hline(x0, 31, 4, OUTLINE)
    # rune on outer vambrace
    t.put(41, 29, VEIN); t.put(42, 30, VEIN); t.put(41, 30, GLOW)
    # spike studs on pauldron front
    t.put(45, 20, SHINE); t.put(41, 20, SHINE)

    # branch climbing the back of the arm from the body side (x=52) outward
    t.branch([(52, 25), (52, 24), (53, 23), (53, 22), (54, 21), (54, 20)],
             clip=(52, 20, 4, 12), thick=[(52, 25)])
    t.leaf(55, 22, True); t.leaf(52, 22); t.bud(55, 20)


def boots(t):
    # sole
    t.dark(8, 16, 4, 4)
    faces = {"outer": 0, "front": 4, "inner": 8, "back": 12}
    for name, x0 in faces.items():
        t.gold_row(x0, 26, 4)
        t.dark(x0, 27, 4, 1)
        t.plate(x0, 28, 4, 3, light=1, bevel=False)
        t.hline(x0, 31, 4, OUTLINE)
        t.put(x0 + 1, 31, VOID)
    # toe cap
    t.put(5, 29, SHINE); t.put(6, 29, SHINE); t.put(5, 30, GOLD); t.put(6, 30, GOLD)
    # heel spur
    t.put(13, 30, GOLD_L); t.put(14, 30, GOLD)
    # ember on outer ankle
    t.put(1, 28, VEIN)


def leggings(t):
    # waist on body region, lower rows
    faces = {"right": (16, 4), "front": (20, 8), "left": (28, 4), "back": (32, 8)}
    for name, (x0, w) in faces.items():
        t.dark(x0, 25, w, 1)
        t.gold_row(x0, 26, w)
        t.dark(x0, 27, w, 1)
        t.plate(x0, 28, w, 4, light=1)
        # tasset separations
        for x in range(x0 + 3, x0 + w, 4):
            for y in range(28, 32):
                t.put(x, y, OUTLINE)
    # buckle gem
    t.put(23, 26, GOLD_L); t.put(24, 26, GOLD_L)
    t.put(23, 27, VEIN); t.put(24, 27, GLOW)
    # back: little root motif continuing the chest branch
    t.put(35, 28, STEM); t.put(36, 28, STEM); t.put(35, 29, STEM_L); t.put(36, 30, STEM)
    t.leaf(34, 30, True)

    # leg top
    t.plate(4, 16, 4, 4, bevel=False)
    t.dark(8, 16, 4, 4)
    legs = {"outer": 0, "front": 4, "inner": 8, "back": 12}
    for name, x0 in legs.items():
        light = 0 if name == "inner" else 1
        t.plate(x0, 20, 4, 5, light=light)         # thigh plate
        t.dark(x0, 25, 4, 1)
        t.plate(x0, 26, 4, 2, light=light, bevel=False)  # knee band
        t.dark(x0, 28, 4, 1)
        t.plate(x0, 29, 4, 3, light=light)         # shin
    # knee guard on front
    t.put(5, 26, GOLD_L); t.put(6, 26, GOLD_L); t.put(4, 26, GOLD); t.put(7, 26, GOLD)
    t.put(5, 27, VEIN); t.put(6, 27, GOLD)
    # vertical gold trim on outer thigh + rune
    t.gold_col(0, 20, 5)
    t.put(2, 22, VEIN); t.put(1, 23, GLOW)
    # vine wrapping the back of the thigh
    t.branch([(13, 24), (14, 23), (14, 22), (13, 21)], clip=(12, 20, 4, 12))
    t.leaf(12, 22, True); t.bud(15, 21)


# --- inventory icons (16x16) ---------------------------------------------
KEY = {
    "o": OUTLINE, "x": VOID, "d": DEEP, "b": BASE, "m": MID, "h": HI, "s": SHINE,
    "v": VEIN, "w": GLOW, "k": GOLD_D, "g": GOLD, "G": GOLD_L,
    "W": (255, 214, 190), "t": STEM, "T": STEM_L, "l": WART_L, "y": SHROOM,
}

ICONS = {
    # silhouettes + shading follow the Lode Studio GUI icon templates
    "helmet": [
        "................",
        "................",
        "............ly..",
        ".....ooxxxo..T..",
        "....ossGghmot...",
        "...osWWGghmmo...",
        "...osWsGgmmmo...",
        "...xssgGggbmo...",
        "...xhovxxvobo...",
        "...omoxgkxobo...",
        "...oboxkkxobo...",
        "....oo....oo....",
        "................",
        "................",
        "................",
        "................",
    ],
    "chestplate": [
        "................",
        "....ly....yl....",
        "..xxxxT..Txxxx..",
        ".xWssxt..txWssx.",
        ".xshhhxttxWssbx.",
        ".xbhhhhggghhbbx.",
        ".xbbhhgvwghhbbx.",
        "..obWhhkkhhhbo..",
        "...oshhhhhhbo...",
        "...oogGGggkoo...",
        "...obmmhhmmbo...",
        "...obmhmmhmbo...",
        "...obmhhhhmbo...",
        "....obbhhbbo....",
        ".....oooooo.....",
        "................",
    ],
    "leggings": [
        "................",
        "..xxxx....xxxx..",
        "..xmbxxxxxxbbx..",
        "..xgGggwvggGko..",
        "..xshhhhhhhhmo..",
        "..xthhhhhhhhmo..",
        "..xlThhmmhhhmo..",
        "..xthhmoobhhmo..",
        "..xshmo..xhhmo..",
        "..xgGgo..xgGgo..",
        "..omvmo..ohvmo..",
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
        "...xGgo..xGgo...",
        "...xsmo..xmmo...",
        "...xsho..xhso...",
        "...xhvo..xhvo...",
        "...xhmo..xhho...",
        "..xhhmo..xmsmo..",
        ".xGgmmo..xmmgGo.",
        ".xgggoo..ooggko.",
        ".xooo......oooo.",
        "................",
        "................",
        "................",
    ],
}


def icon(rows):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), rows
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), KEY[ch] + (255,))
    return img


# --- per-piece equipped textures (cropped from the layer sheets) ----------
PIECE_REGIONS = {
    "helmet": ("l1", [(0, 0, 32, 16)]),
    "chestplate": ("l1", [(16, 16, 24, 16), (40, 16, 16, 16)]),
    "leggings": ("l2", [(0, 0, 64, 32)]),
    "boots": ("l1", [(0, 16, 16, 16)]),
}


def split_piece(layers, piece):
    src_name, boxes = PIECE_REGIONS[piece]
    src = layers[src_name]
    out = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    for x, y, w, h in boxes:
        out.paste(src.crop((x, y, x + w, y + h)), (x, y))
    return out


def sword():
    """16x16 Crimson Sword icon: diagonal, hilt bottom-left, tip top-right."""
    cells = {}
    # blade: three diagonals (lit edge, glowing core, shadow edge)
    for y in range(1, 9):
        for x in range(16):
            d = x + y
            if d not in (13, 14, 15) or x > 14:
                continue
            if y == 1 and d == 13:
                continue  # taper the tip
            if d == 13:
                cells[x, y] = SHINE if y % 3 else HI
            elif d == 14:
                cells[x, y] = GLOW if y in (2, 5) else VEIN
            else:
                cells[x, y] = MID if y % 2 else BASE
    cells[13, 1] = (255, 214, 190)  # tip glint
    # crossguard, perpendicular to the blade, with a gem at the centre
    for x in range(4, 10):
        cells[x, x + 1] = GOLD_L if x % 2 else GOLD
    for x in range(3, 9):
        cells[x, x + 2] = GOLD_D if x % 2 else GOLD
    cells[6, 7] = GOLD_L
    cells[6, 8] = VEIN      # heart gem
    cells[5, 7] = GOLD
    # grip wrapped in crimson stem
    for y in range(9, 14):
        for x in (13 - y, 14 - y):
            if (x, y) in cells:
                continue
            if y % 2:
                cells[x, y] = STEM_D
            else:
                cells[x, y] = STEM_L if x == 14 - y else STEM
    # shroomlight pommel
    cells[0, 14] = SHROOM
    cells[1, 14] = GLOW
    cells[0, 15] = GLOW
    # thorns jutting off the back edge of the blade
    for x, y in ((12, 4), (10, 6), (14, 2)):
        cells.setdefault((x, y), STEM_L)

    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for (x, y), c in cells.items():
        img.putpixel((x, y), c + (255,))
    # auto outline around everything
    for y in range(16):
        for x in range(16):
            if (x, y) in cells:
                continue
            if any((x + dx, y + dy) in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                img.putpixel((x, y), OUTLINE + (255,))
    return img


def greatsword():
    """32x32 Crimson Greatsword. Drawn in blade space: a runs along the blade
    (hilt bottom-left -> tip top-right), p is the offset across it."""
    N = 32
    cells = {}
    thorns = (5, 12)
    for y in range(N):
        for x in range(N):
            a, p = x - y, x + y - (N - 1)
            ap = abs(p)
            c = None
            # blade
            if -3 <= a <= 28:
                w = 4.2 if a < 16 else 4.2 * (28 - a) / 12
                if ap <= w:
                    # clean vanilla-style bands: no noise, it reads as static in 3D
                    if p <= -w + 1.2:
                        c = SHINE
                    elif p >= w - 1.2:
                        c = BASE
                    elif ap <= 1:
                        c = GLOW if a % 6 == 0 else VEIN
                    elif p < 0:
                        c = HI
                    else:
                        c = MID
                # barbed thorns on the back edge, raking toward the tip
                for a0 in thorns:
                    d = p - w
                    if p > 0 and 0 < d <= 3 and 0 <= a - a0 - (d - 1) * 1.0 <= 3 - d:
                        c = STEM_L if d < 2 else STEM
            # crossguard: gold bar, then crimson-stem wings curling toward the tip
            if -7 <= a <= -3 and ap <= 6:
                c = GOLD_L if a == -3 else (GOLD_D if a == -7 else GOLD)
                if a == -5 and ap in (3, 5):
                    c = GOLD_L
            if 6 < ap <= 11:
                ta = -5 + (ap - 6) * 0.9
                if abs(a - ta) <= 1.0:
                    c = STEM_L if a > ta else STEM
                if ap >= 9.5 and abs(a - ta) <= 1.5:
                    c = SHROOM
            # heart gem in the guard
            gd = ap + abs(a + 5)
            if gd <= 2:
                c = GLOW if gd == 0 else (VEIN if gd == 1 or p < 0 else WART)
            # grip wrapped in crimson stem
            if -17 <= a <= -8 and ap <= 1.5:
                c = STEM_D if a % 3 == 0 else (STEM_L if p < 0 else STEM)
            # pommel: shroomlight in a gold ring
            r = ((a + 21) ** 2 + p ** 2) ** 0.5
            if a <= -18 and r <= 3.9:
                c = SHROOM if r <= 1.5 else (GLOW if r <= 2.9 else GOLD)
            if c:
                cells[x, y] = c
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    for (x, y), c in cells.items():
        img.putpixel((x, y), c + (255,))
    for y in range(N):
        for x in range(N):
            if (x, y) not in cells and any(
                    (x + dx, y + dy) in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                img.putpixel((x, y), SWORD_OUTLINE + (255,))
    return img


def clear(img, x0, y0, w, h, keep=()):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if (x, y) not in keep:
                img.putpixel((x, y), (0, 0, 0, 0))


def slim(l1, l2):
    """Open gaps like vanilla armor so the skin shows and it reads less bulky."""
    clear(l1, 16, 0, 8, 8)                    # helmet underside
    # sleeves: skin shows between pauldron and gauntlet; no underside
    clear(l1, 40, 24, 16, 4)
    clear(l1, 48, 16, 4, 4)
    clear(l1, 28, 16, 8, 4)                   # chestplate underside
    # boots: no sole face; leggings: open inner leg below the knee and underside
    clear(l1, 8, 16, 4, 4)
    clear(l2, 8, 26, 4, 6)
    clear(l2, 8, 16, 4, 4)


def main():
    os.makedirs(f"{OUT}/items", exist_ok=True)
    os.makedirs(f"{OUT}/equipped", exist_ok=True)
    l1 = Tex()
    helmet(l1)
    chestplate(l1)
    arms(l1)
    boots(l1)

    l2 = Tex()
    leggings(l2)
    slim(l1.img, l2.img)
    l1.img.save(f"{OUT}/armor_layer_1.png")
    l2.img.save(f"{OUT}/armor_layer_2.png")

    sword().save(f"{OUT}/items/crimson_sword_16x.png")
    greatsword().save(f"{OUT}/items/crimson_sword.png")

    layers = {"l1": l1.img, "l2": l2.img}
    for piece, rows in ICONS.items():
        icon(rows).save(f"{OUT}/items/crimson_{piece}.png")
        split_piece(layers, piece).save(f"{OUT}/equipped/crimson_{piece}_equipped.png")


if __name__ == "__main__":
    main()
