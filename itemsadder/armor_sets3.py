"""Four elite sets: darker, stronger, and much harder to get. Every piece needs a relic
that only a boss drops (Wither, Ender Dragon, Elder Guardian, Warden), and their scrolls
cannot be crafted: the boss is the only source. Stats sit a step above the other sets."""
from armor_engine import mirror, part
from armor_sets import TS, ring, xr, zr


# ----------------------------------------------------------------------------- helmets
def witherbane():
    """A black bone crown carrying the Wither's three skulls, a brow plate and red-eyed sockets."""
    p = ring("band", 29, 30.2, "t", r=4.7) + [
        part("brow", (-4.75, 28.4, -4.95), (4.75, 29.2, -4.6), "d"),
        part("brow_glow", (-3.2, 28.2, -5.0), (3.2, 28.4, -4.9), "g", glow=True),
        part("crown", (-4.6, 30.2, -4.6), (4.6, 31, 4.6), "pat_plate"),
        # the central skull
        part("skull", (-1.3, 31, -2.6), (1.3, 33.6, 0), "a"),
        part("skull_jaw", (-1, 30.6, -2.8), (1, 31.2, -1), "t"),
        part("skull_eye_r", (0.25, 32.2, -2.7), (0.9, 32.8, -2.6), "g", glow=True),
        part("skull_eye_l", (-0.9, 32.2, -2.7), (-0.25, 32.8, -2.6), "g", glow=True),
        part("skull_nose", (-0.2, 31.6, -2.7), (0.2, 32, -2.6), "o"),
        part("spine0", (-0.35, 31, 1), (0.35, 34, 1.7), "d", rot=xr(-22.5, (0, 31, 1.35))),
        part("spine1", (-0.3, 31, 2.8), (0.3, 33, 3.4), "d", rot=xr(-22.5, (0, 31, 3.1)))]
    p += mirror([
        # the two smaller skulls, leaning outwards
        part("skull_s", (2.2, 30.8, -1.9), (4.0, 32.6, -0.1), "a", rot=zr(-22.5, (3.1, 30.8, -1))),
        part("skull_s_eye", (2.7, 31.7, -2.0), (3.5, 32.1, -1.9), "g", glow=True, rot=zr(-22.5, (3.1, 30.8, -1))),
        part("cheek", (4.4, 25, -4.9), (5.0, 29, -1.2), "d"),
        part("cheek_edge", (4.45, 25, -4.95), (5.05, 25.4, -1.2), "t"),
        part("pauldron", (4.8, 25, -2.6), (9.2, 26.2, 2.6), "pat_plate"),
        part("pauldron_bone", (5.2, 26.2, -2.2), (8.8, 26.8, 2.2), "t"),
        part("pauldron_spike", (7.4, 26.8, -0.4), (8.2, 29.4, 0.4), "a", rot=zr(-22.5, (7.8, 26.8, 0))),
        part("pauldron_spike2", (5.8, 26.8, 1.0), (6.5, 28.4, 1.7), "a", rot=zr(-22.5, (6.1, 26.8, 1.3)))])
    return p


def dreadwyrm():
    """A black dragon helm: a spined crest, great swept-back horns and a violet gaze."""
    p = ring("band", 29.4, 30.4, "d", r=4.7) + [
        part("brow", (-4.75, 29.6, -4.95), (4.75, 30.4, -4.55), "b"),
        part("brow_ridge", (-4.2, 30.4, -4.9), (4.2, 30.8, -4.4), "m"),
        part("crest", (-0.5, 30.4, -4.8), (0.5, 32.2, 3.6), "pat_scale"),
        part("crest_spike0", (-0.3, 32.2, -3.2), (0.3, 33.8, -2.4), "m", rot=xr(-22.5, (0, 32.2, -2.8))),
        part("crest_spike1", (-0.3, 32.2, -0.6), (0.3, 34.4, 0.2), "l", rot=xr(-22.5, (0, 32.2, -0.2))),
        part("crest_spike2", (-0.3, 32.2, 2), (0.3, 33.6, 2.8), "m", rot=xr(-22.5, (0, 32.2, 2.4))),
        part("crest_glow", (-0.55, 31.2, -4.85), (0.55, 31.6, -4.75), "g", glow=True)]
    p += mirror([
        part("horn0", (3.4, 30.2, -0.4), (4.9, 32.4, 1.8), "b", rot=xr(-22.5, (4.15, 30.2, 0.7))),
        part("horn1", (3.7, 31.2, 1.6), (4.6, 32.6, 5.8), "m", rot=xr(-45, (4.15, 31.9, 1.6))),
        part("horn2", (3.85, 34.4, 4.6), (4.45, 35.4, 7.4), "l", rot=xr(-22.5, (4.15, 34.9, 4.6))),
        part("horn_tip", (3.9, 35.2, 7.2), (4.4, 35.8, 8.2), "g", glow=True),
        part("temple_gem", (4.7, 28.6, -3.6), (5.0, 29.4, -2.8), "g", glow=True),
        part("jaw", (4.4, 25, -4.8), (5.0, 29.4, -0.6), "d"),
        part("jaw_spike", (4.6, 24.2, -4.4), (5.0, 25, -3.6), "m"),
        part("frill", (4.6, 27.6, 0.2), (5.1, 31.4, 4.2), "s1", rot=zr(-22.5, (4.85, 27.6, 2.2))),
        part("frill_ray", (4.62, 28, 1.4), (5.12, 31.2, 1.8), "m", rot=zr(-22.5, (4.85, 27.6, 2.2))),
        part("pauldron", (4.8, 25, -2.6), (9.2, 26.2, 2.6), "pat_scale"),
        part("pauldron_ridge", (5.4, 26.2, -2.0), (8.6, 26.8, 2.0), "m"),
        part("pauldron_spike", (6.4, 26.8, -1.8), (7.2, 29, -1.0), "l", rot=zr(-22.5, (6.8, 26.8, -1.4))),
        part("pauldron_spike2", (6.4, 26.8, 1.0), (7.2, 28.4, 1.8), "m", rot=zr(-22.5, (6.8, 26.8, 1.4)))])
    return p


def leviathan():
    """Abyssal: finned crests, gill lights, and an anglerfish lure hanging before the face."""
    p = ring("band", 29, 30, "t", r=4.7) + [
        part("cap", (-4.6, 30, -4.6), (4.6, 31, 4.6), "pat_wave"),
        part("lure_stalk", (-0.3, 31, -1.2), (0.3, 34.6, -0.6), "d"),
        part("lure_arm", (-0.3, 34.2, -5.6), (0.3, 34.8, -0.6), "d"),
        part("lure_drop", (-0.25, 31.6, -5.6), (0.25, 34.2, -5.1), "b"),
        part("lure", (-0.7, 30.4, -6.1), (0.7, 31.6, -4.7), "g", glow=True),
        part("fin_top", (-0.35, 31, 0), (0.35, 33.6, 4.4), "m", rot=xr(-22.5, (0, 31, 2.2))),
        part("fin_top_ray", (-0.38, 31.4, 1.2), (0.38, 33.2, 1.6), "l", rot=xr(-22.5, (0, 31, 2.2)))]
    p += mirror([
        part("fin", (4.5, 27, -1.6), (5.0, 31.6, 3.4), "m", rot=zr(-22.5, (4.75, 27, 1))),
        part("fin_ray0", (4.52, 27.4, -0.6), (5.02, 31.2, -0.3), "l", rot=zr(-22.5, (4.75, 27, 1))),
        part("fin_ray1", (4.52, 27.4, 1.2), (5.02, 31.4, 1.5), "l", rot=zr(-22.5, (4.75, 27, 1))),
        part("gill0", (4.62, 25.6, -3.6), (4.95, 26, -1.4), "g", glow=True),
        part("gill1", (4.62, 26.4, -3.6), (4.95, 26.8, -1.4), "g", glow=True),
        part("cheek", (4.4, 25, -4.8), (4.9, 28.6, -0.8), "d"),
        part("pauldron", (4.8, 25, -2.6), (9.2, 26.2, 2.6), "pat_wave"),
        part("pauldron_shell", (5.4, 26.2, -2.2), (8.8, 27.2, 2.2), "s1"),
        part("pauldron_barnacle", (6.2, 27.2, -0.8), (7.0, 27.8, 0.0), "a"),
        part("pauldron_glow", (7.4, 27.2, 0.6), (7.9, 27.6, 1.1), "g", glow=True)])
    return p


def revenant():
    """A deep hood with a shadowed brim and two soul-lit tendrils, like the Warden's."""
    p = [part("hood_top", (-4.9, 32, -4.9), (4.9, 32.8, 4.9), "s1"),
         part("hood_peak", (-1.2, 32.8, -2.6), (1.2, 33.8, 1.4), "s1"),
         part("hood_back", (-4.9, 24.4, 4.2), (4.9, 32, 4.9), "s1"),
         part("hood_brim", (-4.95, 31, -5.35), (4.95, 32.4, -4.6), "s2"),
         part("hood_hem", (-4.95, 30.6, -5.4), (4.95, 31, -5.1), "t2"),
         part("clasp", (-0.8, 23.4, -5.2), (0.8, 24.6, -4.8), "t"),
         part("clasp_gem", (-0.35, 23.7, -5.3), (0.35, 24.3, -5.2), "g", glow=True),
         part("cowl", (-4.4, 23.2, -4.8), (4.4, 24.4, -4.0), "s2")]
    p += mirror([
        part("hood_side", (4.2, 24.4, -4.9), (4.9, 32, 4.2), "s1"),
        part("hood_fold", (4.9, 26, -3.8), (5.05, 32, -3.2), "s2"),
        part("tendril0", (2.6, 32.6, -0.6), (3.8, 35, 0.6), "d", rot=zr(-22.5, (3.2, 32.6, 0))),
        part("tendril1", (3.6, 34.4, -0.45), (4.5, 37.2, 0.45), "g", glow=True, rot=zr(-22.5, (4.05, 34.4, 0))),
        part("tendril_tip", (5.0, 36.8, -0.3), (5.6, 37.6, 0.3), "a", glow=True),
        part("soul", (5.6, 30.6, -2.8), (6.2, 31.2, -2.2), "g", glow=True),
        part("mantle", (4.8, 25, -2.8), (9.0, 26.2, 2.8), "s1"),
        part("mantle_drape", (8.4, 23.6, -2.8), (9.0, 25, 2.8), "s2"),
        part("mantle_clasp", (6.2, 26.2, -0.5), (7.2, 26.8, 0.5), "t"),
        part("mantle_soul", (6.45, 26.8, -0.25), (6.95, 27.3, 0.25), "g", glow=True)])
    return p


def pal(o, d, b, m, l, t, t2, a, g, s1, s2):
    return dict(o=o, d=d, b=b, m=m, l=l, t=t, t2=t2, a=a, g=g, s1=s1, s2=s2)


# relic: the boss-only crafting part every piece needs.  art: 16x16 in palette letters.
SETS3 = [
    dict(id="witherbane", name="Witherbane", color="&8&l", pattern="plate", secondary="chain", elite=True,
         pal=pal((6, 5, 6), (18, 16, 18), (32, 29, 31), (52, 48, 50), (88, 82, 84), (205, 195, 175), (120, 20, 28),
                 (225, 215, 195), (220, 40, 50), (40, 34, 36), (24, 20, 22)),
         emblem=["..aaaa..", ".aaaaaa.", ".agaaga.", "..aaaa..", "..a..a.."], helmet=witherbane,
         relic=dict(id="wither_sigil", name="Wither Sigil", mob="WITHER", min=1, max=2,
                    lore=["&7A black shard of the Wither's", "&7heart. It is still warm."],
                    art=["................", ".......oo.......", "......oddo......", ".....odbbdo.....",
                         "....odbggbdo....", "...odbgggmbdo...", "...odbgggmbdo...", "....odbmmbdo....",
                         ".....odbbdo.....", "......oddo......", ".......oo.......", "................",
                         "................", "................", "................", "................"]),
         recipe=dict(A="WITHER_ROSE", B="witherbane:wither_sigil", C="BONE_BLOCK"),
         perk={"attackDamage": 1, "maxHealth": 1}, mob=("WITHER", 25), seal=(220, 40, 50),
         lore=["&7Forged from what the Wither", "&7left behind. It hungers."],
         story=["Blackened bone plated over withered steel, cooled in soul fire.",
                "The tools drain the colour out of every block they break.",
                "A blade that leaves wounds which never quite close."],
         tools=TS((70, 64, 66), (24, 20, 22), (205, 195, 175), (220, 40, 50), sword="bone", guard="horns",
                  pommel="skull", deco="cracks", grip="wrap", axe="reaper", pick="claw", shovel="fork",
                  hoe="scythe", bow="bone", bow_tips="spike", bow_mat="metal", string=(220, 40, 50))),
    dict(id="dreadwyrm", name="Dreadwyrm", color="&5&l", pattern="scale", secondary="leather", elite=True,
         pal=pal((6, 2, 10), (20, 10, 30), (36, 18, 52), (58, 30, 82), (100, 60, 140), (150, 140, 165),
                 (60, 24, 80), (235, 200, 255), (225, 90, 255), (44, 24, 58), (22, 12, 30)),
         emblem=["g......g", ".g....g.", "..gmmg..", "..mmmm..", "...mm..."], helmet=dreadwyrm,
         relic=dict(id="dragon_heart", name="Dragon Heart", mob="ENDER_DRAGON", min=3, max=5,
                    lore=["&7It still beats, slowly,", "&7in time with the End."],
                    art=["................", "................", "....oo....oo....", "...obbo..obbo...",
                         "..obmmbooommbo..", "..obmgmmmmmmbo..", "..obmggmmmmmbo..", "...obmgmmmmbo...",
                         "....obmmmmbo....", ".....obmmbo.....", "......obbo......", ".......oo.......",
                         "................", "................", "................", "................"]),
         recipe=dict(A="DRAGON_BREATH", B="dreadwyrm:dragon_heart", C="END_ROD"),
         perk={"maxHealth": 2, "knockbackResistance": 0.05}, mob=("ENDER_DRAGON", 100), seal=(225, 90, 255),
         lore=["&7Scales of the dragon that", "&7ruled the End before the last."],
         story=["Black dragon scale, riveted with ender iron and bound in its own breath.",
                "The tools tear through the End's stone as if it were air.",
                "A fang of the old dragon, and a bow strung with its sinew."],
         tools=TS((70, 40, 96), (22, 12, 30), (150, 140, 165), (225, 90, 255), sword="serrated", guard="wings",
                  pommel="claw", deco="facets", grip="spiral", axe="labrys", pick="winged", shovel="heart",
                  hoe="claw", bow="horn", bow_tips="spike", bow_mat="metal", string=(225, 90, 255))),
    dict(id="leviathan", name="Abyssal Leviathan", color="&3&l", pattern="wave", secondary="scale", elite=True,
         pal=pal((2, 8, 10), (8, 22, 28), (14, 38, 48), (22, 60, 72), (44, 100, 112), (90, 160, 150),
                 (20, 60, 70), (200, 255, 245), (70, 245, 225), (16, 46, 56), (10, 26, 34)),
         emblem=["...gg...", "..g..g..", ".g.mm.g.", "g.mmmm.g", "...mm..."], helmet=leviathan,
         relic=dict(id="abyssal_eye", name="Abyssal Eye", mob="ELDER_GUARDIAN", min=1, max=1,
                    lore=["&7Torn from an Elder Guardian.", "&7It never stops watching."],
                    art=["................", "................", "................", ".....oooooo.....",
                         "...oommmmmmoo...", "..ombbllllbbmo..", ".ombllggggllbmo.", ".ombllgoogllbmo.",
                         ".ombllggggllbmo.", "..ombbllllbbmo..", "...oommmmmmoo...", ".....oooooo.....",
                         "................", "................", "................", "................"]),
         recipe=dict(A="NAUTILUS_SHELL", B="leviathan:abyssal_eye", C="PRISMARINE_SHARD"),
         perk={"movementSpeed": 0.005, "maxHealth": 1}, mob=("ELDER_GUARDIAN", 35), seal=(70, 245, 225),
         lore=["&7Raised from the trench where", "&7the light gives up."],
         story=["Shell and prismarine from the deep, lit by things that should not glow.",
                "The tools hum like whalesong when they strike.",
                "A blade of black coral and a bow that fires in the dark."],
         tools=TS((40, 90, 100), (10, 26, 34), (90, 160, 150), (70, 245, 225), sword="kris", guard="fins",
                  pommel="hook", deco="vein", grip="bands", axe="beak", pick="trident", shovel="scoop",
                  hoe="hook", bow="wing", bow_tips="gem", bow_mat="accent", string=(70, 245, 225))),
    dict(id="revenant", name="Hollow Revenant", color="&b&l", pattern="plate", secondary="cloth", elite=True,
         pal=pal((4, 4, 8), (14, 14, 22), (26, 26, 38), (42, 42, 58), (76, 76, 98), (190, 200, 215),
                 (40, 60, 90), (230, 240, 250), (90, 210, 255), (30, 30, 44), (16, 16, 26)),
         emblem=["...gg...", "..gggg..", "...gg...", "..g..g..", ".g....g."], helmet=revenant,
         relic=dict(id="echo_heart", name="Echo Heart", mob="WARDEN", min=1, max=2,
                    lore=["&7The Warden's heartbeat,", "&7caught in glass. Listen."],
                    art=["................", "................", "......oooo......", ".....obllbo.....",
                         "....obggggbo....", "...obgglgggbo...", "...obggggggbo...", "...obggggggbo...",
                         "....obggggbo....", ".....obggbo.....", "......obbo......", ".......oo.......",
                         "................", "................", "................", "................"]),
         recipe=dict(A="ECHO_SHARD", B="revenant:echo_heart", C="SOUL_LANTERN"),
         perk={"attackDamage": 1, "movementSpeed": 0.004}, mob=("WARDEN", 40), seal=(90, 210, 255),
         lore=["&7Worn by what walks out of", "&7the Deep Dark. It is not alive."],
         story=["A shroud woven in the Deep Dark, lit by the souls it carries.",
                "The tools make no sound at all. Nothing hears you mine.",
                "A reaper's blade, and a bow whose arrows whisper."],
         tools=TS((60, 64, 84), (16, 16, 26), (190, 200, 215), (90, 210, 255), sword="scimitar", guard="crescent",
                  pommel="crescent", deco="runes", grip="wrap", axe="moon", pick="single", shovel="trowel",
                  hoe="scythe", bow="recurve", bow_tips="gem", bow_mat="handle", string=(90, 210, 255))),
]

import armor_engine as _AE  # noqa: E402
for _S in SETS3:
    _AE.RELIC_NAMES[f"{_S['id']}:{_S['relic']['id']}"] = _S["relic"]["name"]

import armor_looks  # noqa: E402
for _S in SETS3:
    armor_looks.apply(_S)

for _i, _S in enumerate(SETS3):
    _S["shield"] = ("spiked", "crescent", "kite", "pointed")[_i]
    _S["arm_cut"] = ("both", "pads", "gloves", "both")[_i]

# heavy sets wear closed helmets (full shell, faceplate and visor) instead of open ones
import helm_forge as _HF  # noqa: E402
from armor_sets import SETS as _S1  # noqa: E402
from armor_sets2 import SETS2 as _S2  # noqa: E402
_HF.apply(_S1 + _S2 + SETS3)
