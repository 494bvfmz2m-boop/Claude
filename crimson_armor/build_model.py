"""Builds models/crimson_sword.json as explicit cuboids (one per horizontal
run of opaque pixels) instead of relying on item/generated extrusion."""
import json
from PIL import Image

HERE = __file__.rsplit("/", 1)[0]
tex = Image.open(f"{HERE}/items/crimson_sword.png").convert("RGBA")
N = tex.size[0]
u = 16 / N  # model units per texel


def r(v):
    return round(v, 4)


elements = []
for y in range(N):
    x = 0
    while x < N:
        if tex.getpixel((x, y))[3] == 0:
            x += 1
            continue
        x0 = x
        while x < N and tex.getpixel((x, y))[3] > 0:
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
        
model = {
    "texture_size": [N, N],
    "textures": {"layer0": "minecraft:item/crimson_sword", "particle": "minecraft:item/crimson_sword"},
    "gui_light": "front",
    "elements": elements,
    "display": {
        "thirdperson_righthand": {"rotation": [0, -90, 55], "translation": [0, 6.5, 1.5], "scale": [1.2, 1.2, 0.85]},
        "thirdperson_lefthand": {"rotation": [0, 90, -55], "translation": [0, 6.5, 1.5], "scale": [1.2, 1.2, 0.85]},
        "firstperson_righthand": {"rotation": [0, -90, 25], "translation": [1.13, 4.5, 1.13], "scale": [0.95, 0.95, 0.68]},
        "firstperson_lefthand": {"rotation": [0, 90, -25], "translation": [1.13, 4.5, 1.13], "scale": [0.95, 0.95, 0.68]},
        "ground": {"translation": [0, 2, 0], "scale": [0.5, 0.5, 0.5]},
        "gui": {"rotation": [0, 0, 0], "translation": [0, 0, 0], "scale": [1, 1, 1]},
        "fixed": {"rotation": [0, 180, 0], "scale": [1, 1, 1]},
    },
}
with open(f"{HERE}/models/crimson_sword.json", "w") as f:
    json.dump(model, f, indent=1)
print(len(elements), "elements")
