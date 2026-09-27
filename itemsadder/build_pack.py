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
import recipe_book as BOOK  # noqa: E402
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
SLOTS = {"chestplate": "CHEST", "leggings": "LEGS", "boots": "FEET"}


# --- crimson-gear: Crimson and Blue Crimson tiers ----------------------------
TOOL_MATERIALS = {"sword": "NETHERITE_SWORD", "axe": "NETHERITE_AXE", "pickaxe": "NETHERITE_PICKAXE",
                  "shovel": "NETHERITE_SHOVEL", "hoe": "NETHERITE_HOE"}
TOOL_SPEED = {"sword": 1.6, "axe": 1.0, "pickaxe": 1.2, "shovel": 1.0, "hoe": 4.0}
TOOL_DISPLAY = {"sword": build_model.SWORD_DISPLAY, "axe": build_model.handheld(),
                "pickaxe": build_model.handheld(), "shovel": build_model.handheld(),
                "hoe": build_model.handheld()}
PIECES = ("helmet", "chestplate", "leggings", "boots")

# Recipes: pattern + ingredients; "{piece}" / "{tool}" / "{PIECE}" / "{TOOL}" are filled per item.
TIERS = {
    "crimson": {
        "name": "Crimson", "color": "&c", "recolor": None,
        "lore": ["&f", "&6Forged from netherite,", "&6dragon''s breath and ghast tears"],
        # piece: (armor points, durability) -- a tier above netherite (407/592/555/481)
        "armor": {"helmet": (4, 610), "chestplate": (9, 888), "leggings": (7, 832), "boots": (4, 721)},
        "toughness": 4, "knockback": 0.15,
        "damage": {"sword": 10, "axe": 12, "pickaxe": 7, "shovel": 7.5, "hoe": 1},
        "tool_durability": 3000,   # netherite: 2031
        "armor_recipe": (["ABA", "CDC", "EBE"], {"A": "GHAST_TEAR", "B": "REDSTONE_BLOCK", "C": "DRAGON_BREATH",
                                                "D": "NETHERITE_{PIECE}", "E": "END_STONE"}),
        "tool_recipe": (["XAX", "XBX", "XCX"], {"A": "REDSTONE_BLOCK", "B": "NETHERITE_{TOOL}", "C": "BLAZE_ROD"}),
        "sword_recipe": (["XAX", "BCB", "XDX"], {"A": "DRAGON_BREATH", "B": "DIAMOND_BLOCK",
                                                "C": "NETHERITE_SWORD", "D": "BLAZE_ROD"}),
        "bow_durability": 768,   # vanilla bow: 384
        "bow_recipe": (["XAX", "BCB", "XDX"], {"A": "DRAGON_BREATH", "B": "REDSTONE_BLOCK",
                                              "C": "BOW", "D": "GHAST_TEAR"}),
    },
    "blue_crimson": {
        "name": "Blue Crimson", "color": "&b", "recolor": "blue",
        "lore": ["&f", "&3Crimson gear reforged", "&3with echo shards and lapis"],
        "armor": {"helmet": (5, 814), "chestplate": (10, 1184), "leggings": (8, 1110), "boots": (5, 962)},
        "toughness": 5, "knockback": 0.2,
        "damage": {"sword": 11, "axe": 13, "pickaxe": 8, "shovel": 8.5, "hoe": 1},
        "tool_durability": 4000,
        "armor_recipe": (["ABA", "CDC", "EBE"], {"A": "ECHO_SHARD", "B": "LAPIS_BLOCK", "C": "DRAGON_BREATH",
                                                "D": "crimson-gear:crimson_armor_{piece}", "E": "DIAMOND_BLOCK"}),
        "tool_recipe": (["XAX", "XBX", "XCX"], {"A": "LAPIS_BLOCK", "B": "crimson-gear:crimson_{tool}",
                                                "C": "ECHO_SHARD"}),
        "sword_recipe": (["XAX", "BCB", "XDX"], {"A": "ECHO_SHARD", "B": "DIAMOND_BLOCK",
                                                "C": "crimson-gear:crimson_sword", "D": "BLAZE_ROD"}),
        "bow_durability": 1152,
        "bow_recipe": (["XAX", "BCB", "XDX"], {"A": "ECHO_SHARD", "B": "LAPIS_BLOCK",
                                              "C": "crimson-gear:crimson_bow", "D": "DRAGON_BREATH"}),
    },
}


def fill(ingredients, piece=None, tool=None):
    return {k: v.format(piece=piece, PIECE=(piece or "").upper(), tool=tool, TOOL=(tool or "").upper())
            for k, v in ingredients.items()}


def recipes_of(tier):
    """[(item id, pattern, ingredients)] for one tier."""
    t, out = TIERS[tier], []
    for piece in PIECES:
        pat, ing = t["armor_recipe"]
        out.append((f"{tier}_armor_{piece}", pat, fill(ing, piece=piece)))
    for tool in ("axe", "pickaxe", "shovel", "hoe"):
        pat, ing = t["tool_recipe"]
        out.append((f"{tier}_{tool}", pat, fill(ing, tool=tool)))
    pat, ing = t["sword_recipe"]
    out.append((f"{tier}_sword", pat, dict(ing)))
    pat, ing = t["bow_recipe"]
    out.append((f"{tier}_bow", pat, dict(ing)))
    return out


def recolor(img, kind):
    return img if kind is None else BOOK.recolor_blue(img)


def tier_assets(base, ns, tier):
    t = TIERS[tier]
    src = os.path.join(ROOT, "crimson_armor")
    kind = t["recolor"]
    for n in (1, 2):
        write(f"{base}/textures/armor/{tier}_armor/layer_{n}.png",
              recolor(Image.open(f"{src}/armor_layer_{n}.png").convert("RGBA"), kind))
    for piece in PIECES:
        write(f"{base}/textures/item/armor/{tier}_armor_{piece}.png",
              recolor(Image.open(f"{src}/items/crimson_{piece}.png").convert("RGBA"), kind))
    for tool in TOOL_MATERIALS:
        tex = Image.open(f"{src}/items/crimson_{tool}.png").convert("RGBA")
        ref = f"{ns}:item/tools/{tier}_{tool}"
        write(f"{base}/textures/item/tools/{tier}_{tool}.png",
              recolor(animate(tex, CRIMSON_GLOW, CRIMSON_BLADE), kind))
        write(f"{base}/textures/item/tools/{tier}_{tool}.png.mcmeta", MCMETA)
        write(f"{base}/textures/item/tools/{tier}_{tool}_icon.png", recolor(tex, kind))
        write(f"{base}/models/item/tools/{tier}_{tool}.json", {
            "texture_size": list(tex.size),
            "textures": {"layer0": ref, "particle": ref},
            "gui_light": "front",
            "elements": CU.tool_elements(tex),   # geometry/glow classified on the crimson colours
            "display": TOOL_DISPLAY[tool],
        })
    # bow: ItemsAdder picks up <model>_0/_1/_2 as the pulling states
    for state, suffix in (("bow", ""), ("bow_pulling_0", "_0"), ("bow_pulling_1", "_1"), ("bow_pulling_2", "_2")):
        tex = Image.open(f"{src}/items/crimson_{state}.png").convert("RGBA")
        name = f"{tier}_bow{suffix}"
        ref = f"{ns}:item/tools/{name}"
        write(f"{base}/textures/item/tools/{name}.png", recolor(animate(tex, CRIMSON_GLOW, CRIMSON_BLADE), kind))
        write(f"{base}/textures/item/tools/{name}.png.mcmeta", MCMETA)
        if not suffix:
            write(f"{base}/textures/item/tools/{name}_icon.png", recolor(tex, kind))
        write(f"{base}/models/item/tools/{name}.json", {
            "texture_size": list(tex.size),
            "textures": {"layer0": ref, "particle": ref},
            "gui_light": "front",
            "elements": CU.tool_elements(tex),
            "display": build_model.BOW_DISPLAY,
        })

    # 3D helmet: visor, gold crest and branches from the shoulder blades
    layer1 = Image.open(f"{src}/armor_layer_1.png").convert("RGBA")
    write(f"{base}/textures/item/armor/{tier}_parts.png", recolor(animate(CU.atlas(layer1), CU.GLOW), kind))
    write(f"{base}/textures/item/armor/{tier}_parts.png.mcmeta", MCMETA)
    write(f"{base}/models/item/armor/{tier}_helmet.json", CU.helmet_model(f"{ns}:item/armor/{tier}_parts"))


def tier_items(ns, tier):
    t = TIERS[tier]
    lore = "    lore:\n" + "".join(f"      - '{line}'\n" for line in t["lore"])
    stats = f"""        armorToughness: {t["toughness"]}
        knockbackResistance: {t["knockback"]}"""
    h_armor, h_dura = t["armor"]["helmet"]
    items = [f"""  {tier}_armor_helmet:
    enabled: true
    display_name: '{t["color"]}{t["name"]} Helmet'
{lore}    behaviours:
      hat: true
    resource:
      material: PAPER
      generate: false
      model_path: item/armor/{tier}_helmet
    durability:
      max_custom_durability: {h_dura}
    attribute_modifiers:
      head:
        armor: {h_armor}
{stats}"""]
    for piece in PIECES[1:]:
        armor, dura = t["armor"][piece]
        items.append(f"""  {tier}_armor_{piece}:
    enabled: true
    display_name: '{t["color"]}{t["name"]} {piece.capitalize()}'
{lore}    resource:
      material: NETHERITE_{piece.upper()}
      generate: true
      textures:
        - item/armor/{tier}_armor_{piece}
    durability:
      max_custom_durability: {dura}
    equipment:
      id: {ns}:{tier}_armor
      slot: {SLOTS[piece]}
      slot_attribute_modifiers:
        armor: {armor}
{stats.replace("        ", "        ")}""")
    for tool, mat in TOOL_MATERIALS.items():
        items.append(f"""  {tier}_{tool}:
    enabled: true
    display_name: '{t["color"]}{t["name"]} {tool.capitalize()}'
{lore}    resource:
      material: {mat}
      model_path: item/tools/{tier}_{tool}
      icon: item/tools/{tier}_{tool}_icon
    durability:
      max_custom_durability: {t["tool_durability"]}
    attribute_modifiers:
      mainhand:
        attackDamage: {t["damage"][tool]}
        attackSpeed: {TOOL_SPEED[tool]}""")
    items.append(f"""  {tier}_bow:
    enabled: true
    display_name: '{t["color"]}{t["name"]} Bow'
{lore}    resource:
      material: BOW
      generate: false
      model_path: item/tools/{tier}_bow
      icon: item/tools/{tier}_bow_icon
    durability:
      max_custom_durability: {t["bow_durability"]}""")
    recs = []
    for item, pat, ing in recipes_of(tier):
        recs.append(f"""    {item}:
      permission: itemsadder.craft.{item}
      enabled: true
      pattern:
""" + "".join(f"        - {row}\n" for row in pat) + "      ingredients:\n"
            + "".join(f"        {k}: {v}\n" for k, v in ing.items()) + f"""      result:
        item: {ns}:{item}
        amount: 1""")
    return items, recs


def crimson(base):
    ns = "crimson-gear"
    write(f"{base}/configs/equipments.yml", f"""info:
  namespace: {ns}
equipments:
""" + "".join(f"""  {tier}_armor:
    type: armor
    layer_1: armor/{tier}_armor/layer_1
    layer_2: armor/{tier}_armor/layer_2
""" for tier in TIERS))
    items, recs = [], []
    for tier in TIERS:
        tier_assets(base, ns, tier)
        i, r = tier_items(ns, tier)
        items += i
        recs += r
    # recipe book: an /ia item that turns into the readable written book on right-click
    pages = BOOK.build(base, ns, {tier: recipes_of(tier) for tier in TIERS})
    BOOK.write_commands(pages)
    write(f"{base}/textures/item/crimson_recipe_book.png", BOOK.book_icon())
    BOOK.write_datapack(pages, os.path.join(ROOT, "itemsadder", "crimson_forge_datapack.zip"))
    command = f"execute as {{player}} run function {BOOK.DATAPACK}:swap_book"
    items.append(f"""  crimson_recipe_book:
    enabled: true
    display_name: '&6Crimson Forge Recipe Book'
    lore:
      - '&f'
      - '&7Every Crimson and Blue Crimson recipe.'
      - '&eRight-click to open'
      - '&8or type /trigger recipebook'
    resource:
      material: BOOK
      generate: true
      textures:
        - item/crimson_recipe_book
    events:
      interact:
        right:
          execute_commands:
            - command: '{command}'
              as_console: true""")
    write(f"{base}/configs/items.yml", f"""info:
  namespace: {ns}
recipes:
  crafting_table:
{chr(10).join(recs)}
items:
{chr(10).join(items)}
""")
    listed = ["crimson_recipe_book"] + [i.split(":")[0].strip() for i in items if not i.strip().startswith("crimson_recipe_book")]
    write(f"{base}/configs/categories.yml", f"""info:
  namespace: {ns}
categories:
  crimson_forge:
    enabled: true
    name: '&cCrimson Forge'
    icon: {ns}:crimson_recipe_book
    permission: ia.menu.crimson_forge
    items:
""" + "".join(f"      - {ns}:{i}\n" for i in listed))


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
    lore:
      - '&f'
      - '&4Forged in hellfire'
      - '&8Admin only'
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
    lore:
      - '&f'
      - '&4Forged in hellfire'
      - '&8Admin only'
    permission: {ns}.{piece}
    resource:
      material: NETHERITE_{piece.upper()}
      generate: true
      textures:
        - item/armor/demon_armor_{piece}
    durability:
      max_custom_durability: {dura}
    equipment:
      id: {ns}:demon_armor
      slot: {SLOTS[piece]}
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
    write(f"{base}/configs/categories.yml", f"""info:
  namespace: {ns}
categories:
  demon_forge:
    enabled: true
    name: '&4Demon Armor'
    icon: {ns}:demon_armor_helmet
    permission: ia.menu.demon_forge
    items:
""" + "".join(f"      - {ns}:demon_armor_{p}\n" for p in ("helmet", "chestplate", "leggings", "boots")))


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
