# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Activate venv (Windows)
.venv\Scripts\activate

# Run dev server
python app.py

# Install dependencies
pip install -r requirements.txt

# Submit a compression job (returns 202 + session_id immediately)
curl -s -X POST http://127.0.0.1:5000/api/compress \
  -F "file=@test.gif;type=image/gif" \
  -F "preset=discord"

# Poll for result
curl -s http://127.0.0.1:5000/api/status/<session_id>

# Timed end-to-end test (polls until done)
SESSION=$(curl -s -X POST http://127.0.0.1:5000/api/compress \
  -F "file=@testgif.gif;type=image/gif" -F "preset=discord" | python -m json.tool)
# then poll /api/status/<session_id>
```

No test suite exists. Test manually via curl. Watch for stale Flask processes on Windows — multiple processes can accumulate on port 5000; check with `netstat -ano | find ":5000"` and kill extras via PowerShell before starting the server.

## Architecture

**Entry point:** `app.py` — application factory (`create_app()`). Runs Flask dev server directly when invoked as `__main__`.

**Request flow for compression:**
1. `POST /api/compress` → validates upload → saves file → spawns background thread → returns `202` with `session_id` immediately
2. Background thread calls `compress_gif()` and writes result to `uploads/<uuid>/status.json`
3. `GET /api/status/<session_id>` → reads `status.json` → returns `{"state": "processing"|"done"|"error", "result": {...}}`
4. `GET /api/download/<session_id>/compressed.gif` → serves the file

**Key design decisions to be aware of:**

- **Async via threading**: compression runs in a daemon thread; status is stored in a file (`status.json`) so it works correctly across Gunicorn workers without a shared store.

- **Rate limiting removed** — all `@limiter.limit()` decorators stripped. Flask-Limiter package stays installed but is not initialised.

- **Pillow 12.x constraint:** `Image.Quantize.FASTOCTREE` must be used for RGBA frames — MEDIANCUT is not allowed. Frames must be converted to RGBA before quantizing.

- **Compressor algorithm** (`utils/compressor.py`): for each scale in `[1.0, 0.75, 0.5, 0.25]`, does two probes at skip=1 (ceiling at palette=256, floor at `palette_min`). If the floor fits, binary-searches for best quality. If not, uses the measured floor size to estimate the minimum frame-skip needed (`needed_skip = floor_size / target + 1`) and jumps directly there — skipping intermediate skip levels that can't possibly work. The `for...else: continue; break` pattern at both loop levels is load-bearing.

- **`_binary_search` return value** changed to `(data, palette)` tuple — callers must unpack as `best_data, best_palette = _binary_search(...)`.

- **Compressor result fields**: `compress_gif()` returns `final_palette` (int, colours used) and `final_frame_count` (int, frames in output). `original_frame_count` is captured via `img.n_frames` in the compress route and included in every `status.json` write (initial + done result).

- **Target dimensions**: `discord_emoji` preset passes `(128, 128)` as `target_dimensions` to `compress_gif`, which centre-crops to square and resizes before the compression loop runs.

- **Session isolation:** each request gets a UUID directory under `uploads/`. APScheduler (`utils/cleanup.py`) purges directories older than 60 minutes every 10 minutes. Startup purges all leftovers immediately.

- **File validation** (`validators/file_validator.py`): checks extension, GIF magic bytes (`GIF87a` / `GIF89a`), and size — in that order, before any Pillow processing.

## Config

`config.py` holds all tunable values. Key ones:

| Key | Purpose |
|---|---|
| `PRESETS` | Dict of `{preset_name: {max_bytes, dimensions}}` — currently discord + discord_emoji only |
| `MAX_UPLOAD_BYTES` | Validated before processing (separate from Flask's `MAX_CONTENT_LENGTH`) |
| `FILE_MAX_AGE_MINUTES` | How long uploaded sessions survive |

## Known constraints

- **Python 3.14** — no binary wheels for older Pillow; must use Pillow 12.2.0+.
- **Gunicorn is Linux-only** — `Procfile` uses gunicorn for production (Railway/Render/Fly.io); dev uses Flask's built-in server.
- **OneDrive conflict** — `uploads/` is inside OneDrive. Use direct file writes; `os.replace` (atomic rename) raises "Access is denied" during OneDrive sync.
- **Git repo**: https://github.com/d4vidholly/gif-compressor (public, master branch).
