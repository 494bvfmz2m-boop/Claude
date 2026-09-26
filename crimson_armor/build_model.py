"""Builds models/crimson_<item>.json as explicit cuboids (one per horizontal
run of opaque pixels) instead of relying on item/generated extrusion, which
some viewers render incorrectly for 32x32 textures. Run: python3 build_model.py
"""
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def r(v):
    return round(v, 4)


def elements_for(tex):
    n = tex.size[0]
    u = 16 / n  # model units per texel
    elements = []
    for y in range(n):
        x = 0
        while x < n:
            if tex.getpixel((x, y))[3] == 0:
                x += 1
                continue
            x0 = x
            while x < n and tex.getpixel((x, y))[3] > 0:
                x += 1
            x1 = x  # exclusive
            strip = [r(x0 * u), r(y * u), r(x1 * u), r((y + 1) * u)]
            elements.append({
                "from": [r(x0 * u), r(16 - (y + 1) * u), 7.5],
                "to": [r(x1 * u), r(16 - y * u), 8.5],
                "faces": {
                    "south": {"uv": strip, "texture": "#layer0"},
                    "north": {"uv": [strip[2], strip[1], strip[0], strip[3]], "texture": "#layer0"},
                    "up": {"uv": strip, "texture": "#layer0"},
                    "down": {"uv": strip, "texture": "#layer0"},
                    "west": {"uv": [r(x0 * u), strip[1], r((x0 + 1) * u), strip[3]], "texture": "#layer0"},
                    "east": {"uv": [r((x1 - 1) * u), strip[1], r(x1 * u), strip[3]], "texture": "#layer0"},
                },
            })
    return elements


COMMON = {
    "ground": {"translation": [0, 2, 0], "scale": [0.5, 0.5, 0.5]},
    "head": {"rotation": [0, 180, 0], "translation": [0, 13, 7], "scale": [1, 1, 1]},
    "fixed": {"rotation": [0, 180, 0], "scale": [1, 1, 1]},
}


def handheld(scale=1.0, lift=0.0):
    """Vanilla item/handheld transforms, optionally enlarged in hand."""
    t, f = 0.85 * scale, 0.68 * scale
    return {
        "thirdperson_righthand": {"rotation": [0, -90, 55], "translation": [0, 4 + lift, 0.5 + lift / 2], "scale": [t, t, 0.85]},
        "thirdperson_lefthand": {"rotation": [0, 90, -55], "translation": [0, 4 + lift, 0.5 + lift / 2], "scale": [t, t, 0.85]},
        "firstperson_righthand": {"rotation": [0, -90, 25], "translation": [1.13, 3.2 + lift / 2, 1.13], "scale": [f, f, 0.68]},
        "firstperson_lefthand": {"rotation": [0, 90, -25], "translation": [1.13, 3.2 + lift / 2, 1.13], "scale": [f, f, 0.68]},
        **COMMON,
    }


BOW_DISPLAY = {
    "thirdperson_righthand": {"rotation": [-80, 260, -40], "translation": [-1, -2, 2.5], "scale": [0.9, 0.9, 0.9]},
    "thirdperson_lefthand": {"rotation": [-80, -280, 40], "translation": [-1, -2, 2.5], "scale": [0.9, 0.9, 0.9]},
    "firstperson_righthand": {"rotation": [0, -90, 25], "translation": [1.13, 3.2, 1.13], "scale": [0.68, 0.68, 0.68]},
    "firstperson_lefthand": {"rotation": [0, 90, -25], "translation": [1.13, 3.2, 1.13], "scale": [0.68, 0.68, 0.68]},
    **COMMON,
}

SWORD_DISPLAY = {
    "thirdperson_righthand": {"rotation": [0, -90, 55], "translation": [0, 6.5, 1.5], "scale": [1.2, 1.2, 0.85]},
    "thirdperson_lefthand": {"rotation": [0, 90, -55], "translation": [0, 6.5, 1.5], "scale": [1.2, 1.2, 0.85]},
    "firstperson_righthand": {"rotation": [0, -90, 25], "translation": [1.13, 4.5, 1.13], "scale": [0.95, 0.95, 0.68]},
    "firstperson_lefthand": {"rotation": [0, 90, -25], "translation": [1.13, 4.5, 1.13], "scale": [0.95, 0.95, 0.68]},
    **COMMON,
    "gui": {"rotation": [0, 0, 0], "translation": [0, 0, 0], "scale": [1, 1, 1]},
}

BOW_OVERRIDES = [
    {"predicate": {"pulling": 1}, "model": "minecraft:item/crimson_bow_pulling_0"},
    {"predicate": {"pulling": 1, "pull": 0.65}, "model": "minecraft:item/crimson_bow_pulling_1"},
    {"predicate": {"pulling": 1, "pull": 0.9}, "model": "minecraft:item/crimson_bow_pulling_2"},
]

ITEMS = {
    "sword": SWORD_DISPLAY,
    "pickaxe": handheld(),
    "axe": handheld(),
    "shovel": handheld(),
    "hoe": handheld(),
    "spear": handheld(scale=1.35, lift=3),
    "bow": BOW_DISPLAY,
    "bow_pulling_0": BOW_DISPLAY,
    "bow_pulling_1": BOW_DISPLAY,
    "bow_pulling_2": BOW_DISPLAY,
}


def build(name, display):
    tex = Image.open(f"{HERE}/items/crimson_{name}.png").convert("RGBA")
    ref = f"minecraft:item/crimson_{name}"
    model = {
        "texture_size": list(tex.size),
        "textures": {"layer0": ref, "particle": ref},
        "gui_light": "front",
        "elements": elements_for(tex),
        "display": display,
    }
    if name == "bow":
        model["overrides"] = BOW_OVERRIDES  # pulling states, pre-1.21.4
    with open(f"{HERE}/models/crimson_{name}.json", "w") as f:
        json.dump(model, f, indent=1)
    return len(model["elements"])


def main():
    os.makedirs(f"{HERE}/models", exist_ok=True)
    for name, display in ITEMS.items():
        print(f"crimson_{name}: {build(name, display)} elements")


if __name__ == "__main__":
    main()
