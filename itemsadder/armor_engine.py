"""Shared engine for the themed armor sets: painted flat layers, icons, a
per-set parts atlas, head-worn 3D helmet models (with extensions), and the
ItemsAdder configs. Set definitions live in armor_sets.py."""
import math
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "demon_armor"))
sys.path.insert(0, os.path.join(ROOT, "crimson_armor"))
import demon  # noqa: E402  (to_item_space, ITEM_K, Tex)

from preview import ARM, BODY, HEAD, LEG  # noqa: E402

PIECES = ("helmet", "chestplate", "leggings", "boots")
SLOTS = {"chestplate": "CHEST", "leggings": "LEGS", "boots": "FEET"}


def h(x, y, k=0):
    """Deterministic hash noise in [0, 1)."""
    n = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65536


# --- surface patterns: (pal, u, v, w, hgt, x, y) -> colour -------------------------
def pat_plate(P, u, v, w, hh, x, y):
    if v == 0:
        return P["l"]
    if v == hh - 1:
        return P["d"]
    if (u in (0, w - 1)) and v in (1, hh - 2):
        return P["t"]                                          # rivets
    return P["m"] if h(x, y) > 0.82 else P["b"]


def pat_fur(P, u, v, w, hh, x, y):
    r = h(x, y, 1)
    return P["l"] if r > 0.55 else P["m"] if r > 0.2 else P["b"]


def pat_scale(P, u, v, w, hh, x, y):
    """Overlapping 3x2 scales, lit from the top-left, alternate rows offset."""
    c = (u + (v // 2) % 2 * 2) % 3
    r = v % 2
    if r == 0:
        return P["l"] if c == 0 else P["m"]
    return P["d"] if c == 2 else P["b"]


def pat_cloth(P, u, v, w, hh, x, y):
    if v % 4 == 3 and u % 2 == 0:
        return P["d"]                                          # stitches
    return P["m"] if h(x, y, 2) > 0.85 else P["b"]


def pat_bark(P, u, v, w, hh, x, y):
    if (u + (v // 3)) % 3 == 0:
        return P["d"]                                          # grain
    return P["m"] if h(x, y, 3) > 0.7 else P["b"]


def pat_stripes(P, u, v, w, hh, x, y):
    return P["t"] if v % 3 == 1 else (P["l"] if v % 3 == 0 else P["b"])


def pat_lamellar(P, u, v, w, hh, x, y):
    if v % 3 == 2:
        return P["t"] if u % 3 == 1 else P["d"]                # lacing
    return P["m"] if v % 3 == 0 else P["b"]


def pat_brass(P, u, v, w, hh, x, y):
    if v in (0, hh - 1) or u in (0, w - 1):
        return P["t"] if (u + v) % 2 == 0 else P["t2"]         # riveted brass frame
    if (u, v) == (w // 2, hh // 2):
        return P["a"]
    return P["m"] if h(x, y, 4) > 0.8 else P["b"]


def pat_pumpkin(P, u, v, w, hh, x, y):
    if u % 3 == 0:
        return P["d"]                                          # pumpkin ribs
    if v % 5 == 4 and u % 2:
        return P["o"]                                          # stitches
    return P["m"] if u % 3 == 1 else P["b"]


def pat_cap(P, u, v, w, hh, x, y):
    if h(x // 2, y // 2, 5) > 0.72:
        return P["a"]                                          # white spots
    return P["t"] if v < hh - 1 else P["t2"]


def pat_chain(P, u, v, w, hh, x, y):
    if (u + v) % 2 == 0:
        return P["l"] if v % 2 == 0 else P["m"]
    return P["d"] if v % 2 else P["b"]


def pat_hex(P, u, v, w, hh, x, y):
    r = v % 3
    off = (v // 3) % 2 * 2
    if r == 0 and (u + off) % 4 in (0, 1):
        return P["d"]
    if r != 0 and (u + off) % 4 == 3:
        return P["d"]
    return P["l"] if r == 1 and (u + off) % 4 == 0 else P["b"]


def pat_crystal(P, u, v, w, hh, x, y):
    k = ((u + v) // 2 + (u - v + 20) // 3) % 3
    if h(x, y, 6) > 0.93:
        return P["g"]
    return (P["l"], P["m"], P["b"])[k]


def pat_bone(P, u, v, w, hh, x, y):
    if v % 3 == 0 and 0 < u < w - 1:
        return P["a"] if u % 2 else P["s2"]
    return P["d"] if h(x, y, 7) > 0.7 else P["b"]


def pat_leather(P, u, v, w, hh, x, y):
    if u in (0, w - 1) and v % 2 == 0:
        return P["t"]
    return P["m"] if h(x, y, 8) > 0.8 else P["b"]


def pat_rune(P, u, v, w, hh, x, y):
    if h(x, y, 9) > 0.9:
        return P["g"]
    return P["m"] if (u + v) % 5 == 0 else P["b"]


def pat_flame(P, u, v, w, hh, x, y):
    t = v / max(1, hh - 1) + (h(x, y, 10) - 0.5) * 0.5
    return P["g"] if t < 0.15 else P["l"] if t < 0.4 else P["m"] if t < 0.7 else P["b"]


def pat_wave(P, u, v, w, hh, x, y):
    k = (v + round(math.sin(u * 1.3) * 1.2)) % 4
    return (P["l"], P["m"], P["b"], P["m"])[k]


def pat_stars(P, u, v, w, hh, x, y):
    r = h(x, y, 11)
    return P["g"] if r > 0.94 else P["l"] if r > 0.88 else P["b"] if r > 0.3 else P["d"]


def pat_circuit(P, u, v, w, hh, x, y):
    if (v % 4 == 1 and h(x // 3, y, 12) > 0.4) or (u % 4 == 2 and h(x, y // 3, 13) > 0.6):
        return P["g"] if h(x, y, 14) > 0.8 else P["a"]
    return P["b"] if (u + v) % 2 else P["d"]


def pat_quilt(P, u, v, w, hh, x, y):
    if (u + v) % 4 == 0 or (u - v) % 4 == 0:
        return P["d"]
    return P["m"] if (u + v) % 4 == 2 else P["b"]


def pat_feather(P, u, v, w, hh, x, y):
    k = (v + abs(u % 4 - 1.5)) % 3
    return P["l"] if k < 1 else P["m"] if k < 2 else P["b"]


def pat_marble(P, u, v, w, hh, x, y):
    if abs(math.sin((u + v * 0.6) * 0.9 + h(x // 3, y // 3, 15) * 3)) < 0.15:
        return P["t"]
    return P["l"] if h(x, y, 16) > 0.6 else P["m"]


def pat_plaid(P, u, v, w, hh, x, y):
    a, b = u % 4 == 1, v % 4 == 1
    return P["t"] if a and b else P["d"] if a or b else P["b"]


def pat_patina(P, u, v, w, hh, x, y):
    r = h(x // 2, y // 2, 17) + h(x, y, 18) * 0.3
    return P["t"] if r > 0.95 else P["t2"] if r > 0.7 else P["m"] if r > 0.4 else P["b"]


def pat_obsidian(P, u, v, w, hh, x, y):
    if abs(math.sin(u * 0.7 + v * 1.1 + h(x // 4, y // 4, 19) * 4)) < 0.12:
        return P["g"]
    return P["m"] if h(x, y, 20) > 0.85 else P["b"] if h(x, y, 21) > 0.4 else P["d"]


def pat_spots(P, u, v, w, hh, x, y):
    r = h(x // 2, y // 2, 22)
    if r > 0.78:
        return P["d"] if (x + y) % 2 else P["o"]
    return P["l"] if h(x, y, 23) > 0.7 else P["m"]


def pat_candy(P, u, v, w, hh, x, y):
    return P["a"] if ((u + v) // 2) % 2 else P["t"]


def pat_petal(P, u, v, w, hh, x, y):
    if h(x, y, 24) > 0.9:
        return P["a"]
    return P["l"] if (u * 2 + v) % 5 == 0 else P["m"] if (u + v) % 3 else P["b"]


def pat_slime(P, u, v, w, hh, x, y):
    r = h(x, y, 25)
    return P["l"] if r > 0.85 else P["m"] if r > 0.35 else P["b"]


def pat_nebula(P, u, v, w, hh, x, y):
    """Deep space: magenta and blue clouds with stars (Galactus)."""
    r = h(x, y, 50)
    if r > 0.96:
        return P["g"]
    if r > 0.92:
        return P["l"]
    m = math.sin(x * 0.7 + y * 0.3) + math.sin(y * 0.9 - x * 0.4 + h(x // 4, y // 4, 51) * 3)
    b = math.sin(x * 0.4 - y * 0.6 + 2) + math.sin(x * 0.8 + y * 0.5 + h(x // 5, y // 5, 52) * 2)
    if m > 1.2:
        return P["s1"]
    if b > 1.2:
        return P["s2"]
    return P["m"] if m > 0.4 else P["b"] if b > -0.4 else P["d"]


PATTERNS = {"plate": pat_plate, "fur": pat_fur, "scale": pat_scale, "cloth": pat_cloth, "bark": pat_bark,
            "stripes": pat_stripes, "lamellar": pat_lamellar, "brass": pat_brass, "pumpkin": pat_pumpkin,
            "cap": pat_cap, "chain": pat_chain, "hex": pat_hex, "crystal": pat_crystal, "bone": pat_bone,
            "leather": pat_leather, "rune": pat_rune, "flame": pat_flame, "wave": pat_wave, "stars": pat_stars,
            "circuit": pat_circuit, "quilt": pat_quilt, "feather": pat_feather, "marble": pat_marble,
            "plaid": pat_plaid, "patina": pat_patina, "obsidian": pat_obsidian, "spots": pat_spots,
            "candy": pat_candy, "petal": pat_petal, "slime": pat_slime, "nebula": pat_nebula}


# --- flat armor layers ---------------------------------------------------------------
class Tex(demon.Tex):
    def face(self, rect, fn, P, rows=None):
        x0, y0, w, hh = rect
        for v in range(hh):
            if rows and v not in rows:
                continue
            for u in range(w):
                self.put(x0 + u, y0 + v, fn(P, u, v, w, hh, x0 + u, y0 + v))

    def row(self, rect, v, c, alt=None):
        x0, y0, w, _ = rect
        for u in range(w):
            self.put(x0 + u, y0 + v, alt if alt and u % 2 else c)

    def stamp(self, rect, art, P, dy=0):
        x0, y0, w, _ = rect
        for j, line in enumerate(art):
            for i, ch in enumerate(line[:w]):
                if ch != ".":
                    self.put(x0 + i, y0 + dy + j, P[ch])


def layers(S):
    """Paint layer_1 (helmet shell, chestplate, boots) and layer_2 (leggings)."""
    if "look" in S:
        import armor_looks
        return armor_looks.paint(S)
    P, main, sec = S["pal"], PATTERNS[S["pattern"]], PATTERNS[S.get("secondary", "cloth")]
    t1, t2 = Tex(64, 32), Tex(64, 32)
    # helmet shell (used by the 3D helmet's atlas)
    for k in ("top", "right", "left", "back", "front"):
        t1.face(HEAD[k], main, P)
        t1.row(HEAD[k], 7, P["t"], P["t2"])
    t1.face(HEAD["bottom"], lambda *a: P["o"], P)
    if S.get("visor"):
        t1.stamp(HEAD["front"], S["visor"], P)
    # chestplate
    t1.face(BODY["top"], main, P)
    t1.face(BODY["bottom"], lambda *a: P["o"], P)
    for k in ("front", "back", "right", "left"):
        t1.face(BODY[k], main, P)
        t1.row(BODY[k], 0, P["t"])
        t1.row(BODY[k], 10, P["t2"], P["t"])
        t1.row(BODY[k], 11, P["d"])
    t1.stamp(BODY["front"], S["emblem"], P, dy=2)
    if S.get("back_art"):
        t1.stamp(BODY["back"], S["back_art"], P, dy=1)
    t1.face(ARM["top"], main, P)
    t1.face(ARM["bottom"], lambda *a: P["o"], P)
    for k in ("right", "front", "left", "back"):
        t1.face(ARM[k], main, P, rows=range(0, 4))            # pauldron
        t1.row(ARM[k], 3, P["t"])
        t1.face(ARM[k], sec, P, rows=range(4, 8))             # sleeve
        t1.face(ARM[k], main, P, rows=range(8, 12))           # bracer
        t1.row(ARM[k], 8, P["t"], P["t2"])
        t1.row(ARM[k], 11, P["d"])
    # boots
    t1.face(LEG["bottom"], lambda *a: P["o"], P)
    for k in ("right", "front", "left", "back"):
        t1.face(LEG[k], main, P, rows=range(6, 12))
        t1.row(LEG[k], 6, P["t"], P["t2"])
        t1.row(LEG[k], 11, P["o"])
    if S.get("boot_art"):
        t1.stamp(LEG["front"], S["boot_art"], P, dy=7)
    # leggings: belt + tassets on the body, painted leg extensions
    for k in ("front", "back", "right", "left"):
        t2.face(BODY[k], sec, P, rows=range(7, 12))
        t2.row(BODY[k], 8, P["t"], P["t2"])
    if S.get("belt_art"):
        t2.stamp(BODY["front"], S["belt_art"], P, dy=7)
    t2.face(LEG["top"], main, P)
    t2.face(LEG["bottom"], lambda *a: P["o"], P)
    for k in ("right", "front", "left", "back"):
        t2.face(LEG[k], main, P, rows=range(0, 5))
        t2.row(LEG[k], 5, P["t"], P["t2"])
        t2.face(LEG[k], sec, P, rows=range(6, 12))
    if S.get("leg_art"):
        t2.stamp(LEG["right"], S["leg_art"], P)
        t2.stamp(LEG["front"], S["leg_art"], P)
    cutouts(t1.img, t2.img, S.get("cover", "standard"))
    return t1.img, t2.img


def clear(img, rect, cells):
    """Make (u, v) cells of a face see-through so the skin shows."""
    x0, y0, _, _ = rect
    for u, v in cells:
        img.putpixel((x0 + u, y0 + v), (0, 0, 0, 0))


def keep_only(img, rect, keep):
    x0, y0, w, hh = rect
    clear(img, rect, [(u, v) for u in range(w) for v in range(hh) if not keep(u, v)])


def cutouts(l1, l2, cover="standard"):
    """Open the armor up so the skin shows. How much depends on the set:
    full (robes, heavy plate) < standard < light < wraps < harness."""
    if cover == "full":
        clear(l1, ARM["left"], [(u, v) for u in range(4) for v in (5, 6)])       # armpit only
        clear(l2, LEG["left"], [(u, v) for u in range(4) for v in (2, 3)])
        return
    if cover == "standard":
        for k in ("right", "front", "left", "back"):
            clear(l1, ARM[k], [(u, v) for u in range(4) for v in range(4, 8)])    # bare upper arm
        clear(l1, BODY["front"], [(u, 0) for u in range(2, 6)] + [(3, 1), (4, 1)])  # V-neck
        for k in ("right", "left"):                                              # open sides, one strap
            clear(l1, BODY[k], [(u, v) for u in range(4) for v in range(2, 10) if v != 5])
        clear(l1, BODY["back"], [(u, v) for u in range(2, 6) for v in range(1, 3)] + [(3, 3), (4, 3)])
        clear(l2, LEG["left"], [(u, v) for u in range(4) for v in range(12) if v not in (0, 5)])
        clear(l2, LEG["back"], [(u, v) for u in range(4) for v in range(6, 12)])
        clear(l2, LEG["front"], [(u, v) for u in (1, 2) for v in (7, 8, 9)])
    elif cover == "light":
        for k in ("right", "front", "left", "back"):
            clear(l1, ARM[k], [(u, v) for u in range(4) for v in range(2, 9)])    # pauldron cap + bracer
        keep_only(l1, BODY["front"], lambda u, v: v >= 10 or (v <= 6 and not (2 <= u <= 5 and v <= 3)
                                                                 and not (v == 0 and u in (0, 7))))
        keep_only(l1, BODY["back"], lambda u, v: v >= 10 or (3 <= v <= 6))
        for k in ("right", "left"):
            keep_only(l1, BODY[k], lambda u, v: v >= 10 or v in (4, 5))
        clear(l2, LEG["left"], [(u, v) for u in range(4) for v in range(1, 12)])
        clear(l2, LEG["back"], [(u, v) for u in range(4) for v in range(4, 12)])
        clear(l2, LEG["front"], [(u, v) for u in range(4) for v in (6, 7, 8)])
    elif cover == "wraps":
        for k in ("right", "front", "left", "back"):
            clear(l1, ARM[k], [(u, v) for u in range(4) for v in range(0, 8)])    # bare arms, wrapped wrists
        clear(l1, ARM["top"], [(u, v) for u in range(4) for v in range(4)])
        sash = lambda u, v: v >= 10 or abs(u - (1 + v * 0.6)) <= 1.1               # one-shoulder sash
        keep_only(l1, BODY["front"], sash)
        keep_only(l1, BODY["back"], lambda u, v: v >= 10 or abs(u - (6 - v * 0.6)) <= 1.1)
        for k in ("right", "left"):
            keep_only(l1, BODY[k], lambda u, v: v >= 10)
        clear(l1, BODY["top"], [(u, v) for u in range(8) for v in range(4) if u > 2])
        clear(l2, LEG["back"], [(u, v) for u in range(4) for v in range(9, 12)])
    elif cover == "harness":
        for k in ("right", "front", "left", "back"):
            keep_only(l1, ARM[k], lambda u, v: v >= 9 or (v <= 1 and k in ("right", "front", "back")))
        straps = lambda u, v: v >= 10 or abs(u - (0.5 + v * 0.65)) <= 0.8 or abs(u - (6.5 - v * 0.65)) <= 0.8
        keep_only(l1, BODY["front"], straps)
        keep_only(l1, BODY["back"], straps)
        for k in ("right", "left"):
            keep_only(l1, BODY[k], lambda u, v: v >= 10)
        clear(l1, BODY["top"], [(u, v) for u in range(2, 6) for v in range(4)])
        for k in ("front", "back"):                                              # loincloth flaps
            keep_only(l2, BODY[k], lambda u, v: v in (7, 8) or (2 <= u <= 5 and v >= 9))
        for k in ("right", "left"):
            keep_only(l2, BODY[k], lambda u, v: v in (7, 8))
        keep_only(l2, LEG["front"], lambda u, v: v <= 1 or v >= 9)
        keep_only(l2, LEG["right"], lambda u, v: v <= 1 or v >= 9)
        keep_only(l2, LEG["left"], lambda u, v: v >= 10)
        keep_only(l2, LEG["back"], lambda u, v: v <= 1)
        keep_only(l2, LEG["top"], lambda u, v: False)


# --- icons (16x16 on the Lode Studio template silhouettes) ------------------------------
TEMPLATES = {
    "helmet": ["................", "................", "................", ".....ooxxxo.....",
               "....ossshhmo....", "...osWWshhmmo...", "...osWshhmmmo...", "...xssoooobmo...",
               "...xhoGGGGobo...", "...omo....obo...", "...obo....obo...", "....oo....oo....",
               "................", "................", "................", "................"],
    "chestplate": ["................", "................", "..xxxx....xxxx..", ".xWssx....xWssx.",
                   ".xshhhx..xWssbx.", ".xbhhhhxxhhhbbx.", ".xbbhhhAAhhhbbx.", "..obWhhAAhhhbo..",
                   "...oshhhhhhbo...", "...ooGGGGGGoo...", "...obmmhhmmbo...", "...obmhhhhmbo...",
                   "...obmhhhhmbo...", "....obbhhbbo....", ".....oooooo.....", "................"],
    "leggings": ["................", "..xxxx....xxxx..", "..xmbxxxxxxbbx..", "..xGGGGAAGGGGo..",
                 "..xshhhhhhhhmo..", "..xshhhhhhhhmo..", "..xshhhmmhhhmo..", "..xshhmoobhhmo..",
                 "..xshmo..xhhmo..", "..xGGGo..xGGGo..", "..omhmo..ohmmo..", "..obmbo..obmbo..",
                 "..obbbo..obbbo..", "...oooo..oooo...", "................", "................"],
    "boots": ["................", "................", "................", "...xxxx..xxxx...",
              "...xGGo..xGGo...", "...xsmo..xmmo...", "...xsho..xhso...", "...xhmo..xhho...",
              "...xhmo..xhho...", "..xhhmo..xmsmo..", ".xshmmo..xmmhmo.", ".xGGGoo..ooGGGo.",
              ".xooo......oooo.", "................", "................", "................"],
}


def icons(S):
    P = S["pal"]
    key = {"o": P["o"], "x": P["d"], "b": P["d"], "m": P["b"], "h": P["m"], "s": P["l"],
           "W": tuple(min(255, c + 40) for c in P["l"]), "G": P["t"], "A": P["g"]}
    out = {}
    for piece, rows in TEMPLATES.items():
        img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in key:
                    img.putpixel((x, y), key[ch] + (255,))
        for (x, y), k in S.get("icon_extra", {}).get(piece, {}).items():
            img.putpixel((x, y), P[k] + (255,))
        out[piece] = img
    if "look" in S:   # chestplate/leggings/boots icons come from the real textures
        import armor_looks
        l1, l2 = layers(S)
        out = armor_looks.icons_from(l1, l2, P, out["helmet"])
    return out


# --- 3D parts ----------------------------------------------------------------------------
SWATCH_KEYS = ("o", "d", "b", "m", "l", "t", "t2", "a", "g", "s1", "s2")


def atlas(S, l1):
    """64x64: helmet shell faces from layer_1, then an 8x8 swatch per palette
    colour (bevelled), then patterned swatches."""
    P = S["pal"]
    t = Tex(64, 64)
    t.img.paste(l1.crop((0, 0, 32, 16)), (0, 0))
    sw = {}
    for i, k in enumerate(SWATCH_KEYS):
        sx, sy = (i % 8) * 8, 16 + (i // 8) * 8
        c = P[k]
        for j in range(8):
            for q in range(8):
                shade = 1.15 if j == 0 else 0.8 if j == 7 else (0.95 if (q + j) % 5 == 0 else 1.0)
                t.put(sx + q, sy + j, tuple(min(255, int(v * shade)) for v in c))
        sw[k] = (sx, sy, 8, 8)
    for i, name in enumerate(PATTERNS):
        sx, sy = (i % 8) * 8, 32 + (i // 8) * 8
        t.face((sx, sy, 8, 8), PATTERNS[name], P)
        sw["pat_" + name] = (sx, sy, 8, 8)
    return t.img, sw


def part(name, frm, to, mat, glow=False, rot=None):
    return {"name": name, "from": list(frm), "to": list(to), "mat": mat, "glow": glow, "rot": rot}


def mirror(parts):
    out = []
    for p in parts:
        (x0, y0, z0), (x1, y1, z1) = p["from"], p["to"]
        q = dict(p, name=p["name"] + "_l", **{"from": [-x1, y0, z0], "to": [-x0, y1, z1]})
        if p["rot"]:
            ax, ang, (ox, oy, oz) = p["rot"]
            q["rot"] = (ax, -ang if ax in ("y", "z") else ang, (-ox, oy, oz))
        out += [p, q]
    return out


def shell(scale=1.0, lift=0.0):
    """The helmet shell, textured with the painted helmet faces."""
    e = 5 * scale
    return {"name": "shell", "from": [-e, 23 + lift, -e], "to": [e, 23 + lift + 2 * e, e], "mat": None,
            "glow": False, "rot": None,
            "faces": {f: HEAD[k] for f, k in (("north", "front"), ("south", "back"), ("east", "right"),
                                              ("west", "left"), ("up", "top"))}}


def resolve(parts, sw):
    for p in parts:
        if "faces" not in p:
            r = sw[p["mat"]]
            p["faces"] = {f: r for f in ("north", "south", "east", "west", "up", "down")}
    return parts


def hat_model(parts, ref, gui_scale=0.6):
    elements = []
    for p in parts:
        faces = {}
        for f, (x, y, w, hh) in p["faces"].items():
            faces[f] = {"uv": [x / 4, y / 4, (x + w) / 4, (y + hh) / 4], "texture": "#parts"}
            if f == "up" and p["name"] == "shell":
                faces[f]["rotation"] = 180
        e = {"name": p["name"], "from": demon.to_item_space(p["from"]), "to": demon.to_item_space(p["to"]),
             "faces": faces}
        if p["rot"]:
            ax, ang, origin = p["rot"]
            e["rotation"] = {"angle": ang, "axis": ax, "origin": demon.to_item_space(origin)}
        if p["glow"]:
            e["light_emission"] = 15
        elements.append(e)
    k = round(1.6 / demon.ITEM_K, 4)
    return {
        "texture_size": [64, 64],
        "textures": {"parts": ref, "particle": ref},
        "elements": elements,
        "display": {
            "head": {"scale": [k, k, k]},
            "gui": {"rotation": [20, 200, 0], "translation": [0, -1, 0], "scale": [gui_scale] * 3},
            "ground": {"translation": [0, 3, 0], "scale": [0.4] * 3},
            "fixed": {"rotation": [0, 180, 0], "scale": [0.7] * 3},
            "thirdperson_righthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.35] * 3},
            "thirdperson_lefthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.35] * 3},
            "firstperson_righthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.35] * 3},
            "firstperson_lefthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.35] * 3},
        },
    }


# --- ItemsAdder configs ---------------------------------------------------------------------
# 3D helmets are real NETHERITE_HELMETs with an `equipment` block that has no `id`: ItemsAdder then
# shows the 3D model on the head, and vanilla sees a helmet, so it can be enchanted. (Cosmetic hats
# use LEATHER_HORSE_ARMOR and scrolls FLINT rather than PAPER: the server's banknote plugin treats
# every right-clicked PAPER item as a (forged) note.)
# All sets sit a step above netherite (armor 3/8/6/3, toughness 3, 407/592/555/481 durability,
# sword 8): heavier coverage gives more armor, lighter sets lean on their perk.
COVER_STATS = {"full": ((4, 8, 7, 3), 4.0), "standard": ((3, 8, 7, 3), 3.5), "light": ((3, 8, 6, 3), 3.0),
               "wraps": ((3, 8, 6, 3), 3.0), "harness": ((3, 8, 6, 3), 3.0)}
ARMOR_DURA = (480, 700, 655, 570)
TOOLS = ("sword", "axe", "pickaxe", "shovel", "hoe")
TOOL_DAMAGE = {"sword": 9, "axe": 11, "pickaxe": 7, "shovel": 7.5, "hoe": 1}
TOOL_SPEED = {"sword": 1.6, "axe": 1.0, "pickaxe": 1.2, "shovel": 1.0, "hoe": 4.0}
TOOL_DURA, BOW_DURA, SHIELD_DURA = 2600, 700, 1200
# every recipe uses the set's own materials: A (main), B (rare), C (handle) + netherite
RECIPE_SHAPES = {"helmet": ["ABA", "ANA", "XXX"], "chestplate": ["ANA", "ABA", "AAA"],
                 "leggings": ["ABA", "ANA", "AXA"], "boots": ["XNX", "AXA", "BXB"],
                 "sword": ["XBX", "XNX", "XCX"], "axe": ["ABX", "ASX", "XCX"], "pickaxe": ["ABA", "XSX", "XCX"],
                 "shovel": ["XBX", "XSX", "XCX"], "hoe": ["ABX", "XSX", "XCX"], "bow": ["XCT", "BNT", "XCT"],
                 "shield": ["ABA", "ACA", "XAX"]}
SCROLL_SHAPES = {"armor": ["AXA", "PBP", "AXA"], "tools": ["CXC", "PBP", "CXC"], "weapons": ["BXB", "PCP", "BXB"]}
# scrolls take a book, not paper: the server's banknote plugin cancels non-op crafts containing paper
FIXED = {"N": "NETHERITE_INGOT", "S": "NETHERITE_SCRAP", "T": "STRING", "P": "BOOK"}
MAKES = {"armor": ("helmet", "chestplate", "leggings", "boots"), "tools": ("axe", "pickaxe", "shovel", "hoe"),
         "weapons": ("sword", "bow", "shield")}
NAME_FIX = {"DRAGON_BREATH": "Dragon's Breath", "NETHERITE_INGOT": "Netherite Ingot", "TNT": "TNT",
            "HONEY_BOTTLE": "Honey Bottle", "JACK_O_LANTERN": "Jack o'Lantern"}


def mat_name(m):
    return NAME_FIX.get(m) or m.replace("_", " ").title()


def esc(s):
    return s.replace("'", "''")


def ingredients(S, shape):
    keys = sorted({ch for row in shape for ch in row if ch != "X"})
    return {k: FIXED.get(k) or S["recipe"][k] for k in keys}


def all_recipes(S, ns):
    """[(item id, pattern, ingredients)] for the set, scrolls included."""
    out = []
    for item in PIECES + TOOLS + ("bow", "shield"):
        shape = RECIPE_SHAPES[item]
        out.append((f"{S['id']}_{item}", shape, ingredients(S, shape)))
    for kind, shape in SCROLL_SHAPES.items():
        out.append((f"{S['id']}_scroll_{kind}", shape, ingredients(S, shape)))
    return out


def recipe_lore(shape, ing):
    lines = []
    for label, row in zip(("Top", "Middle", "Bottom"), shape):
        cells = [mat_name(ing[ch]) if ch in ing else "empty" for ch in row]
        lines.append("&7" + label + ": &f" + "&7, &f".join(cells))
    return lines


def wrap(text, width=30):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    return lines + [cur] if cur else lines


def scroll_lore(S, kind, story):
    out = ["&f"] + [f"&o&7{line}" for line in wrap(story)]
    c = S["color"]
    for item in MAKES[kind]:
        shape = RECIPE_SHAPES[item]
        out += ["&f", f"{c}Makes: &f{S['name']} {item.capitalize()}"]
        out += recipe_lore(shape, ingredients(S, shape))
    mob, chance = S["mob"]
    out += ["&f", f"&8Craft this scroll, or take it from a {mat_name(mob)}."]
    return out


def ylist(lines, indent="      "):
    return "".join(f"{indent}- '{esc(line)}'\n" for line in lines)


def stats_of(S):
    armor, tough = COVER_STATS[S.get("cover", "standard")]
    return {p: (a, d) for p, a, d in zip(PIECES, armor, ARMOR_DURA)}, tough


PERK_TEXT = {"knockbackResistance": lambda v: f"+{v * 100:g}% knockback resistance",
             "maxHealth": lambda v: f"+{v / 2:g} heart" + ("s" if v > 2 else ""),
             "attackDamage": lambda v: f"+{v:g} attack damage", "luck": lambda v: f"+{v:g} luck",
             "movementSpeed": lambda v: f"+{v / 0.1 * 100:g}% speed", "attackSpeed": lambda v: f"+{v:g} attack speed"}


def perk_text(S):
    perks = ", ".join(PERK_TEXT[k](v) for k, v in S.get("perk", {}).items())
    return f"{S['color']}Perk: &f{perks} per piece"


def configs(S, ns):
    armor, tough = stats_of(S)
    extra = S.get("perk", {})
    lore = "    lore:\n" + ylist(["&f"] + S["lore"] + ["&f", perk_text(S), "&8A step above netherite"])

    items = []
    for piece in PIECES:
        a, dura = armor[piece]
        stat = "".join(f"\n        {k}: {v}" for k, v in
                       {"armor": a, "armorToughness": tough, "knockbackResistance": 0.1, **extra}.items())
        name = f"'{S['color']}{S['name']} {piece.capitalize()}'"
        if piece == "helmet":
            items.append(f"""  {S['id']}_helmet:
    enabled: true
    display_name: {name}
{lore}    resource:
      material: NETHERITE_HELMET
      generate: false
      model_path: item/{S['id']}_helmet
    durability:
      max_custom_durability: {dura}
    equipment:
      slot: HEAD
      slot_attribute_modifiers:{stat}""")
        else:
            items.append(f"""  {S['id']}_{piece}:
    enabled: true
    display_name: {name}
{lore}    resource:
      material: NETHERITE_{piece.upper()}
      generate: true
      textures:
        - item/{S['id']}_{piece}
    durability:
      max_custom_durability: {dura}
    equipment:
      id: {ns}:{S['id']}_armor
      slot: {SLOTS[piece]}
      slot_attribute_modifiers:{stat}""")
    tlore = "    lore:\n" + ylist(["&f"] + S["lore"])
    for tool in TOOLS:
        items.append(f"""  {S['id']}_{tool}:
    enabled: true
    display_name: '{S['color']}{S['name']} {tool.capitalize()}'
{tlore}    resource:
      material: NETHERITE_{tool.upper()}
      model_path: item/{S['id']}_{tool}
      icon: item/{S['id']}_{tool}_icon
    durability:
      max_custom_durability: {TOOL_DURA}
    attribute_modifiers:
      mainhand:
        attackDamage: {TOOL_DAMAGE[tool]}
        attackSpeed: {TOOL_SPEED[tool]}""")
    items.append(f"""  {S['id']}_bow:
    enabled: true
    display_name: '{S['color']}{S['name']} Bow'
{tlore}    resource:
      material: BOW
      generate: false
      model_path: item/{S['id']}_bow
      icon: item/{S['id']}_bow_icon
    durability:
      max_custom_durability: {BOW_DURA}""")
    items.append(f"""  {S['id']}_shield:
    enabled: true
    display_name: '{S['color']}{S['name']} Shield'
{tlore}    resource:
      material: SHIELD
      generate: false
      model_path: item/{S['id']}_shield
    durability:
      max_custom_durability: {SHIELD_DURA}
    attribute_modifiers:
      offhand:
        knockbackResistance: 0.1""")
    loots = []
    for (kind, title), story in zip((("armor", "Armor"), ("tools", "Tools"), ("weapons", "Weapons")), S["story"]):
        sid = f"{S['id']}_scroll_{kind}"
        items.append(f"""  {sid}:
    enabled: true
    display_name: '{S['color']}Scroll of {S['name']} {title}'
    lore:
{ylist(scroll_lore(S, kind, story)).rstrip(chr(10))}
    resource:
      material: FLINT
      generate: true
      textures:
        - item/{S['id']}_scroll_{kind}""")
        mob, chance = S["mob"]
        loots.append(f"""    {sid}:
      enabled: true
      type: {mob}
      items:
        scroll:
          item: {ns}:{sid}
          min_amount: 1
          max_amount: 1
          chance: {chance}""")
    recs = []
    for item, shape, ing in all_recipes(S, ns):
        recs.append(f"""    {item}:
      enabled: true
      pattern:
""" + "".join(f"        - {r}\n" for r in shape) + "      ingredients:\n"
            + "".join(f"        {k}: {v}\n" for k, v in ing.items()) + f"""      result:
        item: {ns}:{item}
        amount: 1""")
    items_yml = f"""info:
  namespace: {ns}
recipes:
  crafting_table:
{chr(10).join(recs)}
items:
{chr(10).join(items)}
"""
    equip_yml = f"""info:
  namespace: {ns}
equipments:
  {S['id']}_armor:
    type: armor
    layer_1: armor/{S['id']}_armor/layer_1
    layer_2: armor/{S['id']}_armor/layer_2
"""
    listed = [f"{S['id']}_scroll_{k}" for k in SCROLL_SHAPES] + [f"{S['id']}_{p}" for p in PIECES] + \
        [f"{S['id']}_{t}" for t in TOOLS] + [f"{S['id']}_bow", f"{S['id']}_shield"]
    cat_yml = f"""info:
  namespace: {ns}
categories:
  {S['id']}:
    enabled: true
    name: '{S['color']}{S['name']}'
    icon: {ns}:{S['id']}_scroll_armor
    permission: ia.menu.{S['id']}
    items:
""" + "".join(f"      - {ns}:{i}\n" for i in listed)
    loots_yml = f"""info:
  namespace: {ns}
loots:
  mobs:
{chr(10).join(loots)}
"""
    return items_yml, equip_yml, cat_yml, loots_yml


def build_set(S, base, write, animate, mcmeta):
    """Write one set's content folder; returns preview material."""
    import build_model
    import crimson_upgrade as CU
    import tool_forge as TF
    from PIL import ImageOps
    ns = S["id"]
    l1, l2 = layers(S)
    write(f"{base}/textures/armor/{ns}_armor/layer_1.png", l1)
    write(f"{base}/textures/armor/{ns}_armor/layer_2.png", l2)
    ics = icons(S)
    for piece in PIECES[1:]:
        write(f"{base}/textures/item/{ns}_{piece}.png", ics[piece])
    at, sw = atlas(S, l1)
    parts = resolve(S["helmet"](), sw)
    write(f"{base}/textures/item/{ns}_parts.png", animate(at, {S["pal"]["g"]}))
    write(f"{base}/textures/item/{ns}_parts.png.mcmeta", mcmeta)
    write(f"{base}/models/item/{ns}_helmet.json", hat_model(parts, f"{ns}:item/{ns}_parts", S.get("gui_scale", 0.6)))
    # tools + bow, drawn by the tool forge in the set's own style
    T = S["tools"]
    P = TF.Pal(T)
    sets = dict(glow=P.glow_set(), thick=P.thick_set(), grip=P.grip_set())
    tool_imgs = {}
    for tool in TOOLS:
        tex = TF.tool(T, tool)
        tool_imgs[tool] = tex
        ref = f"{ns}:item/{ns}_{tool}"
        write(f"{base}/textures/item/{ns}_{tool}.png", animate(tex, P.glow_set(), P.shimmer_set()))
        write(f"{base}/textures/item/{ns}_{tool}.png.mcmeta", mcmeta)
        write(f"{base}/textures/item/{ns}_{tool}_icon.png", tex)
        write(f"{base}/models/item/{ns}_{tool}.json", {
            "texture_size": list(tex.size), "textures": {"layer0": ref, "particle": ref}, "gui_light": "front",
            "elements": CU.tool_elements(tex, **sets), "display": build_model.handheld()})
    for state, suffix in (("bow", ""), ("bow_pulling_0", "_0"), ("bow_pulling_1", "_1"), ("bow_pulling_2", "_2")):
        tex = ImageOps.mirror(TF.bow(T, state))   # vanilla orientation: arrow to the top-left
        name = f"{ns}_bow{suffix}"
        ref = f"{ns}:item/{name}"
        if not suffix:
            tool_imgs["bow"] = TF.bow(T, state)
            write(f"{base}/textures/item/{name}_icon.png", tex)
        write(f"{base}/textures/item/{name}.png", animate(tex, P.glow_set(), P.shimmer_set()))
        write(f"{base}/textures/item/{name}.png.mcmeta", mcmeta)
        write(f"{base}/models/item/{name}.json", {
            "texture_size": list(tex.size), "textures": {"layer0": ref, "particle": ref}, "gui_light": "front",
            "elements": CU.tool_elements(tex, flat=True, glow=P.glow_set()), "display": build_model.BOW_DISPLAY})
    import shield_forge as SF   # 3D shield in the set's colours; <id>_shield_blocking is the blocking pose
    shield_tex = SF.texture(S, S.get("shield", "heater"))
    tool_imgs["shield"] = shield_tex.crop((0, 0, SF.W, SF.H))
    write(f"{base}/textures/item/{ns}_shield.png", animate(shield_tex, {S["pal"]["g"]}))
    write(f"{base}/textures/item/{ns}_shield.png.mcmeta", mcmeta)
    held, blocking = SF.models(f"{ns}:item/{ns}_shield")
    write(f"{base}/models/item/{ns}_shield.json", held)
    write(f"{base}/models/item/{ns}_shield_blocking.json", blocking)
    import scroll_art as SA
    for kind in SCROLL_SHAPES:   # each set has its own scroll form; also the /ia category icon
        write(f"{base}/textures/item/{ns}_scroll_{kind}.png", SA.icon(S, kind))
    items_yml, equip_yml, cat_yml, loots_yml = configs(S, ns)
    write(f"{base}/configs/items.yml", items_yml)
    write(f"{base}/configs/equipments.yml", equip_yml)
    write(f"{base}/configs/categories.yml", cat_yml)
    write(f"{base}/configs/loots.yml", loots_yml)
    return l1, l2, at, parts, [ics[p] for p in PIECES], tool_imgs
