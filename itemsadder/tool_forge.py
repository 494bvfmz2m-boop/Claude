"""Parametric tool and bow forge for the armor sets.

Every set picks its own blade shape, guard, pommel, grip, blade decoration,
axe/pickaxe/shovel/hoe heads and bow style, in its own colours, so no two
sets share a look. Drawn in blade space (see tool_designs.py): a runs from
the handle (bottom-left) to the tip (top-right), p runs across, p < 0 lit.
"""
import math

from PIL import Image

from tool_designs import APEX, BOW_STATES, N, Canvas


def clamp(v):
    return max(0, min(255, int(v)))


def shade(c, k):
    return tuple(clamp(v * k) for v in c)


def lighten(c, t):
    return tuple(clamp(v + (255 - v) * t) for v in c)


def hsh(a, p, k=0):
    n = (int(a * 7) * 374761393 + int(p * 7) * 668265263 + k * 97531) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65536


class Pal:
    """Colour ramps for one set's tools."""

    def __init__(self, T):
        m, hd, ac, g = T["metal"], T["handle"], T["accent"], T["glow"]
        self.o = T.get("outline", shade(m, 0.3))
        self.d, self.b, self.m = shade(m, 0.62), shade(m, 0.82), m
        self.h, self.s = lighten(m, 0.32), lighten(m, 0.62)
        self.hd, self.hm, self.hl = shade(hd, 0.7), hd, lighten(hd, 0.3)
        self.ad, self.am, self.al = shade(ac, 0.7), ac, lighten(ac, 0.35)
        self.g, self.gl = g, lighten(g, 0.55)
        self.alt = T.get("alt", lighten(m, 0.45))

    def glow_set(self):
        return {self.g, self.gl}

    def thick_set(self):
        return {self.ad, self.am, self.al}

    def grip_set(self):
        return {self.hd, self.hm, self.hl}

    def shimmer_set(self):
        return {self.b, self.m, self.h, self.s}


# ------------------------------------------------------------------ sword blades
# each returns (centre, half-width lit side, half-width dark side) at blade position a, or None
def _taper(a, T, start, w):
    return w if a < start else w * (T - a) / (T - start)


def bl_broad(a):
    return (0, _taper(a, 28, 18, 4.2), _taper(a, 28, 18, 4.2)) if 0 <= a <= 28 else None


def bl_katana(a):
    if not 0 <= a <= 29:
        return None
    c = -1.8 * (a / 29) ** 2
    return (c, 1.3, 2.5 * (29 - a) / 5 if a > 24 else 2.5)


def bl_rapier(a):
    return (0, _taper(a, 30, 25, 1.5), _taper(a, 30, 25, 1.5)) if 0 <= a <= 30 else None


def bl_cleaver(a):
    if not 0 <= a <= 23:
        return None
    wr = min(6.5, 3 + a * 0.22)
    if a > 19:
        wr -= (a - 19) * 1.3
    return (0, 2.6 if a < 21 else 2.6 - (a - 21) * 1.2, wr)


def bl_scimitar(a):
    if not 0 <= a <= 27:
        return None
    c = 2.6 * (a / 27) ** 2
    w = 2.4 + 2.2 * a / 27
    return (c, _taper(a, 27, 21, w * 0.7), _taper(a, 27, 21, w))


def bl_greatsword(a):
    if not 0 <= a <= 30:
        return None
    if a < 4:
        return (0, 2.4, 2.4)                     # ricasso
    return (0, _taper(a, 30, 22, 5.2), _taper(a, 30, 22, 5.2))


def bl_crystal(a):
    if not 0 <= a <= 28:
        return None
    w = 3.2 + (1.6 if (a // 3) % 2 else 0)
    return (0, _taper(a, 28, 20, w), _taper(a, 28, 20, w + 0.4))


def bl_serrated(a):
    if not 0 <= a <= 27:
        return None
    tooth = 1.4 if (a < 21 and a % 4 < 2) else 0
    return (0, _taper(a, 27, 20, 3.6), _taper(a, 27, 20, 3.6) + tooth)


def bl_leaf(a):
    if not 0 <= a <= 27:
        return None
    w = 1.4 + 3.8 * math.sin(math.pi * min(1, (a / 27)) ** 0.8)
    return (0, w, w)


def bl_wavy(a):
    if not 0 <= a <= 28:
        return None
    return (1.3 * math.sin(a / 2.2), _taper(a, 28, 22, 3.0), _taper(a, 28, 22, 3.0))


def bl_gladius(a):
    if not 0 <= a <= 23:
        return None
    w = 4.0 - 0.9 * math.sin(math.pi * min(a, 15) / 15)
    return (0, _taper(a, 23, 15, w), _taper(a, 23, 15, w))


def bl_forked(a):
    if not 0 <= a <= 27:
        return None
    return (0, _taper(a, 27, 23, 4.2), _taper(a, 27, 23, 4.2))


def bl_bone(a):
    if not 0 <= a <= 26:
        return None
    knob = 1.1 if a % 6 in (0, 1) else 0
    return (0, _taper(a, 26, 20, 3.0 + knob), _taper(a, 26, 20, 3.0 + knob))


def bl_needle(a):   # thin stiletto with a wide base
    if not 0 <= a <= 29:
        return None
    w = 3.4 * (1 - a / 29) + 0.6
    return (0, w, w)


BLADES = {"broad": bl_broad, "katana": bl_katana, "rapier": bl_rapier, "cleaver": bl_cleaver,
          "scimitar": bl_scimitar, "greatsword": bl_greatsword, "crystal": bl_crystal,
          "serrated": bl_serrated, "leaf": bl_leaf, "wavy": bl_wavy, "gladius": bl_gladius,
          "forked": bl_forked, "bone": bl_bone, "needle": bl_needle}


def blade_colour(P, T, a, p, c, wl, wr, deco):
    """Colour of blade pixel at (a, p); None if outside."""
    dp = p - c
    if dp < -wl or dp > wr:
        return None
    shape = T["sword"]
    if shape == "forked" and a > 18 and abs(dp) < 1.4:
        return None                                   # split tip
    tip = BLADES[shape]
    # decoration first
    if deco == "fuller" and abs(dp) <= 0.8 and 3 < a < 20:
        return P.d
    if deco == "runes" and abs(dp) <= 0.8 and a % 4 == 1 and a < 22:
        return P.g
    if deco == "vein" and abs(dp) <= 0.8 and a < 24:
        return P.gl if a % 6 == 0 else P.g
    if deco in ("edge", "edge_runes") and dp >= wr - 0.9:
        return P.gl if a % 5 == 0 else P.g
    if deco == "edge_runes" and abs(dp) <= 0.6 and a % 3 == 1 and 2 < a < 24:
        return P.alt
    if deco == "stripes" and ((a + (dp > 0)) // 3) % 2:
        return P.alt if dp < 0 else shade(P.alt, 0.85)
    if deco == "cracks" and hsh(a // 2, dp // 2, 3) > 0.72:
        return P.g
    if deco == "stars" and hsh(a, dp, 5) > 0.9:
        return P.gl
    if deco == "facets" and (a // 3 + (dp > 0)) % 2 == 0:
        return P.h if dp < 0 else P.b
    if deco == "core" and abs(dp) <= 1.2:
        return P.g
    # plain shading: lit edge, body, dark edge
    if dp <= -wl + 1.1:
        return P.s
    if dp >= wr - 1.1:
        return P.b
    return P.h if dp < 0 else P.m


def guard_colour(P, T, a, p):
    g, ap = T.get("guard", "cross"), abs(p)
    lit = P.al if p < 0 else P.am
    if g not in ("disc", "ring", "none") and -6.2 <= a <= -3.8 and ap <= 3.2:
        return lit                                        # collar joining guard and grip
    if g == "cross":
        if -6.5 <= a <= -3.5 and ap <= 9:
            return P.ad if ap > 8 else lit
    elif g == "wings":
        if 2 <= ap <= 10.5:
            ac = -5 + ((ap - 2) / 8.5) ** 2 * 6.5
            if abs(a - ac) <= 1.2:
                return lit
    elif g == "droop":
        if 2 <= ap <= 10:
            ac = -5 - ((ap - 2) / 8) ** 2 * 5
            if abs(a - ac) <= 1.2:
                return lit
    elif g == "disc":
        r = math.hypot(a + 5, p)
        if r <= 4.4:
            return P.g if 2.2 < r < 3 and int(math.degrees(math.atan2(p, a + 5))) % 90 < 30 else lit
    elif g == "collar":
        if -6.5 <= a <= -3.5 and ap <= 4.5:
            return lit
    elif g == "horns":
        if 2.5 <= ap <= 10:
            ac = -5 + (ap - 2.5) * 1.05
            if abs(a - ac) <= 1.6 - (ap - 2.5) * 0.12:
                return lit
    elif g == "ring":
        r = math.hypot(a + 5, p)
        if 2.6 <= r <= 4.4 or (-6 <= a <= -4 and ap <= 2.6):
            return lit
    elif g == "crescent":
        r = math.hypot(a + 11, p)
        if 7 <= r <= 8.8 and a >= -8:
            return lit
    elif g == "bar_gem":
        if -6.5 <= a <= -3.5 and ap <= 8:
            return lit
        if math.hypot(a + 5, p) <= 3:
            return P.g
    elif g == "fins":
        if 2 <= ap <= 8 and -9 + ap * 0.2 <= a <= -3 - (ap - 2) * 0.7:
            return lit
    return None


def grip_colour(P, T, a, p, a0=-19, a1=-7):
    if not (a0 <= a <= a1 and abs(p) <= 1.5):
        return None
    style = T.get("grip", "wrap")
    if style == "wrap" and (a + p) % 4 == 0:
        return P.hd
    if style == "spiral" and (a + p) % 6 == 0:
        return P.g
    if style == "bands" and a % 5 == 0:
        return P.am
    return P.hl if p < 0 else P.hm


def pommel_colour(P, T, a, p, ac=-21.5):
    kind, ap = T.get("pommel", "gem"), abs(p)
    d = math.hypot(a - ac, p)
    if kind == "gem":
        if abs(a - ac) + ap <= 1.2:
            return P.g
        if abs(a - ac) + ap <= 3:
            return P.al if p < 0 else P.am
    elif kind == "orb":
        if d <= 2.8:
            return P.gl if d < 1.2 else P.g
    elif kind == "ring":
        if 1.3 <= d <= 2.9:
            return P.al if p < 0 else P.am
    elif kind == "skull":
        if d <= 2.9 and a <= ac + 1.5:
            if a - ac > -0.5 and ap in (1, 1.0) or (abs(a - ac - 0.5) < 0.6 and 0.5 < ap < 1.6):
                return P.o
            return (230, 222, 200) if p < 0 else (196, 186, 162)
    elif kind == "spike":
        if -27 <= a <= ac + 1 and ap <= (a + 27) * 0.45:
            return P.al if p < 0 else P.am
    elif kind == "tassel":
        if ac - 0.5 <= a <= ac + 1.5 and ap <= 2.2:
            return P.am
        if -28 <= a < ac - 0.5 and any(abs(p - k) <= 0.5 for k in (-2, 0, 2)):
            return P.g if (a + p) % 3 == 0 else P.al
    elif kind == "crescent":
        r = math.hypot(a - ac - 3, p)
        if 2.4 <= r <= 4 and a <= ac + 1.5:
            return P.al if p < 0 else P.am
    elif kind == "claw":
        for k in (-2.5, 0, 2.5):
            if abs(p - k * (1 + (ac - a) * 0.12)) <= 0.6 and ac - 5 <= a <= ac + 1:
                return P.al
    return None


def sword(T, P):
    blade, deco = BLADES[T["sword"]], T.get("deco", "fuller")

    def fn(a, p):
        b = blade(a)
        if b:
            c = blade_colour(P, T, a, p, *b, deco)
            if c:
                return c
        return guard_colour(P, T, a, p) or grip_colour(P, T, a, p) or pommel_colour(P, T, a, p)
    return fn


# ------------------------------------------------------------------ tool heads
def handle(P, T, a, p, a0, a1, w=1.4):
    if a0 <= a <= a1 and abs(p) <= w:
        if T.get("grip") == "spiral" and (a + p) % 7 == 0:
            return P.g
        if a < a0 + 5 and (a + p) % 3 == 0:
            return P.hd                                   # wrapped grip end
        return P.hl if p < 0 else P.hm
    return None


def metal(P, t, lit=True, edge=False, T=None, a=0, p=0):
    if edge:
        return P.g if (T and T.get("deco") in ("edge", "vein", "core")) else P.s
    if T and T.get("deco") == "stripes" and (int(a + p) // 3) % 2:
        return P.alt
    if T and T.get("deco") in ("cracks", "stars") and hsh(a // 2, p // 2, 9) > 0.8:
        return P.g
    return P.h if lit else P.m


def axe(T, P):
    kind = T.get("axe", "flared")
    A = 15

    def bit(a, p, side):
        depth = -p if side < 0 else p
        if depth < 1.5:
            return None
        D = 8.5 if kind == "hatchet" else 12
        t = (depth - 1.5) / (D - 1.5)
        if t > 1:
            return None
        if kind in ("flared", "double", "halberd", "hatchet"):
            lo, hi = A - 3 - t * t * 5.5, A + 3 + t * t * 5.5
        elif kind == "bearded":
            lo, hi = A - 3 - t * t * 9, A + 3 + t * 2
        elif kind == "cleaver":
            lo, hi = A - 4, A + 4.5
        elif kind == "moon":
            r1, r2 = math.hypot(a - A, depth - 1), math.hypot(a - A, depth - 6)
            if r1 <= 10.5 and r2 >= 6.5:
                return metal(P, t, side < 0, r1 > 9.4, T, a, p)
            return None
        else:
            return None
        if lo <= a <= hi:
            return metal(P, t, side < 0, t > 0.86, T, a, p) if (a - lo > 0.5 or t > 0.3) else P.d
        return None

    def fn(a, p):
        c = bit(a, p, -1)
        if c:
            return c
        if kind == "double":
            c = bit(a, p, 1)
            if c:
                return c
        elif 1.5 < p <= 5.5 and abs(a - A) <= 3 - (p - 1.5) * 0.7:
            return P.ad if p > 3 else P.am                 # back spike
        if kind == "halberd" and 18 <= a <= 27 and abs(p) <= 1.3 - max(0, a - 24) * 0.4:
            return P.s if p < 0 else P.h
        if abs(a - A) <= 3 and abs(p) <= 2:
            return P.al if p < 0 else P.am                 # socket
        return handle(P, T, a, p, -27, 18)
    return fn


def pickaxe(T, P):
    kind = T.get("pick", "arched")
    A = 18

    def fn(a, p):
        ap = abs(p)
        if ap <= 11.5:
            if kind in ("arched", "crystal", "winged"):
                ac = A - (ap / 11) ** 2 * 6
                if kind == "winged" and ap > 8:
                    ac -= (ap - 8) * 1.2
                w = 2.7 - ap * 0.13
                if abs(a - ac) <= w:
                    if kind == "crystal" and ap > 8:
                        return P.g if a > ac else P.gl
                    return metal(P, 0, a > ac, ap > 10.3, T, a, p)
            elif kind == "straight":
                w = 2.3 if ap < 8 else 2.3 - (ap - 8) * 0.6
                if abs(a - A) <= w:
                    return metal(P, 0, a > A, ap > 10, T, a, p)
            elif kind == "hammer":
                if p < 0 and -7.5 <= p <= -1 and A - 3.5 <= a <= A + 3.5:
                    return P.s if a > A + 2.5 else (P.b if a < A - 2.5 else (P.h if p < -4 else P.m))
                if p >= 0:
                    ac = A - (p / 11) ** 2 * 5
                    if abs(a - ac) <= 2.5 - p * 0.17:
                        return metal(P, 0, a > ac, p > 10, T, a, p)
            elif kind == "single":
                if p >= 0:
                    ac = A - (p / 11) ** 2 * 7
                    if abs(a - ac) <= 2.7 - p * 0.19:
                        return metal(P, 0, a > ac, p > 10.2, T, a, p)
                elif p > -4 and abs(a - A) <= 2:
                    return P.am
        if abs(a - A) <= 2.2 and ap <= 2.2:
            return P.al if p < 0 else P.am
        return handle(P, T, a, p, -27, A)
    return fn


def shovel(T, P):
    kind = T.get("shovel", "round")

    def fn(a, p):
        ap = abs(p)
        inside = False
        if kind == "round":
            inside = a >= 10 and ((a - 17) / 7.5) ** 2 + (p / 5) ** 2 <= 1
        elif kind == "spade":
            inside = 10 <= a <= 23 and ap <= 4.6
        elif kind == "pointed":
            inside = 10 <= a <= 26 and ap <= 4.8 * min(1, (26 - a) / 9)
        elif kind == "trowel":
            inside = 10 <= a <= 26 and ap <= 1 + 3 * math.sin(math.pi * (a - 10) / 16)
        elif kind == "scoop":
            inside = a >= 10 and ((a - 17) / 7.5) ** 2 + (p / 5.2) ** 2 <= 1
            if inside and ((a - 17) / 5.8) ** 2 + (p / 3.6) ** 2 > 1:
                return P.al if p < 0 else P.am
        if inside:
            if abs(p) <= 0.6 and a < 20:
                return P.g if T.get("deco") in ("runes", "vein", "core") else P.d
            edge = a > 21 and kind != "spade" or (kind == "spade" and a >= 22)
            return metal(P, 0, p < 0, edge, T, a, p)
        if 7 <= a < 10 and ap <= 2.4:
            return P.al if p < 0 else P.am
        return handle(P, T, a, p, -27, 9)
    return fn


def hoe(T, P):
    kind = T.get("hoe", "blade")
    A = 19

    def fn(a, p):
        if kind == "blade":
            if -9 <= p <= -1 and A - 1.4 <= a <= A + 1.6:
                return metal(P, 0, True, False, T, a, p)
            if -9.5 <= p <= -6.8 and A - 8 <= a < A - 1.4:
                return metal(P, 0, p < -8, a < A - 7, T, a, p)
        elif kind == "scythe":
            if -13 <= p <= -0.5:
                t = -p / 13
                ac = A + 1 - t * t * 13
                if abs(a - ac) <= 2.8 - t * 1.9:
                    return metal(P, 0, a > ac, t > 0.9 or a < ac - 0.8, T, a, p)
        elif kind == "sickle":
            r = math.hypot(a - (A - 3), p + 3)
            if 5.8 <= r <= 8.8 and (p < 0 or a > A - 3) and not (p > -3 and a < A - 3):
                return metal(P, 0, r > 7.5, r < 6.9, T, a, p)
        elif kind == "rake":
            if abs(p) <= 7.5 and A - 0.2 <= a <= A + 1.8:
                return metal(P, 0, True, False, T, a, p)
            if A - 5 <= a < A - 0.2 and any(abs(p - k) <= 0.6 for k in (-6.5, -3.25, 0, 3.25, 6.5)):
                return metal(P, 0, False, a < A - 4, T, a, p)
        elif kind == "claw":
            for k, ln in ((-3.2, 9), (-6.2, 7.5), (-9, 5.5)):
                t = (A + 2 - a) / ln
                if 0 <= t <= 1 and abs(p - (k - t * t * 2.5)) <= 1.1 - t * 0.5:
                    return metal(P, 0, True, t > 0.8, T, a, p)
            if A <= a <= A + 2 and -9.8 <= p <= -1:
                return P.am
        if abs(a - A) <= 2 and abs(p) <= 2:
            return P.al if p < 0 else P.am
        return handle(P, T, a, p, -27, A + 1)
    return fn


SHIFT = {"sword": 0, "axe": 4, "pickaxe": 3, "shovel": 3, "hoe": 4}
MAKERS = {"sword": sword, "axe": axe, "pickaxe": pickaxe, "shovel": shovel, "hoe": hoe}


def tool(T, name):
    P = Pal(T)
    cv = Canvas(P.o)
    cv.paint(MAKERS[name](T, P), SHIFT[name])
    return cv.image()


# ------------------------------------------------------------------ bows
def bow(T, state):
    """Bow in the same geometry as tool_designs.bow, styled per set."""
    P = Pal(T)
    tip, H, nock = BOW_STATES[state]
    style = T.get("bow", "smooth")
    tips = T.get("bow_tips", "gem")
    mat = {"metal": (P.s, P.h, P.m, P.b), "handle": (P.hl, P.hl, P.hm, P.hd),
           "accent": (P.al, P.al, P.am, P.ad)}[T.get("bow_mat", "handle")]
    cv = Canvas(P.o)

    def f(p):
        t = min(abs(p), H) / H
        if style == "angular":
            return tip + (APEX - tip) * (1 - t) ** 0.9
        if style == "recurve":
            base = tip + (APEX - tip) * (1 - t * t)
            return base + (2.5 * (t - 0.8) / 0.2 if t > 0.8 else 0)
        if style == "long":
            return tip + (APEX - tip) * (1 - t ** 1.6)
        if style == "double":
            return tip + (APEX - tip) * (1 - t * t) + 1.6 * math.sin(t * math.pi * 2)
        return tip + (APEX - tip) * (1 - t * t)

    def limb(a, p):
        ap = abs(p)
        if ap > H + 1:
            return None
        da = a - f(min(ap, H))
        if ap <= 3.2 and abs(da) <= 2.3:                      # grip
            return P.g if (ap <= 1 and abs(da) <= 1 and T.get("bow_core", True)) else (P.al if da > 0 else P.am)
        if ap >= H - 1.8 and abs(da) <= 2.1:                  # tips
            if tips == "gem":
                return P.gl if da > 0 else P.g
            if tips == "spike":
                return P.s if da > 0 else P.h
            if tips == "leaf":
                return (120, 200, 90) if da > 0 else (70, 150, 60)
            if tips == "bone":
                return (236, 228, 206) if da > 0 else (200, 190, 166)
            if tips == "feather":
                return P.al if (a + p) % 2 else P.am
            if tips == "flame":
                return P.gl if da > 0.5 else P.g
        if style == "bone":
            joint = min(abs(ap - j) for j in (8, 15))
            if joint <= 1 and abs(da) <= 2:
                return (236, 228, 206)
        if T.get("bow_studs") and ap in (9, 16) and abs(da) <= 2:
            return P.g
        if style == "branch" and ap in (10, 17) and -3.2 <= da < -1.5:
            return (90, 170, 70)                               # leaves
        w = 1.6 if style != "long" else 1.3
        if abs(da) <= w:
            return mat[0] if da > 0.6 else (mat[3] if da < -0.6 else mat[2])
        return None

    cv.paint(limb)
    string = T.get("string", (236, 230, 220))
    if nock is None:
        cv.line(tip, -H + 1, tip, H - 1, string)
    else:
        cv.line(tip, -H + 1, nock, 0, string)
        cv.line(tip, H - 1, nock, 0, string)
        head = nock + 26
        cv.line(nock, 0, head - 4, 0, P.hm)
        for a in range(nock, nock + 5):
            for p in (-3, -2, -1, 1, 2, 3):
                if (a + p) % 2 and abs(p) <= 3 - (a - nock) * 0.5:
                    cv.dot(a, p, P.al)
        for a in range(head - 6, head + 1):
            for p in range(-3, 4):
                if (a + p + N - 1) % 2 == 0 and abs(p) <= (head - a) * 0.6:
                    cv.dot(a, p, P.s if p <= 0 else P.h)
    return cv.image()


def sheet(T, scale=4):
    """All five tools + the bow in a row (for previews)."""
    imgs = [tool(T, n) for n in ("sword", "axe", "pickaxe", "shovel", "hoe")] + [bow(T, "bow")]
    out = Image.new("RGBA", (len(imgs) * 34 * scale, 34 * scale), (0, 0, 0, 0))
    for i, im in enumerate(imgs):
        out.alpha_composite(im.resize((32 * scale, 32 * scale), Image.NEAREST), (i * 34 * scale + scale, scale))
    return out


# ------------------------------------------------------------------ the legendary katana
def enderfang():
    """Enderfang: a void-black curved blade with a burning magenta edge, a
    wavy hamon, a dragon-wing tsuba and a Dragon Egg pommel with a tassel."""
    void = [(18, 10, 26), (34, 20, 48), (52, 30, 72), (76, 46, 104)]
    edge, edge_l, hamon = (230, 90, 255), (255, 200, 255), (170, 110, 230)
    gold, gold_l, gold_d = (220, 180, 120), (250, 230, 180), (150, 110, 60)
    wrap_a, wrap_b = (40, 20, 56), (120, 60, 170)
    egg, egg_dot = (24, 10, 32), (200, 80, 255)
    cv = Canvas((8, 2, 12))

    def fn(a, p):
        if -3 <= a <= 28:                                     # curved blade
            t = max(0, a) / 28
            c = -3.4 * t * t
            back, front = 1.3, 2.7 if a < 23 else 2.7 * (28 - a) / 5
            dp = p - c
            if -back <= dp <= front:
                if dp >= front - 0.9:
                    return edge_l if a % 6 == 0 else edge
                if a > 1 and abs(dp - (front - 1.9 + 0.45 * math.sin(a * 0.8))) < 0.45:
                    return hamon
                if hsh(a, dp, 31) > 0.95:
                    return edge_l                             # stars in the void
                if dp <= -back + 0.8:
                    return void[3]
                return void[2] if dp < 0.4 else void[1]
        r = math.hypot(a + 5, p)                              # round tsuba with a glowing eye
        if -6.4 <= a <= -3.6 and r <= 4.3:
            if r >= 3.1:
                return gold_l if p < 0 else gold
            return edge if r < 1.2 else (gold_d if abs(p) < 1.6 else void[0])
        if -18 <= a <= -6 and abs(p) <= 1.6:                  # diamond-wrapped grip
            return wrap_b if (a + p) % 4 == 0 or (a - p) % 4 == 0 else wrap_a
        d = math.hypot((a + 20.5) * 0.8, p)                   # dragon egg pommel
        if d <= 2.6:
            return egg_dot if hsh(a, p, 32) > 0.72 else egg
        if -27 <= a <= -22 and abs(p - 2.6 - (-22 - a) * 0.5) <= 0.6:
            return edge if a % 2 else wrap_b                  # tassel
        return None

    cv.paint(fn, 0)
    return cv.image()
