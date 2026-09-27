"""Lore scrolls: each scroll carries a piece of the story and a recipe written
as a 3x3 grid in its tooltip. Mobs drop them (ItemsAdder loots)."""
from PIL import Image

import recipe_book as RB

# scroll id suffix: (title, story lines, recipe keys from the tier, mob, drop chance %)
SCROLLS = {
    "crimson": {
        "armor": ("Scroll of Crimson Armor", ["A charred page, still warm.", "Ghasts weep it out as they die."],
                  ["armor_recipe"], "GHAST", 12),
        "tools": ("Scroll of Crimson Tools", ["Scrawled in ash by a", "blaze that forgot its name."],
                  ["tool_recipe"], "BLAZE", 6),
        "weapons": ("Scroll of Crimson Weapons", ["Wrapped around a wither", "skeleton's blackened spine."],
                    ["sword_recipe", "bow_recipe"], "WITHER_SKELETON", 5),
    },
    "blue_crimson": {
        "armor": ("Scroll of Blue Crimson Armor", ["Cold to the touch. Found", "inside the Warden's chest."],
                  ["armor_recipe"], "WARDEN", 100),
        "tools": ("Scroll of Blue Crimson Tools", ["Salt-stained, sealed in lapis.", "Guarded by the Elder."],
                  ["tool_recipe"], "ELDER_GUARDIAN", 50),
        "weapons": ("Scroll of Blue Crimson Weapons", ["It hums like an echo", "in the deep dark."],
                    ["sword_recipe", "bow_recipe"], "WARDEN", 100),
    },
}
RECIPE_LABEL = {"armor_recipe": "Any armor piece", "tool_recipe": "Any tool",
                "sword_recipe": "Sword", "bow_recipe": "Bow"}
TEMPLATE_NAMES = {"NETHERITE_{PIECE}": "Netherite piece (same slot)", "NETHERITE_{TOOL}": "Netherite tool (same kind)",
                  "crimson-gear:crimson_armor_{piece}": "Crimson piece (same slot)",
                  "crimson-gear:crimson_{tool}": "Crimson tool (same kind)"}


def ingredient(value):
    return TEMPLATE_NAMES.get(value) or RB.ingredient_name(value)


def recipe_lines(pattern, ingredients, accent):
    lines = []
    for row in pattern:
        cells = [f"{accent}{ch}" if ch in ingredients else "&8·" for ch in row]
        lines.append("&f   " + " ".join(cells))
    for key, value in ingredients.items():
        lines.append(f"&7 {accent}{key}&7 = {ingredient(value)}")
    return lines


def lore(tier_cfg, scroll, accent):
    title, story, keys, mob, chance = scroll
    out = ["&f"] + [f"&o&7{s}" for s in story]
    for key in keys:
        pattern, ingredients = tier_cfg[key]
        out += ["&f", f"&6{RECIPE_LABEL[key]}:" if accent == "&c" else f"&b{RECIPE_LABEL[key]}:"]
        out += recipe_lines(pattern, ingredients, accent)
    return out


def icon(seal):
    rows = [
        "................", "................", "..oooooooooooo..", ".oPPPPPPPPPPPPo.",
        ".opllllllllllpo.", "..opppppppppo...", "..oplLLlLLlpo...", "..opppppppppo...",
        "..oplLlLLllpo...", "..opppppppssso..", "..oplLLllpsSso..", ".oPPPPPPPPsssPo.",
        ".opllllllllllpo.", "..oooooooooooo..", "................", "................"]
    key = {"o": (70, 50, 30), "P": (200, 170, 120), "p": (232, 214, 170), "l": (180, 150, 105),
           "L": (120, 95, 70), "s": seal, "S": tuple(min(255, c + 70) for c in seal)}
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key:
                img.putpixel((x, y), key[ch] + (255,))
    return img
