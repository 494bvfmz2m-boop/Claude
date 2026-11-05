# Claude
For my Claude projects

## Knowledge Galaxy

An interactive 3D map of markdown notes.

- `notes/`: 25 sample notes about a small coffee roastery, in 5 folders
- `build.py`: scans every `.md` file and writes `viewer/graph-data.js` (`const GRAPH = {nodes, links}`). Each node's `id` is its index in `nodes`.
- `viewer/index.html`: the 3D viewer, using 3d-force-graph from a CDN
- `server.py`: serves only `viewer/` on port 4700, plus `POST /chat` for the "ask your notes" bar
- `config.json`: created on first run and git-ignored. Paste an Anthropic key (`sk-ant-...`) or a Google Gemini key (`AIza...` / `AQ....`) into `api_key`; the provider is detected from the key. Leave the placeholder to answer through `claude -p` on your Claude Code subscription.

```bash
python3 build.py            # or: python3 build.py /path/to/your/notes
python3 server.py           # then open http://localhost:4700
```
