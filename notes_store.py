"""Safe note editing for Jarvis (standard library only).

Every change stays inside the notes folder. Nothing is ever destroyed:
deleted and overwritten notes are moved/copied into notes/.trash/<batch>/
(build.py skips dot-folders), and each batch of changes can be undone.
"""
import os
import re
import shutil
import threading
import time

import build

RESERVED = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)), *(f"lpt{i}" for i in range(1, 10))}
MAX_CONTENT = 100_000
MAX_ACTIONS = 200


class ActionError(Exception):
    pass


def clean_part(text, limit=120):
    """One safe path component (works on Windows, macOS and Linux)."""
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", str(text or ""))
    text = re.sub(r"\s+", " ", text).strip().strip(".").strip()[:limit].strip()
    if text.lower() in RESERVED:
        text += "_"
    return text


def clean_folder(folder):
    parts = [clean_part(p, 60) for p in re.split(r"[\\/]+", str(folder or ""))]
    parts = [p for p in parts if p and not p.startswith(".")]
    return "/".join(parts[:4])


class NoteStore:
    def __init__(self, notes_dir, graph_out):
        self.root = os.path.realpath(notes_dir)
        self.graph_out = graph_out
        self.lock = threading.Lock()
        self.undo_stack = []          # list of batches; each batch is a list of journal entries

    # ------------------------------------------------------------ paths
    def _inside(self, path):
        real = os.path.realpath(path)
        if os.path.commonpath([real, self.root]) != self.root or real == self.root:
            raise ActionError("refused: path outside the notes folder")
        return real

    def _path_for(self, title, folder=""):
        name = clean_part(title)
        if not name:
            raise ActionError("a note needs a title")
        folder = clean_folder(folder)
        return self._inside(os.path.join(self.root, *folder.split("/"), name + ".md") if folder
                            else os.path.join(self.root, name + ".md"))

    def find(self, title):
        """Existing note path by title (case/space-insensitive) or relative path."""
        want = build.norm(str(title or "").removesuffix(".md"))
        want_path = str(title or "").replace("\\", "/").strip("/").lower()
        for path in build.scan(self.root):
            rel = os.path.relpath(path, self.root).replace(os.sep, "/").lower()
            label = build.norm(build.label_from_filename(os.path.basename(path)))
            if label == want or rel == want_path or rel == want_path + ".md":
                return path
        return None

    def _need(self, title):
        path = self.find(title)
        if not path:
            raise ActionError(f'no note called "{title}"')
        return path

    def rel(self, path):
        return os.path.relpath(path, self.root).replace(os.sep, "/")

    # ------------------------------------------------------------ trash
    def _trash_dir(self, batch_id):
        d = os.path.join(self.root, ".trash", batch_id)
        os.makedirs(d, exist_ok=True)
        return d

    def _to_trash(self, path, batch_id, copy=False):
        dest = os.path.join(self._trash_dir(batch_id), self.rel(path))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        (shutil.copy2 if copy else shutil.move)(path, dest)
        return dest

    def _prune_empty_dirs(self, start):
        d = os.path.dirname(start)
        while d != self.root and d.startswith(self.root) and os.path.isdir(d) and not os.listdir(d):
            os.rmdir(d)
            d = os.path.dirname(d)

    # ------------------------------------------------------------ apply
    def apply(self, actions):
        """Run a list of actions. Returns (changes, touched_paths); each change is
        {"op", "title", "path", "ok", "error"?}. Writes graph-data.js afterwards."""
        if not isinstance(actions, list):
            return [], []
        actions = actions[:MAX_ACTIONS]
        batch_id = time.strftime("%Y%m%d-%H%M%S") + f"-{int(time.time() * 1000) % 1000:03d}"
        journal, changes, touched = [], [], []
        with self.lock:
            for act in actions:
                if not isinstance(act, dict):
                    continue
                op = str(act.get("op") or "").lower()
                title = str(act.get("title") or "").strip()
                change = {"op": op, "title": title}
                try:
                    paths = self._do(op, act, batch_id, journal)
                    change.update(ok=True, path=self.rel(paths[-1]) if paths else "")
                    touched += [p for p in paths if os.path.exists(p)]
                except ActionError as e:
                    change.update(ok=False, error=str(e))
                except OSError as e:
                    change.update(ok=False, error=f"{type(e).__name__}: {e.strerror or e}")
                changes.append(change)
            if journal:
                self.undo_stack.append(journal)
                self.undo_stack = self.undo_stack[-20:]
                self._rebuild()
        return changes, touched

    def _do(self, op, act, batch_id, journal):
        content = act.get("content")
        content = "" if content is None else str(content)
        if len(content) > MAX_CONTENT:
            raise ActionError("content too long")

        if op == "create":
            title = clean_part(act.get("title"))
            path = self._path_for(title, act.get("folder", ""))
            if os.path.exists(path) or self.find(title):
                raise ActionError(f'"{title}" already exists (use update or append)')
            body = content.strip()
            if not body.lstrip().startswith("#"):
                body = f"# {title}\n\n{body}"
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(body.rstrip() + "\n")
            journal.append(("created", path))
            return [path]

        if op in ("update", "append"):
            path = self._need(act.get("title"))
            backup = self._to_trash(path, batch_id, copy=True)
            journal.append(("modified", path, backup))
            if op == "update":
                body = content.strip()
                if not body.lstrip().startswith("#"):
                    body = f"# {build.label_from_filename(os.path.basename(path))}\n\n{body}"
                with open(path, "w", encoding="utf-8") as f:
                    f.write(body.rstrip() + "\n")
            else:
                with open(path, "a", encoding="utf-8") as f:
                    f.write("\n" + content.strip() + "\n")
            return [path]

        if op in ("rename", "move"):
            path = self._need(act.get("title"))
            old_folder = os.path.dirname(self.rel(path))
            new_title = act.get("new_title") if op == "rename" else build.label_from_filename(os.path.basename(path))
            if op == "rename" and not clean_part(new_title):
                raise ActionError("rename needs new_title")
            folder = act.get("folder", old_folder) if op == "move" else old_folder
            dest = self._path_for(new_title, folder)
            if os.path.exists(dest):
                raise ActionError(f'"{self.rel(dest)}" already exists')
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.move(path, dest)
            self._prune_empty_dirs(path)
            journal.append(("moved", path, dest))
            return [dest]

        if op == "delete":
            path = self._need(act.get("title"))
            trashed = self._to_trash(path, batch_id)
            self._prune_empty_dirs(path)
            journal.append(("deleted", path, trashed))
            return []

        if op == "delete_all":
            files = build.scan(self.root)
            if not files:
                raise ActionError("there are no notes to delete")
            for path in files:
                trashed = self._to_trash(path, batch_id)
                self._prune_empty_dirs(path)
                journal.append(("deleted", path, trashed))
            return []

        raise ActionError(f'unknown action "{op}"')

    # ------------------------------------------------------------ undo
    def undo(self):
        """Revert the most recent batch. Returns a short description or None."""
        with self.lock:
            if not self.undo_stack:
                return None
            journal = self.undo_stack.pop()
            for entry in reversed(journal):
                kind = entry[0]
                try:
                    if kind == "created" and os.path.exists(entry[1]):
                        os.remove(entry[1])
                        self._prune_empty_dirs(entry[1])
                    elif kind == "modified":
                        shutil.copy2(entry[2], entry[1])
                    elif kind == "moved" and os.path.exists(entry[2]) and not os.path.exists(entry[1]):
                        os.makedirs(os.path.dirname(entry[1]), exist_ok=True)
                        shutil.move(entry[2], entry[1])
                        self._prune_empty_dirs(entry[2])
                    elif kind == "deleted" and os.path.exists(entry[2]) and not os.path.exists(entry[1]):
                        os.makedirs(os.path.dirname(entry[1]), exist_ok=True)
                        shutil.move(entry[2], entry[1])
                except OSError:
                    pass
            self._rebuild()
            return f"Undid {len(journal)} change{'s' if len(journal) != 1 else ''}."

    def can_undo(self):
        return bool(self.undo_stack)

    def _rebuild(self):
        build.write_graph(build.build(self.root), self.graph_out)
