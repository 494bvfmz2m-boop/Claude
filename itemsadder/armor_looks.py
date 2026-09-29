"""Modular armor painter: every set picks its own chest, shoulder, arm, belt,
leg and boot designs, so sets differ in shape and construction, not just in
colour. Also builds the inventory icons straight from the painted textures.

Painting works in two steps. Designs lay down cells of (material, light level,
piece): materials are M (main metal/surface), S (secondary, from s1), C (second
cloth, from s2), T (trim), U (second trim, from t2), A (accent), G (glow) and O (outline); levels run
0 (outline dark) .. 3 (base) .. 5 (highlight). A shading pass then gives every
piece a lit top rim and a shadowed underside, darkens edges next to skin and
rounds the torso, and finally each cell is coloured from its material's ramp
(shadows shift cool, highlights warm). Designs therefore only describe
construction: plates, lames, straps, rivets, seams.

Faces are addressed as (face rect, u, v): u across, v down (0 = top).
"""
from PIL import Image

from armor_engine import ARM, BODY, HEAD, LEG, PATTERNS, h

SIDES = ("front", "back", "right", "left")

# ============================================================ colour ramps
WARM, COOL = (255, 246, 220), (16, 10, 36)


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def tone(c, k):
    """k > 0 lightens towards a warm white, k < 0 darkens towards a cool dark."""
    return mix(c, WARM, k) if k > 0 else mix(c, COOL, -k)


def ramp_of(c):
    return [tone(c, -0.62), tone(c, -0.42), tone(c, -0.2), c, tone(c, 0.26), tone(c, 0.5)]


def ramps(P):
    return {
        "M": [P["o"], P["d"], P["b"], P["m"], P["l"], tone(P["l"], 0.32)],
        "S": ramp_of(P["s1"]),
        "C": ramp_of(P["s2"]),
        "T": ramp_of(P["t"]),
        "U": ramp_of(P["t2"]),
        "A": ramp_of(P["a"]),
        "G": ramp_of(P["g"]),
        "O": [P["o"]] * 6,
    }


# palette letters (emblems, stamps, old patterns) -> (material, level)
KEYMAP = {"o": ("O", 0), "d": ("M", 1), "b": ("M", 2), "m": ("M", 3), "l": ("M", 4), "t": ("T", 3),
          "t2": ("U", 3), "a": ("A", 3), "g": ("G", 3), "s1": ("S", 3), "s2": ("C", 3)}


# ============================================================ cells
class Layer:
    def __init__(self):
        self.c = {}           # (x, y) -> [mat, level, piece, fixed]


_PIECE = [0]


def new_piece():
    _PIECE[0] += 1
    return _PIECE[0]


def fill(L, rect, fn, piece, rows=None, cols=None, where=None):
    """fn(x, y, u, v, w, hh) -> (mat, level) or None (leave as is)."""
    x0, y0, w, hh = rect
    for v in range(hh) if rows is None else rows:
        for u in range(w) if cols is None else cols:
            if not (0 <= u < w and 0 <= v < hh) or (where and not where(u, v, w, hh)):
                continue
            r = fn(x0 + u, y0 + v, u, v, w, hh)
            if r is not None:
                L.c[(x0 + u, y0 + v)] = [r[0], r[1], piece, False]


def px(L, rect, u, v, mat, lv, fixed=True, piece=None):
    """A single detail pixel (rivet, stitch, highlight): keeps the piece underneath."""
    x0, y0, w, hh = rect
    if not (0 <= u < w and 0 <= v < hh):
        return
    old = L.c.get((x0 + u, y0 + v))
    pc = piece if piece is not None else (old[2] if old else new_piece())
    L.c[(x0 + u, y0 + v)] = [mat, lv, pc, fixed]


def erase(L, rect, cells):
    x0, y0, w, hh = rect
    for u, v in cells:
        if 0 <= u < w and 0 <= v < hh:
            L.c.pop((x0 + u, y0 + v), None)


def solid(mat, lv=3):
    return lambda *a: (mat, lv)


# ============================================================ surfaces
# Each returns a level (on the surface's own material) or a (mat, level) pair.
# They use texture x (continuous around a limb: right, front, left, back sit side by side).
GLYPHS = [[".g.", "ggg", ".g."], ["g.g", ".g.", "g.g"], ["gg.", "g..", "ggg"], [".gg", "g.g", "gg."],
          ["g..", "ggg", "..g"]]


def _plate(x, y, u, v, w, hh):
    return 3


def _cloth(x, y, u, v, w, hh):
    if x % 4 == 1 and (y // 3 + x // 4) % 3 != 0:
        return 2                                                  # soft vertical folds
    return 4 if x % 4 == 2 and y % 5 == 1 else 3


def _leather(x, y, u, v, w, hh):
    if (x * 7 + y * 3) % 19 == 0:
        return 2                                                  # the odd scuff in the hide
    return 3


def _scale(x, y, u, v, w, hh):
    c = (x + (y // 3) % 2 * 2) % 4
    return ((3, 4, 4, 3), (3, 3, 3, 3), (2, 3, 3, 2))[y % 3][c]


def _chain(x, y, u, v, w, hh):
    if y % 2 == 0:
        return 4 if x % 2 == 0 else 3
    return 3 if x % 2 else 2


def _fur(x, y, u, v, w, hh):
    c, r = x % 2, (y + (x // 2) % 2) % 3                          # tufts two wide, staggered
    return ((4, 3), (3, 3), (3, 2))[r][c]


def _feather(x, y, u, v, w, hh):
    c = (x + (y // 3) % 2 * 2) % 4
    return ((1, 4, 5, 2), (2, 4, 4, 2), (1, 2, 3, 1))[y % 3][c]


def _quilt(x, y, u, v, w, hh):
    if (x + y) % 6 == 0 or (x - y) % 6 == 0:
        return 2
    return 4 if (x + y) % 6 == 3 and (x - y) % 6 == 3 else 3


def _lamellar(x, y, u, v, w, hh):
    r = y % 3
    if r == 2:
        return ("U", 3) if x % 4 == 1 else 2                      # a row of lacing between the plate rows
    return 4 if r == 0 else 3


def _stripes(x, y, u, v, w, hh):
    r = y % 4
    return (4, 3, ("T", 3), ("T", 2))[r]


def _brass(x, y, u, v, w, hh):
    if u % 3 == 1 and v % 4 == 1:
        return ("T", 5)
    return 3


def _crystal(x, y, u, v, w, hh):
    k = ((x + y) // 4 + (x - y + 40) // 5) % 3
    if k == 1 and (x * 3 + y) % 11 == 0:
        return ("G", 4)                                           # a glint on the lit facet
    return (3, 4, 2)[k]


def _bone(x, y, u, v, w, hh):
    if y % 3 == 0:
        return 4
    return 2 if x % 4 == 0 and y % 3 == 1 else 3


def _rune(x, y, u, v, w, hh):
    bx, by = x // 4, y // 4
    if (bx + by) % 2 == 0:
        g = GLYPHS[int(h(bx, by, 9) * len(GLYPHS))]
        i, j = x % 4, y % 4
        if i < 3 and j < 3 and g[j][i] == "g":
            return ("G", 3)
    return 2 if (x + y) % 5 == 0 else 3


def _cracks(x, y, k):
    import math
    return abs(math.sin(x * 0.55 + y * 0.3 + k) + math.sin(y * 0.42 - x * 0.2 + k * 2))


def _flame(x, y, u, v, w, hh):
    d = _cracks(x, y, 0.0)
    if d < 0.2:
        return ("G", 4)                                           # molten seam
    if d < 0.42:
        return ("M", 4)                                           # heated rim of the crack
    return 2                                                      # cooled basalt


def _wave(x, y, u, v, w, hh):
    import math
    return (4, 3, 2, 3)[(y + round(math.sin(x * 0.9) * 1.3)) % 4]


def _stars(x, y, u, v, w, hh):
    import math
    if (x * 7 + y * 13) % 29 == 0:
        return ("G", 5)
    if (x * 11 + y * 5) % 37 == 0:
        return ("G", 3)
    return 3 if math.sin(x * 0.45 + y * 0.3) + math.sin(y * 0.5 - x * 0.2) > 1.1 else 2   # soft nebula wisps


def _circuit(x, y, u, v, w, hh):
    if y % 6 == 2 and (x // 5) % 3 != 2:
        return ("G", 4) if x % 5 == 0 else ("A", 3)               # traces with glowing nodes
    if x % 5 == 0 and y % 6 in (3, 4, 5) and (x // 5 + y // 6) % 2 == 0:
        return ("A", 3)
    return 2


def _obsidian(x, y, u, v, w, hh):
    d = _cracks(x, y, 2.3)
    if d < 0.16:
        return ("G", 3)
    if d < 0.36:
        return 3
    return 2


def _marble(x, y, u, v, w, hh):
    import math
    if abs(math.sin((x + y * 0.6) * 0.9 + h(x // 3, y // 3, 15) * 3)) < 0.15:
        return ("T", 2)
    return 4


def _patina(x, y, u, v, w, hh):
    r = h(x // 3, y // 3, 17)
    if r > 0.62:
        return ("S", 4) if h(x, y, 18) > 0.5 else ("S", 3)       # verdigris patches
    return 3


def _spots(x, y, u, v, w, hh):
    """Rosettes: a dark ring around a warm centre, set on an offset grid."""
    cx, cy = x % 5, (y + (x // 5) % 2 * 2) % 5
    r = abs(cx - 2) + abs(cy - 2)
    if r == 2 and (cx, cy) not in ((0, 2), (4, 2)):
        return 1
    return 2 if r < 2 else 3


def _candy(x, y, u, v, w, hh):
    return ("A", 4) if ((x + y) // 2) % 2 else ("T", 4)


def _petal(x, y, u, v, w, hh):
    k = (x + (y // 3) % 2 * 2) % 4
    if y % 3 == 0 and k == 1:
        return ("A", 4)
    return (3, 4, 3, 2)[k] if y % 3 else 3


def _slime(x, y, u, v, w, hh):
    if (x * 5 + y * 3) % 17 == 0:
        return 5
    return 4 if (x + y * 2) % 7 == 0 else 3


def _hex(x, y, u, v, w, hh):
    r, off = y % 3, (y // 3) % 2 * 2
    if (r == 0 and (x + off) % 4 in (0, 1)) or (r != 0 and (x + off) % 4 == 3):
        return 2
    return 4 if r == 1 and (x + off) % 4 == 0 else 3


def _bark(x, y, u, v, w, hh):
    if x % 4 == 0 and (y + x) % 5 != 0:
        return 2                                                  # deep grain, broken here and there
    return 4 if x % 4 == 1 and y % 4 == 0 else 3


def _nebula(x, y, u, v, w, hh):
    import math
    if (x * 7 + y * 13) % 29 == 0:
        return ("G", 5)                                           # stars
    if (x * 11 + y * 5) % 41 == 0:
        return ("M", 5)
    m = math.sin(x * 0.35 + y * 0.22) + math.sin(y * 0.3 - x * 0.18 + 1.3)
    b = math.sin(x * 0.28 - y * 0.33 + 2.1) + math.sin(x * 0.4 + y * 0.25 + 0.4)
    if m > 1.3:
        return ("S", 3 if m < 1.7 else 4)                         # magenta cloud, brighter core
    if b > 1.3:
        return ("C", 3 if b < 1.7 else 4)                         # blue cloud
    return 2 if m > 0.5 or b > 0.5 else 1


SURFACES = {"nebula": _nebula, "plate": _plate, "cloth": _cloth, "leather": _leather, "scale": _scale, "chain": _chain, "fur": _fur,
            "feather": _feather, "quilt": _quilt, "lamellar": _lamellar, "stripes": _stripes, "brass": _brass,
            "crystal": _crystal, "bone": _bone, "rune": _rune, "flame": _flame, "wave": _wave, "stars": _stars,
            "circuit": _circuit, "obsidian": _obsidian, "marble": _marble, "patina": _patina, "spots": _spots,
            "candy": _candy, "petal": _petal, "slime": _slime, "hex": _hex, "bark": _bark}


def surface(name, mat, P):
    """A surface fn yielding (mat, level). Unknown names fall back to the old colour pattern."""
    fn = SURFACES.get(name)
    if fn is None:
        old = PATTERNS[name]
        inv = {P[k]: KEYMAP[k] for k in KEYMAP}

        def fb(x, y, u, v, w, hh):
            c = old(P, u, v, w, hh, x, y)
            return inv.get(c, (mat, 3))
        return fb

    def f(x, y, u, v, w, hh):
        r = fn(x, y, u, v, w, hh)
        return r if isinstance(r, tuple) else (mat, r)
    return f


# ============================================================ context
class Ctx:
    def __init__(self, S):
        self.S, self.P, self.L = S, S["pal"], S["look"]
        self.L1, self.L2 = Layer(), Layer()
        main = self.L.get("main") or (S["pattern"], "M")
        sec = self.L.get("sec") or (S.get("secondary", "cloth"), "S")
        self.M = surface(main[0], main[1], self.P)
        self.Sc = surface(sec[0], sec[1], self.P)
        self.trim_kind = self.L.get("trim", "line")
        self._pc = {}

    def pc(self, name):
        """A named piece, shared by every side (so a band reads as one plate around the limb)."""
        if name not in self._pc:
            self._pc[name] = new_piece()
        return self._pc[name]

    def surf(self, name, mat):
        return surface(name, mat, self.P)

    def trim_fn(self):
        kind = self.trim_kind

        def f(x, y, u, v, w, hh):
            if kind == "rope":
                return ("T", 4 if (x + y) % 2 else 2)
            if kind == "zigzag":
                return ("T", 4) if (x + y) % 3 == 0 else ("T", 2)
            if kind == "studs":
                return ("T", 5) if x % 2 == 0 else ("M", 1)
            if kind == "dots":
                return ("A", 4) if x % 3 == 1 else ("T", 3)
            if kind == "checker":
                return ("T", 4) if (x + y) % 2 else ("O", 0)
            if kind == "gem":
                return ("G", 4) if x % 4 == 1 else ("T", 3)
            if kind == "segment":
                return ("T", 1) if x % 4 == 3 else ("T", 3)
            if kind == "fur":
                return ("C", _fur(x, y, u, v, w, hh))
            return ("T", 3)
        return f

    def trim(self, L, rect, rows, piece=None):
        fill(L, rect, self.trim_fn(), piece or new_piece(), rows=rows)

    def stamp(self, L, rect, art, dy=0, dx=0):
        for j, line in enumerate(art):
            for i, ch in enumerate(line):
                if ch != ".":
                    key = {"t2": "t2"}.get(ch, ch)
                    mat, lv = KEYMAP.get(key, ("M", 3))
                    px(L, rect, dx + i, dy + j, mat, lv)


def around(fn):
    """Run fn(k) for every side of a limb or the torso."""
    for k in SIDES:
        fn(k)


# ============================================================ chests (layer 1 body)
def ch_cuirass(c):
    L, plate, plack = c.L1, new_piece(), new_piece()
    lames = [new_piece() for _ in range(3)]
    collar = new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.M, plate, rows=range(0, 9))
        c.trim(L, BODY[k], [0], collar)
        for i, v in enumerate((9, 10, 11)):
            fill(L, BODY[k], c.M, lames[i], rows=[v])
    # pointed plackart over the belly
    fill(L, BODY["front"], c.M, plack, rows=range(5, 9), where=lambda u, v, w, hh: abs(u - 3.5) <= (v - 3.2) * 1.3)
    for v in range(1, 9):                                          # the medial ridge
        px(L, BODY["front"], 3, v, "M", 5)
        px(L, BODY["front"], 4, v, "M", 4 if v < 5 else 3)
        px(L, BODY["back"], 3, v, "M", 2)                          # backplate seam
        px(L, BODY["back"], 4, v, "M", 4)
    for u, v in ((0, 1), (7, 1), (1, 9), (6, 9)):
        px(L, BODY["front"], u, v, "T", 5)
    for k in ("right", "left"):                                    # side straps with buckles
        for v in range(2, 8):
            px(L, BODY[k], 1, v, "S", 2)
        px(L, BODY[k], 1, 4, "T", 5)
        px(L, BODY[k], 2, 4, "T", 3)
    return True


def ch_scale(c):
    L, gorget, body, belt, hem = c.L1, new_piece(), new_piece(), new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.surf("scale", "M"), body, rows=range(2, 10))
        fill(L, BODY[k], c.M if c.S["pattern"] != "scale" else solid("M"), gorget, rows=[0, 1])
        c.trim(L, BODY[k], [0], gorget)
        fill(L, BODY[k], solid("T", 3), belt, rows=[10])
        fill(L, BODY[k], solid("M", 3), hem, rows=[11])
    px(L, BODY["front"], 3, 10, "T", 5)
    px(L, BODY["front"], 4, 10, "T", 5)
    for u in (2, 3, 4, 5):                                         # V-shaped gorget point
        px(L, BODY["front"], u, 2, "M", 3, fixed=False, piece=gorget)
    px(L, BODY["front"], 3, 3, "M", 3, fixed=False, piece=gorget)
    px(L, BODY["front"], 4, 3, "M", 3, fixed=False, piece=gorget)
    return True


def ch_brigandine(c):
    L, body, collar, hem = c.L1, new_piece(), new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.Sc, body, rows=range(1, 11))
        fill(L, BODY[k], solid("M", 3), collar, rows=[0])
        c.trim(L, BODY[k], [11], hem)
        for v in (2, 5, 8):                                        # rows of rivet heads holding the hidden plates
            for u in range(BODY[k][2]):
                if (BODY[k][0] + u + v // 3) % 3 == 0:
                    px(L, BODY[k], u, v, "T", 5)
                    px(L, BODY[k], u, v + 1, "S", 2)
    for v in range(0, 4):                                          # shoulder straps
        for u in (1, 6):
            px(L, BODY["front"], u, v, "C", 2)
            px(L, BODY["back"], u, v, "C", 2)
    px(L, BODY["front"], 1, 3, "T", 4)
    px(L, BODY["front"], 6, 3, "T", 4)
    return False


def ch_robe(c):
    L, robe, mantle, stole = c.L1, new_piece(), new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.Sc, robe)
        fill(L, BODY[k], c.M, mantle, rows=[0, 1])
        fill(L, BODY[k], c.M, mantle, rows=[2], where=lambda u, v, w, hh: u % 2 == 0)   # scalloped mantle edge
    fill(L, BODY["front"], solid("A", 3), stole, rows=range(2, 12), cols=(3, 4))
    for v in range(2, 12):
        px(L, BODY["front"], 2, v, "T", 3)
        px(L, BODY["front"], 5, v, "T", 3)
    px(L, BODY["front"], 3, 2, "T", 5)
    px(L, BODY["front"], 4, 2, "T", 5)
    c.trim(L, BODY["front"], [11])
    for u in range(2, 6):                                          # hood folded on the back
        for v in range(0, 3):
            px(L, BODY["back"], u, v, "S", 2 if v < 2 else 1)
    return False


def ch_coat(c):
    L, coat, shirt, belt, tails = c.L1, new_piece(), new_piece(), new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.M, coat, rows=range(0, 8))
        fill(L, BODY[k], solid("O", 0), belt, rows=[8])
        fill(L, BODY[k], c.M, tails, rows=range(9, 12))
    fill(L, BODY["front"], lambda x, y, u, v, w, hh: ("C", 5 if v % 2 == 0 else 4), shirt, rows=range(0, 8), cols=(3, 4))
    for u, v in ((2, 0), (2, 1), (2, 2), (1, 0), (5, 0), (5, 1), (5, 2), (6, 0)):   # lapels
        px(L, BODY["front"], u, v, "T", 3 if v else 4)
    for v in (3, 5, 7):
        px(L, BODY["front"], 2, v, "T", 5)
        px(L, BODY["front"], 5, v, "T", 5)
    px(L, BODY["front"], 3, 8, "T", 5)
    px(L, BODY["front"], 4, 8, "T", 4)
    for u in (0, 1, 6, 7):                                         # pocket flaps
        px(L, BODY["front"], u, 9, "T", 2)
    for v in range(9, 12):                                         # tails split at the back
        px(L, BODY["back"], 3, v, "O", 0)
        px(L, BODY["back"], 4, v, "O", 0)
    return False


def ch_ribcage(c):
    L, base = c.L1, new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.Sc, base)
        fill(L, BODY[k], solid("S", 1), base, rows=[11])
    ribs = new_piece()
    for v in range(0, 10):                                         # sternum
        px(L, BODY["front"], 3, v, "A", 4, piece=ribs)
        px(L, BODY["front"], 4, v, "A", 3, piece=ribs)
    for i, v in enumerate((1, 3, 5, 7)):
        for u in (0, 1, 2, 5, 6, 7):
            vv = v + (1 if u in (0, 7) else 0)
            px(L, BODY["front"], u, vv, "A", 4)
            px(L, BODY["front"], u, vv + 1, "S", 1)
        for k in ("right", "left"):
            for u in range(4):
                px(L, BODY[k], u, v + 1, "A", 3)
    for v in range(0, 11):                                         # spine
        px(L, BODY["back"], 3, v, "A", 4 if v % 2 else 2)
        px(L, BODY["back"], 4, v, "A", 3 if v % 2 else 2)
    for v in (2, 5, 8):
        for u in (1, 2, 5, 6):
            px(L, BODY["back"], u, v, "A", 3)
    return False


def ch_crystal(c):
    L, plate, hem = c.L1, new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.surf("crystal", "M"), plate, rows=range(0, 10))
        fill(L, BODY[k], c.M if c.S["pattern"] != "crystal" else solid("M"), hem, rows=[10, 11])
        c.trim(L, BODY[k], [10], hem)
    gem = new_piece()
    for v in range(12):
        for u in range(8):
            d = abs(u - 3.5) + abs(v - 5) * 0.8
            if d <= 2.6:
                lv = 5 if d < 0.9 else 4 if d < 1.7 else 3
                px(L, BODY["front"], u, v, "G", lv, piece=gem)
            elif d <= 3.3:
                px(L, BODY["front"], u, v, "T", 3 if u < 4 else 2, piece=gem)
    for u, v in ((0, 1), (0, 0), (1, 0), (7, 1), (7, 0), (6, 0)):  # shards at the collar bones
        px(L, BODY["front"], u, v, "A", 5 if v == 0 else 3)
    return False


def ch_tabard(c):
    L, mail, tabard, belt = c.L1, new_piece(), new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.surf("chain", "M"), mail)
    for k in ("front", "back"):
        fill(L, BODY[k], c.Sc, tabard, cols=range(1, 7))
        for v in range(12):
            px(L, BODY[k], 1, v, "T", 3)
            px(L, BODY[k], 6, v, "T", 3)
        c.trim(L, BODY[k], [11], tabard)
    for k in SIDES:
        fill(L, BODY[k], solid("C", 2), belt, rows=[8])
    px(L, BODY["front"], 3, 8, "T", 5)
    px(L, BODY["front"], 4, 8, "T", 4)
    return True


def ch_quilted(c):
    L, body, collar, skirt = c.L1, new_piece(), new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.surf("quilt", "S"), body, rows=range(2, 10))
        fill(L, BODY[k], c.M, collar, rows=[0, 1])
        fill(L, BODY[k], c.Sc, skirt, rows=[10, 11])
        c.trim(L, BODY[k], [10], skirt)
    for v in range(2, 10):                                         # front lacing
        px(L, BODY["front"], 3 + v % 2, v, "C", 4)
        px(L, BODY["front"], 4 - v % 2, v, "S", 1)
    return False


def ch_organic(c):
    L, body = c.L1, new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.M, body)
        c.trim(L, BODY[k], [11], body)
    for k, off in (("front", 0), ("back", 2), ("right", 1), ("left", 3)):
        w = BODY[k][2]
        for v in range(12):                                        # a vine winding up
            u = (1 + off + (v // 2) % 3) % w if w == 4 else 2 + ((v + off) // 2) % 4
            px(L, BODY[k], u, v, "S", 3)
            if v % 3 == 1:
                px(L, BODY[k], u + 1, v, "S", 5)                   # leaves
                px(L, BODY[k], u + 1, v - 1, "S", 4)
            if v % 5 == 3 and k == "front":
                px(L, BODY[k], u - 1, v, "A", 5)                   # flowers
    return True


def ch_mech(c):
    L = c.L1
    top, mid, low = new_piece(), new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.M, top, rows=range(0, 4))
        fill(L, BODY[k], c.M, mid, rows=range(4, 9))
        fill(L, BODY[k], c.M, low, rows=range(9, 12))
        for v in range(12):
            px(L, BODY[k], 0, v, "M", 1)
    core = new_piece()
    for u in range(2, 6):
        for v in range(4, 8):
            edge = u in (2, 5) or v in (4, 7)
            px(L, BODY["front"], u, v, "T", 4 if (edge and (u < 4 or v == 4)) else 2) if edge else \
                px(L, BODY["front"], u, v, "G", 5 if (u, v) == (3, 5) else 4 if v == 5 else 3, piece=core)
    for u, v in ((0, 1), (7, 1), (0, 10), (7, 10), (3, 1), (4, 1)):
        px(L, BODY["front"], u, v, "T", 5)
    for u in (1, 6):                                               # status lights
        px(L, BODY["front"], u, 2, "G", 4)
    for v in (9, 10):
        for u in (1, 3, 5):
            px(L, BODY["back"], u, v, "O", 0)                      # vents
            px(L, BODY["back"], u + 1, v, "M", 4)
    for k in ("right", "left"):                                    # side pistons
        for v in range(4, 9):
            px(L, BODY[k], 2, v, "T", 4 if v % 2 else 2)
    return False


def ch_uniform(c):
    L, jacket, belt, skirt, collar = c.L1, new_piece(), new_piece(), new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.M, jacket, rows=range(0, 9))
        c.trim(L, BODY[k], [0], collar)
        fill(L, BODY[k], solid("O", 0), belt, rows=[9])
        fill(L, BODY[k], c.M, skirt, rows=[10, 11])
    for v in (2, 4, 6, 8):                                         # double row of buttons
        px(L, BODY["front"], 2, v, "T", 5)
        px(L, BODY["front"], 5, v, "T", 5)
    sash = new_piece()
    for v in range(1, 10):                                         # sash from the right shoulder
        u = round(v * 0.75)
        px(L, BODY["front"], u, v, "A", 4, piece=sash)
        px(L, BODY["front"], u + 1, v, "A", 2, piece=sash)
    px(L, BODY["front"], 3, 9, "T", 5)
    px(L, BODY["front"], 4, 9, "T", 4)
    for k in ("right", "left"):
        px(L, BODY[k], 1, 1, "T", 4)
        px(L, BODY[k], 2, 1, "T", 4)
    return False


def ch_wraps(c):
    L = c.L1
    for k in SIDES:
        x0 = BODY[k][0]
        for v in range(11):
            for u in range(BODY[k][2]):
                band = (x0 + u + v) // 4
                pc = 1000 + band                                   # each strip is its own piece
                d = (x0 + u + v) % 4
                mat = "M" if band % 2 else "S"
                lv = (4, 3, 3, 2)[d]
                L.c[(x0 + u, BODY[k][1] + v)] = [mat, lv, pc, True]
        fill(L, BODY[k], solid("C", 2), new_piece(), rows=[11])
    return False


def ch_fur_vest(c):
    L, vest, fur = c.L1, new_piece(), new_piece()
    furf = c.surf("fur", "C")
    for k in SIDES:
        fill(L, BODY[k], c.M, vest)
        fill(L, BODY[k], furf, fur, rows=[0, 1])
    fill(L, BODY["front"], furf, fur, cols=(0, 1, 6, 7), rows=range(2, 11))
    fill(L, BODY["back"], furf, fur, rows=[2])
    for v in range(2, 11):                                         # laced front
        px(L, BODY["front"], 3 + v % 2, v, "T", 3)
        px(L, BODY["front"], 4 - v % 2, v, "S", 1)
    for v in (4, 8):
        px(L, BODY["front"], 2, v, "T", 5)
        px(L, BODY["front"], 5, v, "T", 5)
    c.trim(L, BODY["back"], [11])
    return False


def ch_lamellar(c):
    L, body, collar, hem = c.L1, new_piece(), new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.surf("lamellar", "M"), body, rows=range(1, 11))
        fill(L, BODY[k], solid("T", 3), collar, rows=[0])
        fill(L, BODY[k], solid("T", 2), hem, rows=[11])
    for v in range(1, 11):                                         # braided cords down the front
        px(L, BODY["front"], 1, v, "A", 4 if v % 2 else 2)
        px(L, BODY["front"], 6, v, "A", 4 if v % 2 else 2)
    return True


def ch_bandolier(c):
    L, jacket = c.L1, new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.Sc, jacket)
        fill(L, BODY[k], solid("S", 1), jacket, rows=[11])
    straps = new_piece()
    for k in ("front", "back"):
        for v in range(12):
            for u in range(8):
                if abs(u - v * 0.65) < 0.8 or abs((7 - u) - v * 0.65) < 0.8:
                    lv = ("T", 5) if (u + v) % 2 == 0 else ("C", 1)
                    px(L, BODY[k], u, v, lv[0], lv[1], piece=straps)
    for u0 in (1, 5):                                              # pouches at the hips
        for u in (u0, u0 + 1):
            px(L, BODY["front"], u, 9, "C", 4)
            px(L, BODY["front"], u, 10, "C", 3)
    return False


def ch_chevron(c):
    L, body, hem = c.L1, new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.M, body, rows=range(0, 11))
        fill(L, BODY[k], solid("M", 2), hem, rows=[11])
        c.trim(L, BODY[k], [0], body)
    for k in ("front", "back"):
        for v in range(1, 11):
            for u in range(8):
                r = (v - abs(u - 3.5) * 0.9) % 3.5
                if r < 0.9:
                    px(L, BODY[k], u, v, "T", 4)
                elif r < 1.8:
                    px(L, BODY[k], u, v, "T", 2)
    return False


def ch_studded(c):
    L, body = c.L1, new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.surf("leather", "S"), body)
        c.trim(L, BODY[k], [0, 11])
        for v in range(2, 10, 3):
            for u in range(BODY[k][2]):
                if (BODY[k][0] + u + v // 3) % 3 == 0:
                    px(L, BODY[k], u, v, "M", 5)
    for v in range(1, 11):
        px(L, BODY["front"], 3, v, "O", 0)
        px(L, BODY["front"], 4, v, "O", 0)
        if v % 2:
            px(L, BODY["front"], 3, v, "T", 3)
        else:
            px(L, BODY["front"], 4, v, "T", 3)
    return False


def ch_cloak(c):
    L, cloak, plate = c.L1, new_piece(), new_piece()
    for k in SIDES:
        fill(L, BODY[k], c.Sc, cloak)
    fill(L, BODY["front"], c.M, plate, cols=range(2, 6), rows=range(2, 12))
    for v in range(12):                                            # heavy folds in the back
        px(L, BODY["back"], 2, v, "S", 1 if v % 4 else 2)
        px(L, BODY["back"], 5, v, "S", 1 if v % 4 != 2 else 2)
        px(L, BODY["back"], 3, v, "S", 4)
    for u in range(1, 7):                                          # clasp chain across the chest
        px(L, BODY["front"], u, 1, "T", 4 if u % 2 else 2)
    px(L, BODY["front"], 1, 1, "T", 5)
    px(L, BODY["front"], 6, 1, "T", 5)
    c.trim(L, BODY["back"], [11])
    return False


def ch_core(c):
    L, plate, lames = c.L1, new_piece(), [new_piece(), new_piece()]
    for k in SIDES:
        fill(L, BODY[k], c.M, plate, rows=range(0, 10))
        fill(L, BODY[k], c.M, lames[0], rows=[10])
        fill(L, BODY[k], c.M, lames[1], rows=[11])
        c.trim(L, BODY[k], [11], lames[1])
    for v in range(10):                                            # energy lines to the shoulders
        for u in range(8):
            if abs(abs(u - 3.5) - abs(v - 4.5) * 0.8) < 0.5 and not (2 <= u <= 5 and 3 <= v <= 6):
                px(L, BODY["front"], u, v, "G", 2)
    core = new_piece()
    for u in range(2, 6):
        for v in range(3, 7):
            edge = u in (2, 5) or v in (3, 6)
            if edge:
                px(L, BODY["front"], u, v, "T", 4 if (u == 2 or v == 3) else 2, piece=core)
            else:
                px(L, BODY["front"], u, v, "G", 5 if (u, v) == (3, 4) else 4, piece=core)
    return False


def ch_segmented(c):
    L = c.L1
    lames = [new_piece() for _ in range(6)]
    for k in SIDES:
        for i in range(6):
            fill(L, BODY[k], c.M, lames[i], rows=[2 * i, 2 * i + 1])
        for i in range(6):
            px(L, BODY[k], 0, 2 * i, "T", 5)
            px(L, BODY[k], BODY[k][2] - 1, 2 * i, "T", 4)
    for v in range(12):
        px(L, BODY["front"], 3, v, "A", 4 if v % 2 == 0 else 2)
        px(L, BODY["front"], 4, v, "A", 3 if v % 2 == 0 else 1)
    return False


def ch_patchwork(c):
    L = c.L1
    fns = [c.M, c.Sc, c.surf("leather", "C"), c.surf("quilt", "S")]
    for i, k in enumerate(SIDES):
        w = BODY[k][2]
        for q in range(4):
            du, dv = q % 2, q // 2
            fill(L, BODY[k], fns[(i + q) % 4], new_piece(),
                  cols=range(du * (w // 2), (du + 1) * (w // 2)), rows=range(dv * 6, (dv + 1) * 6))
        for v in range(12):                                        # stitched seams
            if v % 2 == 0:
                px(L, BODY[k], w // 2, v, "T", 4)
        for u in range(w):
            if u % 2:
                px(L, BODY[k], u, 6, "T", 4)
    return False


CHESTS = {"chevron": ch_chevron, "studded": ch_studded, "cloak": ch_cloak, "core": ch_core,
          "segmented": ch_segmented, "patchwork": ch_patchwork, "cuirass": ch_cuirass, "scale": ch_scale,
          "brigandine": ch_brigandine, "robe": ch_robe, "coat": ch_coat, "ribcage": ch_ribcage,
          "crystal": ch_crystal, "tabard": ch_tabard, "quilted": ch_quilted, "organic": ch_organic,
          "mech": ch_mech, "uniform": ch_uniform, "wraps": ch_wraps, "fur_vest": ch_fur_vest,
          "lamellar": ch_lamellar, "bandolier": ch_bandolier}


# ============================================================ shoulders (arm rows 0-3 and the arm top)
def _cap_top(c, k_mat=None):
    fill(c.L1, ARM["top"], k_mat or c.M, new_piece())


def sh_round(c, k):
    L = c.L1
    fill(L, ARM[k], c.M, c.pc("sh_cap"), rows=[0, 1])
    fill(L, ARM[k], c.M, c.pc("sh_lame"), rows=[2])
    c.trim(L, ARM[k], [3], c.pc("sh_trim"))
    px(L, ARM[k], 1, 0, "M", 5)


def sh_layered(c, k):
    L = c.L1
    for v in range(4):
        fill(L, ARM[k], c.M, c.pc(f"sh_l{v}"), rows=[v])
    px(L, ARM[k], 0, 1, "T", 5)
    px(L, ARM[k], 3, 2, "T", 4)


def sh_spiked(c, k):
    sh_round(c, k)
    for u in range(4):
        px(c.L1, ARM[k], u, 0, "A", 5 if u % 2 else 2)


def sh_fur(c, k):
    L = c.L1
    fill(L, ARM[k], c.surf("fur", "C"), c.pc("sh_fur"), rows=range(0, 4),
          where=lambda u, v, w, hh: v < 3 or u % 2 == 0)             # ragged lower edge


def sh_cap(c, k):
    L = c.L1
    fill(L, ARM[k], c.M, c.pc("sh_cap"), rows=[0])
    c.trim(L, ARM[k], [1], c.pc("sh_trim"))


def sh_epaulette(c, k):
    L = c.L1
    fill(L, ARM[k], solid("T", 3), c.pc("sh_board"), rows=[0, 1])
    fill(L, ARM[k], lambda x, y, u, v, w, hh: ("T", 4 if v == 2 else 2), c.pc("sh_fringe"), rows=[2, 3],
          where=lambda u, v, w, hh: u % 2 == 0)                      # gold fringe
    px(L, ARM[k], 1, 0, "T", 5)


def sh_crystal(c, k):
    L = c.L1
    fill(L, ARM[k], c.surf("crystal", "M"), c.pc("sh_cr"), rows=range(0, 4))
    px(L, ARM[k], 1, 0, "G", 4)
    px(L, ARM[k], 2, 1, "G", 3)


def sh_none(c, k):
    pass


def sh_horned(c, k):
    sh_round(c, k)
    if k in ("right", "front"):
        for u, v in ((1, 0), (2, 0), (1, 1), (0, 1)):
            px(c.L1, ARM[k], u, v, "A", 4)


def sh_stacked(c, k):
    L = c.L1
    for v in range(4):
        fill(L, ARM[k], solid("M", 3) if v % 2 == 0 else solid("T", 3), c.pc(f"sh_s{v}"), rows=[v])


def sh_drape(c, k):
    L = c.L1
    fill(L, ARM[k], c.Sc, c.pc("sh_drape"), rows=range(0, 4), where=lambda u, v, w, hh: v < 3 or (u + 1) % 3)
    px(L, ARM[k], 0, 0, "T", 4)


SHOULDERS = {"horned": sh_horned, "stacked": sh_stacked, "drape": sh_drape, "round": sh_round,
             "layered": sh_layered, "spiked": sh_spiked, "fur": sh_fur, "cap": sh_cap,
             "epaulette": sh_epaulette, "crystal": sh_crystal, "none": sh_none}
SHOULDER_TOP = {"fur": "fur", "drape": "sec", "epaulette": "trim", "none": None, "crystal": "crystal"}


# ============================================================ arms: gloves / bracers (rows 8-11)
def ar_sleeve(c, k):
    fill(c.L1, ARM[k], c.Sc, c.pc("ar_sleeve"), rows=range(8, 11))
    c.trim(c.L1, ARM[k], [11], c.pc("ar_hem"))


def ar_chain(c, k):
    fill(c.L1, ARM[k], c.surf("chain", "S"), c.pc("ar_mail"), rows=range(8, 10))
    fill(c.L1, ARM[k], c.M, c.pc("ar_cuff"), rows=[10, 11])


def ar_bracer(c, k):
    L = c.L1
    fill(L, ARM[k], c.M, c.pc("ar_bracer"), rows=range(8, 11))
    fill(L, ARM[k], solid("C", 3), c.pc("ar_glove"), rows=[11])
    for v in (8, 10):
        px(L, ARM[k], 1, v, "T", 4)
        px(L, ARM[k], 2, v, "T", 3)


def ar_gauntlet(c, k):
    L = c.L1
    c.trim(L, ARM[k], [8], c.pc("ar_flare"))
    fill(L, ARM[k], c.M, c.pc("ar_g1"), rows=[9])
    fill(L, ARM[k], c.M, c.pc("ar_g2"), rows=[10])
    fill(L, ARM[k], lambda x, y, u, v, w, hh: ("M", 5 if u % 2 == 0 else 2), c.pc("ar_knuckle"), rows=[11])


def ar_wrapped(c, k):
    x0 = ARM[k][0]
    for v in range(8, 12):
        for u in range(4):
            d = (v + (x0 + u) // 2) % 3
            c.L1.c[(x0 + u, ARM[k][1] + v)] = ["S", (4, 3, 2)[d], 2000, True]


def ar_puffy(c, k):
    L = c.L1
    fill(L, ARM[k], c.Sc, c.pc("ar_puff"), rows=range(8, 10))
    fill(L, ARM[k], lambda x, y, u, v, w, hh: ("A", 4) if u % 2 == 0 else None, c.pc("ar_puff"), rows=[8, 9])
    fill(L, ARM[k], c.M, c.pc("ar_cuff"), rows=[10, 11])
    c.trim(L, ARM[k], [10], c.pc("ar_cuff"))


def ar_plate(c, k):
    L = c.L1
    c.trim(L, ARM[k], [8], c.pc("ar_rim"))
    fill(L, ARM[k], c.M, c.pc("ar_plate"), rows=range(9, 12))
    px(L, ARM[k], 1, 9, "M", 5)


def ar_bare(c, k):
    ar_wrapped(c, k)


def ar_studded(c, k):
    L = c.L1
    fill(L, ARM[k], c.surf("leather", "S"), c.pc("ar_leather"), rows=range(8, 12))
    for v in (8, 10):
        for u in (0, 2):
            px(L, ARM[k], u + v % 4 // 2, v, "M", 5)
    c.trim(L, ARM[k], [11], c.pc("ar_leather"))


def ar_spiked(c, k):
    L = c.L1
    fill(L, ARM[k], c.M, c.pc("ar_sp"), rows=range(8, 12))
    c.trim(L, ARM[k], [8], c.pc("ar_sp_t"))
    if k in ("right", "back"):
        for v in (9, 11):
            px(L, ARM[k], 1, v, "A", 5)
            px(L, ARM[k], 2, v, "A", 3)


def ar_striped(c, k):
    L = c.L1
    fill(L, ARM[k], c.Sc, c.pc("ar_st"), rows=range(8, 12))
    for v in (9, 11):
        fill(L, ARM[k], solid("T", 3), c.pc("ar_st"), rows=[v])


ARMS = {"studded": ar_studded, "spiked": ar_spiked, "striped": ar_striped, "sleeve": ar_sleeve,
        "chain": ar_chain, "bracer": ar_bracer, "gauntlet": ar_gauntlet, "wrapped": ar_wrapped,
        "puffy": ar_puffy, "plate": ar_plate, "bare": ar_bare}


# ============================================================ belts (layer 2 body, rows 7-11)
def _waist(c):
    for k in SIDES:
        fill(c.L2, BODY[k], c.Sc, c.pc("waist"), rows=range(7, 12))


def be_buckle(c):
    _waist(c)
    for k in SIDES:
        fill(c.L2, BODY[k], solid("C", 2), c.pc("belt"), rows=[8, 9])
    for u, v, lv in ((3, 8, 5), (4, 8, 4), (3, 9, 4), (4, 9, 2)):
        px(c.L2, BODY["front"], u, v, "T", lv)


def be_sash(c):
    _waist(c)
    for k in SIDES:
        fill(c.L2, BODY[k], solid("A", 3), c.pc("sash"), rows=[7, 8])
    for v in range(9, 12):
        px(c.L2, BODY["right"], 1, v, "A", 4)
        px(c.L2, BODY["right"], 2, v, "A", 2)


def be_tassets(c):
    _waist(c)
    for k in SIDES:
        fill(c.L2, BODY[k], c.M, c.pc("fauld"), rows=[7, 8])
        c.trim(c.L2, BODY[k], [7], c.pc("fauld"))
    for k in ("front", "back"):
        for cols in ((0, 1, 2), (5, 6, 7)):
            fill(c.L2, BODY[k], c.M, c.pc("tasset" + str(cols[0])), rows=range(9, 12), cols=cols)


def be_chain(c):
    _waist(c)
    for k in SIDES:
        fill(c.L2, BODY[k], c.surf("chain", "S"), c.pc("mail"), rows=range(9, 12))
        fill(c.L2, BODY[k], solid("T", 3), c.pc("belt"), rows=[7, 8])


def be_skirt(c):
    for k in SIDES:
        fill(c.L2, BODY[k], c.M, c.pc("skirt"), rows=range(7, 12))
        c.trim(c.L2, BODY[k], [11], c.pc("skirt"))
        for u in range(0, BODY[k][2], 2):
            for v in range(8, 11):
                px(c.L2, BODY[k], u, v, "M", 2)


def be_loincloth(c):
    _waist(c)
    for k in SIDES:
        fill(c.L2, BODY[k], solid("C", 2), c.pc("belt"), rows=[7, 8])
    for k in ("front", "back"):
        fill(c.L2, BODY[k], solid("A", 3), c.pc("flap"), rows=range(9, 12), cols=range(2, 6))
        for v in range(9, 12):
            px(c.L2, BODY[k], 2, v, "T", 3)
            px(c.L2, BODY[k], 5, v, "T", 3)


def be_rope(c):
    _waist(c)
    for k in SIDES:
        fill(c.L2, BODY[k], lambda x, y, u, v, w, hh: ("C", 4 if (x + y) % 2 else 2), c.pc("rope"), rows=[7, 8])
    for v in (9, 10, 11):
        px(c.L2, BODY["front"], 2, v, "C", 4 if v % 2 else 2)
    px(c.L2, BODY["front"], 3, 9, "C", 3)


def be_pouches(c):
    be_buckle(c)
    for u0 in (0, 5):
        for u in (u0, u0 + 1, u0 + 2):
            if u < 8:
                px(c.L2, BODY["front"], u, 10, "S", 4)
                px(c.L2, BODY["front"], u, 11, "S", 2)


def be_studded(c):
    _waist(c)
    for k in SIDES:
        fill(c.L2, BODY[k], solid("C", 2), c.pc("belt"), rows=[7, 8])
        for u in range(0, BODY[k][2], 2):
            px(c.L2, BODY[k], u, 8, "M", 5)


BELTS = {"rope": be_rope, "pouches": be_pouches, "studded": be_studded, "buckle": be_buckle, "sash": be_sash,
         "tassets": be_tassets, "chain": be_chain, "skirt": be_skirt, "loincloth": be_loincloth}


# ============================================================ legs (layer 2 legs)
def _knee(c, L, v0=5):
    """A knee cop: a small bright plate on the front with wings on the sides."""
    fill(L, LEG["front"], c.M, c.pc("knee"), rows=[v0, v0 + 1])
    px(L, LEG["front"], 1, v0, "M", 5)
    px(L, LEG["front"], 2, v0, "M", 4)
    for k in ("right", "left"):
        fill(L, LEG[k], c.M, c.pc("knee"), rows=[v0 + 1], cols=(0, 3) if k == "right" else (0, 3))


def lg_greaves(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.M, c.pc("cuisse"), rows=range(0, 5))
        c.trim(L, LEG[k], [0], c.pc("hip"))
        fill(L, LEG[k], c.M, c.pc("greave"), rows=range(7, 12))
        fill(L, LEG[k], c.Sc, c.pc("knee_back"), rows=[5, 6])
    _knee(c, L)
    for v in range(7, 12):
        px(L, LEG["front"], 1, v, "M", 5)


def lg_pants(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.Sc, c.pc("pants"))
    for v in range(12):
        px(L, LEG["right"], 3, v, "S", 1)                          # side seam
    for v in (4, 5, 8):
        px(L, LEG["front"], 1 + v % 2, v, "S", 2)                  # creases
    for k in SIDES:
        fill(L, LEG[k], solid("S", 2), c.pc("cuff"), rows=[11])


def lg_robe(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.M, c.pc("robe"), rows=range(0, 10))
        c.trim(L, LEG[k], [9], c.pc("robe_hem"))
        fill(L, LEG[k], c.Sc, c.pc("under"), rows=[10, 11])
    for v in range(10):
        px(L, LEG["front"], 0, v, "M", 2)
        px(L, LEG["front"], 3, v, "M", 4)


def lg_chain(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.surf("chain", "S"), c.pc("chausses"))
        c.trim(L, LEG[k], [0], c.pc("hip"))
    _knee(c, L)


def lg_scale(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.surf("scale", "M"), c.pc("scale"))
        c.trim(L, LEG[k], [0], c.pc("hip"))


def lg_wrapped(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.Sc, c.pc("thigh"), rows=range(0, 6))
        x0 = LEG[k][0]
        for v in range(6, 12):
            for u in range(4):
                d = (v + (x0 + u) // 2) % 3
                L.c[(x0 + u, LEG[k][1] + v)] = ["C", (4, 3, 2)[d], 3000, True]


def lg_armored(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.Sc, c.pc("thigh"), rows=range(0, 5))
        fill(L, LEG[k], c.M, c.pc("greave"), rows=range(7, 12))
        fill(L, LEG[k], c.Sc, c.pc("knee_back"), rows=[5, 6])
    _knee(c, L)
    for v in range(7, 12):
        px(L, LEG["front"], 1, v, "M", 5)
        px(L, LEG["front"], 2, v, "M", 4)


def lg_striped(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.M, c.pc("trousers"))
    for v in range(12):
        px(L, LEG["right"], 1, v, "T", 4)
        px(L, LEG["right"], 2, v, "T", 2)
        px(L, LEG["front"], 1, v, "M", 4 if v % 3 else 3)          # pressed crease


def lg_tassets(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.Sc, c.pc("under"))
        for i in range(3):
            fill(L, LEG[k], c.M, c.pc(f"tas{i}"), rows=[2 * i, 2 * i + 1])
        px(L, LEG[k], 0, 1, "T", 5)
        px(L, LEG[k], 3, 3, "T", 4)


def lg_quilted(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.surf("quilt", "S"), c.pc("quilt"))
        c.trim(L, LEG[k], [0], c.pc("hip"))
    _knee(c, L)


def lg_patched(c):
    L = c.L2
    for k in SIDES:
        fill(L, LEG[k], c.Sc, c.pc("pants"))
    fill(L, LEG["front"], c.surf("leather", "C"), c.pc("patch"), rows=range(2, 6))
    for u, v in ((0, 2), (3, 2), (0, 5), (3, 5)):
        px(L, LEG["front"], u, v, "T", 4)
    fill(L, LEG["right"], solid("C", 3), c.pc("patch2"), rows=range(7, 10), cols=(1, 2))


LEGS = {"tassets": lg_tassets, "quilted": lg_quilted, "patched": lg_patched, "greaves": lg_greaves,
        "pants": lg_pants, "robe": lg_robe, "chain": lg_chain, "scale": lg_scale, "wrapped": lg_wrapped,
        "armored": lg_armored, "striped": lg_striped}


# ============================================================ boots (layer 1 legs)
def _sole(c, v=11):
    for k in SIDES:
        fill(c.L1, LEG[k], solid("O", 0), c.pc("sole"), rows=[v])


def bo_sabaton(c):
    L = c.L1
    for k in SIDES:
        c.trim(L, LEG[k], [6], c.pc("b_cuff"))
        fill(L, LEG[k], c.M, c.pc("b_ankle"), rows=[7, 8])
        for v in (9, 10, 11):
            fill(L, LEG[k], c.M, c.pc(f"b_lame{v}"), rows=[v])
    px(L, LEG["front"], 1, 10, "M", 5)
    px(L, LEG["front"], 2, 11, "M", 4)


def bo_fur(c):
    L = c.L1
    for k in SIDES:
        fill(L, LEG[k], c.surf("leather", "S"), c.pc("b_boot"), rows=range(8, 11))
        fill(L, LEG[k], c.surf("fur", "C"), c.pc("b_fur"), rows=range(5, 8),
              where=lambda u, v, w, hh: v > 5 or u % 2 == 0)
    _sole(c)


def bo_tall(c):
    L = c.L1
    for k in SIDES:
        c.trim(L, LEG[k], [3], c.pc("b_cuff"))
        fill(L, LEG[k], solid("M", 4), c.pc("b_fold"), rows=[4])
        fill(L, LEG[k], c.M, c.pc("b_shaft"), rows=range(5, 11))
    for v in range(5, 11):
        px(L, LEG["front"], 1, v, "M", 4)
    px(L, LEG["back"], 1, 10, "O", 0)
    px(L, LEG["back"], 2, 10, "O", 0)
    _sole(c)


def bo_wrapped(c):
    L = c.L1
    for k in SIDES:
        x0 = LEG[k][0]
        for v in range(6, 11):
            for u in range(4):
                d = (v + (x0 + u) // 2) % 3
                L.c[(x0 + u, LEG[k][1] + v)] = ["S", (4, 3, 2)[d], 4000, True]
        fill(L, LEG[k], solid("C", 1), c.pc("sandal"), rows=[11])


def bo_clawed(c):
    L = c.L1
    for k in SIDES:
        c.trim(L, LEG[k], [6], c.pc("b_cuff"))
        fill(L, LEG[k], c.M, c.pc("b_foot"), rows=range(7, 12))
    for u in (0, 3):
        px(L, LEG["front"], u, 11, "A", 5)
        px(L, LEG["front"], u, 10, "A", 3)
    px(L, LEG["back"], 1, 11, "A", 4)
    px(L, LEG["back"], 2, 11, "A", 4)


def bo_buckled(c):
    L = c.L1
    for k in SIDES:
        fill(L, LEG[k], c.surf("leather", "S"), c.pc("b_boot"), rows=range(6, 11))
        for v in (7, 9):
            fill(L, LEG[k], solid("C", 2), c.pc("b_strap"), rows=[v])
    for v in (7, 9):
        px(L, LEG["front"], 2, v, "T", 5)
    _sole(c)


def bo_greave(c):
    L = c.L1
    for k in SIDES:
        c.trim(L, LEG[k], [4], c.pc("b_cuff"))
        fill(L, LEG[k], c.M, c.pc("b_greave"), rows=range(5, 10))
        fill(L, LEG[k], c.M, c.pc("b_foot"), rows=[10, 11])
    for v in range(5, 10):
        px(L, LEG["front"], 1, v, "M", 5)
    px(L, LEG["front"], 1, 11, "M", 4)
    px(L, LEG["front"], 2, 11, "M", 4)


def bo_pointed(c):
    L = c.L1
    for k in SIDES:
        c.trim(L, LEG[k], [6], c.pc("b_cuff"))
        fill(L, LEG[k], c.M, c.pc("b_foot"), rows=range(7, 12))
    for v in range(8, 12):
        px(L, LEG["front"], 1, v, "M", 5 if v > 9 else 4)
        px(L, LEG["front"], 2, v, "M", 4 if v > 9 else 3)
    px(L, LEG["front"], 1, 11, "A", 5)
    px(L, LEG["front"], 2, 11, "A", 4)


def bo_cuffed(c):
    L = c.L1
    for k in SIDES:
        fill(L, LEG[k], solid("C", 4), c.pc("b_cuff"), rows=[6])
        fill(L, LEG[k], solid("C", 3), c.pc("b_cuff"), rows=[7])
        fill(L, LEG[k], c.surf("leather", "S"), c.pc("b_boot"), rows=range(8, 11))
    for v in (8, 9, 10):
        px(L, LEG["front"], 1 + v % 2, v, "T", 4)
    _sole(c)


def bo_spiked(c):
    L = c.L1
    for k in SIDES:
        c.trim(L, LEG[k], [6], c.pc("b_cuff"))
        fill(L, LEG[k], c.M, c.pc("b_foot"), rows=range(7, 11))
    for k in ("back", "right"):
        px(L, LEG[k], 1, 8, "A", 5)
        px(L, LEG[k], 2, 8, "A", 3)
    _sole(c)


BOOTS = {"pointed": bo_pointed, "cuffed": bo_cuffed, "spiked": bo_spiked, "sabaton": bo_sabaton, "fur": bo_fur,
         "tall": bo_tall, "wrapped": bo_wrapped, "clawed": bo_clawed, "buckled": bo_buckled, "greave": bo_greave}


# ============================================================ back designs (layer 1 body back)
def bk_spine(c):
    for v in range(1, 10):
        px(c.L1, BODY["back"], 3, v, "M", 1 if v % 2 else 2)
        px(c.L1, BODY["back"], 4, v, "M", 5 if v % 2 else 2)


def bk_cross(c):
    for v in range(1, 10):
        px(c.L1, BODY["back"], 3, v, "T", 4)
        px(c.L1, BODY["back"], 4, v, "T", 3)
    for u in range(1, 7):
        px(c.L1, BODY["back"], u, 3, "T", 4 if u != 4 else 3)


def bk_wings(c):
    for v in range(1, 8):
        for u in range(8):
            d = abs(u - 3.5)
            if abs(d - (4 - v * 0.5)) < 0.5:
                px(c.L1, BODY["back"], u, v, "A", 5)
            elif v in (3, 5) and 1 < d < 4 - v * 0.4:
                px(c.L1, BODY["back"], u, v, "A", 3)


def bk_circle(c):
    for v in range(12):
        for u in range(8):
            r = ((u - 3.5) ** 2 + (v - 4.5) ** 2) ** 0.5
            if 2 <= r <= 2.9:
                px(c.L1, BODY["back"], u, v, "T", 4 if v < 4.5 else 2)
            elif r < 1:
                px(c.L1, BODY["back"], u, v, "G", 5)


def bk_stripes(c):
    for v in range(0, 11):
        px(c.L1, BODY["back"], 1, v, "T", 3)
        px(c.L1, BODY["back"], 6, v, "T", 3)


def bk_x(c):
    for v in range(1, 10):
        u = round((v - 1) * 0.8)
        px(c.L1, BODY["back"], u, v, "C", 1)
        px(c.L1, BODY["back"], 7 - u, v, "C", 1)
        px(c.L1, BODY["back"], min(7, u + 1), v, "C", 3)
        px(c.L1, BODY["back"], max(0, 6 - u), v, "C", 3)


def bk_cape(c):
    cape = new_piece()
    fill(c.L1, BODY["back"], c.Sc, cape)
    for v in range(12):
        px(c.L1, BODY["back"], 2, v, "S", 1 if v % 3 else 2)
        px(c.L1, BODY["back"], 5, v, "S", 1 if v % 3 != 1 else 2)
        px(c.L1, BODY["back"], 3, v, "S", 4)
    c.trim(c.L1, BODY["back"], [0], cape)


def bk_emblem(c):
    if c.S.get("emblem"):
        c.stamp(c.L1, BODY["back"], c.S["emblem"], dy=2)


BACKS = {"spine": bk_spine, "cross": bk_cross, "wings": bk_wings, "circle": bk_circle, "stripes": bk_stripes,
         "x": bk_x, "cape": bk_cape, "emblem": bk_emblem, "none": lambda c: None}
TRIMS = ["line", "rope", "zigzag", "studs", "dots", "checker", "gem", "segment", "fur"]


# ============================================================ each set's build
# Hand-picked per set: chest, shoulders, arms (gloves), belt, legs, boots, trim, back,
# the surface of its plates (surface, material), its cloth surface, and how covered it is.
# Every pair of sets differs in at least 3 of the six construction parts (checked by distinct()).
LOOKS = {
 "frostborn": ("cuirass", "fur", "gauntlet", "tassets", "greaves", "fur", "dots", "stripes", ("plate", "M"), ("fur", "S"), "standard"),
 "druid": ("organic", "drape", "wrapped", "sash", "wrapped", "wrapped", "rope", "none", ("bark", "M"), ("cloth", "S"), "light"),
 "samurai": ("lamellar", "layered", "bracer", "tassets", "tassets", "wrapped", "rope", "emblem", ("plate", "M"), ("cloth", "S"), "standard"),
 "pharaoh": ("robe", "epaulette", "bracer", "loincloth", "robe", "buckled", "segment", "wings", ("stripes", "M"), ("cloth", "S"), "light"),
 "atlantean": ("scale", "cap", "bracer", "sash", "scale", "clawed", "line", "circle", ("scale", "M"), ("wave", "S"), "standard"),
 "paladin": ("tabard", "round", "plate", "tassets", "greaves", "sabaton", "gem", "cross", ("plate", "M"), ("cloth", "S"), "full"),
 "clockwork": ("mech", "layered", "gauntlet", "buckle", "armored", "sabaton", "segment", "circle", ("brass", "M"), ("leather", "S"), "full"),
 "shadow": ("wraps", "none", "wrapped", "sash", "wrapped", "pointed", "line", "x", ("cloth", "M"), ("cloth", "S"), "standard"),
 "dragon": ("cuirass", "spiked", "gauntlet", "tassets", "scale", "clawed", "zigzag", "spine", ("scale", "M"), ("leather", "S"), "standard"),
 "mushroom": ("patchwork", "cap", "puffy", "skirt", "pants", "cuffed", "dots", "cape", ("cloth", "M"), ("cloth", "S"), "standard"),
 "obsidian": ("crystal", "spiked", "plate", "tassets", "greaves", "greave", "studs", "x", ("obsidian", "M"), ("chain", "S"), "full"),
 "magma": ("segmented", "round", "gauntlet", "chain", "armored", "sabaton", "line", "none", ("flame", "S"), ("leather", "C"), "standard"),
 "storm": ("core", "layered", "plate", "chain", "chain", "tall", "gem", "emblem", ("plate", "M"), ("chain", "S"), "full"),
 "void": ("robe", "crystal", "sleeve", "skirt", "robe", "buckled", "dots", "circle", ("stars", "M"), ("cloth", "S"), "standard"),
 "celestial": ("tabard", "epaulette", "plate", "skirt", "striped", "greave", "dots", "circle", ("stars", "M"), ("stars", "S"), "standard"),
 "solar": ("chevron", "epaulette", "gauntlet", "skirt", "robe", "greave", "checker", "stripes", ("plate", "M"), ("stripes", "S"), "full"),
 "moonlit": ("cloak", "cap", "sleeve", "sash", "robe", "tall", "line", "wings", ("feather", "M"), ("cloth", "S"), "light"),
 "viking": ("fur_vest", "fur", "bracer", "buckle", "wrapped", "fur", "fur", "x", ("chain", "M"), ("leather", "S"), "light"),
 "spartan": ("cuirass", "none", "bare", "tassets", "greaves", "wrapped", "zigzag", "cape", ("plate", "M"), ("cloth", "S"), "light"),
 "jaguar": ("fur_vest", "spiked", "wrapped", "loincloth", "wrapped", "wrapped", "studs", "circle", ("spots", "M"), ("leather", "S"), "light"),
 "bone": ("ribcage", "spiked", "wrapped", "loincloth", "pants", "clawed", "studs", "spine", ("bone", "M"), ("leather", "S"), "light"),
 "pirate": ("coat", "epaulette", "puffy", "sash", "pants", "tall", "rope", "cape", ("cloth", "M"), ("cloth", "S"), "standard"),
 "neon": ("mech", "cap", "sleeve", "buckle", "striped", "buckled", "segment", "none", ("circuit", "M"), ("plate", "S"), "light"),
 "amethyst": ("crystal", "crystal", "chain", "chain", "scale", "greave", "gem", "emblem", ("crystal", "M"), ("plate", "S"), "standard"),
 "jade": ("lamellar", "round", "puffy", "sash", "robe", "tall", "zigzag", "wings", ("marble", "M"), ("quilt", "S"), "full"),
 "sculk": ("brigandine", "cap", "wrapped", "chain", "pants", "wrapped", "checker", "stripes", ("rune", "M"), ("cloth", "S"), "light"),
 "sakura": ("wraps", "stacked", "puffy", "skirt", "patched", "pointed", "line", "cross", ("petal", "M"), ("cloth", "S"), "light"),
 "hive": ("quilted", "round", "spiked", "buckle", "striped", "buckled", "dots", "stripes", ("hex", "M"), ("stripes", "S"), "standard"),
 "nomad": ("bandolier", "drape", "studded", "skirt", "tassets", "spiked", "line", "spine", ("cloth", "M"), ("cloth", "S"), "light"),
 "plague": ("coat", "none", "striped", "buckle", "quilted", "tall", "studs", "circle", ("leather", "M"), ("quilt", "S"), "full"),
 "necro": ("robe", "spiked", "striped", "chain", "patched", "clawed", "checker", "spine", ("bone", "M"), ("rune", "S"), "standard"),
 "royal": ("uniform", "epaulette", "studded", "buckle", "striped", "cuffed", "rope", "none", ("cloth", "M"), ("stripes", "S"), "full"),
 "arcane": ("tabard", "horned", "puffy", "sash", "chain", "pointed", "zigzag", "emblem", ("rune", "M"), ("cloth", "S"), "standard"),
 "seraph": ("scale", "layered", "plate", "pouches", "quilted", "greave", "gem", "wings", ("feather", "M"), ("plate", "S"), "standard"),
 "toxic": ("core", "none", "spiked", "rope", "pants", "spiked", "segment", "cross", ("slime", "M"), ("stripes", "S"), "full"),
 "kraken": ("organic", "crystal", "chain", "studded", "scale", "clawed", "fur", "cape", ("slime", "M"), ("scale", "S"), "standard"),
 "phoenix": ("scale", "horned", "bracer", "pouches", "tassets", "cuffed", "zigzag", "wings", ("feather", "M"), ("flame", "S"), "light"),
 "werewolf": ("studded", "fur", "bare", "loincloth", "quilted", "fur", "gem", "x", ("fur", "M"), ("leather", "S"), "light"),
 "rose": ("organic", "drape", "striped", "rope", "armored", "pointed", "segment", "emblem", ("plate", "M"), ("bark", "S"), "standard"),
 "prism": ("crystal", "epaulette", "bracer", "studded", "striped", "cuffed", "rope", "circle", ("crystal", "M"), ("marble", "S"), "standard"),
 "cowboy": ("bandolier", "stacked", "sleeve", "buckle", "pants", "tall", "fur", "none", ("leather", "M"), ("cloth", "S"), "light"),
 "monk": ("wraps", "none", "bare", "studded", "pants", "wrapped", "studs", "stripes", ("cloth", "M"), ("cloth", "S"), "light"),
 "redstone": ("brigandine", "horned", "plate", "pouches", "patched", "sabaton", "dots", "x", ("circuit", "M"), ("plate", "S"), "full"),
 "oxidized": ("segmented", "stacked", "chain", "rope", "chain", "sabaton", "checker", "cape", ("patina", "M"), ("plate", "S"), "full"),
 "candy": ("uniform", "drape", "spiked", "pouches", "patched", "fur", "line", "cross", ("candy", "M"), ("quilt", "S"), "light"),
 "vampire": ("uniform", "drape", "spiked", "studded", "quilted", "pointed", "line", "cape", ("cloth", "M"), ("cloth", "S"), "standard"),
 "witherbane": ("cuirass", "horned", "spiked", "tassets", "armored", "sabaton", "line", "spine", ("plate", "M"), ("chain", "S"), "full"),
 "dreadwyrm": ("scale", "spiked", "spiked", "chain", "scale", "clawed", "zigzag", "wings", ("scale", "M"), ("leather", "S"), "full"),
 "leviathan": ("core", "crystal", "chain", "skirt", "scale", "pointed", "gem", "circle", ("wave", "M"), ("scale", "S"), "full"),
 "revenant": ("cloak", "drape", "wrapped", "rope", "robe", "pointed", "line", "cape", ("plate", "M"), ("cloth", "S"), "full"),
 "blackguard": ("tabard", "horned", "plate", "chain", "greaves", "greave", "studs", "cape", ("plate", "M"), ("cloth", "S"), "full"),
 "juggernaut": ("core", "layered", "gauntlet", "tassets", "greaves", "sabaton", "segment", "stripes", ("brass", "M"), ("leather", "S"), "full"),
 "nyxite": ("crystal", "crystal", "gauntlet", "chain", "greaves", "pointed", "gem", "wings", ("crystal", "M"), ("obsidian", "S"), "full"),
 "halloween": ("brigandine", "spiked", "gauntlet", "chain", "armored", "clawed", "line", "none", ("pumpkin", "M"), ("cloth", "S"), "standard"),
}
PARTS = ("chest", "shoulders", "arms", "belt", "legs", "boots")


def distinct(min_diff=3):
    """Pairs of sets that share too many construction parts."""
    ids = list(LOOKS)
    return [(a, b) for i, a in enumerate(ids) for b in ids[i + 1:]
            if sum(x != y for x, y in zip(LOOKS[a][:6], LOOKS[b][:6])) < min_diff]


def apply(S):
    row = LOOKS[S["id"]]
    look = dict(zip(PARTS, row[:6]))
    look.update(trim=row[6], back=row[7], main=row[8], sec=row[9])
    S["look"] = look
    S["cover"] = row[10]
    return S


# ============================================================ shading and colour
def shade(L, P):
    """Form shading on levels: lit rims on top of each piece, shadow under it (deeper next to
    skin), rounded torso edges. Glow, outline and fixed detail cells keep their level."""
    out = {}
    for net in (BODY, ARM, LEG):
        for k in SIDES:
            x0, y0, w, hh = net[k]
            for v in range(hh):
                for u in range(w):
                    cell = L.c.get((x0 + u, y0 + v))
                    if not cell:
                        continue
                    mat, lv, pc, fixed = cell
                    if fixed or mat in ("G", "O"):
                        continue
                    up = L.c.get((x0 + u, y0 + v - 1)) if v > 0 else None
                    dn = L.c.get((x0 + u, y0 + v + 1)) if v < hh - 1 else None
                    if up is None or up[2] != pc:
                        lv += 1
                    if dn is None:
                        lv -= 2 if v < hh - 1 else 1
                    elif dn[2] != pc:
                        lv -= 1
                    bx0 = net["right"][0]
                    bx1 = net["back"][0] + net["back"][2] - 1
                    xl = x0 + u - 1 if x0 + u > bx0 else bx1
                    xr = x0 + u + 1 if x0 + u < bx1 else bx0
                    lf, rt = L.c.get((xl, y0 + v)), L.c.get((xr, y0 + v))
                    if lf is None or rt is None:
                        lv -= 1
                    elif rt[2] != pc and not rt[3]:
                        lv -= 1
                    if net is BODY and k in ("front", "back") and u in (0, w - 1) and lv >= 4:
                        lv -= 1
                    out[(x0 + u, y0 + v)] = max(0, min(5, lv))
    for key, lv in out.items():
        L.c[key][1] = lv


def resolve(L, P):
    R = ramps(P)
    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    pxl = img.load()
    for (x, y), (mat, lv, _, _) in L.c.items():
        pxl[x, y] = R[mat][max(0, min(5, lv))] + (255,)
    return img


# ============================================================ painter
def cover_cuts(c, cover):
    """Only a light set opens anything: a small V at the neck. Everything else stays covered."""
    if cover == "light":
        erase(c.L1, BODY["front"], [(u, 0) for u in range(2, 6)] + [(3, 1), (4, 1)])


def trim_arms(L, style):
    """Slim chestplates: no full armored sleeves. 'pads' keeps the shoulder plates, 'gloves' keeps the
    forearm and hand, 'both' keeps both with the middle of the arm bare."""
    keep = {"pads": range(0, 4), "gloves": range(8, 12), "both": list(range(0, 3)) + list(range(9, 12))}[style]
    for k in SIDES:
        erase(L, ARM[k], [(u, v) for u in range(4) for v in range(12) if v not in keep])
    if style == "gloves":
        erase(L, ARM["top"], [(u, v) for u in range(4) for v in range(4)])
    if style == "pads":
        erase(L, ARM["bottom"], [(u, v) for u in range(4) for v in range(4)])


def paint(S):
    P, look = S["pal"], S["look"]
    c = Ctx(S)
    L1, L2 = c.L1, c.L2
    # torso caps
    paint_cells(L1, BODY["top"], c.M)
    paint_cells(L1, BODY["bottom"], solid("O", 0))
    emblem = CHESTS[look["chest"]](c)
    if emblem and S.get("emblem"):
        c.stamp(L1, BODY["front"], S["emblem"], dy=2)
    BACKS[look.get("back", "none")](c)
    # shoulders, arm tops, gloves
    top = SHOULDER_TOP.get(look["shoulders"], "main")
    if top:
        paint_cells(L1, ARM["top"], {"main": c.M, "fur": c.surf("fur", "C"), "sec": c.Sc, "trim": solid("T", 3),
                                     "crystal": c.surf("crystal", "M")}[top])
    paint_cells(L1, ARM["bottom"], solid("O", 0))
    for k in SIDES:
        ARMS[look["arms"]](c, k)
        SHOULDERS[look["shoulders"]](c, k)
    # boots and leggings
    paint_cells(L1, LEG["bottom"], solid("O", 0))
    BOOTS[look["boots"]](c)
    if S.get("boot_art"):
        c.stamp(L1, LEG["front"], S["boot_art"], dy=7)
    BELTS[look["belt"]](c)
    if S.get("belt_art"):
        c.stamp(L2, BODY["front"], S["belt_art"], dy=7)
    paint_cells(L2, LEG["top"], c.M)
    paint_cells(L2, LEG["bottom"], solid("O", 0))
    LEGS[look["legs"]](c)
    if S.get("leg_art"):
        c.stamp(L2, LEG["right"], S["leg_art"])
        c.stamp(L2, LEG["front"], S["leg_art"])
    cover_cuts(c, S.get("cover", "standard"))
    trim_arms(L1, S.get("arm_cut", "both"))
    shade(L1, P)
    shade(L2, P)
    t1, t2 = resolve(L1, P), resolve(L2, P)
    # helmet shell faces (read by the 3D helmet's atlas): the set's own pattern, as before
    old = PATTERNS[S["pattern"]]
    for k in ("top", "right", "left", "back", "front"):
        x0, y0, w, hh = HEAD[k]
        for v in range(hh):
            for u in range(w):
                t1.putpixel((x0 + u, y0 + v), old(P, u, v, w, hh, x0 + u, y0 + v) + (255,))
    x0, y0, w, hh = HEAD["bottom"]
    for v in range(hh):
        for u in range(w):
            t1.putpixel((x0 + u, y0 + v), P["o"] + (255,))
    return t1, t2


def paint_cells(L, rect, fn):
    fill(L, rect, fn, new_piece())
# ============================================================ icons from the textures
def _outline(img, c):
    px = img.load()
    out = img.copy()
    for y in range(16):
        for x in range(16):
            if px[x, y][3] == 0 and any(0 <= x + dx < 16 and 0 <= y + dy < 16 and px[x + dx, y + dy][3]
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out.putpixel((x, y), c + (255,))
    return out


def _blit(dst, src, rect, cols, rows, dx, dy):
    x0, y0, _, _ = rect
    for j, v in enumerate(rows):
        for i, u in enumerate(cols):
            c = src.getpixel((x0 + u, y0 + v))
            if c[3]:
                dst.putpixel((dx + i, dy + j), c)


def icons_from(l1, l2, P, helmet_icon):
    """Chestplate, leggings and boots icons laid out from the real armor textures."""
    chest = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    _blit(chest, l1, BODY["front"], range(8), range(12), 4, 2)
    _blit(chest, l1, ARM["front"], (1, 2, 3), range(12), 1, 2)
    _blit(chest, l1, ARM["front"], (0, 1, 2), range(12), 12, 2)
    legs = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    _blit(legs, l2, BODY["front"], (0, 1, 2, 3, 3, 4, 4, 5, 6, 7), range(8, 12), 3, 1)
    _blit(legs, l2, LEG["front"], range(4), range(10), 3, 5)
    _blit(legs, l2, LEG["front"], range(4), range(10), 9, 5)
    boots = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    top = next((v for v in range(12) if l1.getpixel((LEG["front"][0] + 1, LEG["front"][1] + v))[3]), 6)
    rows = range(top, 12)
    dy = 14 - len(rows)
    _blit(boots, l1, LEG["front"], range(4), rows, 3, dy)                 # left boot, toe pointing left
    _blit(boots, l1, LEG["right"], (0, 1), range(10, 12), 1, dy + len(rows) - 2)
    _blit(boots, l1, LEG["front"], range(4), rows, 9, dy)                 # right boot, toe pointing right
    _blit(boots, l1, LEG["right"], (2, 3), range(10, 12), 13, dy + len(rows) - 2)
    return {"helmet": helmet_icon, "chestplate": _outline(chest, P["o"]), "leggings": _outline(legs, P["o"]),
            "boots": _outline(boots, P["o"])}
