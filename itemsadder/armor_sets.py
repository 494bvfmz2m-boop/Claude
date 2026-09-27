"""The themed armor sets. Each entry: palette, surface patterns, painted art,
a head-worn 3D helmet (with shoulder/back extensions), stats, recipe, lore.
Stats sit around diamond level, each with one small perk."""
from armor_engine import mirror, part


def D(armor, dura, toughness, extra=None):
    return {"armor": dict(zip(("helmet", "chestplate", "leggings", "boots"), zip(armor, dura))),
            "toughness": toughness, "extra": extra or {}}


DIAMOND_DURA = (363, 528, 495, 429)
IRONISH_DURA = (220, 320, 300, 260)


# ----------------------------------------------------------------------------- helmets
# Open designs: nothing covers the face, and the head stays mostly visible.
# Player space: the head is x -4..4, y 24..32, z -4..4 (front is -z).
def ring(name, y0, y1, mat, r=4.6, t=0.45, front=True, z_front=None):
    """A slim band around the head (back, two sides and optionally the front)."""
    zf = -r if z_front is None else z_front
    p = [part(name + "_b", (-r, y0, r - t), (r, y1, r), mat)]
    p += mirror([part(name + "_s", (r - t, y0, zf), (r, y1, r), mat)])
    if front:
        p.append(part(name + "_f", (-r, y0, -r - 0.05), (r, y1, -r + t), mat))
    return p


def zr(ang, o):
    return ("z", ang, o)


def xr(ang, o):
    return ("x", ang, o)


def yr(ang, o):
    return ("y", ang, o)


def frostborn():
    p = ring("circlet", 29.2, 30.1, "t")
    p += [part("gem", (-0.7, 29.3, -4.95), (0.7, 30.7, -4.55), "a"),
          part("gem_core", (-0.3, 29.7, -5.0), (0.3, 30.3, -4.95), "g", glow=True),
          part("crown", (-0.45, 30.1, -4.85), (0.45, 33, -4.4), "l"),
          part("crown_tip", (-0.25, 33, -4.75), (0.25, 34, -4.5), "g", glow=True)]
    p += mirror([part("spike", (1.6, 30.1, -4.85), (2.3, 32, -4.4), "a", rot=zr(-22.5, (1.95, 30.1, -4.6))),
                 part("horn_mount", (4.3, 29, -0.7), (5.4, 30.6, 0.7), "t2"),
                 part("horn0", (4.8, 30, -0.55), (5.9, 33, 0.55), "l", rot=zr(-45, (5.35, 30, 0))),
                 part("horn1", (6.85, 31.8, -0.45), (7.75, 34.8, 0.45), "a", rot=zr(-22.5, (7.3, 31.8, 0))),
                 part("horn2", (8.05, 34.2, -0.35), (8.85, 36.4, 0.35), "g", glow=True),
                 part("frost", (5.2, 25, -1.6), (8.4, 25.5, 1.6), "b"),
                 part("spire", (6.2, 25.5, -0.4), (7, 28.4, 0.4), "a"),
                 part("spire_tip", (6.35, 28.4, -0.25), (6.85, 29.6, 0.25), "g", glow=True),
                 part("spire2", (7.4, 25.5, 0.5), (8, 27.4, 1.1), "l", rot=zr(-22.5, (7.7, 25.5, 0.8))),
                 part("spire3", (5.4, 25.5, -1.3), (5.9, 26.9, -0.8), "l")])
    return p


def druid():
    p = ring("band", 28.8, 29.7, "b")
    p += [part("leaf_f0", (-2.6, 29.4, -5.0), (-1.3, 30.3, -4.6), "s1"),
          part("leaf_f1", (1.2, 29.2, -5.0), (2.3, 30.0, -4.6), "s2"),
          part("flower", (-0.5, 29.3, -5.1), (0.5, 30.3, -4.7), "a"),
          part("flower_core", (-0.2, 29.6, -5.15), (0.2, 30.0, -5.1), "g", glow=True)]
    p += mirror([part("antler0", (3.9, 29.6, -1.9), (4.7, 32.6, -1.1), "d", rot=zr(-22.5, (4.3, 29.6, -1.5))),
                 part("antler1", (5.0, 32.2, -1.9), (5.8, 35.2, -1.1), "d", rot=zr(-22.5, (5.4, 32.2, -1.5))),
                 part("tine0", (5.5, 33.0, -1.85), (7.8, 33.7, -1.15), "b", rot=zr(22.5, (5.5, 33.35, -1.5))),
                 part("tine1", (6.2, 34.6, -1.8), (6.9, 36.8, -1.2), "b"),
                 part("tine2", (6.3, 35.4, -1.8), (8.4, 36.0, -1.2), "m", rot=zr(22.5, (6.3, 35.7, -1.5))),
                 part("leaf0", (7.2, 34.0, -2.1), (8.2, 34.5, -0.9), "s1"),
                 part("leaf1", (7.9, 36.4, -2.0), (8.9, 36.9, -1.0), "s2"),
                 part("bloom", (6.1, 36.8, -1.8), (6.9, 37.4, -1.2), "a"),
                 part("vine_back", (2.2, 23.5, 4.35), (2.7, 29, 4.85), "t2"),
                 part("vine_leaf", (2.7, 25.6, 4.4), (3.7, 26.1, 4.9), "s1"),
                 part("vine_sh", (4.6, 25, -0.4), (8.6, 25.5, 0.4), "t2"),
                 part("leaf_sh", (6, 25.5, -1.2), (7.2, 26, 0), "s1"),
                 part("bloom_sh", (7.6, 25.5, 0.2), (8.3, 26.2, 0.9), "a"),
                 part("sprout", (5.2, 25.5, 0.6), (5.6, 27, 1.0), "s2")])
    return p


def samurai():
    p = ring("bowl", 30.8, 32.2, "d", r=4.7)
    p += [part("bowl_top", (-4.4, 32.2, -4.4), (4.4, 32.9, 4.4), "m"),
          part("tehen", (-0.6, 32.9, -0.6), (0.6, 33.4, 0.6), "t"),
          part("brim", (-4.7, 30.7, -6.0), (4.7, 31.1, -4.6), "a", rot=xr(-22.5, (0, 30.9, -4.6))),
          part("maedate", (-0.9, 31.4, -5.0), (0.9, 32.4, -4.7), "t"),
          part("pole", (-0.25, 20, 4.6), (0.25, 38, 5.0), "s1"),
          part("flag", (0.25, 31, 4.72), (4.5, 37.5, 4.88), "s2"),
          part("flag_mon", (1.6, 33.4, 4.88), (3.1, 34.9, 4.93), "m")]
    for i, (mat, r) in enumerate((("m", 4.8), ("b", 5.25), ("d", 5.7))):   # stepped neck guard
        y1 = 30.8 - 1.2 * i
        p.append(part(f"shikoro{i}_b", (-r, y1 - 1.2, r - 0.4), (r, y1, r), mat))
        p += mirror([part(f"shikoro{i}_s", (r - 0.4, y1 - 1.2, -1.2 + 0.4 * i), (r, y1, r), mat)])
    p += mirror([part("horn0", (0.6, 32.2, -4.95), (1.1, 34.8, -4.65), "t", rot=zr(-22.5, (0.85, 32.2, -4.8))),
                 part("horn1", (1.6, 34.6, -4.95), (2.05, 37, -4.65), "t", rot=zr(-45, (1.8, 34.6, -4.8))),
                 part("horn_tip", (3.3, 36.2, -4.95), (3.8, 36.9, -4.65), "g", glow=True),
                 part("fuki", (4.5, 30.2, -4.9), (5.4, 32.2, -3.4), "t"),
                 part("sode_strap", (4.8, 25, -0.5), (9.4, 25.5, 0.5), "t"),
                 part("sode0", (9.1, 23.2, -2.3), (9.5, 25.4, 2.3), "m"),
                 part("sode1", (9.3, 21.2, -2.3), (9.7, 23.2, 2.3), "b"),
                 part("sode2", (9.5, 19.2, -2.3), (9.9, 21.2, 2.3), "d")])
    return p


def pharaoh():
    p = [part("cap", (-4.6, 32, -4.3), (4.6, 32.6, 4.6), "pat_stripes"),
         part("brow", (-4.6, 30.8, -4.9), (4.6, 32, -4.45), "t"),
         part("back", (-4.6, 26, 4.5), (4.6, 32.2, 5.0), "pat_stripes"),
         part("braid", (-0.6, 20, 4.6), (0.6, 26, 5.2), "t"),
         part("braid_tip", (-0.7, 19.4, 4.5), (0.7, 20, 5.3), "a"),
         part("cobra_body", (-0.3, 32, -5.1), (0.3, 33.8, -4.7), "t"),
         part("cobra_hood", (-0.9, 33.4, -5.3), (0.9, 34.8, -4.95), "a"),
         part("cobra_eye", (-0.5, 33.9, -5.35), (0.5, 34.2, -5.3), "g", glow=True),
         part("collar_f", (-3, 24.4, -3.4), (3, 25.4, -3.05), "a")]
    p += mirror([part("cloth", (4.5, 27, -3.8), (5.0, 32.2, 4.6), "pat_stripes"),
                 part("lappet", (4.4, 20, -4.4), (5.3, 27, -3.9), "pat_stripes"),
                 part("lappet_end", (4.3, 19.4, -4.5), (5.4, 20, -3.8), "t"),
                 part("collar_s", (4.4, 25, -2.4), (8.2, 25.4, 2.4), "t"),
                 part("collar_bead", (3.0, 24.4, -3.45), (4.4, 25.4, -3.05), "t"),
                 part("collar_gem", (6.6, 25.4, -0.5), (7.4, 25.7, 0.5), "g", glow=True)])
    return p


def atlantean():
    p = ring("circlet", 29.4, 30.2, "s1")
    p += [part("pearl", (-0.6, 29.5, -5.1), (0.6, 30.7, -4.6), "a"),
          part("pearl_glow", (-0.25, 29.85, -5.15), (0.25, 30.35, -5.1), "g", glow=True),
          part("fin0", (-0.2, 32, -3), (0.2, 33.2, 2), "t"),
          part("fin1", (-0.2, 32.6, -1.2), (0.2, 35.4, 0.6), "t2", rot=xr(22.5, (0, 32.6, 0))),
          part("fin2", (-0.2, 32.6, 1.2), (0.2, 34.6, 2.8), "t", rot=xr(45, (0, 32.6, 2)))]
    p += mirror([part("coral0", (1.4, 30.2, -4.9), (1.9, 32.4, -4.5), "t", rot=zr(-22.5, (1.65, 30.2, -4.7))),
                 part("coral1", (1.9, 31.2, -4.9), (3.0, 31.6, -4.5), "t", rot=zr(22.5, (1.9, 31.4, -4.7))),
                 part("coral2", (2.8, 30.2, -4.9), (3.2, 31.4, -4.5), "t2"),
                 part("earfin0", (4.6, 28.2, -0.2), (5.0, 30.6, 2.4), "t", rot=yr(22.5, (4.8, 29, -0.2))),
                 part("earfin1", (4.7, 29.6, 1.6), (5.1, 31.8, 3.4), "t2", rot=yr(22.5, (4.9, 29.6, 1.6))),
                 part("shell", (5.6, 25, -1.3), (7.8, 26.4, 1.3), "s2"),
                 part("shell_top", (6.0, 26.4, -0.9), (7.4, 27.2, 0.9), "s1"),
                 part("shell_glow", (7.8, 25.3, -0.5), (7.95, 26.1, 0.5), "g", glow=True),
                 part("sprig", (4.8, 25, 1.4), (5.3, 27.4, 1.9), "t"),
                 part("sprig2", (5.3, 26.2, 1.4), (6.4, 26.6, 1.9), "t"),
                 part("bcoral", (1, 22.5, 4.4), (1.5, 27.5, 4.9), "t"),
                 part("bcoral2", (1.5, 25, 4.4), (2.8, 25.5, 4.9), "t2")])
    return p


def paladin():
    p = ring("band", 31, 32, "t", r=4.7)
    p += [part("cap", (-4.6, 32, -4.6), (4.6, 32.6, 4.6), "m"),
          part("ridge", (-0.5, 32.6, -4), (0.5, 33.2, 4), "t"),
          part("cross", (-0.3, 30.4, -5.0), (0.3, 32.8, -4.75), "t"),
          part("cross_gem", (-0.35, 31.2, -5.05), (0.35, 31.8, -5.0), "g", glow=True),
          part("plume0", (-0.4, 33, 0), (0.4, 36, 1.2), "a", rot=xr(22.5, (0, 33, 0.6))),
          part("plume1", (-0.4, 33, 1.5), (0.4, 35.6, 2.7), "a", rot=xr(45, (0, 33, 2.1))),
          part("plume2", (-0.35, 31.8, 3.4), (0.35, 34, 4.6), "a", rot=xr(45, (0, 32, 4)))]
    p += mirror([part("wing0", (4.75, 30, -0.6), (5.15, 33.6, 0.4), "s1"),
                 part("wing1", (4.75, 30, 0.4), (5.15, 33.2, 1.4), "s2", rot=xr(22.5, (4.95, 30, 0.9))),
                 part("wing2", (4.75, 30, 1.2), (5.15, 32.6, 2.2), "s1", rot=xr(45, (4.95, 30, 1.7))),
                 part("pauldron", (4.6, 25, -2.8), (9.2, 25.6, 2.8), "m"),
                 part("pauldron_edge", (8.7, 23.6, -2.8), (9.4, 25.6, 2.8), "t"),
                 part("pauldron_trim", (5.2, 25.6, -2.2), (8.4, 26.1, 2.2), "t"),
                 part("pauldron_gem", (6.4, 26.1, -0.5), (7.2, 26.5, 0.5), "g", glow=True)])
    return p


def clockwork():
    p = ring("strap", 29.8, 30.6, "a")
    p += [part("bridge", (-0.7, 30.8, -5.0), (0.7, 31.3, -4.7), "t2"),
          # brass gear on the right temple
          part("gear", (4.6, 28.2, -1.6), (5.1, 31.2, 1.4), "t"),
          part("gear_t0", (4.65, 31.2, -0.5), (5.05, 31.8, 0.4), "t2"),
          part("gear_t1", (4.65, 27.6, -0.5), (5.05, 28.2, 0.4), "t2"),
          part("gear_t2", (4.65, 29.2, -2.2), (5.05, 30.2, -1.6), "t2"),
          part("gear_t3", (4.65, 29.2, 1.4), (5.05, 30.2, 2.0), "t2"),
          part("gear_hub", (5.1, 29.3, -0.5), (5.2, 30.1, 0.3), "g", glow=True),
          # antenna earpiece on the left
          part("earpiece", (-5.1, 28.6, -0.8), (-4.6, 30.4, 1.0), "s2"),
          part("antenna", (-5.0, 30.4, 0), (-4.7, 33.5, 0.3), "s1"),
          part("antenna_bulb", (-5.15, 33.5, -0.15), (-4.55, 34.1, 0.45), "g", glow=True)]
    p += mirror([part("goggle", (0.7, 30, -5.3), (3.2, 32.2, -4.6), "t"),
                 part("lens", (1.1, 30.4, -5.4), (2.8, 31.8, -5.25), "g", glow=True),
                 part("pipe", (1.4, 22, 4.4), (2.2, 31, 5.2), "s2"),
                 part("valve", (1.1, 27, 4.2), (2.5, 27.6, 5.4), "t"),
                 part("exhaust", (1.2, 31, 4.2), (2.4, 31.6, 5.4), "t2"),
                 part("ember", (1.5, 31.6, 4.5), (2.1, 31.7, 5.1), "g", glow=True),
                 part("sgear", (5.2, 25, -1.6), (8.2, 25.4, 1.6), "t"),
                 part("sgear_t0", (6.3, 25, -2.3), (7.1, 25.35, 2.3), "t2"),
                 part("sgear_t1", (4.6, 25, -0.4), (8.8, 25.35, 0.4), "t2"),
                 part("sgear_hub", (6.2, 25.4, -0.5), (7.2, 25.9, 0.5), "a"),
                 part("sgear_core", (6.45, 25.9, -0.25), (6.95, 26.0, 0.25), "g", glow=True)])
    return p


def shadow():
    k1 = zr(45, (0, 22, 5.2))
    k2 = zr(-45, (0, 22, 5.6))
    p = [part("hood_top", (-4.7, 32, -3.6), (4.7, 32.6, 4.7), "b"),
         part("hood_back", (-4.7, 24.5, 4.4), (4.7, 32.4, 5.0), "b"),
         part("hood_brow", (-4.7, 31.4, -4.9), (4.7, 32.4, -4.0), "d"),
         part("mask", (-4.7, 24.2, -4.9), (4.7, 26.6, -4.45), "a"),
         part("tail0", (1, 19.5, 4.4), (2.2, 23.4, 4.9), "t", rot=zr(22.5, (1.6, 23.4, 4.65))),
         part("tail1", (2.6, 16.3, 4.5), (3.6, 19.8, 5.0), "t2", rot=zr(22.5, (3.1, 19.8, 4.75))),
         part("katana1_blade", (-0.25, 13, 5.05), (0.25, 28, 5.35), "s1", rot=k1),
         part("katana1_tsuba", (-0.9, 28, 5.0), (0.9, 28.5, 5.4), "a", rot=k1),
         part("katana1_hilt", (-0.35, 28.5, 5.05), (0.35, 31.5, 5.35), "t2", rot=k1),
         part("katana2_blade", (-0.25, 13, 5.45), (0.25, 28, 5.75), "s1", rot=k2),
         part("katana2_tsuba", (-0.9, 28, 5.4), (0.9, 28.5, 5.8), "a", rot=k2),
         part("katana2_hilt", (-0.35, 28.5, 5.45), (0.35, 31.5, 5.75), "t2", rot=k2)]
    p += ring("scarf", 23.4, 24.4, "t")
    p += mirror([part("hood_side", (4.5, 26, -3.8), (5.0, 32.4, 4.6), "d"),
                 part("mask_side", (4.45, 24.2, -4.9), (4.9, 26.6, -2), "a"),
                 part("wrap", (4.6, 25, -2.6), (8.8, 25.4, 2.6), "b"),
                 part("wrap_trim", (8.4, 24, -2.6), (8.9, 25.4, 2.6), "t")])
    return p


def dragon():
    p = ring("brow", 30.8, 32, "b", r=4.7)
    p += [part("skull", (-4.6, 32, -4), (4.6, 32.8, 4.6), "pat_scale"),
          part("snout", (-2.2, 31.6, -7.2), (2.2, 33.4, -4.4), "m"),
          part("snout_ridge", (-1.6, 33.4, -6.8), (1.6, 33.9, -4.4), "b"),
          part("spine0", (-0.25, 29.5, 4.6), (0.25, 31.2, 5.9), "s1"),
          part("spine1", (-0.25, 26.5, 4.6), (0.25, 28.2, 5.7), "s2"),
          part("spine2", (-0.25, 21.5, 3.1), (0.25, 23.2, 4.6), "s1"),
          part("spine3", (-0.25, 17.5, 3.1), (0.25, 19.2, 4.4), "s2"),
          part("crest", (-0.25, 32.8, -3), (0.25, 33.8, 2), "s1")]
    p += mirror([part("fang", (1.4, 30.4, -7.0), (1.9, 31.6, -6.5), "a"),
                 part("fang2", (0.3, 30.8, -7.1), (0.7, 31.6, -6.7), "a"),
                 part("nostril", (0.6, 32.6, -7.25), (1.4, 33.1, -7.2), "g", glow=True),
                 part("eye", (2.4, 32.2, -4.95), (3.8, 32.8, -4.7), "g", glow=True),
                 part("horn0", (3, 32.4, -0.5), (4.2, 33.8, 2.2), "t"),
                 part("horn1", (3.2, 33.2, 2), (4.2, 34.4, 5), "t", rot=xr(-22.5, (3.7, 33.8, 2))),
                 part("horn2", (3.4, 34.45, 4.77), (4.1, 35.45, 7.4), "t2", rot=xr(-45, (3.75, 34.95, 4.77))),
                 part("horn3", (3.55, 36.3, 6.2), (3.95, 37.6, 6.8), "t2"),
                 part("frill0", (4.6, 28, 0.5), (5.0, 31, 2.8), "s1", rot=yr(22.5, (4.8, 29, 0.5))),
                 part("frill1", (4.7, 28.6, 2.4), (5.1, 30.6, 4.0), "s2", rot=yr(22.5, (4.9, 29, 2.4))),
                 part("wing_arm", (1.2, 25, 3.3), (7.5, 25.6, 3.8), "t", rot=zr(22.5, (1.2, 25.3, 3.55))),
                 part("wing_finger", (6.8, 21.5, 3.35), (7.3, 27.7, 3.75), "t", rot=zr(22.5, (7.05, 27.7, 3.55))),
                 part("wing_claw", (6.8, 27.6, 3.35), (7.4, 28.8, 3.75), "a"),
                 part("wing_mem", (1.4, 21.5, 3.45), (6.8, 25.6, 3.65), "m"),
                 part("wing_mem2", (6.6, 22.4, 3.45), (8.2, 27, 3.65), "b", rot=zr(22.5, (7.05, 27.7, 3.55)))])
    return p


def mushroom():
    p = [part("stalk", (-1.2, 32, -1.2), (1.2, 32.6, 1.2), "l"),
         part("gills", (-5.2, 32.6, -5.2), (5.2, 33, 5.2), "l"),
         part("cap0", (-5.6, 33, -5.6), (5.6, 34.3, 5.6), "pat_cap"),
         part("cap1", (-4.2, 34.3, -4.2), (4.2, 35.3, 4.2), "pat_cap"),
         part("cap2", (-2.4, 35.3, -2.4), (2.4, 35.9, 2.4), "pat_cap"),
         part("glow_stem", (-0.3, 29.8, 4.5), (0.3, 30.6, 5.0), "l"),
         part("glow_cap", (-0.7, 30.6, 4.3), (0.7, 31.1, 5.2), "g", glow=True)]
    p += ring("moss", 29.2, 29.8, "s2")
    p += mirror([part("m_stem", (4.5, 29.8, -2.2), (5.0, 30.8, -1.7), "l"),
                 part("m_cap", (4.3, 30.8, -2.5), (5.3, 31.4, -1.4), "t"),
                 part("f_stem", (1.8, 29.8, -4.95), (2.3, 30.6, -4.55), "l"),
                 part("f_cap", (1.5, 30.6, -5.1), (2.6, 31.1, -4.4), "t2"),
                 part("sh_moss", (5.2, 25, -1.6), (8.2, 25.4, 1.6), "s2"),
                 part("sh_stem", (6.2, 25.4, -0.4), (6.9, 27, 0.3), "l"),
                 part("sh_cap", (5.5, 27, -1.1), (7.6, 27.8, 1.0), "t"),
                 part("sh_stem2", (7.5, 25.4, 0.8), (7.9, 26.2, 1.2), "l"),
                 part("sh_cap2", (7.2, 26.2, 0.5), (8.2, 26.6, 1.5), "t2")])
    return p


def halloween():
    """Witch hat with a carved pumpkin on the brim; bat wings and shoulder pumpkins."""
    p = [part("brim", (-6.2, 31.4, -6.2), (6.2, 32, 6.2), "t2"),
         part("band", (-4.4, 32, -4.4), (4.4, 33, 4.4), "b"),
         part("buckle", (-0.8, 32.1, -4.5), (0.8, 32.9, -4.4), "g", glow=True),
         part("cone0", (-3.8, 33, -3.8), (3.8, 35, 3.8), "t"),
         part("cone1", (-2.8, 35, -2.8), (2.8, 37, 2.8), "t"),
         part("cone2", (-1.8, 36.8, -1.8), (1.8, 38.8, 1.8), "t2", rot=xr(22.5, (0, 37, 0))),
         part("cone3", (-1, 38.4, 1), (1, 40.2, 3), "t2", rot=xr(45, (0, 38.6, 1.6))),
         part("pumpkin", (2.8, 32, -5.4), (5, 34, -3.2), "pat_pumpkin"),
         part("pk_eye0", (3.2, 33.1, -5.45), (3.6, 33.5, -5.4), "g", glow=True),
         part("pk_eye1", (4.2, 33.1, -5.45), (4.6, 33.5, -5.4), "g", glow=True),
         part("pk_mouth", (3.2, 32.4, -5.45), (4.6, 32.8, -5.4), "g", glow=True),
         part("pk_stem", (3.7, 34, -4.5), (4.1, 34.6, -4.1), "s1"),
         part("back_bone", (1.2, 25.6, 3.4), (7, 26.1, 3.8), "o", rot=zr(22.5, (1.2, 25.85, 3.6))),
         part("back_mem", (1.3, 22.4, 3.5), (6.2, 25.8, 3.7), "t2")]
    p[-2:] = mirror(p[-2:])
    p += mirror([part("bat_bone", (4.4, 32.2, 0), (7.4, 32.6, 0.4), "o", rot=zr(22.5, (4.4, 32.4, 0.2))),
                 part("bat_mem", (4.4, 30.8, 0.05), (7.0, 32.3, 0.35), "t2", rot=zr(22.5, (4.4, 32.4, 0.2))),
                 part("sh_pumpkin", (5.4, 25, -1.3), (7.8, 27, 1.3), "pat_pumpkin"),
                 part("sh_eye0", (5.8, 26.1, -1.35), (6.3, 26.5, -1.3), "g", glow=True),
                 part("sh_eye1", (6.9, 26.1, -1.35), (7.4, 26.5, -1.3), "g", glow=True),
                 part("sh_mouth", (5.8, 25.4, -1.35), (7.4, 25.8, -1.3), "g", glow=True),
                 part("sh_stem", (6.4, 27, -0.2), (6.8, 27.6, 0.2), "s1"),
                 part("sh_vine", (6.8, 27.2, -0.2), (7.6, 27.5, 0.1), "s1")])
    return p


# ----------------------------------------------------------------------------- sets
SETS = [
    {"id": "frostborn", "name": "Frostborn", "color": "&b", "pattern": "plate", "secondary": "fur",
     "pal": dict(o=(20, 34, 56), d=(60, 96, 140), b=(120, 170, 210), m=(170, 210, 235), l=(230, 245, 255),
                 t=(236, 236, 240), t2=(180, 184, 196), a=(90, 200, 255), g=(150, 245, 255),
                 s1=(140, 150, 165), s2=(90, 100, 115)),
     "emblem": ["..a..a..", "...aa...", ".aagga..", "...aa...", "..a..a.."],
     "visor": ["........", "........", ".oo..oo.", "........", "........", "........", "........", "........"],
     "boot_art": ["tttt", "t..t"], "leg_art": ["....", "....", "....", "....", "....", "....", "tttt", "t.t."],
     "belt_art": ["...ga...."],
     "helmet": frostborn, "recipe": {"A": "BLUE_ICE", "B": "DIAMOND"},
     "stats": D((3, 7, 6, 3), DIAMOND_DURA, 1, {"knockbackResistance": 0.05}),
     "lore": ["&7Forged on the glacier's edge,", "&7tempered in snow that never melts."],
     "perk_text": "&bPerk: &f+5% knockback resistance per piece"},
    {"id": "druid", "name": "Druid", "color": "&a", "pattern": "bark", "secondary": "cloth",
     "pal": dict(o=(24, 30, 14), d=(56, 40, 24), b=(92, 66, 40), m=(124, 94, 58), l=(170, 134, 86),
                 t=(70, 140, 50), t2=(40, 96, 32), a=(230, 90, 140), g=(170, 255, 120),
                 s1=(90, 170, 60), s2=(140, 210, 80)),
     "emblem": ["...t....", "..ttt...", ".ttatt..", "..ttt...", "...d....", "...d...."],
     "leg_art": ["t...", ".t..", "..t.", ".t..", "t...", ".t..", "..t.", ".t..", "t...", ".t..", "..t.", ".t.."],
     "helmet": druid, "recipe": {"A": "MOSS_BLOCK", "B": "EMERALD"},
     "stats": D((2, 7, 5, 2), DIAMOND_DURA, 0, {"maxHealth": 1}),
     "lore": ["&7Grown, not forged.", "&7The antlers were a gift from the forest."],
     "perk_text": "&aPerk: &f+half a heart per piece"},
    {"id": "samurai", "name": "Samurai", "color": "&c", "pattern": "lamellar", "secondary": "cloth",
     "pal": dict(o=(20, 8, 10), d=(90, 14, 20), b=(150, 24, 30), m=(190, 40, 44), l=(230, 90, 80),
                 t=(214, 170, 60), t2=(140, 100, 30), a=(30, 30, 34), g=(255, 210, 90),
                 s1=(54, 54, 60), s2=(240, 236, 226)),
     "emblem": ["..tttt..", ".t.gg.t.", ".tg..gt.", ".t.gg.t.", "..tttt.."],
     "visor": ["........", "........", "........", ".o....o.", "........", "..tttt..", ".tooooot", ".tt..tt."],
     "leg_art": ["tttt", "....", "tttt", "....", "tttt"],
     "helmet": samurai, "recipe": {"A": "IRON_INGOT", "B": "DIAMOND"},
     "stats": D((3, 7, 5, 3), DIAMOND_DURA, 1, {"attackDamage": 0.5}),
     "lore": ["&7Red lacquer over steel.", "&7The banner carries the clan's name."],
     "perk_text": "&cPerk: &f+0.5 attack damage per piece"},
    {"id": "pharaoh", "name": "Pharaoh", "color": "&e", "pattern": "stripes", "secondary": "plate",
     "pal": dict(o=(40, 26, 6), d=(150, 110, 30), b=(206, 160, 50), m=(236, 196, 80), l=(255, 236, 150),
                 t=(30, 70, 170), t2=(20, 40, 110), a=(40, 160, 150), g=(255, 240, 160),
                 s1=(236, 220, 180), s2=(200, 180, 140)),
     "emblem": ["..tttt..", ".t.aa.t.", "tt.gg.tt", ".t....t.", "..tttt.."],
     "belt_art": ["..tgtt..."],
     "helmet": pharaoh, "recipe": {"A": "GOLD_INGOT", "B": "LAPIS_BLOCK"},
     "stats": D((3, 7, 6, 3), DIAMOND_DURA, 1, {"luck": 1}),
     "lore": ["&7Sealed in a tomb for three", "&7thousand years. Still shiny."],
     "perk_text": "&ePerk: &f+1 luck per piece"},
    {"id": "atlantean", "name": "Atlantean", "color": "&3", "pattern": "scale", "secondary": "cloth",
     "pal": dict(o=(8, 30, 36), d=(20, 80, 90), b=(40, 130, 130), m=(70, 180, 170), l=(150, 230, 210),
                 t=(240, 130, 150), t2=(190, 80, 110), a=(250, 230, 200), g=(120, 255, 230),
                 s1=(30, 110, 160), s2=(60, 160, 210)),
     "emblem": ["a..a..a.", "a..a..a.", "aaaaaaa.", "...a....", "...g...."],
     "helmet": atlantean, "recipe": {"A": "PRISMARINE_SHARD", "B": "NAUTILUS_SHELL"},
     "stats": D((3, 7, 6, 3), DIAMOND_DURA, 2),
     "lore": ["&7Scales of the deep city,", "&7still wet after centuries."],
     "perk_text": "&3Perk: &f+2 toughness per piece"},
    {"id": "paladin", "name": "Paladin", "color": "&f", "pattern": "plate", "secondary": "cloth",
     "pal": dict(o=(40, 40, 54), d=(150, 154, 170), b=(200, 204, 216), m=(230, 232, 240), l=(255, 255, 255),
                 t=(230, 190, 70), t2=(160, 120, 40), a=(60, 110, 200), g=(255, 245, 200),
                 s1=(250, 250, 255), s2=(220, 224, 236)),
     "emblem": ["...tt...", "...tt...", ".tttttt.", "...tt...", "...tt...", "...tt..."],
     "visor": ["........", "...tt...", "...tt...", "oooooooo", "...tt...", ".o.tt.o.", ".o.tt.o.", "........"],
     "secondary_pal_note": "blue tabard",
     "helmet": paladin, "recipe": {"A": "QUARTZ_BLOCK", "B": "GOLD_BLOCK"},
     "stats": D((3, 8, 6, 3), DIAMOND_DURA, 2, {"knockbackResistance": 0.05}),
     "lore": ["&7Blessed plate for those", "&7who hold the line."],
     "perk_text": "&fPerk: &fhighest armor of the sets"},
    {"id": "clockwork", "name": "Clockwork", "color": "&6", "pattern": "brass", "secondary": "plate",
     "pal": dict(o=(40, 24, 12), d=(110, 64, 26), b=(168, 104, 44), m=(206, 150, 70), l=(240, 200, 120),
                 t=(200, 170, 70), t2=(130, 100, 40), a=(60, 56, 60), g=(120, 230, 255),
                 s1=(90, 90, 96), s2=(150, 150, 158)),
     "emblem": [".t.tt.t.", "..tttt..", "tttggttt", "tttggttt", "..tttt..", ".t.tt.t."],
     "boot_art": ["a..a"],
     "helmet": clockwork, "recipe": {"A": "COPPER_INGOT", "B": "CLOCK"},
     "stats": D((3, 7, 6, 3), DIAMOND_DURA, 3, {"movementSpeed": -0.003}),
     "lore": ["&7Tick, tock. Heavy, but", "&7nothing gets through."],
     "perk_text": "&6Perk: &f+3 toughness per piece, a little slower"},
    {"id": "shadow", "name": "Shadow", "color": "&8", "pattern": "cloth", "secondary": "cloth",
     "pal": dict(o=(8, 6, 12), d=(20, 18, 28), b=(34, 30, 46), m=(52, 46, 70), l=(84, 76, 110),
                 t=(170, 24, 34), t2=(110, 14, 22), a=(140, 140, 150), g=(200, 60, 255),
                 s1=(200, 200, 210), s2=(60, 60, 70)),
     "emblem": ["...a....", "...a....", "aaagaaa.", "...a....", "...a...."],
     "visor": ["........", "........", "........", ".gg..gg.", "........", "aaaaaaaa", "aaaaaaaa", "aaaaaaaa"],
     "helmet": shadow, "recipe": {"A": "BLACK_WOOL", "B": "ENDER_PEARL"}, "material": "IRON",
     "stats": D((2, 6, 5, 2), IRONISH_DURA, 0, {"movementSpeed": 0.005}),
     "lore": ["&7You didn't see it.", "&7That's the point."],
     "perk_text": "&8Perk: &f+5% speed per piece, lighter armor"},
    {"id": "dragon", "name": "Dragon", "color": "&4", "pattern": "scale", "secondary": "scale",
     "pal": dict(o=(30, 6, 6), d=(110, 20, 14), b=(170, 40, 20), m=(210, 80, 30), l=(245, 150, 60),
                 t=(60, 40, 36), t2=(30, 20, 18), a=(240, 220, 180), g=(255, 200, 60),
                 s1=(250, 120, 30), s2=(255, 190, 80)),
     "emblem": [".g....g.", "..g..g..", "...gg...", "..gddg..", ".g....g."],
     "visor": ["........", "........", "g.o..o.g", "........", "........", "........", "........", "........"],
     "boot_art": ["a.a.", "a.a."],
     "helmet": dragon, "recipe": {"A": "BLAZE_ROD", "B": "DRAGON_BREATH"},
     "stats": D((3, 7, 6, 3), DIAMOND_DURA, 2.5),
     "lore": ["&7Shed scales of an old", "&7dragon, still warm."],
     "perk_text": "&4Perk: &f+2.5 toughness per piece"},
    {"id": "mushroom", "name": "Mushroom", "color": "&c", "pattern": "cloth", "secondary": "cloth",
     "pal": dict(o=(40, 20, 16), d=(120, 70, 50), b=(170, 120, 90), m=(210, 170, 130), l=(240, 220, 190),
                 t=(200, 30, 30), t2=(140, 16, 20), a=(250, 250, 240), g=(255, 240, 150),
                 s1=(150, 90, 60), s2=(100, 160, 70)),
     "emblem": ["..tttt..", ".tattat.", "tttttttt", "..llll..", "..llll.."],
     "helmet": mushroom, "recipe": {"A": "RED_MUSHROOM_BLOCK", "B": "MUSHROOM_STEW"}, "material": "IRON",
     "stats": D((2, 6, 5, 2), IRONISH_DURA, 0, {"maxHealth": 1}),
     "lore": ["&7Grows back when damaged.", "&7Mostly. Smells like stew."],
     "perk_text": "&cPerk: &f+half a heart per piece"},
]

# the Halloween rework uses the same painter for its flat armor
HALLOWEEN_STYLE = {
    "id": "halloween", "pattern": "pumpkin", "secondary": "cloth",
    "pal": dict(o=(24, 10, 26), d=(120, 50, 8), b=(210, 100, 20), m=(240, 140, 30), l=(255, 184, 70),
                t=(90, 40, 120), t2=(40, 16, 56), a=(230, 200, 110), g=(255, 230, 120),
                s1=(70, 160, 50), s2=(230, 220, 195)),
    "emblem": [".g....g.", "ggg..ggg", "...gg...", "g......g", ".gggggg.", "..g..g.."],
    "boot_art": ["aaaa", "a.a."], "leg_art": ["....", "....", "....", "....", "....", "....", "aaaa", "a.aa"],
    "belt_art": ["...gg...."],
    "helmet": halloween,
}


# ----------------------------------------------------------------------------- upgrades
# Every set is a step above netherite and crafts from its own materials (see
# armor_engine.RECIPE_SHAPES); coverage decides how much skin shows.
def TS(metal, handle, accent, glow, **kw):
    """Tool style for the tool forge."""
    return dict(metal=metal, handle=handle, accent=accent, glow=glow, **kw)


UPGRADES = {
    "frostborn": dict(C="BREEZE_ROD", perk={"knockbackResistance": 0.05}, mob=("STRAY", 5),
                      seal=(90, 200, 255),
                      story=["Chipped from the heart of a glacier that swallowed a whole army.",
                             "The picks ring like bells when they strike stone.",
                             "The blade is so cold it burns."],
                      tools=TS((170, 215, 240), (70, 90, 120), (236, 236, 240), (150, 245, 255), sword="crystal",
                               guard="horns", pommel="gem", deco="facets", grip="bands", axe="double",
                               pick="crystal", shovel="pointed", hoe="sickle", bow="angular", bow_tips="spike",
                               bow_mat="metal", string=(200, 240, 255))),
    "druid": dict(C="FLOWERING_AZALEA", perk={"maxHealth": 1}, mob=("BOGGED", 5), seal=(90, 170, 60),
                  story=["Grown from a seed the forest gave willingly.", "Each tool still has a leaf on it. It grows back.",
                         "The bow is a living branch. Be nice to it."],
                  tools=TS((120, 180, 80), (92, 66, 40), (170, 134, 86), (230, 90, 140), sword="leaf", guard="fins",
                           pommel="crescent", deco="vein", grip="plain", axe="moon", pick="winged", shovel="trowel",
                           hoe="claw", bow="branch", bow_tips="leaf", bow_mat="handle", string=(200, 230, 150))),
    "samurai": dict(C="BAMBOO", perk={"attackDamage": 0.5}, mob=("PILLAGER", 5), seal=(190, 40, 44),
                    story=["Folded a thousand times, lacquered red.", "Even the hoe has a proper name.",
                           "Draw it only when you mean it."],
                    tools=TS((220, 224, 232), (40, 30, 34), (214, 170, 60), (255, 90, 80), sword="katana",
                             guard="disc", pommel="tassel", deco="edge", grip="wrap", axe="bearded", pick="straight",
                             shovel="spade", hoe="blade", bow="long", bow_tips="spike", bow_mat="handle",
                             string=(240, 236, 226))),
    "pharaoh": dict(C="CHISELED_SANDSTONE", perk={"luck": 1}, mob=("HUSK", 5), seal=(30, 70, 170),
                    story=["Taken from a tomb. The curse was included for free.", "Gold heads on lapis handles.",
                           "The khopesh remembers every king."],
                    tools=TS((236, 196, 80), (30, 70, 170), (40, 160, 150), (255, 240, 160), sword="scimitar",
                             guard="crescent", pommel="gem", deco="stripes", grip="bands", axe="moon", pick="single",
                             shovel="spade", hoe="sickle", bow="recurve", bow_tips="gem", bow_mat="accent",
                             alt=(30, 70, 170), string=(255, 236, 150))),
    "atlantean": dict(C="PRISMARINE_CRYSTALS", perk={"movementSpeed": 0.003}, mob=("DROWNED", 5),
                      seal=(40, 160, 150),
                      story=["Scales of the deep city, still wet.", "Coral handles, pearl heads.",
                             "The trident's little brother."],
                      tools=TS((70, 180, 170), (240, 130, 150), (250, 230, 200), (120, 255, 230), sword="forked",
                               guard="fins", pommel="orb", deco="core", grip="plain", axe="halberd", pick="arched",
                               shovel="scoop", hoe="rake", bow="double", bow_tips="gem", bow_mat="metal",
                               string=(120, 255, 230))),
    "paladin": dict(C="END_ROD", perk={"knockbackResistance": 0.05}, mob=("VINDICATOR", 5),
                    seal=(230, 190, 70),
                    story=["Blessed plate for those who hold the line.", "Tools for rebuilding after the siege.",
                           "A holy sword and a bow that never misses the wicked."],
                    tools=TS((235, 236, 244), (60, 110, 200), (230, 190, 70), (255, 245, 200), sword="greatsword",
                             guard="bar_gem", pommel="gem", deco="fuller", grip="wrap", axe="flared", pick="arched",
                             shovel="spade", hoe="blade", bow="recurve", bow_tips="feather", bow_mat="accent",
                             string=(255, 250, 230))),
    "clockwork": dict(C="LIGHTNING_ROD", perk={"knockbackResistance": 0.05}, mob=("IRON_GOLEM", 6),
                      seal=(200, 150, 60),
                      story=["Tick, tock. Heavy, but nothing gets through.", "Every tool has a tiny gear that spins.",
                             "The bow is spring-loaded. Mind your fingers."],
                      tools=TS((206, 150, 70), (60, 56, 60), (200, 170, 70), (120, 230, 255), sword="cleaver",
                               guard="ring", pommel="ring", deco="runes", grip="bands", axe="cleaver", pick="hammer",
                               shovel="spade", hoe="rake", bow="angular", bow_tips="spike", bow_mat="accent",
                               bow_studs=True, string=(90, 90, 96))),
    "shadow": dict(C="COAL_BLOCK", perk={"movementSpeed": 0.005}, mob=("ENDERMAN", 5), seal=(110, 14, 22),
                   story=["You didn't see it. That's the point.", "Quiet tools for quiet work.",
                          "Twin blades and a bow that makes no sound."],
                   tools=TS((60, 56, 76), (20, 18, 28), (170, 24, 34), (200, 60, 255), sword="needle",
                            guard="collar", pommel="tassel", deco="edge", grip="wrap", axe="hatchet", pick="single",
                            shovel="trowel", hoe="sickle", bow="long", bow_tips="spike", bow_mat="metal",
                            string=(170, 24, 34))),
    "dragon": dict(C="FIRE_CHARGE", perk={"attackDamage": 0.5}, mob=("BLAZE", 5), seal=(210, 80, 30),
                   story=["Shed scales of an old dragon, still warm.", "Claws make good picks.",
                          "It breathes a little when you swing it."],
                   tools=TS((210, 80, 30), (60, 40, 36), (240, 220, 180), (255, 200, 60), sword="serrated",
                            guard="wings", pommel="claw", deco="cracks", grip="wrap", axe="bearded", pick="winged",
                            shovel="pointed", hoe="claw", bow="recurve", bow_tips="flame", bow_mat="metal",
                            string=(255, 190, 80))),
    "mushroom": dict(C="MUSHROOM_STEM", perk={"maxHealth": 1}, mob=("MOOSHROOM", 20), seal=(200, 30, 30),
                     story=["Grows back when damaged. Mostly.", "Tools with little caps on. Adorable.",
                            "The spores are only mildly dangerous."],
                     tools=TS((200, 40, 40), (240, 220, 190), (250, 250, 240), (255, 240, 150), sword="leaf",
                              guard="disc", pommel="orb", deco="stars", grip="plain", axe="moon", pick="arched",
                              shovel="round", hoe="blade", bow="smooth", bow_tips="gem", bow_mat="handle",
                              string=(240, 220, 190))),
}

for _S in SETS:
    _u = dict(UPGRADES[_S["id"]])
    _S["recipe"]["C"] = _u.pop("C")
    for _k in ("stats", "material", "perk_text"):
        _S.pop(_k, None)
    _S.update(_u)


import armor_looks  # noqa: E402
for _S in SETS + [HALLOWEEN_STYLE]:
    armor_looks.apply(_S)
