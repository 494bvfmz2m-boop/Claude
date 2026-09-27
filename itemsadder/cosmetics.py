"""50 more webstore cosmetics (on top of accessories.py): hats, ears, halos,
floating orbitals, back items and little companions. All head-worn 3D
models (PAPER + hat behaviour) sharing one swatch atlas; no stats."""
from PIL import Image

import armor_engine as AE
from armor_engine import mirror, part

NS = "slothsmp-cosmetics"

COLORS = {
    "white": (244, 244, 240), "cream": (240, 226, 190), "lgray": (190, 190, 196), "gray": (130, 130, 138),
    "dgray": (70, 70, 78), "black": (26, 24, 30), "red": (200, 36, 40), "dred": (120, 16, 24),
    "orange": (240, 130, 30), "yellow": (250, 214, 60), "gold": (220, 170, 50), "gold_l": (255, 226, 120),
    "lime": (130, 220, 60), "green": (60, 150, 50), "dgreen": (30, 90, 30), "cyan": (60, 200, 220),
    "teal": (30, 130, 140), "blue": (50, 90, 210), "navy": (24, 34, 90), "lblue": (140, 190, 250),
    "purple": (120, 50, 180), "magenta": (200, 60, 190), "pink": (250, 140, 190), "lpink": (255, 200, 225),
    "brown": (130, 80, 44), "dbrown": (80, 48, 26), "tan": (200, 150, 100), "beige": (225, 200, 160),
    "silver": (210, 214, 224), "ice": (180, 230, 250), "wood": (160, 110, 60), "leaf": (80, 170, 60),
    "orange_d": (180, 80, 20), "frog": (90, 170, 60), "frog_d": (60, 120, 40), "duck": (250, 230, 80),
    "fox": (230, 120, 40), "fox_d": (170, 80, 30), "slime": (120, 210, 90), "slime_d": (70, 150, 60),
    "axo": (250, 170, 200), "axo_d": (220, 90, 150), "shark": (110, 130, 150), "shark_d": (70, 86, 104),
    "denim": (60, 90, 140), "rust": (170, 90, 50), "ghost": (236, 240, 250), "ghost_d": (180, 190, 210),
    "g_yellow": (255, 240, 130), "g_cyan": (140, 250, 255), "g_pink": (255, 150, 230), "g_red": (255, 90, 70),
    "g_green": (150, 255, 120), "g_white": (255, 255, 250), "g_purple": (210, 140, 255), "g_orange": (255, 180, 70),
    "g_blue": (120, 170, 255), "rainbow_r": (240, 60, 60), "rainbow_o": (250, 150, 40), "rainbow_y": (250, 230, 60),
}
GLOW = {c for k, c in COLORS.items() if k.startswith("g_")}


def atlas():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    sw = {}
    for i, (k, c) in enumerate(COLORS.items()):
        sx, sy = (i % 8) * 8, (i // 8) * 8
        for j in range(8):
            for q in range(8):
                shade = 1.12 if j == 0 else 0.82 if j == 7 else (0.95 if (q + j) % 5 == 0 else 1.0)
                if k.startswith("g_"):
                    shade = 1.0
                img.putpixel((sx + q, sy + j), tuple(min(255, int(v * shade)) for v in c) + (255,))
        sw[k] = (sx, sy, 8, 8)
    return img, sw


def G(name, frm, to, mat, rot=None):
    """A glowing part."""
    return part(name, frm, to, mat, glow=True, rot=rot)


def ring(name, y0, y1, mat, r=4.6, t=0.5, glow=False):
    p = [part(name + "_n", (-r, y0, -r), (r, y1, -r + t), mat, glow=glow),
         part(name + "_s", (-r, y0, r - t), (r, y1, r), mat, glow=glow)]
    p += mirror([part(name + "_e", (r - t, y0, -r + t), (r, y1, r - t), mat, glow=glow)])
    return p


def zr(a, o):
    return ("z", a, o)


def xr(a, o):
    return ("x", a, o)


def yr(a, o):
    return ("y", a, o)


# ----------------------------------------------------------------------------- designs
def royal_crown():
    p = ring("band", 32, 33.6, "gold", r=4.7) + [
        part("velvet", (-4, 33, -4), (4, 35.2, 4), "dred"),
        part("velvet_top", (-2.8, 35.2, -2.8), (2.8, 35.8, 2.8), "dred"),
        part("orb", (-0.6, 35.8, -0.6), (0.6, 37, 0.6), "gold_l"),
        part("cross_v", (-0.2, 37, -0.2), (0.2, 38.2, 0.2), "gold_l"),
        part("cross_h", (-0.6, 37.5, -0.2), (0.6, 37.9, 0.2), "gold_l"),
        G("ruby", (-0.7, 32.4, -4.9), (0.7, 33.3, -4.75), "g_red"),
        G("sapphire_b", (-0.7, 32.4, 4.75), (0.7, 33.3, 4.9), "g_blue")]
    for x in (-3.5, 0, 3.5):
        p.append(part(f"point_f{x}", (x - 0.6, 33.6, -4.7), (x + 0.6, 34.8, -4.2), "gold"))
        p.append(part(f"point_b{x}", (x - 0.6, 33.6, 4.2), (x + 0.6, 34.8, 4.7), "gold"))
    p += mirror([part("point_s", (4.2, 33.6, -0.6), (4.7, 34.8, 0.6), "gold"),
                 G("emerald_s", (4.75, 32.4, -0.6), (4.9, 33.3, 0.6), "g_green")])
    return p


def tiara():
    p = [part("band_f", (-3.6, 32, -4.7), (3.6, 32.5, -4.4), "silver"),
         part("peak", (-0.6, 32.5, -4.7), (0.6, 34.4, -4.4), "silver"),
         G("gem", (-0.5, 32.8, -4.8), (0.5, 33.8, -4.7), "g_cyan")]
    p += mirror([part("band_s", (4.4, 31.4, -4.4), (4.7, 32, 1), "silver"),
                 part("band_c", (3.6, 31.8, -4.7), (4.7, 32.3, -4.2), "silver"),
                 part("arch", (1.2, 32.5, -4.7), (2.4, 33.6, -4.4), "silver"),
                 part("arch2", (2.6, 32.4, -4.7), (3.4, 33, -4.4), "silver"),
                 G("pearl", (1.6, 33.6, -4.75), (2, 34, -4.45), "g_white")])
    return p


def sheriff_hat():
    p = [part("brim", (-4.2, 32, -6.4), (4.2, 32.4, 6.4), "black"),
         part("crown", (-3.6, 32.4, -3.8), (3.6, 35, 3.8), "black"),
         part("crease", (-0.5, 34.6, -3.2), (0.5, 35.1, 3.2), "dgray"),
         part("band", (-3.7, 32.4, -3.9), (3.7, 33, 3.9), "silver"),
         G("star", (-0.5, 32.45, -4), (0.5, 33.25, -3.95), "g_yellow", rot=zr(45, (0, 32.85, -3.97)))]
    p += mirror([part("brim_side", (4.2, 32, -6.4), (7, 32.4, 6.4), "black", rot=zr(22.5, (4.2, 32.2, 0)))])
    return p


def beanie():
    p = [part("knit", (-4.6, 31, -4.6), (4.6, 34, 4.6), "red"),
         part("top", (-3.6, 34, -3.6), (3.6, 34.8, 3.6), "red"),
         part("pom", (-1.2, 34.8, -1.2), (1.2, 36.4, 1.2), "white")]
    p += ring("cuff", 30.4, 31.8, "white", r=4.75, t=0.6)
    p += [part(f"stripe{i}", (-4.65, 32.4 + i, -4.65), (4.65, 32.7 + i, 4.65), "dred") for i in range(2)]
    return p


def baseball_cap():
    return [part("crown", (-4.5, 31.4, -4.5), (4.5, 33.6, 4.5), "blue"),
            part("top", (-3.5, 33.6, -3.5), (3.5, 34.2, 3.5), "blue"),
            part("button", (-0.5, 34.2, -0.5), (0.5, 34.6, 0.5), "white"),
            part("bill", (-3.8, 31.4, -8), (3.8, 31.8, -4.5), "navy"),
            part("logo", (-1, 32.2, -4.6), (1, 33.2, -4.5), "white")]


def chef_hat():
    return ring("band", 31.4, 33.4, "white", r=4.6) + [
        part("tube", (-4.2, 33.4, -4.2), (4.2, 36.4, 4.2), "white"),
        part("puff", (-5, 36.4, -5), (5, 38.4, 5), "white"),
        part("puff_top", (-4, 38.4, -4), (4, 39.2, 4), "lgray"),
        part("puff_f", (-2, 36.2, -5.4), (2, 38, -5), "white")]


def party_hat():
    p = [part("c0", (-2.6, 32, -2.6), (2.6, 33.6, 2.6), "magenta"),
         part("c1", (-2, 33.6, -2), (2, 35.2, 2), "cyan"),
         part("c2", (-1.4, 35.2, -1.4), (1.4, 36.8, 1.4), "yellow"),
         part("c3", (-0.8, 36.8, -0.8), (0.8, 38, 0.8), "magenta"),
         part("pom", (-0.8, 38, -0.8), (0.8, 39.2, 0.8), "gold_l"),
         part("strap", (-4.6, 26, -0.3), (-4.4, 32, 0.3), "white")]
    return p


def sombrero():
    p = [part("brim", (-8, 32, -8), (8, 32.4, 8), "yellow"),
         part("brim_edge", (-8.2, 32.4, -8.2), (8.2, 33, 8.2), "orange"),
         part("brim_inner", (-7.6, 32.4, -7.6), (7.6, 33.1, 7.6), "yellow"),
         part("crown", (-3.4, 32.4, -3.4), (3.4, 36, 3.4), "yellow"),
         part("crown_top", (-2.4, 36, -2.4), (2.4, 36.8, 2.4), "yellow"),
         part("band", (-3.5, 32.6, -3.5), (3.5, 33.6, 3.5), "red"),
         part("band2", (-3.52, 33.6, -3.52), (3.52, 34, 3.52), "green")]
    return p


def fez():
    return [part("body", (-3, 32, -3), (3, 35.2, 3), "red"),
            part("top", (-2.6, 35.2, -2.6), (2.6, 35.4, 2.6), "dred"),
            part("cord", (-0.15, 34.4, -0.15), (0.15, 35.4, 0.15), "black"),
            part("tassel_cord", (0, 35.3, -0.1), (3.2, 35.5, 0.1), "black"),
            part("tassel", (3, 33, -0.4), (3.5, 35.4, 0.3), "black")]


def grad_cap():
    return [part("base", (-3.8, 32, -3.8), (3.8, 33.4, 3.8), "black"),
            part("board", (-5.4, 33.4, -5.4), (5.4, 33.8, 5.4), "black", rot=yr(45, (0, 33.6, 0))),
            part("button", (-0.5, 33.8, -0.5), (0.5, 34.1, 0.5), "gold"),
            part("tassel_cord", (0, 33.85, -0.15), (4, 34, 0.15), "gold"),
            part("tassel", (3.7, 31, -0.35), (4.3, 33.9, 0.35), "gold_l")]


def santa_hat():
    return ring("fur", 30.6, 32.4, "white", r=4.8, t=0.8) + [
        part("h0", (-4.4, 32.4, -4.4), (4.4, 34.4, 4.4), "red"),
        part("h1", (-3.2, 34.4, -2.6), (3.2, 36, 3.6), "red"),
        part("h2", (-2, 35.4, 1), (2, 37, 4.6), "red", rot=xr(22.5, (0, 36, 2.8))),
        part("h3", (-1.2, 34.6, 4), (1.2, 36.4, 6.2), "red", rot=xr(45, (0, 35.6, 5))),
        part("pom", (-1.2, 32.6, 5.8), (1.2, 35, 8.2), "white")]


def propeller_cap():
    p = [part("q0", (-4.5, 31.4, -4.5), (0, 34, 0), "red"), part("q1", (0, 31.4, -4.5), (4.5, 34, 0), "yellow"),
         part("q2", (-4.5, 31.4, 0), (0, 34, 4.5), "blue"), part("q3", (0, 31.4, 0), (4.5, 34, 4.5), "lime"),
         part("bill", (-3.4, 31.4, -7), (3.4, 31.8, -4.5), "red"),
         part("stem", (-0.3, 34, -0.3), (0.3, 35.6, 0.3), "dgray"),
         part("hub", (-0.6, 35.6, -0.6), (0.6, 36.2, 0.6), "gold")]
    p += [part("blade0", (-5, 35.7, -0.6), (5, 36, 0.6), "gray", rot=yr(22.5, (0, 35.85, 0))),
          part("blade1", (-0.6, 35.7, -5), (0.6, 36, 5), "gray", rot=yr(22.5, (0, 35.85, 0)))]
    return p


def jester_hat():
    p = ring("band", 30.6, 32, "gold", r=4.7) + [
        part("base_l", (-4.4, 32, -4.4), (0, 34, 4.4), "purple"),
        part("base_r", (0, 32, -4.4), (4.4, 34, 4.4), "green")]
    p += [part("horn_r0", (1, 33.4, -1), (3.2, 36.8, 1), "green", rot=zr(-45, (2, 33.6, 0))),
          part("horn_r1", (4.2, 35.2, -0.8), (5.8, 38.2, 0.8), "green", rot=zr(-22.5, (5, 35.2, 0))),
          G("bell_r", (5.8, 37.2, -0.7), (7.2, 38.6, 0.7), "g_yellow"),
          part("horn_l0", (-3.2, 33.4, -1), (-1, 36.8, 1), "purple", rot=zr(45, (-2, 33.6, 0))),
          part("horn_l1", (-5.8, 35.2, -0.8), (-4.2, 38.2, 0.8), "purple", rot=zr(22.5, (-5, 35.2, 0))),
          G("bell_l", (-7.2, 37.2, -0.7), (-5.8, 38.6, 0.7), "g_yellow")]
    return p


def fox_ears():
    return mirror([part("ear", (2, 32, -1), (4.2, 34.4, 0.4), "fox", rot=zr(-22.5, (3.1, 32, -0.3))),
                   part("ear_tip", (2.6, 34.2, -0.8), (3.6, 35.4, 0.2), "fox_d", rot=zr(-22.5, (3.1, 32, -0.3))),
                   part("ear_in", (2.5, 32.3, -1.05), (3.7, 33.9, -1), "white", rot=zr(-22.5, (3.1, 32, -0.3))),
                   part("band", (4.4, 29, -0.4), (4.7, 32.2, 0.4), "fox_d")]) + [
        part("band_top", (-4.4, 32, -0.4), (4.4, 32.3, 0.4), "fox_d")]


def bear_ears():
    return mirror([part("ear", (2.4, 32, -0.8), (4.6, 34.2, 0.4), "brown"),
                   part("ear_in", (2.9, 32.3, -0.85), (4.1, 33.7, -0.8), "tan"),
                   part("band", (4.4, 29, -0.4), (4.7, 32.2, 0.4), "dbrown")]) + [
        part("band_top", (-4.4, 32, -0.4), (4.4, 32.3, 0.4), "dbrown")]


def frog_hat():
    p = [part("body", (-3, 32, -2.6), (3, 34.6, 2.8), "frog"),
         part("belly", (-2.2, 32, -2.7), (2.2, 33.6, -2.6), "cream"),
         part("mouth", (-2.4, 33, -2.75), (2.4, 33.2, -2.6), "frog_d")]
    p += mirror([part("eye", (1, 34.6, -2.4), (2.6, 35.8, -0.8), "frog"),
                 part("pupil", (1.4, 34.9, -2.45), (2.2, 35.5, -2.4), "black"),
                 part("leg", (2.8, 32, -1.8), (4, 32.8, 1.6), "frog_d"),
                 part("foot", (2.6, 32, -3.2), (4, 32.4, -1.8), "frog_d")])
    return p


def duck_hat():
    return [part("body", (-2.2, 32, -2), (2.2, 34.4, 3.4), "duck"),
            part("tail", (-1.2, 33.6, 3.4), (1.2, 34.8, 4.4), "duck"),
            part("head", (-1.6, 34.4, -2.6), (1.6, 37, 0.4), "duck"),
            part("beak", (-1.1, 35, -4.2), (1.1, 35.8, -2.6), "orange"),
            part("eye_l", (-1.65, 35.9, -2.2), (-1.6, 36.5, -1.6), "black"),
            part("eye_r", (1.6, 35.9, -2.2), (1.65, 36.5, -1.6), "black"),
            part("wing_l", (-2.5, 32.6, -1), (-2.2, 34, 2.6), "gold"),
            part("wing_r", (2.2, 32.6, -1), (2.5, 34, 2.6), "gold")]


def cat_nap():
    return [part("body", (-3.8, 32, -1.8), (3, 34, 2.2), "orange"),
            part("stripe0", (-2, 34, -1.8), (-1.2, 34.05, 2.2), "orange_d"),
            part("stripe1", (0.4, 34, -1.8), (1.2, 34.05, 2.2), "orange_d"),
            part("head", (2.6, 32, -2.2), (5.4, 34.4, 1), "orange"),
            part("ear_l", (2.8, 34.4, -1.8), (3.6, 35.2, -1), "orange"),
            part("ear_r", (4.4, 34.4, -1.8), (5.2, 35.2, -1), "orange"),
            part("eyes", (3.2, 33.2, -2.25), (4.8, 33.4, -2.2), "black"),
            part("nose", (3.8, 32.7, -2.3), (4.2, 33, -2.2), "pink"),
            part("tail", (-6.2, 32, 0.4), (-3.8, 32.8, 1.2), "orange"),
            part("tail_tip", (-6.2, 32, -1.6), (-5.4, 32.8, 0.4), "orange_d"),
            part("paws", (2.4, 32, -2.6), (3.6, 32.6, -1.8), "white")]


def unicorn_horn():
    p = [part("h0", (-0.9, 32, -3.4), (0.9, 33.6, -1.6), "gold_l", rot=xr(-22.5, (0, 32, -2.5))),
         part("h1", (-0.65, 33.4, -3.9), (0.65, 35.2, -2.6), "gold", rot=xr(-22.5, (0, 32, -2.5))),
         part("h2", (-0.4, 35, -4.1), (0.4, 36.6, -3.3), "gold_l", rot=xr(-22.5, (0, 32, -2.5))),
         G("tip", (-0.2, 36.6, -3.9), (0.2, 37.4, -3.5), "g_white", rot=xr(-22.5, (0, 32, -2.5)))]
    for i, (z, mat) in enumerate(((-1.4, "pink"), (0.4, "lblue"), (2.2, "purple"), (4, "lpink"))):
        p.append(part(f"mane{i}", (-0.6, 30.4 - i * 1.4, z), (0.6, 33.2, z + 1.8), mat))
    return p


def reindeer_antlers():
    return mirror([part("a0", (2.4, 32, -0.4), (3, 35, 0.4), "brown", rot=zr(-22.5, (2.7, 32, 0))),
                   part("a1", (3.4, 34.4, -0.35), (5.8, 35, 0.35), "brown", rot=zr(22.5, (3.4, 34.7, 0))),
                   part("a2", (3.6, 34.6, -0.35), (4.2, 37, 0.35), "brown"),
                   part("a3", (5, 35.2, -0.3), (5.6, 36.8, 0.3), "brown"),
                   G("bell", (5.3, 34.2, -0.4), (6.1, 35, 0.4), "g_yellow"),
                   part("band", (4.4, 29, -0.4), (4.7, 32.2, 0.4), "dred")]) + [
        part("band_top", (-4.4, 32, -0.4), (4.4, 32.3, 0.4), "dred"),
        part("holly", (-0.6, 32.3, -0.6), (0.6, 32.8, 0.6), "green"),
        G("berry", (-0.25, 32.8, -0.25), (0.25, 33.2, 0.25), "g_red")]


def flower_crown():
    p = ring("vine", 31.6, 32.1, "dgreen", r=4.7, t=0.4)
    spots = [(-3, -4.7), (0, -4.8), (3, -4.7), (4.8, -2), (4.8, 1.5), (3, 4.7), (0, 4.8), (-3, 4.7), (-4.8, 1.5),
             (-4.8, -2)]
    mats = ["pink", "g_yellow", "lblue", "white", "magenta", "yellow", "pink", "lpink", "white", "purple"]
    for i, ((x, z), m) in enumerate(zip(spots, mats)):
        p.append(part(f"flower{i}", (x - 0.7, 31.8, z - 0.7), (x + 0.7, 32.9, z + 0.7), m, glow=m.startswith("g_")))
        p.append(part(f"leaf{i}", (x + 0.5, 31.6, z - 0.3), (x + 1.4, 32, z + 0.3), "leaf"))
    return p


def laurel_wreath():
    p = []
    for side in (1, -1):
        for i in range(5):
            z = -3.8 + i * 1.9
            x = side * 4.8
            p.append(part(f"leaf{side}{i}", (x - 0.35, 31.8 + (i % 2) * 0.3, z - 0.9),
                          (x + 0.35, 33.2 + (i % 2) * 0.3, z + 0.9), "gold_l" if i % 2 else "gold",
                          rot=xr(22.5 if side > 0 else -22.5, (x, 32.5, z))))
    p.append(part("tie", (-1, 31.6, 4.6), (1, 32.6, 5), "gold"))
    return p


def sunglasses():
    p = [part("bridge", (-1, 29.4, -4.9), (1, 29.8, -4.6), "black")]
    p += mirror([part("frame", (0.8, 28.2, -4.95), (3.8, 30.2, -4.6), "black"),
                 G("lens", (1.1, 28.5, -5.0), (3.5, 29.9, -4.95), "g_purple"),
                 part("arm", (4.4, 29.4, -4.6), (4.7, 29.8, 0.6), "black")])
    return p


def aviator_goggles():
    p = ring("strap", 30.4, 31.2, "dbrown", r=4.65, t=0.4) + [part("bridge", (-0.8, 31, -5), (0.8, 31.4, -4.7), "gold")]
    p += mirror([part("rim", (0.6, 30.2, -5.3), (3.4, 32.4, -4.6), "gold"),
                 G("lens", (0.9, 30.5, -5.4), (3.1, 32.1, -5.3), "g_orange")])
    return p


def miner_lamp():
    return ring("band", 30.4, 31.2, "dgray", r=4.65, t=0.4) + [
        part("helmet", (-4.5, 31.2, -4.5), (4.5, 33.2, 4.5), "yellow"),
        part("helmet_top", (-3.4, 33.2, -3.4), (3.4, 34, 3.4), "yellow"),
        part("ridge", (-0.5, 33.2, -4.5), (0.5, 34.4, 4.5), "orange"),
        part("lamp", (-1.1, 31.4, -5.4), (1.1, 33.2, -4.5), "dgray"),
        G("light", (-0.8, 31.7, -5.5), (0.8, 32.9, -5.4), "g_yellow")]


def bowler_monocle():
    return [part("brim", (-5.2, 32, -5.2), (5.2, 32.4, 5.2), "black"),
            part("dome", (-3.8, 32.4, -3.8), (3.8, 35, 3.8), "black"),
            part("dome_top", (-2.8, 35, -2.8), (2.8, 35.6, 2.8), "black"),
            part("band", (-3.9, 32.4, -3.9), (3.9, 33, 3.9), "dred"),
            part("monocle", (1, 28.2, -4.8), (3, 30.2, -4.6), "gold"),
            G("lens", (1.3, 28.5, -4.85), (2.7, 29.9, -4.8), "g_white"),
            part("chain", (2.8, 25.4, -4.7), (3, 28.4, -4.6), "gold")]


def rain_cloud():
    p = [part("c0", (-3.4, 36, -2.4), (3.4, 37.6, 2.4), "gray"),
         part("c1", (-2.2, 37.6, -1.8), (2.4, 38.8, 1.8), "lgray"),
         part("c2", (-4.2, 36.4, -1.4), (-3.4, 37.4, 1.4), "gray"),
         part("c3", (3.4, 36.4, -1.2), (4.2, 37.2, 1.2), "lgray")]
    for i, (x, z, y) in enumerate(((-2, -1, 34.6), (0, 1, 33.8), (2, -0.5, 35), (-0.8, -1.6, 33.4), (1.2, 1.4, 34.2))):
        p.append(G(f"drop{i}", (x - 0.15, y, z - 0.15), (x + 0.15, y + 0.9, z + 0.15), "g_blue"))
    return p


def rainbow_halo():
    """A rainbow arching over the head (half an octagon per colour band)."""
    p, cy = [], 31
    for i, m in enumerate(("rainbow_r", "rainbow_o", "rainbow_y", "g_green", "g_blue", "g_purple")):
        R, t = 6.2 - i * 0.45, 0.45
        s = 0.83 * R
        p.append(part(f"top{i}", (-s / 2 - 0.1, cy + R - t, -0.3), (s / 2 + 0.1, cy + R, 0.3), m, glow=True))
        dx, dy = 0.707 * (R - t / 2), 0.707 * (R - t / 2)
        p += mirror([part(f"diag{i}", (dx - s / 2 - 0.1, cy + dy - t / 2, -0.3), (dx + s / 2 + 0.1, cy + dy + t / 2, 0.3),
                          m, glow=True, rot=zr(-45, (dx, cy + dy, 0))),
                     part(f"leg{i}", (R - t, cy - s, -0.3), (R, cy + s / 2 + 0.1, 0.3), m, glow=True)])
    return p


def saturn():
    return [part("planet", (-1.6, 35.6, -1.6), (1.6, 38.8, 1.6), "tan"),
            part("band", (-1.65, 37, -1.65), (1.65, 37.5, 1.65), "brown"),
            part("ring_a", (-3.8, 37, -0.5), (3.8, 37.3, 0.5), "beige", rot=zr(22.5, (0, 37.2, 0))),
            part("ring_b", (-0.5, 37, -3.8), (0.5, 37.3, 3.8), "beige", rot=zr(22.5, (0, 37.2, 0))),
            part("ring_c", (-2.8, 37.02, -2.8), (2.8, 37.28, 2.8), "cream", rot=zr(22.5, (0, 37.2, 0))),
            G("moon", (3.8, 35.2, 1.4), (4.6, 36, 2.2), "g_white"),
            G("star0", (-4.4, 36.6, -2), (-4, 37, -1.6), "g_yellow"),
            G("star1", (2.6, 39.4, -2.4), (3, 39.8, -2), "g_yellow")]


def ice_halo():
    p = []
    for i, (x, z) in enumerate(((0, -4.2), (3, -3), (4.2, 0), (3, 3), (0, 4.2), (-3, 3), (-4.2, 0), (-3, -3))):
        h = 2.4 if i % 2 == 0 else 1.6
        p.append(part(f"shard{i}", (x - 0.4, 35, z - 0.4), (x + 0.4, 35 + h, z + 0.4), "ice", rot=yr(45, (x, 35, z))))
        p.append(G(f"tip{i}", (x - 0.2, 35 + h, z - 0.2), (x + 0.2, 35.6 + h, z + 0.2), "g_cyan", rot=yr(45, (x, 35, z))))
    return p


def music_notes():
    p = []
    for i, (x, y, z, m) in enumerate(((4.8, 33, -2, "g_pink"), (-5, 34.6, 1, "g_cyan"), (2, 36, 3.6, "g_yellow"),
                                      (-2.4, 36.8, -3, "g_green"))):
        p += [G(f"head{i}", (x - 0.5, y, z - 0.35), (x + 0.5, y + 0.8, z + 0.35), m),
              G(f"stem{i}", (x + 0.3, y + 0.6, z - 0.12), (x + 0.5, y + 2.4, z + 0.12), m),
              G(f"flag{i}", (x + 0.3, y + 2, z - 0.12), (x + 1.2, y + 2.4, z + 0.12), m)]
    return p


def butterfly_wings():
    return mirror([part("upper", (0.6, 25, 4.4), (6, 30.4, 4.6), "blue", rot=zr(22.5, (0.6, 26, 4.5))),
                   part("upper_edge", (5, 25.6, 4.35), (6.2, 30.6, 4.65), "black", rot=zr(22.5, (0.6, 26, 4.5))),
                   G("spot", (3, 27.6, 4.62), (4.2, 28.8, 4.66), "g_cyan", rot=zr(22.5, (0.6, 26, 4.5))),
                   part("lower", (0.6, 20.6, 4.4), (4.4, 25, 4.6), "lblue", rot=zr(-22.5, (0.6, 25, 4.5))),
                   part("body", (0, 20.6, 4.35), (0.6, 30, 4.8), "black")])


def fairy_wings():
    return mirror([G("upper", (0.6, 25.6, 4.45), (5.2, 32, 4.55), "g_cyan", rot=zr(22.5, (0.6, 26, 4.5))),
                   part("vein", (0.6, 25.8, 4.4), (5.2, 26.1, 4.6), "white", rot=zr(45, (0.6, 26, 4.5))),
                   G("lower", (0.6, 21.4, 4.45), (3.8, 25.6, 4.55), "g_pink", rot=zr(-22.5, (0.6, 25.6, 4.5))),
                   G("sparkle", (5.6, 31.6, 4.4), (6, 32, 4.6), "g_white")])


def jetpack():
    return [part("frame", (-3.2, 20, 3.2), (3.2, 21, 4.4), "dgray"),
            part("strap_l", (-3.2, 21, 2.6), (-2.4, 24.6, 3.2), "black"),
            part("strap_r", (2.4, 21, 2.6), (3.2, 24.6, 3.2), "black")] + mirror([
        part("tank", (0.4, 18, 3.4), (3, 25, 6), "silver"),
        part("tank_top", (0.8, 25, 3.8), (2.6, 25.8, 5.6), "red"),
        part("nozzle", (0.9, 16.6, 3.9), (2.5, 18, 5.5), "dgray"),
        G("flame", (1.2, 14, 4.2), (2.2, 16.6, 5.2), "g_orange"),
        G("flame_core", (1.45, 15.2, 4.45), (1.95, 16.6, 4.95), "g_yellow")])


def backpack():
    return [part("pack", (-3.2, 16.8, 3.2), (3.2, 24, 6.2), "brown"),
            part("flap", (-3.3, 21.6, 3.1), (3.3, 24.2, 6.3), "dbrown"),
            part("buckle", (-0.5, 21.4, 6.3), (0.5, 22.4, 6.4), "gold"),
            part("pocket", (-2.2, 17.6, 6.2), (2.2, 20.4, 6.8), "tan"),
            part("roll", (-3.8, 24, 3.6), (3.8, 25.6, 5.6), "green"),
            part("roll_strap", (-2.2, 23.95, 3.55), (-1.6, 25.65, 5.65), "dbrown"),
            part("lantern", (3.2, 18, 4.2), (4.4, 19.8, 5.4), "dgray"),
            G("lantern_glow", (3.35, 18.3, 4.35), (4.25, 19.5, 5.25), "g_orange")]


def greatsword_back():
    k = zr(22.5, (0, 20, 4.6))
    return [part("blade", (-0.7, 8, 4.4), (0.7, 26, 4.8), "silver", rot=k),
            part("fuller", (-0.2, 9, 4.8), (0.2, 25, 4.85), "lgray", rot=k),
            part("guard", (-2.4, 26, 4.2), (2.4, 26.8, 5), "gold", rot=k),
            part("grip", (-0.4, 26.8, 4.35), (0.4, 30, 4.85), "dbrown", rot=k),
            G("pommel", (-0.6, 30, 4.3), (0.6, 31, 4.9), "g_red", rot=k),
            part("strap", (-4.6, 21, 3.2), (4.6, 21.8, 3.6), "dbrown", rot=zr(-22.5, (0, 21.4, 3.4)))]


def quiver():
    k = zr(-22.5, (0, 20, 4.6))
    p = [part("body", (-1.4, 14, 3.4), (1.4, 24, 6), "brown", rot=k),
         part("rim", (-1.5, 24, 3.3), (1.5, 24.6, 6.1), "gold", rot=k),
         part("strap", (-4.6, 21, 3.2), (4.6, 21.8, 3.6), "dbrown", rot=zr(22.5, (0, 21.4, 3.4)))]
    for i, x in enumerate((-0.7, 0.1, 0.8)):
        p += [part(f"shaft{i}", (x - 0.15, 24.6, 4.4 + i * 0.4), (x + 0.15, 27.4, 4.7 + i * 0.4), "wood", rot=k),
              part(f"fletch{i}", (x - 0.4, 27, 4.35 + i * 0.4), (x + 0.4, 28.6, 4.75 + i * 0.4),
                   ("red", "white", "red")[i], rot=k)]
    return p


def guitar():
    k = zr(45, (0, 20, 4.8))
    return [part("body", (-2.6, 12, 4.4), (2.6, 17.6, 5.4), "orange", rot=k),
            part("body_top", (-2, 17.6, 4.4), (2, 20, 5.4), "orange", rot=k),
            part("hole", (-0.8, 15.8, 5.4), (0.8, 17.4, 5.45), "black", rot=k),
            part("neck", (-0.5, 20, 4.6), (0.5, 28, 5.2), "dbrown", rot=k),
            part("head", (-0.8, 28, 4.5), (0.8, 30, 5.3), "black", rot=k),
            part("strings", (-0.25, 14, 5.4), (0.25, 28, 5.45), "silver", rot=k),
            part("strap", (-4.6, 21, 3.2), (4.6, 21.8, 3.6), "black", rot=zr(-45, (0, 21.4, 3.4)))]


def round_shield():
    return [part("disc", (-3.6, 16.4, 3.4), (3.6, 24, 4.2), "wood"),
            part("disc_w", (-3, 15.8, 3.45), (3, 24.6, 4.15), "wood"),
            part("rim_t", (-3.7, 23.9, 3.3), (3.7, 24.4, 4.3), "gray"),
            part("rim_b", (-3.7, 16, 3.3), (3.7, 16.5, 4.3), "gray"),
            part("boss", (-1, 19.2, 4.2), (1, 21.2, 4.8), "silver"),
            part("paint_v", (-0.4, 16.5, 4.2), (0.4, 23.9, 4.25), "red"),
            part("paint_h", (-3.5, 19.8, 4.2), (3.5, 20.6, 4.25), "red")]


def hero_cape():
    return [part("cape", (-4, 10, 3.2), (4, 24, 3.6), "red"),
            part("cape_hem", (-4.1, 9.4, 3.15), (4.1, 10.2, 3.65), "gold"),
            part("emblem", (-1.2, 17, 3.6), (1.2, 19.8, 3.65), "gold_l"),
            part("clasp_l", (-4.4, 23.4, -3.4), (-3, 24.6, 3.4), "gold"),
            part("clasp_r", (3, 23.4, -3.4), (4.4, 24.6, 3.4), "gold"),
            G("gem_l", (-4, 23.6, -3.55), (-3.4, 24.4, -3.4), "g_red"),
            G("gem_r", (3.4, 23.6, -3.55), (4, 24.4, -3.4), "g_red")]


def parrot():
    return [part("body", (5.6, 25, -0.9), (7.4, 27.8, 0.9), "red"),
            part("head", (5.7, 27.8, -1.1), (7.3, 29.4, 0.7), "red"),
            part("beak", (6.2, 28.2, -1.7), (6.8, 29, -1.1), "dgray"),
            part("eye", (5.65, 28.6, -0.8), (5.7, 29, -0.4), "black"),
            part("wing", (7.4, 25.4, -0.7), (7.7, 27.6, 0.7), "blue"),
            part("wing2", (5.3, 25.4, -0.7), (5.6, 27.6, 0.7), "blue"),
            part("tail", (6.1, 23, 0.4), (6.9, 25, 1.2), "yellow"),
            part("feet", (5.9, 24.8, -0.6), (7.1, 25.1, 0.6), "dgray")]


def penguin_hat():
    return [part("body", (-2, 32, -1.6), (2, 36, 1.8), "black"),
            part("belly", (-1.4, 32.2, -1.65), (1.4, 35.2, -1.6), "white"),
            part("head", (-1.6, 36, -1.4), (1.6, 38.2, 1.6), "black"),
            part("face", (-1.2, 36.3, -1.45), (1.2, 37.8, -1.4), "white"),
            part("beak", (-0.4, 36.8, -2.2), (0.4, 37.2, -1.4), "orange"),
            part("eye_l", (-0.9, 37.2, -1.5), (-0.5, 37.6, -1.45), "black"),
            part("eye_r", (0.5, 37.2, -1.5), (0.9, 37.6, -1.45), "black"),
            part("flip_l", (-2.4, 33, -0.8), (-2, 35.4, 0.8), "black", rot=zr(-22.5, (-2.2, 35.4, 0))),
            part("flip_r", (2, 33, -0.8), (2.4, 35.4, 0.8), "black", rot=zr(22.5, (2.2, 35.4, 0))),
            part("feet", (-1.4, 32, -2.2), (1.4, 32.3, -1.2), "orange")]


def slime_hat():
    return [part("outer", (-3.2, 32, -3.2), (3.2, 38.4, 3.2), "slime"),
            part("core", (-1.8, 33.4, -1.8), (1.8, 37, 1.8), "slime_d"),
            part("eye_l", (-2, 35.6, -3.25), (-0.8, 36.8, -3.2), "black"),
            part("eye_r", (0.8, 35.6, -3.25), (2, 36.8, -3.2), "black"),
            part("mouth", (-0.6, 34, -3.25), (0.6, 34.6, -3.2), "slime_d"),
            G("shine", (-2.8, 37.4, -3.25), (-2, 38, -3.2), "g_white")]


def bee_orbit():
    p = []
    for i, (x, y, z) in enumerate(((5.6, 32, -1), (-4, 34.4, 4), (-2, 33.4, -5.4))):
        p += [part(f"bee{i}", (x - 0.8, y, z - 0.6), (x + 0.8, y + 1.2, z + 0.6), "yellow"),
              part(f"stripe{i}", (x - 0.2, y - 0.02, z - 0.62), (x + 0.2, y + 1.22, z + 0.62), "black"),
              part(f"wing{i}", (x - 0.4, y + 1.2, z - 0.2), (x + 0.4, y + 1.7, z + 0.6), "white"),
              part(f"sting{i}", (x + 0.8, y + 0.4, z - 0.15), (x + 1.2, y + 0.7, z + 0.15), "black")]
    p.append(G("trail", (4.6, 32.4, 1), (4.8, 32.6, 2.6), "g_yellow"))
    return p


def axolotl_hat():
    p = [part("body", (-1.4, 32, -2), (1.4, 33.6, 3.6), "axo"),
         part("head", (-2, 32, -4.4), (2, 34.2, -1.8), "axo"),
         part("tail", (-0.3, 32.2, 3.6), (0.3, 33.8, 6.2), "axo_d"),
         part("eye_l", (-1.6, 33.2, -4.45), (-1, 33.8, -4.4), "black"),
         part("eye_r", (1, 33.2, -4.45), (1.6, 33.8, -4.4), "black"),
         part("mouth", (-0.6, 32.5, -4.45), (0.6, 32.7, -4.4), "axo_d")]
    p += mirror([part("gill0", (2, 33.8, -3.8), (3.4, 34.2, -3.4), "axo_d", rot=zr(-22.5, (2, 34, -3.6))),
                 part("gill1", (2, 33.1, -3.2), (3.6, 33.5, -2.8), "axo_d"),
                 part("gill2", (2, 32.4, -2.6), (3.4, 32.8, -2.2), "axo_d", rot=zr(22.5, (2, 32.6, -2.4))),
                 part("leg", (1.4, 32, -1.6), (2.4, 32.5, -0.8), "axo"),
                 part("leg2", (1.4, 32, 2), (2.4, 32.5, 2.8), "axo")])
    return p


def traffic_cone():
    return [part("base", (-4.4, 32, -4.4), (4.4, 32.6, 4.4), "orange_d"),
            part("c0", (-3, 32.6, -3), (3, 34.2, 3), "orange"),
            part("s0", (-2.5, 34.2, -2.5), (2.5, 35.2, 2.5), "white"),
            part("c1", (-2, 35.2, -2), (2, 36.8, 2), "orange"),
            part("s1", (-1.5, 36.8, -1.5), (1.5, 37.6, 1.5), "white"),
            part("c2", (-1, 37.6, -1), (1, 39, 1), "orange")]


def shark_fin():
    return [part("fin0", (-0.4, 32, -1.6), (0.4, 34, 2.4), "shark"),
            part("fin1", (-0.35, 34, -0.2), (0.35, 36, 2.6), "shark", rot=xr(22.5, (0, 34, 1))),
            part("fin2", (-0.3, 35.6, 1.6), (0.3, 37, 3.4), "shark_d", rot=xr(45, (0, 35.6, 2.4))),
            part("belly", (-0.42, 32, 1.8), (0.42, 33, 2.6), "white"),
            part("wave_n", (-3, 32, -3.6), (3, 32.4, -3.2), "g_blue", glow=True),
            part("wave_s", (-3, 32, 3.2), (3, 32.4, 3.6), "g_blue", glow=True)]


def wizard_hat():
    return [part("brim", (-6.6, 32, -6.6), (6.6, 32.4, 6.6), "navy"),
            part("c0", (-4, 32.4, -4), (4, 34.4, 4), "navy"),
            part("band", (-4.05, 32.4, -4.05), (4.05, 33.2, 4.05), "gold"),
            part("c1", (-3, 34.4, -3), (3, 36.4, 3), "navy"),
            part("c2", (-2, 36.2, -2), (2, 38.2, 2), "blue", rot=xr(-22.5, (0, 36.4, 0))),
            part("c3", (-1.2, 37.6, -3.6), (1.2, 39.6, -1.2), "blue", rot=xr(-45, (0, 37.8, -2))),
            G("star0", (-2.4, 34.4, -4.05), (-1.4, 35.4, -4.0), "g_yellow", rot=zr(45, (-1.9, 34.9, -4))),
            G("star1", (1.6, 35.6, -3.05), (2.4, 36.4, -3.0), "g_yellow", rot=zr(45, (2, 36, -3))),
            G("moon", (3.95, 33.6, -1), (4.05, 35, 0.4), "g_white"),
            G("tip", (-0.4, 37.8, -5.4), (0.4, 38.6, -4.6), "g_yellow")]


def crystal_crown():
    p = ring("band", 31.8, 32.6, "silver", r=4.7, t=0.4)
    for i, (x, z, h, m) in enumerate(((0, -4.6, 3.4, "purple"), (-2.6, -4.5, 2.2, "magenta"), (2.6, -4.5, 2.2, "magenta"),
                                      (4.6, -1.4, 2.6, "purple"), (-4.6, -1.4, 2.6, "purple"), (4.6, 2, 1.8, "magenta"),
                                      (-4.6, 2, 1.8, "magenta"), (0, 4.6, 2.4, "purple"))):
        p.append(part(f"crystal{i}", (x - 0.5, 32.6, z - 0.5), (x + 0.5, 32.6 + h, z + 0.5), m, rot=yr(45, (x, 33, z))))
        p.append(G(f"tip{i}", (x - 0.25, 32.6 + h, z - 0.25), (x + 0.25, 33.3 + h, z + 0.25), "g_purple",
                   rot=yr(45, (x, 33, z))))
    return p


def ghost_buddy():
    return [part("head", (4.4, 32.4, -1.4), (7.2, 35.4, 1.4), "ghost"),
            part("sheet", (4.2, 30.6, -1.6), (7.4, 32.4, 1.6), "ghost"),
            part("tail0", (4.2, 30, -1.6), (5.2, 30.6, 1.6), "ghost_d"),
            part("tail1", (6.4, 30, -1.6), (7.4, 30.6, 1.6), "ghost_d"),
            part("eye_l", (4.9, 33.6, -1.45), (5.5, 34.4, -1.4), "black"),
            part("eye_r", (6.1, 33.6, -1.45), (6.7, 34.4, -1.4), "black"),
            part("mouth", (5.5, 32.6, -1.45), (6.1, 33.2, -1.4), "black"),
            G("glow", (4.3, 35.4, -1.3), (7.3, 35.5, 1.3), "g_white")]


COSMETICS = [
    ("royal_crown", "&6Royal Crown", "Heavy is the head.", royal_crown),
    ("tiara", "&bTiara", "Sparkles in any light.", tiara),
    ("sheriff_hat", "&8Sheriff Hat", "There's a new sheriff in town.", sheriff_hat),
    ("beanie", "&cCozy Beanie", "Warm ears, warm heart.", beanie),
    ("baseball_cap", "&9Baseball Cap", "Home run.", baseball_cap),
    ("chef_hat", "&fChef Hat", "Let him cook.", chef_hat),
    ("party_hat", "&dParty Hat", "Every day is a party.", party_hat),
    ("sombrero", "&eSombrero", "Shade for the whole team.", sombrero),
    ("fez", "&cFez", "Fezzes are cool.", fez),
    ("grad_cap", "&8Graduation Cap", "Finally graduated from the tutorial.", grad_cap),
    ("santa_hat", "&cSanta Hat", "Ho ho ho.", santa_hat),
    ("propeller_cap", "&eProp Cap", "Does not actually fly. We checked.", propeller_cap),
    ("jester_hat", "&5Jester Hat", "Jingle jingle.", jester_hat),
    ("fox_ears", "&6Fox Ears", "What does the fox say?", fox_ears),
    ("bear_ears", "&6Bear Ears", "Soft and round.", bear_ears),
    ("frog_hat", "&aFrog Friend", "Ribbit.", frog_hat),
    ("duck_hat", "&eDuck Buddy", "Quack.", duck_hat),
    ("cat_nap", "&6Cat Nap", "It chose you. You live here now.", cat_nap),
    ("unicorn_horn", "&dUnicorn Horn", "Totally real.", unicorn_horn),
    ("reindeer_antlers", "&6Reindeer Antlers", "Dashing through the snow.", reindeer_antlers),
    ("flower_crown", "&dFlower Crown", "Freshly picked.", flower_crown),
    ("laurel_wreath", "&6Laurel Wreath", "For the victor.", laurel_wreath),
    ("sunglasses", "&5Shades", "Deal with it.", sunglasses),
    ("aviator_goggles", "&6Aviator Goggles", "Ready for take-off.", aviator_goggles),
    ("miner_lamp", "&eMiner Helmet", "Light the way down.", miner_lamp),
    ("bowler_monocle", "&8Gentleman", "Quite, quite.", bowler_monocle),
    ("rain_cloud", "&7Rain Cloud", "Your own personal weather.", rain_cloud),
    ("rainbow_halo", "&dRainbow Arc", "Somewhere over it.", rainbow_halo),
    ("saturn", "&6Tiny Saturn", "Your head has its own orbit now.", saturn),
    ("ice_halo", "&bIce Halo", "Cold as ice.", ice_halo),
    ("music_notes", "&dMusic Notes", "Always vibing.", music_notes),
    ("butterfly_wings", "&9Butterfly Wings", "Float like one.", butterfly_wings),
    ("fairy_wings", "&bFairy Wings", "Glows at night.", fairy_wings),
    ("jetpack", "&7Jetpack", "Fuel not included.", jetpack),
    ("backpack", "&6Adventurer Pack", "Ready for anything.", backpack),
    ("greatsword_back", "&fGreatsword", "Mostly for show.", greatsword_back),
    ("quiver", "&6Quiver", "Always three arrows short.", quiver),
    ("guitar", "&6Guitar", "Wonderwall, anyone?", guitar),
    ("round_shield", "&cRound Shield", "Painted for battle.", round_shield),
    ("hero_cape", "&cHero Cape", "Not all heroes wear capes. You do.", hero_cape),
    ("parrot", "&cShoulder Parrot", "Polly wants a diamond.", parrot),
    ("penguin_hat", "&8Penguin Pal", "Waddle waddle.", penguin_hat),
    ("slime_hat", "&aSlime Hat", "Squishy.", slime_hat),
    ("bee_orbit", "&eBee Swarm", "Bzzzz.", bee_orbit),
    ("axolotl_hat", "&dAxolotl Buddy", "Smiling, always.", axolotl_hat),
    ("traffic_cone", "&6Traffic Cone", "Caution: very cool.", traffic_cone),
    ("shark_fin", "&7Shark Fin", "Dun dun. Dun dun.", shark_fin),
    ("wizard_hat", "&9Wizard Hat", "You're a wizard.", wizard_hat),
    ("crystal_crown", "&5Crystal Crown", "Grown, not made.", crystal_crown),
    ("ghost_buddy", "&fGhost Buddy", "Boo.", ghost_buddy),
]


def build(base, write, animate, mcmeta):
    img, sw = atlas()
    write(f"{base}/textures/item/cosmetics/parts.png", animate(img, GLOW))
    write(f"{base}/textures/item/cosmetics/parts.png.mcmeta", mcmeta)
    ref = f"{NS}:item/cosmetics/parts"
    items, ids, out = [], [], {}
    for cid, name, flavour, fn in COSMETICS:
        parts = AE.resolve(fn(), sw)
        out[cid] = (name, parts)
        write(f"{base}/models/item/cosmetics/{cid}.json", AE.hat_model(parts, ref, 0.6))
        ids.append(cid)
        items.append(f"""  {cid}:
    enabled: true
    display_name: '{name}'
    lore:
      - '&f'
      - '&7{AE.esc(flavour)}'
      - '&f'
      - '&dWebstore Exclusive'
      - '&8Cosmetic - no stats'
    permission: {NS}.{cid}
    behaviours:
      hat: true
    resource:
      material: PAPER
      generate: false
      model_path: item/cosmetics/{cid}""")
    write(f"{base}/configs/items.yml", f"""info:
  namespace: {NS}
items:
{chr(10).join(items)}
""")
    write(f"{base}/configs/categories.yml", f"""info:
  namespace: {NS}
categories:
  webstore_cosmetics:
    enabled: true
    name: '&dWebstore Cosmetics'
    icon: {NS}:royal_crown
    permission: ia.menu.webstore_cosmetics
    items:
""" + "".join(f"      - {NS}:{i}\n" for i in ids))
    return img, out
