"""Halloween tier: pumpkin-orange / black / purple recolour with green trim,
and a head-worn 3D jack-o'-lantern helmet with a glowing carved face."""
import colorsys
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "demon_armor"))
import demon  # noqa: E402  shared player/item-space helpers

GOLDS = {(196, 142, 44), (246, 204, 96), (120, 72, 22)}
ORANGE = [(92, 34, 6), (150, 62, 10), (206, 98, 16), (240, 140, 30), (255, 184, 70)]
CANDLE = [(255, 214, 90), (255, 244, 160)]
RIND_D = (28, 12, 34)
STEM = [(58, 70, 24), (86, 104, 34), (120, 140, 50)]
VINE = [(36, 92, 30), (60, 140, 44), (100, 190, 70)]


def hv(c):
    if c in GOLDS:                       # gold trim -> sickly green
        h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
        return colorsys.hsv_to_rgb(0.30, min(1, s * 0.9), v)
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
    deg = h * 360
    if deg <= 20 or deg >= 300:
        if v < 0.36:                     # dark crimson -> purple-black
            return colorsys.hsv_to_rgb(275 / 360, s * 0.55, v * 0.9)
        if deg >= 300:                   # stem pinks -> deep purple
            return colorsys.hsv_to_rgb(282 / 360, min(1, s * 1.1), v * 0.8)
        return colorsys.hsv_to_rgb(26 / 360, min(1, s * 1.05 + 0.1), min(1, v * 1.05))  # pumpkin
    if deg < 60:                         # orange glow -> candle yellow
        return colorsys.hsv_to_rgb(48 / 360, s * 0.8, 1.0)
    return colorsys.rgb_to_hsv(*(x / 255 for x in c)) and colorsys.hsv_to_rgb(h, s, v)


def recolor(img):
    img = img.convert("RGBA")
    out = img.copy()
    px, cache = out.load(), {}
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            r, g, b, a = px[x, y]
            if a:
                if (r, g, b) not in cache:
                    cache[r, g, b] = tuple(round(v * 255) for v in hv((r, g, b)))
                px[x, y] = cache[r, g, b] + (a,)
    return out


# --- jack-o'-lantern helmet ----------------------------------------------------
def _face():
    """16x16 carved face, kept inside columns 3..12 so it fits the front bulge."""
    holes = {(5, 3), (10, 3)} | {(x, y) for y in (4, 5) for x in (4, 5, 6, 9, 10, 11)} | {(7, 7), (8, 7)}
    holes |= {(3, 9), (12, 9)} | {(x, 10) for x in (3, 4, 6, 7, 8, 9, 11, 12)}
    holes |= {(x, 11) for x in range(4, 12)} | {(x, 12) for x in (5, 6, 9, 10)}
    return ["".join("#" if (x, y) in holes else "." for x in range(16)) for y in range(16)]


FACE = _face()
# front-bulge footprint on the 16x16 front face: x -3.2..3.2, y 23.6..32.4 of the 10-unit head
BULGE_UV = (2.88, 0.96, 10.24, 14.08)
REG = {"front": (0, 0), "side": (16, 0), "top": (32, 0), "glow": (48, 0),
       "stem": (0, 16), "vine": (8, 16), "leaf": (16, 16), "membrane": (24, 16), "bone": (32, 16),
       "mini": (40, 16), "mini_face": (48, 16)}
MEMBRANE = [(40, 16, 56), (70, 30, 90)]
BONE = [(230, 220, 195), (180, 170, 145)]


def rind(t, x0, y0, carved=False, top=False):
    for y in range(16):
        for x in range(16):
            rib = x % 4 in (0, 3)
            shade = ORANGE[1] if rib else ORANGE[2]
            if (x + y * 3) % 11 == 0:
                shade = ORANGE[3]
            if top and abs(x - 7.5) < 2 and abs(y - 7.5) < 2:
                shade = STEM[0]
            if y in (0, 15) or x in (0, 15):
                shade = ORANGE[0]
            if carved and FACE[y][x] == "#":
                shade = RIND_D
            t.put(x0 + x, y0 + y, shade)


def atlas():
    t = demon.Tex(64, 64)
    rind(t, *REG["front"], carved=True)
    rind(t, *REG["side"])
    rind(t, *REG["top"], top=True)
    gx, gy = REG["glow"]
    for y in range(16):
        for x in range(16):
            if FACE[y][x] == "#":
                t.put(gx + x, gy + y, CANDLE[1] if (x + y) % 3 else CANDLE[0])
    for name, pal in (("stem", STEM), ("vine", VINE)):
        sx, sy = REG[name]
        for y in range(8):
            for x in range(8):
                t.put(sx + x, sy + y, pal[2] if x < 2 else pal[1] if y % 3 else pal[0])
    lx, ly = REG["leaf"]
    for y in range(8):
        for x in range(8):
            t.put(lx + x, ly + y, VINE[2] if (x + y) % 3 == 0 else VINE[1])
    for name, fn in (("membrane", lambda x, y: MEMBRANE[1] if (x + y) % 4 else MEMBRANE[0]),
                     ("bone", lambda x, y: BONE[0] if y < 6 else BONE[1]),
                     ("mini", lambda x, y: ORANGE[1] if x % 3 == 0 else ORANGE[2]),
                     ("mini_face", lambda x, y: CANDLE[1] if (x, y) in {(1, 2), (2, 2), (5, 2), (6, 2), (1, 5), (2, 6),
                                                                      (3, 6), (4, 6), (5, 6), (6, 5)}
                      else (ORANGE[1] if x % 3 == 0 else ORANGE[2]))):
        sx, sy = REG[name]
        for y in range(8):
            for x in range(8):
                t.put(sx + x, sy + y, fn(x, y))
    return t.img


def _uv(reg, w=16, h=16):
    x, y = REG[reg]
    return (x, y, w, h)


def parts():
    F, S, T = _uv("front"), _uv("side"), _uv("top")
    fx, fy = REG["front"]
    bulge_front = (fx + BULGE_UV[0], fy + BULGE_UV[1], BULGE_UV[2], BULGE_UV[3])
    gx, gy = REG["glow"]
    bulge_glow = (gx + BULGE_UV[0], gy + BULGE_UV[1], BULGE_UV[2], BULGE_UV[3])
    body = {"north": S, "south": S, "east": S, "west": S, "up": T, "down": S}
    side = {"north": S, "south": S, "east": S, "west": S, "up": T, "down": S}
    P = []

    def add(name, frm, to, faces=None, mat=None, glow=False):
        P.append({"name": name, "from": list(frm), "to": list(to), "glow": glow,
                  "faces": faces or {f: _uv(mat, 8, 8) for f in ("north", "south", "east", "west", "up", "down")}})

    add("rind_core", (-5, 23, -5), (5, 33, 5), body)
    add("rind_bulge_fb", (-3.2, 23.6, -5.5), (3.2, 32.4, 5.5), {**side, "north": bulge_front})
    add("rind_bulge_lr", (-5.5, 23.6, -3.2), (5.5, 32.4, 3.2), side)
    add("rind_cap", (-4, 33, -4), (4, 33.7, 4), side)
    add("face_glow", (-3.2, 23.6, -5.53), (3.2, 32.4, -5.53), {"north": bulge_glow}, glow=True)
    add("stem_0", (-0.8, 33.6, -0.8), (0.8, 35.8, 0.8), mat="stem")
    add("stem_1", (-0.4, 35.3, -0.6), (1.8, 36.3, 0.6), mat="stem")
    for i, (f, t) in enumerate((((0.8, 33.7, -0.3), (3.2, 34.3, 0.3)), ((3, 33.4, -0.3), (3.6, 34.3, 1.8)),
                                ((3.3, 33.5, 1.6), (4.8, 34.1, 2.2)), ((-3, 33.7, -0.3), (-0.8, 34.3, 0.3)),
                                ((-3.4, 33.4, -2.2), (-2.8, 34.3, -0.2)), ((-4.8, 33.5, -2.6), (-3.2, 34.1, -2)))):
        add(f"vine_{i}", f, t, mat="vine")
    add("leaf_0", (1.4, 34.1, -1.4), (2.8, 34.5, 0.2), mat="leaf")
    add("leaf_1", (-2.6, 34.1, 0.2), (-1.2, 34.5, 1.6), mat="leaf")
    M = {f: _uv("mini", 8, 8) for f in ("south", "east", "west", "up", "down")}
    for sx in (1, -1):      # extensions: bat wings on the back, mini jack-o'-lanterns on the shoulders
        def X(a, b):
            return (a, b) if sx > 0 else (-b, -a)
        x0, x1 = X(3.8, 8.6)
        add(f"shoulder_pumpkin_{sx}", (x0, 25, -2.4), (x1, 28.4, 2.4), {**M, "north": _uv("mini_face", 8, 8)})
        x0, x1 = X(5.8, 6.6)
        add(f"shoulder_stem_{sx}", (x0, 28.4, -0.4), (x1, 29.4, 0.4), mat="stem")
        x0, x1 = X(1.5, 9)
        add(f"wing_bone_{sx}", (x0, 25.6, 3.4), (x1, 26.4, 4.2), mat="bone")
        x0, x1 = X(8.5, 10.5)
        add(f"wing_tip_{sx}", (x0, 26, 3.4), (x1, 29.5, 4.2), mat="bone")
        x0, x1 = X(1.5, 9)
        add(f"wing_membrane_{sx}", (x0, 20.5, 3.6), (x1, 25.6, 4), mat="membrane")
        x0, x1 = X(9, 10.5)
        add(f"wing_membrane_outer_{sx}", (x0, 22.5, 3.6), (x1, 26, 4), mat="membrane")
        x0, x1 = X(4.8, 5.4)
        add(f"wing_finger_{sx}", (x0, 21, 3.5), (x1, 25.6, 4.1), mat="bone")
    return P


def helmet_model(ref):
    elements = []
    for p in parts():
        faces = {f: {"uv": [x / 4, y / 4, (x + w) / 4, (y + h) / 4], "texture": "#parts"}
                 for f, (x, y, w, h) in p["faces"].items()}
        e = {"name": p["name"], "from": demon.to_item_space(p["from"]), "to": demon.to_item_space(p["to"]),
             "faces": faces}
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
            "thirdperson_righthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.45, 0.45, 0.45]},
            "thirdperson_lefthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.45, 0.45, 0.45]},
            "firstperson_righthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.45, 0.45, 0.45]},
            "firstperson_lefthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.45, 0.45, 0.45]},
            "gui": {"rotation": [20, 200, 0], "translation": [0, 0, 0], "scale": [0.72, 0.72, 0.72]},
            "ground": {"translation": [0, 3, 0], "scale": [0.45, 0.45, 0.45]},
            "fixed": {"rotation": [0, 180, 0], "scale": [0.8, 0.8, 0.8]},
        },
    }


GLOW = set(CANDLE)


def icon():
    rows = [
        "................", ".......gg.......", "......gGo.......", "....oooooooo....",
        "...oOoOOoOoOo...", "..oOOoOOoOOoOo..", "..oyyoOOoOyyoo..", "..oOOoyyoOOoOo..",
        "..oOoOOoOOoOOo..", "..oyOyyyyyyOyo..", "..oOyyyyyyyyOo..", "..oOOoyOOyoOOo..",
        "...oOoOOoOoOo...", "....oooooooo....", "................", "................"]
    key = {"o": ORANGE[0], "O": ORANGE[2], "y": CANDLE[1], "g": STEM[1], "G": STEM[2]}
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key:
                img.putpixel((x, y), key[ch] + (255,))
    return img
