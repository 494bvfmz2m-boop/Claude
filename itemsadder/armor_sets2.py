"""36 more armor sets (46 with armor_sets.py; 50 with Crimson, Blue Crimson,
Halloween and Demon). Each has its own palette, surface patterns, coverage
(how much skin shows), open head-worn 3D helmet, tool style, recipe
materials, scroll stories and scroll-dropping mob."""
from armor_engine import mirror, part
from armor_sets import TS, ring, xr, yr, zr


def glow_ring(name, y0, y1, r, t=0.4):
    p = ring(name, y0, y1, "g", r=r, t=t)
    for q in p:
        q["glow"] = True
    return p


def rotated(parts, rot):
    for q in parts:
        q["rot"] = rot
    return parts


# ----------------------------------------------------------------------------- helmets
def obsidian():
    p = ring("band", 29, 31, "b", r=4.7) + [
        part("cap", (-4.6, 31, -4.6), (4.6, 32.4, 4.6), "pat_obsidian"),
        part("seam", (-3, 30, -4.8), (3, 30.3, -4.75), "g", glow=True),
        part("shard", (-0.7, 32.4, -3), (0.7, 36, -1.6), "m"),
        part("shard_tip", (-0.4, 36, -2.6), (0.4, 37, -2), "g", glow=True),
        part("shard_back", (-0.6, 32.4, 2), (0.6, 35, 3.2), "b", rot=xr(22.5, (0, 32.4, 2.6)))]
    p += mirror([part("cheek", (4.4, 25.5, -4.9), (5.0, 29, -2.2), "d"),
                 part("shard_s", (2, 32.4, -2.6), (3.1, 35, -1.4), "b", rot=zr(-22.5, (2.5, 32.4, -2))),
                 part("shard_s2", (3.5, 32.4, 0.5), (4.4, 34.2, 1.6), "m", rot=zr(-22.5, (4, 32.4, 1))),
                 part("pauldron", (4.8, 25, -2.6), (9.2, 26.2, 2.6), "pat_obsidian"),
                 part("spike", (6.4, 26.2, -0.5), (7.4, 28.8, 0.5), "m"),
                 part("spike_glow", (6.6, 28.8, -0.3), (7.2, 29.5, 0.3), "g", glow=True)])
    return p


def magma():
    p = ring("band", 29.4, 30.6, "d") + [
        part("seam", (-4.65, 29.8, -4.7), (4.65, 30.1, -4.65), "g", glow=True),
        part("drip0", (-2.2, 28.4, -4.8), (-1.6, 29.4, -4.6), "g", glow=True),
        part("drip1", (1.2, 28.8, -4.8), (1.8, 29.4, -4.6), "g", glow=True)]
    p += mirror([part("horn0", (3.6, 30.6, -2), (4.8, 33, -0.8), "b", rot=zr(-22.5, (4.2, 30.6, -1.4))),
                 part("horn1", (4.8, 32.6, -1.9), (5.8, 35, -0.9), "m", rot=zr(-45, (5.3, 32.6, -1.4))),
                 part("horn_tip", (6.6, 34, -1.8), (7.4, 35, -1), "g", glow=True),
                 part("pillar", (5.2, 25, -1.5), (8, 26.8, 1.5), "b"),
                 part("pillar_top", (5.6, 26.8, -1.1), (7.6, 27, 1.1), "g", glow=True),
                 part("pillar2", (7.4, 25, 1), (8.6, 28, 2.2), "d")])
    return p


def storm():
    p = ring("circlet", 29.6, 30.4, "t") + [
        part("gem", (-0.6, 29.5, -4.95), (0.6, 30.7, -4.6), "g", glow=True),
        part("cloud0", (-3.6, 35, -2.6), (3.6, 36.6, 2.6), "s2"),
        part("cloud1", (-2.4, 36.6, -1.8), (2.2, 37.6, 1.8), "s1"),
        part("cloud2", (-4.4, 35.4, -1.4), (-3.6, 36.2, 1.4), "s2"),
        part("cloud3", (3.6, 35.6, -1), (4.2, 36.2, 1.2), "s1"),
        part("bolt0", (2.2, 33.4, -0.3), (2.6, 35, 0.1), "g", glow=True),
        part("bolt1", (1.8, 32.6, -0.3), (2.3, 33.6, 0.1), "g", glow=True)]
    p += mirror([part("rod", (4.4, 29, -0.3), (4.9, 33.4, 0.3), "t"),
                 part("rod_tip", (4.35, 33.4, -0.4), (4.95, 34, 0.4), "g", glow=True),
                 part("coil_base", (5.6, 25, -1), (7.6, 25.6, 1), "t2"),
                 part("coil", (6.2, 25.6, -0.4), (7, 27.6, 0.4), "t"),
                 part("coil_orb", (6.1, 27.6, -0.5), (7.1, 28.6, 0.5), "g", glow=True)])
    return p


def void():
    p = ring("circlet", 29.6, 30.4, "b") + [
        part("crystal", (-0.8, 34, -4), (0.8, 35.6, -2.4), "g", glow=True, rot=yr(45, (0, 34.8, -3.2))),
        part("crystal_frame", (-1.1, 34.6, -4.3), (1.1, 35, -2.1), "a", rot=yr(45, (0, 34.8, -3.2))),
        part("mote0", (5.4, 31.5, -2), (5.8, 31.9, -1.6), "g", glow=True),
        part("mote1", (-5.6, 33, 1), (-5.2, 33.4, 1.4), "g", glow=True)]
    p += mirror([part("horn0", (3.6, 30.4, -1), (4.6, 33.4, 0), "d", rot=xr(-22.5, (4.1, 30.4, -0.5))),
                 part("horn1", (3.8, 32.6, 0.6), (4.5, 35, 1.4), "b", rot=xr(22.5, (4.15, 32.6, 1))),
                 part("horn_tip", (3.9, 34.6, 2), (4.4, 35.6, 2.5), "g", glow=True),
                 part("shell_base", (5.4, 25, -1.4), (8, 25.2, 1.4), "d"),
                 part("shell_gap", (5.8, 25.2, -1), (7.6, 25.6, 1), "g", glow=True),
                 part("shell", (5.4, 25.6, -1.4), (8, 26.8, 1.4), "m"),
                 part("shell_top", (5.8, 26.8, -1), (7.6, 27.4, 1), "b")])
    return p


def celestial():
    p = ring("circlet", 29.6, 30.2, "t") + ring("halo", 34.2, 34.6, "t", r=3.6, t=0.4) + [
        part("star", (-0.6, 30.4, -4.95), (0.6, 31.6, -4.6), "g", glow=True, rot=zr(45, (0, 31, -4.8))),
        part("star_b", (-0.4, 34.6, -3.8), (0.4, 35.4, -3.2), "g", glow=True, rot=zr(45, (0, 35, -3.5)))]
    p += mirror([part("star_s", (4.2, 33.6, -2.8), (4.8, 34.2, -2.2), "g", glow=True),
                 part("star_t", (3, 35, 2.6), (3.5, 35.5, 3.1), "l"),
                 part("planet", (6, 26, -0.8), (7.6, 27.6, 0.8), "a"),
                 part("planet_ring", (5.2, 26.65, -1.4), (8.4, 26.95, 1.4), "t", rot=zr(22.5, (6.8, 26.8, 0)))])
    return p


def solar():
    o = (0, 30, 5.2)
    p = [part("diadem", (-4.6, 30.4, -4.9), (4.6, 31.2, -4.5), "t"),
         part("sun_gem", (-0.8, 30.2, -5.05), (0.8, 31.8, -4.85), "g", glow=True),
         part("disc", (-3.2, 27, 5), (3.2, 33, 5.4), "t")]
    for i, ang in enumerate((-45, -22.5, 0, 22.5, 45)):
        mat = "g" if i % 2 == 0 else "l"
        p.append(part(f"ray_up{i}", (-0.5, 33.6, 5.05), (0.5, 38 - (i % 2), 5.35), mat, glow=mat == "g",
                      rot=zr(ang, o)))
    p += mirror([part("ray_side", (3.8, 29.5, 5.05), (7.8, 30.5, 5.35), "g", glow=True, rot=zr(-22.5, o)),
                 part("ray_low", (3.8, 29.5, 5.05), (7, 30.5, 5.35), "l", rot=zr(-45, o)),
                 part("side", (4.5, 29.4, -4.5), (4.9, 31.2, 1), "t"),
                 part("pauldron", (4.8, 25, -2.4), (8.8, 25.8, 2.4), "t"),
                 part("pauldron_ray", (8.8, 24.6, -0.4), (10, 25.6, 0.4), "g", glow=True),
                 part("pauldron_sun", (6.2, 25.8, -0.6), (7.4, 26.2, 0.6), "g", glow=True)])
    return p


def lunar():
    """Silver circlet with a teardrop gem and a glowing crescent moon floating behind the head."""
    p = ring("circlet", 29.8, 30.3, "t") + [
        part("tear", (-0.5, 28.6, -4.9), (0.5, 29.8, -4.6), "g", glow=True),
        part("tear_setting", (-0.8, 29.8, -4.9), (0.8, 30.4, -4.6), "t2")]
    cy, cz = 33.5, 5.2
    for i, (ang, (x0, y0, x1, y1)) in enumerate(((0, (-1.2, cy + 2.6, 1.2, cy + 3.4)),
                                                   (45, (-3.3, cy + 1.4, -1.3, cy + 2.2)),
                                                   (0, (-3.8, cy - 1.2, -3.0, cy + 1.2)),
                                                   (-45, (-3.3, cy - 2.2, -1.3, cy - 1.4)),
                                                   (0, (-1.2, cy - 3.4, 1.2, cy - 2.6)))):
        rot = zr(ang, ((x0 + x1) / 2, (y0 + y1) / 2, cz)) if ang else None
        p.append(part(f"moon{i}", (x0, y0, cz - 0.3), (x1, y1, cz + 0.3), "a", rot=rot))
        p.append(part(f"moon_glow{i}", (x0 + 0.2, y0 + 0.15, cz - 0.35), (x1 - 0.2, y1 - 0.15, cz - 0.3), "g",
                      glow=True, rot=rot))
    p += mirror([part("chain0", (4.5, 26, -2), (4.75, 30, -1.75), "t2"),
                 part("chain_gem", (4.45, 25.4, -2.05), (4.8, 26, -1.7), "g", glow=True),
                 part("chain1", (4.5, 26.5, 1), (4.75, 30, 1.25), "t2"),
                 part("star", (2.2, 35.4, 4.9), (2.6, 35.8, 5.3), "g", glow=True)])
    return p


def viking():
    p = ring("rim", 30.4, 31.4, "t2") + [
        part("dome", (-4.6, 31.4, -4.6), (4.6, 32.8, 4.6), "m"),
        part("dome_top", (-3, 32.8, -3), (3, 33.4, 3), "l"),
        part("nasal", (-0.4, 27.8, -4.95), (0.4, 30.4, -4.6), "m"),
        part("fur_back", (-4.6, 22.5, 3.4), (4.6, 26, 4.4), "pat_fur")]
    p += mirror([part("horn0", (4.4, 30.6, -0.8), (6.6, 32.2, 0.8), "a"),
                 part("horn1", (6.2, 31.4, -0.7), (7.4, 34.4, 0.7), "a", rot=zr(-22.5, (6.8, 31.4, 0))),
                 part("horn2", (7.6, 33.6, -0.5), (8.4, 35.8, 0.5), "s2"),
                 part("braid", (4.4, 23, -3.2), (5.2, 28, -2.4), "l"),
                 part("bead", (4.3, 23.4, -3.3), (5.3, 24.2, -2.3), "t"),
                 part("mantle", (4.2, 24.8, -2.8), (9, 26.2, 2.8), "pat_fur")])
    return p


def spartan():
    p = ring("rim", 29.6, 31, "b") + [
        part("cap", (-4.6, 31, -4.6), (4.6, 32.6, 4.6), "m"),
        part("crest_mount", (-0.6, 32.6, -3.6), (0.6, 33.2, 3.6), "t2"),
        part("crest", (-0.5, 33.2, -4.2), (0.5, 36, 4.2), "t"),
        part("crest_tail", (-0.5, 29, 4.2), (0.5, 33.4, 5.2), "t"),
        part("shield", (-3.4, 18.5, 3.6), (3.4, 25.5, 4.2), "b"),
        part("shield_rim", (-3.6, 18.2, 3.55), (3.6, 18.6, 4.25), "l"),
        part("shield_mark", (-0.4, 19.5, 4.2), (0.4, 24, 4.3), "t")]
    p += mirror([part("cheek", (4.3, 25.6, -4.8), (4.9, 29.6, -2.6), "d"),
                 part("shield_mark_s", (0.3, 19.5, 4.2), (0.9, 23.5, 4.3), "t", rot=zr(-22.5, (0, 24, 4.25)))])
    return p


def jaguar():
    o = (0, 31, 5.15)
    p = [part("snout", (-2.6, 31.2, -6.6), (2.6, 33.2, -4.4), "pat_spots"),
         part("pelt", (-4.6, 32, -4.4), (4.6, 32.8, 4.6), "pat_spots"),
         part("pelt_back", (-4.6, 24, 4.4), (4.6, 32.4, 5), "pat_spots"),
         part("beads", (-3, 24.4, -3.4), (3, 25.2, -3.05), "t")]
    for i, (ang, mat) in enumerate(((-45, "s1"), (-22.5, "s2"), (0, "t"), (22.5, "s2"), (45, "s1"))):
        p.append(part(f"feather{i}", (-0.5, 33, 5.02), (0.5, 39 - abs(ang) / 22.5 * 0.6, 5.3), mat, rot=zr(ang, o)))
        p.append(part(f"feather_tip{i}", (-0.55, 38.2 - abs(ang) / 22.5 * 0.6, 4.98),
                      (0.55, 39.2 - abs(ang) / 22.5 * 0.6, 5.34), "a", rot=zr(ang, o)))
    p += mirror([part("ear", (2.4, 33.2, -3.5), (3.8, 34.6, -2.3), "m"),
                 part("fang", (1.5, 30.2, -6.4), (1.9, 31.2, -6), "a"),
                 part("eye", (1.2, 32.6, -6.65), (2.2, 33, -6.6), "g", glow=True)])
    return p


def bone():
    p = [part("cranium", (-2.2, 32, -3.8), (2.2, 34, 0), "a"),
         part("snout", (-1.4, 32, -6.2), (1.4, 33.4, -3.8), "a"),
         part("teeth", (-1.2, 31.6, -6.1), (1.2, 32, -4.2), "s2"),
         part("strap", (-4.6, 31.4, -0.5), (4.6, 32, 0.5), "t")]
    p += ring("necklace", 23.6, 24.2, "t", r=4.2, t=0.3)
    p += mirror([part("socket", (0.5, 33.2, -3.85), (1.5, 33.8, -3.8), "o"),
                 part("horn0", (2.2, 32.4, -2), (3.6, 34, 0.4), "s2"),
                 part("horn1", (3.2, 31.6, -0.2), (4.6, 33.6, 1.6), "s2", rot=xr(22.5, (3.9, 33, 0))),
                 part("horn2", (3.6, 29.8, 0.6), (4.6, 31.8, 2.4), "l", rot=xr(45, (4.1, 31.8, 1.2))),
                 part("tooth", (1.2, 22.6, -4.3), (1.6, 23.6, -3.9), "a"),
                 part("rib0", (5, 25, -2), (8.6, 25.6, -1.4), "a"),
                 part("rib1", (5, 25, -0.3), (8.6, 25.6, 0.3), "a"),
                 part("rib2", (5, 25, 1.4), (8.6, 25.6, 2), "a"),
                 part("spur", (8.4, 25, -0.4), (9.8, 26.2, 0.4), "s2")])
    return p


def pirate():
    o = (0, 33, -5.55)
    p = [part("crown", (-3.8, 32, -3.8), (3.8, 34.2, 3.8), "o"),
         part("brim_back", (-5.2, 32, 4.4), (5.2, 34.8, 5), "o"),
         part("trim_back", (-5.2, 34.8, 4.4), (5.2, 35.1, 5), "t"),
         part("skull", (-0.7, 33.2, -6.05), (0.7, 34.4, -5.95), "a"),
         part("parrot", (5.6, 25, -0.8), (7.2, 27.4, 0.8), "s1"),
         part("parrot_head", (5.7, 27.4, -1), (7.1, 28.8, 0.6), "s1"),
         part("parrot_beak", (6.1, 27.8, -1.4), (6.7, 28.4, -1), "t"),
         part("parrot_wing", (7.2, 25.4, -0.6), (7.5, 27.2, 0.6), "s2"),
         part("parrot_tail", (6, 23.6, 0.4), (6.8, 25, 1), "s2"),
         part("feather", (3, 34, 0), (3.5, 37, 0.6), "a", rot=zr(-22.5, (3.25, 34, 0.3)))]
    p += mirror([part("brim", (0, 32, -5.8), (7.2, 34.6, -5.3), "o", rot=yr(-45, o)),
                 part("brim_trim", (0, 34.6, -5.8), (7.2, 34.9, -5.3), "t", rot=yr(-45, o))])
    return p


def neon():
    p = ring("band", 30, 30.6, "d")
    for i in range(5):
        p.append(part(f"mohawk{i}", (-0.35, 32, -3.2 + i * 1.5), (0.35, 33.6 + (i % 2) * 0.8, -2.4 + i * 1.5),
                      "g", glow=True))
    p.append(part("spine", (-0.3, 24, 4.4), (0.3, 30, 4.8), "g", glow=True))
    p += mirror([part("ear", (4.4, 27.6, -1.2), (5.2, 30.4, 1.2), "b"),
                 part("ear_ring", (5.2, 28.4, -0.6), (5.3, 29.6, 0.6), "g", glow=True),
                 part("antenna", (4.8, 30.4, 0.5), (5.1, 33.8, 0.8), "t2"),
                 part("antenna_tip", (4.75, 33.8, 0.45), (5.15, 34.2, 0.85), "a", glow=True),
                 part("pad", (5, 25, -1.8), (8.6, 25.4, 1.8), "b"),
                 part("pad_strip", (5, 25.4, -0.2), (8.6, 25.5, 0.2), "g", glow=True)])
    return p


def amethyst():
    p = ring("band", 29.6, 30.4, "d") + [
        part("front", (-0.5, 30.4, -4.9), (0.5, 33.4, -4.1), "l", rot=xr(-22.5, (0, 30.4, -4.5))),
        part("front_tip", (-0.3, 33, -5.9), (0.3, 33.8, -5.3), "g", glow=True),
        part("back", (-0.5, 30.4, 4), (0.5, 32.8, 4.8), "m", rot=xr(22.5, (0, 30.4, 4.4)))]
    p += mirror([part("c0", (1.8, 30.4, -4.7), (2.6, 32.6, -4), "m", rot=zr(-22.5, (2.2, 30.4, -4.3))),
                 part("c1", (3.8, 30.4, -3.2), (4.6, 33.8, -2.4), "l", rot=zr(-22.5, (4.2, 30.4, -2.8))),
                 part("c2", (4, 30.4, 0), (4.8, 32.2, 0.8), "b", rot=zr(-45, (4.4, 30.4, 0.4))),
                 part("c3", (3.4, 30.4, 2.6), (4.1, 31.8, 3.3), "m", rot=zr(-22.5, (3.75, 30.4, 2.9))),
                 part("geode", (5.2, 25, -1.6), (8.2, 26.6, 1.6), "d"),
                 part("g0", (5.8, 26.6, -1), (6.4, 28.4, -0.4), "l"),
                 part("g1", (7, 26.6, 0), (7.6, 27.8, 0.6), "m"),
                 part("g2", (6.4, 26.6, 0.6), (6.9, 27.6, 1.1), "g", glow=True)])
    return p


def jade():
    p = [part("base", (-2.6, 32, -2.6), (2.6, 33, 2.6), "t"),
         part("board", (-3.2, 33, -5.4), (3.2, 33.5, 4.4), "m"),
         part("board_trim", (-3.3, 33.5, -5.5), (3.3, 33.7, 4.5), "t"),
         part("pin", (-4.6, 32.4, -0.3), (4.6, 32.8, 0.3), "t")]
    for i, x in enumerate((-2.6, -1.3, 0, 1.3, 2.6)):
        p += [part(f"strand_f{i}", (x - 0.12, 30.6, -5.3), (x + 0.12, 33, -5.1), "t"),
              part(f"bead_f{i}", (x - 0.25, 30.2, -5.35), (x + 0.25, 30.7, -5.05), "g", glow=True),
              part(f"strand_b{i}", (x - 0.12, 30.6, 4.2), (x + 0.12, 33, 4.4), "t"),
              part(f"bead_b{i}", (x - 0.25, 30.2, 4.15), (x + 0.25, 30.7, 4.45), "a")]
    p += mirror([part("pin_end", (4.6, 32.2, -0.5), (5.2, 33, 0.5), "l"),
                 part("pauldron", (4.8, 25, -2.6), (9, 26, 2.6), "m"),
                 part("cloud", (5.4, 26, -1), (8.2, 26.4, 1), "t"),
                 part("cloud_curl", (7.6, 26.4, -0.4), (8.2, 26.9, 0.4), "t")])
    return p


def sculk():
    p = [part("cap", (-4.6, 32, -4.2), (4.6, 32.6, 4.6), "b"),
         part("cap_edge", (-4.6, 31.4, -4.6), (4.6, 32, -4.2), "d")]
    p += mirror([part("tendril0", (2, 32.6, -1), (2.6, 35.4, -0.4), "g", glow=True),
                 part("tendril1", (3.6, 32.4, 1), (4.2, 34.8, 1.6), "g", glow=True, rot=zr(-22.5, (3.9, 32.4, 1.3))),
                 part("tendril_base", (1.6, 32.6, -1.4), (3, 33.2, 0), "d"),
                 part("vein", (2, 25, 4.4), (2.5, 32, 4.8), "t"),
                 part("vein2", (4.4, 27, 2), (4.8, 32, 2.5), "t"),
                 part("catalyst", (5.4, 25, -1.4), (8, 26.2, 1.4), "b"),
                 part("catalyst_top", (5.8, 26.2, -1), (7.6, 26.5, 1), "d"),
                 part("soul", (6, 26.5, -0.4), (6.6, 26.8, 0.2), "g", glow=True)])
    return p


def sakura():
    p = [part("bun", (-1.6, 31, 2.4), (1.6, 33.6, 5), "o"),
         part("pin", (-3.6, 32.6, 3.4), (3.6, 33, 3.8), "t", rot=zr(22.5, (0, 32.8, 3.6))),
         part("petal0", (-4.8, 33, -3), (-4.4, 33.4, -2.6), "l"),
         part("petal1", (5, 31, 1), (5.4, 31.4, 1.4), "m")]
    p += mirror([part("flower", (2.8, 32, 3), (4, 33.2, 4.2), "l"),
                 part("flower2", (3.4, 33, 2.2), (4.2, 33.8, 3), "m"),
                 part("flower_core", (3.2, 32.4, 2.95), (3.6, 32.8, 3), "g", glow=True),
                 part("dangle", (3.6, 29, 3.4), (3.8, 32, 3.6), "t"),
                 part("dangle_end", (3.4, 28.4, 3.2), (4, 29, 3.8), "a"),
                 part("branch", (4.6, 25, -0.3), (8.8, 25.5, 0.3), "t2"),
                 part("blossom0", (6, 25.5, -0.8), (7, 26.3, 0.2), "l"),
                 part("blossom1", (7.8, 25.5, 0), (8.6, 26.2, 0.8), "m")])
    return p


def hive():
    p = ring("band", 29.6, 30.2, "t") + [
        part("comb", (-2, 32, -2), (2, 32.6, 2), "pat_hex"),
        part("honey0", (-1, 31.4, -4.8), (-0.4, 32, -4.6), "g", glow=True),
        part("honey1", (0.8, 31, -4.8), (1.3, 31.8, -4.6), "g", glow=True),
        part("bee", (-7.2, 25.6, -0.8), (-5.4, 27, 0.8), "a"),
        part("bee_stripe", (-6.6, 25.55, -0.85), (-6, 27.05, 0.85), "t"),
        part("bee_wing", (-6.8, 27, -0.2), (-5.8, 27.8, 0.8), "s2"),
        part("bee_sting", (-7.6, 26, -0.2), (-7.2, 26.4, 0.2), "t")]
    p += mirror([part("antenna", (1.4, 30.2, -3), (1.8, 33.6, -2.6), "t", rot=zr(-22.5, (1.6, 30.2, -2.8))),
                 part("antenna_tip", (2.3, 33.1, -3.05), (3.1, 33.9, -2.55), "a"),
                 part("wing", (0.6, 26, 4.4), (4, 29, 4.6), "s2", rot=zr(22.5, (0.6, 27.5, 4.5))),
                 part("wing2", (0.6, 24, 4.4), (3, 26, 4.6), "s1", rot=zr(-22.5, (0.6, 26, 4.5)))])
    return p


def nomad():
    p = ring("wrap", 30.4, 32, "m", r=4.8) + [
        part("top", (-4.4, 32, -4.4), (4.4, 33.2, 4.4), "b"),
        part("fold", (-4.9, 31, -4.95), (4.9, 31.6, -4.7), "l", rot=zr(22.5, (0, 31.3, -4.8))),
        part("brooch", (-0.6, 30.8, -5.05), (0.6, 32, -4.85), "g", glow=True),
        part("tail", (3.8, 22, 3.2), (4.8, 31, 4.8), "b", rot=xr(22.5, (4.3, 31, 4))),
        part("tail_end", (3.8, 21.2, 3.3), (4.8, 22, 4.7), "t", rot=xr(22.5, (4.3, 31, 4)))]
    p += mirror([part("drape", (4.4, 25, -2.4), (6.6, 25.6, 2.4), "m")])
    return p


def plague():
    p = [part("brim", (-6.4, 32, -6.4), (6.4, 32.5, 6.4), "b"),
         part("crown", (-4.4, 32.5, -4.4), (4.4, 35.4, 4.4), "b"),
         part("band", (-4.5, 32.5, -4.5), (4.5, 33.2, 4.5), "t"),
         part("mask", (-2.2, 25.6, -4.6), (2.2, 28, -4.2), "d"),
         part("beak", (-0.8, 26, -7.6), (0.8, 27.6, -4.2), "d", rot=xr(-22.5, (0, 27.6, -4.2))),
         part("beak_tip", (-0.4, 26.2, -8.6), (0.4, 26.8, -7.6), "o", rot=xr(-22.5, (0, 27.6, -4.2)))]
    p += mirror([part("lens", (0.6, 32.7, -4.7), (2.2, 33.9, -4.5), "g", glow=True),
                 part("strap", (2.2, 26.4, -4.5), (4.6, 27.2, -4.2), "t")])
    return p


def necro():
    p = ring("band", 29.8, 30.8, "t2")
    for i, x in enumerate((-2.4, 0, 2.4)):
        p += [part(f"skull{i}", (x - 0.8, 30.8, -5), (x + 0.8, 32.2, -4.4), "a"),
              part(f"eyes{i}", (x - 0.5, 31.4, -5.05), (x + 0.5, 31.7, -5), "g", glow=True)]
    p += mirror([part("spike0", (1.1, 30.8, -4.9), (1.5, 33.6, -4.5), "s2"),
                 part("spike1", (4.4, 30.8, -2), (4.8, 33.6, -1.6), "s2"),
                 part("spike2", (4.4, 30.8, 1.6), (4.8, 33, 2), "s2"),
                 part("orb", (6, 31, 2), (6.8, 31.8, 2.8), "g", glow=True),
                 part("sh_skull", (5.6, 25, -1), (7.8, 27, 1), "a"),
                 part("sh_eyes", (5.9, 25.9, -1.05), (7.5, 26.3, -1), "g", glow=True),
                 part("sh_jaw", (5.9, 25, -1.1), (7.5, 25.4, -1), "o")])
    return p


def royal():
    p = [part("bearskin", (-4.6, 31, -4.6), (4.6, 37.5, 4.6), "pat_fur"),
         part("bearskin_top", (-3.8, 37.5, -3.8), (3.8, 38.4, 3.8), "pat_fur"),
         part("chin", (-4.6, 23.8, -1), (4.6, 24.2, -0.4), "t"),
         part("plume", (4.6, 34, -0.4), (5.2, 38.5, 0.4), "t2")]
    p += mirror([part("strap", (4.6, 24.2, -1), (4.9, 31, -0.4), "t"),
                 part("epaulette", (4.8, 25, -2.4), (8.6, 25.8, 2.4), "t"),
                 part("fringe", (8.2, 23.6, -2.4), (8.8, 25, 2.4), "pat_stripes")])
    return p


def arcane():
    p = ring("circlet", 29.8, 30.3, "t") + glow_ring("rune", 33.4, 33.7, 5.6, 0.3)
    p += rotated(glow_ring("rune2", 30.8, 31.1, 6.4, 0.3), xr(22.5, (0, 31, 0)))
    p += [part("gem", (-0.5, 29.6, -4.95), (0.5, 30.6, -4.6), "g", glow=True),
          part("book", (-1.6, 35.6, -1.2), (1.6, 36.2, 1.2), "t", rot=yr(22.5, (0, 36, 0))),
          part("pages", (-1.5, 36.2, -1.1), (1.5, 36.4, 1.1), "a", rot=yr(22.5, (0, 36, 0)))]
    p += mirror([part("orb", (6.8, 27, -0.4), (7.6, 27.8, 0.4), "g", glow=True)])
    return p


def seraph():
    p = glow_ring("halo", 35, 35.5, 3.6, 0.5)
    wing = [part("arm", (1, 26, 4.5), (8.6, 27, 4.9), "a", rot=zr(22.5, (1, 26.5, 4.7))),
            part("tip_glow", (7.6, 26, 4.45), (8.6, 27, 4.95), "g", glow=True, rot=zr(22.5, (1, 26.5, 4.7)))]
    for i, (x, ln, mat) in enumerate(((2.2, 3.6, "s2"), (3.6, 4.8, "s1"), (5, 6, "s2"), (6.4, 7, "s1"),
                                      (7.6, 7.6, "l"))):
        top = 26.6 + (x - 1) * 0.414
        wing += [part(f"feather{i}", (x - 0.65, top - ln, 4.55), (x + 0.65, top, 4.8), mat),
                 part(f"feather_tip{i}", (x - 0.45, top - ln - 0.6, 4.58), (x + 0.45, top - ln, 4.77), "l")]
    for i, (x, ln) in enumerate(((2.8, 2.2), (4.4, 2.6), (6, 3))):   # covert feathers, in front
        top = 26.8 + (x - 1) * 0.414
        wing.append(part(f"covert{i}", (x - 0.7, top - ln, 4.8), (x + 0.7, top, 5.0), "t"))
    return p + mirror(wing)


def toxic():
    p = ring("hood", 30, 32.4, "b") + [
        part("top", (-4.6, 32.4, -4.6), (4.6, 33, 4.6), "b"),
        part("respirator", (-1.8, 24.6, -5.4), (1.8, 27, -4.4), "t2")]
    p += mirror([part("filter", (1.8, 24.8, -5.6), (3.2, 26.4, -4.4), "t"),
                 part("filter_glow", (2, 25, -5.65), (3, 26.2, -5.6), "g", glow=True),
                 part("goggle", (0.6, 30.6, -5), (2.6, 32, -4.6), "d"),
                 part("lens", (0.9, 30.9, -5.05), (2.3, 31.7, -5), "g", glow=True),
                 part("tank", (0.6, 20, 3.8), (2.6, 28, 5.8), "a"),
                 part("tank_cap", (0.8, 28, 4), (2.4, 28.6, 5.6), "t"),
                 part("pad", (4.8, 25, -2.2), (8.8, 25.6, 2.2), "pat_stripes")])
    return p


def kraken():
    p = [part("mantle", (-4.6, 31.6, -4.6), (4.6, 33, 4.6), "m"),
         part("mantle2", (-3, 33, -3), (3, 34.4, 3.4), "b"),
         part("mantle3", (-1.6, 34.4, -1), (1.6, 35.4, 2.8), "b")]
    p += mirror([part("eye", (4.6, 32, -2), (4.8, 32.8, -1.2), "g", glow=True),
                 part("t_back", (3.4, 24, 3.6), (4.2, 31.6, 4.4), "m"),
                 part("t_back_curl", (2.6, 23.2, 3.6), (4.2, 24, 4.4), "m"),
                 part("sucker", (3.35, 26, 3.8), (3.4, 27, 4.2), "a"),
                 part("t_side", (4.4, 27, 0.8), (5.1, 31.6, 1.5), "b"),
                 part("t_side_curl", (4.4, 26.4, -0.4), (5.1, 27, 1.5), "b"),
                 part("t_sh", (4.6, 25, -0.5), (9, 25.8, 0.5), "m"),
                 part("t_sh_down", (8.2, 22, -0.5), (9, 25, 0.5), "m"),
                 part("t_sh_tip", (7.6, 21.6, -0.4), (8.4, 22.4, 0.4), "l"),
                 part("t_sh_sucker", (5.4, 25.8, -0.3), (8, 25.9, 0.3), "a")])
    return p


def phoenix():
    p = ring("circlet", 29.8, 30.4, "t") + [
        part("gem", (-0.5, 29.8, -4.95), (0.5, 30.8, -4.6), "g", glow=True),
        part("crest0", (-0.4, 31.5, -4), (0.4, 35.5, -3), "s1", rot=xr(22.5, (0, 31.5, -3.5))),
        part("crest1", (-0.4, 31.5, -2), (0.4, 36.5, -1), "g", glow=True, rot=xr(22.5, (0, 31.5, -1.5))),
        part("crest2", (-0.4, 31.5, 0), (0.4, 35.8, 1), "s1", rot=xr(45, (0, 31.5, 0.5))),
        part("crest3", (-0.4, 31.5, 2), (0.4, 34.5, 3), "s2", rot=xr(45, (0, 31.5, 2.5))),
        part("tail", (-0.5, 20, 4.4), (0.5, 28, 4.8), "s1")]
    p += mirror([part("flame0", (4.6, 30, -1), (5, 33, 0), "g", glow=True, rot=zr(-22.5, (4.8, 30, -0.5))),
                 part("flame1", (4.6, 30, 0.4), (5, 32, 1.4), "s1", rot=zr(-45, (4.8, 30, 0.9))),
                 part("tail_s", (0.6, 21, 4.4), (1.4, 28, 4.8), "s2", rot=zr(22.5, (1, 28, 4.6))),
                 part("puff", (5.4, 25, -1), (7.8, 26.6, 1), "s1"),
                 part("puff_glow", (5.8, 26.6, -0.6), (7.2, 27.8, 0.6), "g", glow=True)])
    return p


def werewolf():
    p = ring("mane", 23.4, 25, "pat_fur", r=4.9, t=0.8) + [
        part("scruff", (-4.5, 32, -4), (4.5, 33, 4.5), "pat_fur"),
        part("tuft", (-1, 33, -3), (1, 33.8, 0), "m"),
        part("amulet", (-0.5, 22.6, -5), (0.5, 23.6, -4.8), "g", glow=True)]
    p += mirror([part("ear", (2.2, 32, -1.2), (4, 34.6, 0.2), "m", rot=zr(-22.5, (3.1, 32, -0.5))),
                 part("ear_in", (2.6, 32.4, -1.25), (3.6, 34, -1.2), "a", rot=zr(-22.5, (3.1, 32, -0.5))),
                 part("shoulder_fur", (4.4, 25, -2.4), (8.6, 26.4, 2.4), "pat_fur"),
                 part("claw", (8.6, 24.6, -1.2), (9.2, 25.8, -0.8), "s2"),
                 part("claw2", (8.6, 24.6, 0.8), (9.2, 25.8, 1.2), "s2")])
    return p


def rose():
    p = ring("vine", 29.8, 30.6, "t2") + [
        part("rose", (-0.8, 30.2, -5.2), (0.8, 31.8, -4.6), "t"),
        part("rose_in", (-0.4, 30.6, -5.3), (0.4, 31.4, -5.2), "l"),
        part("rose_back", (-0.7, 30.2, 4.6), (0.7, 31.6, 5.2), "t")]
    p += mirror([part("rose_s", (4.6, 30.2, -2.8), (5.2, 31.6, -1.4), "t"),
                 part("rose_f", (2, 30.3, -5.1), (3, 31.3, -4.6), "t"),
                 part("thorn0", (1.2, 30.6, -4.8), (1.5, 31.5, -4.5), "s2"),
                 part("thorn1", (4.6, 30.6, 0), (4.9, 31.5, 0.3), "s2"),
                 part("thorn2", (3.4, 30.6, 4.6), (3.7, 31.4, 4.9), "s2"),
                 part("trail", (2.4, 24, 4.4), (2.9, 29.8, 4.8), "t2"),
                 part("leaf", (2.9, 26, 4.4), (3.8, 26.5, 4.8), "s1"),
                 part("sh_vine", (4.6, 25, -0.3), (8.8, 25.5, 0.3), "t2"),
                 part("sh_rose", (6, 25.5, -0.7), (7.2, 26.6, 0.5), "t"),
                 part("sh_thorn", (8, 25.5, -0.1), (8.3, 26.3, 0.2), "s2")])
    return p


def prism():
    p = ring("circlet", 29.8, 30.2, "l")
    for i, ((x, y, z), mat) in enumerate((((6, 31, 0), "s1"), ((-6, 33, 0), "s2"), ((0, 32, 6), "a"),
                                          ((4.2, 34, -4.2), "g"), ((-4.2, 30, 4.2), "t"), ((-4.2, 35, -4.2), "l"),
                                          ((4.2, 29.6, 4.2), "t2"))):
        p.append(part(f"prism{i}", (x - 0.5, y - 1.5, z - 0.5), (x + 0.5, y + 1.5, z + 0.5), mat,
                      glow=mat == "g", rot=yr(45, (x, y, z))))
    p += mirror([part("float", (6.8, 27, -0.4), (7.6, 29, 0.4), "g", glow=True, rot=yr(45, (7.2, 28, 0)))])
    return p


def cowboy():
    p = [part("brim", (-4.2, 32, -6.4), (4.2, 32.4, 6.4), "m"),
         part("crown", (-3.6, 32.4, -3.8), (3.6, 35, 3.8), "m"),
         part("crease", (-0.5, 34.6, -3.2), (0.5, 35.1, 3.2), "d"),
         part("band", (-3.7, 32.4, -3.9), (3.7, 33.1, 3.9), "t"),
         part("star", (-0.5, 32.5, -4), (0.5, 33.3, -3.95), "g", glow=True, rot=zr(45, (0, 32.9, -3.97))),
         part("bandana", (-2.4, 22.4, -3.6), (2.4, 24.4, -3.1), "t2"),
         part("bandana_tip", (-1.2, 21.6, -3.6), (1.2, 22.4, -3.1), "t2")]
    p += mirror([part("brim_side", (4.2, 32, -6.4), (7, 32.4, 6.4), "m", rot=zr(22.5, (4.2, 32.2, 0))),
                 part("dent", (2.6, 34.6, -2.6), (3.6, 35.2, 2.6), "b")])
    return p


def monk():
    p = ring("band", 29.6, 30.2, "s1") + [
        part("eye", (-0.4, 30.3, -4.9), (0.4, 31.1, -4.6), "g", glow=True),
        part("knot", (-0.9, 32, 1.4), (0.9, 33.4, 3.2), "o"),
        part("big_bead", (-0.6, 22.4, -3.8), (0.6, 23.6, -3.2), "a")]
    for i, x in enumerate((-3, -1.8, 1.8, 3)):
        p.append(part(f"bead{i}", (x - 0.45, 23.4 + abs(x) * 0.25, -3.7), (x + 0.45, 24.3 + abs(x) * 0.25, -3.2),
                      "t"))
    p += mirror([part("bead_s", (3.6, 24.4, -2.6), (4.4, 25.2, -1.8), "t"),
                 part("bead_s2", (3.6, 24.6, -0.4), (4.4, 25.4, 0.4), "t"),
                 part("bead_b", (3.6, 24.4, 2), (4.4, 25.2, 2.8), "t")])
    return p


def redstone():
    p = ring("band", 30.4, 32, "d") + [
        part("dome", (-4.4, 32, -4.4), (4.4, 33.6, 4.4), "t"),
        part("visor", (-4.4, 32, -6), (4.4, 32.4, -4.4), "t"),
        part("ridge", (-0.6, 33.6, -4), (0.6, 34, 4), "t2"),
        part("lamp", (-1, 32.6, -5), (1, 34.2, -4.4), "g", glow=True)]
    p += mirror([part("torch", (4.4, 30, -0.3), (4.9, 33, 0.3), "a"),
                 part("torch_tip", (4.35, 33, -0.4), (4.95, 33.7, 0.4), "g", glow=True),
                 part("pad", (5.2, 25, -1.6), (8.2, 25.4, 1.6), "s2"),
                 part("pad_torch", (5.8, 25.4, -0.25), (6.3, 26.8, 0.25), "t2"),
                 part("pad_torch_tip", (5.75, 26.8, -0.3), (6.35, 27.3, 0.3), "g", glow=True),
                 part("pad_dust", (6.8, 25.4, -1), (7.8, 25.5, 1), "t")])
    return p


def oxidized():
    p = ring("rim", 30, 31.4, "m") + [
        part("cap", (-4.6, 31.4, -4.6), (4.6, 32.6, 4.6), "pat_patina"),
        part("rod", (-0.3, 32.6, -0.3), (0.3, 37, 0.3), "l"),
        part("rod_tip", (-0.45, 37, -0.45), (0.45, 37.8, 0.45), "l"),
        part("spark", (0.6, 37.2, -0.2), (1, 37.6, 0.2), "g", glow=True),
        part("spark2", (-1.1, 36, 0.1), (-0.7, 36.4, 0.5), "g", glow=True)]
    p += mirror([part("cheek", (4.3, 26.4, -4.8), (4.9, 30, -2.4), "t"),
                 part("rivet", (2.6, 30.5, -4.8), (3.2, 31, -4.7), "l"),
                 part("pauldron", (4.8, 25, -2.6), (9, 26, 2.6), "pat_patina"),
                 part("pauldron2", (5.4, 26, -2), (8.4, 26.6, 2), "m"),
                 part("pauldron_rivet", (6.6, 26.6, -0.3), (7.2, 26.9, 0.3), "t")])
    return p


def candy():
    p = ring("band", 29.6, 30.2, "t") + [
        part("gum0", (-2, 30.2, -5), (-1, 31.2, -4.4), "s1"),
        part("gum1", (1, 30.2, -5), (2, 31.2, -4.4), "s2"),
        part("gum2", (-0.5, 30.2, -5.1), (0.5, 31.2, -4.5), "g", glow=True),
        part("stick", (-0.2, 26, 4.6), (0.2, 33, 5), "a"),
        part("lolly", (-2.4, 32, 4.7), (2.4, 36.8, 5.1), "pat_candy")]
    p += mirror([part("cane", (3.2, 31, -0.4), (4, 35, 0.4), "pat_candy"),
                 part("cane_hook", (2.2, 35, -0.4), (4, 35.8, 0.4), "pat_candy"),
                 part("cane_end", (2.2, 34.2, -0.4), (2.8, 35, 0.4), "pat_candy"),
                 part("sweet", (5.6, 25, -0.8), (7.6, 26.4, 0.8), "t"),
                 part("wrap0", (5, 25.3, -0.5), (5.6, 26.1, 0.5), "a"),
                 part("wrap1", (7.6, 25.3, -0.5), (8.2, 26.1, 0.5), "a")])
    return p


def vampire():
    p = [part("collar", (-5, 22.5, 4.45), (5, 31.5, 4.8), "b"),
         part("collar_in", (-4.8, 23, 4.1), (4.8, 31, 4.45), "t2"),
         part("circlet", (-4.6, 30, -4.8), (4.6, 30.5, -4.5), "t"),
         part("ruby", (-0.5, 29.6, -4.95), (0.5, 30.8, -4.75), "g", glow=True),
         part("bat", (5.6, 32, -1), (6.2, 32.6, -0.4), "o"),
         part("bat_wing", (4.8, 32.2, -0.9), (7, 32.5, -0.5), "o", rot=zr(22.5, (5.9, 32.35, -0.7)))]
    p += mirror([part("flare", (4.4, 22.5, -0.5), (5.4, 30, 4.2), "b", rot=yr(-22.5, (4.9, 26, 4))),
                 part("flare_in", (4.2, 23, -0.2), (4.4, 29.5, 4), "t2", rot=yr(-22.5, (4.9, 26, 4))),
                 part("clasp", (2.6, 23.2, -3.4), (3.6, 24.2, -3.05), "t")])
    return p


# ----------------------------------------------------------------------------- sets
def pal(o, d, b, m, l, t, t2, a, g, s1, s2):
    return dict(o=o, d=d, b=b, m=m, l=l, t=t, t2=t2, a=a, g=g, s1=s1, s2=s2)


SETS2 = [
    dict(id="obsidian", name="Obsidian Warden", color="&5", pattern="obsidian", secondary="chain",
         pal=pal((8, 4, 14), (20, 12, 32), (38, 24, 58), (64, 42, 92), (100, 72, 140), (150, 110, 200), (70, 50, 100),
                 (190, 160, 230), (200, 90, 255), (120, 80, 160), (60, 40, 80)),
         emblem=["...gg...", "..g..g..", ".g.mm.g.", "..g..g..", "...gg..."], helmet=obsidian,
         recipe=dict(A="CRYING_OBSIDIAN", B="ENDER_EYE", C="OBSIDIAN"), perk={"knockbackResistance": 0.1},
         mob=("ENDERMAN", 4), seal=(150, 70, 230),
         lore=["&7Cut from the walls of", "&7a portal that never opened."],
         story=["Crying obsidian, stitched with ender eyes. It still weeps when struck.",
                "Tools that bite through stone like it owes them money.",
                "The blade hums with the purple light of a sealed portal."],
         tools=TS((70, 48, 100), (30, 20, 40), (150, 110, 200), (200, 90, 255), sword="greatsword", guard="horns",
                  pommel="spike", deco="cracks", grip="wrap", axe="double", pick="hammer", shovel="spade",
                  hoe="scythe", bow="angular", bow_tips="spike", bow_mat="metal", string=(200, 90, 255))),
    dict(id="magma", name="Magmaforged", color="&6", pattern="flame", secondary="obsidian",
         pal=pal((20, 8, 4), (60, 24, 14), (110, 44, 20), (190, 80, 20), (250, 150, 40), (60, 50, 50), (35, 30, 30),
                 (250, 200, 90), (255, 170, 40), (80, 70, 70), (40, 34, 34)),
         emblem=["..gg....", ".gllg...", ".gllgg..", "..gggg..", "...gg..."], helmet=magma,
         recipe=dict(A="MAGMA_BLOCK", B="GHAST_TEAR", C="BLAZE_ROD"), perk={"attackDamage": 0.5},
         mob=("MAGMA_CUBE", 5), seal=(230, 100, 20),
         lore=["&7Poured, not forged.", "&7Still cooling, a hundred years later."],
         story=["Magma cream and ghast tears, cooled in a basalt mould.",
                "The heads glow when you mine. Please do not lick them.",
                "It leaves little burn marks on everything it touches."],
         tools=TS((70, 60, 60), (40, 30, 28), (250, 150, 40), (255, 170, 40), sword="cleaver", guard="collar",
                  pommel="orb", deco="cracks", grip="wrap", axe="bearded", pick="hammer", shovel="round",
                  hoe="blade", bow="angular", bow_tips="flame", bow_mat="metal", string=(255, 200, 80))),
    dict(id="storm", name="Stormcaller", color="&e", pattern="plate", secondary="chain",
         pal=pal((16, 20, 30), (50, 60, 80), (90, 104, 128), (130, 146, 170), (190, 204, 222), (220, 200, 90),
                 (150, 130, 50), (240, 240, 250), (255, 250, 130), (170, 176, 190), (110, 116, 130)),
         emblem=["....g...", "...gg...", "..gggg..", "...gg...", "...g....", "..g....."], helmet=storm,
         recipe=dict(A="WIND_CHARGE", B="DIAMOND", C="LIGHTNING_ROD"), perk={"movementSpeed": 0.004},
         mob=("BREEZE", 6), seal=(240, 220, 60),
         lore=["&7It smells like rain", "&7right before the lightning."],
         story=["Forged in a thunderstorm on top of a lightning rod. Twice.",
                "Every swing crackles. Your hair will stand up.",
                "The bowstring is a thread of lightning."],
         tools=TS((140, 156, 180), (50, 60, 80), (220, 200, 90), (255, 250, 130), sword="wavy", guard="wings",
                  pommel="orb", deco="vein", grip="spiral", axe="halberd", pick="straight", shovel="pointed",
                  hoe="rake", bow="double", bow_tips="gem", bow_mat="metal", string=(255, 250, 130))),
    dict(id="void", name="Voidwalker", color="&d", pattern="stars", secondary="cloth",
         pal=pal((6, 4, 12), (22, 14, 36), (40, 26, 62), (70, 46, 104), (140, 110, 190), (210, 170, 230),
                 (130, 90, 160), (240, 230, 190), (230, 120, 255), (90, 60, 130), (50, 34, 70)),
         emblem=["g......g", ".g....g.", "...gg...", "...gg...", ".g....g.", "g......g"], helmet=void,
         recipe=dict(A="CHORUS_FRUIT", B="SHULKER_SHELL", C="END_ROD"), perk={"movementSpeed": 0.003},
         mob=("SHULKER", 6), seal=(200, 110, 230),
         lore=["&7Stitched from the space", "&7between the stars."],
         story=["Woven from chorus fibre and lined with shulker shell.",
                "The tools blink out of existence for a second when swung.",
                "Arrows from this bow arrive slightly before you fire them."],
         tools=TS((100, 70, 150), (30, 20, 44), (210, 170, 230), (230, 120, 255), sword="needle", guard="crescent",
                  pommel="orb", deco="stars", grip="spiral", axe="moon", pick="single", shovel="trowel",
                  hoe="sickle", bow="recurve", bow_tips="gem", bow_mat="metal", string=(230, 120, 255))),
    dict(id="celestial", name="Celestial", color="&9", pattern="stars", secondary="plate",
         pal=pal((8, 10, 30), (20, 26, 70), (32, 42, 110), (52, 70, 160), (110, 140, 220), (240, 200, 90),
                 (170, 130, 50), (250, 250, 255), (255, 240, 150), (70, 90, 190), (40, 50, 120)),
         emblem=["...g....", "..ggg...", "gggggggg", "..ggg...", ".g...g..", "g.....g."], helmet=celestial,
         recipe=dict(A="LAPIS_BLOCK", B="GLOWSTONE", C="GOLD_INGOT"), perk={"luck": 1},
         mob=("PHANTOM", 6), seal=(60, 80, 200),
         lore=["&7Map the stars on your chest,", "&7and never get lost again."],
         story=["The night sky, folded into plate and pinned with gold.",
                "Every tool points north, no matter which way you hold it.",
                "The sword is a sliver of a falling star."],
         tools=TS((60, 80, 170), (30, 30, 60), (240, 200, 90), (255, 240, 150), sword="broad", guard="wings",
                  pommel="gem", deco="stars", grip="bands", axe="flared", pick="arched", shovel="pointed",
                  hoe="sickle", bow="smooth", bow_tips="gem", bow_mat="accent", string=(255, 240, 150))),
    dict(id="solar", name="Sunforged", color="&6", pattern="plate", secondary="stripes",
         pal=pal((50, 26, 4), (160, 90, 20), (220, 140, 30), (245, 185, 50), (255, 230, 130), (255, 250, 220),
                 (230, 160, 60), (200, 60, 30), (255, 250, 170), (250, 210, 90), (220, 120, 40)),
         emblem=["g..g..g.", ".g.g.g..", "..ggg...", "gggggggg", "..ggg...", ".g.g.g.."], helmet=solar,
         recipe=dict(A="GOLD_INGOT", B="SUNFLOWER", C="BLAZE_ROD"), perk={"maxHealth": 1},
         mob=("BLAZE", 4), seal=(250, 180, 40),
         lore=["&7Polished until it", "&7outshines the sun."],
         story=["Gold, sunflowers and blaze fire, hammered at high noon.",
                "The tools are warm to the touch, even at midnight.",
                "The blade leaves a streak of daylight behind it."],
         tools=TS((245, 190, 60), (160, 60, 30), (255, 250, 220), (255, 250, 170), sword="greatsword",
                  guard="disc", pommel="gem", deco="core", grip="bands", axe="flared", pick="winged",
                  shovel="spade", hoe="scythe", bow="recurve", bow_tips="flame", bow_mat="metal",
                  string=(255, 250, 200))),
    dict(id="moonlit", name="Moonlit", color="&7", pattern="feather", secondary="cloth",
         pal=pal((10, 12, 28), (24, 30, 66), (38, 48, 98), (62, 76, 136), (140, 156, 206), (222, 226, 238),
                 (150, 158, 184), (244, 240, 220), (170, 220, 255), (46, 56, 110), (84, 96, 150)),
         emblem=["..llll..", ".ll.....", "ll......", "ll......", ".ll.....", "..llll.."], helmet=lunar,
         recipe=dict(A="PHANTOM_MEMBRANE", B="DIAMOND", C="QUARTZ"), perk={"movementSpeed": 0.004},
         mob=("PHANTOM", 5), seal=(170, 190, 230),
         lore=["&7Light as moonlight,", "&7and just as quiet."],
         story=["Phantom membrane silvered under a full moon.",
                "Moon-steel tools, pale and cold and very sharp.",
                "The bow is strung with a single moonbeam."],
         tools=TS((200, 206, 226), (70, 76, 100), (240, 240, 230), (170, 220, 255), sword="scimitar",
                  guard="crescent", pommel="crescent", deco="edge", grip="plain", axe="moon", pick="arched",
                  shovel="trowel", hoe="sickle", bow="long", bow_tips="gem", bow_mat="metal",
                  string=(200, 230, 255))),
    dict(id="viking", name="Norse Raider", color="&7", pattern="chain", secondary="fur",
         pal=pal((24, 18, 14), (70, 60, 52), (120, 110, 100), (160, 150, 140), (200, 192, 180), (180, 130, 60),
                 (110, 80, 40), (236, 226, 200), (240, 200, 110), (120, 80, 50), (200, 190, 160)),
         emblem=["t......t", ".t....t.", "..tttt..", "..t..t..", "..tttt.."], helmet=viking,
         recipe=dict(A="IRON_INGOT", B="GOAT_HORN", C="SPRUCE_LOG"), perk={"attackDamage": 1},
         mob=("VINDICATOR", 5), seal=(150, 110, 60),
         lore=["&7Less armor, more axe.", "&7That is the Norse way."],
         story=["Iron, fur and a goat horn, blessed at a longship funeral.",
                "Every tool is also a weapon if you swing it hard enough.",
                "The axe is the sword. The sword is also an axe."],
         tools=TS((160, 150, 140), (120, 80, 50), (180, 130, 60), (240, 200, 110), sword="broad", guard="collar",
                  pommel="ring", deco="runes", grip="wrap", axe="bearded", pick="straight", shovel="spade",
                  hoe="blade", bow="long", bow_tips="bone", bow_mat="handle", string=(220, 210, 190))),
    dict(id="spartan", name="Spartan", color="&c", pattern="plate", secondary="leather",
         pal=pal((40, 20, 10), (120, 70, 30), (170, 110, 50), (205, 145, 70), (235, 190, 110), (180, 30, 30),
                 (110, 16, 16), (250, 230, 190), (255, 210, 120), (140, 90, 50), (90, 60, 40)),
         emblem=["t......t", ".t....t.", "..t..t..", "...tt...", "...tt..."], helmet=spartan,
         recipe=dict(A="COPPER_INGOT", B="IRON_BLOCK", C="OAK_LOG"), perk={"attackDamage": 1},
         mob=("PILLAGER", 5), seal=(180, 30, 30),
         lore=["&7Come back with your shield,", "&7or on it."],
         story=["Bronze and iron, hammered by three hundred smiths.",
                "Tools for digging trenches and holding them.",
                "A short sword, because you should be that close."],
         tools=TS((205, 145, 70), (90, 60, 40), (180, 30, 30), (255, 210, 120), sword="gladius", guard="collar",
                  pommel="orb", deco="fuller", grip="wrap", axe="flared", pick="straight", shovel="pointed",
                  hoe="blade", bow="smooth", bow_tips="spike", bow_mat="handle", string=(220, 200, 160))),
    dict(id="jaguar", name="Jaguar Warrior", color="&6", pattern="spots", secondary="feather",
         pal=pal((30, 20, 8), (110, 70, 20), (170, 110, 30), (220, 160, 50), (245, 210, 110), (40, 150, 120),
                 (20, 90, 70), (245, 240, 220), (120, 255, 200), (40, 160, 80), (40, 90, 200)),
         emblem=["..tttt..", ".t.gg.t.", "t.g..g.t", ".t.gg.t.", "..tttt.."], helmet=jaguar,
         recipe=dict(A="LEATHER", B="EMERALD", C="BAMBOO"), perk={"movementSpeed": 0.006},
         mob=("SPIDER", 5), seal=(40, 150, 120),
         lore=["&7Wear the jaguar,", "&7move like the jaguar."],
         story=["Jaguar pelt and jade feathers, blessed at the temple steps.",
                "Obsidian-edged tools, sharp as the day they were knapped.",
                "A club of teeth and a bow of green feathers."],
         tools=TS((30, 30, 36), (170, 110, 30), (40, 150, 120), (120, 255, 200), sword="serrated", guard="fins",
                  pommel="tassel", deco="edge", grip="bands", axe="hatchet", pick="single", shovel="pointed",
                  hoe="claw", bow="recurve", bow_tips="feather", bow_mat="accent", string=(245, 240, 220))),
    dict(id="bone", name="Bonecarver", color="&f", pattern="bone", secondary="leather",
         pal=pal((30, 22, 16), (80, 60, 44), (120, 92, 66), (150, 118, 88), (190, 160, 124), (110, 40, 30),
                 (60, 30, 20), (236, 228, 206), (255, 120, 80), (200, 190, 166), (170, 160, 136)),
         emblem=[".aaaaaa.", "aa.aa.aa", "aaaaaaaa", ".a.aa.a.", "..a..a.."], helmet=bone,
         recipe=dict(A="BONE_BLOCK", B="SKELETON_SKULL", C="BONE"), perk={"attackSpeed": 0.1},
         mob=("SKELETON", 5), seal=(200, 190, 166),
         lore=["&7Every bone was earned.", "&7Most of them were skeletons."],
         story=["Bones of a hundred skeletons, lashed with leather.",
                "Carved bone tools. They rattle a little.",
                "A jawbone sword and a ribcage bow."],
         tools=TS((230, 222, 200), (110, 80, 56), (110, 40, 30), (255, 120, 80), sword="bone", guard="horns",
                  pommel="skull", deco="none", grip="wrap", axe="hatchet", pick="single", shovel="trowel",
                  hoe="claw", bow="bone", bow_tips="bone", bow_mat="metal", string=(160, 120, 90))),
    dict(id="pirate", name="Pirate Captain", color="&4", pattern="cloth", secondary="leather",
         pal=pal((20, 12, 12), (70, 16, 20), (130, 24, 30), (170, 40, 44), (210, 80, 80), (230, 190, 80),
                 (150, 110, 40), (240, 236, 220), (255, 220, 120), (60, 160, 60), (230, 60, 40)),
         emblem=["..aaaa..", ".a.aa.a.", ".aaaaaa.", "..a..a..", "a.a..a.a", ".a....a."], helmet=pirate,
         recipe=dict(A="RED_WOOL", B="GOLD_INGOT", C="DARK_OAK_LOG"), perk={"luck": 1},
         mob=("DROWNED", 5), seal=(130, 24, 30),
         lore=["&7Stolen, obviously.", "&7From another pirate."],
         story=["A captain's coat, taken from a captain who no longer needed it.",
                "Tools for digging up treasure. X marks the spot.",
                "A cutlass for boarding and a bow for everything else."],
         tools=TS((200, 204, 214), (80, 50, 30), (230, 190, 80), (255, 220, 120), sword="scimitar", guard="ring",
                  pommel="gem", deco="fuller", grip="wrap", axe="hatchet", pick="arched", shovel="spade",
                  hoe="blade", bow="smooth", bow_tips="spike", bow_mat="handle", string=(220, 210, 180))),
    dict(id="neon", name="Neon Runner", color="&b", pattern="circuit", secondary="plate",
         pal=pal((6, 6, 12), (18, 18, 30), (30, 30, 46), (50, 50, 72), (90, 90, 120), (255, 60, 200),
                 (150, 30, 120), (60, 255, 240), (60, 255, 240), (255, 60, 200), (80, 80, 110)),
         emblem=["aaaaaaaa", "a......a", "a.gggg.a", "a......a", "aaaaaaaa"], helmet=neon,
         recipe=dict(A="GLOW_INK_SAC", B="DIAMOND", C="END_ROD"), perk={"movementSpeed": 0.008},
         mob=("CREEPER", 4), seal=(60, 255, 240),
         lore=["&7Built for speed,", "&7lit up like a city."],
         story=["Glow ink circuits printed on featherweight plate.",
                "The tools have an on switch. Nobody has found it.",
                "A light-blade. It goes vwoom."],
         tools=TS((40, 40, 60), (18, 18, 30), (255, 60, 200), (60, 255, 240), sword="rapier", guard="bar_gem",
                  pommel="ring", deco="core", grip="spiral", axe="cleaver", pick="straight", shovel="spade",
                  hoe="rake", bow="angular", bow_tips="gem", bow_mat="metal", bow_studs=True,
                  string=(60, 255, 240))),
    dict(id="amethyst", name="Geode", color="&d", pattern="crystal", secondary="plate",
         pal=pal((20, 10, 30), (70, 40, 100), (120, 70, 170), (160, 110, 210), (210, 170, 245), (80, 80, 90),
                 (50, 50, 60), (240, 230, 250), (250, 190, 255), (130, 130, 140), (100, 100, 110)),
         emblem=["...g....", "..lml...", ".lmmml..", "..lml...", "...m...."], helmet=amethyst,
         recipe=dict(A="AMETHYST_BLOCK", B="AMETHYST_CLUSTER", C="CALCITE"), perk={"maxHealth": 1},
         mob=("CAVE_SPIDER", 5), seal=(160, 110, 210),
         lore=["&7Cracked open from", "&7a geode deep underground."],
         story=["Grown inside a geode for a thousand years.",
                "Crystal tools that chime when they hit stone.",
                "The blade sings. It is a little off-key."],
         tools=TS((160, 110, 210), (80, 80, 90), (220, 220, 230), (250, 190, 255), sword="crystal", guard="ring",
                  pommel="gem", deco="facets", grip="plain", axe="double", pick="crystal", shovel="pointed",
                  hoe="claw", bow="angular", bow_tips="gem", bow_mat="metal", string=(250, 190, 255))),
    dict(id="jade", name="Jade Emperor", color="&a", pattern="marble", secondary="quilt",
         pal=pal((10, 30, 20), (30, 90, 60), (50, 140, 90), (90, 190, 130), (170, 230, 190), (230, 190, 70),
                 (160, 120, 40), (200, 40, 40), (200, 255, 220), (230, 60, 50), (40, 110, 70)),
         emblem=["tttttttt", "t..tt..t", "t.tggt.t", "t..tt..t", "tttttttt"], helmet=jade,
         recipe=dict(A="EMERALD", B="GOLD_BLOCK", C="BAMBOO"), perk={"knockbackResistance": 0.05},
         mob=("EVOKER", 10), seal=(50, 140, 90),
         lore=["&7Robes of the jade throne,", "&7heavier than they look."],
         story=["Carved from one jade stone, gilded in the palace forge.",
                "Imperial tools. Using one is technically an honour.",
                "A dao of jade and a bow the emperor never used."],
         tools=TS((90, 190, 130), (180, 40, 40), (230, 190, 70), (200, 255, 220), sword="leaf", guard="disc",
                  pommel="tassel", deco="fuller", grip="bands", axe="moon", pick="winged", shovel="round",
                  hoe="sickle", bow="recurve", bow_tips="gem", bow_mat="accent", string=(230, 60, 50))),
    dict(id="sculk", name="Sculk Stalker", color="&3", pattern="rune", secondary="cloth",
         pal=pal((4, 12, 16), (8, 30, 38), (14, 52, 64), (22, 80, 96), (40, 130, 150), (40, 200, 210),
                 (20, 110, 120), (200, 240, 240), (60, 240, 250), (30, 90, 100), (16, 50, 60)),
         emblem=["g......g", ".g.gg.g.", "..gggg..", ".g.gg.g.", "g......g"], helmet=sculk,
         recipe=dict(A="SCULK", B="ECHO_SHARD", C="SCULK_VEIN"), perk={"movementSpeed": 0.004},
         mob=("WARDEN", 50), seal=(40, 200, 210),
         lore=["&7It hears you coming.", "&7So it made you quieter."],
         story=["Grown in the deep dark. It shivers when you walk.",
                "The tools whisper back every sound they make.",
                "A blade that can hear heartbeats."],
         tools=TS((30, 90, 110), (10, 30, 38), (200, 240, 240), (60, 240, 250), sword="serrated", guard="fins",
                  pommel="claw", deco="vein", grip="spiral", axe="moon", pick="single", shovel="scoop",
                  hoe="claw", bow="double", bow_tips="gem", bow_mat="metal", string=(60, 240, 250))),
    dict(id="sakura", name="Sakura", color="&d", pattern="petal", secondary="cloth",
         pal=pal((40, 20, 30), (170, 80, 120), (230, 140, 180), (250, 180, 210), (255, 225, 240), (110, 60, 40),
                 (70, 40, 30), (255, 255, 255), (255, 240, 250), (250, 200, 220), (200, 120, 160)),
         emblem=["..l.l...", ".lmlml..", "..lgl...", ".lmlml..", "..l.l..."], helmet=sakura,
         recipe=dict(A="PINK_PETALS", B="DIAMOND", C="CHERRY_LOG"), perk={"movementSpeed": 0.005},
         mob=("FOX", 20), seal=(230, 140, 180),
         lore=["&7Falls apart beautifully,", "&7grows back every spring."],
         story=["Petals pressed between silk, from the oldest cherry tree.",
                "Cherrywood tools. They smell lovely.",
                "The blade scatters petals when drawn."],
         tools=TS((245, 200, 220), (110, 60, 40), (255, 255, 255), (255, 170, 210), sword="katana", guard="disc",
                  pommel="tassel", deco="stars", grip="wrap", axe="hatchet", pick="arched", shovel="trowel",
                  hoe="sickle", bow="branch", bow_tips="leaf", bow_mat="handle", string=(255, 225, 240))),
    dict(id="hive", name="Honeyguard", color="&e", pattern="hex", secondary="stripes",
         pal=pal((30, 20, 6), (140, 90, 10), (220, 150, 20), (245, 190, 40), (255, 225, 110), (30, 26, 20),
                 (60, 50, 36), (255, 210, 60), (255, 200, 60), (250, 240, 200), (230, 230, 240)),
         emblem=["..tttt..", ".t.aa.t.", ".taaaat.", ".t.aa.t.", "..tttt.."], helmet=hive,
         recipe=dict(A="HONEYCOMB", B="HONEY_BLOCK", C="STRIPPED_BIRCH_LOG"), perk={"maxHealth": 1},
         mob=("BEE", 20), seal=(245, 190, 40),
         lore=["&7Sticky, sweet, and", "&7surprisingly tough."],
         story=["Honeycomb plates sealed with fresh honey.",
                "Tools with a sting in them.",
                "A stinger sword and a bow that hums."],
         tools=TS((245, 190, 40), (60, 50, 36), (30, 26, 20), (255, 230, 120), sword="needle", guard="wings",
                  pommel="gem", deco="stripes", grip="bands", axe="flared", pick="arched", shovel="scoop",
                  hoe="rake", bow="smooth", bow_tips="gem", bow_mat="metal", alt=(40, 34, 26),
                  string=(250, 240, 200))),
    dict(id="nomad", name="Desert Nomad", color="&e", pattern="cloth", secondary="stripes",
         pal=pal((50, 36, 20), (150, 110, 70), (200, 160, 110), (225, 195, 145), (245, 225, 185), (60, 110, 160),
                 (36, 70, 110), (250, 240, 220), (120, 220, 255), (180, 80, 50), (140, 60, 40)),
         emblem=["........", "..tttt..", "..t..t..", "..tttt..", "........"], helmet=nomad,
         recipe=dict(A="SANDSTONE", B="GOLD_INGOT", C="DEAD_BUSH"), perk={"movementSpeed": 0.005},
         mob=("HUSK", 5), seal=(200, 160, 110),
         lore=["&7Wrapped against the sun,", "&7light enough to walk forever."],
         story=["Desert cloth, woven to keep out sand and sun.",
                "Tools for finding water under dunes.",
                "A curved knife and a bow of sun-bleached wood."],
         tools=TS((230, 220, 200), (150, 110, 70), (60, 110, 160), (120, 220, 255), sword="scimitar",
                  guard="droop", pommel="crescent", deco="fuller", grip="wrap", axe="moon", pick="single",
                  shovel="pointed", hoe="sickle", bow="recurve", bow_tips="spike", bow_mat="handle",
                  string=(245, 225, 185))),
    dict(id="plague", name="Plague Doctor", color="&8", pattern="leather", secondary="quilt",
         pal=pal((10, 8, 8), (30, 26, 24), (50, 44, 40), (72, 64, 58), (104, 94, 86), (150, 120, 70),
                 (90, 70, 40), (220, 210, 190), (140, 255, 120), (60, 54, 48), (40, 36, 32)),
         emblem=["...tt...", "..tttt..", "...tt...", "..t..t..", ".t....t."], helmet=plague,
         recipe=dict(A="LEATHER", B="FERMENTED_SPIDER_EYE", C="BONE"), perk={"maxHealth": 1},
         mob=("WITCH", 6), seal=(140, 255, 120),
         lore=["&7The beak is full of herbs.", "&7It does not help."],
         story=["Waxed leather, sealed tight against the miasma.",
                "Surgical tools. Mostly for mining. Mostly.",
                "A scalpel of a sword and a bow of dark wood."],
         tools=TS((180, 180, 186), (50, 44, 40), (150, 120, 70), (140, 255, 120), sword="needle", guard="collar",
                  pommel="ring", deco="core", grip="wrap", axe="cleaver", pick="single", shovel="scoop",
                  hoe="claw", bow="long", bow_tips="spike", bow_mat="handle", string=(140, 255, 120))),
    dict(id="necro", name="Necromancer", color="&2", pattern="bone", secondary="rune",
         pal=pal((8, 12, 8), (24, 34, 24), (40, 54, 40), (60, 80, 60), (100, 130, 100), (80, 90, 80),
                 (40, 46, 40), (220, 216, 190), (120, 255, 160), (190, 184, 160), (160, 154, 130)),
         emblem=[".aaaaaa.", "aggaagga", "aaaaaaaa", ".aa..aa.", ".a.aa.a."], helmet=necro,
         recipe=dict(A="SOUL_SAND", B="SOUL_LANTERN", C="SOUL_TORCH"), perk={"attackDamage": 0.5},
         mob=("WITHER_SKELETON", 5), seal=(120, 255, 160),
         lore=["&7The dead do the heavy", "&7lifting. You do the rest."],
         story=["Souls bound into plate. They are mostly fine with it.",
                "The tools dig graves very efficiently.",
                "A soul-blade and a bow of bone and green fire."],
         tools=TS((80, 110, 80), (40, 46, 40), (220, 216, 190), (120, 255, 160), sword="bone", guard="horns",
                  pommel="skull", deco="vein", grip="spiral", axe="moon", pick="winged", shovel="pointed",
                  hoe="scythe", bow="bone", bow_tips="bone", bow_mat="metal", string=(120, 255, 160))),
    dict(id="royal", name="Royal Guard", color="&9", pattern="quilt", secondary="stripes",
         pal=pal((10, 12, 30), (30, 36, 90), (40, 50, 130), (60, 76, 170), (110, 130, 210), (230, 190, 70),
                 (200, 30, 40), (250, 250, 250), (255, 240, 170), (190, 30, 40), (30, 26, 30)),
         emblem=["t.t.t.t.", "tttttttt", "t.tggt.t", "tttttttt", "..tttt.."], helmet=royal,
         recipe=dict(A="BLUE_WOOL", B="GOLD_BLOCK", C="IRON_BARS"), perk={"knockbackResistance": 0.05},
         mob=("PILLAGER", 4), seal=(40, 50, 130),
         lore=["&7Stand still. Look serious.", "&7Protect the crown."],
         story=["Dress uniform of the palace guard, gold braid included.",
                "Ceremonial tools, polished to a mirror shine.",
                "A sabre for parades and a bow for everything else."],
         tools=TS((220, 224, 234), (30, 36, 90), (230, 190, 70), (255, 240, 170), sword="rapier", guard="ring",
                  pommel="gem", deco="fuller", grip="bands", axe="halberd", pick="arched", shovel="spade",
                  hoe="blade", bow="smooth", bow_tips="gem", bow_mat="accent", string=(250, 250, 250))),
    dict(id="arcane", name="Arcanist", color="&9", pattern="rune", secondary="cloth",
         pal=pal((10, 10, 30), (30, 30, 80), (50, 50, 120), (80, 80, 170), (140, 140, 220), (220, 180, 80),
                 (150, 110, 40), (240, 230, 200), (130, 200, 255), (100, 60, 170), (60, 40, 110)),
         emblem=["..gggg..", ".g....g.", "g..gg..g", "g..gg..g", ".g....g.", "..gggg.."], helmet=arcane,
         recipe=dict(A="BOOK", B="LAPIS_BLOCK", C="AMETHYST_SHARD"), perk={"luck": 1},
         mob=("EVOKER", 10), seal=(80, 80, 170),
         lore=["&7Every rune is a spell.", "&7Most of them are for tidying."],
         story=["Enchanted robes. The runes rearrange themselves when you read them.",
                "Tools that remember every block they broke.",
                "A spell-blade and a bow that fires thoughts."],
         tools=TS((120, 120, 200), (60, 40, 110), (220, 180, 80), (130, 200, 255), sword="leaf", guard="bar_gem",
                  pommel="orb", deco="runes", grip="spiral", axe="moon", pick="crystal", shovel="trowel",
                  hoe="sickle", bow="double", bow_tips="gem", bow_mat="accent", string=(130, 200, 255))),
    dict(id="seraph", name="Seraph", color="&f", pattern="feather", secondary="plate",
         pal=pal((60, 50, 30), (200, 190, 170), (230, 226, 216), (245, 243, 236), (255, 255, 255), (240, 200, 90),
                 (180, 140, 50), (255, 240, 180), (255, 250, 200), (250, 250, 255), (230, 232, 240)),
         emblem=["t..tt..t", ".t.tt.t.", "..tttt..", "...tt...", "...tt..."], helmet=seraph,
         recipe=dict(A="FEATHER", B="GOLD_BLOCK", C="GOLD_INGOT"), perk={"maxHealth": 1},
         mob=("PHANTOM", 5), seal=(240, 200, 90),
         lore=["&7Six wings, one halo,", "&7no chill whatsoever."],
         story=["Feathers that fell from very high up.",
                "Gilded tools. Heaven does manual labour too.",
                "A flaming sword and a bow of pure light."],
         tools=TS((245, 243, 236), (180, 140, 50), (240, 200, 90), (255, 250, 200), sword="broad", guard="wings",
                  pommel="orb", deco="core", grip="bands", axe="double", pick="winged", shovel="round",
                  hoe="scythe", bow="recurve", bow_tips="feather", bow_mat="accent", string=(255, 250, 200))),
    dict(id="toxic", name="Hazmat", color="&a", pattern="plate", secondary="stripes",
         pal=pal((20, 20, 6), (110, 100, 20), (200, 180, 30), (230, 210, 50), (250, 240, 120), (40, 40, 40),
                 (20, 20, 20), (140, 230, 60), (160, 255, 60), (230, 230, 230), (70, 70, 70)),
         emblem=["...tt...", "..t..t..", ".t.gg.t.", "t..gg..t", "tttttttt"], helmet=toxic,
         recipe=dict(A="SLIME_BLOCK", B="DIAMOND", C="CHAIN"), perk={"knockbackResistance": 0.05},
         mob=("SLIME", 6), seal=(160, 255, 60),
         lore=["&7Do not touch the", "&7green stuff. Seriously."],
         story=["Sealed suit, slime-lined, rated for anything glowing.",
                "Tools coated in something that eats rock.",
                "A blade that drips. Do not ask what it drips."],
         tools=TS((200, 180, 30), (40, 40, 40), (70, 70, 70), (160, 255, 60), sword="cleaver", guard="collar",
                  pommel="ring", deco="edge", grip="bands", axe="cleaver", pick="hammer", shovel="scoop",
                  hoe="rake", bow="angular", bow_tips="gem", bow_mat="metal", string=(160, 255, 60))),
    dict(id="kraken", name="Kraken", color="&5", pattern="slime", secondary="scale",
         pal=pal((16, 6, 20), (50, 20, 60), (90, 40, 100), (130, 60, 140), (180, 110, 180), (60, 140, 160),
                 (30, 80, 100), (240, 200, 220), (120, 255, 240), (110, 50, 120), (70, 30, 80)),
         emblem=["..llll..", ".l.gg.l.", "l.l..l.l", "l.l..l.l", ".l....l."], helmet=kraken,
         recipe=dict(A="INK_SAC", B="NAUTILUS_SHELL", C="DRIED_KELP_BLOCK"), perk={"attackDamage": 0.5},
         mob=("SQUID", 10), seal=(130, 60, 140),
         lore=["&7It has more arms than you.", "&7It will not let you forget it."],
         story=["The skin of something very large and very angry.",
                "Tools that grab the stone before you hit it.",
                "A sword like a tentacle and a bow that squirms."],
         tools=TS((140, 70, 150), (50, 20, 60), (240, 200, 220), (120, 255, 240), sword="wavy", guard="fins",
                  pommel="claw", deco="stars", grip="plain", axe="moon", pick="winged", shovel="scoop",
                  hoe="claw", bow="double", bow_tips="spike", bow_mat="metal", string=(120, 255, 240))),
    dict(id="phoenix", name="Phoenix", color="&c", pattern="feather", secondary="flame",
         pal=pal((40, 10, 4), (150, 30, 10), (210, 70, 20), (240, 120, 30), (255, 190, 70), (255, 220, 100),
                 (200, 120, 30), (255, 250, 200), (255, 240, 120), (250, 100, 30), (200, 40, 20)),
         emblem=["g......g", ".g.gg.g.", "..gllg..", "...gg...", "..g..g.."], helmet=phoenix,
         recipe=dict(A="BLAZE_POWDER", B="GOLDEN_APPLE", C="BLAZE_ROD"), perk={"maxHealth": 1},
         mob=("BLAZE", 5), seal=(240, 120, 30),
         lore=["&7Burns up, comes back.", "&7Every single time."],
         story=["Feathers from a bird that has died a hundred times.",
                "The tools reforge themselves in the forge-fire of the bird.",
                "The bow fires feathers of flame."],
         tools=TS((245, 130, 40), (150, 30, 10), (255, 220, 100), (255, 240, 120), sword="leaf", guard="wings",
                  pommel="orb", deco="core", grip="spiral", axe="flared", pick="winged", shovel="round",
                  hoe="scythe", bow="recurve", bow_tips="flame", bow_mat="metal", string=(255, 240, 120))),
    dict(id="werewolf", name="Werewolf", color="&8", pattern="fur", secondary="leather",
         pal=pal((16, 14, 12), (50, 44, 40), (80, 72, 64), (110, 100, 90), (150, 140, 128), (120, 80, 50),
                 (70, 46, 30), (230, 170, 170), (255, 220, 110), (100, 90, 80), (230, 226, 210)),
         emblem=["........", ".m....m.", "..mmmm..", "..m..m..", "...mm..."], helmet=werewolf,
         recipe=dict(A="RABBIT_HIDE", B="DIAMOND", C="BONE"), perk={"movementSpeed": 0.006},
         mob=("WOLF", 20), seal=(110, 100, 90),
         lore=["&7Full moon tonight.", "&7Good luck with that."],
         story=["It fits better every full moon.",
                "Tools with claw marks in the handles.",
                "Claws are just very short swords."],
         tools=TS((190, 190, 196), (70, 46, 30), (120, 80, 50), (255, 220, 110), sword="serrated", guard="none",
                  pommel="claw", deco="none", grip="wrap", axe="bearded", pick="single", shovel="pointed",
                  hoe="claw", bow="bone", bow_tips="bone", bow_mat="handle", string=(150, 140, 128))),
    dict(id="rose", name="Thornknight", color="&4", pattern="plate", secondary="bark",
         pal=pal((16, 20, 10), (40, 60, 26), (60, 90, 40), (80, 120, 50), (120, 160, 80), (200, 30, 40),
                 (40, 80, 30), (250, 200, 210), (255, 100, 120), (90, 150, 60), (180, 190, 120)),
         emblem=["...tt...", "..tlt...", ".tttt...", "..tt....", ".d......", "d......."], helmet=rose,
         recipe=dict(A="ROSE_BUSH", B="EMERALD", C="VINE"), perk={"attackDamage": 0.5},
         mob=("ZOMBIE", 4), seal=(200, 30, 40),
         lore=["&7Every rose has thorns.", "&7This one has hundreds."],
         story=["Living vines woven into plate, roses still blooming.",
                "The handles grow thorns if you hold them wrong.",
                "A thorn-sword and a bow strung with vine."],
         tools=TS((90, 130, 60), (40, 60, 26), (200, 30, 40), (255, 100, 120), sword="serrated", guard="droop",
                  pommel="gem", deco="vein", grip="wrap", axe="flared", pick="winged", shovel="trowel",
                  hoe="sickle", bow="branch", bow_tips="gem", bow_mat="handle", string=(120, 160, 80))),
    dict(id="prism", name="Prismatic", color="&b", pattern="crystal", secondary="marble",
         pal=pal((30, 30, 40), (150, 160, 190), (200, 210, 230), (230, 236, 248), (255, 255, 255), (255, 120, 180),
                 (120, 180, 255), (255, 230, 120), (180, 255, 250), (140, 255, 160), (190, 140, 255)),
         emblem=["...g....", "..tga...", ".ttgaa..", "tttgaaaa", "........"], helmet=prism,
         recipe=dict(A="TINTED_GLASS", B="DIAMOND", C="AMETHYST_SHARD"), perk={"luck": 1},
         mob=("GUARDIAN", 6), seal=(180, 255, 250),
         lore=["&7Splits the light", "&7into every colour."],
         story=["Glass armour, harder than steel, clear as water.",
                "Each tool casts a rainbow on the wall.",
                "A blade of light, bent through a prism."],
         tools=TS((220, 236, 250), (120, 180, 255), (255, 120, 180), (180, 255, 250), sword="crystal",
                  guard="bar_gem", pommel="gem", deco="facets", grip="spiral", axe="double", pick="crystal",
                  shovel="pointed", hoe="scythe", bow="angular", bow_tips="gem", bow_mat="metal",
                  string=(255, 230, 120))),
    dict(id="cowboy", name="Outlaw", color="&6", pattern="leather", secondary="cloth",
         pal=pal((30, 18, 10), (90, 56, 30), (140, 90, 50), (170, 116, 68), (205, 160, 110), (200, 170, 70),
                 (170, 40, 40), (240, 230, 210), (255, 220, 110), (60, 80, 130), (40, 50, 90)),
         emblem=["...gg...", ".gggggg.", "..gggg..", ".gg..gg.", "........"], helmet=cowboy,
         recipe=dict(A="LEATHER", B="GOLD_INGOT", C="LEAD"), perk={"movementSpeed": 0.004},
         mob=("PILLAGER", 5), seal=(200, 170, 70),
         lore=["&7Wanted: dead or alive.", "&7Reward: this armor."],
         story=["Saddle leather and a sheriff's star. Not his, though.",
                "Tools for panning gold and digging hideouts.",
                "Fastest bow in the west."],
         tools=TS((190, 190, 200), (140, 90, 50), (200, 170, 70), (255, 220, 110), sword="gladius", guard="collar",
                  pommel="ring", deco="fuller", grip="wrap", axe="hatchet", pick="straight", shovel="spade",
                  hoe="blade", bow="smooth", bow_tips="spike", bow_mat="handle", string=(240, 230, 210))),
    dict(id="monk", name="Shaolin", color="&6", pattern="cloth", secondary="cloth",
         pal=pal((50, 20, 6), (170, 70, 10), (220, 110, 20), (240, 150, 40), (255, 200, 110), (110, 60, 30),
                 (70, 36, 20), (240, 200, 120), (255, 240, 160), (180, 40, 30), (120, 30, 20)),
         emblem=["........", "...aa...", "..a..a..", "...aa...", "........"], helmet=monk,
         recipe=dict(A="ORANGE_WOOL", B="EMERALD", C="BAMBOO_BLOCK"), perk={"attackSpeed": 0.1},
         mob=("VINDICATOR", 5), seal=(220, 110, 20),
         lore=["&7The body is the armor.", "&7The robe is a nice extra."],
         story=["Temple robes, blessed by a thousand mornings of practice.",
                "Simple tools. The mind does the work.",
                "A staff-blade and a bow of temple bamboo."],
         tools=TS((200, 190, 170), (110, 60, 30), (240, 150, 40), (255, 240, 160), sword="leaf", guard="collar",
                  pommel="tassel", deco="none", grip="bands", axe="hatchet", pick="straight", shovel="trowel",
                  hoe="blade", bow="long", bow_tips="spike", bow_mat="handle", string=(240, 200, 120))),
    dict(id="redstone", name="Redstone Engineer", color="&c", pattern="circuit", secondary="plate",
         pal=pal((20, 20, 22), (60, 60, 64), (100, 100, 106), (130, 130, 136), (170, 170, 176), (200, 30, 20),
                 (120, 16, 10), (210, 180, 120), (255, 60, 40), (120, 120, 126), (160, 160, 166)),
         emblem=["tttttttt", "t......t", "t.gggg.t", "t.g..g.t", "tttttttt"], helmet=redstone,
         recipe=dict(A="REDSTONE_BLOCK", B="COMPARATOR", C="REPEATER"), perk={"knockbackResistance": 0.05},
         mob=("WITCH", 5), seal=(200, 30, 20),
         lore=["&7Wired for safety.", "&7Probably. Do not test it."],
         story=["Plate wired with redstone. The lamp is decorative. Mostly.",
                "Powered tools. Nobody knows where the battery is.",
                "A blade with a pulse and a bow with a clock."],
         tools=TS((140, 140, 146), (60, 60, 64), (200, 30, 20), (255, 60, 40), sword="cleaver", guard="bar_gem",
                  pommel="gem", deco="runes", grip="spiral", axe="cleaver", pick="hammer", shovel="spade",
                  hoe="rake", bow="angular", bow_tips="gem", bow_mat="metal", bow_studs=True,
                  string=(255, 60, 40))),
    dict(id="oxidized", name="Verdigris", color="&3", pattern="patina", secondary="plate",
         pal=pal((16, 30, 26), (60, 100, 80), (80, 140, 110), (110, 170, 140), (160, 210, 180), (80, 180, 150),
                 (190, 110, 70), (230, 150, 100), (150, 255, 220), (200, 120, 80), (120, 70, 50)),
         emblem=["..tttt..", ".t.gg.t.", ".t.gg.t.", ".t.gg.t.", "..tttt.."], helmet=oxidized,
         recipe=dict(A="COPPER_BLOCK", B="EMERALD", C="LIGHTNING_ROD"), perk={"knockbackResistance": 0.05},
         mob=("DROWNED", 5), seal=(80, 180, 150),
         lore=["&7Weathered green over copper.", "&7Older than the village."],
         story=["Copper left in the rain for a hundred years, then polished once.",
                "Green tools. They were orange once.",
                "A copper blade that calls the lightning down."],
         tools=TS((110, 180, 150), (120, 70, 50), (230, 150, 100), (150, 255, 220), sword="gladius", guard="ring",
                  pommel="orb", deco="stars", grip="bands", axe="halberd", pick="straight", shovel="round",
                  hoe="rake", bow="angular", bow_tips="spike", bow_mat="metal", string=(230, 150, 100))),
    dict(id="candy", name="Candyguard", color="&d", pattern="candy", secondary="quilt",
         pal=pal((60, 20, 40), (190, 80, 130), (240, 140, 180), (255, 180, 210), (255, 220, 235), (230, 40, 60),
                 (160, 20, 40), (255, 255, 255), (255, 250, 160), (120, 220, 140), (130, 180, 255)),
         emblem=["..tttt..", ".tatata.", "tatatata", ".tatata.", "..tttt.."], helmet=candy,
         recipe=dict(A="SUGAR", B="CAKE", C="SUGAR_CANE"), perk={"movementSpeed": 0.005},
         mob=("WITCH", 5), seal=(240, 140, 180),
         lore=["&7Sweet, sticky and", "&7tougher than it looks."],
         story=["Hard candy plates. Do not eat the armor.",
                "Candy-cane tools. They do not taste of mint.",
                "A peppermint blade and a liquorice bow."],
         tools=TS((255, 250, 250), (230, 40, 60), (255, 180, 210), (255, 250, 160), sword="broad", guard="ring",
                  pommel="orb", deco="stripes", grip="bands", axe="flared", pick="arched", shovel="round",
                  hoe="rake", bow="smooth", bow_tips="gem", bow_mat="accent", alt=(230, 40, 60),
                  string=(255, 220, 235))),
    dict(id="vampire", name="Vampire Lord", color="&4", pattern="quilt", secondary="cloth",
         pal=pal((8, 4, 6), (24, 12, 16), (40, 20, 28), (60, 30, 40), (100, 50, 64), (200, 200, 210),
                 (140, 10, 24), (220, 30, 50), (255, 50, 70), (80, 10, 20), (30, 26, 34)),
         emblem=["t......t", "tt....tt", ".tt..tt.", "..tggt..", "...tt..."], helmet=vampire,
         recipe=dict(A="BLACK_WOOL", B="GHAST_TEAR", C="BONE"), perk={"attackDamage": 0.5},
         mob=("BAT", 15), seal=(140, 10, 24),
         lore=["&7Formal wear for eternity.", "&7Allergic to garlic."],
         story=["A count's evening dress, sewn in a castle that is not there.",
                "Silver-free tools, obviously.",
                "A rapier for duels and a bow for bats."],
         tools=TS((200, 200, 210), (40, 20, 28), (140, 10, 24), (255, 50, 70), sword="rapier", guard="wings",
                  pommel="gem", deco="edge", grip="wrap", axe="moon", pick="single", shovel="trowel",
                  hoe="scythe", bow="recurve", bow_tips="gem", bow_mat="accent", string=(220, 30, 50))),
]


import armor_looks  # noqa: E402
for _S in SETS2:
    armor_looks.apply(_S)

# spread tool styles so no two sets share a toolkit (each pair differs in 5+ of 10 choices)
import tool_forge as _TF  # noqa: E402
from armor_sets import SETS as _SETS1  # noqa: E402
_TF.diversify([_S["tools"] for _S in _SETS1 + SETS2])
