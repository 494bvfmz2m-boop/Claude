"""Crimson upgrades: 3D tool models with depth + emissive glow, and a
head-worn 3D Crimson helmet with branches growing from the shoulder blades.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "crimson_armor"))
sys.path.insert(0, os.path.join(ROOT, "demon_armor"))

import generate as C   # noqa: E402  crimson palette
import demon           # noqa: E402  shared player/item-space helpers

GLOW = {C.VEIN, C.GLOW, C.SHROOM, C.WART_L, (255, 214, 190)}
GOLDS = {C.GOLD, C.GOLD_L, C.GOLD_D}
POMMEL = {C.SHROOM}
GRIP = {C.STEM, C.STEM_L, C.STEM_D}


def r(v):
    return round(v, 4)


def depth(c):
    """Front/back z per colour class: gold fittings stand proud, grips are
    rounder, the blade stays a thin 1px slab."""
    if c in GOLDS:
        return 7.0, 9.0
    if c in POMMEL:
        return 7.1, 8.9
    if c in GRIP:
        return 7.25, 8.75
    return 7.5, 8.5


def tool_elements(tex, flat=False):
    n = tex.size[0]
    u = 16 / n
    px = tex.load()
    els = []
    for y in range(n):
        x = 0
        while x < n:
            if px[x, y][3] == 0:
                x += 1
                continue
            dz = (lambda c: (7.5, 8.5)) if flat else depth
            z0, z1 = dz(px[x, y][:3])
            x0 = x
            while x < n and px[x, y][3] and dz(px[x, y][:3]) == (z0, z1):
                x += 1
            strip = [r(x0 * u), r(y * u), r(x * u), r((y + 1) * u)]
            els.append({
                "from": [r(x0 * u), r(16 - (y + 1) * u), z0],
                "to": [r(x * u), r(16 - y * u), z1],
                "faces": {
                    "south": {"uv": strip, "texture": "#layer0"},
                    "north": {"uv": [strip[2], strip[1], strip[0], strip[3]], "texture": "#layer0"},
                    "up": {"uv": strip, "texture": "#layer0"},
                    "down": {"uv": strip, "texture": "#layer0"},
                    "west": {"uv": [r(x0 * u), strip[1], r((x0 + 1) * u), strip[3]], "texture": "#layer0"},
                    "east": {"uv": [r((x - 1) * u), strip[1], r(x * u), strip[3]], "texture": "#layer0"},
                },
            })
    # emissive overlays: glowing pixels stay full-bright in the dark
    for y in range(n):
        x = 0
        while x < n:
            if not (px[x, y][3] and px[x, y][:3] in GLOW):
                x += 1
                continue
            x0 = x
            while x < n and px[x, y][3] and px[x, y][:3] in GLOW:
                x += 1
            z0, z1 = (7.5, 8.5) if flat else depth(px[x0, y][:3])
            strip = [r(x0 * u), r(y * u), r(x * u), r((y + 1) * u)]
            y0, y1 = r(16 - (y + 1) * u), r(16 - y * u)
            els.append({"from": [r(x0 * u), y0, z1 + 0.01], "to": [r(x * u), y1, z1 + 0.01],
                        "light_emission": 15, "faces": {"south": {"uv": strip, "texture": "#layer0"}}})
            els.append({"from": [r(x0 * u), y0, z0 - 0.01], "to": [r(x * u), y1, z0 - 0.01],
                        "light_emission": 15,
                        "faces": {"north": {"uv": [strip[2], strip[1], strip[0], strip[3]], "texture": "#layer0"}}})
    return els


# --- 3D helmet -----------------------------------------------------------
SW = {"stem": (0, 16), "stem_l": (8, 16), "leaf": (16, 16), "bud": (24, 16), "gold": (32, 16)}
EYES = (32, 0)   # 8x8: only the visor's glowing eye pixels, for the emissive plane


def atlas(layer1):
    t = demon.Tex(64, 64)
    t.img.paste(layer1.crop((0, 0, 32, 16)), (0, 0))
    front = layer1.crop((8, 8, 16, 16)).convert("RGBA")
    eyes = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    for y in range(8):
        for x in range(8):
            p = front.getpixel((x, y))
            if p[:3] in (C.VEIN, C.GLOW):
                eyes.putpixel((x, y), p)
    t.img.paste(eyes, EYES)

    def swatch(name, fn):
        sx, sy = SW[name]
        for j in range(8):
            for i in range(8):
                t.put(sx + i, sy + j, fn(i, j))

    swatch("stem", lambda i, j: C.STEM_D if j % 3 == 0 else (C.STEM_L if i < 2 else C.STEM))
    swatch("stem_l", lambda i, j: C.STEM if j % 3 == 0 else (C.STEM_L if i < 3 else C.STEM))
    swatch("leaf", lambda i, j: C.WART_L if (i + j) % 3 else C.WART)
    swatch("bud", lambda i, j: C.SHROOM if 1 <= i <= 6 and 1 <= j <= 6 else C.GLOW)
    swatch("gold", lambda i, j: C.GOLD_L if j < 2 else (C.GOLD if j < 6 else C.GOLD_D))
    return t.img


def part(name, frm, to, mat=None, faces=None, glow=False):
    return {"name": name, "from": list(frm), "to": list(to), "mat": mat, "faces": faces, "glow": glow}


def mirror(p):
    (x0, y0, z0), (x1, y1, z1) = p["from"], p["to"]
    return dict(p, name=p["name"].replace("right", "left"), **{"from": [-x1, y0, z0], "to": [-x0, y1, z1]})


def helmet_parts():
    H = demon.HEAD
    parts = [
        part("shell", (-5, 23, -5), (5, 33, 5), faces={
            f: H[k] for f, k in (("north", "front"), ("south", "back"), ("east", "right"),
                                 ("west", "left"), ("up", "top"))}),
        part("eyes", (-5, 23, -5.03), (5, 33, -5.03), faces={"north": (EYES[0], EYES[1], 8, 8)}, glow=True),
        part("crest", (-0.7, 33, -5.4), (0.7, 34.4, 4.2), "gold"),
        part("crest_peak", (-0.5, 34.4, -3.5), (0.5, 35.2, 1.5), "gold"),
    ]
    branch = [  # right branch, growing out of the shoulder blade behind the helmet
        ("right_branch_0", (1, 19, 3), (2.6, 22, 4.6), "stem"),
        ("right_branch_1", (1.8, 21.5, 3.8), (3.4, 24.5, 5.4), "stem"),
        ("right_branch_2", (2.8, 24, 4.4), (4.4, 27, 6), "stem"),
        ("right_branch_3", (3.8, 26.5, 4.8), (5.2, 29.5, 6.2), "stem_l"),
        ("right_fork_out_0", (5, 28.5, 5), (7, 30, 6.2), "stem_l"),
        ("right_fork_out_1", (6.8, 29.5, 5.2), (8.6, 31.5, 6.2), "stem_l"),
        ("right_fork_out_2", (8.4, 31, 5.3), (9.6, 33.5, 6.1), "stem_l"),
        ("right_fork_up_0", (4, 29.3, 5), (5.2, 32.5, 6), "stem_l"),
        ("right_fork_up_1", (4.3, 32.3, 5.2), (5.3, 35, 6.1), "stem_l"),
        ("right_twig", (3.2, 25, 6), (4.2, 26, 7.5), "stem"),
        ("right_leaf_0", (6, 30.8, 4.6), (7.2, 31.8, 5.4), "leaf"),
        ("right_leaf_1", (3.4, 30, 5.8), (4.4, 31, 6.8), "leaf"),
        ("right_leaf_2", (5.4, 27, 5.8), (6.4, 28, 6.6), "leaf"),
    ]
    buds = [
        ("right_bud_out", (8.5, 33.3, 5.1), (9.7, 34.5, 6.3)),
        ("right_bud_up", (4.2, 34.8, 5), (5.4, 36, 6.2)),
        ("right_bud_twig", (3.1, 25.5, 7.4), (4.3, 26.7, 8.4)),
    ]
    for name, f, t, m in branch:
        p = part(name, f, t, m)
        parts += [p, mirror(p)]
    for name, f, t in buds:
        p = part(name, f, t, "bud", glow=True)
        parts += [p, mirror(p)]
    return parts


def face_rects(p):
    if p["faces"]:
        return p["faces"]
    sx, sy = SW[p["mat"]]
    return {f: (sx, sy, 8, 8) for f in ("north", "south", "east", "west", "up", "down")}


def helmet_model(ref):
    elements = []
    for p in helmet_parts():
        faces = {}
        for f, (x, y, w, h) in face_rects(p).items():
            faces[f] = {"uv": [x / 4, y / 4, (x + w) / 4, (y + h) / 4], "texture": "#parts"}
            if f == "up" and p["name"] == "shell":
                faces[f]["rotation"] = 180
        e = {"name": p["name"], "from": demon.to_item_space(p["from"]),
             "to": demon.to_item_space(p["to"]), "faces": faces}
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
            "gui": {"rotation": [20, 200, 0], "translation": [0, -0.5, 0], "scale": [0.62, 0.62, 0.62]},
            "ground": {"translation": [0, 3, 0], "scale": [0.45, 0.45, 0.45]},
            "fixed": {"rotation": [0, 180, 0], "scale": [0.8, 0.8, 0.8]},
        },
    }
