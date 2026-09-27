"""Webstore accessories: cosmetic head-worn 3D models (no stats) in their own
content folder, `slothsmp-accessories`."""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "demon_armor"))
import demon          # noqa: E402
import recipe_book    # noqa: E402  (blue recolour)

NS = "slothsmp-accessories"
SW = {"gold": (0, 0), "gold_l": (8, 0), "gem": (16, 0), "halo": (24, 0), "horn": (32, 0), "horn_tip": (40, 0),
      "witch": (48, 0), "band": (56, 0), "buckle": (0, 8), "witch_d": (8, 8)}
WINGS = {"crimson": (0, 32), "spectral": (32, 32)}
GLOW = {(255, 70, 60), (255, 150, 130), (255, 250, 200), (255, 230, 120), (150, 230, 255), (220, 250, 255)}


def atlas():
    t = demon.Tex(64, 64)

    def swatch(name, fn):
        sx, sy = SW[name]
        for j in range(8):
            for i in range(8):
                t.put(sx + i, sy + j, fn(i, j))

    swatch("gold", lambda i, j: (196, 142, 44) if j % 4 else (150, 100, 30))
    swatch("gold_l", lambda i, j: (246, 204, 96) if j < 5 else (196, 142, 44))
    swatch("gem", lambda i, j: (255, 150, 130) if i + j < 6 else (255, 70, 60))
    swatch("halo", lambda i, j: (255, 250, 200) if (i + j) % 3 else (255, 230, 120))
    swatch("horn", lambda i, j: (150, 20, 26) if j % 3 else (110, 12, 18))
    swatch("horn_tip", lambda i, j: (30, 16, 18) if j % 3 else (60, 30, 30))
    swatch("witch", lambda i, j: (46, 24, 60) if (i * 3 + j) % 7 else (64, 36, 84))
    swatch("band", lambda i, j: (120, 40, 150) if 1 <= j <= 6 else (80, 24, 100))
    swatch("buckle", lambda i, j: (246, 204, 96) if i in (0, 7) or j in (0, 7) else (46, 24, 60))
    swatch("witch_d", lambda i, j: (30, 14, 40))
    wing = demon.wing_texture()
    t.img.paste(wing, WINGS["crimson"])
    spectral = recipe_book.recolor_blue(wing)
    px = spectral.load()
    for y in range(32):
        for x in range(32):
            r, g, b, a = px[x, y]
            if a and b > 150 and r < 120:
                px[x, y] = (150, 230, 255, a)   # glowing membrane
    t.img.paste(spectral, WINGS["spectral"])
    return t.img


def box(name, frm, to, mat, glow=False):
    sx, sy = SW[mat]
    return {"name": name, "from": list(frm), "to": list(to), "glow": glow,
            "faces": {f: (sx, sy, 8, 8) for f in ("north", "south", "east", "west", "up", "down")}}


def mirrored(parts):
    out = []
    for p in parts:
        (x0, y0, z0), (x1, y1, z1) = p["from"], p["to"]
        out += [p, dict(p, name=p["name"] + "_l", **{"from": [-x1, y0, z0], "to": [-x0, y1, z1]})]
    return out


def wing_parts(img, key, glow=False):
    ax, ay = WINGS[key]
    s, X0, Y0, Z0, Z1 = 0.5, 1.5, 33.0, 3.3, 3.8
    parts = []
    for r in range(32):
        c = 0
        while c < 32:
            if img.getpixel((ax + c, ay + r))[3] == 0:
                c += 1
                continue
            c0 = c
            while c < 32 and img.getpixel((ax + c, ay + r))[3] > 0:
                c += 1
            u, v, ln = ax + c0, ay + r, c - c0
            fwd, rev = (u, v, ln, 1), (u + ln, v, -ln, 1)
            x0, x1, y0, y1 = X0 + c0 * s, X0 + c * s, Y0 - (r + 1) * s, Y0 - r * s
            ends = {"up": fwd, "down": fwd, "east": (u + ln - 1, v, 1, 1), "west": (u, v, 1, 1)}
            parts.append({"name": f"wing_r_{r}_{c0}", "from": [x0, y0, Z0], "to": [x1, y1, Z1], "glow": glow,
                          "faces": {"south": fwd, "north": rev, **ends}})
            parts.append({"name": f"wing_l_{r}_{c0}", "from": [-x1, y0, Z0], "to": [-x0, y1, Z1], "glow": glow,
                          "faces": {"south": rev, "north": fwd, "up": rev, "down": rev,
                                    "east": ends["west"], "west": ends["east"]}})
    return parts


def accessories(img):
    crown = [box("band_n", (-5.3, 32.2, -5.3), (5.3, 34, -4.7), "gold"),
             box("band_s", (-5.3, 32.2, 4.7), (5.3, 34, 5.3), "gold"),
             box("band_e", (4.7, 32.2, -4.7), (5.3, 34, 4.7), "gold"),
             box("band_w", (-5.3, 32.2, -4.7), (-4.7, 34, 4.7), "gold"),
             box("spike_front", (-0.6, 34, -5.3), (0.6, 36.4, -4.7), "gold_l"),
             box("spike_back", (-0.6, 34, 4.7), (0.6, 35.6, 5.3), "gold_l"),
             box("gem_front", (-0.7, 32.6, -5.45), (0.7, 33.7, -5.3), "gem", glow=True),
             box("gem_back", (-0.7, 32.6, 5.3), (0.7, 33.7, 5.45), "gem", glow=True)]
    crown += mirrored([box("spike_side", (2.6, 34, -5.3), (3.6, 35.4, -4.7), "gold_l"),
                       box("spike_flank", (4.7, 34, -0.6), (5.3, 35.6, 0.6), "gold_l"),
                       box("gem_side", (5.3, 32.6, -0.7), (5.45, 33.7, 0.7), "gem", glow=True)])
    halo = [box("halo_n", (-3.6, 36.2, -4), (3.6, 36.8, -3.2), "halo", glow=True),
            box("halo_s", (-3.6, 36.2, 3.2), (3.6, 36.8, 4), "halo", glow=True),
            box("halo_e", (3.2, 36.2, -3.2), (4, 36.8, 3.2), "halo", glow=True),
            box("halo_w", (-4, 36.2, -3.2), (-3.2, 36.8, 3.2), "halo", glow=True)]
    horns = mirrored([box("horn_0", (2.6, 32.8, -2), (4, 34.6, -0.5), "horn"),
                      box("horn_1", (3.1, 34.3, -1.9), (4.3, 35.9, -0.7), "horn"),
                      box("horn_2", (3.5, 35.6, -2.4), (4.3, 36.9, -1.5), "horn_tip")])
    witch = [box("brim", (-7, 32.8, -7), (7, 33.3, 7), "witch"),
             box("cone_0", (-4.5, 33.3, -4.5), (4.5, 35.5, 4.5), "witch"),
             box("band", (-4.62, 33.3, -4.62), (4.62, 34.2, 4.62), "band"),
             box("buckle", (-1, 33.2, -4.8), (1, 34.3, -4.62), "buckle"),
             box("cone_1", (-3.5, 35.5, -3.2), (3.5, 37.5, 3.8), "witch"),
             box("cone_2", (-2.4, 37.5, -1.8), (2.6, 39.5, 3.2), "witch"),
             box("cone_3", (-1.3, 39.5, -0.2), (1.7, 41.2, 2.8), "witch_d"),
             box("tip", (-0.4, 40.8, 2.2), (1.2, 42.4, 4.4), "witch_d")]
    return {
        "crimson_crown": ("&6Crimson Crown", "A crown for the forge's champion.", crown),
        "halo": ("&eHalo", "Glows even in the Nether.", halo),
        "devil_horns": ("&cDevil Horns", "Small, but they mean it.", horns),
        "witch_hat": ("&5Witch Hat", "Comes with a faint smell of cauldron.", witch),
        "crimson_wings": ("&4Crimson Wings", "Bat wings of blood-red leather.", wing_parts(img, "crimson")),
        "spectral_wings": ("&bSpectral Wings", "Cold light that never fades.", wing_parts(img, "spectral", glow=True)),
    }


def model(parts, ref):
    elements = []
    for p in parts:
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
            "gui": {"rotation": [20, 200, 0], "translation": [0, -2, 0], "scale": [0.6, 0.6, 0.6]},
            "ground": {"translation": [0, 3, 0], "scale": [0.4, 0.4, 0.4]},
            "fixed": {"rotation": [0, 180, 0], "scale": [0.7, 0.7, 0.7]},
            "thirdperson_righthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.35, 0.35, 0.35]},
            "thirdperson_lefthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.35, 0.35, 0.35]},
            "firstperson_righthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.35, 0.35, 0.35]},
            "firstperson_lefthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.35, 0.35, 0.35]},
        },
    }


def build(base, write, animate, mcmeta):
    img = atlas()
    write(f"{base}/textures/item/accessories/parts.png", animate(img, GLOW))
    write(f"{base}/textures/item/accessories/parts.png.mcmeta", mcmeta)
    ref = f"{NS}:item/accessories/parts"
    items, ids = [], []
    for aid, (name, flavour, parts) in accessories(img).items():
        write(f"{base}/models/item/accessories/{aid}.json", model(parts, ref))
        ids.append(aid)
        items.append(f"""  {aid}:
    enabled: true
    display_name: '{name}'
    lore:
      - '&f'
      - '&7{flavour.replace("'", "''")}'
      - '&f'
      - '&dWebstore Exclusive'
      - '&8Cosmetic - no stats'
    permission: {NS}.{aid}
    behaviours:
      hat: true
    resource:
      material: PAPER
      generate: false
      model_path: item/accessories/{aid}""")
    write(f"{base}/configs/items.yml", f"""info:
  namespace: {NS}
items:
{chr(10).join(items)}
""")
    write(f"{base}/configs/categories.yml", f"""info:
  namespace: {NS}
categories:
  webstore_accessories:
    enabled: true
    name: '&dWebstore Accessories'
    icon: {NS}:crimson_crown
    permission: ia.menu.webstore_accessories
    items:
""" + "".join(f"      - {NS}:{i}\n" for i in ids))
    return ids
