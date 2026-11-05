#!/usr/bin/env python3
"""Build viewer/graph-data.js from a folder of markdown notes.

Usage:  python3 build.py [notes_dir]      (default: ./notes)

Standard library only. Writes:
    viewer/graph-data.js  ->  const GRAPH = {nodes: [...], links: [...]};

Each node:  {id, label, group, excerpt, path, words, degree}
  - id is the node's index in the nodes array (GRAPH.nodes[id] is that node).
  - label comes from the filename, group from the note's folder.
Two notes are linked when one mentions the other's title (plain text or
[[wikilink]]) or when both contain a [[wikilink]] to the same target.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
EXCERPT_LEN = 700

WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]")
FRONTMATTER_RE = re.compile(r"\A---\s*\n.*?\n---\s*\n", re.S)


def label_from_filename(name):
    stem = os.path.splitext(name)[0]
    return re.sub(r"\s+", " ", stem.replace("_", " ").replace("-", " ")).strip()


def norm(s):
    return re.sub(r"\s+", " ", s.replace("_", " ").replace("-", " ")).strip().lower()


def to_plain(text):
    """Strip markdown syntax but keep line structure for the excerpt."""
    text = FRONTMATTER_RE.sub("", text)
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = WIKILINK_RE.sub(lambda m: (m.group(2) or m.group(1)).strip(), text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)            # images
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)        # links
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"(\*\*|__|\*|_)(?=\S)(.+?)(?<=\S)\1", r"\2", text)
    lines = []
    for line in text.splitlines():
        line = re.sub(r"^\s{0,3}#{1,6}\s*", "", line)            # headings
        line = re.sub(r"^\s*>\s?", "", line)                      # quotes
        line = re.sub(r"^\s*([-*+]|\d+[.)])\s+", "• ", line)      # list items
        line = re.sub(r"[ \t]+", " ", line).strip()
        lines.append(line)
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def excerpt(plain, title):
    # Drop a leading heading line that just repeats the title.
    first, _, rest = plain.partition("\n")
    if norm(first).startswith(norm(title)):
        plain = rest.strip()
    if len(plain) <= EXCERPT_LEN:
        return plain
    cut = plain[:EXCERPT_LEN]
    space = max(cut.rfind(" "), cut.rfind("\n"))
    if space > EXCERPT_LEN * 0.8:
        cut = cut[:space]
    return cut.rstrip(" ,.;:-\n") + "…"


def scan(notes_dir):
    files = []
    for dirpath, dirnames, filenames in os.walk(notes_dir):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith("."))
        for fn in sorted(filenames):
            if fn.lower().endswith(".md"):
                files.append(os.path.join(dirpath, fn))
    return files


def build(notes_dir, include_text=False):
    """Return {nodes, links}. With include_text, each node also carries its
    full plain text under "text" (used by server.py for /chat retrieval)."""
    nodes, raw = [], []
    for path in scan(notes_dir):
        with open(path, encoding="utf-8", errors="replace") as f:
            text = f.read()
        rel = os.path.relpath(path, notes_dir)
        folder = os.path.dirname(rel).replace(os.sep, "/")
        label = label_from_filename(os.path.basename(path))
        plain = to_plain(text)
        nodes.append({
            "id": len(nodes),            # == index in the nodes array
            "label": label,
            "group": folder or "root",
            "excerpt": excerpt(plain, label),
            "path": rel.replace(os.sep, "/"),
            "words": len(plain.split()),
            "t": int(os.path.getmtime(path)),       # last change (timeline view)
        })
        if include_text:
            nodes[-1]["text"] = plain
        raw.append({
            "wikilinks": {norm(m.group(1)) for m in WIKILINK_RE.finditer(text)},
            "search": " " + norm(plain) + " ",
        })

    # Collect undirected links keyed by (lower id, higher id).
    links = {}

    def add(a, b, kind, shared=None):
        key = (min(a, b), max(a, b))
        link = links.setdefault(key, {"source": key[0], "target": key[1],
                                      "type": kind, "shared": []})
        if kind == "mention":
            link["type"] = "mention"   # a direct mention outranks a shared link
        if shared:
            link["shared"] = sorted(set(link["shared"]) | shared)

    titles = [norm(n["label"]) for n in nodes]
    for i, r in enumerate(raw):
        for j, title in enumerate(titles):
            if i == j or not title:
                continue
            mentioned = title in r["wikilinks"] or re.search(
                r"(?<![\w])" + re.escape(title) + r"(?![\w])", r["search"])
            if mentioned:
                add(i, j, "mention")

    for i in range(len(raw)):
        for j in range(i + 1, len(raw)):
            common = raw[i]["wikilinks"] & raw[j]["wikilinks"]
            if common:
                labels = {nodes[titles.index(c)]["label"] if c in titles else c
                          for c in common}
                add(i, j, "shared", labels)

    link_list = [links[k] for k in sorted(links)]
    for link in link_list:
        link["value"] = 3 if link["type"] == "mention" else len(link["shared"])
    degree = [0] * len(nodes)
    for link in link_list:
        degree[link["source"]] += 1
        degree[link["target"]] += 1
    for n in nodes:
        n["degree"] = degree[n["id"]]

    assert all(n["id"] == i for i, n in enumerate(nodes))
    return {"nodes": nodes, "links": link_list}


def write_graph(graph, out):
    """Write graph-data.js atomically (the server may be serving it right now)."""
    tmp = out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("// Generated by build.py — do not edit by hand.\n")
        f.write("const GRAPH = ")
        json.dump(graph, f, ensure_ascii=False, indent=1)
        f.write(";\n")
    os.replace(tmp, out)


def main():
    notes_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1
                                else os.path.join(ROOT, "notes"))
    if not os.path.isdir(notes_dir):
        sys.exit(f"Notes folder not found: {notes_dir}")
    graph = build(notes_dir)
    out_dir = os.path.join(ROOT, "viewer")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "graph-data.js")
    write_graph(graph, out)
    mentions = sum(1 for l in graph["links"] if l["type"] == "mention")
    print(f"{len(graph['nodes'])} notes, {len(graph['links'])} links "
          f"({mentions} mentions, {len(graph['links']) - mentions} shared-wikilink) "
          f"-> {os.path.relpath(out, ROOT)}")


if __name__ == "__main__":
    main()
