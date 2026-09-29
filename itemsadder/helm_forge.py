"""Closed helmets: a full shell around the head with a faceplate, and visor details
(eye slits, breathing holes, grills, lenses, masks, glowing eyes) laid on the faceplate
as thin decals. Heavy sets swap their open helmets for these and keep their own
signature pieces (crests, horns, plumes, pauldrons) from the old design."""
from armor_engine import mirror, part

R = 4.8          # shell half-width: just outside the head (4.0) and the flat armor layer (4.5)
FZ = -R          # faceplate front


def shell(main, top=None, y1=32.8):
    top = top or main
    p = [part("h_front", (-R, 24, -R), (R, 32, -R + 0.3), main),
         part("h_back", (-R, 24, R - 0.3), (R, 32, R), main),
         part("h_top", (-R, 32, -R), (R, y1, R), top),
         part("h_dome", (-R + 0.6, y1, -R + 0.6), (R - 0.6, y1 + 0.5, R - 0.6), top),     # stepped crown
         part("h_chin", (-R + 0.8, 23.4, -R - 0.1), (R - 0.8, 24.2, -R + 1.2), main)]     # jaw plate
    p += mirror([part("h_side", (R - 0.3, 24, -R + 0.3), (R, 32, R - 0.3), main),
                 part("h_cheek", (R - 0.1, 24.2, -R - 0.1), (R + 0.2, 28.2, -R + 2.6), main)])  # raised cheek plates
    return p


def decal(name, x0, x1, y0, y1, mat, layer=0):
    """A flat detail on the faceplate; higher layers sit in front of lower ones."""
    z1 = FZ - 0.1 - 0.1 * layer
    return dict(part(name, (x0, y0, z1 - 0.06), (x1, y1, z1), mat, glow=(mat == "g")), decal=True)


def _decals(parts):
    return [dict(q, decal=True) for q in parts]


def brow(mat, y0=29.5, y1=30.1):
    return [part("h_brow", (-R - 0.1, y0, -R - 0.15), (R + 0.1, y1, -R + 0.2), mat)]


# ------------------------------------------------------------------ visors
def v_slit(mat="o", y0=28.4, y1=29.2):
    return [decal("slit_r", 0.5, 3.8, y0, y1, mat), decal("slit_l", -3.8, -0.5, y0, y1, mat)]


def v_breaths(mat="o", ys=(25.6, 26.6)):
    out = []
    for j, y in enumerate(ys):
        for i, x in enumerate((1.2, 2.2, 3.2)):
            out += [decal(f"br{j}{i}_r", x - 0.25, x + 0.25, y, y + 0.45, mat),
                    decal(f"br{j}{i}_l", -x - 0.25, -x + 0.25, y, y + 0.45, mat)]
    return out


def v_cross(trim, slit="o"):
    """Great helm: eye slit, a cross laid over the faceplate, breathing holes."""
    return v_slit(slit) + v_breaths(slit) + [
        decal("cross_v", -0.4, 0.4, 24.4, 31.6, trim, 1), decal("cross_h", -3.2, 3.2, 30.2, 30.8, trim, 1)]


def v_tvisor(mat="o"):
    """Corinthian: eye slits joined by a vertical gap down to the chin."""
    return [decal("t_eyes", -3.6, 3.6, 28.4, 29.3, mat), decal("t_mouth", -0.55, 0.55, 24.2, 28.4, mat)]


def v_angry(mat="g"):
    """Two eye slits slanted down towards the nose."""
    return _decals([part("eye_r", (0.6, 28.5, FZ - 0.16), (3.6, 29.1, FZ - 0.1), mat, glow=mat == "g",
                 rot=("z", 22.5, (0.6, 28.8, FZ))),
            part("eye_l", (-3.6, 28.5, FZ - 0.16), (-0.6, 29.1, FZ - 0.1), mat, glow=mat == "g",
                 rot=("z", -22.5, (-0.6, 28.8, FZ)))])


def v_v(mat="g"):
    """A V-shaped visor rising from the nose to the temples."""
    return _decals([part("v_r", (0, 28.2, FZ - 0.16), (4.2, 28.9, FZ - 0.1), mat, glow=mat == "g",
                 rot=("z", 22.5, (0, 28.55, FZ))),
            part("v_l", (-4.2, 28.2, FZ - 0.16), (0, 28.9, FZ - 0.1), mat, glow=mat == "g",
                 rot=("z", -22.5, (0, 28.55, FZ)))])


def v_grill(mat="g", frame="o"):
    """Vertical bars over a glowing mouth and eyes."""
    out = [decal("grill_bg", -3.4, 3.4, 25.2, 29.6, mat)]
    for i, x in enumerate((-2.6, -1.3, 0, 1.3, 2.6)):
        out.append(decal(f"bar{i}", x - 0.3, x + 0.3, 25.0, 29.8, frame, 1))
    return out + [decal("grill_top", -3.6, 3.6, 29.6, 30.0, frame, 1), decal("grill_bot", -3.6, 3.6, 24.8, 25.2, frame, 1)]


def v_band(mat="g"):
    return [decal("band", -4.4, 4.4, 28.2, 29.4, mat), decal("band_mid", -0.3, 0.3, 27.4, 28.2, mat)]


def v_goggles(lens="g", frame="t2"):
    out = []
    for s, sfx in ((1, "r"), (-1, "l")):
        x0, x1 = sorted((s * 0.8, s * 3.4))
        out += [decal("gog_" + sfx, x0, x1, 27.6, 30.2, frame), decal("lens_" + sfx, x0 + 0.4, x1 - 0.4, 28.0, 29.8, lens, 1)]
    out += [decal("gog_bridge", -0.8, 0.8, 28.6, 29.2, frame)]
    return out + [decal(f"vent{i}", -1.8 + i * 0.9, -1.4 + i * 0.9, 24.8, 26.6, frame) for i in range(5)]


def v_skull(bone="a", eye="g", dark="o"):
    return [decal("skull_face", -3.6, 3.6, 24.4, 31.4, bone),
            decal("socket_r", 0.6, 2.8, 28.0, 30.0, dark, 1), decal("socket_l", -2.8, -0.6, 28.0, 30.0, dark, 1),
            decal("eye_r", 1.2, 2.2, 28.5, 29.4, eye, 2), decal("eye_l", -2.2, -1.2, 28.5, 29.4, eye, 2),
            decal("nose", -0.45, 0.45, 26.8, 27.8, dark, 1)] + \
        [decal(f"tooth{i}", -2.2 + i * 0.9, -1.8 + i * 0.9, 24.8, 25.9, dark, 1) for i in range(5)]


def v_fish(eye="g", dark="o"):
    return [decal("fish_eye_r", 1.2, 3.4, 28.0, 30.0, dark), decal("fish_eye_l", -3.4, -1.2, 28.0, 30.0, dark),
            decal("fish_pupil_r", 1.7, 2.9, 28.4, 29.6, eye, 1), decal("fish_pupil_l", -2.9, -1.7, 28.4, 29.6, eye, 1),
            decal("fish_mouth", -2.0, 2.0, 25.2, 25.8, dark)]


def v_menpo(mask="m", dark="o", trim="t"):
    """Samurai face mask: a lacquered lower mask with a moustache, shadowed eyes above."""
    return [decal("menpo_shadow", -4.0, 4.0, 27.9, 29.6, dark),
            decal("menpo", -3.6, 3.6, 24.2, 27.9, mask),
            decal("menpo_nose", -0.6, 0.6, 27.2, 28.3, mask, 1),
            decal("menpo_moustache_r", 0.3, 2.6, 26.4, 26.9, dark, 1),
            decal("menpo_moustache_l", -2.6, -0.3, 26.4, 26.9, dark, 1),
            decal("menpo_mouth", -1.4, 1.4, 25.4, 25.8, trim, 1)]


def keep(old, *names):
    """Old helmet parts whose base name (without the mirrored _l) is listed."""
    out = []
    for p in old:
        base = p["name"][:-2] if p["name"].endswith("_l") else p["name"]
        if base in names:
            out.append(p)
    return out


# ------------------------------------------------------------------ closed versions of existing helmets
def paladin(old):
    return shell("m") + brow("t") + v_cross("t") + [
        decal("cross_gem", -0.35, 0.35, 30.25, 30.75, "g", 2)] + \
        keep(old, "plume0", "plume1", "plume2", "ridge", "wing0", "wing1", "wing2",
             "pauldron", "pauldron_edge", "pauldron_trim", "pauldron_gem")


def samurai(old):
    return shell("d", "m") + v_menpo("m", "o", "t") + \
        keep(old, "brim", "maedate", "horn0", "horn1", "horn_tip", "tehen", "fuki", "pole", "flag", "flag_mon",
             "shikoro1_b", "shikoro1_s", "shikoro2_b", "shikoro2_s", "sode_strap", "sode0", "sode1", "sode2")


def spartan(old):
    return shell("m") + v_tvisor("o") + [
        part("nose_guard", (-0.35, 27.6, -R - 0.2), (0.35, 29.9, -R), "t"),
        part("brow_ridge", (-R - 0.05, 29.3, -R - 0.12), (R + 0.05, 29.7, -R), "t")] + \
        keep(old, "crest", "crest_mount", "crest_tail", "shield", "shield_mark", "shield_mark_s", "shield_rim")


def dragon(old):
    return shell("pat_scale") + v_angry("g") + \
        keep(old, "snout", "snout_ridge", "fang", "fang2", "nostril", "horn0", "horn1", "horn2", "horn3",
             "frill0", "frill1", "spine0", "spine1", "spine2", "spine3", "crest",
             "wing_arm", "wing_claw", "wing_finger", "wing_mem", "wing_mem2")


def obsidian(old):
    return shell("pat_obsidian") + v_v("g") + [decal("chin_seam", -0.3, 0.3, 24.4, 27.4, "g")] + \
        keep(old, "shard", "shard_tip", "shard_back", "shard_s", "shard_s2", "pauldron", "spike", "spike_glow")


def magma(old):
    return shell("s1", "s2") + v_grill("g", "o") + [
        decal("drip0", -2.2, -1.6, 24.0, 25.0, "g"), decal("drip1", 1.2, 1.8, 24.2, 25.0, "g")] + \
        keep(old, "horn0", "horn1", "horn_tip", "pillar", "pillar2", "pillar_top")


def storm(old):
    return shell("m") + brow("t", 29.6, 30.0) + v_band("g") + v_breaths("d", (25.4,)) + \
        keep(old, "bolt0", "bolt1", "cloud0", "cloud1", "cloud2", "cloud3", "coil", "coil_base", "coil_orb",
             "rod", "rod_tip")


def clockwork(old):
    return shell("t", "t2") + v_goggles("g", "t2") + \
        keep(old, "antenna", "antenna_bulb", "earpiece", "gear", "gear_hub", "gear_t0", "gear_t1", "gear_t2",
             "gear_t3", "pipe", "valve", "exhaust", "ember", "sgear", "sgear_core", "sgear_hub", "sgear_t0", "sgear_t1")


def lift(parts, dy):
    """Move parts up (e.g. a crown that has to sit on top of the new shell)."""
    out = []
    for p in parts:
        q = dict(p, **{"from": [p["from"][0], p["from"][1] + dy, p["from"][2]],
                       "to": [p["to"][0], p["to"][1] + dy, p["to"][2]]})
        if p["rot"]:
            ax, ang, (ox, oy, oz) = p["rot"]
            q["rot"] = (ax, ang, (ox, oy + dy, oz))
        out.append(q)
    return out


def witherbane(old):
    return shell("d", "pat_plate") + v_skull("a", "g", "o") + \
        lift(keep(old, "skull", "skull_eye_r", "skull_eye_l", "skull_jaw", "skull_nose", "skull_s", "skull_s_eye",
                  "spine0", "spine1"), 2.4) + \
        keep(old, "pauldron", "pauldron_bone", "pauldron_spike", "pauldron_spike2")


def dreadwyrm(old):
    return shell("pat_scale") + v_angry("g") + [decal("snout_line", -0.3, 0.3, 24.6, 28.2, "m")] + \
        keep(old, "crest_spike0", "crest_spike1", "crest_spike2", "horn0", "horn1", "horn2", "horn_tip",
             "frill", "frill_ray", "temple_gem", "pauldron", "pauldron_ridge", "pauldron_spike", "pauldron_spike2")


def leviathan(old):
    return shell("pat_wave") + v_fish("g", "o") + \
        keep(old, "lure", "lure_arm", "lure_drop", "lure_stalk", "fin", "fin_ray0", "fin_ray1", "fin_top",
             "fin_top_ray", "gill0", "gill1", "pauldron", "pauldron_barnacle", "pauldron_glow", "pauldron_shell")


def revenant(old):
    """The hood stays; inside it there is no face, only two soul-lit eyes."""
    return old + [part("void_face", (-4.2, 24.4, -4.75), (4.2, 31, -4.55), "o"),
                  part("void_eye_r", (0.8, 28.4, -4.8), (2.2, 29.2, -4.75), "g", glow=True),
                  part("void_eye_l", (-2.2, 28.4, -4.8), (-0.8, 29.2, -4.75), "g", glow=True)]


CLOSED = {"paladin": paladin, "samurai": samurai, "spartan": spartan, "dragon": dragon, "obsidian": obsidian,
          "magma": magma, "storm": storm, "clockwork": clockwork, "witherbane": witherbane,
          "dreadwyrm": dreadwyrm, "leviathan": leviathan, "revenant": revenant}


def apply(sets):
    for S in sets:
        fn = CLOSED.get(S["id"])
        if fn and not S.get("_closed"):
            S["helmet"] = (lambda old=S["helmet"], fn=fn: fn(old()))
            S["_closed"] = True
