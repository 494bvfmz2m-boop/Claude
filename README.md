# Learn to Build a Website

A self-paced, interactive course covering the core technologies behind almost
every website: **HTML**, **CSS**, **JavaScript**, **JSON**, **SQL**, and **PHP**
— plus a final lesson tying them all together.

It's a static site (no build step, no server required to view it) with 36
lessons across 7 topics. Every lesson has a short explanation, a real code
example, and something interactive to try:

- **HTML / CSS / JavaScript** — a live in-browser editor with a real preview
  (HTML + CSS + JS run together in a sandboxed `<iframe>`).
- **SQL** — a real SQLite database running entirely in your browser (via
  [sql.js](https://sql.js.org)), seeded with a small bookstore dataset. Write
  and run actual queries, including `INSERT`/`UPDATE`/`DELETE`/`CREATE TABLE`,
  with instant feedback on whether your query did the right thing.
- **JSON** — a validator/formatter to practice spotting and fixing broken JSON.
- **PHP** — since PHP only runs on a server (not in a browser), these lessons
  use "predict the output" exercises instead of a live editor.

Each lesson ends with a short quiz, and progress is tracked per-lesson in your
browser's `localStorage` (see the checkmarks in the sidebar and the progress
bars on the overview page). Nothing is sent anywhere — it all stays on your
machine.

## Running it

It's just static files, so the simplest option is to open `index.html`
directly in a browser. For the SQL lessons to load their database engine from
a CDN reliably, it's better to serve the folder over `http://` instead of
`file://`:

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static file server works (VS Code's "Live Server" extension, `npx serve`,
etc.) — there's no backend and nothing to install.

## Project structure

```
index.html                  # page shell + navigation
assets/css/style.css        # all styling
assets/js/engine.js         # router, quiz engine, playgrounds, progress tracking
assets/js/content/
  html.js                   # lesson content per topic — plain data + code samples
  css.js
  javascript.js
  json.js
  sql.js
  php.js
  capstone.js                # "how it all fits together"
```

To add or edit a lesson, find its topic file under `assets/js/content/` and
edit the `lessons` array — each lesson is a plain object with a title, an
array of content `blocks` (text, code samples, notes, or an interactive
block), and a `quiz`. No build step is needed; just refresh the page.
