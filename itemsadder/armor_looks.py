"""Modular armor painter: every set picks its own chest, shoulder, arm, belt,
leg and boot designs, so sets differ in shape and construction, not just in
colour. Also builds the inventory icons straight from the painted textures.

Faces are addressed as (face rect, u, v): u across, v down (0 = top).
"""
from PIL import Image

import armor_engine as AE
from armor_engine import ARM, BODY, HEAD, LEG, PATTERNS, Tex, h

SIDES = ("front", "back", "right", "left")


def put(t, rect, u, v, c):
    x0, y0, w, hh = rect
    if 0 <= u < w and 0 <= v < hh and c is not None:
        t.put(x0 + u, y0 + v, c)


def fill(t, rect, fn, rows=None):
    """fn(u, v, w, h, x, y) -> colour or None (leave as is)."""
    x0, y0, w, hh = rect
    for v in range(hh) if rows is None else rows:
        for u in range(w):
            put(t, rect, u, v, fn(u, v, w, hh, x0 + u, y0 + v))


def pat(name, P):
    f = PATTERNS[name]
    return lambda u, v, w, hh, x, y: f(P, u, v, w, hh, x, y)


def solid(c):
    return lambda *a: c


def clear(t, rect, cells):
    x0, y0, w, hh = rect
    for u, v in cells:
        if 0 <= u < w and 0 <= v < hh:
            t.img.putpixel((x0 + u, y0 + v), (0, 0, 0, 0))


# ============================================================ trims
STYLE = {"trim": "line"}


def trim(t, rect, P, rows):
    """Edge bands in the set's own trim style."""
    kind = STYLE["trim"]
    fur = pat("fur", dict(P, b=P["t2"], m=P["t"], l=P["a"]))

    def f(u, v, w, hh, x, y):
        if kind == "rope":
            return P["t"] if (u + v) % 2 else P["t2"]
        if kind == "zigzag":
            return P["t2"] if u % 3 == 0 else P["t"]
        if kind == "studs":
            return P["l"] if u % 2 == 0 else P["d"]
        if kind == "dots":
            return P["a"] if u % 3 == 1 else P["t"]
        if kind == "checker":
            return P["t"] if (u + v) % 2 else P["o"]
        if kind == "gem":
            return P["g"] if u % 4 == 1 else P["t"]
        if kind == "segment":
            return P["t2"] if u % 4 == 3 else P["t"]
        if kind == "fur":
            return fur(u, v, w, hh, x, y)
        return P["t"]
    fill(t, rect, f, rows=rows)


# ============================================================ chests (layer 1 body)
def ch_cuirass(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
        trim(t, BODY[k], P, [0])
    for v in range(1, 9):                                     # centre ridge + curved shading
        put(t, BODY["front"], 3, v, P["l"])
        put(t, BODY["front"], 4, v, P["m"])
        put(t, BODY["front"], 0, v, P["d"])
        put(t, BODY["front"], 7, v, P["d"])
        put(t, BODY["back"], 3, v, P["d"])
        put(t, BODY["back"], 4, v, P["d"])
    for k in SIDES:                                           # fauld lames
        for u in range(BODY[k][2]):
            put(t, BODY[k], u, 9, P["t"])
            put(t, BODY[k], u, 10, P["m"] if u % 2 else P["l"])
            put(t, BODY[k], u, 11, P["d"])
    return True


def ch_scale(t, P, S, M, Sc):
    sc = pat("scale", P)
    for k in SIDES:
        fill(t, BODY[k], sc)
        trim(t, BODY[k], P, [0])
    for u, v in ((2, 1), (3, 2), (4, 2), (5, 1), (3, 1), (4, 1)):   # V collar
        put(t, BODY["front"], u, v, P["t"])
    for k in SIDES:
        fill(t, BODY[k], M, rows=[10, 11])
        fill(t, BODY[k], solid(P["t2"]), rows=[10])
    return True


def ch_brigandine(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], Sc)
        fill(t, BODY[k], lambda u, v, *a: P["t"] if (v % 2 == 1 and u % 2 == (v // 2) % 2) else None, rows=range(1, 10))
        fill(t, BODY[k], solid(P["d"]), rows=[0, 10])
        fill(t, BODY[k], M, rows=[11])
    for v in range(0, 4):                                     # shoulder straps
        for u in (1, 6):
            put(t, BODY["front"], u, v, P["o"])
            put(t, BODY["back"], u, v, P["o"])
    return False


def ch_robe(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
        trim(t, BODY[k], P, [0])
    for v in range(12):                                       # sash across the chest
        for u in range(8):
            if abs(u - (v * 0.7)) < 1.0:
                put(t, BODY["front"], u, v, P["a"])
            if abs((7 - u) - (v * 0.7)) < 1.0:
                put(t, BODY["back"], u, v, P["a"])
    for u in (3, 4):
        for v in range(1, 12):
            put(t, BODY["front"], u, v, P["t2"] if v % 3 else P["t"])   # front seam with clasps
    return False


def ch_coat(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
    shirt = pat("cloth", dict(P, b=P["s2"], m=P["l"], d=P["s1"]))
    fill(t, BODY["front"], lambda u, v, *a: shirt(u, v, *a) if 3 <= u <= 4 else None)
    for v in (2, 4, 6):
        put(t, BODY["front"], 3, v, P["t"])
    for u, v in ((2, 0), (2, 1), (2, 2), (5, 0), (5, 1), (5, 2), (1, 0), (6, 0)):   # lapels
        put(t, BODY["front"], u, v, P["t"])
    for k in SIDES:
        fill(t, BODY[k], solid(P["d"]), rows=[8])
    put(t, BODY["front"], 3, 8, P["a"])
    put(t, BODY["front"], 4, 8, P["a"])
    for v in range(9, 12):                                    # coat tails split at the back
        put(t, BODY["back"], 3, v, P["o"])
        put(t, BODY["back"], 4, v, P["o"])
    return False


def ch_ribcage(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], pat("leather", P))
    for v in range(0, 10):
        put(t, BODY["front"], 3, v, P["a"])
        put(t, BODY["front"], 4, v, P["s2"])
        put(t, BODY["back"], 3, v, P["a"] if v % 2 else P["s2"])
        put(t, BODY["back"], 4, v, P["a"] if v % 2 else P["s2"])
    for v in (1, 3, 5, 7):
        for u in (0, 1, 2, 5, 6, 7):
            put(t, BODY["front"], u, v + (1 if u in (0, 7) else 0), P["a"])
        for u in range(4):
            put(t, BODY["right"], u, v + 1, P["s2"])
            put(t, BODY["left"], u, v + 1, P["s2"])
    for k in SIDES:
        fill(t, BODY[k], solid(P["d"]), rows=[11])
    return False


def ch_crystal(t, P, S, M, Sc):
    cr = pat("crystal", P)
    for k in SIDES:
        fill(t, BODY[k], cr)
    for u, v in ((3, 4), (4, 4), (3, 5), (4, 5), (2, 5), (5, 5), (3, 6), (4, 6), (3, 3), (4, 3)):
        put(t, BODY["front"], u, v, P["g"])
    for u, v in ((3, 2), (4, 2), (2, 4), (5, 4), (2, 6), (5, 6), (3, 7), (4, 7)):
        put(t, BODY["front"], u, v, P["l"])
    for k in SIDES:
        trim(t, BODY[k], P, [0])
        fill(t, BODY[k], M, rows=[10, 11])
    return False


def ch_tabard(t, P, S, M, Sc):
    chain = pat("chain", dict(P, l=P["s1"], m=P["s2"], b=P["s2"], d=P["o"]))
    for k in SIDES:
        fill(t, BODY[k], chain)
    for k in ("front", "back"):
        fill(t, BODY[k], lambda u, v, *a: (P["t"] if u in (1, 6) else M(u, v, *a)) if 1 <= u <= 6 else None)
        trim(t, BODY[k], P, [11])
    return True


def ch_quilted(t, P, S, M, Sc):
    q = pat("quilt", P)
    for k in SIDES:
        fill(t, BODY[k], q)
    for k in ("front", "back"):
        for v in range(12):
            for u in range(8):
                if abs(u - (0.5 + v * 0.6)) < 0.6 or abs(u - (6.5 - v * 0.6)) < 0.6:
                    put(t, BODY[k], u, v, P["o"])
        put(t, BODY[k], 3, 5, P["t"])
        put(t, BODY[k], 4, 5, P["t"])
    for k in SIDES:
        fill(t, BODY[k], solid(P["d"]), rows=[10])
    return False


def ch_organic(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
        fill(t, BODY[k], lambda u, v, w, hh, x, y: P["s1"] if h(x, y, 40) > 0.78 else
             (P["a"] if h(x, y, 41) > 0.95 else None))
    for v in range(12):                                       # a vine climbing the front
        u = 3 + (1 if v % 4 in (1, 2) else 0)
        put(t, BODY["front"], u, v, P["s2"])
    return True


def ch_mech(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
        fill(t, BODY[k], solid(P["d"]), rows=[3, 8])
        fill(t, BODY[k], lambda u, v, *a: P["d"] if u in (0, a[0] - 1) else None)
    for u, v in ((3, 4), (4, 4), (3, 5), (4, 5)):
        put(t, BODY["front"], u, v, P["g"])
    for u, v in ((2, 4), (5, 4), (2, 5), (5, 5), (3, 6), (4, 6), (3, 3), (4, 3)):
        put(t, BODY["front"], u, v, P["t"])
    for v in (9, 10):
        for u in (1, 3, 5):
            put(t, BODY["back"], u, v, P["o"])                # vents
    for u in (1, 6):
        for v in (1, 2):
            put(t, BODY["front"], u, v, P["g"])
    return False


def ch_uniform(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
        trim(t, BODY[k], P, [0])
    for v in (2, 4, 6):
        put(t, BODY["front"], 2, v, P["t"])
        put(t, BODY["front"], 5, v, P["t"])
    for v in range(10):
        u = round(v * 0.75)
        put(t, BODY["front"], u, v, P["a"])
    for k in SIDES:
        fill(t, BODY[k], solid(P["o"]), rows=[9])
    put(t, BODY["front"], 3, 9, P["t"])
    put(t, BODY["front"], 4, 9, P["t"])
    return False


def ch_wraps(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], lambda u, v, w, hh, x, y: M(u, v, w, hh, x, y) if (u + v) % 4 < 2 else Sc(u, v, w, hh, x, y))
        fill(t, BODY[k], solid(P["d"]), rows=[11])
    return False


def ch_fur_vest(t, P, S, M, Sc):
    fur = pat("fur", P)
    for k in SIDES:
        fill(t, BODY[k], pat("leather", dict(P, b=P["s1"], m=P["s2"])))
    fill(t, BODY["front"], lambda u, v, *a: fur(u, v, *a) if u in (0, 1, 6, 7) or v == 0 else None)
    fill(t, BODY["back"], lambda u, v, *a: fur(u, v, *a) if v <= 2 else None)
    for v in (3, 6):
        put(t, BODY["front"], 2, v, P["t"])
        put(t, BODY["front"], 5, v, P["t"])
    return False


def ch_lamellar(t, P, S, M, Sc):
    lam = pat("lamellar", P)
    for k in SIDES:
        fill(t, BODY[k], lam)
    for v in range(12):
        put(t, BODY["front"], 1, v, P["t"])
        put(t, BODY["front"], 6, v, P["t"])
    for k in SIDES:
        fill(t, BODY[k], solid(P["t2"]), rows=[0, 11])
    return True


def ch_bandolier(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
    for v in range(12):                                       # crossed belts with pouches/rounds
        for u in range(8):
            if abs(u - v * 0.65) < 0.8 or abs((7 - u) - v * 0.65) < 0.8:
                put(t, BODY["front"], u, v, P["o"] if (u + v) % 3 else P["t"])
    for k in SIDES:
        fill(t, BODY[k], solid(P["d"]), rows=[10])
    return False


def ch_chevron(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
    for k in ("front", "back"):
        fill(t, BODY[k], lambda u, v, *a: P["t"] if (v - abs(u - 3.5) * 0.9) % 3 < 0.9 else None, rows=range(1, 11))
    for k in SIDES:
        fill(t, BODY[k], solid(P["d"]), rows=[11])
    return False


def ch_studded(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], pat("leather", P))
        fill(t, BODY[k], lambda u, v, *a: P["l"] if (u % 2 == 1 and v % 2 == 1) else None, rows=range(1, 10))
    for v in range(1, 10):                                    # front lacing
        put(t, BODY["front"], 3 + (v % 2), v, P["o"])
        put(t, BODY["front"], 4 - (v % 2), v, P["t2"])
    for k in SIDES:
        trim(t, BODY[k], P, [0, 11])
    return False


def ch_cloak(t, P, S, M, Sc):
    cloth = pat("cloth", dict(P, b=P["s1"], m=P["s2"], d=P["o"]))
    for k in SIDES:
        fill(t, BODY[k], cloth)
    fill(t, BODY["front"], lambda u, v, *a: M(u, v, *a) if 2 <= u <= 5 else None)
    for u in range(2, 6):
        put(t, BODY["front"], u, 1, P["t2"])
    put(t, BODY["front"], 1, 1, P["t"])
    put(t, BODY["front"], 6, 1, P["t"])
    for v in range(12):
        put(t, BODY["back"], 2, v, P["o"] if v % 3 else None)
        put(t, BODY["back"], 5, v, P["o"] if v % 3 != 1 else None)
    return False


def ch_core(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
    for v in range(12):
        for u in range(8):
            if abs(abs(u - 3.5) - abs(v - 4.5) * 0.8) < 0.5 and not (2 <= u <= 5 and 3 <= v <= 6):
                put(t, BODY["front"], u, v, P["l"])
    for u in range(2, 6):
        for v in range(3, 7):
            edge = u in (2, 5) or v in (3, 6)
            put(t, BODY["front"], u, v, P["t"] if edge else P["g"])
    for k in SIDES:
        trim(t, BODY[k], P, [11])
    return False


def ch_segmented(t, P, S, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M)
        fill(t, BODY[k], lambda u, v, *a: P["l"] if v % 2 == 0 else (P["d"] if v % 4 == 3 else None))
        fill(t, BODY[k], lambda u, v, w, *a: P["o"] if u in (0, w - 1) and v % 2 else None)
    return True


def ch_patchwork(t, P, S, M, Sc):
    pats = [M, Sc, pat("leather", P), pat("quilt", P)]
    for i, k in enumerate(SIDES):
        fill(t, BODY[k], lambda u, v, w, hh, x, y, i=i: pats[(i + (u >= w // 2) + 2 * (v >= 6)) % 4](u, v, w, hh, x, y))
        fill(t, BODY[k], lambda u, v, w, *a: P["o"] if ((u == w // 2 or v == 6) and (u + v) % 2 == 0) else None)
        trim(t, BODY[k], P, [0])
    return False


CHESTS = {"chevron": ch_chevron, "studded": ch_studded, "cloak": ch_cloak, "core": ch_core,
          "segmented": ch_segmented, "patchwork": ch_patchwork, "cuirass": ch_cuirass, "scale": ch_scale, "brigandine": ch_brigandine, "robe": ch_robe,
          "coat": ch_coat, "ribcage": ch_ribcage, "crystal": ch_crystal, "tabard": ch_tabard,
          "quilted": ch_quilted, "organic": ch_organic, "mech": ch_mech, "uniform": ch_uniform,
          "wraps": ch_wraps, "fur_vest": ch_fur_vest, "lamellar": ch_lamellar, "bandolier": ch_bandolier}


# ============================================================ shoulders (arm rows 0-3)
def sh_round(t, P, k, M):
    fill(t, ARM[k], M, rows=range(4))
    fill(t, ARM[k], solid(P["l"]), rows=[0])
    trim(t, ARM[k], P, [3])


def sh_layered(t, P, k, M):
    for v, c in ((0, P["l"]), (1, P["d"]), (2, P["m"]), (3, P["d"])):
        fill(t, ARM[k], solid(c), rows=[v])
    put(t, ARM[k], 1, 2, P["t"])


def sh_spiked(t, P, k, M):
    sh_round(t, P, k, M)
    for u in range(4):
        put(t, ARM[k], u, 0, P["a"] if u % 2 else P["d"])
    put(t, ARM[k], 1, 1, P["a"])


def sh_fur(t, P, k, M):
    fill(t, ARM[k], pat("fur", P), rows=range(4))
    for u in range(4):
        put(t, ARM[k], u, 3, P["d"] if u % 2 else P["m"])


def sh_cap(t, P, k, M):
    fill(t, ARM[k], M, rows=range(2))
    trim(t, ARM[k], P, [1])


def sh_epaulette(t, P, k, M):
    trim(t, ARM[k], P, [0, 1])
    fill(t, ARM[k], lambda u, *a: P["t2"] if u % 2 == 0 else None, rows=[2])


def sh_crystal(t, P, k, M):
    fill(t, ARM[k], pat("crystal", P), rows=range(4))
    put(t, ARM[k], 1, 0, P["g"])
    put(t, ARM[k], 2, 1, P["l"])


def sh_none(t, P, k, M):
    pass


def sh_horned(t, P, k, M):
    sh_round(t, P, k, M)
    if k in ("right", "front"):
        for u, v in ((1, 0), (2, 0), (1, 1), (0, 1)):
            put(t, ARM[k], u, v, P["a"])


def sh_stacked(t, P, k, M):
    for v in range(4):
        fill(t, ARM[k], solid(P["l"] if v % 2 == 0 else P["m"]), rows=[v])
        put(t, ARM[k], 0, v, P["t"])
        put(t, ARM[k], 3, v, P["t"])


def sh_drape(t, P, k, M):
    cloth = pat("cloth", dict(P, b=P["s1"], m=P["s2"], d=P["o"]))
    fill(t, ARM[k], cloth, rows=range(6))
    trim(t, ARM[k], P, [5])


SHOULDERS = {"horned": sh_horned, "stacked": sh_stacked, "drape": sh_drape, "round": sh_round, "layered": sh_layered, "spiked": sh_spiked, "fur": sh_fur, "cap": sh_cap,
             "epaulette": sh_epaulette, "crystal": sh_crystal, "none": sh_none}


# ============================================================ arms (rows 4-11)
def ar_sleeve(t, P, k, M, Sc):
    fill(t, ARM[k], Sc, rows=range(4, 12))
    trim(t, ARM[k], P, [11])


def ar_chain(t, P, k, M, Sc):
    fill(t, ARM[k], pat("chain", dict(P, l=P["s1"], m=P["s2"], b=P["s2"], d=P["o"])), rows=range(4, 10))
    fill(t, ARM[k], M, rows=[10, 11])
    trim(t, ARM[k], P, [10])


def ar_bracer(t, P, k, M, Sc):
    fill(t, ARM[k], Sc, rows=range(4, 8))
    fill(t, ARM[k], M, rows=range(8, 12))
    fill(t, ARM[k], lambda u, *a: P["t"] if u % 2 == 0 else P["t2"], rows=[8])


def ar_gauntlet(t, P, k, M, Sc):
    fill(t, ARM[k], Sc, rows=range(4, 8))
    fill(t, ARM[k], M, rows=range(8, 12))
    trim(t, ARM[k], P, [8])
    fill(t, ARM[k], lambda u, *a: P["l"] if u % 2 else P["d"], rows=[11])


def ar_wrapped(t, P, k, M, Sc):
    fill(t, ARM[k], lambda u, v, w, hh, x, y: P["d"] if (u + v) % 3 == 0 else Sc(u, v, w, hh, x, y), rows=range(4, 12))


def ar_puffy(t, P, k, M, Sc):
    fill(t, ARM[k], Sc, rows=range(4, 9))
    fill(t, ARM[k], lambda u, *a: P["a"] if u % 2 == 0 else None, rows=range(5, 8))
    fill(t, ARM[k], M, rows=range(9, 12))
    trim(t, ARM[k], P, [9])


def ar_plate(t, P, k, M, Sc):
    fill(t, ARM[k], M, rows=range(4, 12))
    trim(t, ARM[k], P, [7])
    put(t, ARM[k], 1, 7, P["l"])
    fill(t, ARM[k], solid(P["d"]), rows=[11])


def ar_bare(t, P, k, M, Sc):
    fill(t, ARM[k], M, rows=range(8, 12))
    trim(t, ARM[k], P, [8])
    clear(t, ARM[k], [(u, v) for u in range(4) for v in range(4, 8)])


def ar_studded(t, P, k, M, Sc):
    fill(t, ARM[k], pat("leather", P), rows=range(4, 12))
    fill(t, ARM[k], lambda u, v, *a: P["l"] if (u % 2 == 1 and v % 2 == 0) else None, rows=range(4, 11))
    trim(t, ARM[k], P, [11])


def ar_spiked(t, P, k, M, Sc):
    fill(t, ARM[k], M, rows=range(4, 12))
    trim(t, ARM[k], P, [8])
    if k in ("right", "back"):
        for v in (6, 10):
            put(t, ARM[k], 1, v, P["a"])
            put(t, ARM[k], 2, v, P["a"])


def ar_striped(t, P, k, M, Sc):
    fill(t, ARM[k], Sc, rows=range(4, 12))
    fill(t, ARM[k], lambda u, v, *a: P["t"] if v % 2 == 0 else None, rows=range(5, 11))


ARMS = {"studded": ar_studded, "spiked": ar_spiked, "striped": ar_striped, "sleeve": ar_sleeve, "chain": ar_chain, "bracer": ar_bracer, "gauntlet": ar_gauntlet,
        "wrapped": ar_wrapped, "puffy": ar_puffy, "plate": ar_plate, "bare": ar_bare}


# ============================================================ belts (layer 2 body)
def be_buckle(t, P, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], Sc, rows=range(7, 12))
        fill(t, BODY[k], solid(P["o"]), rows=[8])
    put(t, BODY["front"], 3, 8, P["t"])
    put(t, BODY["front"], 4, 8, P["t"])


def be_sash(t, P, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], Sc, rows=range(7, 12))
        fill(t, BODY[k], solid(P["a"]), rows=[7, 8])
    for v in range(8, 12):
        put(t, BODY["right"], 1, v, P["a"])
        put(t, BODY["right"], 2, v, P["a"] if v < 11 else None)


def be_tassets(t, P, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M, rows=range(7, 12))
        trim(t, BODY[k], P, [7])
        fill(t, BODY[k], solid(P["d"]), rows=[11])
    for v in range(8, 12):
        put(t, BODY["front"], 3, v, P["o"])
        put(t, BODY["front"], 4, v, P["o"])


def be_chain(t, P, M, Sc):
    ch = pat("chain", dict(P, l=P["s1"], m=P["s2"], b=P["s2"], d=P["o"]))
    for k in SIDES:
        fill(t, BODY[k], Sc, rows=range(7, 12))
        fill(t, BODY[k], ch, rows=[7, 8])


def be_skirt(t, P, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], M, rows=range(7, 12))
        trim(t, BODY[k], P, [7])


def be_loincloth(t, P, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], Sc, rows=range(7, 12))
        fill(t, BODY[k], solid(P["d"]), rows=[7, 8])
    for v in range(9, 12):
        for u in range(2, 6):
            put(t, BODY["front"], u, v, P["a"] if u in (2, 5) else P["t"])
            put(t, BODY["back"], u, v, P["t"])


def be_rope(t, P, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], Sc, rows=range(7, 12))
        fill(t, BODY[k], lambda u, v, *a: P["a"] if (u + v) % 2 else P["t2"], rows=[7, 8])
    for v in (9, 10):
        put(t, BODY["front"], 2, v, P["a"])
        put(t, BODY["front"], 3, v, P["t2"] if v == 10 else P["a"])


def be_pouches(t, P, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], Sc, rows=range(7, 12))
        fill(t, BODY[k], solid(P["o"]), rows=[8])
    for u0 in (1, 5):
        for u in (u0, u0 + 1):
            put(t, BODY["front"], u, 9, P["t"])
            put(t, BODY["front"], u, 10, P["s1"])
            put(t, BODY["front"], u, 11, P["s1"])


def be_studded(t, P, M, Sc):
    for k in SIDES:
        fill(t, BODY[k], Sc, rows=range(7, 12))
        fill(t, BODY[k], lambda u, *a: P["l"] if u % 2 == 0 else P["d"], rows=[8])
        fill(t, BODY[k], solid(P["d"]), rows=[7])


BELTS = {"rope": be_rope, "pouches": be_pouches, "studded": be_studded, "buckle": be_buckle, "sash": be_sash, "tassets": be_tassets, "chain": be_chain, "skirt": be_skirt,
         "loincloth": be_loincloth}


# ============================================================ legs (layer 2 legs)
def lg_greaves(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], M)
        trim(t, LEG[k], P, [5])
    put(t, LEG["front"], 1, 5, P["l"])
    put(t, LEG["front"], 2, 5, P["l"])
    for v in range(6, 12):
        put(t, LEG["front"], 1, v, P["l"])


def lg_pants(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], Sc)
    for v in range(12):
        put(t, LEG["right"], 3, v, P["d"])


def lg_robe(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], M, rows=range(0, 10))
        trim(t, LEG[k], P, [9])
        fill(t, LEG[k], Sc, rows=[10, 11])


def lg_chain(t, P, M, Sc):
    ch = pat("chain", dict(P, l=P["s1"], m=P["s2"], b=P["s2"], d=P["o"]))
    for k in SIDES:
        fill(t, LEG[k], ch)
        fill(t, LEG[k], M, rows=[4, 5])
        trim(t, LEG[k], P, [4])


def lg_scale(t, P, M, Sc):
    sc = pat("scale", P)
    for k in SIDES:
        fill(t, LEG[k], sc)
        trim(t, LEG[k], P, [0])


def lg_wrapped(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], Sc, rows=range(0, 6))
        fill(t, LEG[k], lambda u, v, w, hh, x, y: P["d"] if (u + v) % 3 == 0 else M(u, v, w, hh, x, y),
             rows=range(6, 12))


def lg_armored(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], Sc, rows=range(0, 6))
        fill(t, LEG[k], M, rows=range(6, 12))
        trim(t, LEG[k], P, [6])
    for v in range(7, 12):
        put(t, LEG["front"], 1, v, P["l"])
        put(t, LEG["front"], 2, v, P["m"])


def lg_striped(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], M)
    for v in range(12):
        put(t, LEG["right"], 1, v, P["t"])
        put(t, LEG["right"], 2, v, P["t"])


def lg_tassets(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], Sc)
        fill(t, LEG[k], lambda u, v, *a: P["l"] if v % 2 == 0 else P["d"], rows=range(0, 6))
        fill(t, LEG[k], M, rows=[1, 3])


def lg_quilted(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], pat("quilt", P))
        trim(t, LEG[k], P, [5])


def lg_patched(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], Sc)
    for u in range(4):
        for v in range(2, 6):
            put(t, LEG["front"], u, v, P["m"] if (u + v) % 2 else P["b"])
    for u, v in ((0, 2), (3, 2), (0, 5), (3, 5)):
        put(t, LEG["front"], u, v, P["o"])
    for v in range(7, 10):
        put(t, LEG["right"], 1, v, P["m"])
        put(t, LEG["right"], 2, v, P["m"])


LEGS = {"tassets": lg_tassets, "quilted": lg_quilted, "patched": lg_patched, "greaves": lg_greaves, "pants": lg_pants, "robe": lg_robe, "chain": lg_chain, "scale": lg_scale,
        "wrapped": lg_wrapped, "armored": lg_armored, "striped": lg_striped}


# ============================================================ boots (layer 1 legs)
def bo_sabaton(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], M, rows=range(6, 12))
        trim(t, LEG[k], P, [6])
        fill(t, LEG[k], solid(P["d"]), rows=[9, 11])
        fill(t, LEG[k], solid(P["l"]), rows=[10])


def bo_fur(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], pat("leather", P), rows=range(8, 12))
        fill(t, LEG[k], pat("fur", dict(P, b=P["s2"], m=P["l"], l=P["a"])), rows=range(5, 8))
        fill(t, LEG[k], solid(P["o"]), rows=[11])


def bo_tall(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], M, rows=range(3, 12))
        trim(t, LEG[k], P, [3])
        fill(t, LEG[k], solid(P["t2"]), rows=[4])
        fill(t, LEG[k], solid(P["o"]), rows=[11])


def bo_wrapped(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], lambda u, v, w, hh, x, y: P["d"] if (u + v) % 3 == 0 else Sc(u, v, w, hh, x, y),
             rows=range(6, 12))
        fill(t, LEG[k], solid(P["o"]), rows=[11])


def bo_clawed(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], M, rows=range(6, 12))
        trim(t, LEG[k], P, [6])
    for u in (0, 2):
        put(t, LEG["front"], u, 11, P["a"])
        put(t, LEG["front"], u, 10, P["a"])
    put(t, LEG["back"], 1, 11, P["a"])


def bo_buckled(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], Sc, rows=range(6, 12))
        fill(t, LEG[k], solid(P["o"]), rows=[7, 9])
        fill(t, LEG[k], solid(P["d"]), rows=[11])
    put(t, LEG["front"], 2, 7, P["t"])
    put(t, LEG["front"], 2, 9, P["t"])


def bo_greave(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], M, rows=range(4, 12))
        trim(t, LEG[k], P, [4])
        fill(t, LEG[k], solid(P["d"]), rows=[11])
    put(t, LEG["front"], 1, 5, P["l"])
    put(t, LEG["front"], 2, 5, P["l"])


def bo_pointed(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], M, rows=range(6, 12))
        trim(t, LEG[k], P, [6])
    for v in range(7, 12):
        put(t, LEG["front"], 1, v, P["l"])
    put(t, LEG["front"], 1, 11, P["a"])
    put(t, LEG["front"], 2, 11, P["a"])


def bo_cuffed(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], pat("leather", P), rows=range(5, 12))
        fill(t, LEG[k], solid(P["l"]), rows=[5])
        trim(t, LEG[k], P, [6])
        fill(t, LEG[k], solid(P["o"]), rows=[11])


def bo_spiked(t, P, M, Sc):
    for k in SIDES:
        fill(t, LEG[k], M, rows=range(6, 12))
        trim(t, LEG[k], P, [6])
        fill(t, LEG[k], solid(P["d"]), rows=[11])
    for k in ("back", "right"):
        put(t, LEG[k], 1, 8, P["a"])
        put(t, LEG[k], 2, 8, P["a"])


BOOTS = {"pointed": bo_pointed, "cuffed": bo_cuffed, "spiked": bo_spiked, "sabaton": bo_sabaton, "fur": bo_fur, "tall": bo_tall, "wrapped": bo_wrapped, "clawed": bo_clawed,
         "buckled": bo_buckled, "greave": bo_greave}


# ============================================================ each set's build
# chest, shoulders, arms, belt, legs, boots, coverage -- every pair of sets differs in at least 3 parts
LOOKS = {  # chest, shoulders, arms, belt, legs, boots, cover
 "frostborn": ("cuirass", "fur", "gauntlet", "tassets", "greaves", "fur", "standard"),
 "druid": ("organic", "none", "wrapped", "sash", "wrapped", "wrapped", "light"),
 "samurai": ("lamellar", "layered", "sleeve", "tassets", "armored", "wrapped", "standard"),
 "pharaoh": ("robe", "epaulette", "bracer", "loincloth", "robe", "buckled", "light"),
 "atlantean": ("scale", "cap", "bracer", "sash", "scale", "clawed", "standard"),
 "paladin": ("tabard", "round", "plate", "tassets", "greaves", "sabaton", "full"),
 "clockwork": ("mech", "layered", "gauntlet", "buckle", "armored", "sabaton", "full"),
 "shadow": ("wraps", "layered", "wrapped", "chain", "wrapped", "buckled", "standard"),
 "dragon": ("cuirass", "spiked", "gauntlet", "tassets", "scale", "clawed", "standard"),
 "mushroom": ("patchwork", "cap", "puffy", "skirt", "pants", "fur", "standard"),
 "obsidian": ("crystal", "spiked", "plate", "tassets", "greaves", "greave", "full"),
 "magma": ("segmented", "round", "gauntlet", "chain", "armored", "sabaton", "standard"),
 "storm": ("core", "layered", "plate", "chain", "chain", "tall", "full"),
 "void": ("robe", "crystal", "sleeve", "skirt", "robe", "buckled", "standard"),
 "celestial": ("tabard", "crystal", "sleeve", "skirt", "striped", "greave", "standard"),
 "solar": ("chevron", "epaulette", "gauntlet", "skirt", "robe", "greave", "full"),
 "lunar": ("cloak", "cap", "sleeve", "sash", "robe", "tall", "light"),
 "viking": ("fur_vest", "fur", "bracer", "buckle", "wrapped", "fur", "light"),
 "spartan": ("cuirass", "none", "bare", "tassets", "greaves", "wrapped", "light"),
 "jaguar": ("fur_vest", "spiked", "wrapped", "loincloth", "wrapped", "wrapped", "light"),
 "bone": ("ribcage", "spiked", "wrapped", "loincloth", "pants", "clawed", "light"),
 "pirate": ("coat", "epaulette", "puffy", "sash", "pants", "tall", "standard"),
 "neon": ("mech", "cap", "sleeve", "buckle", "striped", "buckled", "light"),
 "amethyst": ("crystal", "crystal", "gauntlet", "chain", "scale", "greave", "standard"),
 "jade": ("lamellar", "round", "puffy", "sash", "robe", "tall", "full"),
 "sculk": ("brigandine", "cap", "wrapped", "chain", "pants", "wrapped", "light"),
 "sakura": ("wraps", "cap", "puffy", "skirt", "robe", "wrapped", "light"),
 "hive": ("quilted", "round", "gauntlet", "buckle", "striped", "buckled", "standard"),
 "nomad": ("bandolier", "cap", "wrapped", "skirt", "robe", "buckled", "light"),
 "plague": ("coat", "none", "gauntlet", "buckle", "robe", "tall", "full"),
 "necro": ("robe", "spiked", "sleeve", "chain", "robe", "clawed", "standard"),
 "royal": ("uniform", "epaulette", "sleeve", "buckle", "striped", "tall", "full"),
 "arcane": ("tabard", "cap", "puffy", "sash", "robe", "buckled", "standard"),
 "seraph": ("scale", "layered", "plate", "sash", "robe", "greave", "standard"),
 "toxic": ("core", "none", "sleeve", "chain", "pants", "buckled", "full"),
 "kraken": ("organic", "crystal", "chain", "skirt", "scale", "clawed", "standard"),
 "phoenix": ("scale", "spiked", "bracer", "tassets", "robe", "clawed", "light"),
 "werewolf": ("studded", "fur", "bare", "loincloth", "pants", "fur", "light"),
 "rose": ("organic", "layered", "gauntlet", "sash", "armored", "tall", "standard"),
 "prism": ("crystal", "epaulette", "bracer", "skirt", "striped", "buckled", "standard"),
 "cowboy": ("bandolier", "cap", "sleeve", "buckle", "pants", "tall", "light"),
 "monk": ("wraps", "none", "bare", "sash", "pants", "wrapped", "light"),
 "redstone": ("brigandine", "epaulette", "plate", "buckle", "striped", "sabaton", "full"),
 "oxidized": ("segmented", "layered", "chain", "buckle", "chain", "sabaton", "full"),
 "candy": ("uniform", "spiked", "puffy", "skirt", "striped", "fur", "light"),
 "vampire": ("uniform", "layered", "puffy", "chain", "robe", "tall", "standard"),
 "halloween": ("brigandine", "spiked", "gauntlet", "chain", "armored", "clawed", "standard"),
}
PARTS = ("chest", "shoulders", "arms", "belt", "legs", "boots")
# themed trims and back designs; everything not listed is spread automatically
THEMED = {"paladin": ("gem", "cross"), "seraph": ("gem", "wings"), "vampire": ("line", "cape"),
          "royal": ("rope", "none"), "viking": ("fur", "x"), "bone": ("studs", "spine"), "dragon": ("zigzag", "spine"),
          "pirate": ("rope", "cape"), "celestial": ("dots", "circle"), "phoenix": ("zigzag", "wings"),
          "necro": ("checker", "spine"), "clockwork": ("segment", "circle"), "samurai": ("rope", "emblem")}
BALANCED = ("shoulders", "arms", "belt", "legs", "boots", "trim", "back")


def _balanced_looks():
    import math
    opts = {"shoulders": list(SHOULDERS), "arms": [a for a in ARMS if a != "bare"], "belt": list(BELTS),
            "legs": list(LEGS), "boots": list(BOOTS), "trim": TRIMS, "back": list(BACKS)}
    counts = {k: {o: 0 for o in v} for k, v in opts.items()}
    out = {}
    ids = list(LOOKS)
    for i, sid in enumerate(ids):
        row = LOOKS[sid]
        look = dict(zip(PARTS, row[:6]))
        look["trim"], look["back"] = THEMED.get(sid, (None, None))
        for k in BALANCED:
            cap = math.ceil(len(ids) / len(opts[k]))
            cur = look.get(k)
            if k == "arms" and cur == "bare":
                out.setdefault(sid, look)
                continue
            if cur not in counts[k] or counts[k][cur] >= cap:
                low = min(counts[k].values())
                cands = [o for o in opts[k] if counts[k][o] == low]
                cur = cands[(i * 5 + len(k)) % len(cands)]
            look[k] = cur
            counts[k][cur] += 1
        out[sid] = (look, row[6])
    return out


_BALANCED = None


def apply(S):
    global _BALANCED
    if _BALANCED is None:
        _BALANCED = _balanced_looks()
    look, cover = _BALANCED[S["id"]]
    S["look"] = dict(look)
    S["cover"] = cover
    return S


# ============================================================ back designs (layer 1 body back)
def bk_spine(t, P, S):
    for v in range(1, 10):
        put(t, BODY["back"], 3, v, P["d"])
        put(t, BODY["back"], 4, v, P["l"] if v % 2 else P["d"])


def bk_cross(t, P, S):
    for v in range(1, 10):
        put(t, BODY["back"], 3, v, P["t"])
        put(t, BODY["back"], 4, v, P["t"])
    for u in range(1, 7):
        put(t, BODY["back"], u, 3, P["t"])


def bk_wings(t, P, S):
    for v in range(1, 8):
        for u in range(8):
            d = abs(u - 3.5)
            if abs(d - (4 - v * 0.5)) < 0.5 or (v in (3, 5) and 1 < d < 4 - v * 0.4):
                put(t, BODY["back"], u, v, P["a"])


def bk_circle(t, P, S):
    for v in range(12):
        for u in range(8):
            r = ((u - 3.5) ** 2 + (v - 4.5) ** 2) ** 0.5
            if 2 <= r <= 2.9:
                put(t, BODY["back"], u, v, P["t"])
            elif r < 1:
                put(t, BODY["back"], u, v, P["g"])


def bk_stripes(t, P, S):
    for v in range(0, 11):
        put(t, BODY["back"], 1, v, P["t2"])
        put(t, BODY["back"], 6, v, P["t2"])


def bk_x(t, P, S):
    for v in range(1, 10):
        u = round((v - 1) * 0.8)
        put(t, BODY["back"], u, v, P["o"])
        put(t, BODY["back"], 7 - u, v, P["o"])


def bk_cape(t, P, S):
    fill(t, BODY["back"], pat("cloth", dict(P, b=P["s1"], m=P["s2"], d=P["o"])))
    for v in range(12):
        if v % 3:
            put(t, BODY["back"], 2, v, P["o"])
            put(t, BODY["back"], 5, v, P["o"])
    trim(t, BODY["back"], P, [0])


def bk_emblem(t, P, S):
    if S.get("emblem"):
        t.stamp(BODY["back"], S["emblem"], P, dy=2)


BACKS = {"spine": bk_spine, "cross": bk_cross, "wings": bk_wings, "circle": bk_circle, "stripes": bk_stripes,
         "x": bk_x, "cape": bk_cape, "emblem": bk_emblem, "none": lambda *a: None}
TRIMS = ["line", "rope", "zigzag", "studs", "dots", "checker", "gem", "segment", "fur"]


def shade(img, P):
    """Depth: lit top edge, shadowed bottom and right edge on every armor face."""
    keep = {P["g"]}
    px = img.load()
    for net in (BODY, ARM, LEG):
        for k in SIDES:
            x0, y0, w, hh = net[k]
            for v in range(hh):
                for u in range(w):
                    c = px[x0 + u, y0 + v]
                    if c[3] == 0 or c[:3] in keep:
                        continue
                    f = 1.12 if v == 0 else 0.78 if v == hh - 1 else 0.9 if v == hh - 2 else 1.0
                    if u == w - 1:
                        f *= 0.9
                    elif u == 0:
                        f *= 1.05
                    px[x0 + u, y0 + v] = tuple(max(0, min(255, int(ch * f))) for ch in c[:3]) + (255,)


# ============================================================ painter
def cover_cuts(t1, t2, cover, look):
    """Small, deliberate openings: 'full' shows none, 'standard' a little, 'light' a bit more."""
    if cover == "full":
        return
    clear(t1, ARM["left"], [(u, v) for u in range(4) for v in (5, 6)])                    # armpit
    clear(t2, LEG["left"], [(u, v) for u in range(4) for v in (1, 2)])                    # inner thigh
    if cover == "light":
        clear(t1, BODY["front"], [(u, 0) for u in range(2, 6)] + [(3, 1), (4, 1)])        # open neckline
        for k in ("right", "left"):
            clear(t1, BODY[k], [(u, v) for u in range(4) for v in (3, 4)])
        if look["arms"] not in ("chain", "sleeve", "puffy"):
            for k in SIDES:
                clear(t1, ARM[k], [(u, v) for u in range(4) for v in (5, 6)])             # a band of upper arm


def paint(S):
    P = S["pal"]
    L = S["look"]
    M, Sc = pat(S["pattern"], P), pat(S.get("secondary", "cloth"), P)
    t1, t2 = Tex(64, 32), Tex(64, 32)
    for k in ("top", "right", "left", "back", "front"):       # helmet faces (atlas only)
        fill(t1, HEAD[k], M)
    fill(t1, HEAD["bottom"], solid(P["o"]))
    fill(t1, BODY["top"], M)
    fill(t1, BODY["bottom"], solid(P["o"]))
    STYLE["trim"] = L.get("trim", "line")
    emblem = CHESTS[L["chest"]](t1, P, S, M, Sc)
    if emblem and S.get("emblem"):
        t1.stamp(BODY["front"], S["emblem"], P, dy=2)
    BACKS[L.get("back", "none")](t1, P, S)
    fill(t1, ARM["top"], M)
    fill(t1, ARM["bottom"], solid(P["o"]))
    for k in SIDES:
        ARMS[L["arms"]](t1, P, k, M, Sc)
        SHOULDERS[L["shoulders"]](t1, P, k, M)
    fill(t1, LEG["bottom"], solid(P["o"]))
    BOOTS[L["boots"]](t1, P, M, Sc)
    if S.get("boot_art"):
        t1.stamp(LEG["front"], S["boot_art"], P, dy=7)
    BELTS[L["belt"]](t2, P, M, Sc)
    if S.get("belt_art"):
        t2.stamp(BODY["front"], S["belt_art"], P, dy=7)
    fill(t2, LEG["top"], M)
    fill(t2, LEG["bottom"], solid(P["o"]))
    LEGS[L["legs"]](t2, P, M, Sc)
    cover_cuts(t1, t2, S.get("cover", "standard"), L)
    shade(t1.img, P)
    shade(t2.img, P)
    return t1.img, t2.img


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
