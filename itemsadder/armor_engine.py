"""Shared engine for the themed armor sets: painted flat layers, icons, a
per-set parts atlas, head-worn 3D helmet models (with extensions), and the
ItemsAdder configs. Set definitions live in armor_sets.py."""
import math
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "demon_armor"))
import demon  # noqa: E402  (to_item_space, ITEM_K, Tex)

from preview import ARM, BODY, HEAD, LEG  # noqa: E402

PIECES = ("helmet", "chestplate", "leggings", "boots")
SLOTS = {"chestplate": "CHEST", "leggings": "LEGS", "boots": "FEET"}


def h(x, y, k=0):
    """Deterministic hash noise in [0, 1)."""
    n = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65536


# --- surface patterns: (pal, u, v, w, hgt, x, y) -> colour -------------------------
def pat_plate(P, u, v, w, hh, x, y):
    if v == 0:
        return P["l"]
    if v == hh - 1:
        return P["d"]
    if (u in (0, w - 1)) and v in (1, hh - 2):
        return P["t"]                                          # rivets
    return P["m"] if h(x, y) > 0.82 else P["b"]


def pat_fur(P, u, v, w, hh, x, y):
    r = h(x, y, 1)
    return P["l"] if r > 0.55 else P["m"] if r > 0.2 else P["b"]


def pat_scale(P, u, v, w, hh, x, y):
    """Overlapping 3x2 scales, lit from the top-left, alternate rows offset."""
    c = (u + (v // 2) % 2 * 2) % 3
    r = v % 2
    if r == 0:
        return P["l"] if c == 0 else P["m"]
    return P["d"] if c == 2 else P["b"]


def pat_cloth(P, u, v, w, hh, x, y):
    if v % 4 == 3 and u % 2 == 0:
        return P["d"]                                          # stitches
    return P["m"] if h(x, y, 2) > 0.85 else P["b"]


def pat_bark(P, u, v, w, hh, x, y):
    if (u + (v // 3)) % 3 == 0:
        return P["d"]                                          # grain
    return P["m"] if h(x, y, 3) > 0.7 else P["b"]


def pat_stripes(P, u, v, w, hh, x, y):
    return P["t"] if v % 3 == 1 else (P["l"] if v % 3 == 0 else P["b"])


def pat_lamellar(P, u, v, w, hh, x, y):
    if v % 3 == 2:
        return P["t"] if u % 3 == 1 else P["d"]                # lacing
    return P["m"] if v % 3 == 0 else P["b"]


def pat_brass(P, u, v, w, hh, x, y):
    if v in (0, hh - 1) or u in (0, w - 1):
        return P["t"] if (u + v) % 2 == 0 else P["t2"]         # riveted brass frame
    if (u, v) == (w // 2, hh // 2):
        return P["a"]
    return P["m"] if h(x, y, 4) > 0.8 else P["b"]


def pat_pumpkin(P, u, v, w, hh, x, y):
    if u % 3 == 0:
        return P["d"]                                          # pumpkin ribs
    if v % 5 == 4 and u % 2:
        return P["o"]                                          # stitches
    return P["m"] if u % 3 == 1 else P["b"]


def pat_cap(P, u, v, w, hh, x, y):
    if h(x // 2, y // 2, 5) > 0.72:
        return P["a"]                                          # white spots
    return P["t"] if v < hh - 1 else P["t2"]


PATTERNS = {"plate": pat_plate, "fur": pat_fur, "scale": pat_scale, "cloth": pat_cloth, "bark": pat_bark,
            "stripes": pat_stripes, "lamellar": pat_lamellar, "brass": pat_brass, "pumpkin": pat_pumpkin,
            "cap": pat_cap}


# --- flat armor layers ---------------------------------------------------------------
class Tex(demon.Tex):
    def face(self, rect, fn, P, rows=None):
        x0, y0, w, hh = rect
        for v in range(hh):
            if rows and v not in rows:
                continue
            for u in range(w):
                self.put(x0 + u, y0 + v, fn(P, u, v, w, hh, x0 + u, y0 + v))

    def row(self, rect, v, c, alt=None):
        x0, y0, w, _ = rect
        for u in range(w):
            self.put(x0 + u, y0 + v, alt if alt and u % 2 else c)

    def stamp(self, rect, art, P, dy=0):
        x0, y0, w, _ = rect
        for j, line in enumerate(art):
            for i, ch in enumerate(line[:w]):
                if ch != ".":
                    self.put(x0 + i, y0 + dy + j, P[ch])


def layers(S):
    """Paint layer_1 (helmet shell, chestplate, boots) and layer_2 (leggings)."""
    P, main, sec = S["pal"], PATTERNS[S["pattern"]], PATTERNS[S.get("secondary", "cloth")]
    t1, t2 = Tex(64, 32), Tex(64, 32)
    # helmet shell (used by the 3D helmet's atlas)
    for k in ("top", "right", "left", "back", "front"):
        t1.face(HEAD[k], main, P)
        t1.row(HEAD[k], 7, P["t"], P["t2"])
    t1.face(HEAD["bottom"], lambda *a: P["o"], P)
    if S.get("visor"):
        t1.stamp(HEAD["front"], S["visor"], P)
    # chestplate
    t1.face(BODY["top"], main, P)
    t1.face(BODY["bottom"], lambda *a: P["o"], P)
    for k in ("front", "back", "right", "left"):
        t1.face(BODY[k], main, P)
        t1.row(BODY[k], 0, P["t"])
        t1.row(BODY[k], 10, P["t2"], P["t"])
        t1.row(BODY[k], 11, P["d"])
    t1.stamp(BODY["front"], S["emblem"], P, dy=2)
    if S.get("back_art"):
        t1.stamp(BODY["back"], S["back_art"], P, dy=1)
    t1.face(ARM["top"], main, P)
    t1.face(ARM["bottom"], lambda *a: P["o"], P)
    for k in ("right", "front", "left", "back"):
        t1.face(ARM[k], main, P, rows=range(0, 4))            # pauldron
        t1.row(ARM[k], 3, P["t"])
        t1.face(ARM[k], sec, P, rows=range(4, 8))             # sleeve
        t1.face(ARM[k], main, P, rows=range(8, 12))           # bracer
        t1.row(ARM[k], 8, P["t"], P["t2"])
        t1.row(ARM[k], 11, P["d"])
    # boots
    t1.face(LEG["bottom"], lambda *a: P["o"], P)
    for k in ("right", "front", "left", "back"):
        t1.face(LEG[k], main, P, rows=range(6, 12))
        t1.row(LEG[k], 6, P["t"], P["t2"])
        t1.row(LEG[k], 11, P["o"])
    if S.get("boot_art"):
        t1.stamp(LEG["front"], S["boot_art"], P, dy=7)
    # leggings: belt + tassets on the body, painted leg extensions
    for k in ("front", "back", "right", "left"):
        t2.face(BODY[k], sec, P, rows=range(7, 12))
        t2.row(BODY[k], 8, P["t"], P["t2"])
    if S.get("belt_art"):
        t2.stamp(BODY["front"], S["belt_art"], P, dy=7)
    t2.face(LEG["top"], main, P)
    t2.face(LEG["bottom"], lambda *a: P["o"], P)
    for k in ("right", "front", "left", "back"):
        t2.face(LEG[k], main, P, rows=range(0, 5))
        t2.row(LEG[k], 5, P["t"], P["t2"])
        t2.face(LEG[k], sec, P, rows=range(6, 12))
    if S.get("leg_art"):
        t2.stamp(LEG["right"], S["leg_art"], P)
        t2.stamp(LEG["front"], S["leg_art"], P)
    cutouts(t1.img, t2.img)
    return t1.img, t2.img


def clear(img, rect, cells):
    """Make (u, v) cells of a face see-through so the skin shows."""
    x0, y0, _, _ = rect
    for u, v in cells:
        img.putpixel((x0 + u, y0 + v), (0, 0, 0, 0))


def cutouts(l1, l2):
    """Open the armor up: bare upper arms, a V-neck, open sides, and leggings
    that only wrap the front and outside of the leg."""
    for k in ("right", "front", "left", "back"):
        clear(l1, ARM[k], [(u, v) for u in range(4) for v in range(4, 8)])       # bare upper arm
    clear(l1, BODY["front"], [(u, 0) for u in range(2, 6)] + [(3, 1), (4, 1)])   # V-neck
    for k in ("right", "left"):                                                 # open sides, one strap
        clear(l1, BODY[k], [(u, v) for u in range(4) for v in range(2, 10) if v != 5])
    clear(l1, BODY["back"], [(u, v) for u in range(2, 6) for v in range(1, 3)] + [(3, 3), (4, 3)])
    clear(l2, LEG["left"], [(u, v) for u in range(4) for v in range(12) if v not in (0, 5)])  # inner leg
    clear(l2, LEG["back"], [(u, v) for u in range(4) for v in range(6, 12)])  # back of the knee down
    clear(l2, LEG["front"], [(u, v) for u in (1, 2) for v in (7, 8, 9)])      # shin slit
    clear(l2, LEG["top"], [(u, v) for u in range(4) for v in range(4)])       # no cap over the hip


# --- icons (16x16 on the Lode Studio template silhouettes) ------------------------------
TEMPLATES = {
    "helmet": ["................", "................", "................", ".....ooxxxo.....",
               "....ossshhmo....", "...osWWshhmmo...", "...osWshhmmmo...", "...xssoooobmo...",
               "...xhoGGGGobo...", "...omo....obo...", "...obo....obo...", "....oo....oo....",
               "................", "................", "................", "................"],
    "chestplate": ["................", "................", "..xxxx....xxxx..", ".xWssx....xWssx.",
                   ".xshhhx..xWssbx.", ".xbhhhhxxhhhbbx.", ".xbbhhhAAhhhbbx.", "..obWhhAAhhhbo..",
                   "...oshhhhhhbo...", "...ooGGGGGGoo...", "...obmmhhmmbo...", "...obmhhhhmbo...",
                   "...obmhhhhmbo...", "....obbhhbbo....", ".....oooooo.....", "................"],
    "leggings": ["................", "..xxxx....xxxx..", "..xmbxxxxxxbbx..", "..xGGGGAAGGGGo..",
                 "..xshhhhhhhhmo..", "..xshhhhhhhhmo..", "..xshhhmmhhhmo..", "..xshhmoobhhmo..",
                 "..xshmo..xhhmo..", "..xGGGo..xGGGo..", "..omhmo..ohmmo..", "..obmbo..obmbo..",
                 "..obbbo..obbbo..", "...oooo..oooo...", "................", "................"],
    "boots": ["................", "................", "................", "...xxxx..xxxx...",
              "...xGGo..xGGo...", "...xsmo..xmmo...", "...xsho..xhso...", "...xhmo..xhho...",
              "...xhmo..xhho...", "..xhhmo..xmsmo..", ".xshmmo..xmmhmo.", ".xGGGoo..ooGGGo.",
              ".xooo......oooo.", "................", "................", "................"],
}


def icons(S):
    P = S["pal"]
    key = {"o": P["o"], "x": P["d"], "b": P["d"], "m": P["b"], "h": P["m"], "s": P["l"],
           "W": tuple(min(255, c + 40) for c in P["l"]), "G": P["t"], "A": P["g"]}
    out = {}
    for piece, rows in TEMPLATES.items():
        img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in key:
                    img.putpixel((x, y), key[ch] + (255,))
        for (x, y), k in S.get("icon_extra", {}).get(piece, {}).items():
            img.putpixel((x, y), P[k] + (255,))
        out[piece] = img
    return out


# --- 3D parts ----------------------------------------------------------------------------
SWATCH_KEYS = ("o", "d", "b", "m", "l", "t", "t2", "a", "g", "s1", "s2")


def atlas(S, l1):
    """64x64: helmet shell faces from layer_1, then an 8x8 swatch per palette
    colour (bevelled), then patterned swatches."""
    P = S["pal"]
    t = Tex(64, 64)
    t.img.paste(l1.crop((0, 0, 32, 16)), (0, 0))
    sw = {}
    for i, k in enumerate(SWATCH_KEYS):
        sx, sy = (i % 8) * 8, 16 + (i // 8) * 8
        c = P[k]
        for j in range(8):
            for q in range(8):
                shade = 1.15 if j == 0 else 0.8 if j == 7 else (0.95 if (q + j) % 5 == 0 else 1.0)
                t.put(sx + q, sy + j, tuple(min(255, int(v * shade)) for v in c))
        sw[k] = (sx, sy, 8, 8)
    for i, name in enumerate(PATTERNS):
        sx, sy = (i % 8) * 8, 32 + (i // 8) * 8
        t.face((sx, sy, 8, 8), PATTERNS[name], P)
        sw["pat_" + name] = (sx, sy, 8, 8)
    return t.img, sw


def part(name, frm, to, mat, glow=False, rot=None):
    return {"name": name, "from": list(frm), "to": list(to), "mat": mat, "glow": glow, "rot": rot}


def mirror(parts):
    out = []
    for p in parts:
        (x0, y0, z0), (x1, y1, z1) = p["from"], p["to"]
        q = dict(p, name=p["name"] + "_l", **{"from": [-x1, y0, z0], "to": [-x0, y1, z1]})
        if p["rot"]:
            ax, ang, (ox, oy, oz) = p["rot"]
            q["rot"] = (ax, -ang if ax in ("y", "z") else ang, (-ox, oy, oz))
        out += [p, q]
    return out


def shell(scale=1.0, lift=0.0):
    """The helmet shell, textured with the painted helmet faces."""
    e = 5 * scale
    return {"name": "shell", "from": [-e, 23 + lift, -e], "to": [e, 23 + lift + 2 * e, e], "mat": None,
            "glow": False, "rot": None,
            "faces": {f: HEAD[k] for f, k in (("north", "front"), ("south", "back"), ("east", "right"),
                                              ("west", "left"), ("up", "top"))}}


def resolve(parts, sw):
    for p in parts:
        if "faces" not in p:
            r = sw[p["mat"]]
            p["faces"] = {f: r for f in ("north", "south", "east", "west", "up", "down")}
    return parts


def hat_model(parts, ref, gui_scale=0.6):
    elements = []
    for p in parts:
        faces = {}
        for f, (x, y, w, hh) in p["faces"].items():
            faces[f] = {"uv": [x / 4, y / 4, (x + w) / 4, (y + hh) / 4], "texture": "#parts"}
            if f == "up" and p["name"] == "shell":
                faces[f]["rotation"] = 180
        e = {"name": p["name"], "from": demon.to_item_space(p["from"]), "to": demon.to_item_space(p["to"]),
             "faces": faces}
        if p["rot"]:
            ax, ang, origin = p["rot"]
            e["rotation"] = {"angle": ang, "axis": ax, "origin": demon.to_item_space(origin)}
        if p["glow"]:
            e["light_emission"] = 15
        elements.append(e)
    k = round(1.6 / demon.ITEM_K, 4)
    return {
        "texture_size": [64, 64],
        "textures": {"parts": ref, "particle": ref},
        "elements": elements,
        "display": {
            "head": {"scale": [k, k, k]},
            "gui": {"rotation": [20, 200, 0], "translation": [0, -1, 0], "scale": [gui_scale] * 3},
            "ground": {"translation": [0, 3, 0], "scale": [0.4] * 3},
            "fixed": {"rotation": [0, 180, 0], "scale": [0.7] * 3},
            "thirdperson_righthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.35] * 3},
            "thirdperson_lefthand": {"rotation": [45, 45, 0], "translation": [0, 2, 0], "scale": [0.35] * 3},
            "firstperson_righthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.35] * 3},
            "firstperson_lefthand": {"rotation": [0, 45, 0], "translation": [0, 2, 0], "scale": [0.35] * 3},
        },
    }


# --- ItemsAdder configs ---------------------------------------------------------------------
RECIPE_SHAPES = {"helmet": ["ABA", "AXA", "XXX"], "chestplate": ["AXA", "ABA", "AAA"],
                 "leggings": ["ABA", "AXA", "AXA"], "boots": ["XXX", "AXA", "BXB"]}


def esc(s):
    return s.replace("'", "''")


def configs(S, ns):
    st = S["stats"]
    lore = "    lore:\n" + "".join(f"      - '{esc(line)}'\n" for line in ["&f"] + S["lore"] + ["&f", S["perk_text"]])

    def extra(slot_indent):
        return "".join(f"\n{slot_indent}{k}: {v}" for k, v in st.get("extra", {}).items())

    items = []
    for piece in PIECES:
        armor, dura = st["armor"][piece]
        name = f"'{S['color']}{S['name']} {piece.capitalize()}'"
        if piece == "helmet":
            items.append(f"""  {S['id']}_helmet:
    enabled: true
    display_name: {name}
{lore}    permission: {ns}.helmet
    behaviours:
      hat: true
    resource:
      material: PAPER
      generate: false
      model_path: item/{S['id']}_helmet
    durability:
      max_custom_durability: {dura}
    attribute_modifiers:
      head:
        armor: {armor}
        armorToughness: {st['toughness']}{extra('        ')}""")
        else:
            items.append(f"""  {S['id']}_{piece}:
    enabled: true
    display_name: {name}
{lore}    permission: {ns}.{piece}
    resource:
      material: {S.get('material', 'DIAMOND')}_{piece.upper()}
      generate: true
      textures:
        - item/{S['id']}_{piece}
    durability:
      max_custom_durability: {dura}
    equipment:
      id: {ns}:{S['id']}_armor
      slot: {SLOTS[piece]}
      slot_attribute_modifiers:
        armor: {armor}
        armorToughness: {st['toughness']}{extra('        ')}""")
    recs = []
    for piece in PIECES:
        recs.append(f"""    {S['id']}_{piece}:
      permission: itemsadder.craft.{S['id']}_{piece}
      enabled: true
      pattern:
""" + "".join(f"        - {r}\n" for r in RECIPE_SHAPES[piece]) + f"""      ingredients:
        A: {S['recipe']['A']}
        B: {S['recipe']['B']}
      result:
        item: {ns}:{S['id']}_{piece}
        amount: 1""")
    items_yml = f"""info:
  namespace: {ns}
recipes:
  crafting_table:
{chr(10).join(recs)}
items:
{chr(10).join(items)}
"""
    equip_yml = f"""info:
  namespace: {ns}
equipments:
  {S['id']}_armor:
    type: armor
    layer_1: armor/{S['id']}_armor/layer_1
    layer_2: armor/{S['id']}_armor/layer_2
"""
    cat_yml = f"""info:
  namespace: {ns}
categories:
  {S['id']}:
    enabled: true
    name: '{S['color']}{S['name']} Armor'
    icon: {ns}:{S['id']}_helmet
    permission: ia.menu.{S['id']}
    items:
""" + "".join(f"      - {ns}:{S['id']}_{p}\n" for p in PIECES)
    return items_yml, equip_yml, cat_yml


def build_set(S, base, write, animate, mcmeta):
    """Write one set's content folder; returns (layer1, layer2, atlas, parts, icons) for previews."""
    ns = S["id"]
    l1, l2 = layers(S)
    write(f"{base}/textures/armor/{ns}_armor/layer_1.png", l1)
    write(f"{base}/textures/armor/{ns}_armor/layer_2.png", l2)
    ics = icons(S)
    for piece in PIECES[1:]:
        write(f"{base}/textures/item/{ns}_{piece}.png", ics[piece])
    at, sw = atlas(S, l1)
    parts = resolve(S["helmet"](), sw)
    glow = {S["pal"]["g"]}
    write(f"{base}/textures/item/{ns}_parts.png", animate(at, glow))
    write(f"{base}/textures/item/{ns}_parts.png.mcmeta", mcmeta)
    write(f"{base}/models/item/{ns}_helmet.json", hat_model(parts, f"{ns}:item/{ns}_parts", S.get("gui_scale", 0.6)))
    items_yml, equip_yml, cat_yml = configs(S, ns)
    write(f"{base}/configs/items.yml", items_yml)
    write(f"{base}/configs/equipments.yml", equip_yml)
    write(f"{base}/configs/categories.yml", cat_yml)
    return l1, l2, at, parts, [ics[p] for p in PIECES]
