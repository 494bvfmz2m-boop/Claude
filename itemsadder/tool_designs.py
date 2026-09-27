"""Hand-designed 32x32 tools for each tier (no recolours): Crimson "living
nether wood", Blue Crimson "frozen echo crystal", Halloween "haunted".

Drawn in blade space like crimson_armor/tools.py: a = x - y runs from the
handle (bottom-left) to the head (top-right); p = x + y - 31 runs across it,
p < 0 being the lit upper-left side.
"""
import math

from PIL import Image

N = 32


def to_xy(a, p):
    return (a + p + N - 1) / 2, (p - a + N - 1) / 2


class Canvas:
    def __init__(self, outline):
        self.cells, self.over, self.outline = {}, {}, outline

    def paint(self, fn, shift=0):
        for y in range(N):
            for x in range(N):
                c = fn(x - y + shift, x + y - (N - 1))
                if c:
                    self.cells[x, y] = c

    def line(self, a0, p0, a1, p1, c):
        (x0, y0), (x1, y1) = to_xy(a0, p0), to_xy(a1, p1)
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
            if 0 <= x < N and 0 <= y < N:
                self.over[x, y] = c

    def dot(self, a, p, c):
        x, y = to_xy(a, p)
        if 0 <= x < N and 0 <= y < N and x == int(x):
            self.over[int(x), int(y)] = c

    def image(self):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        for (x, y), c in self.cells.items():
            img.putpixel((x, y), c + (255,))
        for y in range(N):
            for x in range(N):
                if (x, y) not in self.cells and any(
                        (x + dx, y + dy) in self.cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    img.putpixel((x, y), self.outline + (255,))
        for (x, y), c in self.over.items():
            img.putpixel((x, y), c + (255,))
        return img


# --- palettes -----------------------------------------------------------------
CR = dict(out=(66, 12, 22), deep=(78, 10, 20), base=(122, 16, 28), mid=(158, 26, 38), hi=(198, 52, 58),
          shine=(236, 108, 96), vein=(255, 64, 52), glow=(255, 150, 110), gold_d=(120, 72, 22),
          gold=(196, 142, 44), gold_l=(246, 204, 96), stem_d=(96, 36, 66), stem=(148, 62, 98),
          stem_l=(196, 104, 140), wart=(170, 12, 22), wart_l=(224, 40, 44), bud=(255, 196, 110))
BL = dict(out=(12, 22, 48), deep=(20, 40, 90), base=(30, 70, 150), mid=(50, 110, 200), hi=(100, 170, 240),
          shine=(190, 230, 255), glow=(120, 255, 250), core=(40, 220, 230), silver_d=(110, 122, 146),
          silver=(186, 198, 216), silver_l=(236, 242, 250), sculk=(12, 58, 70), sculk_l=(22, 108, 120))
HW = dict(out=(24, 10, 26), or_d=(120, 50, 8), orange=(210, 100, 20), or_l=(250, 160, 50),
          pur_d=(40, 16, 56), pur=(90, 40, 120), pur_l=(150, 80, 190), grn_d=(40, 100, 30), grn=(70, 160, 50),
          grn_l=(150, 240, 90), bone_d=(170, 160, 135), bone=(230, 220, 195), candle=(255, 230, 120),
          flame=(255, 250, 200), iron_d=(58, 50, 66), iron=(96, 88, 106), iron_l=(140, 132, 150),
          wood_d=(50, 30, 24), wood=(84, 54, 38))

# colours used for model depth + emissive glow per tier
GLOW_SETS = {"crimson": {CR["vein"], CR["glow"], CR["bud"], CR["wart_l"]},
             "blue_crimson": {BL["glow"], BL["core"], BL["shine"]},
             "halloween": {HW["candle"], HW["flame"], HW["grn_l"], HW["or_l"]}}
THICK_SETS = {"crimson": {CR["gold"], CR["gold_l"], CR["gold_d"], CR["bud"]},
              "blue_crimson": {BL["silver"], BL["silver_l"], BL["silver_d"]},
              "halloween": {HW["orange"], HW["or_d"], HW["bone"], HW["bone_d"]}}
GRIP_SETS = {"crimson": {CR["stem"], CR["stem_l"], CR["stem_d"]},
             "blue_crimson": {BL["sculk"], BL["sculk_l"]},
             "halloween": {HW["wood"], HW["wood_d"], HW["pur_d"]}}
SHIMMER_SETS = {"crimson": {CR["shine"], CR["hi"], CR["mid"], CR["base"]},
                "blue_crimson": {BL["hi"], BL["mid"], BL["base"], BL["shine"]},
                "halloween": {HW["pur"], HW["pur_l"], HW["iron"], HW["iron_l"]}}


def diamond(a, p, ac, pc, r):
    return abs(a - ac) + abs(p - pc) <= r


# ================================ CRIMSON ======================================
def cr_grip(a, p, a0, a1):
    if a0 <= a <= a1 and abs(p) <= 1.5:
        if (a + p) % 7 == 0:
            return CR["wart_l"]                          # vine wrapped around the branch
        return CR["stem_l"] if p < 0 else CR["stem"]
    return None


def cr_fungus_pommel(a, p, ac):
    """Crimson-fungus cap pommel: dome facing away from the grip, spotted."""
    r = math.hypot(a - ac, p * 0.9)
    if a <= ac + 0.5 and r <= 3.6:
        if r > 2.6 and a <= ac - 1:
            return CR["wart"]
        return CR["bud"] if (a * 3 + p) % 5 == 0 else CR["wart_l"]
    if ac < a <= ac + 1.5 and abs(p) <= 2.5:
        return CR["stem_l"]                              # gills
    return None


def cr_sword(a, p):
    ap = abs(p)
    if -3 <= a <= 28:
        w = 4.4 if a < 14 else 4.4 * (28 - a) / 14
        tooth = 1.2 if (a < 22 and a % 4 in (0, 1)) else 0      # serrated thorn edges
        if ap <= w + tooth:
            if ap > w:
                return CR["hi"] if p < 0 else CR["deep"]
            if ap <= 1:
                return CR["glow"] if a % 5 == 0 else CR["vein"]
            if a < 11 and a % 7 in (2, 3, 4) and abs(ap - 1 - (a % 7 - 2) * 0.9) < 0.5:
                return CR["vein"]                        # glowing roots near the guard
            if p <= -w + 1.2:
                return CR["shine"]
            if p >= w - 1.2:
                return CR["base"]
            return CR["hi"] if p < 0 else CR["mid"]
    # guard: two curling crimson branches with shroomlight buds
    if 2 <= ap <= 11:
        ac = -5 + ((ap - 2) / 9) ** 2 * 7
        if ap >= 9.8 and abs(a - ac) <= 1.4:
            return CR["bud"]
        if abs(a - ac) <= 1.1:
            return CR["stem_l"] if a > ac else CR["stem"]
    if diamond(a, p, -5, 0, 2):
        return CR["glow"] if diamond(a, p, -5, 0, 0) else CR["vein"]
    if diamond(a, p, -5, 0, 3):
        return CR["gold_l"] if p < 0 else CR["gold"]
    return cr_grip(a, p, -17, -8) or cr_fungus_pommel(a, p, -20.5)


def cr_axe(a, p):
    # crescent bit between two circles on the lit side, veined
    oa, op, orr = 16, -2, 11
    ia, ip, irr = 16, 4.5, 9
    do, di = math.hypot(a - oa, p - op), math.hypot(a - ia, p - ip)
    if do <= orr and di > irr and p < -1:
        if orr - do < 1.3:
            return CR["shine"]
        ang = math.atan2(p - op, a - oa)
        if abs((ang * 6) % 1.0 - 0.5) < 0.12:
            return CR["vein"]
        return CR["hi"] if do > orr - 4 else CR["mid"]
    if 12 <= a <= 20 and -2.5 <= p <= 2.5:
        if diamond(a, p, 16, 0, 1):
            return CR["glow"]
        return CR["gold_l"] if a >= 19 else (CR["gold_d"] if a <= 12 else CR["gold"])
    for a0 in (13, 16.5, 20):                            # thorns on the back
        d = p - 2.5
        if 0 < d <= 3.5 - abs(a - a0) * 1.4:
            return CR["stem_l"] if d < 2 else CR["stem"]
    return cr_grip(a, p, -18, 24) or cr_fungus_pommel(a, p, -21.5)


def cr_pickaxe(a, p):
    ap = abs(p)
    if 21.5 <= a <= 26 and ap <= (26 - a) * 0.7:
        return CR["shine"] if p <= 0 else CR["hi"]       # crystal crown spike
    if 14 <= a <= 21 and ap <= 2.5:
        if diamond(a, p, 17.5, 0, 1):
            return CR["glow"]
        return CR["gold_l"] if a >= 20 else CR["gold"]
    if ap <= 14.5:                                       # two branch horns with crystal tips
        ac = 18 - p * p / 28
        t = 2.0 * (1 - (ap / 16) ** 2) + 0.7
        da = a - ac
        if abs(da) <= t:
            if ap > 10.5:
                return CR["shine"] if da > 0 else (CR["vein"] if abs(da) < 0.6 else CR["hi"])
            if ap in (6, 7) and da > t - 1:
                return CR["wart_l"]                      # leaves on the branch
            return CR["stem_l"] if da > 0 else (CR["stem_d"] if da < -t + 0.8 else CR["stem"])
    return cr_grip(a, p, -18, 15) or cr_fungus_pommel(a, p, -21.5)


def cr_shovel(a, p):
    ap = abs(p)
    if 12 <= a <= 28:                                    # crimson-leaf spade
        w = 6.2 * math.sin(math.pi * (a - 12) / 16) ** 0.8
        if ap <= w:
            if ap <= 0.8:
                return CR["glow"] if a % 4 == 0 else CR["vein"]
            for base in (14, 17, 20, 23):
                if a > base and abs(ap - (a - base) * 0.9) < 0.55:
                    return CR["wart"]
            if ap >= w - 1.1:
                return CR["shine"] if p < 0 else CR["base"]
            return CR["hi"] if p < 0 else CR["mid"]
    if 10 <= a <= 12 and ap <= 2.5:
        return CR["gold_l"] if a == 12 else CR["gold"]
    return cr_grip(a, p, -18, 11) or cr_fungus_pommel(a, p, -21.5)


def cr_hoe(a, p):
    ap = abs(p)
    if 20 <= a <= 24 and -3 <= p <= 3:
        if diamond(a, p, 22, 0, 1):
            return CR["glow"]
        return CR["gold_l"] if a == 24 else CR["gold"]
    if p < -2.5 and ap <= 14:                            # thorned reaper hook
        t = ap - 2.5
        ac = 22.5 - (t / 11.5) ** 2 * 9
        th = 2.2 * (1 - t / 13) + 0.5
        da = a - ac
        if abs(da) <= th:
            if da < -th + 1.1:
                return CR["shine"]
            return CR["hi"] if da < 0.5 else CR["base"]
        if t in (3.5, 7.5) and 0 < da - th <= 2:
            return CR["stem_l"]
    return cr_grip(a, p, -18, 21) or cr_fungus_pommel(a, p, -21.5)


# ============================== BLUE CRIMSON ===================================
def bl_grip(a, p, a0, a1):
    if a0 <= a <= a1 and abs(p) <= 1.5:
        if a in (a0, a1):
            return BL["silver_l"]
        return BL["sculk_l"] if (a // 2) % 2 else BL["sculk"]
    return None


def bl_crystal_pommel(a, p, ac):
    if diamond(a, p, ac, 0, 3):
        if diamond(a, p, ac, 0, 1):
            return BL["glow"]
        return BL["hi"] if p < 0 or a > ac else BL["mid"]
    return None


def facet(p, w, a, band=6):
    """Faceted crystal: lit side, shadow side, a white ridge and alternating bands."""
    if abs(p) <= 0.5:
        return BL["shine"]
    if p < 0:
        return BL["hi"] if (a // band) % 2 else BL["shine"] if p <= -w + 1 else BL["hi"]
    return BL["mid"] if (a // band) % 2 else BL["base"]


def bl_sword(a, p):
    ap = abs(p)
    if -3 <= a <= 30:
        w = 4.0 if a < 20 else 4.0 * (30 - a) / 10
        if ap <= w:
            if ap <= 1.2 and a % 6 in (0, 1):
                return BL["glow"]                        # runes
            return facet(p, w, a)
        for a0 in (4, 11, 18):                           # ice shards jutting forward
            d = ap - w
            if 0 < d <= 3 and a0 <= a <= a0 + (3 - d) * 1.2:
                return BL["shine"] if p < 0 else BL["hi"]
    if 1.5 <= ap <= 9:                                   # silver crescent guard
        ac = -4 + (ap / 9) ** 2 * 5
        if abs(a - ac) <= 1.1:
            return BL["shine"] if ap > 7.5 else (BL["silver_l"] if a > ac else BL["silver"])
    if -6 <= a <= -3 and ap <= 1.5:
        return BL["silver"]
    return bl_grip(a, p, -18, -7) or bl_crystal_pommel(a, p, -21)


def bl_axe(a, p):
    if 10 <= a <= 26:                                    # angular glacier cleaver
        pe = -4.5 - (a - 10) * 0.45
        if pe <= p <= -1.5:
            if p <= pe + 1.1 or a >= 25.5:
                return BL["shine"]
            if (a - 10) + (p + 1.5) * 1.2 > 6 and (a + int(p)) % 5 == 0:
                return BL["glow"]
            return BL["hi"] if p < -4 - (a - 10) * 0.2 else BL["mid"]
    if 15 <= a <= 20 and 1.5 <= p <= 4.5:
        return BL["silver_l"] if a == 20 else BL["silver"]   # hammer poll
    if 12 <= a <= 22 and -1.5 <= p <= 1.5:
        return BL["silver_d"] if a in (12, 22) else BL["silver"]
    return bl_grip(a, p, -18, 24) or bl_crystal_pommel(a, p, -21.5)


def bl_pickaxe(a, p):
    ap = abs(p)
    if 14 <= a <= 21 and ap <= 2.5:
        return BL["glow"] if diamond(a, p, 17.5, 0, 1) else BL["silver"]
    if ap <= 14.5:                                       # straight V of echo-shard spikes
        ac = 17.5 - ap * 0.35
        t = 1.7 if ap < 9 else 1.7 * (14.5 - ap) / 5.5 + 0.3
        da = a - ac
        if abs(da) <= t:
            if ap >= 9:
                return BL["glow"] if abs(da) < 0.6 else BL["shine"]
            return BL["hi"] if da > 0 else BL["base"]
    return bl_grip(a, p, -18, 15) or bl_crystal_pommel(a, p, -21.5)


def bl_shovel(a, p):
    ap = abs(p)
    if a >= 13 and ap / 5.5 + abs(a - 20.5) / 8 <= 1:     # diamond-cut spade
        if ap <= 0.6:
            return BL["glow"]
        if ap / 5.5 + abs(a - 20.5) / 8 > 0.82:
            return BL["shine"] if p < 0 else BL["base"]
        return (BL["hi"] if a > 20.5 else BL["shine"]) if p < 0 else (BL["mid"] if a > 20.5 else BL["base"])
    if 10 <= a <= 13 and ap <= 2.5:
        return BL["silver_l"] if a == 13 else BL["silver"]
    return bl_grip(a, p, -18, 11) or bl_crystal_pommel(a, p, -21.5)


def bl_hoe(a, p):
    if 20 <= a <= 24 and -9 <= p <= 2.5:                 # angular ice hook
        if p > -1.5:
            return BL["silver_l"] if a == 24 else BL["silver"]
        return BL["shine"] if a >= 23.5 else BL["hi"]
    if -12.5 <= p <= -8 and 11 <= a <= 24 and a >= 20 - (p + 12.5) * 2:
        if p <= -11.5 or a <= 12:
            return BL["shine"]
        return BL["glow"] if p == -10 and a % 3 == 0 else BL["mid"]
    return bl_grip(a, p, -18, 21) or bl_crystal_pommel(a, p, -21.5)


# ================================ HALLOWEEN ====================================
def hw_bone_grip(a, p, a0, a1):
    if a0 <= a <= a1 and abs(p) <= 1.5:
        if (a - a0) % 5 == 0:
            return HW["bone"] if abs(p) <= 1 else HW["bone_d"]   # knuckles
        return HW["bone_d"] if p > 0 else HW["bone"]
    return None


def hw_wood_grip(a, p, a0, a1):
    if a0 <= a <= a1 and abs(p) <= 1.5:
        if (a + 2 * p) % 7 == 0:
            return HW["grn"]                               # creeping vine
        return HW["wood"] if p < 0 else HW["wood_d"]
    return None


def hw_skull(a, p, ac):
    r = math.hypot(a - ac, p)
    if r <= 3.1:
        if abs(a - ac - 0.5) <= 0.6 and abs(abs(p) - 1.2) <= 0.6:
            return HW["out"]                               # eye sockets
        if a - ac <= -2 and abs(p) <= 1.5 and (int(p) % 2 == 0):
            return HW["bone_d"]                            # teeth
        return HW["bone"] if a > ac - 1 else HW["bone_d"]
    return None


def hw_pumpkin(a, p, ac, r=3.4):
    d = math.hypot(a - ac, p)
    if d <= r:
        if abs(a - ac - 0.8) <= 0.6 and abs(abs(p) - 1.3) <= 0.7:
            return HW["candle"]                            # glowing eyes
        if abs(a - ac + 1.2) <= 0.6 and abs(p) <= 1.8:
            return HW["candle"]                            # grin
        return HW["or_l"] if p < -1.5 else (HW["orange"] if abs(p) % 2 < 1 else HW["or_d"])
    if ac + r - 0.5 <= a <= ac + r + 1.2 and abs(p) <= 0.9:
        return HW["grn"]                                   # stem
    return None


def hw_sword(a, p):
    ap = abs(p)
    if -1 <= a <= 29:
        w = 4.6 if a < 18 else 4.6 * (29 - a) / 11
        flick = 1 if a % 3 == 0 else 0
        if ap <= w:
            if p <= -w + 1.2 + flick:
                return HW["candle"] if a % 2 else HW["or_l"]  # fiery carved edge
            if a >= 25:
                return HW["flame"] if ap <= 1 else HW["candle"]
            if ap <= 0.8:
                return HW["pur_l"]
            return HW["pur"] if p < 0 else HW["pur_d"]
    pk = hw_pumpkin(a, p, -4)
    if pk:
        return pk
    return hw_bone_grip(a, p, -17, -8) or hw_skull(a, p, -20.5)


def hw_axe(a, p):
    if 9 <= a <= 26:                                     # pumpkin-faced headsman's bit
        pe = -3.5 - 9 * math.sqrt(max(0.0, 1 - ((a - 17.5) / 8.5) ** 2))
        if pe <= p <= -2.5:
            if p <= pe + 1.2:
                return HW["or_l"]
            if (abs(a - 20) <= 1 and abs(p + 7.5) <= 1) or (abs(a - 20) <= 1 and abs(p + 4.5) <= 0.6):
                return HW["candle"]                        # carved eye + slit
            if abs(a - 14.5) <= 0.6 and -9 <= p <= -4:
                return HW["candle"]                        # carved grin
            return HW["orange"] if int(p) % 2 else HW["or_d"]
    if 13 <= a <= 21 and -2.5 <= p <= 2.5:
        return HW["iron_l"] if a == 21 else HW["iron"]
    return hw_wood_grip(a, p, -18, 24) or hw_skull(a, p, -21.5)


def xy(a, p):
    return (a + p + N - 1) / 2, (p - a + N - 1) / 2


def hw_pickaxe(a, p):
    """Bat-wing pick, laid out in pixel space around the bat's body."""
    x, y = xy(a, p)
    bx, by = 20.5, 10.5                                   # bat body
    u = ((x - bx) - (y - by)) / 1.414                     # along the haft, toward the head
    s = ((x - bx) + (y - by)) / 1.414                     # across: the wing span
    if math.hypot(u, s) <= 2.3:
        if abs(u - 0.6) <= 0.5 and abs(abs(s) - 0.9) <= 0.5:
            return HW["candle"]                            # glowing eyes
        return HW["pur_l"] if s < 0 else HW["pur"]
    if 1.8 <= u <= 3.6 and 0.6 <= abs(s) <= 1.8:
        return HW["pur"]                                   # ears
    if 2.2 <= abs(s) <= 11:
        k = abs(s) - 2.2
        top = 1.6 + k * 0.28
        bot = top - 5.2 + 2.4 * abs(math.sin(k * math.pi / 2.9))   # scalloped membrane
        if bot <= u <= top:
            if u >= top - 0.8 or k % 2.9 < 0.6:
                return HW["bone"]                          # finger bones
            return HW["pur"] if s < 0 else HW["pur_d"]
    return hw_wood_grip(a, p, -24, 10) or hw_skull(a, p, -27)


def hw_shovel(a, p):
    ap = abs(p)
    if 13 <= a <= 27 and ap <= 5 - max(0, a - 24) * 1.4:  # gravedigger's spade
        if (ap <= 0.6 and 16 <= a <= 23) or (abs(a - 21) <= 0.6 and ap <= 2.6):
            return None                                    # cross cut clean through
        if a <= 14 and a % 2 and ap < 4.5:
            return HW["grn_l"]                             # slime dripping off the lip
        if ap >= 4.2:
            return HW["iron_l"] if p < 0 else HW["iron_d"]
        return HW["iron"] if p < 0 else HW["iron_d"]
    if 12 <= a <= 13 and -3 <= p <= 3 and (a + p) % 2:
        return HW["grn"]                                   # drips
    if 10 <= a <= 12 and ap <= 2.5:
        return HW["iron_l"]
    return hw_wood_grip(a, p, -18, 11) or hw_skull(a, p, -21.5)


SCYTHE = [(21.0, 8.0), (9.0, -1.5), (2.0, 9.5)]   # quadratic curve of the blade, pixel space


def hw_hoe(a, p):
    """Reaper's scythe: a big curved blade sweeping off the top of the haft."""
    x, y = xy(a, p)
    (x0, y0), (cx, cy), (x2, y2) = SCYTHE
    best = (99, 0, 0, 0)
    for i in range(61):
        t = i / 60
        bx = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x2
        by = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y2
        d = math.hypot(x + 0.5 - bx, y + 0.5 - by)
        if d < best[0]:
            best = (d, t, bx, by)
    d, t, bx, by = best
    th = 2.9 * (1 - t) + 0.6
    if d <= th:
        inner = (y + 0.5) > by + (x + 0.5 - bx) * 0.3   # the cutting edge faces down/in
        if inner and d > th - 1.2:
            return HW["grn_l"] if int(t * 12) % 3 == 0 else HW["bone"]
        return HW["pur"] if not inner else HW["pur_d"]
    if math.hypot(x + 0.5 - 22, y + 0.5 - 8.5) <= 2.6:
        sk = hw_skull(a, p, 13)
        if sk:
            return sk
        return HW["bone"]
    return hw_wood_grip(a, p, -26, 11)


# ================================ BOWS =========================================
BOW_STATES = {"bow": (-6, 24, None), "bow_pulling_0": (-5, 23, -9),
              "bow_pulling_1": (-4, 22, -12), "bow_pulling_2": (-3, 21, -15)}
APEX = 5


def bow(state, style):
    tip, P, nock = BOW_STATES[state]
    pal = {"crimson": CR, "blue_crimson": BL, "halloween": HW}[style]
    cv = Canvas(pal["out"])
    angular = style == "blue_crimson"

    def f(p):
        if angular:   # straight faceted limbs
            return tip + (APEX - tip) * (1 - abs(p) / P) ** 0.9
        return tip + (APEX - tip) * (1 - (p / P) ** 2)

    def limb(a, p):
        ap = abs(p)
        if ap > P + 1:
            return None
        da = a - f(min(ap, P))
        if style == "crimson":
            if ap <= 3.5 and abs(da) <= 2.2:
                return CR["vein"] if ap <= 1 and abs(da) <= 1 else (CR["gold_l"] if da > 0 else CR["gold"])
            if ap >= P - 1.5 and abs(da) <= 2:
                return CR["bud"]
            for pt in (8, 13, 18):
                if abs(ap - pt) <= 2 and 1.6 < da <= 1.6 + 2 - abs(ap - pt):
                    return CR["stem_l"]
            if ap in (10, 16) and -3 <= da < -1.6:
                return CR["wart_l"]                          # leaves on the inside
            if abs(da) <= 1.6:
                return CR["stem_l"] if da > 0.6 else (CR["stem_d"] if da < -0.6 else CR["stem"])
        elif style == "blue_crimson":
            if ap <= 3 and abs(da) <= 2.2:
                return BL["glow"] if ap <= 1 else BL["silver"]
            if ap >= P - 2.5 and abs(da) <= 1.8:
                return BL["shine"] if da > 0 else BL["glow"]
            if abs(da) <= 1.5:
                return BL["silver_l"] if da > 0.5 else (BL["hi"] if da > -0.5 else BL["base"])
        else:
            if ap <= 3.5 and abs(da) <= 2.4:
                return HW["candle"] if ap <= 1 and abs(da) <= 1 else HW["orange"]
            joint = min(abs(ap - j) for j in (8, 15))
            if joint <= 1 and abs(da) <= 2:
                return HW["bone"]                            # spider-leg joints
            if ap >= P - 1.5 and abs(da) <= 1.6:
                return HW["bone"]
            if abs(da) <= 1.4:
                return HW["pur_l"] if da > 0.4 else HW["pur_d"]
        return None

    cv.paint(limb)
    string = {"crimson": (244, 222, 206), "blue_crimson": BL["glow"], "halloween": HW["grn_l"]}[style]
    arrow = {"crimson": (CR["stem_l"], CR["shine"], CR["hi"], CR["wart_l"]),
             "blue_crimson": (BL["silver"], BL["shine"], BL["hi"], BL["glow"]),
             "halloween": (HW["wood"], HW["candle"], HW["or_l"], HW["pur_l"])}[style]
    if nock is None:
        cv.line(tip, -P + 1, tip, P - 1, string)
    else:
        cv.line(tip, -P + 1, nock, 0, string)
        cv.line(tip, P - 1, nock, 0, string)
        head = nock + 26
        cv.line(nock, 0, head - 4, 0, arrow[0])
        for a in range(nock, nock + 5):
            for p in (-3, -2, -1, 1, 2, 3):
                if (a + p) % 2 and abs(p) <= 3 - (a - nock) * 0.5:
                    cv.dot(a, p, arrow[3])
        for a in range(head - 6, head + 1):
            for p in range(-3, 4):
                if (a + p + N - 1) % 2 == 0 and abs(p) <= (head - a) * 0.6:
                    cv.dot(a, p, arrow[1] if p <= 0 else arrow[2])
    return cv.image()


DESIGNS = {
    "crimson": {"sword": (cr_sword, 0), "axe": (cr_axe, 4), "pickaxe": (cr_pickaxe, 3),
                "shovel": (cr_shovel, 3), "hoe": (cr_hoe, 5)},
    "blue_crimson": {"sword": (bl_sword, 1), "axe": (bl_axe, 4), "pickaxe": (bl_pickaxe, 3),
                     "shovel": (bl_shovel, 3), "hoe": (bl_hoe, 5)},
    "halloween": {"sword": (hw_sword, 1), "axe": (hw_axe, 4), "pickaxe": (hw_pickaxe, 0),
                  "shovel": (hw_shovel, 3), "hoe": (hw_hoe, 0)},
}
OUTLINE = {"crimson": CR["out"], "blue_crimson": BL["out"], "halloween": HW["out"]}


def tool(tier, name):
    fn, shift = DESIGNS[tier][name]
    cv = Canvas(OUTLINE[tier])
    cv.paint(fn, shift)
    return cv.image()
