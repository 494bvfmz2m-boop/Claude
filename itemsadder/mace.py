"""Cataclysm: an admin-only 3D mace, shipped as its own content folder.

Modelled upright out of real cuboids (flanged head, spike crown, floating
crystal, orbiting rune rings, wrapped grip, spiked pommel), then every
element is turned 45 degrees about the model centre so it sits on the same
diagonal as a vanilla handheld item. Glowing parts use light_emission and an
animated texture. Run: python3 itemsadder/mace.py
"""
import math
import os
import shutil
import sys
import zipfile

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_pack as B  # noqa: E402  (animate, write, MCMETA)

NS = "slothsmp-mace"
OUT = os.path.join(HERE, "build_mace")
ZIP = os.path.join(HERE, "cataclysm_mace.zip")

# palette: void obsidian, molten-violet glow, old gold, blackened steel
OBS = [(10, 6, 18), (20, 12, 34), (32, 20, 52), (46, 30, 72)]
GLOW = [(200, 70, 255), (240, 150, 255), (255, 225, 255)]
GOLD = [(120, 76, 24), (190, 136, 44), (240, 196, 92), (255, 236, 160)]
STEEL = [(44, 42, 56), (76, 74, 94), (116, 114, 138), (170, 168, 192)]
LEATHER = [(40, 16, 28), (70, 30, 48)]
CRYSTAL = [(120, 40, 200), (180, 90, 255), (230, 180, 255), (255, 245, 255)]
GLOW_SET = set(GLOW) | {CRYSTAL[2], CRYSTAL[3]}

REG = {}


def h(x, y, k=0):
    n = (x * 374761393 + y * 668265263 + k * 97531) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65536


def atlas():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()

    def region(name, x0, y0, w, hh, fn):
        REG[name] = (x0, y0, w, hh)
        for y in range(hh):
            for x in range(w):
                px[x0 + x, y0 + y] = fn(x, y, w, hh) + (255,)

    def obsidian(x, y, w, hh):          # void stone with glowing fault lines
        crack = abs(math.sin(x * 0.8 + y * 1.3 + h(x // 4, y // 4, 1) * 3)) < 0.2 or \
            abs(math.sin(x * 1.4 - y * 0.6 + 2)) < 0.12
        if crack:
            return GLOW[2] if h(x, y, 2) > 0.8 else GLOW[1] if h(x, y, 3) > 0.4 else GLOW[0]
        r = h(x, y, 4)
        return OBS[3] if r > 0.9 else OBS[2] if r > 0.55 else OBS[1] if r > 0.2 else OBS[0]

    def bevel(ramp):
        def f(x, y, w, hh):
            if y == 0 or x == 0:
                return ramp[-1]
            if y == hh - 1 or x == w - 1:
                return ramp[0]
            return ramp[2] if (x + y) % 5 else ramp[1]
        return f

    def leather(x, y, w, hh):
        return LEATHER[1] if (x + y) % 4 < 2 else LEATHER[0]

    def rune(x, y, w, hh):              # glowing runes on a dark band
        if y in (0, hh - 1):
            return GOLD[2]
        glyph = (x % 4 == 1 and y in (1, 2)) or (x % 4 == 2 and y == 1) or (x % 4 == 0 and y == 2 and x % 8 == 0)
        return GLOW[1] if glyph else OBS[1]

    def crystal(x, y, w, hh):
        k = ((x + y) // 2 + (x - y + 8) // 3) % 4
        return CRYSTAL[k]

    def flange(x, y, w, hh):            # dark steel blade with a burning edge
        if x >= w - 2:
            return GLOW[1] if x == w - 1 else GLOW[0]
        if y == 0:
            return STEEL[3]
        return STEEL[2] if (x + y) % 6 else STEEL[1]

    region("obsidian", 0, 0, 16, 16, obsidian)
    region("gold", 16, 0, 8, 8, bevel(GOLD))
    region("steel", 24, 0, 8, 8, bevel(STEEL))
    region("leather", 32, 0, 8, 8, leather)
    region("glow", 40, 0, 8, 8, lambda *a: GLOW[1])
    region("glow_hot", 48, 0, 8, 8, lambda *a: GLOW[2])
    region("rune", 16, 8, 32, 4, rune)
    region("crystal", 16, 12, 8, 8, crystal)
    region("flange", 0, 16, 16, 16, flange)
    region("gold_d", 24, 12, 8, 8, bevel(GOLD[:3]))
    return img


# ------------------------------------------------------------------ geometry (upright, x/z centred on 8)
PARTS = []


def box(name, frm, to, mat, glow=False):
    PARTS.append({"name": name, "from": list(frm), "to": list(to), "mat": mat, "glow": glow})


def column(name, y0, y1, w, mat, glow=False):
    box(name, (8 - w / 2, y0, 8 - w / 2), (8 + w / 2, y1, 8 + w / 2), mat, glow)


def ring(name, y0, y1, r, t, mat, glow=False):
    box(name + "_n", (8 - r, y0, 8 - r), (8 + r, y1, 8 - r + t), mat, glow)
    box(name + "_s", (8 - r, y0, 8 + r - t), (8 + r, y1, 8 + r), mat, glow)
    box(name + "_w", (8 - r, y0, 8 - r + t), (8 - r + t, y1, 8 + r - t), mat, glow)
    box(name + "_e", (8 + r - t, y0, 8 - r + t), (8 + r, y1, 8 + r - t), mat, glow)


def build_geometry():
    PARTS.clear()
    # pommel: gold cap, glowing gem, spike
    column("pommel_spike", -8.2, -7, 0.6, "gold_d")
    column("pommel_spike2", -7.2, -6.4, 1.2, "gold")
    column("pommel", -6.4, -4.8, 2.4, "gold")
    for dx, dz in ((1.25, 0), (-1.25, 0), (0, 1.25), (0, -1.25)):
        box(f"pommel_gem{dx}{dz}", (8 + dx - 0.35, -5.95, 8 + dz - 0.35), (8 + dx + 0.35, -5.25, 8 + dz + 0.35),
            "glow_hot", True)
    # grip: leather wrap with gold bands and a glowing rune strip
    column("grip", -4.8, 6, 1.5, "leather")
    for i, y in enumerate((-4, -1, 2, 5)):
        column(f"band{i}", y, y + 0.6, 1.9, "gold")
    box("grip_rune", (8.75, -3.2, 7.6), (8.85, 4.6, 8.4), "glow", True)
    # collar and neck
    column("collar0", 6, 7.2, 3.2, "gold")
    column("collar1", 7.2, 7.8, 2.4, "gold_d")
    column("neck", 7.8, 10.6, 1.4, "steel")
    column("neck_vein", 8, 10.4, 0.5, "glow", True)
    column("head_base", 10.6, 11.4, 4, "gold")
    # head: big obsidian core with glowing faults, thin gold straps, two rows of stepped spikes
    column("core", 11.2, 18.8, 6.4, "obsidian", True)
    column("core_band_lo", 11.2, 11.8, 6.8, "gold")
    column("core_band_hi", 18.2, 18.8, 6.8, "gold")
    for x in (4.9, 11.1):                                    # vertical gold straps on the corners
        for z in (4.9, 11.1):
            box(f"strap{x}{z}", (x - 0.35, 11.8, z - 0.35), (x + 0.35, 18.2, z + 0.35), "gold_d")
    steps = ((3.2, 5.0, 1.8, "steel"), (5.0, 6.4, 1.2, "steel"), (6.4, 7.4, 0.7, "steel"), (7.4, 8.1, 0.35, "glow_hot"))
    for row, yc in (("lo", 13.4), ("hi", 16.6)):
        for nm, (sx, sz) in (("e", (1, 0)), ("w", (-1, 0)), ("s", (0, 1)), ("n", (0, -1))):
            for j, (r0, r1, w, mat) in enumerate(steps):
                if row == "hi":
                    ox, oz = (sz, sx) if sx or sz else (0, 0)   # upper row turned 90 degrees: offset sideways
                else:
                    ox = oz = 0
                cx, cz = 8 + ox * 1.6, 8 + oz * 1.6
                if sx:
                    x0, x1 = (8 + r0, 8 + r1) if sx > 0 else (8 - r1, 8 - r0)
                    box(f"spike_{row}_{nm}{j}", (x0, yc - w / 2, cz - w / 2), (x1, yc + w / 2, cz + w / 2), mat,
                        mat == "glow_hot")
                else:
                    z0, z1 = (8 + r0, 8 + r1) if sz > 0 else (8 - r1, 8 - r0)
                    box(f"spike_{row}_{nm}{j}", (cx - w / 2, yc - w / 2, z0), (cx + w / 2, yc + w / 2, z1), mat,
                        mat == "glow_hot")
    # corner horns curling up from the lower band
    for dx in (-1, 1):
        for dz in (-1, 1):
            box(f"horn0{dx}{dz}", (8 + dx * 3.4 - 0.5, 10.6, 8 + dz * 3.4 - 0.5), (8 + dx * 3.4 + 0.5, 12, 8 + dz * 3.4 + 0.5), "gold")
            box(f"horn1{dx}{dz}", (8 + dx * 4.1 - 0.35, 9.6, 8 + dz * 4.1 - 0.35), (8 + dx * 4.1 + 0.35, 10.8, 8 + dz * 4.1 + 0.35), "gold_d")
    # crown of spikes
    column("crown", 18.8, 19.6, 4, "gold_d")
    column("spike0", 19.6, 21.4, 1.8, "steel")
    column("spike1", 21.4, 23, 1.1, "steel")
    column("spike2", 23, 24.2, 0.5, "glow_hot", True)
    for dx, dz in ((1.5, 0), (-1.5, 0), (0, 1.5), (0, -1.5)):
        box(f"crown_spike{dx}{dz}", (8 + dx - 0.35, 19.6, 8 + dz - 0.35), (8 + dx + 0.35, 21, 8 + dz + 0.35), "gold")
    # floating crystal above the crown
    column("crystal_lo", 25, 25.8, 0.8, "crystal", True)
    column("crystal", 25.8, 27.8, 1.6, "crystal", True)
    column("crystal_hi", 27.8, 28.8, 0.8, "crystal", True)
    # two rune rings orbiting the head, clear of the flanges
    ring("rune_ring", 14.8, 15.2, 6.2, 0.35, "rune", True)
    for dx, dz in ((6.2, 6.2), (-6.2, 6.2), (6.2, -6.2), (-6.2, -6.2)):   # floating shards at ring corners
        box(f"shard{dx}{dz}", (8 + dx - 0.45, 14.4, 8 + dz - 0.45), (8 + dx + 0.45, 15.6, 8 + dz + 0.45),
            "crystal", True)
    return PARTS


# ------------------------------------------------------------------ model
FACES = ("north", "south", "east", "west", "up", "down")


def face_px(p, f):
    """Texture rect in pixels at 1 px per model unit, so nothing is stretched."""
    x0, y0, w, hh = REG[p["mat"]]
    (a, b, c), (d, e, g) = p["from"], p["to"]
    dx, dy, dz = d - a, e - b, g - c
    fw, fh = {"north": (dx, dy), "south": (dx, dy), "east": (dz, dy), "west": (dz, dy),
              "up": (dx, dz), "down": (dx, dz)}[f]
    fw, fh = max(0.5, min(w, fw)), max(0.5, min(hh, fh))
    ox = (w - fw) * (0.5 if w == fw else h(len(p["name"]), FACES.index(f), 7))
    oy = (hh - fh) * h(FACES.index(f), len(p["name"]), 8)
    return x0 + ox, y0 + oy, fw, fh
LEN_CENTRE = 10.0       # the model is rotated about this point


def model(parts, ref):
    elements = []
    for p in parts:
        el = {"name": p["name"], "from": [round(v, 3) for v in p["from"]], "to": [round(v, 3) for v in p["to"]],
              "rotation": {"angle": -45, "axis": "z", "origin": [8, LEN_CENTRE, 8]},
              "faces": {}}
        for f in FACES:
            x, y, w, hh = face_px(p, f)
            el["faces"][f] = {"uv": [round(x / 4, 3), round(y / 4, 3), round((x + w) / 4, 3), round((y + hh) / 4, 3)],
                              "texture": "#mace"}
        if p["glow"]:
            el["light_emission"] = 15
        elements.append(el)
    k = 0.72
    return {
        "texture_size": [64, 64],
        "textures": {"mace": ref, "particle": ref},
        "gui_light": "front",
        "elements": elements,
        "display": {
            "thirdperson_righthand": {"rotation": [0, -90, 55], "translation": [0, 6, 1.5], "scale": [k, k, k]},
            "thirdperson_lefthand": {"rotation": [0, 90, -55], "translation": [0, 6, 1.5], "scale": [k, k, k]},
            "firstperson_righthand": {"rotation": [0, -90, 25], "translation": [1.13, 4.2, 1.13], "scale": [0.6] * 3},
            "firstperson_lefthand": {"rotation": [0, 90, -25], "translation": [1.13, 4.2, 1.13], "scale": [0.6] * 3},
            "gui": {"rotation": [0, 0, 0], "translation": [0, -1.5, 0], "scale": [0.5, 0.5, 0.5]},
            "ground": {"translation": [0, 2, 0], "scale": [0.4] * 3},
            "fixed": {"rotation": [0, 180, 0], "translation": [0, -1.5, 0], "scale": [0.55] * 3},
            "head": {"rotation": [0, 180, 0], "translation": [0, 13, 7], "scale": [1, 1, 1]},
        },
    }


def items_yml():
    return f"""info:
  namespace: {NS}
items:
  cataclysm:
    enabled: true
    display_name: '&5&lCataclysm'
    lore:
      - '&f'
      - '&o&7A shard of the void, hammered around'
      - '&o&7a heart that never stopped burning.'
      - '&f'
      - '&d+18 attack damage, keeps the mace smash'
      - '&f'
      - '&4Admin only'
    permission: {NS}.cataclysm
    resource:
      material: MACE
      generate: false
      model_path: item/cataclysm
    durability:
      max_custom_durability: 99999
    attribute_modifiers:
      mainhand:
        attackDamage: 18
        attackSpeed: 0.8
        knockbackResistance: 0.3
"""


def categories_yml():
    return f"""info:
  namespace: {NS}
categories:
  admin_weapons:
    enabled: true
    name: '&4Admin Weapons'
    icon: {NS}:cataclysm
    permission: ia.menu.admin_weapons
    items:
      - {NS}:cataclysm
"""


def write_pack(base):
    """Write the content folder (also called by build_pack for the full zip)."""
    img = atlas()
    parts = build_geometry()
    B.write(f"{base}/textures/item/cataclysm.png", B.animate(img, GLOW_SET))
    B.write(f"{base}/textures/item/cataclysm.png.mcmeta", B.MCMETA)
    B.write(f"{base}/models/item/cataclysm.json", model(parts, f"{NS}:item/cataclysm"))
    B.write(f"{base}/configs/items.yml", items_yml())
    B.write(f"{base}/configs/categories.yml", categories_yml())
    return img, parts


def build():
    """The mace on its own: build_mace/ and cataclysm_mace.zip."""
    shutil.rmtree(OUT, ignore_errors=True)
    img, parts = write_pack(f"{OUT}/{NS}")
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for folder, _, files in sorted(os.walk(OUT)):
            rel = os.path.relpath(folder, OUT)
            if rel != ".":
                z.write(folder, rel + "/")
            for f in sorted(files):
                z.write(os.path.join(folder, f), os.path.join(rel, f))
    return img, parts


# ------------------------------------------------------------------ preview (not part of the pack)
def render(img, parts, yaw, tilt=15, size=720, scale=18, diagonal=True):
    import preview as PV
    polys = []
    yr, pr = math.radians(yaw), math.radians(tilt)

    def cam(p):
        X, Y, Z = p[0] - 8, p[1] - LEN_CENTRE, p[2] - 8
        x1 = X * math.cos(yr) + Z * math.sin(yr)
        z1 = -X * math.sin(yr) + Z * math.cos(yr)
        return x1, Y * math.cos(pr) - z1 * math.sin(pr), Y * math.sin(pr) + z1 * math.cos(pr)

    rot = ("z", -45, (8, LEN_CENTRE, 8)) if diagonal else None
    for p in parts:
        for f in FACES:
            x0, y0, w, hh = face_px(p, f)
            n1 = PV.rotate(PV.NORMALS[f], (rot[0], rot[1], (0, 0, 0))) if rot else PV.NORMALS[f]
            if cam(n1)[2] - cam((0, 0, 0))[2] >= 0:
                continue
            P = PV.face_fn(f, (p["from"], p["to"]))
            nu, nv = max(1, round(w)), max(1, round(hh))
            for i in range(nu):
                for j in range(nv):
                    c = img.getpixel((min(63, int(x0 + (i + 0.5) * w / nu)), min(63, int(y0 + (j + 0.5) * hh / nv))))
                    pts = [cam(PV.rotate(P(a / nu, b / nv), rot)) for a, b in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
                    light = 1.0 if p["glow"] else PV.LIGHT[f]
                    polys.append((sum(q[2] for q in pts) / 4, [(q[0], q[1]) for q in pts],
                                  tuple(min(255, int(v * light)) for v in c[:3])))
    polys.sort(key=lambda q: -q[0])
    out = Image.new("RGB", (size, size), (18, 16, 24))
    d = ImageDraw.Draw(out)
    for _, pts, c in polys:
        d.polygon([(size / 2 + x * scale, size / 2 - y * scale) for x, y in pts], fill=c)
    return out


if __name__ == "__main__":
    img, parts = build()
    views = [render(img, parts, yaw, tilt=t, diagonal=False, scale=17) for yaw, t in ((-35, 12), (20, 35), (160, -10))]
    sheet = Image.new("RGB", (720 * 3, 720), (18, 16, 24))
    for i, v in enumerate(views):
        sheet.paste(v, (i * 720, 0))
    os.makedirs(os.path.join(HERE, "previews"), exist_ok=True)
    sheet.save(os.path.join(HERE, "previews", "cataclysm.png"))
    render(img, parts, -25, scale=16).save(os.path.join(HERE, "previews", "cataclysm_held.png"))
    print(ZIP)
