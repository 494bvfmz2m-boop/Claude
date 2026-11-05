#!/usr/bin/env python3
"""Knowledge Galaxy server (standard library only).

    python3 server.py [--host 127.0.0.1] [--port 4700]

GET  /            static files from viewer/ ONLY (config.json lives outside it)
POST /chat        {"question": "..."} -> {"answer": "...", "nodes": [note ids]}
POST /chat/reset  forget this browser session's conversation history
POST /chat/undo   revert Jarvis's most recent batch of note changes

Jarvis can also change notes (create / update / append / rename / move /
delete). That happens only inside notes/; deleted or overwritten notes are
kept in notes/.trash/ and every batch can be undone.

/chat picks the 6 notes that best match the question by keyword overlap
(title matches weigh extra) and asks Claude to answer from them only.
Backend is chosen per request from config.json ("provider" is optional;
by default it is detected from the key):
  * Anthropic key (sk-ant-...)       -> Anthropic Messages API with "model"
  * Google Gemini key (AIza... / AQ.) -> Gemini API with "model"
                                        (a claude-* model falls back to gemini-flash-latest)
  * placeholder / empty               -> `claude -p` on your Claude Code subscription
                                        (optional "cli_model" picks its model)
The API key is read server-side only and is never sent to the browser.
"""
import argparse
import functools
import json
import math
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import build
import notes_store

ROOT = os.path.dirname(os.path.abspath(__file__))
VIEWER_DIR = os.path.join(ROOT, "viewer")
NOTES_DIR = os.path.join(ROOT, "notes")
CONFIG_PATH = os.path.join(ROOT, "config.json")
PLACEHOLDER_KEY = "PUT-YOUR-KEY-HERE"
DEFAULT_CONFIG = {"api_key": PLACEHOLDER_KEY, "model": "claude-opus-4-8"}
DEFAULT_GEMINI_MODEL = "gemini-flash-latest"
# Tried in order when the chosen Gemini model is overloaded or unavailable.
GEMINI_FALLBACKS = ("gemini-2.5-flash", "gemini-flash-lite-latest")
GEMINI_BUDGET = 40            # seconds Gemini gets in total before we hand over to Claude
PROVIDERS = ("anthropic", "gemini", "claude-cli")

TOP_K = 6
MAX_TURNS = 6                 # remembered question/answer pairs per session
SESSION_TTL = 60 * 60         # forget idle sessions after an hour
MAX_SESSIONS = 500
COOKIE = "galaxy_sid"

SYSTEM_PROMPT = """You are Jarvis: a dry, impeccably polite British butler with a razor wit, in charge of the user's personal knowledge base (a folder of markdown notes shown as a 3D galaxy). You answer questions from the notes and you can change the notes.

Character: understated, unflappable, quietly amused; think the finest butler in London who has seen everything twice. Address the user as "sir" now and then (roughly one reply in three, never more than once per reply), even when replying in another language. Wit comes from understatement and precision, never from exclamation marks, emoji, puns stacked on puns, or sycophancy. One genuinely funny line beats three bland ones; if nothing witty comes naturally, be crisp instead of forced.

Reply with exactly ONE JSON object and nothing else (no code fences):
{"answer": "...", "speech": "...", "lang": "en", "intent": "notes", "sources": ["Note title"], "actions": []}

- intent: "notes" when the user asks about the content of their notes; "edit" when they ask you to change notes; "chat" for small talk, jokes, greetings, thanks, or questions about you. For "chat", sources must be [].
- answer, for "notes": ONE witty sentence, then the specific facts asked for (figures, dates, names) in one or two tight sentences; under 60 words in total. Never recite, paraphrase or summarise the note itself: it is already open on screen. For "chat": one or two sentences, in character. For "edit": say briefly what you did. Plain prose, no lists or markdown, in the language the user wrote in.
- speech: ONE sentence (max 20 words) read aloud: the witty line or the key fact, never a note's contents.
- lang: language code of answer/speech, e.g. "en" or "nl".
- sources: exact titles of the notes your answer actually relies on, most important first; [] when nothing in the notes supports it.
- actions: changes to the notes, ONLY when the user clearly asks to create, write, edit, add to, rename, move or delete notes; otherwise []. Allowed shapes:
  {"op": "create", "title": "Title", "folder": "optional/folder", "content": "markdown body"}
  {"op": "update", "title": "Existing title", "content": "complete new markdown body"}
  {"op": "append", "title": "Existing title", "content": "markdown to add at the end"}
  {"op": "rename", "title": "Existing title", "new_title": "New title"}
  {"op": "move", "title": "Existing title", "folder": "target folder, '' for top level"}
  {"op": "delete", "title": "Existing title"}
  {"op": "delete_all"}
  Use exact titles from <catalog>. Use "update" only when that note's full text is in <notes>; otherwise use "append". Note content you write is plain, useful markdown (keep the wit out of the notes themselves), with [[Other note title]] wikilinks when it relates to existing notes. Deleted notes go to the trash and every change can be undone, so do as asked; for a request to delete everything, use delete_all.

Facts come ONLY from the notes in <notes>: no outside knowledge, no invented figures or names. If the notes don't cover a question, say so with good grace (and mention anything related that is there). Earlier turns are context for follow-ups.
"""

STOPWORDS = set("""
a about above after again against all am an and any are aren as at be because been
before being below between both but by can cannot could did do does doing down during
each few for from further had has have having he her here hers herself him himself his
how i if in into is it its itself just let me more most my myself no nor not now of off
on once only or other ought our ours ourselves out over own same she should so some such
than that the their theirs them themselves then there these they this those through to
too under until up very was we were what when where which while who whom why will with
would you your yours yourself yourselves tell know want need get got give show list much
many please thing things anything something does doesn did us also use used using whats
""".split())


# ---------------------------------------------------------------- config

def load_config():
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f)
            f.write("\n")
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = json.load(f)
    key = str(cfg.get("api_key") or "").strip()
    cfg["api_key"] = "" if key in ("", PLACEHOLDER_KEY) else key
    provider = str(cfg.get("provider") or "auto").strip().lower()
    if provider not in PROVIDERS:
        if not cfg["api_key"]:
            provider = "claude-cli"
        elif cfg["api_key"].startswith(("AIza", "AQ.")):
            provider = "gemini"
        else:
            provider = "anthropic"
    cfg["provider"] = provider
    return cfg


# ---------------------------------------------------------------- retrieval

def tokens(text):
    out = []
    for w in re.findall(r"[a-z0-9]+", text.lower().replace("'s", "")):
        if w in STOPWORDS or len(w) < 2:
            continue
        if len(w) > 4 and w.endswith("ies"):
            w = w[:-3] + "y"
        elif len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


class NoteIndex:
    """Notes in the same order as build.py (so ids == indexes in GRAPH.nodes).
    Rebuilt automatically when any note file changes."""

    def __init__(self, notes_dir):
        self.notes_dir = notes_dir
        self.stamp = None
        self.lock = threading.Lock()

    def _stamp(self):
        files = build.scan(self.notes_dir)
        return tuple((p, os.path.getmtime(p)) for p in files)

    def get(self):
        with self.lock:
            stamp = self._stamp()
            if stamp != self.stamp:
                graph = build.build(self.notes_dir, include_text=True)
                self.nodes = graph["nodes"]
                self.tf = []
                self.title_terms = []
                df = {}
                for n in self.nodes:
                    counts = {}
                    for t in tokens(n["label"] + " " + n["text"]):
                        counts[t] = counts.get(t, 0) + 1
                    self.tf.append(counts)
                    self.title_terms.append(set(tokens(n["label"])))
                    for t in counts:
                        df[t] = df.get(t, 0) + 1
                total = len(self.nodes)
                self.idf = {t: math.log(1 + total / c) for t, c in df.items()}
                self.stamp = stamp
            return self

    def search(self, question, context="", k=TOP_K):
        """Keyword-overlap score; title hits weigh 3x; an exact title phrase in
        the question is a strong bonus. `context` (the previous question) is
        scored at half weight so follow-ups like "how much does it cost?" work."""
        weights = {}
        for t in tokens(context):
            weights[t] = max(weights.get(t, 0), 0.5)
        for t in tokens(question):
            weights[t] = 1.0
        q_lower = " " + re.sub(r"\s+", " ", question.lower()) + " "
        scored = []
        for i, n in enumerate(self.nodes):
            score = 0.0
            for t, w in weights.items():
                idf = self.idf.get(t)
                if not idf:
                    continue
                tf = self.tf[i].get(t, 0)
                if tf:
                    score += w * idf * (1 + math.log(tf))
                if t in self.title_terms[i]:
                    score += w * idf * 3
            if " " + n["label"].lower() + " " in q_lower:
                score += 10
            if score > 0:
                scored.append((score, i))
        scored.sort(key=lambda s: (-s[0], s[1]))
        if not scored:
            return []
        best = scored[0][0]
        # drop weak tail matches (< 15% of the best) so noise isn't sent as "sources"
        return [i for s, i in scored[:k] if s >= best * 0.15]


# ---------------------------------------------------------------- sessions

class Sessions:
    def __init__(self):
        self.data = {}
        self.lock = threading.Lock()

    def history(self, sid):
        with self.lock:
            self._gc()
            entry = self.data.get(sid)
            return list(entry["turns"]) if entry else []

    def add(self, sid, question, answer):
        with self.lock:
            entry = self.data.setdefault(sid, {"turns": [], "t": 0})
            entry["turns"] = (entry["turns"] + [(question, answer)])[-MAX_TURNS:]
            entry["t"] = time.time()

    def reset(self, sid):
        with self.lock:
            self.data.pop(sid, None)

    def _gc(self):
        now = time.time()
        for sid in [s for s, e in self.data.items() if now - e["t"] > SESSION_TTL]:
            del self.data[sid]
        if len(self.data) > MAX_SESSIONS:
            for sid, _ in sorted(self.data.items(), key=lambda kv: kv[1]["t"])[:len(self.data) - MAX_SESSIONS]:
                del self.data[sid]


INDEX = NoteIndex(NOTES_DIR)
STORE = notes_store.NoteStore(NOTES_DIR, os.path.join(VIEWER_DIR, "graph-data.js"))
SESSIONS = Sessions()


# ---------------------------------------------------------------- LLM backends

class ChatError(Exception):
    pass


def notes_block(nodes, ids):
    parts = []
    for i in ids:
        n = nodes[i]
        parts.append(f'<note title="{n["label"]}" folder="{n["group"]}">\n{n["text"]}\n</note>')
    return "<notes>\n" + ("\n\n".join(parts) if parts else "(no matching notes)") + "\n</notes>"


def ask_api(cfg, history, prompt):
    messages = []
    for q, a in history:
        messages += [{"role": "user", "content": q},
                     {"role": "assistant", "content": json.dumps({"answer": a}, ensure_ascii=False)}]
    messages.append({"role": "user", "content": prompt})
    body = json.dumps({
        "model": cfg.get("model") or DEFAULT_CONFIG["model"],
        "max_tokens": 4000,
        "system": SYSTEM_PROMPT,
        "messages": messages,
    }).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, method="POST", headers={
        "x-api-key": cfg["api_key"],
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        try:
            msg = json.load(e).get("error", {}).get("message", "")
        except Exception:
            msg = ""
        raise ChatError(f"Anthropic API error {e.code}: {msg or e.reason}")
    except urllib.error.URLError as e:
        raise ChatError(f"Could not reach the Anthropic API: {e.reason}")
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()


def ask_gemini(cfg, history, prompt):
    model = str(cfg.get("model") or "")
    if not model or model.startswith("claude"):
        model = DEFAULT_GEMINI_MODEL
    model = model.removeprefix("models/")
    contents = []
    for q, a in history:
        contents += [{"role": "user", "parts": [{"text": q}]},
                     {"role": "model", "parts": [{"text": json.dumps({"answer": a}, ensure_ascii=False)}]}]
    contents.append({"role": "user", "parts": [{"text": prompt}]})
    body = json.dumps({
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 8192, "temperature": 0.3,
                             "responseMimeType": "application/json"},
    }).encode()
    models = [model] + [m for m in GEMINI_FALLBACKS if m != model]
    last_error = None
    deadline = time.monotonic() + GEMINI_BUDGET
    data = None
    for attempt, name in enumerate(models):
        remaining = deadline - time.monotonic()
        if remaining < 3:
            break
        url = ("https://generativelanguage.googleapis.com/v1beta/models/"
               + urllib.parse.quote(name) + ":generateContent")
        # Key goes in a header, not the URL, so it never shows up in logs.
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "x-goog-api-key": cfg["api_key"], "content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=min(25, remaining)) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            try:
                msg = json.load(e).get("error", {}).get("message", "")
            except Exception:
                msg = ""
            last_error = ChatError(f"Gemini API error {e.code} ({name}): {msg or e.reason}")
            # overloaded / rate-limited / model gone -> try the next model
            if e.code in (429, 500, 503, 404):
                time.sleep(0.5 * (attempt + 1))
                continue
            raise last_error
        except (TimeoutError, OSError) as e:   # includes URLError and read timeouts
            reason = getattr(e, "reason", None) or type(e).__name__
            last_error = ChatError(f"Gemini didn't answer in time ({name}): {reason}")
            continue
    if data is None:
        raise last_error or ChatError("Gemini ran out of time.")
    candidates = data.get("candidates") or []
    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason", "no answer")
        raise ChatError(f"Gemini returned no answer ({reason}).")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()


def find_claude(cfg):
    """Locate the Claude Code CLI: config "claude_path", then PATH, then the
    usual install folders (native installer and npm, Windows/macOS/Linux)."""
    explicit = str(cfg.get("claude_path") or "").strip()
    if explicit:
        return explicit if os.path.exists(explicit) else None
    found = shutil.which("claude")
    if found:
        return found
    home = os.path.expanduser("~")
    appdata = os.environ.get("APPDATA", os.path.join(home, "AppData", "Roaming"))
    candidates = [
        os.path.join(home, ".local", "bin", "claude.exe"),
        os.path.join(home, ".local", "bin", "claude"),
        os.path.join(home, ".claude", "local", "claude"),
        os.path.join(home, ".claude", "local", "claude.exe"),
        os.path.join(appdata, "npm", "claude.cmd"),
        os.path.join(appdata, "npm", "claude"),
        "/opt/homebrew/bin/claude", "/usr/local/bin/claude",
    ]
    return next((c for c in candidates if os.path.isfile(c)), None)


def ask_cli(cfg, history, prompt):
    exe = find_claude(cfg)
    if not exe:
        raise ChatError("Couldn't find the Claude Code CLI (`claude`). Install it, run `claude` once "
                        "to log in, then restart server.py. If it's installed somewhere unusual, "
                        'add "claude_path" to config.json.')
    transcript = ""
    if history:
        transcript = "Earlier in this conversation:\n" + "\n".join(
            f"User: {q}\nAssistant: {a}" for q, a in history) + "\n\n"
    cmd = [exe, "-p", "--system-prompt", SYSTEM_PROMPT, "--tools", "",
           "--no-session-persistence", "--strict-mcp-config", "--disable-slash-commands",
           "--output-format", "text"]
    if cfg.get("cli_model"):
        cmd += ["--model", cfg["cli_model"]]
    env = dict(os.environ)
    env.pop("ANTHROPIC_API_KEY", None)   # make sure it runs on the subscription login
    # Run from an empty temp dir so no project files or CLAUDE.md leak in.
    with tempfile.TemporaryDirectory() as tmp:
        try:
            r = subprocess.run(cmd, input=transcript + prompt, capture_output=True, text=True,
                               cwd=tmp, env=env, timeout=180)
        except subprocess.TimeoutExpired:
            raise ChatError("`claude -p` took too long to answer.")
    if r.returncode != 0:
        tail = (r.stderr or r.stdout).strip().splitlines()[-1:] or ["unknown error"]
        raise ChatError(f"`claude -p` failed: {tail[0][:300]}")
    return r.stdout.strip()


BACKENDS = {"anthropic": ask_api, "gemini": ask_gemini, "claude-cli": ask_cli}


def catalog_block(nodes, limit=600):
    lines = [f"- {n['label']}" + (f"  (folder: {n['group']})" if n["group"] != "root" else "")
             for n in nodes[:limit]]
    more = f"\n(and {len(nodes) - limit} more)" if len(nodes) > limit else ""
    return "<catalog>\nAll notes that exist right now:\n" + ("\n".join(lines) or "(no notes yet)") + more + "\n</catalog>"


def parse_reply(text):
    """Pull the JSON object out of a model reply; fall back to plain text."""
    t = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip())
    obj = None
    for candidate in (t, (re.search(r"\{.*\}", t, re.S) or [None])[0]):
        if not candidate:
            continue
        try:
            obj = json.loads(candidate)
            break
        except ValueError:
            continue
    if not isinstance(obj, dict) or not str(obj.get("answer") or "").strip():
        return {"answer": text.strip(), "speech": "", "lang": "", "intent": "", "sources": None, "actions": []}
    return {
        "answer": str(obj.get("answer")).strip(),
        "speech": str(obj.get("speech") or "").strip(),
        "lang": str(obj.get("lang") or "").strip()[:12],
        "intent": str(obj.get("intent") or "").strip().lower(),
        "sources": [str(x) for x in obj["sources"]] if isinstance(obj.get("sources"), list) else None,
        "actions": obj.get("actions") if isinstance(obj.get("actions"), list) else [],
    }


def answer(sid, question):
    cfg = load_config()
    index = INDEX.get()
    history = SESSIONS.history(sid)
    previous = history[-1][0] if history else ""
    ids = index.search(question, context=previous)
    prompt = (f"{catalog_block(index.nodes)}\n\n{notes_block(index.nodes, ids)}\n\n"
              f"User message: {question}")

    # Try the configured provider first; if it fails, fall back to Claude via
    # `claude -p` (set "fallback": "none" in config.json to turn this off).
    chain = [cfg["provider"]]
    if cfg["provider"] != "claude-cli" and str(cfg.get("fallback", "claude-cli")).lower() != "none":
        chain.append("claude-cli")
    errors = []
    for provider in chain:
        try:
            text = BACKENDS[provider](cfg, history, prompt)
        except ChatError as e:
            text, err = "", str(e)
        else:
            err = "empty answer"
        if text:
            return finish(sid, question, parse_reply(text), index, ids, provider, provider != chain[0])
        errors.append(f"{provider}: {err}")
        print(f"[chat] {provider} failed: {err}" + ("  -> trying Claude" if provider != chain[-1] else ""), flush=True)
    raise ChatError(" | ".join(errors))


def finish(sid, question, reply, index, retrieved, provider, fallback):
    """Resolve sources to node ids, apply any note changes, build the response."""
    by_label = {build.norm(n["label"]): i for i, n in enumerate(index.nodes)}
    intent = reply["intent"] if reply["intent"] in ("notes", "chat", "edit") else ("edit" if reply["actions"] else "notes")
    if intent == "chat":                        # small talk: nothing to point at in the galaxy
        used = []
    elif reply["sources"] is None:              # model ignored the format: use retrieval
        used = list(retrieved)
    else:
        used = []
        for title in reply["sources"]:
            i = by_label.get(build.norm(title.removesuffix(".md")))
            if i is not None and i not in used:
                used.append(i)
    result = {"answer": reply["answer"], "speech": reply["speech"], "lang": reply["lang"],
              "intent": intent,
              "nodes": used, "backend": provider, "fallback": fallback}

    if reply["actions"]:
        changes, touched = STORE.apply(reply["actions"])
        result["changes"] = changes
        if any(c["ok"] for c in changes):
            # ids are array positions, so re-map everything onto the rebuilt graph
            graph = build.build(NOTES_DIR)
            by_path = {n["path"]: n["id"] for n in graph["nodes"]}
            old_paths = [index.nodes[i]["path"] for i in used]
            result["nodes"] = [by_path[p] for p in old_paths if p in by_path]
            changed = [by_path[STORE.rel(p)] for p in touched if STORE.rel(p) in by_path]
            result["changed"] = list(dict.fromkeys(changed))
            result["graph"] = graph
            result["can_undo"] = STORE.can_undo()
        failed = [c for c in changes if not c["ok"]]
        if failed:
            result["answer"] += " (Not done: " + "; ".join(
                f'{c["op"]} {c["title"]}: {c["error"]}'.replace("  ", " ") for c in failed) + ".)"
    SESSIONS.add(sid, question, result["answer"])
    return result


# ---------------------------------------------------------------- HTTP

class ViewerHandler(SimpleHTTPRequestHandler):
    """Static files are served from viewer/ only. SimpleHTTPRequestHandler
    resolves paths inside `directory`, so ../ cannot escape it; dotfiles and
    directory listings are refused as well."""

    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if any(part.startswith(".") for part in path.split("/") if part):
            self.send_error(404)
            return None
        fs_path = self.translate_path(self.path)
        if os.path.isdir(fs_path) and not os.path.exists(os.path.join(fs_path, "index.html")):
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # -- JSON API
    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path not in ("/chat", "/chat/reset", "/chat/undo"):
            return self.send_json(404, {"error": "Not found"})
        # Only same-origin JSON requests: a cross-site page can't send
        # application/json without a CORS preflight, which we never approve.
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            return self.send_json(415, {"error": "Send JSON"})
        length = int(self.headers.get("Content-Length") or 0)
        if length > 16_000:
            return self.send_json(413, {"error": "Request too large"})
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return self.send_json(400, {"error": "Invalid JSON"})

        sid, new_cookie = self.session_id()
        if path == "/chat/reset":
            SESSIONS.reset(sid)
            return self.send_json(200, {"ok": True}, new_cookie)
        if path == "/chat/undo":
            message = STORE.undo()
            if not message:
                return self.send_json(200, {"ok": False, "message": "Nothing to undo."}, new_cookie)
            SESSIONS.reset(sid)     # the conversation referred to the undone state
            return self.send_json(200, {"ok": True, "message": message, "graph": build.build(NOTES_DIR),
                                        "can_undo": STORE.can_undo()}, new_cookie)

        question = str(payload.get("question") or "").strip()[:1000]
        if not question:
            return self.send_json(400, {"error": "Ask a question"}, new_cookie)
        try:
            result = answer(sid, question)
        except ChatError as e:
            return self.send_json(502, {"error": str(e)}, new_cookie)
        except Exception as e:  # never leak config contents, just the error type
            self.log_error("chat failed: %r", e)
            return self.send_json(500, {"error": f"Server error ({type(e).__name__})"}, new_cookie)
        self.send_json(200, result, new_cookie)

    def session_id(self):
        m = re.search(COOKIE + r"=([A-Za-z0-9_-]{16,64})", self.headers.get("Cookie") or "")
        if m:
            return m.group(1), None
        sid = secrets.token_urlsafe(24)
        return sid, sid

    def send_json(self, status, obj, new_cookie=None):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if new_cookie:
            self.send_header("Set-Cookie", f"{COOKIE}={new_cookie}; Path=/; HttpOnly; SameSite=Strict")
        self.end_headers()
        self.wfile.write(body)


def main():
    ap = argparse.ArgumentParser(description="Serve the Knowledge Galaxy viewer and /chat.")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=4700)
    args = ap.parse_args()
    cfg = load_config()
    INDEX.get()
    handler = functools.partial(ViewerHandler, directory=VIEWER_DIR)
    ThreadingHTTPServer.allow_reuse_address = True
    with ThreadingHTTPServer((args.host, args.port), handler) as httpd:
        mode = {"anthropic": f"Anthropic API ({cfg.get('model')})",
                "gemini": "Gemini API",
                "claude-cli": "claude -p (subscription)"}[cfg["provider"]]
        print(f"Serving {VIEWER_DIR} at http://localhost:{args.port}/  ·  /chat via {mode}  (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
