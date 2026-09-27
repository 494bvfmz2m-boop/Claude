"""Builds the ItemsAdder content zip: crimson-gear/ and demon-gear/.

Keeps the layout of the server's existing crimson-gear pack (configs/,
models/, textures/ directly in the content folder) and its item IDs.
Tools get animated textures (.png strip + .mcmeta), 3D depth and emissive
glow; both helmets are head-worn 3D models (PAPER + hat behaviour): Crimson
with branches from the shoulder blades, Demon with horns and wings.
Run: python3 itemsadder/build_pack.py
"""
import json
import math
import os
import shutil
import sys
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "crimson_armor"))
sys.path.insert(0, os.path.join(ROOT, "demon_armor"))
sys.path.insert(0, os.path.join(ROOT, "itemsadder"))

import build_model  # noqa: E402  (crimson cuboid model builder)
import crimson_upgrade as CU  # noqa: E402
import demon        # noqa: E402

OUT = os.path.join(ROOT, "itemsadder", "build")
ZIP = os.path.join(ROOT, "itemsadder", "crimson_demon_pack.zip")
FRAMES, FRAMETIME = 16, 2

CRIMSON_GLOW = {(255, 64, 52), (255, 150, 110), (255, 196, 110), (224, 40, 44), (255, 214, 190)}
CRIMSON_BLADE = {(236, 108, 96), (198, 52, 58), (158, 26, 38), (122, 16, 28)}
DEMON_GLOW = {demon.LAVA1, demon.LAVA2, demon.LAVA3, demon.LAVA0}


def scale(c, k, add=0):
    return tuple(max(0, min(255, int(v * k + add))) for v in c)


def animate(img, glow, shimmer=frozenset(), frames=FRAMES):
    """Vertical strip: glow colours pulse, and a bright band sweeps diagonally
    along the item (x - y axis) across shimmer colours."""
    w, h = img.size
    strip = Image.new("RGBA", (w, h * frames), (0, 0, 0, 0))
    src = img.load()
    for f in range(frames):
        pulse = 0.5 + 0.5 * math.sin(2 * math.pi * f / frames)
        band = -w + (2 * w) * f / frames
        frame = img.copy()
        px = frame.load()
        for y in range(h):
            for x in range(w):
                r, g, b, a = src[x, y]
                if not a:
                    continue
                c = (r, g, b)
                if c in glow:
                    c = scale(c, 0.72 + 0.28 * pulse, 30 * pulse)
                elif c in shimmer and abs((x - y) - band) < 1.6:
                    c = scale(c, 1.15, 45)
                px[x, y] = c + (a,)
        strip.paste(frame, (0, f * h))
    return strip


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if isinstance(data, Image.Image):
        data.save(path)
    elif isinstance(data, (dict, list)):
        with open(path, "w") as f:
            json.dump(data, f, indent=1)
    else:
        with open(path, "w") as f:
            f.write(data)


MCMETA = {"animation": {"frametime": FRAMETIME}}


# --- crimson-gear ---------------------------------------------------------
TOOLS = {  # name: (material, attackDamage, attackSpeed, display)
    "sword": ("NETHERITE_SWORD", 10, 1.6, build_model.SWORD_DISPLAY),
    "axe": ("NETHERITE_AXE", 12, 1.0, build_model.handheld()),
    "pickaxe": ("NETHERITE_PICKAXE", 7, 1.2, build_model.handheld()),
    "shovel": ("NETHERITE_SHOVEL", 7.5, 1.0, build_model.handheld()),
    "hoe": ("NETHERITE_HOE", 1, 4.0, build_model.handheld()),
}
CRIMSON_ARMOR = {  # piece: (armor points, custom durability) -- a tier above netherite
    "helmet": (4, 610), "chestplate": (9, 888), "leggings": (7, 832), "boots": (4, 721),
}
TOOL_DURABILITY = 3000   # netherite: 2031


def crimson(base):
    ns = "crimson-gear"
    src = os.path.join(ROOT, "crimson_armor")
    write(f"{base}/configs/equipments.yml", f"""info:
  namespace: {ns}
equipments:
  crimson_armor:
    type: armor
    layer_1: armor/crimson_armor/layer_1
    layer_2: armor/crimson_armor/layer_2
""")
    write(f"{base}/textures/armor/crimson_armor/layer_1.png", Image.open(f"{src}/armor_layer_1.png"))
    write(f"{base}/textures/armor/crimson_armor/layer_2.png", Image.open(f"{src}/armor_layer_2.png"))
    for piece in CRIMSON_ARMOR:
        write(f"{base}/textures/item/armor/crimson_armor_{piece}.png", Image.open(f"{src}/items/crimson_{piece}.png"))

    for name, (_, _, _, display) in TOOLS.items():
        tex = Image.open(f"{src}/items/crimson_{name}.png").convert("RGBA")
        ref = f"{ns}:item/tools/crimson_{name}"
        write(f"{base}/textures/item/tools/crimson_{name}.png", animate(tex, CRIMSON_GLOW, CRIMSON_BLADE))
        write(f"{base}/textures/item/tools/crimson_{name}.png.mcmeta", MCMETA)
        write(f"{base}/textures/item/tools/crimson_{name}_icon.png", tex)   # static menu icon
        write(f"{base}/models/item/tools/crimson_{name}.json", {
            "texture_size": list(tex.size),
            "textures": {"layer0": ref, "particle": ref},
            "gui_light": "front",
            "elements": CU.tool_elements(tex),
            "display": display,
        })

    # 3D helmet: visor, gold crest and crimson branches from the shoulder blades
    layer1 = Image.open(f"{src}/armor_layer_1.png").convert("RGBA")
    parts_ref = f"{ns}:item/armor/crimson_parts"
    write(f"{base}/textures/item/armor/crimson_parts.png", animate(CU.atlas(layer1), CU.GLOW))
    write(f"{base}/textures/item/armor/crimson_parts.png.mcmeta", MCMETA)
    write(f"{base}/models/item/armor/crimson_helmet.json", CU.helmet_model(parts_ref))

    armor_pattern = ["ABA", "CDC", "EBE"]
    rec = []
    for piece in CRIMSON_ARMOR:
        rec.append(f"""    crimson_armor_{piece}:
      permission: itemsadder.craft.crimson_armor_{piece}
      enabled: true
      pattern:
{chr(10).join('        - ' + r for r in armor_pattern)}
      ingredients:
        A: GHAST_TEAR
        B: CRIMSON_NYLIUM
        C: DRAGON_BREATH
        D: NETHERITE_{piece.upper()}
        E: END_STONE
      result:
        item: {ns}:crimson_armor_{piece}
        amount: 1""")
    for name in ("axe", "pickaxe", "shovel", "hoe"):
        rec.append(f"""    crimson_{name}:
      permission: itemsadder.craft.crimson_{name}
      enabled: true
      pattern:
        - XAX
        - XBX
        - XCX
      ingredients:
        A: CRIMSON_NYLIUM
        B: NETHERITE_{name.upper()}
        C: BLAZE_ROD
      result:
        item: {ns}:crimson_{name}
        amount: 1""")
    rec.append(f"""    crimson_sword:
      permission: itemsadder.craft.crimson_sword
      enabled: true
      pattern:
        - XAX
        - BCB
        - XDX
      ingredients:
        A: DRAGON_BREATH
        B: DIAMOND_BLOCK
        C: NETHERITE_SWORD
        D: BLAZE_ROD
      result:
        item: {ns}:crimson_sword
        amount: 1""")

    h_armor, h_dura = CRIMSON_ARMOR["helmet"]
    items = [f"""  crimson_armor_helmet:
    enabled: true
    display_name: Crimson Armor Helmet
    behaviours:
      hat: true
    resource:
      material: PAPER
      generate: false
      model_path: item/armor/crimson_helmet
    durability:
      max_custom_durability: {h_dura}
    attribute_modifiers:
      head:
        armor: {h_armor}
        armorToughness: 4
        knockbackResistance: 0.15"""]
    for piece, (armor, dura) in CRIMSON_ARMOR.items():
        if piece == "helmet":
            continue
        items.append(f"""  crimson_armor_{piece}:
    enabled: true
    display_name: Crimson Armor {piece.capitalize()}
    resource:
      material: IRON_{piece.upper()}
      generate: true
      textures:
        - item/armor/crimson_armor_{piece}
    durability:
      max_custom_durability: {dura}
    equipment:
      id: {ns}:crimson_armor
      slot_attribute_modifiers:
        armor: {armor}
        armorToughness: 4
        knockbackResistance: 0.15""")
    for name, (mat, dmg, spd, _) in TOOLS.items():
        items.append(f"""  crimson_{name}:
    enabled: true
    display_name: Crimson {name.capitalize()}
    resource:
      material: {mat}
      model_path: item/tools/crimson_{name}
      icon: item/tools/crimson_{name}_icon
    durability:
      max_custom_durability: {TOOL_DURABILITY}
    attribute_modifiers:
      mainhand:
        attackDamage: {dmg}
        attackSpeed: {spd}""")

    write(f"{base}/configs/items.yml", f"""info:
  namespace: {ns}
recipes:
  crafting_table:
{chr(10).join(rec)}
items:
{chr(10).join(items)}
""")


# --- demon-gear -------------------------------------------------------------
DEMON_ARMOR = {  # piece: (armor points, custom durability) -- admin only, maxed out
    "helmet": (5, 1221), "chestplate": (11, 1776), "leggings": (9, 1665), "boots": (5, 1443),
}


def demon_hat_model(parts, ref):
    """Head-worn model: helmet shell, horns, fangs and the bat wings."""
    keep = [p for p in parts if p["bone"] == "head" or "wing" in p["name"]]
    elements = []
    for p in keep:
        faces = {}
        for f, (x, y, w, h) in demon.face_rects(p).items():
            faces[f] = {"uv": [x / 4, y / 4, (x + w) / 4, (y + h) / 4], "texture": "#parts"}
            if f == "up" and p["bone"] == "head":
                faces[f]["rotation"] = 180
        elements.append({"name": p["name"], "from": demon.to_item_space(p["from"]),
                         "to": demon.to_item_space(p["to"]), "faces": faces})
    k = round(1.6 / demon.ITEM_K, 4)
    return {
        "texture_size": [64, 64],
        "textures": {"parts": ref, "particle": ref},
        "elements": elements,
        "display": {
            "head": {"scale": [k, k, k]},
            "thirdperson_righthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.35, 0.35, 0.35]},
            "thirdperson_lefthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.35, 0.35, 0.35]},
            "firstperson_righthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.35, 0.35, 0.35]},
            "firstperson_lefthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.35, 0.35, 0.35]},
            "gui": {"rotation": [20, 200, 0], "translation": [0, -1, 0], "scale": [0.48, 0.48, 0.48]},
            "ground": {"translation": [0, 3, 0], "scale": [0.35, 0.35, 0.35]},
            "fixed": {"rotation": [0, 180, 0], "scale": [0.6, 0.6, 0.6]},
        },
    }


def demon_pack(base):
    ns = "demon-gear"
    src = os.path.join(ROOT, "demon_armor")
    write(f"{base}/configs/equipments.yml", f"""info:
  namespace: {ns}
equipments:
  demon_armor:
    type: armor
    layer_1: armor/demon_armor/layer_1
    layer_2: armor/demon_armor/layer_2
""")
    write(f"{base}/textures/armor/demon_armor/layer_1.png", Image.open(f"{src}/demon_layer_1.png"))
    write(f"{base}/textures/armor/demon_armor/layer_2.png", Image.open(f"{src}/demon_layer_2.png"))
    for piece in DEMON_ARMOR:
        write(f"{base}/textures/item/armor/demon_armor_{piece}.png", Image.open(f"{src}/items/demon_{piece}.png"))

    atlas = Image.open(f"{src}/3d/demon_armor_parts.png").convert("RGBA")
    parts = demon.geometry(atlas)
    ref = f"{ns}:item/armor/demon_parts"
    write(f"{base}/textures/item/armor/demon_parts.png", animate(atlas, DEMON_GLOW))
    write(f"{base}/textures/item/armor/demon_parts.png.mcmeta", MCMETA)
    write(f"{base}/models/item/armor/demon_helmet.json", demon_hat_model(parts, ref))

    h_armor, h_dura = DEMON_ARMOR["helmet"]
    items = [f"""  demon_armor_helmet:
    enabled: true
    display_name: "&4Demon Helmet"
    permission: {ns}.helmet
    behaviours:
      hat: true
    resource:
      material: PAPER
      generate: false
      model_path: item/armor/demon_helmet
    durability:
      max_custom_durability: {h_dura}
    attribute_modifiers:
      head:
        armor: {h_armor}
        armorToughness: 5
        knockbackResistance: 0.25
        maxHealth: 2"""]
    for piece in ("chestplate", "leggings", "boots"):
        armor, dura = DEMON_ARMOR[piece]
        fire = """
    events:
      wear:
        potion_effect:
          type: FIRE_RESISTANCE
          duration: 1000000
          amplifier: 0
      unwear:
        remove_potion_effect:
          type: FIRE_RESISTANCE""" if piece == "chestplate" else ""
        items.append(f"""  demon_armor_{piece}:
    enabled: true
    display_name: "&4Demon {piece.capitalize()}"
    permission: {ns}.{piece}
    resource:
      material: IRON_{piece.upper()}
      generate: true
      textures:
        - item/armor/demon_armor_{piece}
    durability:
      max_custom_durability: {dura}
    equipment:
      id: {ns}:demon_armor
      slot_attribute_modifiers:
        armor: {armor}
        armorToughness: 5
        knockbackResistance: 0.25
        maxHealth: 2{fire}""")
    write(f"{base}/configs/items.yml", f"""info:
  namespace: {ns}
items:
{chr(10).join(items)}
""")


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    crimson(f"{OUT}/crimson-gear")
    demon_pack(f"{OUT}/demon-gear")
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for folder, _, files in sorted(os.walk(OUT)):
            rel = os.path.relpath(folder, OUT)
            if rel != ".":
                z.write(folder, rel + "/")
            for f in sorted(files):
                z.write(os.path.join(folder, f), os.path.join(rel, f))
    print(ZIP)


if __name__ == "__main__":
    main()
