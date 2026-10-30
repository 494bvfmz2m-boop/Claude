#!/usr/bin/env python3
"""Generates the EderveenGroup logo kit as SVG files.

The mark: a G drawn as an open ring, an E inside it whose middle arm is the G's
crossbar, and a small "orbit" dot in the ring's opening.

The wordmark is Instrument Serif ("Ederveen" upright, "Group" italic), converted
to outlines so the SVGs render identically without the font installed.

Usage: python3 make_logo.py <fonts-dir> <out-dir>
Needs: fonttools, uharfbuzz. Fonts: InstrumentSerif-Regular.ttf, InstrumentSerif-Italic.ttf
(SIL Open Font License, from Google Fonts).
"""

import math
import os
import sys

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONTS, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# ---------- colours ----------
DARK = {'bg': '#0b0d12', 'tile': '#161a23', 'ink': '#f1f4f9', 'accent': '#79a9ff', 'g0': '#b9d2ff', 'g1': '#4c8dff', 'dot': '#e8f0ff'}
LIGHT = {'bg': '#ffffff', 'tile': '#eef1f6', 'ink': '#0f172a', 'accent': '#2563eb', 'g0': '#6ea2ff', 'g1': '#2563eb', 'dot': '#2563eb'}


# ---------- the mark (64 x 64 grid) ----------
def _pt(r, deg, c=32):
    return c + r * math.cos(math.radians(deg)), c - r * math.sin(math.radians(deg))


def mark(c, uid, mono=None):
    """Mark geometry on a 64-unit grid. mono: single colour for everything."""
    sx, sy = _pt(23, 46)  # ring starts upper right, runs anticlockwise round to the right middle
    dx, dy = _pt(23, 21)  # orbit dot sits in the opening
    stroke = mono or f'url(#{uid}g)'
    dot = mono or c['dot']
    defs = '' if mono else (
        f'<defs><linearGradient id="{uid}g" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{c["g0"]}"/><stop offset="1" stop-color="{c["g1"]}"/></linearGradient>'
        f'<radialGradient id="{uid}h"><stop offset="0" stop-color="{c["g1"]}" stop-opacity=".55"/>'
        f'<stop offset="1" stop-color="{c["g1"]}" stop-opacity="0"/></radialGradient></defs>'
    )
    halo = '' if mono else f'<circle cx="{dx:.2f}" cy="{dy:.2f}" r="8" fill="url(#{uid}h)"/>'
    return (
        defs
        + f'<g fill="none" stroke="{stroke}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round">'
        f'<path d="M {sx:.2f} {sy:.2f} A 23 23 0 1 0 55 32 H 23.6"/>'
        f'<path d="M 23.6 21.6 V 42.4 M 23.6 21.6 H 34.6 M 23.6 42.4 H 34.6"/></g>'
        + halo
        + f'<circle cx="{dx:.2f}" cy="{dy:.2f}" r="3.7" fill="{dot}"/>'
    )


# ---------- wordmark as outlines ----------
class Face:
    def __init__(self, path):
        self.tt = TTFont(path)
        self.upm = self.tt['head'].unitsPerEm
        self.glyphs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        blob = hb.Blob.from_file_path(path)
        self.hbfont = hb.Font(hb.Face(blob))

    def shape(self, text):
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hbfont, buf, {'kern': True, 'liga': True})
        return buf.glyph_infos, buf.glyph_positions


def text_path(runs, size, x, baseline, run_gap=0.0):
    """runs: [(Face, text, colour)]. run_gap: extra space between runs, in em. Returns (svg, width)."""
    out, pen_x = [], x
    for i, (face, text, colour) in enumerate(runs):
        if i:
            pen_x += run_gap * size
        scale = size / face.upm
        infos, positions = face.shape(text)
        d = []
        for info, pos in zip(infos, positions):
            name = face.order[info.codepoint]
            sp = SVGPathPen(face.glyphs)
            tp = TransformPen(sp, (scale, 0, 0, -scale, pen_x + pos.x_offset * scale, baseline - pos.y_offset * scale))
            face.glyphs[name].draw(tp)
            d.append(sp.getCommands())
            pen_x += pos.x_advance * scale
        out.append(f'<path fill="{colour}" d="{" ".join(d)}"/>')
    return ''.join(out), pen_x - x


REG = Face(os.path.join(FONTS, 'InstrumentSerif-Regular.ttf'))
ITA = Face(os.path.join(FONTS, 'InstrumentSerif-Italic.ttf'))
CAP = REG.tt['OS/2'].sCapHeight / REG.upm  # cap height as a fraction of font size


def wordmark(c, size, x, baseline, mono=None):
    return text_path([(REG, 'Ederveen', mono or c['ink']), (ITA, 'Group', mono or c['accent'])], size, x, baseline, run_gap=0.035)


def svg(w, h, body, title='EderveenGroup'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'


def write(name, content):
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(content)
    print('wrote', name)


def horizontal(c, mono=None, bg=False):
    size = 100  # font size
    cap = CAP * size
    m = cap * 1.7  # mark height relative to the caps
    pad = 0.0
    gap = m * 0.32
    _, tw = wordmark(c, size, 0, 0)
    w = m + gap + tw
    h = m
    baseline = h / 2 + cap / 2
    body = f'<g transform="scale({m / 64:.5f})">{mark(c, "h", mono)}</g>'
    text, _ = wordmark(c, size, m + gap, baseline, mono)
    body += text
    if bg:
        pad = h * 0.6
        body = f'<rect width="{w + 2 * pad:.0f}" height="{h + 2 * pad:.0f}" rx="{h * 0.25:.0f}" fill="{c["bg"]}"/><g transform="translate({pad:.1f} {pad:.1f})">{body}</g>'
    return svg(w + 2 * pad, h + 2 * pad, body)


def stacked(c, mono=None):
    size = 100
    _, tw = wordmark(c, size, 0, 0)
    m = 150
    gap = 36
    w = max(tw, m)
    h = m + gap + size * 0.98
    body = f'<g transform="translate({(w - m) / 2:.1f} 0) scale({m / 64:.5f})">{mark(c, "s", mono)}</g>'
    text, _ = wordmark(c, size, (w - tw) / 2, m + gap + CAP * size, mono)
    return svg(w, h, body + text)


def icon(c, uid='i'):
    # app icon: rounded tile, mark centred with breathing room
    return svg(64, 64, f'<rect width="64" height="64" rx="14.5" fill="{c["tile"]}"/>'
               f'<g transform="translate(32 32) scale(.78) translate(-32 -32)">{mark(c, uid)}</g>')


def social(c):
    # 1200 x 630 sharing image
    w, h = 1200, 630
    rings = ''.join(f'<circle cx="930" cy="315" r="{r}" fill="none" stroke="{c["g1"]}" stroke-opacity="{o}" stroke-width="1.2"{da}/>'
                    for r, o, da in [(420, .18, ' stroke-dasharray="2 9"'), (340, .25, ''), (250, .18, ' stroke-dasharray="2 9"'), (170, .22, '')])
    size = 104
    cap = CAP * size
    m = cap * 1.7
    text, tw = wordmark(c, size, 0, 0)
    x0 = 90
    y_mid = 300
    body = (f'<rect width="{w}" height="{h}" fill="{c["bg"]}"/>'
            f'<defs><radialGradient id="sg" cx="930" cy="315" r="420" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{c["g1"]}" stop-opacity=".22"/><stop offset="1" stop-color="{c["g1"]}" stop-opacity="0"/></radialGradient></defs>'
            f'<rect width="{w}" height="{h}" fill="url(#sg)"/>{rings}'
            f'<g transform="translate({x0} {y_mid - m / 2:.1f}) scale({m / 64:.5f})">{mark(c, "o")}</g>')
    t, _ = wordmark(c, size, x0 + m * 1.32, y_mid + cap / 2)
    sub, _ = text_path([(ITA, 'Correspondence, refined.', c['accent'])], 44, x0, y_mid + 130)
    return svg(w, h, body + t + sub)


write('ederveengroup-mark.svg', svg(64, 64, mark(DARK, 'm')))
write('ederveengroup-mark-light.svg', svg(64, 64, mark(LIGHT, 'm')))
write('ederveengroup-icon.svg', icon(DARK))
write('ederveengroup-icon-light.svg', icon(LIGHT))
write('ederveengroup-logo-dark.svg', horizontal(DARK))
write('ederveengroup-logo-light.svg', horizontal(LIGHT))
write('ederveengroup-logo-dark-bg.svg', horizontal(DARK, bg=True))
write('ederveengroup-logo-stacked-dark.svg', stacked(DARK))
write('ederveengroup-logo-stacked-light.svg', stacked(LIGHT))
write('ederveengroup-logo-white.svg', horizontal(DARK, mono='#ffffff'))
write('ederveengroup-logo-black.svg', horizontal(LIGHT, mono='#000000'))
write('ederveengroup-social.svg', social(DARK))
