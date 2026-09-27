"""Lore scrolls: each scroll carries a piece of the story and its recipes
spelled out row by row in the tooltip. Mobs drop them (ItemsAdder loots) and
they can be crafted."""
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
                    ["sword_recipe", "bow_recipe", "shield_recipe"], "WITHER_SKELETON", 5),
    },
    "blue_crimson": {
        "armor": ("Scroll of Blue Crimson Armor", ["Cold to the touch. Found", "inside the Warden's chest."],
                  ["armor_recipe"], "WARDEN", 100),
        "tools": ("Scroll of Blue Crimson Tools", ["Salt-stained, sealed in lapis.", "Guarded by the Elder."],
                  ["tool_recipe"], "ELDER_GUARDIAN", 50),
        "weapons": ("Scroll of Blue Crimson Weapons", ["It hums like an echo", "in the deep dark."],
                    ["sword_recipe", "bow_recipe", "shield_recipe"], "WARDEN", 100),
    },
    "halloween": {
        "armor": ("Scroll of Halloween Armor", ["Carved into a pumpkin rind", "on the night the Wither woke."],
                  ["armor_recipe"], "WITHER", 100),
        "tools": ("Scroll of Halloween Tools", ["A witch's shopping list.", "Most of it is screaming."],
                  ["tool_recipe"], "WITCH", 8),
        "weapons": ("Scroll of Halloween Weapons", ["The candle inside never", "went out. Neither did he."],
                    ["sword_recipe", "bow_recipe", "shield_recipe"], "WITHER", 100),
    },
}
ACCENT = {"crimson": "&c", "blue_crimson": "&b", "halloween": "&6"}
SEAL = {"crimson": (170, 20, 30), "blue_crimson": (30, 110, 200), "halloween": (230, 120, 20)}
# crafting recipes for the scrolls themselves: paper + the materials of their story;
# every Blue Crimson scroll is reforged from its Crimson scroll
SCROLL_RECIPES = {
    "crimson_scroll_armor": (["GRG", "PNP", "GRG"], {"G": "GHAST_TEAR", "R": "REDSTONE", "P": "BOOK",
                                                     "N": "NETHERITE_SCRAP"}),
    "crimson_scroll_tools": (["BRB", "PDP", "BRB"], {"B": "BLAZE_POWDER", "R": "REDSTONE", "P": "BOOK",
                                                     "D": "DIAMOND"}),
    "crimson_scroll_weapons": (["MRM", "PFP", "MRM"], {"M": "MAGMA_CREAM", "R": "REDSTONE", "P": "BOOK",
                                                       "F": "FIRE_CHARGE"}),
    "blue_crimson_scroll_armor": (["ELE", "PSP", "ELE"], {"E": "ECHO_SHARD", "L": "LAPIS_LAZULI", "P": "BOOK",
                                                          "S": "crimson-gear:crimson_scroll_armor"}),
    "blue_crimson_scroll_tools": (["HLH", "PSP", "HLH"], {"H": "PRISMARINE_SHARD", "L": "LAPIS_LAZULI", "P": "BOOK",
                                                          "S": "crimson-gear:crimson_scroll_tools"}),
    "blue_crimson_scroll_weapons": (["ALA", "PSP", "ALA"], {"A": "AMETHYST_SHARD", "L": "LAPIS_LAZULI",
                                                            "P": "BOOK", "S": "crimson-gear:crimson_scroll_weapons"}),
    "halloween_scroll_armor": (["JWJ", "PCP", "JWJ"], {"J": "JACK_O_LANTERN", "W": "WITHER_SKELETON_SKULL",
                                                       "P": "BOOK", "C": "CARVED_PUMPKIN"}),
    "halloween_scroll_tools": (["JSJ", "PCP", "JSJ"], {"J": "JACK_O_LANTERN", "S": "SPIDER_EYE",
                                                       "P": "BOOK", "C": "CARVED_PUMPKIN"}),
    "halloween_scroll_weapons": (["JRJ", "PCP", "JRJ"], {"J": "JACK_O_LANTERN", "R": "WITHER_ROSE",
                                                         "P": "BOOK", "C": "CARVED_PUMPKIN"}),
}
MOB_NAMES = {"GHAST": "Ghasts", "BLAZE": "Blazes", "WITHER_SKELETON": "Wither Skeletons",
             "WARDEN": "the Warden", "ELDER_GUARDIAN": "Elder Guardians", "WITHER": "the Wither",
             "WITCH": "Witches"}
MAKES = {"armor_recipe": "Helmet, Chestplate, Leggings, Boots", "tool_recipe": "Pickaxe, Axe, Shovel, Hoe",
         "sword_recipe": "Sword", "bow_recipe": "Bow", "shield_recipe": "Shield"}
BASE_NOTE = {"armor_recipe": "Middle: use the piece you are upgrading.",
             "tool_recipe": "Middle: use the tool you are upgrading."}
NAMES = {"GHAST_TEAR": "Ghast Tear", "REDSTONE_BLOCK": "Redstone Block", "REDSTONE": "Redstone",
         "LAPIS_BLOCK": "Lapis Block", "LAPIS_LAZULI": "Lapis Lazuli", "END_STONE": "End Stone",
         "DIAMOND_BLOCK": "Diamond Block", "DIAMOND": "Diamond", "DRAGON_BREATH": "Dragon's Breath",
         "BLAZE_ROD": "Blaze Rod", "BLAZE_POWDER": "Blaze Powder", "ECHO_SHARD": "Echo Shard", "BOW": "Bow",
         "PAPER": "Paper", "BOOK": "Book", "SHIELD": "Shield", "NETHERITE_SCRAP": "Netherite Scrap", "NETHERITE_INGOT": "Netherite Ingot",
         "MAGMA_CREAM": "Magma Cream", "FIRE_CHARGE": "Fire Charge", "PRISMARINE_SHARD": "Prismarine Shard",
         "AMETHYST_SHARD": "Amethyst Shard", "NETHER_STAR": "Nether Star", "JACK_O_LANTERN": "Jack o'Lantern",
         "WITHER_SKELETON_SKULL": "Wither Skull", "CARVED_PUMPKIN": "Carved Pumpkin", "WITHER_ROSE": "Wither Rose", "SPIDER_EYE": "Spider Eye",
         "NETHERITE_SWORD": "Netherite Sword"}
TIER_NAMES = {"crimson": "Crimson", "blue_crimson": "Blue Crimson", "halloween": "Halloween"}


def ingredient(value):
    if value in NAMES:
        return NAMES[value]
    if value.startswith("NETHERITE_{"):
        return "Netherite " + ("piece" if "PIECE" in value else "tool")
    item = value.split(":", 1)[1]
    for tier in ("blue_crimson", "crimson", "halloween"):
        if item.startswith(tier + "_"):
            rest = item[len(tier) + 1:]
            if rest.startswith("scroll_"):
                return f"{TIER_NAMES[tier]} {rest[7:].capitalize()} Scroll"
            if "{piece}" in rest:
                return f"{TIER_NAMES[tier]} piece"
            if "{tool}" in rest:
                return f"{TIER_NAMES[tier]} tool"
            return f"{TIER_NAMES[tier]} {rest.replace('armor_', '').capitalize()}"
    return value


def recipe_lines(pattern, ingredients, accent):
    lines = []
    for label, row in zip(("Top", "Middle", "Bottom"), pattern):
        cells = [ingredient(ingredients[ch]) if ch in ingredients else "empty" for ch in row]
        lines.append(f"&7{label}: &f" + "&7, &f".join(cells))
    return lines


def lore(tier_cfg, scroll, accent):
    title, story, keys, mob, chance = scroll
    out = ["&f"] + [f"&o&7{s}" for s in story]
    for key in keys:
        pattern, ingredients = tier_cfg[key]
        out += ["&f", f"{accent}Makes: &f{MAKES[key]}", "&8(crafting table)"]
        out += recipe_lines(pattern, ingredients, accent)
        if key in BASE_NOTE:
            out.append(f"&8{BASE_NOTE[key]}")
    out += ["&f", f"&8Craft this scroll, or take it from {MOB_NAMES[mob]}."]
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
