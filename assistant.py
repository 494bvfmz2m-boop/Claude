"""Jarvis's assistant features: tasks, reminders, briefing, weekly review, status,
topic-cluster names, search by meaning, and turning links/files into notes.

server.py calls init(server_module) at startup; everything here uses the server's
note store, index, settings and AI backend through that reference.
"""
import base64
import datetime as dt
import hashlib
import html as _html
import io
import ipaddress
import json
import math
import re
import secrets
import socket
import threading
import time
import urllib.parse
import urllib.request
import zipfile

import build
import connectors as C
import integrations as I

S = None                       # the server module, set by init()
STARTED = time.time()
TASKS_TITLE = "Tasks"
REVIEW_FOLDER = "reviews"
_alerts = []                   # fired reminders/notices for browsers: {id, t, kind, text}
_alerts_lock = threading.Lock()


def init(server_module):
    global S
    S = server_module
    threading.Thread(target=_scheduler, daemon=True, name="jarvis-scheduler").start()


def prefs():
    p = I.SETTINGS.load().get("prefs") or {}
    return {"personality": p.get("personality", "butler"), "language": p.get("language", "auto"),
            "briefing_auto": p.get("briefing_auto", True), "review_enabled": p.get("review_enabled", True),
            "review_day": int(p.get("review_day", 6)), "review_hour": int(p.get("review_hour", 18)),
            "reminder_app": p.get("reminder_app", "auto"), "smart_search": p.get("smart_search", True),
            "home_instant": p.get("home_instant", False), "model": p.get("model", "lite")}


def save_prefs(new):
    data = I.SETTINGS.load()
    cur = prefs()
    for k, v in (new or {}).items():
        if k in cur:
            cur[k] = type(cur[k])(v) if not isinstance(cur[k], bool) else bool(v)
    data["prefs"] = cur
    I.SETTINGS.save(data)
    return cur


def now():
    return dt.datetime.now(I.user_tz())


def push_alert(kind, text):
    with _alerts_lock:
        _alerts.append({"id": secrets.token_hex(6), "t": time.time(), "kind": kind, "text": text})
        del _alerts[:-50]


def alerts_since(t):
    with _alerts_lock:
        return [a for a in _alerts if a["t"] > t and time.time() - a["t"] < 3600]


# ------------------------------------------------------------------ tasks (notes/Tasks.md)
TASK_LINE = re.compile(r"^- \[( |x|X)\] (.+?)\s*$")


def _tasks_note():
    path = S.STORE.find(TASKS_TITLE)
    if not path:
        return None, ""
    with open(path, encoding="utf-8") as f:
        return path, f.read()


def list_tasks(include_done=False):
    _, text = _tasks_note()
    out = []
    for line in text.splitlines():
        m = TASK_LINE.match(line)
        if m and (include_done or m.group(1) == " "):
            out.append({"done": m.group(1) != " ", "text": re.sub(r"\s*_\((added|done)[^)]*\)_", "", m.group(2)).strip()})
    return out


def _write_tasks(text):
    if S.STORE.find(TASKS_TITLE):
        return S.STORE.apply([{"op": "update", "title": TASKS_TITLE, "content": text}])
    return S.STORE.apply([{"op": "create", "title": TASKS_TITLE, "content": text}])


def add_task(text, due=""):
    text = re.sub(r"\s+", " ", str(text or "")).strip()[:300]
    if not text:
        raise I.IntegrationError("What's the task?")
    _, cur = _tasks_note()
    if not cur:
        cur = "# Tasks\n\nJarvis keeps this list. Tick things off by telling him they're done.\n"
    stamp = now().strftime("%Y-%m-%d")
    due_txt = f" (due {due})" if due else ""
    return _write_tasks(cur.rstrip() + f"\n- [ ] {text}{due_txt} _(added {stamp})_\n")


def _score(a, b):
    ta, tb = set(S.tokens(a)), set(S.tokens(b))
    return len(ta & tb) / max(1, len(ta)) if ta else 0


def complete_task(text):
    path, cur = _tasks_note()
    if not cur:
        raise I.IntegrationError("There's no task list yet.")
    lines = cur.splitlines()
    best, best_i = 0, None
    for i, line in enumerate(lines):
        m = TASK_LINE.match(line)
        if m and m.group(1) == " ":
            sc = _score(text, m.group(2)) + (1 if str(text).lower() in m.group(2).lower() else 0)
            if sc > best:
                best, best_i = sc, i
    if best_i is None or best < 0.34:
        raise I.IntegrationError(f"I couldn't find an open task like “{text}”.")
    lines[best_i] = lines[best_i].replace("- [ ]", "- [x]", 1) + f" _(done {now():%Y-%m-%d})_"
    _write_tasks("\n".join(lines) + "\n")
    return re.sub(r"\s*_\((added|done)[^)]*\)_", "", TASK_LINE.match(lines[best_i]).group(2)).strip()


def tasks_block():
    open_tasks = list_tasks()
    if not open_tasks:
        return "Open tasks: none (the list lives in the note “Tasks”)."
    return "Open tasks (note “Tasks”):\n" + "\n".join(f"- {t['text']}" for t in open_tasks[:30])


# ------------------------------------------------------------------ reminders
def _reminders():
    return I.SETTINGS.load().get("reminders") or []


def _save_reminders(items):
    data = I.SETTINGS.load()
    data["reminders"] = items[-200:]
    I.SETTINGS.save(data)


def add_reminder(text, at="", in_minutes=None):
    text = str(text or "").strip()[:300]
    if not text:
        raise I.IntegrationError("Remind you of what?")
    if in_minutes not in (None, ""):
        when = now() + dt.timedelta(minutes=float(in_minutes))
    else:
        try:
            when = dt.datetime.fromisoformat(str(at).replace("Z", "+00:00"))
        except ValueError:
            raise I.IntegrationError(f"Couldn't understand the time {at!r}.")
        if not when.tzinfo:
            when = when.replace(tzinfo=I.user_tz())
    if when < now() - dt.timedelta(minutes=1):
        raise I.IntegrationError("That time has already passed.")
    items = _reminders()
    items.append({"id": secrets.token_hex(5), "text": text, "at": when.isoformat(), "fired": None})
    _save_reminders(items)
    return when


def cancel_reminder(text):
    items = _reminders()
    pending = [r for r in items if not r.get("fired")]
    if not pending:
        raise I.IntegrationError("There are no reminders to cancel.")
    best = max(pending, key=lambda r: _score(text, r["text"]) + (1 if str(text).lower() in r["text"].lower() else 0))
    items = [r for r in items if r is not best]
    _save_reminders(items)
    return best["text"]


def reminders_block():
    pending = sorted((r for r in _reminders() if not r.get("fired")), key=lambda r: r["at"])
    if not pending:
        return "Pending reminders: none."
    fmt = lambda r: dt.datetime.fromisoformat(r["at"]).astimezone(I.user_tz()).strftime("%a %d %b %H:%M")
    return "Pending reminders:\n" + "\n".join(f"- {fmt(r)}: {r['text']}" for r in pending[:20])


NOTIFY_ORDER = ("telegram", "pushover", "ntfy", "gotify", "pushbullet", "signal", "whatsapp", "discord", "slack",
                "teams", "google_chat", "matrix", "mattermost", "rocketchat", "twilio", "ifttt")


def notify(text):
    """Send a notice to the user's phone through their chosen (or first connected) message app."""
    choice = prefs()["reminder_app"]
    if choice == "none":
        return None
    on = set(I.connected_apps())
    app = choice if choice in on else next((a for a in NOTIFY_ORDER if a in on), None)
    if not app:
        return None
    try:
        if app in I.CHAT_APPS:
            I.send_chat(app, text)
        else:
            C.run(app, "message", {"text": text})
        return app
    except I.IntegrationError as e:
        print(f"[jarvis] notify via {app} failed: {e}", flush=True)
        return None


# ------------------------------------------------------------------ scheduler
def _scheduler():
    time.sleep(5)
    while True:
        try:
            _tick()
        except Exception as e:  # keep the thread alive no matter what
            print(f"[jarvis] scheduler: {e!r}", flush=True)
        time.sleep(15)


def _tick():
    items = _reminders()
    changed = False
    for r in items:
        if not r.get("fired") and dt.datetime.fromisoformat(r["at"]) <= now():
            r["fired"] = now().isoformat()
            changed = True
            push_alert("reminder", r["text"])
            notify(f"⏰ Reminder: {r['text']}")
    if changed:
        _save_reminders([r for r in items if not r.get("fired") or
                         now() - dt.datetime.fromisoformat(r["fired"]) < dt.timedelta(days=2)])
    p = prefs()
    n = now()
    week = n.strftime("%G-W%V")
    data = I.SETTINGS.load()
    if (p["review_enabled"] and n.weekday() == p["review_day"] and n.hour >= p["review_hour"]
            and data.get("last_review") != week and S.load_config()["provider"]):
        data["last_review"] = week
        I.SETTINGS.save(data)
        try:
            title = weekly_review()
            push_alert("review", f"Your weekly review is ready: “{title}”.")
            notify(f"🗒 Your weekly review is ready: {title}")
        except Exception as e:
            print(f"[jarvis] weekly review failed: {e!r}", flush=True)


# ------------------------------------------------------------------ status (no AI)
def status():
    index = S.INDEX.get()
    unread = {}
    try:
        unread = I.unread_total() if I.email_accounts() else {}
    except Exception:
        pass
    nxt = None
    try:
        events, _ = I.upcoming(1)
        nxt = events[0] if events else None
    except Exception:
        pass
    pending = [r for r in _reminders() if not r.get("fired")]
    up = int(time.time() - STARTED)
    return {"notes": len(index.nodes), "folders": len({n["group"] for n in index.nodes}),
            "unread": unread, "next_event": nxt, "open_tasks": len(list_tasks()), "reminders": len(pending),
            "apps": len(I.connected_apps()), "uptime_h": round(up / 3600, 1),
            "backend": S.load_config()["provider"], "storage": "database" if S.DB else "files",
            "usage": usage_today()}


# ------------------------------------------------------------------ usage meter
def record_usage(kind, prompt_tokens=0, output_tokens=0):
    data = I.SETTINGS.load()
    day = now().strftime("%Y-%m-%d")
    u = data.get("usage") or {}
    if u.get("day") != day:
        u = {"day": day, "requests": 0, "input": 0, "output": 0, "by": {}}
    u["requests"] += 1
    u["input"] += int(prompt_tokens or 0)
    u["output"] += int(output_tokens or 0)
    u["by"][kind] = u["by"].get(kind, 0) + 1
    data["usage"] = u
    I.SETTINGS.save(data)


def usage_today():
    u = I.SETTINGS.load().get("usage") or {}
    if u.get("day") != now().strftime("%Y-%m-%d"):
        return {"day": now().strftime("%Y-%m-%d"), "requests": 0, "input": 0, "output": 0, "by": {}}
    return u


# ------------------------------------------------------------------ briefing & review (AI)
def _recent_notes(days):
    cutoff = time.time() - days * 86400
    return [n for n in S.INDEX.get().nodes if n.get("t", 0) >= cutoff and not n["path"].startswith(REVIEW_FOLDER + "/")]


def gather(days_events=1, include_news=True):
    parts = [f"Now: {now():%A %d %B %Y, %H:%M}."]
    w = C.weather_block()
    if w:
        parts.append(w)
    try:
        if I.SETTINGS.load()["calendars"]:
            start = now().replace(hour=0, minute=0, second=0, microsecond=0)
            events, _ = I.events_between(start, start + dt.timedelta(days=days_events))
            parts.append("Calendar:\n" + ("\n".join(I.describe_event(e, now()) for e in events) or "(nothing)"))
    except Exception:
        pass
    parts.append(tasks_block())
    parts.append(reminders_block())
    if I.email_accounts():
        mails = []
        for key, name, _ in I.email_accounts():
            try:
                mails += [f"- [{name}] {m['from_name'] or m['from']}: {m['subject']}" for m in I.fetch_inbox(8, 2, account=key) if m["unread"]]
            except I.IntegrationError:
                pass
        parts.append("Unread email:\n" + ("\n".join(mails[:10]) or "(none)"))
    new = _recent_notes(1)
    if new:
        parts.append("Notes added or changed since yesterday: " + ", ".join(n["label"] for n in new[:12]))
    if include_news:
        nb = C.news_block()
        if nb:
            parts.append(nb)
    return "\n\n".join(parts)


def briefing():
    facts = gather()
    p = prefs()
    lang = "Dutch (address the user as 'meneer')" if p["language"] == "nl" else "English"
    system = (S.persona_text() + "\nWrite a spoken morning briefing in " + lang + ". Reply with JSON {\"text\": \"...\", "
              "\"speech\": \"...\"}: text = 4-7 short lines (weather, appointments with times, anything urgent in mail, "
              "tasks/reminders due, one headline if notable), plain text with line breaks, no markdown; speech = the "
              "same in at most 45 words, natural to hear. Only use the facts given; skip sections that are empty. "
              "Open with one dry, witty line.")
    raw = S.llm_text(system, facts, kind="briefing", json_mode=True)
    try:
        obj = json.loads(re.sub(r"^```(?:json)?|```$", "", raw.strip()))
        return {"text": str(obj.get("text") or raw), "speech": str(obj.get("speech") or "")}
    except ValueError:
        return {"text": raw, "speech": ""}


def weekly_review():
    n = now()
    week = n.strftime("%G-W%V")
    title = f"Weekly review {week}"
    changed = _recent_notes(7)
    done = [t["text"] for t in list_tasks(include_done=True) if t["done"]][-20:]
    start = n.replace(hour=0, minute=0, second=0, microsecond=0)
    try:
        events, _ = I.events_between(start, start + dt.timedelta(days=8))
        upcoming = "\n".join(I.describe_event(e, n) for e in events[:30]) or "(nothing)"
    except Exception:
        upcoming = "(no calendar)"
    facts = "\n\n".join([
        f"Week {week}, written {n:%A %d %B %Y}.",
        "Notes added or changed this week:\n" + ("\n".join(f"- {x['label']} ({x['group']}): {x['excerpt'][:200]}" for x in changed[:25]) or "(none)"),
        tasks_block(), "Recently completed tasks:\n" + ("\n".join(f"- {d}" for d in done) or "(none)"),
        "Coming week:\n" + upcoming, reminders_block(),
    ])
    system = ("You write the user's weekly review as a markdown note. Sections: ## This week (what happened, based on the "
              "notes), ## Done, ## Still open (tasks and loose ends), ## Coming up (next week's calendar), ## Suggestions "
              "(2-4 concrete next steps). Link existing notes as [[Exact Title]]. Start with one dry, witty sentence in "
              "italics, then keep it practical. Only use the facts given.")
    body = S.llm_text(system, facts, kind="review")
    body = re.sub(r"^```(?:markdown)?|```$", "", body.strip()).strip()
    content = f"# {title}\n\n{body}\n"
    if S.STORE.find(title):
        S.STORE.apply([{"op": "update", "title": title, "content": content}])
    else:
        S.STORE.apply([{"op": "create", "title": title, "folder": REVIEW_FOLDER, "content": content}])
    S.sync_db()
    return title


# ------------------------------------------------------------------ topic clusters
def name_clusters(groups):
    """groups: [[title, ...], ...] -> names (cached by membership)."""
    data = I.SETTINGS.load()
    cache = data.get("cluster_names") or {}
    keys = [hashlib.sha1("|".join(sorted(g)).encode()).hexdigest()[:16] for g in groups]
    missing = [i for i, k in enumerate(keys) if k not in cache]
    if missing:
        listing = "\n".join(f"{i}: " + "; ".join(groups[i][:14]) for i in missing)
        names = {}
        try:
            raw = S.llm_text("Name each group of note titles with a 1-3 word topic label (Title Case, no quotes). Reply with "
                             "JSON {\"0\": \"Label\", ...} using the given numbers.", listing, kind="clusters", json_mode=True)
            names = json.loads(re.sub(r"^```(?:json)?|```$", "", raw.strip()))
        except Exception:
            pass
        for i in missing:
            label = str(names.get(str(i)) or "").strip()[:40] or _heuristic_name(groups[i])
            cache[keys[i]] = label
        data["cluster_names"] = dict(list(cache.items())[-300:])
        I.SETTINGS.save(data)
    return [cache[k] for k in keys]


def _heuristic_name(titles):
    counts = {}
    for t in titles:
        for w in S.tokens(t):
            if len(w) > 3:
                counts[w] = counts.get(w, 0) + 1
    best = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:2]
    return " & ".join(w.capitalize() for w, _ in best) or "Misc"


# ------------------------------------------------------------------ search by meaning (Gemini embeddings)
EMBED_MODEL = "gemini-embedding-001"
EMBED_DIMS = 256
_emb_lock = threading.Lock()


def _embed(texts, task):
    cfg = S.load_config()
    if cfg["provider"] != "gemini":
        raise I.IntegrationError("Search by meaning needs a Gemini key.")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:batchEmbedContents"
    out = []
    for i in range(0, len(texts), 90):
        body = {"requests": [{"model": f"models/{EMBED_MODEL}", "content": {"parts": [{"text": t[:6000]}]},
                              "taskType": task, "outputDimensionality": EMBED_DIMS} for t in texts[i:i + 90]]}
        _, raw = I.http("POST", url, body, headers={"x-goog-api-key": cfg["api_key"]}, timeout=30)
        for e in json.loads(raw).get("embeddings", []):
            v = e.get("values") or []
            norm = math.sqrt(sum(x * x for x in v)) or 1
            out.append([round(x / norm, 5) for x in v])
    record_usage("embedding", sum(len(t) // 4 for t in texts), 0)
    return out


def _note_vectors(index):
    """Embeddings per note path, recomputed only for notes whose text changed."""
    with _emb_lock:
        data = I.SETTINGS.load()
        cache = data.get("embeddings") or {}
        want = {n["path"]: hashlib.sha1((n["label"] + n["text"]).encode()).hexdigest()[:12] for n in index.nodes}
        todo = [n for n in index.nodes if (cache.get(n["path"]) or {}).get("h") != want[n["path"]]]
        if todo:
            vecs = _embed([f"{n['label']}\n{n['text']}" for n in todo], "RETRIEVAL_DOCUMENT")
            for n, v in zip(todo, vecs):
                cache[n["path"]] = {"h": want[n["path"]], "v": v}
        cache = {p: cache[p] for p in want if p in cache}
        if todo or len(cache) != len(data.get("embeddings") or {}):
            data["embeddings"] = cache
            I.SETTINGS.save(data)
        return {p: c["v"] for p, c in cache.items()}


def semantic_scores(question, index):
    """{node id: cosine similarity} or {} if unavailable."""
    if not prefs()["smart_search"] or S.load_config()["provider"] != "gemini":
        return {}
    try:
        vecs = _note_vectors(index)
        q = _embed([question], "RETRIEVAL_QUERY")[0]
    except Exception as e:
        print(f"[jarvis] smart search unavailable: {e}", flush=True)
        return {}
    return {i: sum(a * b for a, b in zip(q, vecs[n["path"]])) for i, n in enumerate(index.nodes) if n["path"] in vecs}


def hybrid_search(question, context, index, k):
    keyword = index.search(question, context=context, k=max(k * 2, 10))
    sem = semantic_scores(question if not context else f"{context}\n{question}", index)
    if not sem:
        return keyword[:k]
    kw_rank = {i: 1 - r / max(1, len(keyword)) for r, i in enumerate(keyword)}
    combined = {i: 0.45 * kw_rank.get(i, 0) + 0.55 * max(0.0, (s - 0.45) / 0.4) for i, s in sem.items()}
    ranked = sorted(combined, key=lambda i: -combined[i])
    return [i for i in ranked if combined[i] > 0.12][:k]


# ------------------------------------------------------------------ links & files -> notes
MAX_FETCH = 3_000_000


def _public_url(url):
    p = urllib.parse.urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise I.IntegrationError("Only http(s) links, please.")
    for info in socket.getaddrinfo(p.hostname, p.port or 443):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise I.IntegrationError("That link points inside your own network; I only fetch public pages.")
    return url


def fetch_url(url):
    _public_url(url)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Jarvis note-taker)"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            final = r.geturl()
            _public_url(final)
            ctype = r.headers.get("Content-Type", "")
            raw = r.read(MAX_FETCH + 1)[:MAX_FETCH]
    except urllib.error.HTTPError as e:
        raise I.IntegrationError(f"The page answered {e.code}.")
    except OSError as e:
        raise I.IntegrationError(f"Couldn't open the link: {getattr(e, 'reason', e)}")
    return final, ctype.split(";")[0].strip().lower(), raw


def html_to_text(raw):
    text = raw.decode("utf-8", "replace")
    title = _html.unescape((re.search(r"(?is)<title[^>]*>(.*?)</title>", text) or [None, ""])[1]).strip()
    text = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header|form)[^>]*>.*?</\1>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</h\d>|</li>|</div>", "\n", text)
    text = _html.unescape(re.sub(r"<[^>]+>", " ", text))
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    return title, text


def docx_to_text(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        xml = z.read("word/document.xml").decode("utf-8", "replace")
    xml = re.sub(r"</w:p>", "\n", xml)
    return _html.unescape(re.sub(r"<[^>]+>", "", xml)).strip()


def ingest(url=None, name=None, mime=None, data_b64=None, note=""):
    """Summarise a link or a file into a note in captures/. Returns (title, path)."""
    source = ""
    parts = None                 # for Gemini: inline file parts
    text = ""
    if url:
        final, ctype, raw = fetch_url(url)
        source = final
        if ctype == "application/pdf" or final.lower().endswith(".pdf"):
            parts = [{"inline_data": {"mime_type": "application/pdf", "data": base64.b64encode(raw).decode()}}]
            name = urllib.parse.unquote(final.rsplit("/", 1)[-1]) or "document.pdf"
        elif "html" in ctype or not ctype:
            name, text = html_to_text(raw)
            name = name or urllib.parse.urlparse(final).hostname
        else:
            text = raw.decode("utf-8", "replace")
            name = urllib.parse.unquote(final.rsplit("/", 1)[-1])
    else:
        raw = base64.b64decode(data_b64 or "")
        source = f"file: {name}"
        low = (name or "").lower()
        mime = (mime or "").lower()
        if low.endswith((".md", ".txt", ".csv", ".json", ".log", ".html", ".htm")) or mime.startswith("text/"):
            text = raw.decode("utf-8", "replace")
            if low.endswith((".html", ".htm")):
                _, text = html_to_text(raw)
            if low.endswith(".md") and not note:
                return _store_capture(re.sub(r"\.md$", "", name, flags=re.I), text, source, raw_markdown=True)
        elif low.endswith(".docx"):
            text = docx_to_text(raw)
        elif mime == "application/pdf" or low.endswith(".pdf") or mime.startswith("image/"):
            parts = [{"inline_data": {"mime_type": mime or "application/pdf", "data": data_b64}}]
        else:
            raise I.IntegrationError("I can read text, Markdown, Word (.docx), PDF and image files.")
    if parts is None and not text.strip():
        raise I.IntegrationError("There was no readable text in it.")
    system = ("Turn the material into a useful markdown note for the user's knowledge base. Reply with JSON "
              "{\"title\": \"short descriptive title (max 8 words)\", \"content\": \"markdown\"}. Content: a 2-3 sentence "
              "summary, then '## Key points' (3-8 bullets with concrete facts, numbers, names, dates), then "
              "'## Why it matters' only if obvious from the user's request. No preamble. Same language as the material.")
    prompt = (f"User's request: {note}\n\n" if note else "") + f"Source: {source}\nTitle hint: {name or ''}\n\n" + text[:40000]
    try:
        raw_reply = S.llm_text(system, prompt, kind="ingest", json_mode=True, parts=parts)
        obj = json.loads(re.sub(r"^```(?:json)?|```$", "", raw_reply.strip()))
        title, content = str(obj.get("title") or name or "Captured page").strip(), str(obj.get("content") or "").strip()
    except Exception as e:
        if parts is not None:
            raise I.IntegrationError(f"Couldn't read the file: {e}")
        title, content = (name or "Captured page").strip(), text[:3000]
    return _store_capture(title, content, source)


def _store_capture(title, content, source, raw_markdown=False):
    title = S.make_title(title) if len(title.split()) > 9 else title
    base, n = title, 2
    while S.STORE.find(title):
        title = f"{base} ({n})"
        n += 1
    index = S.INDEX.get()
    rel = index.search(f"{title} {content[:400]}", k=1)
    related = index.nodes[rel[0]]["label"] if rel else None
    src = f"[{source}]({source})" if source.startswith("http") else source
    body = content if raw_markdown else (f"# {title}\n\n{content}\n\n_Source: {src} · captured {now():%Y-%m-%d %H:%M}._\n"
                                          + (f"\nRelated: [[{related}]]\n" if related else ""))
    changes, _ = S.STORE.apply([{"op": "create", "title": title, "folder": S.CAPTURE_FOLDER, "content": body}])
    if not changes or not changes[0]["ok"]:
        raise I.IntegrationError("Couldn't save the note: " + (changes[0].get("error", "") if changes else ""))
    S.sync_db()
    return title, changes[0]["path"], related
