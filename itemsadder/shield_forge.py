"""Custom shields for every set: a 3D plate + handle laid out exactly like the
vanilla shield (so the vanilla held and blocking poses fit), with a painted
face per set: its colours, surface pattern, trim, emblem, a glowing boss, and
one of several outlines cut from the plate (heater, kite, round, tower,
spiked, pointed, crescent, crenellated).

ItemsAdder uses <model>.json when held and <model>_blocking.json while blocking.
"""
import math

from PIL import Image

import armor_engine as AE

W, H = 24, 44          # face art: 2 px per unit on the 12x22 plate
SHAPES = ("heater", "kite", "round", "tower", "spiked", "pointed", "crescent", "crenel")


def inside(shape, x, y):
    """Is pixel (x, y) of the 24x44 face part of the shield?"""
    cx = (W - 1) / 2
    dx = abs(x - cx)
    if shape == "heater":
        return y < 26 or dx <= (W / 2) * math.sqrt(max(0, 1 - ((y - 26) / 18) ** 2))
    if shape == "kite":
        return (y < 6 and dx <= W / 2 - (6 - y) * 0.6) or (6 <= y < 18) or dx <= (W / 2) * (43 - y) / 25
    if shape == "round":
        return ((x - cx) / (W / 2)) ** 2 + ((y - 21.5) / 22) ** 2 <= 1
    if shape == "tower":
        return not (y < 2 and dx > W / 2 - 3) and not (y > 41 and dx > W / 2 - 3)
    if shape == "spiked":
        if y < 4:
            return (x // 4) % 2 == 0 or y >= 2
        return y < 30 or dx <= (W / 2) * (43 - y) / 13
    if shape == "pointed":
        return dx <= (W / 2) * min(1, (43 - y) / 30 + 0.05) and not (y < 3 and dx > W / 2 - 4 + y)
    if shape == "crescent":
        if y < 10 and math.hypot(x - cx, y + 2) < 9:
            return False
        return y < 28 or dx <= (W / 2) * math.sqrt(max(0, 1 - ((y - 28) / 16) ** 2))
    if shape == "crenel":
        if y < 4:
            return (x // 6) % 2 == 0
        return y < 36 or dx <= W / 2 - (y - 36)
    return True


def emblem_px(emblem, x, y, ox, oy):
    """The set's 8-wide emblem scaled 2x, centred at (ox, oy)."""
    if not emblem:
        return None
    u, v = (x - ox) // 2, (y - oy) // 2
    if 0 <= v < len(emblem) and 0 <= u < len(emblem[v]):
        ch = emblem[v][u]
        return None if ch == "." else ch
    return None


def face(S, shape, frame_px=None):
    """The 24x44 painted face. frame_px(x, y) can override the field (for animated shields)."""
    P = S["pal"]
    pat = AE.PATTERNS[S.get("pattern", "plate")]
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    em = S.get("emblem") or []
    ew = max((len(r) for r in em), default=0) * 2
    ox, oy = (W - ew) // 2, 10
    for y in range(H):
        for x in range(W):
            if not inside(shape, x, y):
                continue
            edge = any(not inside(shape, x + dx, y + dy) or not (0 <= x + dx < W and 0 <= y + dy < H)
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2)))
            outer = any(not inside(shape, x + dx, y + dy) or not (0 <= x + dx < W and 0 <= y + dy < H)
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if outer:
                c = P["o"]
            elif edge:
                c = P["t"] if (x + y) % 6 else P["t2"]                     # trim band with rivets
            else:
                c = frame_px(x, y) if frame_px else pat(P, x // 2, y // 2, 12, 22, x // 2, y // 2)
                ch = emblem_px(em, x, y, ox, oy)
                if ch:
                    c = P[ch]
                r = math.hypot(x - (W - 1) / 2, y - 30)
                if r < 2.2:
                    c = P["g"]                                             # glowing boss
                elif r < 3.4:
                    c = P["t"]
                if y in (19, 20) and not ch and r >= 3.4 and abs(x - (W - 1) / 2) < W / 2 - 3:
                    c = P["t2"]                                            # a banded bar across the middle
            img.putpixel((x, y), c + (255,))
    return img


def texture(S, shape, frame_px=None):
    """64x64 sheet: face (0,0), back (24,0), rim (48,0), handle (52,0)."""
    P = S["pal"]
    tex = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    f = face(S, shape, frame_px)
    tex.paste(f, (0, 0))
    for y in range(H):                                                     # back: same outline, plain
        for x in range(W):
            if f.getpixel((x, y))[3]:
                tex.putpixel((24 + x, y), (P["d"] if (x // 2 + y // 3) % 5 else P["o"]) + (255,))
    for y in range(H):
        for x in range(4):
            tex.putpixel((48 + x, y), P["t2"] + (255,))
    for y in range(12):
        for x in range(8):
            tex.putpixel((52 + x, y), (P["o"] if y % 3 == 0 else P["d"]) + (255,))
    return tex


# vanilla shield geometry in item-model units (the builtin shield renderer, flipped into model space)
PLATE = ([-6, -11, 1], [6, 11, 2])
HANDLE = ([-1, -3, -5], [1, 3, 1])

HELD = {
    "thirdperson_righthand": {"rotation": [0, 90, 0], "translation": [10, 6, -4], "scale": [1, 1, 1]},
    "thirdperson_lefthand": {"rotation": [0, 90, 0], "translation": [10, 6, 12], "scale": [1, 1, 1]},
    "firstperson_righthand": {"rotation": [0, 180, 5], "translation": [-10, 2, -10], "scale": [1.25, 1.25, 1.25]},
    "firstperson_lefthand": {"rotation": [0, 180, 5], "translation": [10, 0, -10], "scale": [1.25, 1.25, 1.25]},
    "gui": {"rotation": [15, -25, -5], "translation": [2, 3, 0], "scale": [0.65, 0.65, 0.65]},
    "fixed": {"rotation": [0, 180, 0], "translation": [-2, 4, -5], "scale": [0.5, 0.5, 0.5]},
    "ground": {"translation": [4, 4, 2], "scale": [0.25, 0.25, 0.25]},
}
BLOCKING = dict(HELD, **{
    "thirdperson_righthand": {"rotation": [45, 135, 0], "translation": [3.51, 11, -2], "scale": [1, 1, 1]},
    "thirdperson_lefthand": {"rotation": [45, 135, 0], "translation": [13.51, 3, 5], "scale": [1, 1, 1]},
    "firstperson_righthand": {"rotation": [0, 180, -5], "translation": [-15, 5, -11], "scale": [1.25, 1.25, 1.25]},
    "firstperson_lefthand": {"rotation": [0, 180, -5], "translation": [5, 5, -11], "scale": [1.25, 1.25, 1.25]},
})


def uv(x, y, w, h):
    return [x / 4, y / 4, (x + w) / 4, (y + h) / 4]


def models(ref, glow=False):
    """(held model, blocking model) for a shield texture ref."""
    plate = {"name": "plate", "from": PLATE[0], "to": PLATE[1], "faces": {
        "south": {"uv": uv(0, 0, W, H), "texture": "#shield"},        # painted face, away from the holder
        "north": {"uv": uv(24, 0, W, H), "texture": "#shield"},       # back, facing the holder (handle side)
        "east": {"uv": uv(48, 0, 2, H), "texture": "#shield"}, "west": {"uv": uv(50, 0, 2, H), "texture": "#shield"},
        "up": {"uv": uv(48, 0, 4, 2), "texture": "#shield"}, "down": {"uv": uv(48, 42, 4, 2), "texture": "#shield"}}}
    handle = {"name": "handle", "from": HANDLE[0], "to": HANDLE[1],
              "faces": {f: {"uv": uv(52, 0, 8, 12), "texture": "#shield"}
                        for f in ("north", "south", "east", "west", "up", "down")}}
    if glow:
        plate["light_emission"] = 8
    base = {"texture_size": [64, 64], "textures": {"shield": ref, "particle": ref}, "gui_light": "front",
            "elements": [plate, handle]}
    return dict(base, display=HELD), dict(base, display=BLOCKING)


def shape_for(index):
    return SHAPES[index % len(SHAPES)]
