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
W, H = 64, 96
SW = {"gold": (0, 0), "gold_l": (8, 0), "gem": (16, 0), "halo": (24, 0), "horn": (32, 0), "horn_tip": (40, 0),
      "witch": (48, 0), "band": (56, 0), "buckle": (0, 8), "witch_d": (8, 8), "ice": (16, 8), "ice_glow": (24, 8),
      "silver": (32, 8), "flame": (40, 8), "flame_core": (48, 8), "pink": (56, 8), "white": (0, 16),
      "black": (8, 16), "hat": (16, 16), "red_band": (24, 16), "phones": (32, 16), "light": (40, 16),
      "iron": (48, 16), "ivory": (56, 16), "gem_blue": (0, 24)}
WINGS = {"crimson": (0, 32), "spectral": (32, 32), "angel": (0, 64)}
GLOW = {(255, 70, 60), (255, 150, 130), (255, 250, 200), (255, 230, 120), (150, 230, 255), (220, 250, 255),
        (120, 240, 255), (255, 170, 40), (255, 240, 150), (255, 90, 220), (90, 255, 240), (255, 244, 214)}


def atlas():
    t = demon.Tex(W, H)

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
    swatch("ice", lambda i, j: (190, 232, 255) if i < 3 else (110, 180, 240) if j % 3 else (70, 140, 220))
    swatch("ice_glow", lambda i, j: (120, 240, 255) if (i + j) % 3 else (220, 250, 255))
    swatch("silver", lambda i, j: (220, 228, 240) if j < 3 else (160, 170, 190))
    swatch("flame", lambda i, j: (255, 170, 40) if j > 3 else (255, 240, 150) if (i + j) % 2 else (255, 170, 40))
    swatch("flame_core", lambda i, j: (255, 240, 150))
    swatch("pink", lambda i, j: (255, 170, 200) if j % 3 else (230, 130, 170))
    swatch("white", lambda i, j: (250, 250, 250) if j % 3 else (220, 224, 232))
    swatch("black", lambda i, j: (34, 30, 38) if (i + j) % 4 else (54, 48, 60))
    swatch("hat", lambda i, j: (26, 24, 30) if j % 4 else (44, 40, 50))
    swatch("red_band", lambda i, j: (170, 20, 30) if 1 <= j <= 6 else (110, 12, 20))
    swatch("phones", lambda i, j: (60, 62, 70) if j % 3 else (90, 92, 104))
    swatch("light", lambda i, j: (255, 90, 220) if i < 4 else (90, 255, 240))
    swatch("iron", lambda i, j: (140, 140, 150) if j % 3 else (100, 100, 110))
    swatch("ivory", lambda i, j: (240, 232, 210) if j % 3 else (210, 200, 176))
    swatch("gem_blue", lambda i, j: (120, 240, 255) if i + j < 6 else (40, 150, 230))
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
    angel = wing.copy()
    apx = angel.load()
    for y in range(32):
        for x in range(32):
            r, g, b, a = apx[x, y]
            if a:
                lum = (r + g + b) / 3
                apx[x, y] = (255, 244, 214, a) if lum > 120 else (236, 238, 245, a) if lum > 60 else (200, 206, 222, a)
    t.img.paste(angel, WINGS["angel"])
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
    s, X0, Y0, Z0, Z1 = 0.5, 1.5, 28.0, 3.3, 3.8   # wing root on the shoulder blades
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
    crown += mirrored([box("arch", (-0.5, 35.4, -4.7), (0.5, 36.2, -1), "gold"),
                       box("gem_spike", (2.8, 35.3, -5.35), (3.4, 35.9, -5.3), "gem", glow=True)])
    frost = [box("band_n", (-5.3, 32.2, -5.3), (5.3, 33.4, -4.7), "silver"),
             box("band_s", (-5.3, 32.2, 4.7), (5.3, 33.4, 5.3), "silver"),
             box("band_e", (4.7, 32.2, -4.7), (5.3, 33.4, 4.7), "silver"),
             box("band_w", (-5.3, 32.2, -4.7), (-4.7, 33.4, 4.7), "silver"),
             box("gem", (-0.8, 32.4, -5.45), (0.8, 33.3, -5.3), "gem_blue", glow=True)]
    for i, (x, z, hgt) in enumerate(((0, -5, 4.5), (-2.7, -5, 3), (2.7, -5, 3), (-5, -2, 3.5), (5, -2, 3.5),
                                     (-5, 2, 2.5), (5, 2, 2.5), (0, 5, 3.5))):
        frost.append(box(f"ice_{i}", (x - 0.6, 33.4, z - 0.3), (x + 0.6, 33.4 + hgt, z + 0.3), "ice"))
        frost.append(box(f"ice_tip_{i}", (x - 0.3, 33.4 + hgt, z - 0.15), (x + 0.3, 34.4 + hgt, z + 0.15),
                         "ice_glow", glow=True))
    flame = [box("band_n", (-5.3, 32.2, -5.3), (5.3, 33.6, -4.7), "gold"),
             box("band_s", (-5.3, 32.2, 4.7), (5.3, 33.6, 5.3), "gold"),
             box("band_e", (4.7, 32.2, -4.7), (5.3, 33.6, 4.7), "gold"),
             box("band_w", (-5.3, 32.2, -4.7), (-4.7, 33.6, 4.7), "gold")]
    for i, (x, z, hgt) in enumerate(((0, -5, 3.2), (-3, -5, 2.2), (3, -5, 2.2), (-5, 0, 2.6), (5, 0, 2.6),
                                     (0, 5, 2.6), (-3, 5, 1.8), (3, 5, 1.8))):
        flame.append(box(f"flame_{i}", (x - 0.8, 33.6, z - 0.3), (x + 0.8, 33.6 + hgt, z + 0.3), "flame", glow=True))
        flame.append(box(f"core_{i}", (x - 0.35, 33.6, z - 0.32), (x + 0.35, 33.6 + hgt * 0.6, z + 0.32),
                         "flame_core", glow=True))
    bunny = mirrored([box("ear", (1.4, 33, -0.8), (3, 39.5, 0.4), "white"),
                      box("ear_inner", (1.8, 33.5, -0.85), (2.6, 39, -0.8), "pink"),
                      box("ear_tip", (1.6, 39.5, -0.6), (2.8, 40.3, 0.2), "white")])
    cat = mirrored([box("ear", (2, 33, -1.2), (4.4, 34.6, 0.2), "black"),
                    box("ear_mid", (2.4, 34.6, -1), (4, 35.8, 0), "black"),
                    box("ear_tip", (2.8, 35.8, -0.8), (3.6, 36.6, -0.2), "black"),
                    box("ear_inner", (2.5, 33.3, -1.25), (3.9, 35.4, -1.2), "pink")])
    top_hat = [box("brim", (-6.2, 33, -6.2), (6.2, 33.5, 6.2), "hat"),
               box("crown", (-4, 33.5, -4), (4, 40.5, 4), "hat"),
               box("band", (-4.1, 33.5, -4.1), (4.1, 34.8, 4.1), "red_band"),
               box("buckle", (-1, 33.4, -4.25), (1, 34.9, -4.1), "buckle")]
    phones = [box("band_top", (-5.4, 33, -0.8), (5.4, 34, 0.8), "phones"),
              box("band_l", (-5.8, 29, -0.8), (-4.9, 33.6, 0.8), "phones"),
              box("band_r", (4.9, 29, -0.8), (5.8, 33.6, 0.8), "phones"),
              box("cup_l", (-6.6, 26, -2), (-5.2, 30, 2), "phones"),
              box("cup_r", (5.2, 26, -2), (6.6, 30, 2), "phones"),
              box("light_l", (-6.75, 27, -1), (-6.6, 29, 1), "light", glow=True),
              box("light_r", (6.6, 27, -1), (6.75, 29, 1), "light", glow=True)]
    viking = [box("band_n", (-5.3, 29.5, -5.3), (5.3, 31, -4.7), "iron"),
              box("band_s", (-5.3, 29.5, 4.7), (5.3, 31, 5.3), "iron"),
              box("band_e", (4.7, 29.5, -4.7), (5.3, 31, 4.7), "iron"),
              box("band_w", (-5.3, 29.5, -4.7), (-4.7, 31, 4.7), "iron"),
              box("nose", (-0.6, 26.5, -5.5), (0.6, 31, -5.3), "iron")]
    viking += mirrored([box("horn_0", (5.3, 30, -1), (7.5, 32, 1), "ivory"),
                        box("horn_1", (7.2, 31.5, -0.8), (8.8, 34.5, 0.8), "ivory"),
                        box("horn_2", (7.8, 34.3, -0.6), (9, 37, 0.6), "ivory"),
                        box("horn_3", (7.6, 36.8, -0.4), (8.4, 38.6, 0.4), "ivory")])
    return {
        "crimson_crown": ("&6Crimson Crown", "A crown for the forge's champion.", crown),
        "frost_crown": ("&bFrost Crown", "Ice that never melts, even in the Nether.", frost),
        "flame_crown": ("&6Flame Crown", "It is on fire. Constantly.", flame),
        "halo": ("&eHalo", "Glows even in the Nether.", halo),
        "devil_horns": ("&cDevil Horns", "Small, but they mean it.", horns),
        "viking_horns": ("&7Viking Horns", "Raid first, ask questions never.", viking),
        "witch_hat": ("&5Witch Hat", "Comes with a faint smell of cauldron.", witch),
        "top_hat": ("&8Top Hat", "Distinguished. Mostly.", top_hat),
        "bunny_ears": ("&dBunny Ears", "Hop hop.", bunny),
        "cat_ears": ("&8Cat Ears", "Knocks your stuff off tables.", cat),
        "headphones": ("&bHeadphones", "The lights keep the beat.", phones),
        "crimson_wings": ("&4Crimson Wings", "Bat wings of blood-red leather.", wing_parts(img, "crimson")),
        "spectral_wings": ("&bSpectral Wings", "Cold light that never fades.", wing_parts(img, "spectral", glow=True)),
        "angel_wings": ("&fAngel Wings", "Feathers of light.", wing_parts(img, "angel", glow=True)),
    }


def model(parts, ref):
    elements = []
    for p in parts:
        faces = {f: {"uv": [x * 16 / W, y * 16 / H, (x + w) * 16 / W, (y + h) * 16 / H], "texture": "#parts"}
                 for f, (x, y, w, h) in p["faces"].items()}
        e = {"name": p["name"], "from": demon.to_item_space(p["from"]), "to": demon.to_item_space(p["to"]),
             "faces": faces}
        if p["glow"]:
            e["light_emission"] = 15
        elements.append(e)
    k = round(1.6 / demon.ITEM_K, 4)
    return {
        "texture_size": [W, H],
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
    # frames are 64x96, not square, so the frame size must be stated
    write(f"{base}/textures/item/accessories/parts.png.mcmeta",
          {"animation": dict(mcmeta["animation"], width=W, height=H)})
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
