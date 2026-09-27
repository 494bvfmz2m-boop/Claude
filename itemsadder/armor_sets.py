"""The themed armor sets. Each entry: palette, surface patterns, painted art,
a head-worn 3D helmet (with shoulder/back extensions), stats, recipe, lore.
Stats sit around diamond level, each with one small perk."""
from armor_engine import mirror, part, shell


def D(armor, dura, toughness, extra=None):
    return {"armor": dict(zip(("helmet", "chestplate", "leggings", "boots"), zip(armor, dura))),
            "toughness": toughness, "extra": extra or {}}


DIAMOND_DURA = (363, 528, 495, 429)
IRONISH_DURA = (220, 320, 300, 260)


# ----------------------------------------------------------------------------- helmets
def frostborn():
    p = [shell(),
         part("fur_rim", (-5.6, 22.6, -5.6), (5.6, 24, 5.6), "pat_fur"),
         part("nose", (-0.6, 25.5, -5.4), (0.6, 30.5, -5.05), "s1")]
    p += mirror([part("horn0", (5, 28, -1.3), (8, 31, 1.3), "m"),
                 part("horn1", (7.4, 29.5, -1.1), (9.6, 33, 1.1), "l"),
                 part("horn2", (8.2, 32.6, -0.8), (9.8, 36.2, 0.8), "a"),
                 part("horn3", (8.5, 36, -0.5), (9.5, 38.4, 0.5), "g", glow=True),
                 part("pad", (3.8, 25, -3.2), (9.4, 26.8, 3.2), "pat_fur"),
                 part("shard0", (6, 26.8, -0.5), (7.2, 30, 0.5), "a"),
                 part("shard0t", (6.2, 30, -0.3), (7, 31.5, 0.3), "g", glow=True),
                 part("shard1", (7.4, 26.8, 0.8), (8.2, 28.8, 1.6), "l")])
    return p


def druid():
    p = [shell()]
    p += mirror([part("antler0", (3, 32.5, -0.5), (4, 35.5, 0.5), "d"),
                 part("antler1", (3.5, 35, -0.5), (6.5, 36, 0.5), "d"),
                 part("antler2", (6, 35.5, -0.4), (7, 38.5, 0.4), "b"),
                 part("antler3", (4.5, 36, -0.4), (5.3, 38.2, 0.4), "b"),
                 part("antler4", (6.5, 38, -0.3), (8.5, 38.8, 0.3), "m"),
                 part("leaf0", (5.2, 34.6, -0.9), (6.4, 35.4, 0.9), "s1"),
                 part("leaf1", (7, 37.4, -0.8), (8, 38.2, 0.6), "s2"),
                 part("flower", (3.2, 35.8, -0.6), (4, 36.6, 0.2), "a"),
                 part("crown_leaf", (3.4, 32.6, -5.3), (5, 33.4, -4.2), "s1"),
                 part("moss", (3.8, 25, -3.2), (9.2, 26.4, 3.2), "t"),
                 part("moss_flower", (6, 26.4, -0.5), (6.8, 27.2, 0.3), "a"),
                 part("fern", (7, 26.4, 0.5), (7.6, 28.4, 1.1), "s2"),
                 part("vine", (2.4, 18, 3.2), (3, 24, 3.6), "t2")])
    return p


def samurai():
    p = [shell(),
         part("shikoro0", (-6, 24, -3), (6, 25.2, 6), "m"),
         part("shikoro1", (-6.6, 22.8, -2.5), (6.6, 24, 6.6), "b"),
         part("shikoro2", (-7.2, 21.6, -2), (7.2, 22.8, 7.2), "d"),
         part("moon_c", (-0.8, 32, -5.6), (0.8, 33.5, -5.1), "t"),
         part("pole", (-0.4, 18, 4.6), (0.4, 40, 5.3), "s1"),
         part("flag", (0.4, 30, 4.75), (6.4, 39.5, 5.15), "s2"),
         part("flag_mon", (2.4, 33.6, 4.7), (4.4, 35.6, 4.75), "m")]
    p += mirror([part("fuki", (5.5, 26, -5.2), (7, 29, -3), "t"),
                 part("moon0", (0.8, 33, -5.5), (2.6, 34.2, -5.2), "t"),
                 part("moon1", (2.4, 34, -5.5), (3.8, 35.8, -5.2), "t"),
                 part("moon2", (3.5, 35.6, -5.5), (4.4, 37.6, -5.2), "t"),
                 part("moon3", (3.9, 37.4, -5.5), (4.5, 38.8, -5.2), "g", glow=True),
                 part("sode0", (3.8, 25, -3), (9.6, 26, 3), "m"),
                 part("sode1", (9.2, 21.5, -3), (10.4, 25, 3), "b"),
                 part("sode2", (9.8, 18.5, -3.1), (11, 21.5, 3.1), "d"),
                 part("cord", (6.4, 26, -0.3), (7.2, 26.8, 0.3), "s2")])
    return p


def pharaoh():
    p = [shell(),
         part("nemes_top", (-5.6, 31, -5.2), (5.6, 33.6, 5.6), "pat_stripes"),
         part("nemes_tail", (-2, 20, 5), (2, 31, 6), "pat_stripes"),
         part("cobra_body", (-0.5, 31.5, -5.8), (0.5, 34, -5.2), "t"),
         part("cobra_hood", (-1.2, 33.5, -6), (1.2, 35, -5.4), "a"),
         part("cobra_eye", (-0.6, 34.2, -6.05), (0.6, 34.6, -6), "g", glow=True),
         part("collar_f", (-5.5, 22.8, -3.4), (5.5, 24.2, -2.6), "a"),
         part("collar_b", (-5.5, 22.8, 2.6), (5.5, 24.2, 3.4), "a")]
    p += mirror([part("lappet", (4.2, 17, -3.9), (5.6, 31, -3.1), "pat_stripes"),
                 part("collar_s", (4.4, 25, -3.4), (8.8, 26.2, 3.4), "t"),
                 part("collar_gem", (7, 26.2, -0.6), (8.2, 26.6, 0.6), "g", glow=True)])
    return p


def atlantean():
    p = [shell(),
         part("fin0", (-0.4, 33, -3), (0.4, 35, 1), "t"),
         part("fin1", (-0.4, 35, -1), (0.4, 36.5, 3), "t2"),
         part("fin2", (-0.4, 33, 1), (0.4, 34.6, 5.5), "t"),
         part("pearl", (-0.6, 31.8, -5.6), (0.6, 33, -5.1), "a"),
         part("bcoral0", (-2, 20, 3.2), (-1, 26, 4.2), "t"),
         part("bcoral0b", (-3, 24, 3.2), (-2, 25, 4.2), "t"),
         part("bcoral1", (1, 21, 3.2), (2, 27, 4.2), "t2")]
    p += mirror([part("sidefin", (5, 27, 0), (7.5, 30.5, 0.6), "t"),
                 part("sidefin2", (7, 28, 0.8), (8.4, 31.5, 1.2), "t2"),
                 part("coral0", (2, 33, -4.6), (2.8, 35.4, -3.8), "t"),
                 part("coral1", (2.6, 34.8, -4.4), (3.8, 35.6, -3.6), "t"),
                 part("nautilus", (4.2, 25, -2.4), (8.6, 28, 2.4), "s2"),
                 part("nautilus_top", (5, 28, -1.6), (7.8, 29.6, 1.6), "s1"),
                 part("nautilus_glow", (8.6, 25.6, -1), (8.8, 27.6, 1), "g", glow=True)])
    return p


def paladin():
    p = [shell(),
         part("plume0", (-0.6, 33, -1), (0.6, 34.5, 3), "a"),
         part("plume1", (-0.6, 34, 1), (0.6, 35.6, 5), "a"),
         part("plume2", (-0.6, 32.5, 4), (0.6, 34.5, 6.2), "a"),
         part("cross_v", (-0.4, 30.5, -5.25), (0.4, 32.5, -5.05), "t"),
         part("cross_h", (-1.2, 31.4, -5.25), (1.2, 32, -5.05), "t")]
    p += mirror([part("wing0", (5, 28, 0), (6.2, 31, 2.4), "s1"),
                 part("wing1", (5.4, 30.5, 1), (6.6, 34, 3.6), "s1"),
                 part("wing2", (5.6, 33.5, 2), (6.4, 36, 4.4), "s2"),
                 part("pauldron0", (3.8, 25, -3.3), (9.4, 27, 3.3), "m"),
                 part("pauldron1", (4.4, 27, -2.6), (8.8, 28, 2.6), "t"),
                 part("pauldron_rim", (9.2, 22, -3.3), (9.8, 26.6, 3.3), "t2"),
                 part("pauldron_gem", (6.2, 28, -0.5), (7, 28.5, 0.5), "g", glow=True)])
    return p


def clockwork():
    p = [shell(),
         part("gear_hub", (-1.5, 33, -1.5), (1.5, 34.4, 1.5), "t"),
         part("tooth_n", (-0.5, 33, -2.6), (0.5, 34, -1.5), "t2"),
         part("tooth_s", (-0.5, 33, 1.5), (0.5, 34, 2.6), "t2"),
         part("tooth_e", (1.5, 33, -0.5), (2.6, 34, 0.5), "t2"),
         part("tooth_w", (-2.6, 33, -0.5), (-1.5, 34, 0.5), "t2"),
         part("gear_core", (-0.5, 34.4, -0.5), (0.5, 34.8, 0.5), "g", glow=True)]
    p += mirror([part("gog_ring", (1, 27.5, -5.6), (4, 30.5, -5.05), "t"),
                 part("gog_lens", (1.6, 28.1, -5.7), (3.4, 29.9, -5.55), "g", glow=True),
                 part("strap", (5, 28, -5.1), (5.4, 30, 5.1), "a"),
                 part("stack", (1.5, 20, 3.4), (3.3, 33, 5.2), "a"),
                 part("stack_rim", (1.2, 32.6, 3.1), (3.6, 33.4, 5.5), "t"),
                 part("stack_ember", (1.8, 33.4, 3.7), (3, 33.6, 4.9), "g", glow=True),
                 part("gearpad", (3.8, 25, -3), (9.2, 26.6, 3), "b"),
                 part("gearpad_teeth", (9.2, 24, -2.4), (9.8, 26.2, 2.4), "t2"),
                 part("gearpad_hub", (5.6, 26.6, -0.8), (7.4, 27.2, 0.8), "t")])
    return p


def shadow():
    k1 = ("z", 45.0, (0, 22, 3.85))
    k2 = ("z", -45.0, (0, 22, 4.45))
    p = [shell(),
         part("hood_top", (-5.4, 32.5, -5), (5.4, 33.8, 5.6), "b"),
         part("hood_back", (-5.4, 23, 4.6), (5.4, 33, 5.8), "b"),
         part("hood_peak", (-1.5, 33.8, -2), (1.5, 34.6, 3), "d"),
         part("mask", (-5.05, 23, -5.2), (5.05, 27, -5.05), "a"),
         part("scarf_f", (-5.4, 22.2, -3.4), (5.4, 23.6, -2.6), "t"),
         part("scarf_b", (-5.4, 22.2, 2.6), (5.4, 23.6, 3.4), "t"),
         part("tail0", (1, 20, 3.4), (2.4, 23, 4.4), "t"),
         part("tail1", (1.4, 17.5, 4.2), (2.6, 20.5, 5.2), "t2"),
         part("tail2", (1.8, 15.5, 5), (2.8, 18, 6), "t"),
         part("katana1_blade", (-0.35, 13, 3.6), (0.35, 29, 4.1), "s1", rot=k1),
         part("katana1_tsuba", (-1.1, 29, 3.5), (1.1, 29.6, 4.2), "a", rot=k1),
         part("katana1_hilt", (-0.45, 29.6, 3.55), (0.45, 33.5, 4.15), "t2", rot=k1),
         part("katana2_blade", (-0.35, 13, 4.2), (0.35, 29, 4.7), "s1", rot=k2),
         part("katana2_tsuba", (-1.1, 29, 4.1), (1.1, 29.6, 4.8), "a", rot=k2),
         part("katana2_hilt", (-0.45, 29.6, 4.15), (0.45, 33.5, 4.75), "t2", rot=k2)]
    p += mirror([part("hood_side", (4.8, 23, -5), (5.8, 33, 5.4), "d"),
                 part("eye", (1, 28.4, -5.25), (3, 29.2, -5.2), "g", glow=True),
                 part("scarf_s", (4.6, 22.2, -3.4), (5.4, 23.6, 3.4), "t")])
    return p


def dragon():
    p = [shell(),
         part("snout", (-3, 24, -8), (3, 28, -5), "m"),
         part("snout_top", (-2.4, 28, -7.6), (2.4, 29, -5), "b"),
         part("jaw", (-2.8, 22.6, -7.4), (2.8, 24, -5), "d"),
         part("spine0", (-0.5, 33, -2), (0.5, 34.5, 0), "s1"),
         part("spine1", (-0.5, 33, 1), (0.5, 35, 3), "s1"),
         part("spine2", (-0.5, 30, 4.5), (0.5, 32.5, 6), "s1"),
         part("bspine0", (-0.6, 22, 3.2), (0.6, 24, 5), "s1"),
         part("bspine1", (-0.6, 18.5, 3.2), (0.6, 20.5, 5), "s1"),
         part("bspine2", (-0.6, 15, 3.2), (0.6, 17, 5), "s2")]
    p += mirror([part("fang", (1.8, 23, -7.8), (2.4, 24, -7.2), "a"),
                 part("fang2", (0.4, 23.2, -7.9), (0.9, 24, -7.4), "a"),
                 part("nostril", (1, 27.4, -8.05), (1.8, 28, -8), "g", glow=True),
                 part("eye", (2.8, 28.6, -5.25), (4.2, 29.4, -5.05), "g", glow=True),
                 part("horn0", (2.5, 32, 1), (4, 34, 4), "t"),
                 part("horn1", (3, 33, 3.5), (4.2, 34.8, 6.5), "t"),
                 part("horn2", (3.3, 33.8, 6), (4.2, 35.4, 8.5), "t2"),
                 part("horn3", (3.5, 34.8, 8), (4, 35.8, 9.6), "t2"),
                 part("frill", (5, 26, -1), (6.5, 31, 2), "s1"),
                 part("frill2", (6.3, 27, 0), (7.2, 30, 1.6), "s2"),
                 part("wing_arm", (1.5, 25, 3.4), (8, 26, 4.2), "t"),
                 part("wing_arm2", (7.5, 25.5, 3.4), (12, 30, 4.2), "t"),
                 part("wing_claw", (11.5, 29.5, 3.5), (12.5, 31, 4.1), "a"),
                 part("wing_mem", (1.5, 19, 3.6), (8, 25, 4), "m"),
                 part("wing_mem2", (8, 21, 3.6), (12, 25.5, 4), "b"),
                 part("wing_mem3", (9, 25.5, 3.6), (11.5, 29.5, 4), "m")])
    return p


def mushroom():
    p = [shell(),
         part("gills", (-7.3, 31.6, -7.3), (7.3, 32, 7.3), "l"),
         part("cap0", (-7.5, 32, -7.5), (7.5, 34, 7.5), "pat_cap"),
         part("cap1", (-6, 34, -6), (6, 35.6, 6), "pat_cap"),
         part("cap2", (-4, 35.6, -4), (4, 36.6, 4), "pat_cap"),
         part("bstem", (-1, 24, 3.2), (0, 27, 4.2), "l"),
         part("bcap", (-2, 27, 2.8), (1, 28, 5), "t"),
         part("bstem2", (1, 21, 3.2), (1.8, 23, 4), "l"),
         part("bcap2", (0.4, 23, 3), (2.4, 23.8, 4.6), "t2"),
         part("glowshroom", (-3, 20, 3.2), (-2.2, 21.4, 4), "g", glow=True)]
    p += mirror([part("moss", (3.8, 25, -3), (9.2, 26, 3), "s2"),
                 part("mstem", (6, 26, -0.5), (7, 27.7, 0.5), "l"),
                 part("mcap", (5.2, 27.7, -1.3), (7.8, 28.7, 1.3), "t"),
                 part("mstem2", (5, 26, 1.4), (5.6, 27, 2), "l"),
                 part("mcap2", (4.6, 27, 1), (6, 27.6, 2.4), "t")])
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
}
