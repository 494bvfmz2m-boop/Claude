#!/usr/bin/env python3
"""Serve ONLY the viewer/ folder on http://localhost:4700 (standard library only).

Usage:  python3 server.py [--host 127.0.0.1] [--port 4700]
"""
import argparse
import functools
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

VIEWER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "viewer")


class ViewerHandler(SimpleHTTPRequestHandler):
    """Static handler rooted at viewer/. SimpleHTTPRequestHandler resolves
    paths inside `directory` only, so ../ cannot escape it; dotfiles and
    directory listings are refused for good measure."""

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
        # Always fetch fresh graph-data.js after a rebuild.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=4700)
    args = ap.parse_args()
    handler = functools.partial(ViewerHandler, directory=VIEWER_DIR)
    ThreadingHTTPServer.allow_reuse_address = True
    with ThreadingHTTPServer((args.host, args.port), handler) as httpd:
        print(f"Serving {VIEWER_DIR} at http://localhost:{args.port}/  (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
