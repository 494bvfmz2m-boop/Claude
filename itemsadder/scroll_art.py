"""Custom 16x16 scroll icons: every set gets its own scroll form (parchment,
hanging scroll, tome, stone tablet, bone scroll, crystal slate, leaf,
datapad, star map, sealed letter, banner, rune stone, quill) in its own
colours, with a glyph for what the scroll teaches: armor, tools or weapons."""
import math

from PIL import Image

GLYPHS = {   # 5x5
    "armor": ["x...x", "xxxxx", ".xxx.", ".xxx.", ".x.x."],
    "tools": ["xxxx.", "...x.", "..x.x", ".x...", "x...."],
    "weapons": ["....x", "...x.", "x.x..", ".x...", "x.x.."],
}
SHAPES = ("rolled", "rods", "tome", "tablet", "bone", "crystal", "leaf", "datapad", "map", "letter", "banner",
          "rune_stone", "quill")
GLOWING = {"crystal", "datapad", "rune_stone"}

STYLE = {   # set id -> scroll form
    "frostborn": "crystal", "druid": "leaf", "samurai": "rods", "pharaoh": "tablet", "atlantean": "rune_stone",
    "paladin": "tome", "clockwork": "datapad", "shadow": "letter", "dragon": "rolled", "mushroom": "quill",
    "obsidian": "crystal", "magma": "tablet", "storm": "banner", "void": "rune_stone", "celestial": "map",
    "solar": "banner", "moonlit": "rods", "viking": "rune_stone", "spartan": "tablet", "jaguar": "leaf",
    "bone": "bone", "pirate": "map", "neon": "datapad", "amethyst": "crystal", "jade": "rods", "sculk": "tome",
    "sakura": "quill", "hive": "rolled", "nomad": "map", "plague": "letter", "necro": "bone", "royal": "banner",
    "arcane": "tome", "seraph": "quill", "toxic": "datapad", "kraken": "rolled", "phoenix": "rolled",
    "werewolf": "bone", "rose": "letter", "prism": "rune_stone", "cowboy": "map", "monk": "tome",
    "redstone": "datapad", "oxidized": "tablet", "candy": "letter", "vampire": "rolled",
    "crimson": "rolled", "blue_crimson": "crystal", "halloween": "tome",
    "blackguard": "banner", "juggernaut": "tablet", "nyxite": "crystal",
    "witherbane": "bone", "dreadwyrm": "rune_stone", "leviathan": "crystal", "revenant": "letter",
}


VARIANT = {}
for _sid, _shape in STYLE.items():
    VARIANT[_sid] = sum(1 for k, v in VARIANT.items() if STYLE[k] == _shape)


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


class Icon:
    def __init__(self):
        self.px = {}

    def set(self, x, y, c):
        if 0 <= x < 16 and 0 <= y < 16 and c is not None:
            self.px[x, y] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)

    def glyph(self, kind, x0, y0, c, hi=None):
        for j, row in enumerate(GLYPHS[kind]):
            for i, ch in enumerate(row):
                if ch == "x":
                    self.set(x0 + i, y0 + j, c)
                    if hi and (i + j) % 3 == 0:
                        self.set(x0 + i, y0 + j, hi)

    def image(self, outline):
        img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        for (x, y), c in self.px.items():
            img.putpixel((x, y), c + (255,))
        for y in range(16):
            for x in range(16):
                if (x, y) not in self.px and any((x + dx, y + dy) in self.px
                                                 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    img.putpixel((x, y), outline + (255,))
        return img


def icon(S, kind):
    P = S["pal"]
    shape = STYLE.get(S["id"], "rolled")
    v = VARIANT.get(S["id"], 0)
    parch = mix((226, 206, 160), P["l"], 0.45)
    parch_d = shade(parch, 0.8)
    edge, edge_d = P["t"], P["t2"]
    ink = P["o"] if shape not in GLOWING else P["g"]
    seal = S.get("seal", P["g"])
    ic = Icon()
    if shape == "rolled":
        ic.rect(4, 4, 11, 11, parch)
        ic.rect(4, 11, 11, 11, parch_d)
        for x in (2, 3, 12, 13):
            ic.rect(x, 3, x, 12, edge if x in (2, 12) else edge_d)
        ic.set(2, 2, edge_d), ic.set(13, 13, edge_d)
        ic.glyph(kind, 5, 5, ink)
        ic.set(10, 10, seal), ic.set(11, 10, seal)
        if v == 1:                                           # ribbon tie
            ic.rect(4, 8, 11, 8, P["t"])
        elif v == 2:                                         # burnt edge
            for x in range(4, 12):
                ic.set(x, 4, shade(parch, 0.55) if x % 2 else P["o"])
        elif v == 3:                                         # gilded corners
            for x, y in ((4, 4), (11, 4), (4, 11), (11, 11)):
                ic.set(x, y, P["g"])
        elif v == 4:                                         # hex honeycomb corner
            for x, y in ((10, 4), (11, 4), (11, 5), (10, 6)):
                ic.set(x, y, P["t"])
    elif shape == "rods":
        ic.rect(3, 3, 12, 12, parch)
        ic.rect(2, 2, 13, 2, edge), ic.rect(2, 13, 13, 13, edge)
        ic.set(1, 2, edge_d), ic.set(14, 2, edge_d), ic.set(1, 13, edge_d), ic.set(14, 13, edge_d)
        ic.set(7, 1, edge_d), ic.set(8, 1, edge_d), ic.set(7, 0, edge_d)
        ic.rect(3, 3, 3, 12, P["m"]), ic.rect(12, 3, 12, 12, P["m"])
        ic.glyph(kind, 5, 5, ink)
        ic.set(7, 14, seal), ic.set(8, 14, seal)
    elif shape == "tome":
        ic.rect(3, 2, 12, 13, P["d"])
        ic.rect(12, 3, 13, 12, parch)
        ic.rect(3, 2, 4, 13, shade(P["d"], 0.7))
        for x, y in ((3, 2), (11, 2), (3, 13), (11, 13)):
            ic.set(x, y, edge), ic.set(x + 1, y, edge)
        ic.rect(5, 4, 11, 4, edge), ic.rect(5, 11, 11, 11, edge)
        ic.glyph(kind, 6, 5, P["g"], P["l"])
        ic.set(13, 7, edge), ic.set(13, 8, edge)
    elif shape == "tablet":
        stone = mix((150, 146, 140), P["m"], 0.35)
        ic.rect(3, 3, 12, 13, stone)
        ic.rect(5, 2, 10, 2, stone)
        ic.rect(4, 13, 12, 13, shade(stone, 0.75))
        ic.rect(12, 3, 12, 13, shade(stone, 0.8))
        ic.glyph(kind, 5, 6, shade(stone, 0.5))
        for x in (5, 7, 9):
            ic.set(x, 4, shade(stone, 0.6))
        ic.set(4, 11, P["t"]), ic.set(11, 5, shade(stone, 1.2))
        if v == 1:                                           # glowing cracks
            for x, y in ((9, 3), (9, 4), (10, 5), (10, 6), (11, 7)):
                ic.set(x, y, P["g"])
        elif v == 2:                                         # bronze rim
            ic.rect(3, 12, 12, 12, P["t"])
        elif v == 3:                                         # moss / verdigris
            for x, y in ((3, 12), (4, 12), (3, 11), (12, 4), (12, 3)):
                ic.set(x, y, P["t"])
    elif shape == "bone":
        hide = mix((200, 170, 120), P["m"], 0.2)
        ic.rect(4, 3, 11, 12, hide)
        bone, bone_d = (236, 228, 206), (196, 186, 162)
        for y in (2, 13):
            ic.rect(3, y, 12, y, bone)
            ic.set(2, y - 1, bone_d), ic.set(2, y + 1, bone_d), ic.set(13, y - 1, bone_d), ic.set(13, y + 1, bone_d)
        ic.glyph(kind, 5, 5, P["o"])
        ic.set(10, 11, seal)
        if v == 1:                                           # claws instead of knobs
            for x in (2, 13):
                ic.set(x, 1, P["a"]), ic.set(x, 14, P["a"])
            ic.rect(4, 3, 11, 3, P["m"])
        elif v == 2:                                         # green soul stitching
            for y in range(4, 12, 2):
                ic.set(4, y, P["g"]), ic.set(11, y, P["g"])
    elif shape == "crystal":
        for y in range(1, 15):
            w = min(y, 14 - y, 4) + 1
            for x in range(8 - w, 8 + w):
                ic.set(x, y, P["l"] if x < 8 - w // 2 else P["m"] if x < 8 + w // 2 else P["b"])
        ic.glyph(kind, 6, 5, P["g"], (255, 255, 255))
    elif shape == "leaf":
        green, green_d = ((90, 170, 60), (50, 120, 40)) if v == 0 else (P["m"], P["d"])
        for y in range(1, 15):
            for x in range(16):
                d = abs((x - 8) * 1.5) + abs(y - 7.5) * 0.9
                if d < 7.5 - abs(y - 7.5) * 0.3:
                    ic.set(x, y, green if x < 8 else green_d)
        for y in range(2, 14):
            ic.set(8, y, (170, 220, 110))
        ic.set(8, 15, (110, 80, 40)), ic.set(8, 14, (110, 80, 40))
        ic.glyph(kind, 6, 5, (250, 240, 190))
    elif shape == "datapad":
        ic.rect(2, 3, 13, 12, P["d"])
        ic.rect(3, 4, 12, 11, P["o"])
        for y in (5, 7, 9):
            ic.rect(3, y, 12, y, shade(P["o"], 1.6) if sum(P["o"]) < 60 else shade(P["o"], 0.8))
        ic.glyph(kind, 5, 5, P["g"], (255, 255, 255))
        ic.set(12, 12, P["g"]), ic.set(3, 12, P["t"])
    elif shape == "map":
        ic.rect(2, 3, 13, 12, parch)
        for x in (6, 9):
            ic.rect(x, 3, x, 12, parch_d)
        for i, (x, y) in enumerate(((3, 11), (4, 10), (5, 10), (7, 9), (8, 8), (10, 7))):
            ic.set(x, y, P["o"] if i % 2 else None)
        ic.glyph(kind, 6, 4, P["d"])
        ic.set(11, 5, (200, 40, 40)), ic.set(12, 6, (200, 40, 40)), ic.set(11, 6, (200, 40, 40)), ic.set(12, 5, (200, 40, 40))
        if v == 1:                                           # compass rose
            for x, y in ((3, 4), (3, 6), (2, 5), (4, 5)):
                ic.set(x, y, P["t"])
            ic.set(3, 5, P["g"])
        elif v == 2:                                         # wanted-poster frame, torn corner
            ic.rect(2, 3, 13, 3, P["t"]), ic.rect(2, 12, 13, 12, P["t"])
            ic.px.pop((13, 3), None), ic.px.pop((13, 4), None), ic.px.pop((12, 3), None)
        elif v == 3:                                         # wanted poster: nailed frame, red header
            ic.rect(2, 3, 13, 3, P["d"]), ic.rect(2, 12, 13, 12, P["d"])
            ic.rect(2, 3, 2, 12, P["d"]), ic.rect(13, 3, 13, 12, P["d"])
            ic.rect(4, 4, 11, 4, (170, 40, 40))
            ic.set(2, 3, P["t"]), ic.set(13, 3, P["t"]), ic.set(2, 12, P["t"]), ic.set(13, 12, P["t"])
    elif shape == "letter":
        ic.rect(2, 4, 13, 12, parch)
        for i in range(6):
            ic.set(2 + i, 4 + i, parch_d), ic.set(13 - i, 4 + i, parch_d)
        for y in range(7, 13):
            for x in range(5, 11):
                if math.hypot(x - 7.5, y - 9.5) <= 2.8:
                    ic.set(x, y, seal)
        ic.glyph(kind, 5, 7, mix(seal, (255, 255, 255), 0.7) if sum(seal) < 450 else shade(seal, 0.45))
        if v == 1:                                           # ribbon
            ic.rect(2, 11, 13, 11, P["t"])
        elif v == 2:                                         # postage stamp
            ic.rect(11, 4, 13, 6, P["t"]), ic.set(12, 5, P["g"])
        elif v == 3:                                         # hearts
            for x, y in ((3, 5), (4, 5), (12, 5), (11, 5)):
                ic.set(x, y, P["t"])
    elif shape == "banner":
        ic.rect(2, 1, 13, 1, P["t"])
        ic.set(1, 1, P["t2"]), ic.set(14, 1, P["t2"])
        ic.rect(4, 2, 11, 12, P["m"])
        ic.rect(4, 2, 4, 12, P["b"]), ic.rect(11, 2, 11, 12, P["b"])
        ic.rect(4, 13, 6, 13, P["m"]), ic.rect(9, 13, 11, 13, P["m"])
        ic.set(4, 14, P["t"]), ic.set(11, 14, P["t"])
        ic.glyph(kind, 5, 5, P["t"], P["g"])
    elif shape == "rune_stone":
        stone = mix((110, 110, 116), P["d"], 0.4)
        for y in range(16):
            for x in range(16):
                r = math.hypot(x - 7.5, (y - 7.5) * 1.1)
                if r <= 6.4:
                    ic.set(x, y, shade(stone, 1.2) if x + y < 13 else stone)
        ic.glyph(kind, 5, 5, P["g"], (255, 255, 255))
    elif shape == "quill":
        ic.rect(2, 5, 10, 13, parch)
        ic.rect(2, 13, 10, 13, parch_d)
        ic.glyph(kind, 3, 7, P["d"])
        feather = (P["a"], P["t"], P["g"])[v % 3]
        feather_d = shade(feather, 0.75)
        if v == 1:                                           # ink bottle
            ic.rect(11, 11, 13, 13, P["o"]), ic.set(12, 10, P["d"])
        elif v == 2:                                         # ribbon bookmark
            ic.rect(8, 5, 8, 14, P["t"]), ic.set(8, 15, P["t2"])
        for i in range(9):
            x, y = 13 - i, 1 + i
            ic.set(x, y, feather)
            ic.set(x + 1, y, feather_d if i < 7 else None)
            ic.set(x, y - 1, feather if 1 < i < 7 else None)
        ic.set(4, 10, P["o"]), ic.set(5, 9, P["o"])
    return ic.image(shade(P["o"], 0.8) if sum(P["o"]) > 30 else P["o"])


def sheet(sets, scale=6):
    """All scroll forms for previews: armor/tools/weapons per set."""
    cols = 6
    rows = math.ceil(len(sets) / cols)
    from PIL import ImageDraw
    out = Image.new("RGBA", (cols * (3 * 16 + 4) * scale, rows * 21 * scale), (40, 40, 46, 255))
    d = ImageDraw.Draw(out)
    for i, S in enumerate(sets):
        x0, y0 = (i % cols) * (3 * 16 + 4) * scale, (i // cols) * 21 * scale
        d.text((x0 + 4, y0 + 17 * scale + 4), S.get("name", S["id"].replace("_", " ").title()), fill=(230, 230, 230))
        for j, kind in enumerate(("armor", "tools", "weapons")):
            out.alpha_composite(icon(S, kind).resize((16 * scale, 16 * scale), Image.NEAREST),
                                (x0 + j * 16 * scale, y0 + scale))
    return out
