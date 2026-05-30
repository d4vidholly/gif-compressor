# GIF Compressor — Product Brief

## What we're building

A single-function web tool that compresses animated GIFs. Nothing else.

The user drops a GIF, sees a live before/after comparison, adjusts compression with a quality slider or picks a platform preset (Discord, Discord Emoji, Slack Emoji, Web), and downloads the result in one click. No account required. No watermark. No ads.

The free tier processes one file at a time. Batch processing is behind a paid tier.

---

## Why we're building it

The dominant tool in this space is **ezgif.com** — 28M+ monthly visits, no real competitor with a clean UX. It's universally acknowledged as useful and universally disliked for its experience: intrusive ads, a cluttered interface unchanged since ~2012, and server-side file processing that makes privacy-conscious users uncomfortable.

Every competitor either:
- Caps uploads at 10MB (compressor.io) — too low for real-world GIFs
- Watermarks the output on the free tier (VEED.io)
- Offers no compression controls whatsoever (gifcompressor.com)
- Is macOS-desktop-only (Compresto)

**The gap:** a clean, fast GIF compressor with a target-size mode. Nobody has built the obvious thing: "make this under 8MB for Discord" as a one-click preset.

**The business model:** TinyPNG generates ~$7.4M ARR with a free tier that converts at ~2.83% and a simple API/bulk subscription. Same playbook applies here.

---

## Core user problem

> "I want to send a GIF on Discord / use it as a server emoji / embed it on a page, but the file is too big."

Concrete limits users hit constantly:
- Discord free upload: **8 MB**
- Discord animated emoji: **256 KB**
- Slack custom emoji: **128 KB**
- Web page performance threshold: **~1 MB**

No existing tool lets you specify a target size and get there automatically.

---

## Feature specification

### Free tier
| Feature | Spec |
|---|---|
| File input | Single GIF, drag-and-drop or file picker |
| Max upload size | 50 MB (free) · 150 MB (pro) |
| Compression modes | Quality slider (0–100) + platform presets |
| Platform presets | Discord (8 MB), Discord Emoji (256 KB), Slack Emoji (128 KB), Web (1 MB) |
| Before/after | Side-by-side file size + visual preview |
| Output | Download compressed GIF |
| Rate limit | 10 compressions per hour per IP, 3 per minute burst |
| Watermark | None |
| Account required | No |

### Paid tier (future)
| Feature | Spec |
|---|---|
| Batch processing | Up to 50 GIFs at once |
| Higher rate limits | 100/hour |
| API access | REST endpoint with API key |
| Max upload size | 200 MB |

---

## Technical architecture

**Stack:** Python / Flask  
**Compression engine:** Pillow (pure Python, zero system dependencies) with iterative quality reduction to hit target sizes  
**File handling:** UUID-namespaced temp directories, auto-deleted after 60 minutes via APScheduler  
**Rate limiting:** Flask-Limiter with in-memory store (Redis-upgradeable)  
**Deployment target:** Any PaaS (Railway, Render, Fly.io)

---

## Compression algorithm

1. Accept upload → validate type (GIF only) and size (≤ 50 MB free / ≤ 150 MB pro / hard cap 200 MB)
2. Save to `uploads/<uuid>/original.gif`
3. If preset selected: set `target_bytes` from preset table; if quality slider: map 0–100 to params
4. Iterative compression loop:
   - Reduce colour palette (start 256, step down by 32 per iteration)
   - Drop every nth frame if palette reduction insufficient
   - Scale dimensions by 75% only as last resort
   - Stop when `file_size ≤ target_bytes` or quality floor reached
5. Save to `uploads/<uuid>/compressed.gif`
6. Return JSON: `{ original_size, compressed_size, reduction_pct, download_url }`
7. Cleanup scheduler deletes `uploads/<uuid>/` after 60 minutes

---

## Rate limiting behaviour

| Situation | Response |
|---|---|
| Under limit | 200 OK |
| Burst limit hit (3/min) | 429 — "Slow down — try again in a moment" |
| Hourly limit hit (10/hr) | 429 — "Free limit reached. Upgrade for unlimited." |
| File too large | 413 — "Material exceeds intake tolerance. Max 50 MB free, 150 MB pro." |
| Wrong file type | 415 — "Only GIF files are supported." |

---

## File cleanup policy

- Files stored in `uploads/<uuid>/` on the server
- APScheduler runs every 10 minutes
- Directories with last-modified time older than 60 minutes are deleted
- On app startup, any leftover files from a previous session are purged immediately

---

## Design constraints

- Font: Inter (Google Fonts), fallback: system-ui
- Palette: black (`#0a0a0a`) on white (`#ffffff`)
- No decorative graphics, no colour accents, no gradients
- The tool is the entire page — no nav, no footer clutter
- Mobile-first responsive layout
- Vanilla JS only — no frameworks

---

## Routes

| Method | Path | Description |
|---|---|---|
| GET | `/` | Serve index.html |
| POST | `/api/compress` | Accept GIF upload, return JSON result |
| GET | `/api/download/<session_id>/<filename>` | Serve compressed file for download |
| GET | `/health` | Health check endpoint |

---

## File structure

```
gif-compressor/
├── app.py
├── config.py
├── requirements.txt
├── BRIEF.md
├── routes/
│   ├── __init__.py
│   ├── compress.py
│   └── health.py
├── validators/
│   ├── __init__.py
│   └── file_validator.py
├── utils/
│   ├── __init__.py
│   ├── compressor.py
│   └── cleanup.py
├── templates/
│   └── index.html
├── static/
│   ├── css/styles.css
│   └── js/upload.js
└── uploads/
```
