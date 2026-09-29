"""Three closed-helm sets: Blackguard and Iron Juggernaut (regular tier), and Nyxite, the
mythic set forged from a custom ore that only generates deep in the deepslate. Nyxite is
the strongest armor a player can get; its scrolls only come out of the ore itself."""
import helm_forge as HF
from armor_engine import mirror, part
from armor_sets import TS, zr, xr


# ----------------------------------------------------------------------------- helmets
def blackguard():
    p = HF.shell("d", "m") + HF.brow("t") + HF.v_slit("g") + HF.v_breaths("o") + [
        part("crest", (-0.3, 33.3, -3.6), (0.3, 34.4, 4.2), "t"),
        part("crest_back", (-0.3, 29, 4.8), (0.3, 34.2, 5.4), "t")]
    p += mirror([
        part("horn_base", (4.5, 29.8, -1.0), (5.7, 31.4, 0.6), "m"),
        part("horn1", (5.3, 30.8, -0.9), (6.3, 33.8, 0.1), "l", rot=zr(-22.5, (5.8, 30.8, -0.4))),
        part("horn2", (6.2, 33.2, -0.8), (6.9, 35.6, -0.1), "l", rot=zr(-45, (6.55, 33.2, -0.45))),
        part("horn_tip", (7.6, 34.6, -0.7), (8.2, 35.4, -0.2), "t"),
        part("pauldron", (4.8, 25, -2.8), (9.4, 26.4, 2.8), "m"),
        part("pauldron_trim", (4.8, 24.7, -2.9), (9.5, 25.0, 2.9), "t"),
        part("pauldron_spike", (6.2, 26.4, -1.8), (7.0, 29.0, -1.0), "l", rot=zr(-22.5, (6.6, 26.4, -1.4))),
        part("pauldron_spike2", (7.4, 26.4, 0.4), (8.1, 28.4, 1.1), "l", rot=zr(-22.5, (7.75, 26.4, 0.75)))])
    return p


def juggernaut():
    p = HF.shell("m", "l") + HF.v_grill("g", "d") + [
        part("ridge", (-0.5, 33.3, -4.6), (0.5, 34.0, 4.6), "t"),
        part("ridge_glow", (-0.2, 34.0, -3.0), (0.2, 34.2, 3.0), "g", glow=True)]
    for i, x in enumerate((-4.0, -2.4, 2.4, 4.0)):                  # rivets along the brow
        p.append(HF.decal(f"rivet{i}", x - 0.25, x + 0.25, 30.6, 31.1, "a"))
    p += mirror([
        part("pauldron0", (4.8, 25, -3.0), (9.6, 26.6, 3.0), "m"),
        part("pauldron1", (5.4, 26.6, -2.4), (9.0, 27.6, 2.4), "l"),
        part("pauldron_band", (4.8, 24.6, -3.1), (9.7, 25.0, 3.1), "t"),
        part("pauldron_light", (7.0, 27.6, -0.4), (7.8, 28.0, 0.4), "g", glow=True),
        part("exhaust", (1.4, 30.0, 4.8), (2.4, 33.8, 5.8), "d"),
        part("exhaust_cap", (1.3, 33.8, 4.7), (2.5, 34.2, 5.9), "t"),
        part("exhaust_glow", (1.6, 34.2, 5.0), (2.2, 34.3, 5.6), "g", glow=True)])
    return p


def nyxite():
    p = HF.shell("m", "pat_crystal") + HF.v_angry("g") + [
        HF.decal("visor_line", -0.3, 0.3, 24.6, 28.6, "g"),
        HF.decal("brow_gem", -0.6, 0.6, 30.2, 31.2, "a", 1),
        part("crown_c", (-0.5, 33.3, -4.2), (0.5, 36.4, -3.4), "l"),
        part("crown_c_tip", (-0.3, 36.4, -4.0), (0.3, 37.4, -3.6), "g", glow=True),
        part("halo_b", (-3.4, 36.0, 4.6), (3.4, 36.5, 5.1), "t"),
        part("halo_core", (-0.4, 34.0, 5.0), (0.4, 36.0, 5.4), "g", glow=True)]
    p += mirror([
        part("crown_s", (1.6, 33.3, -4.2), (2.4, 35.6, -3.4), "m", rot=zr(-22.5, (2.0, 33.3, -3.8))),
        part("crown_s_tip", (2.3, 35.5, -4.1), (2.9, 36.3, -3.5), "g", glow=True),
        part("crown_o", (3.4, 33.3, -2.6), (4.1, 35.0, -1.8), "l", rot=zr(-22.5, (3.75, 33.3, -2.2))),
        part("halo_s", (3.4, 32.0, 4.6), (3.9, 36.5, 5.1), "t"),
        part("pauldron", (4.8, 25, -2.8), (9.2, 26.2, 2.8), "pat_crystal"),
        part("pauldron_trim", (4.8, 24.8, -2.9), (9.3, 25.1, 2.9), "t"),
        part("shard", (6.0, 26.2, -1.2), (6.9, 29.2, -0.3), "l", rot=zr(-22.5, (6.45, 26.2, -0.75))),
        part("shard_glow", (6.9, 28.8, -1.0), (7.5, 29.6, -0.5), "g", glow=True),
        part("shard2", (7.4, 26.2, 0.6), (8.1, 28.2, 1.3), "m", rot=xr(22.5, (7.75, 26.2, 0.95)))])
    return p


def pal(o, d, b, m, l, t, t2, a, g, s1, s2):
    return dict(o=o, d=d, b=b, m=m, l=l, t=t, t2=t2, a=a, g=g, s1=s1, s2=s2)


SETS4 = [
    dict(id="blackguard", name="Blackguard", color="&4&l", pattern="plate", secondary="cloth",
         pal=pal((6, 4, 6), (20, 16, 20), (36, 30, 36), (58, 50, 58), (96, 86, 96), (150, 20, 30), (80, 10, 16),
                 (200, 190, 200), (255, 50, 50), (60, 14, 20), (28, 24, 28)),
         emblem=["t......t", ".t....t.", "..tttt..", "..tggt..", "...tt..."], helmet=blackguard,
         recipe=dict(A="POLISHED_BLACKSTONE", B="WITHER_SKELETON_SKULL", C="BLAZE_ROD"),
         perk={"attackDamage": 0.5, "knockbackResistance": 0.05}, mob=("WITHER_SKELETON", 4), seal=(150, 20, 30),
         lore=["&7The knight who swore his oath", "&7to the dark, and kept it."],
         story=["Blackened steel and blackstone, sealed with a wither skull.",
                "The tools leave scorch marks shaped like a crown.",
                "A blade that drinks the light around it."],
         tools=TS((70, 62, 70), (28, 24, 28), (150, 20, 30), (255, 50, 50), sword="zweihander", guard="sweep",
                  pommel="spike", deco="edge_runes", grip="wrap", axe="bearded", pick="mattock", shovel="shield",
                  hoe="adze", bow="long", bow_tips="spike", bow_mat="metal", string=(255, 50, 50))),
    dict(id="juggernaut", name="Iron Juggernaut", color="&6&l", pattern="brass", secondary="leather",
         pal=pal((10, 10, 12), (30, 32, 36), (52, 56, 62), (80, 86, 94), (130, 138, 148), (230, 140, 30),
                 (120, 70, 20), (200, 205, 210), (255, 160, 40), (60, 50, 40), (34, 30, 26)),
         emblem=["tttttttt", "t.g..g.t", "t......t", "t.gggg.t", "tttttttt"], helmet=juggernaut,
         recipe=dict(A="IRON_BLOCK", B="HEAVY_CORE", C="IRON_BARS"),
         perk={"knockbackResistance": 0.1, "maxHealth": 1}, mob=("RAVAGER", 10), seal=(230, 140, 30),
         lore=["&7Walks through walls.", "&7Usually on purpose."],
         story=["Riveted iron plate a hand thick, built around a heavy core.",
                "The tools do not dig, they demolish.",
                "A cleaver the size of a door, and a bow no one else can draw."],
         tools=TS((90, 96, 104), (34, 30, 26), (230, 140, 30), (255, 160, 40), sword="cleaver", guard="knuckle",
                  pommel="ring", deco="core", grip="bands", axe="cleaver", pick="hammer", shovel="spade",
                  hoe="blade", bow="segmented", bow_tips="gem", bow_mat="metal", string=(255, 160, 40))),
    dict(id="nyxite", name="Nyxite", color="&d&l", pattern="crystal", secondary="obsidian", tier="mythic",
         pal=pal((4, 2, 8), (14, 8, 24), (26, 14, 42), (44, 26, 68), (86, 60, 120), (210, 200, 240),
                 (100, 70, 160), (250, 240, 255), (190, 120, 255), (34, 20, 52), (18, 10, 28)),
         emblem=["...gg...", "..gaag..", ".gaaaag.", "..gaag..", "...gg..."], helmet=nyxite,
         ore=dict(ore_id="nyxite_ore", ore_name="Nyxite Ore", raw_id="raw_nyxite", raw_name="Raw Nyxite",
                  ingot_id="nyxite_ingot", ingot_name="Nyxite Ingot", hardness=25,
                  ore_lore=["&7Night, frozen into stone.", "&7Deep in the deepslate, rarely."],
                  raw_lore=["&7Cold to the touch.", "&7It glows when no one looks."],
                  ingot_lore=["&7Smelted from Raw Nyxite.", "&7The strongest metal there is."],
                  gen={"nyxite_ore": dict(worlds=["world"], replace=["DEEPSLATE", "TUFF"], chance=8.0,
                                          min=-63, max=-40, vein=2)}),
         recipe=dict(A="nyxite:nyxite_ingot", B="NETHER_STAR", C="END_ROD"),
         perk={"maxHealth": 2, "attackDamage": 1}, mob=("nyxite:nyxite_ore", 3), seal=(190, 120, 255),
         lore=["&7Forged from the rarest ore", "&7the world has ever hidden."],
         story=["Nyxite ingots folded around a nether star, cooled in the dark.",
                "The tools cut through deepslate like snow.",
                "A blade of solid night, and a bow that shoots starlight."],
         tools=TS((70, 44, 104), (18, 10, 28), (210, 200, 240), (190, 120, 255), sword="crystal", guard="crescent",
                  pommel="star", deco="stars", grip="spiral", axe="moon", pick="star", shovel="pointed",
                  hoe="sickle", bow="double", bow_tips="gem", bow_mat="accent", string=(190, 120, 255))),
]

import armor_engine as _AE  # noqa: E402
_AE.RELIC_NAMES["nyxite:nyxite_ingot"] = "Nyxite Ingot"

import armor_looks  # noqa: E402
for _S in SETS4:
    armor_looks.apply(_S)
for _i, _S in enumerate(SETS4):
    _S["shield"] = ("tower", "crenel", "pointed")[_i]
    _S["arm_cut"] = ("pads", "both", "both")[_i]
