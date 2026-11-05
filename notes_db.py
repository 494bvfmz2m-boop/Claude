"""PostgreSQL storage for notes (used when DATABASE_URL is set, e.g. on Coolify).

The database is the source of truth. The server keeps a working copy of the
notes as .md files on disk (so build.py, retrieval and notes_store.py work
unchanged):
    * pull(): database -> disk (at startup)
    * push(): disk -> database (after every change Jarvis makes, and undo)
Notes removed from the database are copied into notes_trash first.

Needs the pure-Python driver pg8000 (pip install pg8000); local use without
DATABASE_URL stays standard-library only.
"""
import os
import ssl
import threading
import urllib.parse

import build
import notes_store

SCHEMA = (
    """CREATE TABLE IF NOT EXISTS notes (
        path       TEXT PRIMARY KEY,
        content    TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""",
    """CREATE TABLE IF NOT EXISTS notes_trash (
        id         BIGSERIAL PRIMARY KEY,
        path       TEXT NOT NULL,
        content    TEXT NOT NULL,
        removed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""",
)


def safe_rel_path(path):
    """Normalise a stored path to folder/…/Title.md, or None if it's unsafe."""
    parts = [p for p in str(path or "").replace("\\", "/").split("/") if p]
    if not parts or not parts[-1].lower().endswith(".md"):
        return None
    folder = notes_store.clean_folder("/".join(parts[:-1]))
    name = notes_store.clean_part(parts[-1][:-3])
    if not name or len(parts[:-1]) != len([p for p in folder.split("/") if p]):
        return None
    return (folder + "/" if folder else "") + name + ".md"


class NotesDB:
    def __init__(self, url):
        import pg8000.native  # imported here so local use needs no extra package
        self._pg = pg8000.native
        u = urllib.parse.urlparse(url)
        if u.scheme not in ("postgres", "postgresql"):
            raise ValueError("DATABASE_URL must start with postgres:// or postgresql://")
        query = urllib.parse.parse_qs(u.query)
        sslmode = (query.get("sslmode") or ["disable"])[0]
        ctx = None
        if sslmode in ("require", "verify-ca", "verify-full"):
            ctx = ssl.create_default_context()
            if sslmode == "require":
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
        self.params = dict(
            user=urllib.parse.unquote(u.username or "postgres"),
            password=urllib.parse.unquote(u.password or ""),
            host=u.hostname or "localhost",
            port=u.port or 5432,
            database=(u.path or "/postgres").lstrip("/") or "postgres",
            ssl_context=ctx,
            timeout=15,
        )
        self.conn = None
        self.lock = threading.Lock()

    def describe(self):
        p = self.params
        return f"postgres://{p['user']}@{p['host']}:{p['port']}/{p['database']}"

    def _run(self, sql, **params):
        with self.lock:
            for attempt in (1, 2):
                try:
                    if self.conn is None:
                        self.conn = self._pg.Connection(**self.params)
                    return self.conn.run(sql, **params)
                except (self._pg.InterfaceError, OSError):
                    # dropped connection (DB restart, idle timeout): reconnect once
                    try:
                        if self.conn:
                            self.conn.close()
                    except Exception:
                        pass
                    self.conn = None
                    if attempt == 2:
                        raise

    def init(self):
        for stmt in SCHEMA:
            self._run(stmt)

    def count(self):
        return self._run("SELECT count(*) FROM notes")[0][0]

    def all(self):
        return {path: content for path, content in self._run("SELECT path, content FROM notes")}

    # -------------------------------------------------------- sync
    def pull(self, notes_dir):
        """Replace the .md files on disk with what's in the database."""
        rows = self.all()
        for path in build.scan(notes_dir):
            os.remove(path)
        written = 0
        for raw, content in rows.items():
            rel = safe_rel_path(raw)
            if not rel:
                print(f"[db] skipping note with unsafe path: {raw!r}", flush=True)
                continue
            dest = os.path.join(notes_dir, *rel.split("/"))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "w", encoding="utf-8") as f:
                f.write(content)
            written += 1
        # tidy empty folders left behind
        for dirpath, dirnames, filenames in sorted(os.walk(notes_dir), reverse=True):
            if dirpath != notes_dir and not dirnames and not filenames and ".trash" not in dirpath:
                os.rmdir(dirpath)
        return written

    def push(self, notes_dir):
        """Make the database match the .md files on disk."""
        disk = {}
        for path in build.scan(notes_dir):
            rel = os.path.relpath(path, notes_dir).replace(os.sep, "/")
            with open(path, encoding="utf-8", errors="replace") as f:
                disk[rel] = f.read()
        db = self.all()
        changed = 0
        for rel, content in disk.items():
            if db.get(rel) != content:
                self._run("INSERT INTO notes (path, content, updated_at) VALUES (:p, :c, now()) "
                          "ON CONFLICT (path) DO UPDATE SET content = EXCLUDED.content, updated_at = now()",
                          p=rel, c=content)
                changed += 1
        for rel in db.keys() - disk.keys():
            self._run("INSERT INTO notes_trash (path, content) SELECT path, content FROM notes WHERE path = :p", p=rel)
            self._run("DELETE FROM notes WHERE path = :p", p=rel)
            changed += 1
        return changed
