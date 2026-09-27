"""Recipe book: each recipe is drawn as a picture (3x3 grid -> result) and
mapped to a private-use character in a custom font, so a normal written book
can show it. Also holds the Blue Crimson recolour.
"""
import colorsys
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "crimson_armor")
GOLDS = {(196, 142, 44), (246, 204, 96), (120, 72, 22)}
FIRST_CHAR = 0xE900
GLYPH_H, GLYPH_ASCENT = 54, 7


# --- Blue Crimson recolour ------------------------------------------------
def blue(c):
    if c in GOLDS:
        return c
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
    deg = h * 360
    if deg <= 20 or deg >= 300:       # crimson reds and stem pinks -> blues and teals
        deg = (deg + 215) % 360
    elif deg < 60:                    # orange glow and buds -> cyan glow
        deg = (deg + 150) % 360
    r, g, b = colorsys.hsv_to_rgb(deg / 360, s, v)
    return (round(r * 255), round(g * 255), round(b * 255))


def recolor_blue(img):
    img = img.convert("RGBA")
    out = img.copy()
    px, cache = out.load(), {}
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            r, g, b, a = px[x, y]
            if a:
                if (r, g, b) not in cache:
                    cache[r, g, b] = blue((r, g, b))
                px[x, y] = cache[r, g, b] + (a,)
    return out


# --- ingredient icons (16x16, original pixel art) ---------------------------
def grid(rows, key):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key:
                img.putpixel((x, y), key[ch] + (255,))
    return img


def cube(top, left, right, speck=None, band=None):
    """Isometric block icon; top/left/right are colours, speck adds dots on the
    top face, band colours the upper rows of the sides."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            dx, dy = abs(x + 0.5 - 8) / 8, abs(y + 0.5 - 4.5) / 4.2
            if dx + dy <= 1:
                c = speck if speck and (x * 5 + y * 3) % 7 == 0 else top
            else:
                edge = 4.5 + 4.2 * (1 - dx)
                if not (edge <= y + 0.5 <= edge + 8.2):
                    continue
                c = left if x < 8 else right
                if band and y + 0.5 - edge < 2.5:
                    c = band if x < 8 else tuple(min(255, int(v * 1.12)) for v in band)
            img.putpixel((x, y), c + (255,))
    # dark outline
    px = img.load()
    edge = [(x, y) for y in range(16) for x in range(16) if px[x, y][3] and any(
        not (0 <= x + a < 16 and 0 <= y + b < 16) or px[x + a, y + b][3] == 0
        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        c = px[x, y]
        px[x, y] = (c[0] // 2, c[1] // 2, c[2] // 2, 255)
    return img


def vanilla_icons():
    O = (40, 30, 40)
    return {
        "GHAST_TEAR": grid([
            "................", "................", ".......o........", "......owo.......",
            "......owo.......", ".....owwbo......", ".....owwbo......", "....owwwwbo.....",
            "....owwwwbo.....", "....owwwbbo.....", "....owwbbbo.....", ".....obbbo......",
            "......ooo.......", "................", "................", "................"],
            {"o": (70, 90, 110), "w": (250, 252, 255), "b": (190, 215, 235)}),
        "REDSTONE_BLOCK": cube((200, 24, 16), (140, 14, 10), (170, 20, 14), speck=(255, 90, 70)),
        "LAPIS_BLOCK": cube((40, 80, 200), (24, 50, 140), (32, 64, 170), speck=(110, 150, 255)),
        "END_STONE": cube((228, 230, 170), (190, 192, 136), (210, 212, 152), speck=(200, 196, 130)),
        "DIAMOND_BLOCK": cube((120, 236, 228), (70, 190, 184), (96, 214, 206), speck=(220, 255, 250)),
        "DRAGON_BREATH": grid([
            "................", "......oooo......", "......occo......", ".......oo.......",
            "......owwo......", ".....owppwo.....", "....oppPPpwo....", "...opPPPPppwo...",
            "...opPPPPPppo...", "...oppPPPpppo...", "...opppppppo....", "....oppppppo....",
            ".....oooooo.....", "................", "................", "................"],
            {"o": O, "c": (150, 110, 70), "w": (235, 225, 245), "p": (200, 90, 200), "P": (240, 150, 230)}),
        "BLAZE_ROD": grid([
            "................", "............oo..", "...........oyo..", "..........oyoo..",
            ".........oyo....", "........oyo.....", ".......oyo......", "......oyo.......",
            ".....oyo........", "....oyo.........", "...oyo..........", "..oyo...........",
            "..oo............", "................", "................", "................"],
            {"o": (150, 70, 10), "y": (255, 210, 60)}),
        "BOW": grid([
            "................", "..........ooo...", ".........obbso..", "........ob..so..",
            ".......ob...s...", "......ob....s...", ".....ob.....s...", "....ob......s...",
            "...ob.......s...", "..ob........s...", "..ob.......s....", "...oo.....s.....",
            ".....ooo.s......", "........oo......", "................", "................"],
            {"o": (70, 40, 20), "b": (150, 100, 50), "s": (230, 230, 230)}),
        "ECHO_SHARD": grid([
            "................", "...........oo...", "..........occo...", ".........octco..",
            "........octto...", ".......octto....", "......octto.....", ".....octto......",
            "....octto.......", "...octto........", "...otto.........", "...ooo..........",
            "................", "................", "................", "................"],
            {"o": (10, 40, 50), "c": (60, 200, 210), "t": (20, 90, 100)}),
    }


def book_icon():
    return grid([
        "................", "................", "...oooooooooo...", "..oRRRRRRRRRRo..",
        "..oRrrrrrrrrRo..", "..oRrGGGGGGrRo..", "..oRrGyyyyGrRo..", "..oRrGyggyGrRo..",
        "..oRrGyyyyGrRo..", "..oRrGGGGGGrRo..", "..oRrrrrrrrrRo..", "..oRRRRRRRRRRo..",
        "..owwwwwwwwwwo..", "...oooooooooo...", "................", "................"],
        {"o": (40, 8, 12), "R": (150, 20, 30), "r": (120, 14, 24), "G": (246, 204, 96),
         "y": (196, 142, 44), "g": (255, 90, 60), "w": (236, 226, 200)})


def netherite(img):
    out = img.convert("RGBA").copy()
    px = out.load()
    for y in range(out.size[1]):
        for x in range(out.size[0]):
            r, g, b, a = px[x, y]
            if a:
                v = (r * 3 + g * 5 + b * 2) / 10
                px[x, y] = (int(v * 0.42 + 18), int(v * 0.38 + 16), int(v * 0.40 + 18), a)
    return out


def shrink(img32):
    small = img32.convert("RGBA").resize((16, 16), Image.BOX)
    px = small.load()
    for y in range(16):
        for x in range(16):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a > 100 else (0, 0, 0, 0)
    return small


def item_icon(name, tier=None):
    """Icon for a crimson-gear item id like 'crimson_armor_chestplate' or 'blue_crimson_sword'."""
    for piece in ("helmet", "chestplate", "leggings", "boots"):
        if name.endswith("armor_" + piece):
            img = Image.open(f"{SRC}/items/crimson_{piece}.png").convert("RGBA")
            break
    else:
        tool = name.rsplit("_", 1)[1]
        img = shrink(Image.open(f"{SRC}/items/crimson_{tool}.png"))
    return recolor_blue(img) if name.startswith("blue_") else img


def icon_for(ingredient, van):
    if ingredient in van:
        return van[ingredient]
    if ingredient.startswith("NETHERITE_"):
        kind = ingredient.split("_", 1)[1].lower()
        return netherite(item_icon("crimson_armor_" + kind if kind in ("helmet", "chestplate", "leggings", "boots")
                                   else "crimson_" + kind))
    if ingredient.startswith("crimson-gear:"):
        return item_icon(ingredient.split(":", 1)[1])
    raise KeyError(ingredient)


NAMES = {"GHAST_TEAR": "Ghast Tear", "REDSTONE_BLOCK": "Redstone Block", "LAPIS_BLOCK": "Lapis Block",
         "END_STONE": "End Stone", "DIAMOND_BLOCK": "Diamond Block", "DRAGON_BREATH": "Dragon's Breath",
         "BLAZE_ROD": "Blaze Rod", "ECHO_SHARD": "Echo Shard", "BOW": "Bow"}


def ingredient_name(ingredient):
    if ingredient in NAMES:
        return NAMES[ingredient]
    if ingredient.startswith("NETHERITE_"):
        return "Netherite " + ingredient.split("_", 1)[1].capitalize()
    return "Crimson " + ingredient.split(":", 1)[1].replace("crimson_armor_", "").replace("crimson_", "").capitalize()


# --- recipe pictures ------------------------------------------------------------
def slot(img, x0, y0, size, icon=None):
    for y in range(size):
        for x in range(size):
            if x == 0 or y == 0:
                c = (55, 55, 55)
            elif x == size - 1 or y == size - 1:
                c = (255, 255, 255)
            else:
                c = (139, 139, 139)
            img.putpixel((x0 + x, y0 + y), c + (255,))
    if icon:
        o = (size - 16) // 2
        img.alpha_composite(icon, (x0 + o, y0 + o))


def recipe_picture(pattern, ingredients, result_icon, van):
    img = Image.new("RGBA", (106, GLYPH_H), (0, 0, 0, 0))
    for r, row in enumerate(pattern):
        for c, ch in enumerate(row):
            ing = ingredients.get(ch)
            slot(img, c * 18, r * 18, 18, icon_for(ing, van) if ing else None)
    # arrow
    for y in range(22, 32):
        for x in range(58, 76):
            head = x >= 68 and abs(y + 0.5 - 27) <= (76 - x) * 0.7
            shaft = x < 68 and 25 <= y <= 28
            if head or shaft:
                img.putpixel((x, y), (139, 139, 139, 255) if not (head and x == 68) else (110, 110, 110, 255))
    slot(img, 80, 14, 26, result_icon)
    return img


# --- book -----------------------------------------------------------------------
ORDER = ("armor_helmet", "armor_chestplate", "armor_leggings", "armor_boots",
         "sword", "axe", "pickaxe", "shovel", "hoe", "bow")
LABELS = {"crimson": ("Crimson", "dark_red"), "blue_crimson": ("Blue Crimson", "dark_aqua")}
SHORT = {"crimson": "Crimson", "blue_crimson": "Blue"}   # page titles must fit one book line


def item_title(tier, item):
    return f"{SHORT[tier]} {item.rsplit('_', 1)[1].capitalize()}"


def counts(pattern, ingredients):
    out = {}
    for row in pattern:
        for ch in row:
            if ch in ingredients:
                out[ingredients[ch]] = out.get(ingredients[ch], 0) + 1
    return out


def build(base, ns, tier_recipes):
    """Writes the font + pictures into <base>/resourcepack/ and returns the
    book pages (text components). Page 1..n are indexes, then one page per item."""
    van = vanilla_icons()
    font_dir = f"{base}/resourcepack/assets/{ns}"
    os.makedirs(f"{font_dir}/textures/font", exist_ok=True)
    os.makedirs(f"{font_dir}/font", exist_ok=True)
    tiers = list(tier_recipes)
    index_page = {t: i + 1 for i, t in enumerate(tiers)}
    ordered = []   # (tier, item, pattern, ingredients)
    for t in tiers:
        by_id = {item: (pat, ing) for item, pat, ing in tier_recipes[t]}
        for suffix in ORDER:
            item = f"{t}_{suffix}"
            ordered.append((t, item) + by_id[item])
    first_recipe_page = len(tiers) + 1

    pages = []
    for i, t in enumerate(tiers):
        label, color = LABELS[t]
        page = []
        if i == 0:
            page.append({"text": "Crimson Forge\n", "color": "dark_red", "bold": True})
            page.append({"text": "Click to open:\n", "color": "dark_gray", "bold": False})
        page.append({"text": f"{label} gear\n", "color": color, "bold": True})
        for n, (tt, item, _, _) in enumerate(ordered):
            if tt == t:
                page.append({"text": f" > {item.rsplit('_', 1)[1].capitalize()}\n", "color": "black", "bold": False,
                             "underlined": False,
                             "click_event": {"action": "change_page", "page": first_recipe_page + n},
                             "hover_event": {"action": "show_text", "value": "Open recipe"}})
        if i + 1 < len(tiers):
            nl, nc = LABELS[tiers[i + 1]]
            page.append({"text": f"{nl} >>", "color": nc, "bold": False,
                         "click_event": {"action": "change_page", "page": i + 2}})
        pages.append(page)

    providers = []
    for n, (t, item, pat, ing) in enumerate(ordered):
        label, color = LABELS[t]
        recipe_picture(pat, ing, item_icon(item), van).save(f"{font_dir}/textures/font/recipe_{n}.png")
        ch = chr(FIRST_CHAR + n)
        providers.append({"type": "bitmap", "file": f"{ns}:font/recipe_{n}.png",
                          "height": GLYPH_H, "ascent": GLYPH_ASCENT, "chars": [ch]})
        legend = "".join(f"{v}x {ingredient_name(k)}\n" for k, v in counts(pat, ing).items())
        pages.append([
            {"text": item_title(t, item) + "\n", "color": color, "bold": False, "underlined": True},
            {"text": ch, "font": f"{ns}:recipes", "color": "white", "bold": False},
            {"text": "\n" * 6, "bold": False},
            {"text": legend, "color": "black", "bold": False},
            {"text": "<< Index", "color": "dark_gray", "bold": False,
             "click_event": {"action": "change_page", "page": index_page[t]}},
        ])
    with open(f"{font_dir}/font/recipes.json", "w") as f:
        json.dump({"providers": providers}, f, indent=1, ensure_ascii=True)
    return pages


def snbt(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        esc = "".join(f"\\u{ord(c):04x}" if ord(c) > 126 else c for c in v)
        return '"' + esc.replace('"', '\\"').replace("\n", "\\n") + '"'
    if isinstance(v, list):
        return "[" + ",".join(snbt(x) for x in v) + "]"
    return "{" + ",".join(f"{k}:{snbt(x)}" for k, x in v.items()) + "}"


def book_item(pages):
    return ('minecraft:written_book[minecraft:written_book_content={title:"Crimson Forge",'
            'author:"SlothSMP",pages:[' + ",".join(snbt(p) for p in pages) + "]}]")


DATAPACK = "crimson_forge"


BOOK_RECIPE = ["minecraft:writable_book", "minecraft:ghast_tear", "minecraft:redstone"]


def write_datapack(pages, out_zip):
    """Vanilla datapack: a crafting recipe whose result is the signed
    Crimson Forge book with every recipe page already written, plus an
    advancement that unlocks it in the recipe book once you hold a Book and
    Quill. /function crimson_forge:give_book hands one out directly."""
    import zipfile
    book = {"id": "minecraft:written_book", "count": 1, "components": {
        "minecraft:written_book_content": {"title": "Crimson Forge", "author": "SlothSMP", "pages": pages},
        "minecraft:enchantment_glint_override": True}}
    files = {
        "pack.mcmeta": {"pack": {"description": "Crimson Forge recipe book",
                                 "pack_format": 88, "supported_formats": [71, 999],
                                 "min_format": 71, "max_format": 999}},
        f"data/{DATAPACK}/recipe/crimson_forge_book.json": {
            "type": "minecraft:crafting_shapeless", "category": "misc",
            "ingredients": BOOK_RECIPE, "result": book},
        f"data/{DATAPACK}/advancement/recipes/crimson_forge_book.json": {
            "parent": "minecraft:recipes/root",
            "criteria": {
                "has_book_and_quill": {"trigger": "minecraft:inventory_changed",
                                       "conditions": {"items": [{"items": "minecraft:writable_book"}]}},
                "has_the_recipe": {"trigger": "minecraft:recipe_unlocked",
                                   "conditions": {"recipe": f"{DATAPACK}:crimson_forge_book"}}},
            "requirements": [["has_book_and_quill", "has_the_recipe"]],
            "rewards": {"recipes": [f"{DATAPACK}:crimson_forge_book"]}},
        f"data/{DATAPACK}/function/give_book.mcfunction": f"give @s {book_item(pages)}\n",
    }
    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data if isinstance(data, str) else json.dumps(data, indent=1, ensure_ascii=True))


def write_commands(pages):
    path = os.path.join(ROOT, "itemsadder", "recipe_book_commands.txt")
    with open(path, "w") as f:
        f.write("# Crimson Forge recipe book (Minecraft 26.x / 1.21.5+).\n"
                "# Players craft it (datapack): Book and Quill + Ghast Tear + Redstone Dust.\n"
                "# Admins with the datapack: /function crimson_forge:give_book\n"
                "# Without the datapack, run this from the server console:\n\n")
        f.write("give @p " + book_item(pages) + "\n")
