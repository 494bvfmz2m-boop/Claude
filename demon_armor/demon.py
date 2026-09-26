"""Demon Armor: flat armor layers, GUI icons, and 3D parts (horns, spikes,
claws) exported as a Blockbench model plus a native Java 3D helmet model.

Player space (Blockbench entity coords): y up, feet at y=0, the player faces
-z (north), the player's right side is +x. Run: python3 demon.py
"""
import base64
import io
import json
import os
import random
import uuid

from PIL import Image

OUT = os.path.dirname(os.path.abspath(__file__))

# --- palette -------------------------------------------------------------
INK = (12, 8, 12)
OBS0 = (26, 18, 26)       # obsidian plate shades
OBS1 = (42, 30, 40)
OBS2 = (62, 44, 56)
OBS3 = (90, 64, 76)
OBS4 = (124, 90, 100)
LAVA0 = (150, 34, 12)
LAVA1 = (232, 84, 20)
LAVA2 = (255, 158, 40)
LAVA3 = (255, 228, 120)
BONE0 = (120, 100, 84)
BONE1 = (176, 156, 132)
BONE2 = (226, 212, 186)
BONE3 = (248, 240, 222)
HORN0 = (34, 22, 26)
HORN1 = (58, 38, 42)
HORN2 = (88, 58, 58)
OUTLINE = (54, 20, 22)    # icon outline (lighter than INK so it reads in 3D)

rng = random.Random(666)


# --- small canvas helper -------------------------------------------------
class Tex:
    def __init__(self, w, h):
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def put(self, x, y, c):
        self.px[x, y] = c + (255,)

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.put(i, j, c)

    def plate(self, x0, y0, w, h, light=0, cracks=0.0):
        """Obsidian plate: mild two-tone texture, bevel, optional lava cracks."""
        shades = [OBS0, OBS1, OBS2, OBS3, OBS4]
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                i = 1 + light + (1 if (x * 7 + y * 3) % 11 == 0 else 0)
                self.put(x, y, shades[min(4, i)])
        for x in range(x0, x0 + w):
            self.put(x, y0, shades[min(4, 3 + light)])
            self.put(x, y0 + h - 1, OBS0)
        for y in range(y0 + 1, y0 + h - 1):
            self.put(x0, y, shades[min(4, 2 + light)])
            self.put(x0 + w - 1, y, OBS0)
        for _ in range(int(w * h * cracks / 4)):
            x, y = rng.randrange(x0 + 1, x0 + w - 1), rng.randrange(y0 + 1, y0 + h - 1)
            for k in range(4):
                self.put(x, y, LAVA2 if k == 1 else LAVA1)
                x = min(x0 + w - 2, max(x0 + 1, x + rng.choice((-1, 1))))
                y = min(y0 + h - 2, y + 1)

    def seam(self, x0, y, w):
        for x in range(x0, x0 + w):
            self.put(x, y, LAVA2 if (x - x0) % 3 == 1 else LAVA1)

    def dark(self, x0, y0, w, h):
        self.rect(x0, y0, w, h, INK)


# --- flat armor layers (64x32 vanilla layout) ------------------------------
def box_faces(u, v, w, h, d):
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
            "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
            "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h)}


HEAD = box_faces(0, 0, 8, 8, 8)
BODY = box_faces(16, 16, 8, 12, 4)
ARM = box_faces(40, 16, 4, 12, 4)
LEG = box_faces(0, 16, 4, 12, 4)


def layer_1():
    t = Tex(64, 32)
    # helmet
    x, y, w, h = HEAD["top"]
    t.plate(x, y, w, h, light=1)
    for i in range(0, 8, 2):
        t.put(x + 3, y + i, OBS4); t.put(x + 4, y + i, OBS3)          # crest ridge
    t.dark(*HEAD["bottom"])
    for side in ("right", "left"):
        x, y, w, h = HEAD[side]
        t.plate(x, y, w, h)
        front = x + w - 1 if side == "right" else x
        step = -1 if side == "right" else 1
        for k, (dx, dy) in enumerate(((0, 2), (1, 2), (1, 1), (2, 1), (2, 0), (3, 0))):
            t.put(front + step * (1 + dx), y + dy + 1, BONE1 if k < 4 else BONE2)  # horn root
        t.seam(x, y + 7, w)
    x, y, w, h = HEAD["front"]
    t.plate(x, y, w, h, light=1)
    t.rect(x, y + 2, 8, 1, OBS0)                                      # heavy brow
    t.put(x + 1, y + 3, LAVA3); t.put(x + 2, y + 3, LAVA2); t.put(x + 3, y + 3, INK)
    t.put(x + 6, y + 3, LAVA3); t.put(x + 5, y + 3, LAVA2); t.put(x + 4, y + 3, INK)
    t.put(x + 2, y + 4, LAVA1); t.put(x + 5, y + 4, LAVA1)            # slanted glowing eyes
    t.put(x + 3, y + 4, OBS0); t.put(x + 4, y + 4, OBS0)
    for i in range(1, 7):
        t.put(x + i, y + 6, INK)                                       # mouth
    for i in (1, 3, 4, 6):
        t.put(x + i, y + 6, BONE2)                                     # fangs
    t.put(x + 1, y + 7, BONE1); t.put(x + 6, y + 7, BONE1)
    t.put(x + 2, y + 6, LAVA1); t.put(x + 5, y + 6, LAVA1)
    x, y, w, h = HEAD["back"]
    t.plate(x, y, w, h, cracks=0.06)
    t.seam(x, y + 7, w)

    # chestplate: body
    t.plate(*BODY["top"], light=1)
    t.dark(BODY["top"][0] + 2, BODY["top"][1] + 1, 4, 2)
    t.dark(*BODY["bottom"])
    x, y, w, h = BODY["front"]
    t.plate(x, y, w, h, light=1)
    for ry in (y + 3, y + 5, y + 7):                                   # ribcage
        for i in (1, 2, 5, 6):
            t.put(x + i, ry, BONE1)
        t.put(x + 1, ry + 1, OBS0); t.put(x + 6, ry + 1, OBS0)
    for ry in range(y + 2, y + 9):
        t.put(x + 3, ry, BONE0); t.put(x + 4, ry, BONE0)              # sternum
    t.put(x + 3, y + 4, LAVA2); t.put(x + 4, y + 4, LAVA3)            # molten core
    t.put(x + 3, y + 5, LAVA1); t.put(x + 4, y + 5, LAVA2)
    t.seam(x, y + 10, w)
    t.rect(x, y + 11, w, 1, OBS0)
    for side in ("right", "left"):
        t.plate(*BODY[side])
        t.seam(BODY[side][0], BODY[side][1] + 10, 4)
    x, y, w, h = BODY["back"]
    t.plate(x, y, w, h, cracks=0.1)
    for ry in range(y + 1, y + 11, 2):                                 # spine
        t.put(x + 3, ry, BONE1); t.put(x + 4, ry, BONE2)
        t.put(x + 3, ry + 1, OBS0); t.put(x + 4, ry + 1, OBS0)
    t.seam(x, y + 10, w)
    # arms
    t.plate(*ARM["top"], light=2)
    t.dark(*ARM["bottom"])
    for side in ("right", "front", "left", "back"):
        x, y, w, h = ARM[side]
        t.plate(x, y, w, 4, light=2)                                   # pauldron
        t.seam(x, y + 4, w)
        for j in range(y + 5, y + 8):
            for i in range(x, x + w):
                t.put(i, j, OBS1 if (i + j) % 2 else OBS0)             # mail
        t.plate(x, y + 8, w, 4, light=1)                               # bracer
        t.put(x + 1, y + 9, BONE2 if side == "right" else OBS3)        # spike studs
        t.put(x + 2, y + 10, LAVA1 if side == "right" else OBS2)
    # boots
    t.dark(*LEG["bottom"])
    for side in ("right", "front", "left", "back"):
        x, y, w, h = LEG[side]
        t.seam(x, y + 6, w)
        t.plate(x, y + 7, w, 4, light=1)
        t.rect(x, y + 11, w, 1, OBS0)
    fx, fy = LEG["front"][:2]
    for i in (0, 1, 3):
        t.put(fx + i, fy + 11, BONE2)                                  # claw tips
    return t.img


def layer_2():
    t = Tex(64, 32)
    for side in ("right", "front", "left", "back"):
        x, y, w, h = BODY[side]
        t.dark(x, y + 7, w, 1)
        t.seam(x, y + 8, w)
        t.plate(x, y + 9, w, 3, light=1)
    fx, fy = BODY["front"][:2]
    t.put(fx + 3, fy + 8, LAVA3); t.put(fx + 4, fy + 8, LAVA3)        # belt buckle
    t.plate(*LEG["top"])
    t.dark(*LEG["bottom"])
    for side in ("right", "front", "left", "back"):
        x, y, w, h = LEG[side]
        t.plate(x, y, w, 5, light=0 if side == "left" else 1)
        t.seam(x, y + 5, w)
        t.plate(x, y + 6, w, 6, light=0 if side == "left" else 1, cracks=0.1)
    fx, fy = LEG["front"][:2]
    t.put(fx + 1, fy + 6, BONE2); t.put(fx + 2, fy + 6, BONE2)        # knee cap
    t.put(fx + 1, fy + 7, BONE1); t.put(fx + 2, fy + 7, LAVA2)
    return t.img


# --- 3D parts atlas (64x64) ----------------------------------------------
SW = {name: (i * 8, 16) for i, name in enumerate(
    ("horn0", "horn1", "horn2", "spike", "plate", "core", "bone", "claw"))}


def atlas(l1):
    t = Tex(64, 64)
    t.img.paste(l1.crop((0, 0, 32, 16)), (0, 0))   # helmet shell = flat helmet art

    def swatch(name, fn):
        sx, sy = SW[name]
        for j in range(8):
            for i in range(8):
                t.put(sx + i, sy + j, fn(i, j))

    swatch("horn0", lambda i, j: HORN0 if j % 3 == 0 else (HORN1 if i > 1 else HORN0))
    swatch("horn1", lambda i, j: HORN1 if j % 3 == 0 else (HORN2 if i > 1 else HORN1))
    swatch("horn2", lambda i, j: LAVA1 if j < 2 else (LAVA2 if j < 5 else LAVA3) if j % 3 else LAVA0)
    swatch("spike", lambda i, j: LAVA1 if (i + j) == 7 else (OBS3 if i < 3 else OBS2 if j > 2 else OBS1))
    swatch("plate", lambda i, j: (OBS4 if j == 0 else LAVA1 if j == 7 else
                                  LAVA2 if (j == 6 and i % 3 == 1) else
                                  BONE2 if (i, j) in ((1, 2), (6, 2)) else OBS2 if i < 4 else OBS1))
    swatch("core", lambda i, j: (lambda d: LAVA3 if d < 1.5 else LAVA2 if d < 2.6 else
                                 LAVA1 if d < 3.4 else LAVA0)(((i - 3.5) ** 2 + (j - 3.5) ** 2) ** 0.5))
    swatch("bone", lambda i, j: BONE3 if i < 2 else (BONE2 if j < 6 else BONE1))
    swatch("claw", lambda i, j: BONE3 if j < 2 else BONE2 if j < 4 else BONE1 if j < 6 else BONE0)
    return t.img


# --- 3D geometry -----------------------------------------------------------
def part(name, bone, frm, to, mat, faces=None):
    return {"name": name, "bone": bone, "from": list(frm), "to": list(to),
            "mat": mat, "faces": faces}


def mirror(p, bone):
    (x0, y0, z0), (x1, y1, z1) = p["from"], p["to"]
    return dict(p, name=p["name"].replace("right", "left"), bone=bone,
                **{"from": [-x1, y0, z0], "to": [-x0, y1, z1]})


def geometry():
    parts = []
    # helmet shell, textured with the flat helmet art (inflated 1px like vanilla)
    parts.append(part("helmet_shell", "head", (-5, 23, -5), (5, 33, 5), None,
                      faces={f: HEAD[k] for f, k in (("north", "front"), ("south", "back"),
                             ("east", "right"), ("west", "left"), ("up", "top"))}))
    horn = [  # right horn: out from the temple, sweeping up, tip hooking forward
        ((4.5, 28.5, -2), (8, 32, 1.5), "horn0"),
        ((7.5, 29.5, -1.5), (10.5, 33, 1.5), "horn0"),
        ((9.5, 31.5, -1), (12, 35, 1.5), "horn1"),
        ((10.5, 34.5, -1), (12.5, 37.5, 1), "horn1"),
        ((10, 37, -1.5), (12, 39.5, 0.5), "horn1"),
        ((9.2, 39, -2.2), (11, 41, -0.4), "horn2"),
        ((8.4, 40.5, -3), (10, 42, -1.4), "horn2"),
    ]
    for i, (f, t, m) in enumerate(horn):
        p = part(f"right_horn_{i}", "head", f, t, m)
        parts += [p, mirror(p, "head")]
    for p in (part("right_brow_horn_0", "head", (1.5, 32.6, -4.6), (3, 35, -3), "horn1"),
              part("right_brow_horn_1", "head", (1.8, 34.8, -4.4), (2.7, 36.4, -3.4), "horn2"),
              part("right_fang", "head", (2.4, 21.6, -5.4), (3.4, 23.2, -4.4), "bone")):
        parts += [p, mirror(p, "head")]
    parts.append(part("brow_ridge", "head", (-5.5, 29, -5.8), (5.5, 30, -5), "spike"))

    # chestplate
    parts.append(part("molten_core", "body", (-1.5, 19, -3.6), (1.5, 22, -3), "core"))
    for i, y in enumerate((20.5, 17, 13.5)):
        parts.append(part(f"spine_spike_{i}_base", "body", (-1, y, 3), (1, y + 2, 5), "spike"))
        parts.append(part(f"spine_spike_{i}_tip", "body", (-0.6, y + 1, 4.8), (0.6, y + 2.4, 6.6), "horn2"))
    for p in (part("right_pauldron", "right_arm", (3.5, 21.5, -3), (9.5, 25.5, 3), "plate"),
              part("right_pauldron_spike_0", "right_arm", (6.8, 25.5, -1.2), (9, 28.5, 1), "spike"),
              part("right_pauldron_spike_0_tip", "right_arm", (7.3, 28.3, -0.7), (8.5, 31, 0.5), "horn2"),
              part("right_pauldron_spike_1", "right_arm", (4.8, 25.5, 0.9), (6.6, 27.8, 2.6), "spike"),
              part("right_pauldron_spike_1_tip", "right_arm", (5.2, 27.6, 1.3), (6.2, 29.6, 2.3), "horn2"),
              part("right_pauldron_spike_2", "right_arm", (9.5, 23, -0.7), (12, 24.5, 0.7), "spike"),
              part("right_pauldron_spike_2_tip", "right_arm", (11.8, 23.3, -0.4), (13.5, 24.2, 0.4), "horn2"),
              part("right_bracer_blade", "right_arm", (8.9, 13.5, -0.5), (10.4, 17, 0.5), "spike")):
        parts += [p, mirror(p, "left_arm")]

    # leggings: knee guards with forward spikes
    for p in (part("right_knee_guard", "right_leg", (0.2, 5, -3.3), (3.8, 8, -2.5), "plate"),
              part("right_knee_spike", "right_leg", (1.3, 6, -4.8), (2.7, 7.5, -3.3), "spike"),
              part("right_knee_spike_tip", "right_leg", (1.6, 6.3, -5.9), (2.4, 7.2, -4.8), "horn2")):
        parts += [p, mirror(p, "left_leg")]

    # boots: toe claws, heel spur, ankle spike
    for p in (part("right_claw_0", "right_leg", (0.2, 0, -4.6), (1.2, 1.2, -3), "claw"),
              part("right_claw_1", "right_leg", (1.5, 0, -5.2), (2.5, 1.4, -3), "claw"),
              part("right_claw_2", "right_leg", (2.8, 0, -4.6), (3.8, 1.2, -3), "claw"),
              part("right_heel_spur", "right_leg", (1.5, 2, 3), (2.5, 3, 5), "spike"),
              part("right_ankle_spike", "right_leg", (5, 4, -0.6), (6.8, 5.2, 0.6), "spike")):
        parts += [p, mirror(p, "left_leg")]
    return parts


PIECE_OF_PART = lambda p: ("helmet" if p["bone"] == "head" else
                           "boots" if any(k in p["name"] for k in ("claw", "heel", "ankle")) else
                           "leggings" if "knee" in p["name"] else "chestplate")


def face_rects(p):
    """Atlas rect (x, y, w, h) per face."""
    if p["faces"]:
        return p["faces"]
    sx, sy = SW[p["mat"]]
    return {f: (sx, sy, 8, 8) for f in ("north", "south", "east", "west", "up", "down")}


# --- exports ---------------------------------------------------------------
BONES = {"head": [0, 24, 0], "body": [0, 24, 0], "right_arm": [5, 22, 0],
         "left_arm": [-5, 22, 0], "right_leg": [1.9, 12, 0], "left_leg": [-1.9, 12, 0]}


def export_bbmodel(parts, atlas_img, path):
    buf = io.BytesIO()
    atlas_img.save(buf, "PNG")
    elements, groups = [], {b: [] for b in BONES}
    for p in parts:
        uid = str(uuid.uuid5(uuid.NAMESPACE_URL, "demon/" + p["name"]))
        elements.append({
            "name": p["name"], "type": "cube", "uuid": uid, "box_uv": False,
            "rescale": False, "locked": False, "render_order": "default",
            "from": p["from"], "to": p["to"], "autouv": 0, "color": 0,
            "origin": BONES[p["bone"]],
            "faces": {f: {"uv": [x, y, x + w, y + h], "texture": 0}
                      for f, (x, y, w, h) in face_rects(p).items()},
        })
        groups[p["bone"]].append(uid)
    model = {
        "meta": {"format_version": "4.10", "model_format": "free", "box_uv": False},
        "name": "demon_armor", "model_identifier": "demon_armor",
        "resolution": {"width": 64, "height": 64},
        "elements": elements,
        "outliner": [{"name": b, "origin": o, "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, "demon-bone/" + b)),
                      "export": True, "isOpen": True, "children": groups[b]}
                     for b, o in BONES.items()],
        "textures": [{"name": "demon_armor_parts.png", "id": "0", "width": 64, "height": 64,
                      "uv_width": 64, "uv_height": 64, "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, "demon-tex")),
                      "source": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()}],
    }
    with open(path, "w") as f:
        json.dump(model, f, indent=1)


def to_item_space(v):
    # head centre (0, 28, 0) -> (8, 8, 8); the inflated 10px helmet fills 0..16
    return [round((c - o) * 1.6 + 8, 4) for c, o in zip(v, (0, 28, 0))]


def export_helmet_model(parts, path):
    elements = []
    for p in parts:
        if p["bone"] != "head":
            continue
        faces = {}
        for f, (x, y, w, h) in face_rects(p).items():
            uv = [x / 4, y / 4, (x + w) / 4, (y + h) / 4]
            faces[f] = {"uv": uv, "texture": "#parts"}
            if f == "up":
                faces[f]["rotation"] = 180  # entity top faces are flipped vs block models
        elements.append({"name": p["name"], "from": to_item_space(p["from"]),
                         "to": to_item_space(p["to"]), "faces": faces})
    ref = "minecraft:item/demon_armor_parts"
    model = {
        "texture_size": [64, 64],
        "textures": {"parts": ref, "particle": ref},
        "elements": elements,
        "display": {
            "head": {"rotation": [0, 0, 0], "translation": [0, 0, 0], "scale": [1, 1, 1]},
            "thirdperson_righthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.3, 0.3, 0.3]},
            "thirdperson_lefthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.3, 0.3, 0.3]},
            "firstperson_righthand": {"rotation": [0, 45, 0], "translation": [0, 0, 0], "scale": [0.35, 0.35, 0.35]},
            "firstperson_lefthand": {"rotation": [0, 45, 0], "translation": [0, 0, 0], "scale": [0.35, 0.35, 0.35]},
            "gui": {"rotation": [30, 225, 0], "translation": [0, -2, 0], "scale": [0.45, 0.45, 0.45]},
            "ground": {"translation": [0, 3, 0], "scale": [0.3, 0.3, 0.3]},
            "fixed": {"rotation": [0, 180, 0], "scale": [0.5, 0.5, 0.5]},
        },
    }
    with open(path, "w") as f:
        json.dump(model, f, indent=1)


# --- GUI icons (16x16, on the Lode Studio template silhouettes) ------------
KEY = {"o": OUTLINE, "x": OBS1, "b": OBS1, "m": OBS2, "h": OBS3, "s": OBS4,
       "W": BONE3, "l": LAVA1, "L": LAVA2, "y": LAVA3, "n": BONE1, "N": BONE2,
       "r": HORN1, "R": HORN2}

ICONS = {
    "helmet": [
        ".R............R.",
        ".rR..........Rr.",
        "..rr........rr..",
        "..orroxxxxorro..",
        "....ossshhmo....",
        "...osWmshhmmo...",
        "...oshhhhmmmo...",
        "...xsooooobmo...",
        "...xhyLoLyobo...",
        "...omooooobmo...",
        "...obNoNNoNbo...",
        "....oo....oo....",
        "................",
        "................",
        "................",
        "................",
    ],
    "chestplate": [
        "..N..........N..",
        "..nN........Nn..",
        "..xxxx....xxxx..",
        ".xWssx....xWssx.",
        ".xshhhx..xWssbx.",
        ".xbhhnNxxNnhbbx.",
        ".xbbhnhhhhnhbbx.",
        "..obWhnLynhhbo..",
        "...oshnlLnhbo...",
        "...oolLlLllo....",
        "...obmmhhmmbo...",
        "...obmNhhNmbo...",
        "...obmhhhhmbo...",
        "....obbhhbbo....",
        ".....oooooo.....",
        "................",
    ],
    "leggings": [
        "................",
        "..xxxx....xxxx..",
        "..xmbxxxxxxbbx..",
        "..xlLllyyllLlo..",
        "..xshhhhhhhhmo..",
        "..xshhhhhhhhmo..",
        "..xshhhmmhhhmo..",
        "..xshhmoobhhmo..",
        ".NxNhmo..xhNmxN.",
        "..xnnmo..xnnmo..",
        "..omlmo..ohlmo..",
        "..obmbo..obmbo..",
        "..obbbo..obbbo..",
        "...oooo..oooo...",
        "................",
        "................",
    ],
    "boots": [
        "................",
        "................",
        "................",
        "...xxxx..xxxx...",
        "...xlLo..xlLo...",
        "...xsmo..xmmo...",
        "...xsho..xhso...",
        "...xhlo..xhlo...",
        "...xhmo..xhho...",
        "..xhhmo..xmsmo..",
        ".xshmmo..xmmhmo.",
        "NxmmmooN.oommbxN",
        "NNNoo....N.ooNNN",
        "................",
        "................",
        "................",
    ],
}


def icon(rows):
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), rows
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), KEY[ch] + (255,))
    return img


# --- main --------------------------------------------------------------------
def main():
    for d in ("items", "models", "item_definitions", "3d"):
        os.makedirs(f"{OUT}/{d}", exist_ok=True)
    l1, l2 = layer_1(), layer_2()
    l1.save(f"{OUT}/demon_layer_1.png")
    l2.save(f"{OUT}/demon_layer_2.png")
    for name, rows in ICONS.items():
        icon(rows).save(f"{OUT}/items/demon_{name}.png")

    parts = geometry()
    at = atlas(l1)
    at.save(f"{OUT}/3d/demon_armor_parts.png")
    export_bbmodel(parts, at, f"{OUT}/3d/demon_armor.bbmodel")
    for piece in ("helmet", "chestplate", "leggings", "boots"):
        export_bbmodel([p for p in parts if PIECE_OF_PART(p) == piece], at,
                       f"{OUT}/3d/demon_{piece}.bbmodel")
    export_helmet_model(parts, f"{OUT}/models/demon_helmet_3d.json")
    with open(f"{OUT}/models/demon_helmet_icon.json", "w") as f:
        json.dump({"parent": "minecraft:item/generated",
                   "textures": {"layer0": "minecraft:item/demon_helmet"}}, f, indent=1)
    with open(f"{OUT}/item_definitions/demon_helmet.json", "w") as f:
        json.dump({"model": {
            "type": "minecraft:select", "property": "minecraft:display_context",
            "cases": [{"when": ["gui", "ground", "fixed"],
                       "model": {"type": "minecraft:model", "model": "minecraft:item/demon_helmet_icon"}}],
            "fallback": {"type": "minecraft:model", "model": "minecraft:item/demon_helmet_3d"}}}, f, indent=1)
    print(len(parts), "3D parts")


if __name__ == "__main__":
    main()
