"""Crimson tool textures (32x32): pickaxe, axe, shovel, hoe, spear, bow.

Everything is drawn in "blade space": a = x - y runs along the tool from the
bottom-left (handle) to the top-right (head); p = x + y - 31 is the offset
across it (p < 0 is the upper-left, lit side). Shading is banded, never
noisy, so the textures extrude cleanly in 3D. Run: python3 tools.py
"""
import math
import os

from PIL import Image

from generate import (BASE, GLOW, GOLD, GOLD_D, GOLD_L, HI, MID, SHINE, SHROOM,
                      STEM, STEM_D, STEM_L, SWORD_OUTLINE, VEIN, WART, WART_L)

OUT = os.path.dirname(os.path.abspath(__file__))
N = 32
STRING = (244, 222, 206)
FLETCH = WART_L


def to_xy(a, p):
    return (a + p + N - 1) / 2, (p - a + N - 1) / 2


class Canvas:
    def __init__(self):
        self.cells = {}   # outlined
        self.over = {}    # drawn on top, no outline (strings, arrows)

    def paint(self, fn, shift=0):
        # shift > 0 slides the drawing toward the bottom-left
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

    def image(self):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        for (x, y), c in self.cells.items():
            img.putpixel((x, y), c + (255,))
        for y in range(N):
            for x in range(N):
                if (x, y) not in self.cells and any(
                        (x + dx, y + dy) in self.cells
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    img.putpixel((x, y), SWORD_OUTLINE + (255,))
        for (x, y), c in self.over.items():
            img.putpixel((x, y), c + (255,))
        return img


def handle(a, p, a0, a1):
    """Crimson-stem grip from a0 to a1 with a gold ring at each end and a
    shroomlight pommel below a0."""
    ap = abs(p)
    if a0 <= a <= a1 and ap <= 1.5:
        if a in (a0, a0 + 1, a1 - 1, a1):
            return GOLD_L if p < 0 else GOLD
        return STEM_D if a % 3 == 0 else (STEM_L if p < 0 else STEM)
    r = math.hypot(a - (a0 - 2.5), p)
    if a < a0 and r <= 2.9:
        return SHROOM if r <= 1.5 else GOLD
    return None


def crystal(side, edge_dist, core=False, a=0):
    """Banded crimson crystal: side<0 is the lit side, edge_dist is distance
    from the outer edge."""
    if core:
        return GLOW if a % 6 == 0 else VEIN
    if edge_dist <= 1.2:
        return SHINE if side < 0 else BASE
    return HI if side < 0 else MID


def gem(a, p, ac, pc=0):
    d = abs(a - ac) + abs(p - pc)
    if d <= 2:
        return GLOW if d == 0 else (VEIN if d == 1 or p < pc else WART)
    return None


# --- tools ----------------------------------------------------------------

def pickaxe(a, p):
    ap = abs(p)
    # crystal spike on top
    if 21.5 <= a <= 26 and ap <= (26 - a) * 0.7:
        return SHINE if p <= 0 else HI
    # collar
    if 15 <= a <= 21 and ap <= 2.5:
        return gem(a, p, 18) or (GOLD_L if a >= 20 else (GOLD_D if a <= 15 else GOLD))
    # curved head
    if ap <= 14.5:
        ac = 18 - p * p / 26
        t = 2.4 * (1 - (ap / 15.5) ** 2) + 0.8
        da = a - ac
        if abs(da) <= t:
            if da >= t - 1.1:
                return SHINE
            if da <= -t + 1.1:
                return BASE
            if abs(da) <= 0.6 and ap < 12:
                return GLOW if ap % 6 == 0 else VEIN
            return HI if da > 0 else MID
    return handle(a, p, -17, 16)


def axe(a, p):
    # gold eye around the handle
    if 14 <= a <= 22 and -3.5 <= p <= 2.5:
        return gem(a, p, 18, -1) or (GOLD_L if a >= 21 else (GOLD_D if a <= 14 else GOLD))
    # bit: wedge flaring out toward a convex cutting edge on the lit side
    d = -3 - p                       # distance out from the handle
    if d >= 0:
        dmax = 9.5 - 1.6 * ((a - 18) / 7) ** 2
        if d <= dmax and abs(a - 18) <= 3 + d * 0.45:
            if d >= dmax - 1.3:
                return SHINE
            if abs(a - 18) >= 2 + d * 0.45:
                return HI if a > 18 else BASE
            if a == 18 and d >= 2:
                return VEIN
            return HI if a > 18 else MID
    # thorn on the back
    if 15 <= a <= 21 and 2.5 < p <= 2.5 + 3 - abs(a - 18):
        return STEM_L if p < 4 else STEM
    return handle(a, p, -17, 25)


def shovel(a, p):
    ap = abs(p)
    if 12 <= a <= 15 and ap <= 2.5:
        return GOLD_L if a == 15 else (GOLD_D if a == 12 else GOLD)
    e = ((a - 21) / 8) ** 2 + (p / 5.8) ** 2
    if a >= 15 and e <= 1:
        if ap <= 1 and 16 <= a <= 26:
            return GLOW if a % 5 == 0 else VEIN
        if e >= 0.66:
            return SHINE if p < 0 or a > 26 else BASE
        return HI if p < 0 else MID
    return handle(a, p, -17, 14)


def hoe(a, p):
    # collar
    if 18 <= a <= 24 and -1.5 <= p <= 3:
        return gem(a, p, 21, 1) or (GOLD_L if a >= 23 else (GOLD_D if a <= 18 else GOLD))
    # arm reaching out to the lit side
    if 20 <= a <= 24 and -9 <= p < -1.5:
        return SHINE if a >= 23.5 else (MID if a <= 20.5 else HI)
    # hooked blade hanging down
    if -13 <= p <= -8.5 and 12 <= a <= 24 and a >= 21 - (p + 13) * 2:
        if p <= -12:
            return SHINE
        if a >= 23.5:
            return SHINE
        return VEIN if p == -10 and a < 22 else (HI if p < -10 else MID)
    # thorn spur on the back
    if 20 <= a <= 23 and 3 < p <= 3 + 3 - abs(a - 21.5) * 1.3:
        return STEM_L
    return handle(a, p, -17, 24)


def spear(a, p):
    ap = abs(p)
    # swept-back crimson-stem barbs with shroomlight tips
    if 3.5 <= ap <= 8:
        ta = 13 - (ap - 3.5) * 1.1
        if abs(a - ta) <= 1:
            return SHROOM if ap >= 7 else (STEM_L if a > ta else STEM)
    if 10 <= a <= 14 and ap <= 3:
        return gem(a, p, 12) or (GOLD_L if a == 14 else (GOLD_D if a == 10 else GOLD))
    if 14 < a <= 29:
        w = 4.4 * math.sin(math.pi * min(1.0, (a - 14) / 15 + 0.12)) ** 0.9
        if a > 20:
            w = 4.4 * (29 - a) / 9
        if ap <= w:
            if ap <= 1:
                return crystal(p, 0, core=True, a=a)
            return crystal(p, w - ap)
    # butt spike
    if -30 <= a <= -26 and ap <= (a + 30) * 0.5:
        return GOLD_L if p <= 0 else GOLD
    if -25 <= a <= 10 and ap <= 1.5:
        if a in (-25, -24, 9, 10) or a % 11 == 0:
            return GOLD_L if p < 0 else GOLD
        return STEM_D if a % 4 == 0 else (STEM_L if p < 0 else STEM)
    return None


# --- bow ------------------------------------------------------------------

BOW_STATES = {
    # name: (tip a, half-span P, nock a or None for resting)
    "bow": (-6, 24, None),
    "bow_pulling_0": (-5, 23, -9),
    "bow_pulling_1": (-4, 22, -12),
    "bow_pulling_2": (-3, 21, -15),
}
BOW_APEX = 5


def bow(state):
    tip, P, nock = BOW_STATES[state]
    cv = Canvas()

    def f(p):
        return tip + (BOW_APEX - tip) * (1 - (p / P) ** 2)

    def limb(a, p):
        ap = abs(p)
        if ap > P + 1:
            return None
        da = a - f(min(ap, P))
        if ap <= 3.5 and -2.2 <= da <= 2.2:            # gold grip + gem
            if ap <= 1 and abs(da) <= 1:
                return VEIN if da >= 0 else GLOW
            return GOLD_L if da > 0 else GOLD
        if ap >= P - 1.5 and abs(da) <= 2:              # shroomlight tips
            return SHROOM
        # thorns on the back of each limb
        for pt in (11, 17):
            if abs(ap - pt) <= 2 and 1.6 < da <= 1.6 + 2 - abs(ap - pt):
                return STEM_L
        if abs(da) <= 1.6:
            if da > 0.6:
                return STEM_L
            if da < -0.6:
                return STEM_D
            return STEM
        return None

    cv.paint(limb)
    if nock is None:
        cv.line(tip, -P + 1, tip, P - 1, STRING)
    else:
        cv.line(tip, -P + 1, nock, 0, STRING)
        cv.line(tip, P - 1, nock, 0, STRING)
        # crimson arrow
        head = nock + 26
        cv.line(nock, 0, head - 4, 0, STEM_L)
        for a in range(nock, nock + 5):
            for p in (-3, -2, -1, 1, 2, 3):
                if (a + p) % 2 and abs(p) <= 3 - (a - nock) * 0.5:
                    x, y = to_xy(a, p)
                    cv.over[int(x), int(y)] = FLETCH
        for a in range(head - 6, head + 1):
            for p in range(-3, 4):
                if (a + p + N - 1) % 2 == 0 and abs(p) <= (head - a) * 0.6:
                    x, y = to_xy(a, p)
                    if 0 <= x < N and 0 <= y < N:
                        cv.over[int(x), int(y)] = SHINE if p <= 0 else HI
    return cv.image()


# name: (draw fn, shift toward bottom-left so the head clears the corner)
TOOLS = {"pickaxe": (pickaxe, 3), "axe": (axe, 7), "shovel": (shovel, 4), "hoe": (hoe, 8), "spear": (spear, 0)}


def main():
    os.makedirs(f"{OUT}/items", exist_ok=True)
    for name, (fn, shift) in TOOLS.items():
        cv = Canvas()
        cv.paint(fn, shift)
        cv.image().save(f"{OUT}/items/crimson_{name}.png")
    for state in BOW_STATES:
        bow(state).save(f"{OUT}/items/crimson_{state}.png")


if __name__ == "__main__":
    main()
