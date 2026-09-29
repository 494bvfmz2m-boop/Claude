"""16x16 art for a custom ore set: the ore block (deepslate with crystal veins), the raw
chunk that drops from it, and the ingot smelted from that."""
from PIL import Image

from armor_engine import h

DEEPSLATE = [(30, 30, 36), (42, 42, 48), (54, 54, 60), (68, 68, 74)]
INGOT = ["................", "................", "................", "................",
         "......oooooo....", ".....olllllmo...", "....ollmmmmmbo..", "...olmmmmmmmbdo.",
         "..olmmmmmmmbddo.", ".obbbbbbbbbddo..", ".oddddddddddo...", "..oooooooooo....",
         "................", "................", "................", "................"]
RAW = ["................", "................", "................", "......oooo......",
       "....oommmboo....", "...ombgmmbbdo...", "...obmmlmmbdo...", "..ombmmgmbbddo..",
       "..obbmmmmbbddo..", "..oddbmmbbdddo..", "...oddbbbdddo...", "....ooddddoo....",
       ".....oooooo.....", "................", "................", "................"]
# crystal clusters on the ore face: (x, y) centres
CLUSTERS = ((4, 4), (11, 5), (6, 11), (12, 12), (2, 9))


def ore(S):
    P = S["pal"]
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            k = 1 + (1 if h(x // 3, y // 2, 60) > 0.55 else 0) - (1 if y % 4 == 3 else 0)   # layered deepslate
            if h(x, y, 61) > 0.9:
                k = min(3, k + 1)
            img.putpixel((x, y), DEEPSLATE[max(0, k)] + (255,))
    for cx, cy in CLUSTERS:
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                d = abs(dx) + abs(dy)
                x, y = cx + dx, cy + dy
                if not (0 <= x < 16 and 0 <= y < 16) or d > 2:
                    continue
                if d == 2:
                    if h(x, y, 62) > 0.5:
                        img.putpixel((x, y), P["o"] + (255,))
                    continue
                c = P["g"] if d == 0 else (P["l"] if dx <= 0 and dy <= 0 else P["m"])
                img.putpixel((x, y), c + (255,))
        img.putpixel((cx - 1, cy - 1), P["a"] + (255,))              # a white spark on each crystal
    return img


def _draw(S, art):
    P = S["pal"]
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(art):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), P[ch] + (255,))
    return img


def raw(S):
    return _draw(S, RAW)


def ingot(S):
    img = _draw(S, INGOT)
    img.putpixel((7, 5), S["pal"]["a"] + (255,))
    img.putpixel((8, 5), S["pal"]["a"] + (255,))
    return img
