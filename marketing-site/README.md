# Quellum marketing site

This is **quellum.site** — the public marketing page. It's a separate static
site from the bot/dashboard (which lives in `../src` and deploys as
`bot.quellum.site`). No shared build, no shared deploy — this folder is
plain HTML/CSS/JS with no build step at all, and isn't touched by the
bot's `Dockerfile` (which only copies `../src`).

## Structure

- `index.html` — homepage (hero, features preview, how it works, closed-beta status, CTA)
- `features.html` — full feature deep-dive
- `css/style.css`, `js/main.js` — shared by both pages
- `img/` — logo + favicon (SVG)
- `.htaccess` — Apache rewrite rules for clean URLs (`/features` instead of `/features.html`)

## Deploying

Upload the contents of this folder (not the folder itself) to the web
host's document root. Since it's static, any static host works as long as
`.htaccess` support (or an equivalent rewrite rule) is available for the
clean URLs to work — without it, the pages still work, just at their
`.html` paths.

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
