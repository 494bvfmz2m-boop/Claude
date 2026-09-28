"""Software preview of a full armor set on a player: flat armor layers on the
body plus the head-worn 3D parts (in player space, with element rotation).
Used to check sets before shipping; not part of the pack."""
import math

from PIL import Image, ImageDraw

LIGHT = {"north": .95, "south": .6, "east": .75, "west": .8, "up": 1.0, "down": .45}
NORMALS = {"north": (0, 0, -1), "south": (0, 0, 1), "east": (1, 0, 0), "west": (-1, 0, 0),
           "up": (0, 1, 0), "down": (0, -1, 0)}


def box_faces(u, v, w, h, d):
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d), "right": (u, v + d, d, h),
            "front": (u + d, v + d, w, h), "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h)}


HEAD, BODY, ARM, LEG = box_faces(0, 0, 8, 8, 8), box_faces(16, 16, 8, 12, 4), box_faces(40, 16, 4, 12, 4), \
    box_faces(0, 16, 4, 12, 4)


def face_fn(f, b):
    (x0, y0, z0), (x1, y1, z1) = b
    w, h, d = x1 - x0, y1 - y0, z1 - z0
    return {"north": lambda s, t: (x1 - s * w, y1 - t * h, z0),
            "south": lambda s, t: (x0 + s * w, y1 - t * h, z1),
            "east": lambda s, t: (x1, y1 - t * h, z1 - s * d),
            "west": lambda s, t: (x0, y1 - t * h, z0 + s * d),
            "up": lambda s, t: (x0 + s * w, y1, z0 + t * d),
            "down": lambda s, t: (x0 + s * w, y0, z1 - t * d)}[f]


def rotate(pt, rot):
    if not rot:
        return pt
    axis, ang, (ox, oy, oz) = rot
    a = math.radians(ang)
    x, y, z = pt[0] - ox, pt[1] - oy, pt[2] - oz
    c, s = math.cos(a), math.sin(a)
    if axis == "x":
        y, z = y * c - z * s, y * s + z * c
    elif axis == "y":
        x, z = x * c + z * s, -x * s + z * c
    else:
        x, y = x * c - y * s, x * s + y * c
    return (x + ox, y + oy, z + oz)


def render(l1, l2, atlas, parts, yaw_deg, size=(640, 760), scale=12, skin=(196, 150, 120)):
    yaw, pitch = math.radians(yaw_deg), math.radians(12)

    def cam(p):
        X, Y, Z = p[0], p[1] - 17, p[2]
        x1 = X * math.cos(yaw) + Z * math.sin(yaw)
        z1 = -X * math.sin(yaw) + Z * math.cos(yaw)
        return x1, Y * math.cos(pitch) - z1 * math.sin(pitch), Y * math.sin(pitch) + z1 * math.cos(pitch)

    polys, layer = [], [0]

    def add_box(b, faces, mirror=False, rot=None):
        for f, (img, rect) in faces.items():
            n0 = rotate((0, 0, 0), (rot[0], rot[1], (0, 0, 0))) if rot else (0, 0, 0)
            n1 = rotate(NORMALS[f], (rot[0], rot[1], (0, 0, 0))) if rot else NORMALS[f]
            if cam(n1)[2] - cam(n0)[2] >= 0:
                continue
            P = face_fn(f, b)
            rx, ry, rw, rh = rect
            fm = mirror
            if rw < 0:
                rx, rw, fm = rx + rw, -rw, not mirror
            nu, nv = max(1, round(rw)), max(1, round(rh))
            for i in range(nu):
                for j in range(nv):
                    uu = rx + (nu - 1 - i + 0.5 if fm else i + 0.5) * rw / nu
                    vv = ry + (j + 0.5) * rh / nv
                    c = img.getpixel((min(img.size[0] - 1, int(uu)), min(img.size[1] - 1, int(vv))))
                    if c[3] == 0:
                        continue
                    pts = [cam(rotate(P(a / nu, bb / nv), rot)) for a, bb in
                           ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
                    polys.append((layer[0], sum(p[2] for p in pts) / 4, [(p[0], p[1]) for p in pts],
                                  tuple(int(v * LIGHT[f]) for v in c[:3])))

    def armor_box(b, infl, img, net, mirror=False):
        (x0, y0, z0), (x1, y1, z1) = b
        bb = ((x0 - infl, y0 - infl, z0 - infl), (x1 + infl, y1 + infl, z1 + infl))
        m = {"north": "front", "south": "back", "east": "right", "west": "left", "up": "top", "down": "bottom"}
        if mirror:
            m["east"], m["west"] = "left", "right"
        add_box(bb, {f: (img, net[k]) for f, k in m.items()}, mirror)

    sk = Image.new("RGBA", (1, 1), skin + (255,))
    body, ra, la = ((-4, 12, -2), (4, 24, 2)), ((4, 12, -2), (8, 24, 2)), ((-8, 12, -2), (-4, 24, 2))
    rl, ll, head = ((0, 0, -2), (4, 12, 2)), ((-4, 0, -2), (0, 12, 2)), ((-4, 24, -4), (4, 32, 4))
    for b in (body, ra, la, rl, ll, head):
        add_box(b, {f: (sk, (0, 0, 1, 1)) for f in NORMALS})
    layer[0] = 1
    armor_box(body, 0.5, l2, BODY)
    armor_box(rl, 0.5, l2, LEG)
    armor_box(ll, 0.5, l2, LEG, True)
    layer[0] = 2
    armor_box(body, 1, l1, BODY)
    armor_box(ra, 1, l1, ARM)
    armor_box(la, 1, l1, ARM, True)
    armor_box(rl, 1, l1, LEG)
    armor_box(ll, 1, l1, LEG, True)
    layer[0] = 3
    for p in parts:
        add_box((p["from"], p["to"]), {f: (atlas, r) for f, r in p["faces"].items()}, rot=p.get("rot"))
    # parts are drawn depth-sorted together with the armor so they can sit behind the body
    # skin first, then armor and parts depth-sorted together (so parts can sit behind the body);
    # head parts behind the middle of the head (a hood's back panel) sort in with the skin instead
    mid = cam((0, 28, 0))[2]
    polys.sort(key=lambda q: (0 if q[0] == 3 and q[1] > mid + 2 else min(q[0], 2), -q[1]))
    img = Image.new("RGB", size, (24, 24, 28))
    dr = ImageDraw.Draw(img)
    cx, cy = size[0] // 2, int(size[1] * 0.53)
    for *_, pts, c in polys:
        dr.polygon([(cx + x * scale, cy - y * scale) for x, y in pts], fill=c)
    return img


def sheet(l1, l2, atlas, parts, icons, title_color=(255, 255, 255)):
    """Front, side and back renders plus the four icons, in one image."""
    views = [render(l1, l2, atlas, parts, y) for y in (-30, 100, 200)]
    w, h = views[0].size
    out = Image.new("RGB", (w * 3, h + 140), (24, 24, 28))
    for i, v in enumerate(views):
        out.paste(v, (i * w, 0))
    for i, ic in enumerate(icons):
        bg = Image.new("RGBA", ic.size, (139, 139, 139, 255))
        bg.alpha_composite(ic)
        out.paste(bg.convert("RGB").resize((112, 112), Image.NEAREST), (20 + i * 130, h + 14))
    return out
