# EderveenGroup logo kit

The mark: a **G** drawn as an open ring, with an **E** inside whose middle arm is
the G's crossbar, and an orbiting dot in the opening (the same orbit motif as the
website's login and landing artwork). The wordmark is Instrument Serif:
"Ederveen" upright, "Group" in italic blue.

| File | Use |
|---|---|
| `ederveengroup-logo-dark.svg/.png` | Main logo on dark backgrounds |
| `ederveengroup-logo-light.svg/.png` | Main logo on light backgrounds |
| `ederveengroup-logo-stacked-*.svg/.png` | Square-ish spaces (posters, profile headers) |
| `ederveengroup-logo-white.*` / `-black.*` | One-colour (print, embossing, overlays) |
| `ederveengroup-mark*.svg`, `-mark-512.png` | The symbol on its own |
| `ederveengroup-icon*.svg/.png`, `apple-touch-icon.png`, `favicon-32.png` | App icon, favicons, profile pictures |
| `ederveengroup-social.svg/.png` | 1200x630 link-preview image |

Colours: graphite `#0b0d12`, tile `#161a23`, blue `#4c8dff` (gradient from `#b9d2ff`),
light-mode blue `#2563eb`, ink `#0f172a`.

The text is converted to outlines, so the SVGs look the same everywhere. To regenerate:
`python3 scripts/brand/make_logo.py <fonts-dir> brand` (needs Instrument Serif TTFs, fonttools, uharfbuzz).
