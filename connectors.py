"""More app connections for Jarvis (standard library only).

Each connector declares a category, help text, the fields the user fills in, and
capabilities ("caps"):
    message  - send a text (chat apps, notifications, SMS, WhatsApp…)        args: text, to
    task     - create a task / issue / card                                  args: title, notes, due
    document - create a document / page / record                             args: title, content
    event    - create a calendar event                                       args: title, start, end, location, notes
    home     - control a smart-home device                                   args: action, entity_id, data
    info     - read-only context for Jarvis (weather, news, smart-home state)
Everything outbound is drafted for the user's approval by server.py first.
"""
import base64
import datetime as dt
import json
import re
import time
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET

import integrations as I


def _f(key, label, secret=False, required=False, placeholder=""):
    return {"key": key, "label": label, "secret": secret, "required": required, "placeholder": placeholder}


APPS = {
    # ---------------------------------------------------------------- chat & messaging
    "teams": {"label": "Microsoft Teams", "icon": "T", "category": "Chat & messaging", "caps": ["message"],
              "help": "In the channel: ••• → Workflows → “Post to a channel when a webhook request is received” → copy the URL.",
              "fields": [_f("webhook", "Workflow / webhook URL", True, True)]},
    "google_chat": {"label": "Google Chat", "icon": "G", "category": "Chat & messaging", "caps": ["message"],
                    "help": "In a space: name ▾ → Apps & integrations → Webhooks → Add webhook → copy the URL.",
                    "fields": [_f("webhook", "Webhook URL", True, True)]},
    "mattermost": {"label": "Mattermost", "icon": "M", "category": "Chat & messaging", "caps": ["message"],
                   "help": "Integrations → Incoming Webhooks → Add → copy the URL.",
                   "fields": [_f("webhook", "Webhook URL", True, True)]},
    "rocketchat": {"label": "Rocket.Chat", "icon": "R", "category": "Chat & messaging", "caps": ["message"],
                   "help": "Administration → Integrations → New → Incoming → copy the webhook URL.",
                   "fields": [_f("webhook", "Webhook URL", True, True)]},
    "matrix": {"label": "Matrix / Element", "icon": "[m]", "category": "Chat & messaging", "caps": ["message"],
               "help": "Element: Settings → Help & About → Access token (better: a separate bot account). Room id: room settings → Advanced.",
               "fields": [_f("homeserver", "Homeserver URL", required=True, placeholder="https://matrix.org"),
                          _f("token", "Access token", True, True), _f("room", "Room id", required=True, placeholder="!abc123:matrix.org")]},
    "whatsapp": {"label": "WhatsApp (Cloud API)", "icon": "W", "category": "Chat & messaging", "caps": ["message"],
                 "help": "Meta for Developers → create an app → WhatsApp → API setup: copy the access token and phone number id. "
                         "WhatsApp only allows free-form messages to people who messaged that number in the last 24 h; "
                         "for anything else use the Webhook connector with n8n/Make.",
                 "fields": [_f("token", "Access token", True, True), _f("phone_id", "Phone number id", required=True),
                            _f("default_to", "Default recipient (e.g. your own number, 31612345678)")]},
    "twilio": {"label": "SMS (Twilio)", "icon": "✆", "category": "Chat & messaging", "caps": ["message"],
               "help": "console.twilio.com: Account SID, Auth token and a Twilio phone number.",
               "fields": [_f("sid", "Account SID", required=True), _f("token", "Auth token", True, True),
                          _f("from", "From number", required=True, placeholder="+15551234567"),
                          _f("default_to", "Default recipient", placeholder="+316…")]},
    "signal": {"label": "Signal (signal-cli REST)", "icon": "S", "category": "Chat & messaging", "caps": ["message"],
               "help": "Run bbernhard/signal-cli-rest-api (it fits on Coolify), link your number, then paste its URL.",
               "fields": [_f("url", "signal-cli REST URL", required=True, placeholder="http://signal-api:8080"),
                          _f("number", "Your Signal number", required=True, placeholder="+316…"),
                          _f("default_to", "Default recipient", placeholder="+316… (yourself)")]},
    # ---------------------------------------------------------------- notifications
    "pushover": {"label": "Pushover", "icon": "P", "category": "Notifications", "caps": ["message"],
                 "help": "pushover.net: your user key, and an application token (Create an Application).",
                 "fields": [_f("token", "Application token", True, True), _f("user", "User key", True, True)]},
    "ntfy": {"label": "ntfy", "icon": "🔔", "category": "Notifications", "caps": ["message"],
             "help": "Install the ntfy app and subscribe to a hard-to-guess topic name. Self-hosted? Change the server.",
             "fields": [_f("topic", "Topic", required=True, placeholder="jarvis-7f3k2"),
                        _f("server", "Server", placeholder="https://ntfy.sh"), _f("token", "Access token (optional)", True)]},
    "gotify": {"label": "Gotify", "icon": "g", "category": "Notifications", "caps": ["message"],
               "help": "Gotify web UI → Apps → Create application → copy its token.",
               "fields": [_f("url", "Gotify URL", required=True), _f("token", "App token", True, True)]},
    "pushbullet": {"label": "Pushbullet", "icon": "b", "category": "Notifications", "caps": ["message"],
                   "help": "pushbullet.com → Settings → Account → Create Access Token.",
                   "fields": [_f("token", "Access token", True, True)]},
    "ifttt": {"label": "IFTTT", "icon": "if", "category": "Automation", "caps": ["message"],
              "help": "ifttt.com/maker_webhooks → Documentation: copy your key. Applets receive value1 = the message.",
              "fields": [_f("key", "Webhooks key", True, True), _f("event", "Event name", placeholder="jarvis")]},
    # ---------------------------------------------------------------- tasks & projects
    "todoist": {"label": "Todoist", "icon": "✓", "category": "Tasks & projects", "caps": ["task"],
                "help": "Todoist → Settings → Integrations → Developer → copy the API token.",
                "fields": [_f("token", "API token", True, True)]},
    "trello": {"label": "Trello", "icon": "▦", "category": "Tasks & projects", "caps": ["task"],
               "help": "trello.com/power-ups/admin → new Power-Up → API key, then generate a token. List id: open a card on "
                       "the list, add .json to its URL and look for idList.",
               "fields": [_f("key", "API key", required=True), _f("token", "Token", True, True), _f("list_id", "List id", required=True)]},
    "asana": {"label": "Asana", "icon": "a", "category": "Tasks & projects", "caps": ["task"],
              "help": "app.asana.com/0/my-apps → Personal access token. Workspace id: in the URL of your workspace's home.",
              "fields": [_f("token", "Personal access token", True, True), _f("workspace", "Workspace id", required=True),
                         _f("project", "Project id (optional)")]},
    "linear": {"label": "Linear", "icon": "L", "category": "Tasks & projects", "caps": ["task"],
               "help": "Linear → Settings → API → Personal API key. Team id: Settings → Teams → (team) → copy id.",
               "fields": [_f("token", "API key", True, True), _f("team", "Team id", required=True)]},
    "jira": {"label": "Jira", "icon": "J", "category": "Tasks & projects", "caps": ["task"],
             "help": "id.atlassian.com/manage-profile/security/api-tokens → Create API token.",
             "fields": [_f("site", "Site URL", required=True, placeholder="https://you.atlassian.net"),
                        _f("email", "Atlassian email", required=True), _f("token", "API token", True, True),
                        _f("project", "Project key", required=True, placeholder="OPS")]},
    "clickup": {"label": "ClickUp", "icon": "C", "category": "Tasks & projects", "caps": ["task"],
                "help": "ClickUp → Settings → Apps → API token. List id: the number in the list's URL.",
                "fields": [_f("token", "API token", True, True), _f("list_id", "List id", required=True)]},
    "github": {"label": "GitHub Issues", "icon": "⌥", "category": "Tasks & projects", "caps": ["task"],
               "help": "github.com/settings/personal-access-tokens → fine-grained token with Issues: read & write on the repo.",
               "fields": [_f("token", "Token", True, True), _f("repo", "Repository", required=True, placeholder="owner/name")]},
    "gitlab": {"label": "GitLab Issues", "icon": "⧩", "category": "Tasks & projects", "caps": ["task"],
               "help": "GitLab → Preferences → Access tokens (scope: api).",
               "fields": [_f("token", "Access token", True, True), _f("project", "Project path or id", required=True, placeholder="group/project"),
                          _f("url", "GitLab URL", placeholder="https://gitlab.com")]},
    # ---------------------------------------------------------------- documents
    "confluence": {"label": "Confluence", "icon": "≋", "category": "Documents", "caps": ["document"],
                   "help": "Same Atlassian API token as Jira. Space key: in the space's URL (/spaces/KEY/).",
                   "fields": [_f("site", "Site URL", required=True, placeholder="https://you.atlassian.net"),
                              _f("email", "Atlassian email", required=True), _f("token", "API token", True, True),
                              _f("space", "Space key", required=True)]},
    "airtable": {"label": "Airtable", "icon": "▤", "category": "Documents", "caps": ["document"],
                 "help": "airtable.com/create/tokens → token with data.records:write on the base. Base id starts with app….",
                 "fields": [_f("token", "Personal access token", True, True), _f("base", "Base id", required=True),
                            _f("table", "Table name", required=True), _f("title_field", "Title field", placeholder="Name"),
                            _f("notes_field", "Notes field", placeholder="Notes")]},
    # ---------------------------------------------------------------- calendars & suites (sign-in)
    "google": {"label": "Google (Calendar, Tasks, Docs)", "icon": "G", "category": "Calendars & suites", "oauth": True,
               "caps": ["event", "task", "document"],
               "help": "One-time setup (5 min): console.cloud.google.com → new project → enable Google Calendar API, Tasks API "
                       "and Google Docs API → OAuth consent screen (External, add yourself as test user) → Credentials → "
                       "Create OAuth client ID → Web application → add the redirect URI shown below. Paste the client id and "
                       "secret, Save, then press “Sign in”.",
               "fields": [_f("client_id", "OAuth client id", required=True), _f("client_secret", "OAuth client secret", True, True)]},
    "microsoft": {"label": "Microsoft 365 (Outlook Calendar, To Do)", "icon": "⊞", "category": "Calendars & suites", "oauth": True,
                  "caps": ["event", "task"],
                  "help": "One-time setup: entra.microsoft.com → App registrations → New → “Accounts in any organizational "
                          "directory and personal Microsoft accounts” → Web redirect URI shown below → Certificates & secrets → "
                          "New client secret. API permissions: Calendars.ReadWrite, Tasks.ReadWrite, offline_access. "
                          "Paste the ids, Save, then press “Sign in”.",
                  "fields": [_f("client_id", "Application (client) id", required=True),
                             _f("client_secret", "Client secret (value)", True, True), _f("tenant", "Tenant", placeholder="common")]},
    "caldav": {"label": "CalDAV (iCloud, Nextcloud, Fastmail…)", "icon": "📅", "category": "Calendars & suites", "caps": ["event"],
               "help": "The calendar's CalDAV address (Nextcloud: calendar ••• → Copy private link; Fastmail: Settings → "
                       "Calendars → CalDAV URL) and an app password.",
               "fields": [_f("url", "Calendar URL", required=True), _f("username", "Username", required=True),
                          _f("password", "App password", True, True)]},
    # ---------------------------------------------------------------- smart home
    "home_assistant": {"label": "Home Assistant", "icon": "⌂", "category": "Smart home", "caps": ["home", "info"],
                       "help": "Your profile → Security → Long-lived access tokens → Create. Jarvis can read device states and "
                               "propose actions (you approve them unless you allow instant actions in Settings → Assistant; "
                               "locks and alarms always ask).",
                       "fields": [_f("url", "Home Assistant URL", required=True, placeholder="https://home.example.com"),
                                  _f("token", "Long-lived access token", True, True)]},
    # ---------------------------------------------------------------- info (free, no keys)
    "weather": {"label": "Weather (Open-Meteo)", "icon": "☀", "category": "Info", "caps": ["info"],
                "help": "Free, no account needed. Type your town; Jarvis uses it for briefings and “do I need an umbrella?”.",
                "fields": [_f("city", "Town / city", required=True, placeholder="Amsterdam")]},
    "news": {"label": "News (RSS)", "icon": "📰", "category": "Info", "caps": ["info"],
             "help": "Any RSS/Atom feeds, one per line or comma-separated (e.g. https://feeds.bbci.co.uk/news/rss.xml, "
                     "https://feeds.nos.nl/nosnieuwsalgemeen).",
             "fields": [_f("feeds", "Feed URLs", required=True)]},
}

OAUTH = {
    "google": {"auth": "https://accounts.google.com/o/oauth2/v2/auth", "token": "https://oauth2.googleapis.com/token",
               "scope": "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks "
                        "https://www.googleapis.com/auth/documents",
               "extra": {"access_type": "offline", "prompt": "consent"}},
    "microsoft": {"auth": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
                  "token": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
                  "scope": "offline_access User.Read Calendars.ReadWrite Tasks.ReadWrite", "extra": {"prompt": "select_account"}},
}


# ------------------------------------------------------------------ helpers
def http_form(url, data, headers=None, auth=None, timeout=20):
    hdrs = {"User-Agent": I.UA, "Content-Type": "application/x-www-form-urlencoded"}
    if auth:
        hdrs["Authorization"] = "Basic " + base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
    hdrs.update(headers or {})
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode(), method="POST", headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        raise I.IntegrationError(f"{e.code}: {e.read()[:300].decode('utf-8', 'replace')}")
    except OSError as e:
        raise I.IntegrationError(f"couldn't reach {urllib.parse.urlparse(url).hostname}: {getattr(e, 'reason', e)}")


def basic(user, pw):
    return {"Authorization": "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()}


def js(raw):
    try:
        return json.loads(raw or b"{}")
    except ValueError:
        return {}


def parse_when(value, default_hours=1):
    """'2026-11-07T13:00' / '2026-11-07' -> (datetime|date, all_day) in the user's timezone."""
    value = str(value or "").strip()
    if not value:
        raise I.IntegrationError("The event needs a start time.")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return dt.date.fromisoformat(value), True
    try:
        d = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise I.IntegrationError(f"Couldn't understand the time {value!r} (use 2026-11-07T13:00).")
    return (d if d.tzinfo else d.replace(tzinfo=I.user_tz())), False


def event_times(args):
    start, all_day = parse_when(args.get("start"))
    if args.get("end"):
        end, _ = parse_when(args["end"])
    else:
        end = start + (dt.timedelta(days=1) if all_day else dt.timedelta(hours=1))
    return start, end, all_day


# ------------------------------------------------------------------ OAuth (Google / Microsoft)
def oauth_urls(app, cfg):
    o = OAUTH[app]
    tenant = (cfg.get("tenant") or "common").strip()
    return o["auth"].replace("{tenant}", tenant), o["token"].replace("{tenant}", tenant)


def oauth_start(app, redirect_uri, state):
    cfg = I.SETTINGS.load()["apps"].get(app) or {}
    if not cfg.get("client_id") or not cfg.get("client_secret"):
        raise I.IntegrationError("Save the client id and secret first.")
    auth, _ = oauth_urls(app, cfg)
    q = {"client_id": cfg["client_id"], "redirect_uri": redirect_uri, "response_type": "code",
         "scope": OAUTH[app]["scope"], "state": state, **OAUTH[app]["extra"]}
    return auth + "?" + urllib.parse.urlencode(q)


def oauth_finish(app, code, redirect_uri):
    data = I.SETTINGS.load()
    cfg = data["apps"].get(app) or {}
    _, token_url = oauth_urls(app, cfg)
    _, raw = http_form(token_url, {"client_id": cfg["client_id"], "client_secret": cfg["client_secret"], "code": code,
                                   "grant_type": "authorization_code", "redirect_uri": redirect_uri, "scope": OAUTH[app]["scope"]})
    tok = js(raw)
    if not tok.get("refresh_token"):
        raise I.IntegrationError("The sign-in didn't return a refresh token (for Google: remove the app's access at "
                                 "myaccount.google.com/permissions and sign in again).")
    cfg.update(access_token=tok["access_token"], refresh_token=tok["refresh_token"],
               expires_at=time.time() + int(tok.get("expires_in", 3600)) - 60)
    data["apps"][app] = cfg
    I.SETTINGS.save(data)


def oauth_token(app):
    data = I.SETTINGS.load()
    cfg = data["apps"].get(app) or {}
    if not cfg.get("refresh_token"):
        raise I.IntegrationError(f"{APPS[app]['label']}: press “Sign in” in Settings → Apps first.")
    if cfg.get("access_token") and time.time() < float(cfg.get("expires_at") or 0):
        return cfg["access_token"]
    _, token_url = oauth_urls(app, cfg)
    _, raw = http_form(token_url, {"client_id": cfg["client_id"], "client_secret": cfg["client_secret"],
                                   "refresh_token": cfg["refresh_token"], "grant_type": "refresh_token"})
    tok = js(raw)
    if not tok.get("access_token"):
        raise I.IntegrationError("The sign-in has expired: press “Sign in” again in Settings → Apps.")
    cfg.update(access_token=tok["access_token"], expires_at=time.time() + int(tok.get("expires_in", 3600)) - 60)
    if tok.get("refresh_token"):
        cfg["refresh_token"] = tok["refresh_token"]
    data["apps"][app] = cfg
    I.SETTINGS.save(data)
    return cfg["access_token"]


def bearer(app):
    return {"Authorization": f"Bearer {oauth_token(app)}"}


# ------------------------------------------------------------------ capability implementations
def _message(app, cfg, a):
    text, to = str(a.get("text") or "").strip(), str(a.get("to") or "").strip()
    if not text:
        raise I.IntegrationError("Nothing to send.")
    if app == "teams":
        I.http("POST", cfg["webhook"], {"type": "message", "attachments": [{
            "contentType": "application/vnd.microsoft.card.adaptive", "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json", "type": "AdaptiveCard", "version": "1.4",
                "body": [{"type": "TextBlock", "text": text, "wrap": True}]}}]})
    elif app in ("google_chat", "mattermost", "rocketchat"):
        I.http("POST", cfg["webhook"], {"text": text})
    elif app == "matrix":
        room = urllib.parse.quote(cfg["room"], safe="")
        I.http("PUT", f"{cfg['homeserver'].rstrip('/')}/_matrix/client/v3/rooms/{room}/send/m.room.message/{uuid.uuid4().hex}",
               {"msgtype": "m.text", "body": text}, headers={"Authorization": f"Bearer {cfg['token']}"})
    elif app == "whatsapp":
        to = re.sub(r"[^\d]", "", to or cfg.get("default_to", ""))
        if not to:
            raise I.IntegrationError("Who should get it? Add a number (or a default recipient in Settings).")
        I.http("POST", f"https://graph.facebook.com/v21.0/{cfg['phone_id']}/messages",
               {"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text[:4000]}},
               headers={"Authorization": f"Bearer {cfg['token']}"})
    elif app == "twilio":
        to = to or cfg.get("default_to", "")
        if not to:
            raise I.IntegrationError("Who should get the SMS? Add a number (or a default recipient in Settings).")
        http_form(f"https://api.twilio.com/2010-04-01/Accounts/{cfg['sid']}/Messages.json",
                  {"From": cfg["from"], "To": to, "Body": text[:1500]}, auth=(cfg["sid"], cfg["token"]))
    elif app == "signal":
        to = to or cfg.get("default_to", "") or cfg["number"]
        I.http("POST", f"{cfg['url'].rstrip('/')}/v2/send", {"message": text, "number": cfg["number"], "recipients": [to]})
    elif app == "pushover":
        http_form("https://api.pushover.net/1/messages.json", {"token": cfg["token"], "user": cfg["user"],
                                                               "message": text[:1000], "title": "Jarvis"})
    elif app == "ntfy":
        server = (cfg.get("server") or "https://ntfy.sh").rstrip("/")
        hdrs = {"Title": "Jarvis", "User-Agent": I.UA}
        if cfg.get("token"):
            hdrs["Authorization"] = f"Bearer {cfg['token']}"
        req = urllib.request.Request(f"{server}/{urllib.parse.quote(cfg['topic'])}", data=text.encode(), method="POST", headers=hdrs)
        try:
            urllib.request.urlopen(req, timeout=15).read()
        except OSError as e:
            raise I.IntegrationError(f"ntfy: {e}")
    elif app == "gotify":
        I.http("POST", f"{cfg['url'].rstrip('/')}/message", {"title": "Jarvis", "message": text, "priority": 5},
               headers={"X-Gotify-Key": cfg["token"]})
    elif app == "pushbullet":
        I.http("POST", "https://api.pushbullet.com/v2/pushes", {"type": "note", "title": "Jarvis", "body": text},
               headers={"Access-Token": cfg["token"]})
    elif app == "ifttt":
        event = (cfg.get("event") or "jarvis").strip()
        I.http("POST", f"https://maker.ifttt.com/trigger/{urllib.parse.quote(event)}/with/key/{cfg['key']}", {"value1": text})
    else:
        raise I.IntegrationError(f"{app} can't send messages.")
    return f"Sent via {APPS[app]['label']}"


def _task(app, cfg, a):
    title, notes, due = str(a.get("title") or "").strip(), str(a.get("notes") or ""), str(a.get("due") or "").strip()
    if not title:
        raise I.IntegrationError("The task needs a title.")
    if app == "todoist":
        body = {"content": title, "description": notes}
        if due:
            body["due_string"] = due
        _, raw = I.http("POST", "https://api.todoist.com/api/v1/tasks", body, headers={"Authorization": f"Bearer {cfg['token']}"})
        return "Added to Todoist" + (f": {js(raw).get('url')}" if js(raw).get("url") else "")
    if app == "trello":
        q = urllib.parse.urlencode({"idList": cfg["list_id"], "key": cfg["key"], "token": cfg["token"], "name": title,
                                    "desc": notes, **({"due": due} if re.match(r"\d{4}-\d{2}-\d{2}", due) else {})})
        _, raw = I.http("POST", f"https://api.trello.com/1/cards?{q}")
        return "Card added to Trello" + (f": {js(raw).get('shortUrl')}" if js(raw).get("shortUrl") else "")
    if app == "asana":
        d = {"name": title, "notes": notes, "workspace": cfg["workspace"]}
        if cfg.get("project"):
            d["projects"] = [cfg["project"]]
        if re.match(r"\d{4}-\d{2}-\d{2}$", due):
            d["due_on"] = due
        _, raw = I.http("POST", "https://app.asana.com/api/1.0/tasks", {"data": d}, headers={"Authorization": f"Bearer {cfg['token']}"})
        return "Task added to Asana" + (f": {js(raw).get('data', {}).get('permalink_url')}" if js(raw).get("data") else "")
    if app == "linear":
        q = "mutation($i: IssueCreateInput!) { issueCreate(input: $i) { success issue { url } } }"
        _, raw = I.http("POST", "https://api.linear.app/graphql",
                        {"query": q, "variables": {"i": {"teamId": cfg["team"], "title": title, "description": notes}}},
                        headers={"Authorization": cfg["token"]})
        res = js(raw)
        if res.get("errors"):
            raise I.IntegrationError(f"Linear: {res['errors'][0].get('message')}")
        return "Issue created in Linear: " + (((res.get("data") or {}).get("issueCreate") or {}).get("issue") or {}).get("url", "")
    if app == "jira":
        adf = {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": notes or title}]}]}
        _, raw = I.http("POST", f"{cfg['site'].rstrip('/')}/rest/api/3/issue",
                        {"fields": {"project": {"key": cfg["project"]}, "summary": title, "issuetype": {"name": "Task"},
                                    "description": adf, **({"duedate": due} if re.match(r"\d{4}-\d{2}-\d{2}$", due) else {})}},
                        headers=basic(cfg["email"], cfg["token"]))
        return f"Jira issue {js(raw).get('key', '')} created"
    if app == "clickup":
        _, raw = I.http("POST", f"https://api.clickup.com/api/v2/list/{cfg['list_id']}/task", {"name": title, "description": notes},
                        headers={"Authorization": cfg["token"]})
        return "Task added to ClickUp" + (f": {js(raw).get('url')}" if js(raw).get("url") else "")
    if app == "github":
        _, raw = I.http("POST", f"https://api.github.com/repos/{cfg['repo'].strip('/')}/issues", {"title": title, "body": notes},
                        headers={"Authorization": f"Bearer {cfg['token']}", "Accept": "application/vnd.github+json"})
        return "GitHub issue created: " + js(raw).get("html_url", "")
    if app == "gitlab":
        base = (cfg.get("url") or "https://gitlab.com").rstrip("/")
        proj = urllib.parse.quote(cfg["project"], safe="")
        _, raw = I.http("POST", f"{base}/api/v4/projects/{proj}/issues", {"title": title, "description": notes,
                                                                             **({"due_date": due} if re.match(r"\d{4}-\d{2}-\d{2}$", due) else {})},
                        headers={"PRIVATE-TOKEN": cfg["token"]})
        return "GitLab issue created: " + js(raw).get("web_url", "")
    if app == "google":
        body = {"title": title, "notes": notes}
        if re.match(r"\d{4}-\d{2}-\d{2}", due):
            body["due"] = due[:10] + "T00:00:00.000Z"
        I.http("POST", "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", body, headers=bearer("google"))
        return "Added to Google Tasks"
    if app == "microsoft":
        _, raw = I.http("GET", "https://graph.microsoft.com/v1.0/me/todo/lists", headers=bearer("microsoft"))
        lists = js(raw).get("value") or []
        lst = next((x for x in lists if x.get("wellknownListName") == "defaultList"), lists[0] if lists else None)
        if not lst:
            raise I.IntegrationError("No Microsoft To Do list found.")
        body = {"title": title, "body": {"content": notes, "contentType": "text"}}
        if re.match(r"\d{4}-\d{2}-\d{2}", due):
            body["dueDateTime"] = {"dateTime": due[:10] + "T09:00:00", "timeZone": getattr(I.user_tz(), "key", "UTC")}
        I.http("POST", f"https://graph.microsoft.com/v1.0/me/todo/lists/{lst['id']}/tasks", body, headers=bearer("microsoft"))
        return "Added to Microsoft To Do"
    raise I.IntegrationError(f"{app} can't create tasks.")


def _document(app, cfg, a):
    title, content = str(a.get("title") or "Untitled").strip(), str(a.get("content") or "")
    if app == "confluence":
        import html
        body = "".join(f"<p>{html.escape(p)}</p>" for p in re.split(r"\n\s*\n", content) if p.strip())
        _, raw = I.http("POST", f"{cfg['site'].rstrip('/')}/wiki/rest/api/content",
                        {"type": "page", "title": title, "space": {"key": cfg["space"]},
                         "body": {"storage": {"value": body or "<p></p>", "representation": "storage"}}},
                        headers=basic(cfg["email"], cfg["token"]))
        link = (js(raw).get("_links") or {})
        return "Confluence page created" + (f": {link.get('base', '')}{link.get('webui', '')}" if link else "")
    if app == "airtable":
        fields = {(cfg.get("title_field") or "Name"): title, (cfg.get("notes_field") or "Notes"): content}
        I.http("POST", f"https://api.airtable.com/v0/{cfg['base']}/{urllib.parse.quote(cfg['table'])}",
               {"fields": fields, "typecast": True}, headers={"Authorization": f"Bearer {cfg['token']}"})
        return "Record added to Airtable"
    if app == "google":
        _, raw = I.http("POST", "https://docs.googleapis.com/v1/documents", {"title": title}, headers=bearer("google"))
        doc = js(raw).get("documentId")
        if content.strip():
            I.http("POST", f"https://docs.googleapis.com/v1/documents/{doc}:batchUpdate",
                   {"requests": [{"insertText": {"location": {"index": 1}, "text": content}}]}, headers=bearer("google"))
        return f"Google Doc created: https://docs.google.com/document/d/{doc}/edit"
    raise I.IntegrationError(f"{app} can't create documents.")


def _event(app, cfg, a):
    title = str(a.get("title") or "").strip() or "(no title)"
    start, end, all_day = event_times(a)
    tzname = getattr(I.user_tz(), "key", "UTC")
    loc, notes = str(a.get("location") or ""), str(a.get("notes") or "")
    when = start.strftime("%a %d %b") + ("" if all_day else start.strftime(" %H:%M"))
    if app == "google":
        t = (lambda d: {"date": d.isoformat()}) if all_day else (lambda d: {"dateTime": d.isoformat(), "timeZone": tzname})
        _, raw = I.http("POST", "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                        {"summary": title, "location": loc, "description": notes, "start": t(start), "end": t(end)},
                        headers=bearer("google"))
        return f"Added to Google Calendar ({when})"
    if app == "microsoft":
        fmt = (lambda d: {"dateTime": d.isoformat() + "T00:00:00", "timeZone": tzname}) if all_day else \
            (lambda d: {"dateTime": d.astimezone(I.user_tz()).replace(tzinfo=None).isoformat(), "timeZone": tzname})
        I.http("POST", "https://graph.microsoft.com/v1.0/me/events",
               {"subject": title, "body": {"contentType": "text", "content": notes}, "start": fmt(start), "end": fmt(end),
                "location": {"displayName": loc}, "isAllDay": all_day}, headers=bearer("microsoft"))
        return f"Added to Outlook Calendar ({when})"
    if app == "caldav":
        uid = uuid.uuid4().hex + "@jarvis"
        esc = lambda v: v.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        when_lines = ([f"DTSTART;VALUE=DATE:{start:%Y%m%d}", f"DTEND;VALUE=DATE:{end:%Y%m%d}"] if all_day else
                      [f"DTSTART:{start.astimezone(dt.timezone.utc):%Y%m%dT%H%M%SZ}", f"DTEND:{end.astimezone(dt.timezone.utc):%Y%m%dT%H%M%SZ}"])
        ics = "\r\n".join(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jarvis//Knowledge Galaxy//EN", "BEGIN:VEVENT",
                           f"UID:{uid}", f"DTSTAMP:{stamp}", *when_lines, f"SUMMARY:{esc(title)}",
                           *([f"LOCATION:{esc(loc)}"] if loc else []), *([f"DESCRIPTION:{esc(notes)}"] if notes else []),
                           "END:VEVENT", "END:VCALENDAR", ""])
        req = urllib.request.Request(cfg["url"].rstrip("/") + f"/{uid}.ics", data=ics.encode(), method="PUT",
                                     headers={**basic(cfg["username"], cfg["password"]), "Content-Type": "text/calendar; charset=utf-8",
                                              "If-None-Match": "*", "User-Agent": I.UA})
        try:
            urllib.request.urlopen(req, timeout=20).read()
        except urllib.error.HTTPError as e:
            raise I.IntegrationError(f"CalDAV {e.code}: {e.reason}")
        except OSError as e:
            raise I.IntegrationError(f"CalDAV: {e}")
        return f"Added to your calendar ({when})"
    raise I.IntegrationError(f"{app} can't create events.")


SENSITIVE_DOMAINS = ("lock", "alarm_control_panel", "cover", "garage", "valve", "camera")


def _home(app, cfg, a):
    entity = str(a.get("entity_id") or "").strip()
    action = str(a.get("action") or "toggle").strip().lower()
    if not re.fullmatch(r"[a-z_]+\.[a-z0-9_]+", entity):
        raise I.IntegrationError(f"Unknown device {entity!r}.")
    domain = entity.split(".")[0]
    if "." in action:                          # e.g. "climate.set_temperature"
        domain, service = action.split(".", 1)
    else:
        service = {"on": "turn_on", "off": "turn_off"}.get(action, action)
    data = a.get("data") if isinstance(a.get("data"), dict) else {}
    I.http("POST", f"{cfg['url'].rstrip('/')}/api/services/{domain}/{service}", {"entity_id": entity, **data},
           headers={"Authorization": f"Bearer {cfg['token']}"})
    return f"{service.replace('_', ' ').capitalize()}: {entity}"


CAPS = {"message": _message, "task": _task, "document": _document, "event": _event, "home": _home}


def run(app, cap, args):
    if app not in APPS or cap not in APPS[app].get("caps", []):
        raise I.IntegrationError(f"{APPS.get(app, {}).get('label', app)} can't do that ({cap}).")
    cfg = I.app_cfg(app) if not APPS[app].get("oauth") else (I.SETTINGS.load()["apps"].get(app) or {})
    if APPS[app].get("oauth") and not cfg.get("refresh_token"):
        raise I.IntegrationError(f"{APPS[app]['label']}: press “Sign in” in Settings → Apps first.")
    return CAPS[cap](app, cfg, args)


def test(app):
    """A harmless check for each connector."""
    cfg = I.SETTINGS.load()["apps"].get(app) or {}
    caps = APPS[app].get("caps", [])
    if APPS[app].get("oauth"):
        oauth_token(app)
        return "Signed in and working."
    if app == "weather":
        return weather_block(force=True).split("\n", 2)[1]
    if app == "news":
        return f"{len(headlines(force=True))} headlines found."
    if app == "home_assistant":
        _, raw = I.http("GET", f"{cfg['url'].rstrip('/')}/api/", headers={"Authorization": f"Bearer {cfg['token']}"})
        return f"Home Assistant answered: {js(raw).get('message', 'ok')}"
    if "message" in caps:
        return run(app, "message", {"text": "Jarvis here. Connection confirmed, sir."})
    if app == "caldav":
        req = urllib.request.Request(cfg["url"], method="PROPFIND", headers={**basic(cfg["username"], cfg["password"]), "Depth": "0"})
        try:
            urllib.request.urlopen(req, timeout=15).read()
        except urllib.error.HTTPError as e:
            if e.code != 207:
                raise I.IntegrationError(f"CalDAV {e.code}: {e.reason}")
        return "Calendar reachable."
    probes = {
        "todoist": ("GET", "https://api.todoist.com/api/v1/projects", {"Authorization": f"Bearer {cfg.get('token')}"}),
        "asana": ("GET", "https://app.asana.com/api/1.0/users/me", {"Authorization": f"Bearer {cfg.get('token')}"}),
        "clickup": ("GET", "https://api.clickup.com/api/v2/user", {"Authorization": cfg.get("token", "")}),
        "github": ("GET", f"https://api.github.com/repos/{cfg.get('repo', '').strip('/')}", {"Authorization": f"Bearer {cfg.get('token')}"}),
        "gitlab": ("GET", f"{(cfg.get('url') or 'https://gitlab.com').rstrip('/')}/api/v4/projects/{urllib.parse.quote(cfg.get('project', ''), safe='')}",
                   {"PRIVATE-TOKEN": cfg.get("token", "")}),
        "jira": ("GET", f"{cfg.get('site', '').rstrip('/')}/rest/api/3/myself", basic(cfg.get("email", ""), cfg.get("token", ""))),
        "confluence": ("GET", f"{cfg.get('site', '').rstrip('/')}/wiki/rest/api/space/{cfg.get('space', '')}", basic(cfg.get("email", ""), cfg.get("token", ""))),
        "trello": ("GET", f"https://api.trello.com/1/lists/{cfg.get('list_id')}?key={cfg.get('key')}&token={cfg.get('token')}", {}),
        "airtable": ("GET", f"https://api.airtable.com/v0/{cfg.get('base')}/{urllib.parse.quote(cfg.get('table', ''))}?maxRecords=1",
                     {"Authorization": f"Bearer {cfg.get('token')}"}),
    }
    if app == "linear":
        _, raw = I.http("POST", "https://api.linear.app/graphql", {"query": "{ viewer { name } }"}, headers={"Authorization": cfg.get("token", "")})
        if js(raw).get("errors"):
            raise I.IntegrationError("Linear rejected the API key.")
        return "Linear key works."
    if app in probes:
        method, url, hdrs = probes[app]
        I.http(method, url, headers=hdrs)
        return "Credentials work."
    raise I.IntegrationError("Nothing to test.")


# ------------------------------------------------------------------ info sources
WEATHER_CODES = {0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "freezing fog",
                 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain",
                 66: "freezing rain", 67: "freezing rain", 71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
                 80: "showers", 81: "showers", 82: "violent showers", 85: "snow showers", 86: "snow showers",
                 95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with hail"}
_info_cache = {}


def _cached(key, ttl, fn, force=False):
    hit = _info_cache.get(key)
    if hit and not force and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _info_cache[key] = (time.time(), val)
    return val


def geocode(city):
    _, raw = I.http("GET", "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode({"name": city, "count": 1}))
    res = (js(raw).get("results") or [None])[0]
    if not res:
        raise I.IntegrationError(f"Couldn't find {city!r}.")
    return {"lat": res["latitude"], "lon": res["longitude"], "place": f"{res['name']}, {res.get('country', '')}".strip(", ")}


def weather_block(force=False):
    if not I.is_connected("weather"):
        return ""
    cfg = I.SETTINGS.load()["apps"]["weather"]

    def get():
        loc = geocode(cfg["city"]) if not cfg.get("lat") else {"lat": cfg["lat"], "lon": cfg["lon"], "place": cfg.get("place", cfg["city"])}
        q = urllib.parse.urlencode({"latitude": loc["lat"], "longitude": loc["lon"], "timezone": "auto", "forecast_days": 4,
                                    "current": "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation",
                                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"})
        _, raw = I.http("GET", "https://api.open-meteo.com/v1/forecast?" + q)
        d = js(raw)
        cur, day = d.get("current", {}), d.get("daily", {})
        lines = [f"Weather for {loc['place']}:",
                 f"Now {cur.get('temperature_2m')}°C (feels {cur.get('apparent_temperature')}°C), "
                 f"{WEATHER_CODES.get(cur.get('weather_code'), 'unknown')}, wind {cur.get('wind_speed_10m')} km/h."]
        for i, date in enumerate(day.get("time", [])):
            lines.append(f"{dt.date.fromisoformat(date):%a %d %b}: {WEATHER_CODES.get(day['weather_code'][i], '?')}, "
                         f"{day['temperature_2m_min'][i]}–{day['temperature_2m_max'][i]}°C, "
                         f"rain chance {day['precipitation_probability_max'][i]}%")
        return "\n".join(lines)
    try:
        return _cached("weather", 900, get, force)
    except I.IntegrationError as e:
        return f"Weather unavailable: {e}"


def headlines(limit=6, force=False):
    if not I.is_connected("news"):
        return []
    feeds = [f.strip() for f in re.split(r"[\n,]+", I.SETTINGS.load()["apps"]["news"]["feeds"]) if f.strip()][:6]

    def get():
        out = []
        for url in feeds:
            try:
                _, raw = I.http("GET", url, timeout=12)
                root = ET.fromstring(raw)
            except (I.IntegrationError, ET.ParseError):
                continue
            items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
            for it in items[:limit]:
                t = it.findtext("title") or it.findtext("{http://www.w3.org/2005/Atom}title") or ""
                if t.strip():
                    out.append(re.sub(r"\s+", " ", t).strip())
        return out
    return _cached("news", 900, get, force)[: limit * 2]


def news_block():
    items = headlines()
    return ("Latest headlines:\n" + "\n".join(f"- {h}" for h in items)) if items else ""


def home_block(limit=80):
    if not I.is_connected("home_assistant"):
        return ""
    cfg = I.SETTINGS.load()["apps"]["home_assistant"]

    def get():
        _, raw = I.http("GET", f"{cfg['url'].rstrip('/')}/api/states", headers={"Authorization": f"Bearer {cfg['token']}"})
        keep = ("light", "switch", "climate", "cover", "lock", "media_player", "fan", "sensor", "binary_sensor", "scene", "script")
        rows = []
        for s in json.loads(raw):
            dom = s["entity_id"].split(".")[0]
            if dom not in keep:
                continue
            if dom == "sensor" and s.get("attributes", {}).get("device_class") not in ("temperature", "humidity", "power", "battery"):
                continue
            name = s.get("attributes", {}).get("friendly_name", s["entity_id"])
            unit = s.get("attributes", {}).get("unit_of_measurement", "")
            rows.append(f"- {s['entity_id']} ({name}): {s['state']}{(' ' + unit) if unit else ''}")
        return rows[:limit]
    try:
        rows = _cached("home", 30, get)
    except I.IntegrationError as e:
        return f"<home>\nHome Assistant unavailable: {e}\n</home>"
    return "<home>\nSmart-home devices (entity_id (name): state):\n" + "\n".join(rows) + "\n</home>"


# register with the main app catalogue (settings screen, connection checks)
I.APPS.update(APPS)
