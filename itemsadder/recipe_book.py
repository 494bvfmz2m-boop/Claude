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
        "ECHO_SHARD": grid([
            "................", "...........oo...", "..........occo...", ".........octco..",
            "........octto...", ".......octto....", "......octto.....", ".....octto......",
            "....octto.......", "...octto........", "...otto.........", "...ooo..........",
            "................", "................", "................", "................"],
            {"o": (10, 40, 50), "c": (60, 200, 210), "t": (20, 90, 100)}),
    }


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
         "BLAZE_ROD": "Blaze Rod", "ECHO_SHARD": "Echo Shard"}


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
TITLES = {"armor": "Armor", "tool": "Tools", "sword": "Sword"}


def pages_for(tier_label, color, recipes):
    """Pick the representative recipes: chestplate, pickaxe, sword."""
    by_id = {item: (pat, ing) for item, pat, ing in recipes}
    prefix = recipes[0][0].split("_armor_")[0]
    return [
        ("armor", f"{prefix}_armor_chestplate", "Same for every piece:\nuse the matching piece."),
        ("tool", f"{prefix}_pickaxe", "Same for axe, shovel\nand hoe: use the\nmatching tool."),
        ("sword", f"{prefix}_sword", ""),
    ], by_id


def counts(pattern, ingredients):
    out = {}
    for row in pattern:
        for ch in row:
            if ch in ingredients:
                out[ingredients[ch]] = out.get(ingredients[ch], 0) + 1
    return out


def build(base, ns, tier_recipes):
    """Writes the font + pictures into <base>/resourcepack/ and the book
    commands next to the builder."""
    van = vanilla_icons()
    font_dir = f"{base}/resourcepack/assets/{ns}"
    providers, pages, n = [], [], 0
    labels = {"crimson": ("Crimson", "dark_red"), "blue_crimson": ("Blue Crimson", "dark_aqua")}
    pages.append([
        {"text": "Crimson Forge\n\n", "color": "dark_red", "bold": True},
        {"text": "Recipes for Crimson and Blue Crimson gear.\n\nCraft them on a crafting table. Empty squares stay empty.\n\nBlue Crimson is made from Crimson gear.",
         "color": "black", "bold": False},
    ])
    for tier, recipes in tier_recipes.items():
        label, color = labels[tier]
        picks, by_id = pages_for(label, color, recipes)
        for kind, item, note in picks:
            pat, ing = by_id[item]
            pic = recipe_picture(pat, ing, item_icon(item), van)
            os.makedirs(f"{font_dir}/textures/font", exist_ok=True)
            pic.save(f"{font_dir}/textures/font/recipe_{n}.png")
            ch = chr(FIRST_CHAR + n)
            providers.append({"type": "bitmap", "file": f"{ns}:font/recipe_{n}.png",
                              "height": GLYPH_H, "ascent": GLYPH_ASCENT, "chars": [ch]})
            legend = "\n".join(f"{v}x {ingredient_name(k)}" for k, v in counts(pat, ing).items())
            pages.append([
                {"text": f"{label} {TITLES[kind]}\n", "color": color, "bold": True},
                {"text": ch, "font": f"{ns}:recipes", "color": "white", "bold": False},
                {"text": "\n" * 6, "bold": False},
                {"text": legend + ("\n" + note if note else ""), "color": "black", "bold": False},
            ])
            n += 1
    os.makedirs(f"{font_dir}/font", exist_ok=True)
    with open(f"{font_dir}/font/recipes.json", "w") as f:
        json.dump({"providers": providers}, f, indent=1, ensure_ascii=True)
    write_commands(pages)
    return pages


def snbt(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, str):
        esc = "".join(f"\\u{ord(c):04x}" if ord(c) > 126 else c for c in v)
        return '"' + esc.replace('"', '\\"').replace("\n", "\\n") + '"'
    if isinstance(v, list):
        return "[" + ",".join(snbt(x) for x in v) + "]"
    return "{" + ",".join(f"{k}:{snbt(x)}" for k, x in v.items()) + "}"


def write_commands(pages):
    new = ("give @p minecraft:written_book[minecraft:written_book_content={title:\"Crimson Forge\","
           "author:\"SlothSMP\",pages:[" + ",".join(snbt(p) for p in pages) + "]}]")
    old = ("give @p minecraft:written_book[minecraft:written_book_content={title:\"Crimson Forge\","
           "author:\"SlothSMP\",pages:[" + ",".join(
               "'" + json.dumps(p, ensure_ascii=True).replace("\\", "\\\\").replace("'", "\\'") + "'"
               for p in pages) + "]}]")
    path = os.path.join(ROOT, "itemsadder", "recipe_book_commands.txt")
    with open(path, "w") as f:
        f.write("# Crimson Forge recipe book. Run from the server console (too long for chat).\n\n")
        f.write("# Minecraft 1.21.5 and newer:\n" + new + "\n\n")
        f.write("# Minecraft 1.20.5 - 1.21.4:\n" + old + "\n")
