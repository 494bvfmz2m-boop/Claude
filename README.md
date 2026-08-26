# Quellum marketing site

This is **quellum.site** — the public marketing page. Plain HTML/CSS/JS,
no build step at all.

This `quellum-site` branch is an orphan branch (no shared history, no bot
code) holding just this site at the repo root, kept in sync by hand from
the `marketing-site/` folder on the main dev branch. It exists so Coolify
(or anything else that wants a plain git checkout) can point straight at
this branch with no subdirectory configuration needed.

## Structure

- `index.html` — homepage (hero, features preview, how it works, closed-beta status, CTA)
- `features.html` — full feature deep-dive
- `css/style.css`, `js/main.js` — shared by both pages
- `img/` — logo + favicon (SVG)
- `.htaccess` — Apache rewrite rules for clean URLs (`/features` instead of `/features.html`), used by the real host
- `Dockerfile`, `nginx.conf` — nginx serving the static files with the same clean-URL behavior as `.htaccess`, used for the Coolify preview

## Deploying

**Real host (production):** upload the contents of this folder (not the
folder itself) to the web host's document root. Since it's static, any
static host works as long as `.htaccess` support (or an equivalent rewrite
rule) is available for the clean URLs to work — without it, the pages
still work, just at their `.html` paths.

**Coolify (preview):** point a new resource at this repo, branch
`quellum-site`, build pack "Dockerfile" — no base directory needed since
this branch's root *is* the site.

## Live data

`js/main.js` fetches `https://bot.quellum.site/api/beta-status` on load to
show a live "N of 15 spots taken" count, sourced from the bot's beta
allowlist (`BetaAllowlist` in `../src/db/repo.js`). That's the only runtime
connection between the two — everything else on this site is static content
edited by hand.

## Keeping it in sync

When a bot-side feature changes user-facing behavior (new commands, renamed
commands, new dashboard capabilities), the feature list on `features.html`
and the preview cards on `index.html` should get updated to match — nothing
does this automatically.
