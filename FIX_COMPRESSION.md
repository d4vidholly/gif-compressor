# GifFit — Compression Engine Fix

**Priority:** Do this before any frontend or freemium work. Everything else depends on the tool being fast.

**Root cause:** The current `compress_gif()` loop in `utils/compressor.py` steps the colour palette down one increment at a time (256 → 224 → 192 → ... → 32), re-quantizing all frames and writing the full GIF to disk on every iteration. For a file needing heavy compression this runs 23+ times. The profiler shows 95% of processing time is wasted on redundant iterations.

**Measured baseline (480×320, 24-frame GIF, target 256KB):**
- Total: 1.267s
- GIF write × 23 iterations: 0.742s (58%)
- Frame quantize × 344 calls: 0.470s (37%)

**Target after fixes:** under 200ms processing for the same file.

---

## Fix 1 — Rewrite the iterative loop (pure Python, no new deps)

**File:** `utils/compressor.py`

**What to change:**

Replace the current step-down loop with a pre-quantize + pick strategy:

1. On first call, quantize all frames at each of four fixed palette levels: 256, 128, 64, 32 colours. Store the four quantized frame sets in memory.
2. To hit a `target_bytes`: iterate through the four sets from most-compressed to least, write the GIF once per candidate, stop at the first one that fits.
3. If 32 colours still doesn't hit the target, fall through to the existing frame-dropping and dimension-scaling logic (keep that as-is).

This reduces worst-case iterations from 23+ down to 4, and typical cases (where 64 or 32 colours is enough) to 1–2 writes.

**Pseudocode:**

```python
PALETTE_LEVELS = [256, 128, 64, 32]

def compress_gif(input_path, output_path, target_bytes=None,
                 target_dimensions=None, config=None):

    img = Image.open(input_path)
    loop = img.info.get("loop", 0)
    original_frames, original_durations = _get_frames_and_durations(img)

    # Step 1: apply dimension resize if requested (Discord emoji = 128x128)
    if target_dimensions:
        original_frames = _resize_frames(original_frames, target_dimensions)

    working_frames = original_frames[:]
    working_durations = original_durations[:]
    frame_skip = 1
    scaled = False

    while True:
        # Pre-quantize all frames at each palette level — ONE pass per level
        quantized_sets = {
            n: _reduce_colors(working_frames, n)
            for n in PALETTE_LEVELS
        }

        # Try from most compressed (32) to least (256) to find smallest
        # that fits, OR from least to most to find best quality that fits
        # For target_bytes: try 64 first (usually enough), then 32
        candidates = [64, 32, 128, 256] if target_bytes else [256]

        hit = False
        for n_colors in candidates:
            frames_to_use = quantized_sets[n_colors]
            _save_gif(frames_to_use, working_durations, output_path, loop)

            if target_bytes is None or os.path.getsize(output_path) <= target_bytes:
                return {"success": True, "error": None,
                        "quality_warning": n_colors < 64,
                        "warning_reason": "Heavy colour reduction applied — check quality." if n_colors < 64 else ""}
            hit = False

        # All palette levels exhausted — try frame dropping
        if frame_skip < 4:
            frame_skip += 1
            working_frames, working_durations = _drop_frames(
                original_frames, original_durations, frame_skip)
            continue

        # Frame dropping maxed — scale dimensions as last resort
        if not scaled:
            scale = config.get("SCALE_FACTOR", 0.75) if config else 0.75
            working_frames = _scale_frames(original_frames, scale)
            working_durations = original_durations[:]
            frame_skip = 1
            scaled = True
            continue

        # All options exhausted — save best-effort (32 colours, scaled)
        best = _reduce_colors(working_frames, 32)
        _save_gif(best, working_durations, output_path, loop)
        return {"success": True, "error": None,
                "quality_warning": True,
                "warning_reason": "Could not fully reach target size — best effort applied."}
```

**Also add `_resize_frames()` function:**

```python
def _resize_frames(frames, target_dimensions):
    """
    Resize all frames to target_dimensions (w, h).
    Centre-crops to square first if the GIF is not already square,
    then resizes to target. Used for Discord emoji (128x128).
    """
    target_w, target_h = target_dimensions
    result = []
    for frame in frames:
        w, h = frame.size
        # Centre crop to square
        if w != h:
            side = min(w, h)
            left = (w - side) // 2
            top = (h - side) // 2
            frame = frame.crop((left, top, left + side, top + side))
        # Resize
        frame = frame.resize((target_w, target_h), Image.LANCZOS)
        result.append(frame.convert('P', palette=Image.ADAPTIVE, colors=256))
    return result
```

**Update function signature** — remove `quality` parameter (slider is being removed):

```python
def compress_gif(input_path, output_path, target_bytes=None,
                 target_dimensions=None, config=None):
```

---

## Fix 2 — Add gifsicle as primary engine (recommended, requires system package)

**File:** `utils/compressor.py`

**What to change:**

Add a `_compress_with_gifsicle()` function. If the `gifsicle` binary is available on the system, use it as the primary compression engine. Fall back to the fixed Pillow loop (Fix 1) if gifsicle is not available.

```python
import subprocess
import shutil

GIFSICLE_BIN = shutil.which("gifsicle")  # None if not installed


def _compress_with_gifsicle(input_path, output_path, target_bytes=None,
                             target_dimensions=None):
    """
    Use gifsicle binary for compression. Returns True on success.
    Two-pass strategy to hit target_bytes.
    """
    if not GIFSICLE_BIN:
        return False  # fallback to Pillow

    # Build resize arg for Discord emoji (128x128)
    resize_arg = []
    if target_dimensions:
        w, h = target_dimensions
        resize_arg = ["--resize-fit", f"{w}x{h}", "--resize-colors", "256"]

    if target_bytes is None:
        # Quality mode — single pass, mild optimisation
        cmd = [GIFSICLE_BIN, "--optimize=3", input_path, "-o", output_path]
        cmd[1:1] = resize_arg
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        return result.returncode == 0

    # Pass 1 — aggressive but not destructive
    cmd1 = [GIFSICLE_BIN, "--optimize=3", "--lossy=80", "--colors", "64",
            input_path, "-o", output_path]
    cmd1[1:1] = resize_arg
    subprocess.run(cmd1, capture_output=True, timeout=30)

    if os.path.exists(output_path) and os.path.getsize(output_path) <= target_bytes:
        return True

    # Pass 2 — heavier lossy, minimum colours
    cmd2 = [GIFSICLE_BIN, "--optimize=3", "--lossy=150", "--colors", "32",
            input_path, "-o", output_path]
    cmd2[1:1] = resize_arg
    subprocess.run(cmd2, capture_output=True, timeout=30)

    return os.path.exists(output_path)
```

**Update `compress_gif()` to try gifsicle first:**

```python
def compress_gif(input_path, output_path, target_bytes=None,
                 target_dimensions=None, config=None):

    # Try gifsicle first — 10x faster, better compression
    if GIFSICLE_BIN:
        success = _compress_with_gifsicle(
            input_path, output_path,
            target_bytes=target_bytes,
            target_dimensions=target_dimensions,
        )
        if success:
            compressed_size = os.path.getsize(output_path)
            quality_warning = target_bytes and compressed_size > target_bytes * 0.95
            return {
                "success": True,
                "error": None,
                "quality_warning": quality_warning,
                "warning_reason": "Could not fully reach target size." if quality_warning else "",
                "engine": "gifsicle",
            }

    # Fallback: fixed Pillow loop (Fix 1)
    return _compress_with_pillow(
        input_path, output_path,
        target_bytes=target_bytes,
        target_dimensions=target_dimensions,
        config=config,
    )
```

**Installation on the server:**

```bash
# Ubuntu / Debian (Railway, Render, Fly.io all support apt)
apt-get install -y gifsicle

# Add to Dockerfile if containerised:
RUN apt-get update && apt-get install -y gifsicle && rm -rf /var/lib/apt/lists/*

# Verify:
gifsicle --version
# gifsicle 1.94 (or similar)
```

---

## Fix 3 — Update routes/compress.py

**File:** `routes/compress.py`

**What to change:**

1. Remove `quality` parameter from the compress endpoint — slider is gone.
2. Pass `target_dimensions` to `compress_gif()` based on the preset.
3. Return dimensions in the response.

```python
@compress_bp.route("/compress", methods=["POST"])
def compress():
    file = request.files.get("file")
    error, status = validate_gif_upload(file, current_app.config)
    if error:
        return jsonify({"error": error}), status

    preset_key = request.form.get("preset")
    if not preset_key or preset_key not in current_app.config["PRESETS"]:
        return jsonify({"error": "Select a platform preset before compressing."}), 400

    preset = current_app.config["PRESETS"][preset_key]
    target_bytes = preset["max_bytes"]
    target_dimensions = preset.get("dimensions")  # None for discord, (128,128) for discord_emoji

    # ... save file, create session_dir as before ...

    # Get original dimensions
    from PIL import Image as PILImage
    with PILImage.open(original_path) as img:
        orig_w, orig_h = img.size

    result = compress_gif(
        input_path=original_path,
        output_path=compressed_path,
        target_bytes=target_bytes,
        target_dimensions=target_dimensions,
        config=current_app.config,
    )

    if not result["success"]:
        return jsonify({"error": result["error"]}), 500

    # Get output dimensions
    with PILImage.open(compressed_path) as img:
        out_w, out_h = img.size

    compressed_size = os.path.getsize(compressed_path)
    original_size = os.path.getsize(original_path)
    reduction_pct = round((1 - compressed_size / original_size) * 100, 1)

    return jsonify({
        "session_id": session_id,
        "original_size": original_size,
        "original_dimensions": [orig_w, orig_h],
        "compressed_size": compressed_size,
        "compressed_dimensions": [out_w, out_h],
        "reduction_pct": reduction_pct,
        "quality_warning": result.get("quality_warning", False),
        "warning_reason": result.get("warning_reason", ""),
        "engine": result.get("engine", "pillow"),
        "download_url": "/api/download/{}/compressed.gif".format(session_id),
    })
```

---

## Fix 4 — Update config.py

**File:** `config.py`

Update PRESETS to include dimension specs and remove Slack/Web presets:

```python
PRESETS = {
    "discord_emoji": {
        "max_bytes":  256 * 1024,       # 256 KB
        "dimensions": (128, 128),        # required by Discord
    },
    "discord": {
        "max_bytes":  8 * 1024 * 1024,  # 8 MB
        "dimensions": None,              # preserve original dimensions
    },
}

# Tiered upload limits
# Pillow fallback is memory-hungry (decompresses all frames to RGBA).
# A 50 MB GIF in Pillow can consume 300-500 MB RAM on the server.
# Gifsicle streams compressed data — far lower memory footprint.
MAX_CONTENT_LENGTH          = 200 * 1024 * 1024   # 200 MB hard Flask ceiling
MAX_UPLOAD_BYTES_FREE_PILLOW   =  35 * 1024 * 1024  # 35 MB  (Pillow fallback)
MAX_UPLOAD_BYTES_FREE_GIFSICLE =  50 * 1024 * 1024  # 50 MB  (gifsicle primary)
MAX_UPLOAD_BYTES_PRO           = 150 * 1024 * 1024  # 150 MB (pro tier)

# Compression engine
PALETTE_LEVELS = [256, 128, 64, 32]   # Pillow pre-quantize levels
SCALE_FACTOR   = 0.75                  # dimension scale-down as last resort
```

Remove these from config entirely:
- `PALETTE_START`, `PALETTE_MIN`, `PALETTE_STEP` — replaced by `PALETTE_LEVELS`
- `COMPRESS_RATE_LIMIT_BURST`, `COMPRESS_RATE_LIMIT_HOURLY` — rate limiting on single files removed

**Update `validators/file_validator.py`** to check the correct limit based on tier and engine:

```python
def validate_gif_upload(file, config, is_pro=False):
    # ... type checks ...
    from utils.compressor import GIFSICLE_BIN
    if is_pro:
        max_bytes = config["MAX_UPLOAD_BYTES_PRO"]
    elif GIFSICLE_BIN:
        max_bytes = config["MAX_UPLOAD_BYTES_FREE_GIFSICLE"]
    else:
        max_bytes = config["MAX_UPLOAD_BYTES_FREE_PILLOW"]

    if file_size > max_bytes:
        limit_mb = max_bytes // (1024 * 1024)
        return f"Material exceeds intake tolerance. Max {limit_mb} MB.", 413
    return None, None
```

---

## Fix 5 — Production server (Gunicorn)

**File:** `requirements.txt`

Add:
```
gunicorn==21.2.0
```

**New file: `Procfile`** (for Railway / Render / Heroku deployment):
```
web: gunicorn "app:create_app()" --workers 4 --bind 0.0.0.0:$PORT --timeout 60
```

The Flask dev server is single-threaded — one compression job blocks all other users. Gunicorn with 4 workers allows 4 concurrent compressions at zero extra cost on any PaaS.

---

## Expected results after all fixes

| Scenario | Before | After (Pillow fix) | After (gifsicle) |
|---|---|---|---|
| Discord emoji 128×128 | 15ms + no resize | 10ms + resize | ~5ms + resize |
| Chat GIF 400×300 20fr | 82ms | 25ms | ~15ms |
| Large GIF 600×400 30fr | 273ms | 70ms | ~30ms |
| Heavy GIF 800×600 40fr | 800ms | 200ms | ~80ms |
| End-to-end 5MB file | ~2.5s | ~1.4s | ~1.0s |

Note: network upload remains the dominant cost (~800ms for 5MB on 50Mbps). WASM (v2) eliminates this entirely.

---

## Definition of done

- [ ] `compress_gif()` no longer accepts a `quality` parameter
- [ ] Loop runs maximum 4 iterations for target-size compression (verify with logging)
- [ ] Discord emoji preset resizes output to exactly 128×128px
- [ ] `routes/compress.py` returns `original_dimensions` and `compressed_dimensions`
- [ ] `routes/compress.py` returns `quality_warning` bool and `warning_reason` string
- [ ] If gifsicle binary present: used as primary engine, confirmed in `engine` response field
- [ ] If gifsicle absent: Pillow fallback runs cleanly, no errors
- [ ] Config PRESETS updated to discord + discord_emoji only, both with dimension spec
- [ ] `gunicorn` in requirements.txt and Procfile present
- [ ] All existing single-file tests still pass

---

## Files changed

| File | Change |
|---|---|
| `utils/compressor.py` | Rewrite loop, add `_resize_frames()`, add `_compress_with_gifsicle()`, remove `quality` param |
| `routes/compress.py` | Remove quality field, pass dimensions, return dimensions + quality warning |
| `config.py` | Update PRESETS to 2 entries with dimension specs, remove rate limit and palette config |
| `requirements.txt` | Add gunicorn |
| `Procfile` | New file — production server command |
