# GifFit — Change List for Claude Code

Priority order. Complete sections top to bottom. Do not start a new section until the current one passes.

---

## Context

GifFit is a Discord-first GIF compression tool. Two core functions. Blueprint dark UI. Flask backend, Pillow compression, vanilla JS frontend.

The research shows:
- Primary user: server admin compressing emoji (256KB + 128×128px)
- Secondary user: regular user sharing a GIF in chat (8MB)
- Upgrade trigger: batch processing — this is the entire freemium model
- Slack is a weaker use case — removed from scope for now. Two functions done well beats four done poorly.

All files are in `C:\Users\dvidh\OneDrive\Documents\Cowork Playground\ImageTools\`

---

## Function scope (confirmed)

### Function 1 — GIF Compressor
Target: Discord chat upload limit
Output spec: under 8 MB, original dimensions preserved
Preset label: `DISCORD UPLOAD — 8 MB CLEARANCE`

### Function 2 — Discord Emoji
Target: Discord custom animated emoji
Output spec: under 256 KB AND resized to exactly 128×128 px
Preset label: `DISCORD EMOJI — 256 KB TOLERANCE`

### Function 3 (optional — decide before building)
Options to consider:
- Discord Sticker: 320×320px, under 512KB — same pipeline, different spec. High relevance to server admins.
- Stay at two functions and do them exceptionally well.
Recommendation: launch with two. Add sticker in v1.1 once the core pipeline is proven.

Remove from scope: Slack emoji, Web preset. These dilute the Discord positioning.

---

## Section 1 — Compressor fixes (backend)

These are correctness issues. The tool does not work correctly without them.

### 1.1 Add dimension resizing to Discord Emoji preset

**File:** `utils/compressor.py`

The Discord Emoji preset must resize GIFs to exactly 128×128 pixels before compression. Currently only file size is targeted — dimensions are untouched. Discord will reject any emoji that is not 128×128 regardless of file size.

Implementation:
- Add a `target_dimensions` parameter to `compress_gif()`
- When set, resize all frames to that dimension using `Image.LANCZOS` before palette reduction
- For 128×128: crop to square first (centre crop), then resize — do not stretch
- Apply resizing before the compression loop, not inside it
- The Discord Upload preset (8MB) should NOT resize — preserve original dimensions

```python
# New signature
def compress_gif(input_path, output_path, quality=None, target_bytes=None,
                 target_dimensions=None, config=None):
```

Update `config.py` PRESETS to include dimension spec:
```python
PRESETS = {
    "discord":        {"max_bytes": 8 * 1024 * 1024,  "dimensions": None},
    "discord_emoji":  {"max_bytes": 256 * 1024,        "dimensions": (128, 128)},
}
```

Update `routes/compress.py` to pass dimensions through to the compressor.

---

### 1.2 Add quality degradation detection and warning

**File:** `utils/compressor.py`, `routes/compress.py`

After compression, detect if heavy compression was applied and return a warning flag with the JSON response.

Triggers for warning:
- Final palette is below 64 colours (heavy colour reduction applied)
- Dimensions were scaled down (not just resized to target_dimensions — scaled as last resort)
- Reduction percentage exceeds 90%

Add to the compress function return dict:
```python
return {
    "success": True,
    "error": None,
    "quality_warning": True,  # or False
    "warning_reason": "Heavy colour reduction applied — check output quality before uploading."
}
```

Add `quality_warning` and `warning_reason` to the JSON response from `/api/compress`.

---

### 1.3 Remove quality/slider mode from compressor

**File:** `utils/compressor.py`, `routes/compress.py`

The quality slider is being removed from the UI. Remove the slider-mode compression path (`quality` parameter → `_quality_to_colors()`). All compressions must use a preset with `target_bytes`. If no preset is provided, return a 400 error: `"Select a platform preset before compressing."`. This simplifies the compressor and removes a code path that will no longer be reachable.

---

### 1.4 Return dimensions in compress response

**File:** `routes/compress.py`

Add original and output dimensions to the JSON response:

```python
return jsonify({
    "session_id": session_id,
    "original_size": original_size,
    "original_dimensions": [width, height],   # add this
    "compressed_size": compressed_size,
    "compressed_dimensions": [out_w, out_h],   # add this
    "reduction_pct": reduction_pct,
    "quality_warning": result["quality_warning"],
    "warning_reason": result.get("warning_reason", ""),
    "download_url": "...",
})
```

Use Pillow to read dimensions from the saved output file.

---

## Section 2 — Freemium system (backend)

Batch is the paywall. Single-file compression is always free, unlimited. No rate limiting on single files — remove the existing 10/hour limit entirely.

### 2.1 Remove single-file rate limiting

**File:** `app.py`, `routes/compress.py`

Remove `Flask-Limiter` from the single-file compress route. Delete the `@limiter.limit()` decorators from `compress_bp`. Remove `COMPRESS_RATE_LIMIT_BURST` and `COMPRESS_RATE_LIMIT_HOURLY` from `config.py`. Flask-Limiter can remain installed for potential future use but should not be applied to any route at launch.

---

### 2.2 Add batch compress endpoint (free tier returns locked response)

**File:** `routes/compress.py`

Add a new route:

```
POST /api/compress/batch
```

Accepts: `multipart/form-data` with multiple `files[]` and a `preset` field.

Behaviour:
- Free tier (no valid API key in header): return HTTP 402 with JSON:
  ```json
  {
    "error": "batch_locked",
    "message": "Batch processing requires GifFit Pro.",
    "upgrade_url": "/upgrade"
  }
  ```
- Pro tier (valid `X-GifFit-Key` header): process up to 50 files, return array of results

This endpoint can return 402 immediately for now — the full batch processing logic comes in Section 2.3.

---

### 2.3 Implement batch processing logic (pro tier)

**File:** `utils/compressor.py`, `routes/compress.py`

When a valid pro API key is present, process all files sequentially (not in parallel — Pillow is not thread-safe with GIFs):

```python
results = []
for file in files:  # up to 50
    # validate, compress, collect result
    results.append({
        "filename": original_filename,
        "original_size": ...,
        "compressed_size": ...,
        "reduction_pct": ...,
        "quality_warning": ...,
        "download_url": ...,
    })
return jsonify({"results": results, "total": len(results)})
```

Return a ZIP download URL (generate a ZIP of all compressed files in a shared session directory).

---

### 2.4 API key validation (simple implementation)

**File:** `config.py`, new `utils/auth.py`

For launch, implement a simple static API key system — no database required:

```python
# config.py
PRO_API_KEYS = set(os.environ.get("PRO_API_KEYS", "").split(","))
```

```python
# utils/auth.py
def is_pro_request(request):
    key = request.headers.get("X-GifFit-Key", "")
    return key in current_app.config["PRO_API_KEYS"]
```

Pro keys are issued manually for now (set via environment variable on the server). This is the minimum viable pro tier — replace with Stripe + database in v2.

---

## Section 3 — Frontend changes

### 3.1 Remove quality slider entirely

**Files:** `templates/index.html`, `static/js/upload.js`, `static/css/styles.css`

- Delete the quality slider HTML block (`<div class="control-row">` containing `quality-slider`)
- Delete `qualitySlider`, `qualityValue` references in `upload.js`
- Delete associated CSS rules for `.quality-slider`, `.slider-row`, `.quality-value`
- Remove `quality` field from the FormData sent to `/api/compress`

---

### 3.2 Reorder and rename presets to Discord-only

**File:** `templates/index.html`, `config.py`

Remove Slack Emoji and Web presets. Update config and UI to two presets only:

```html
<button class="preset-btn" data-preset="discord_emoji">
  DISCORD EMOJI<br>
  <span>256 KB tolerance</span>
</button>
<button class="preset-btn" data-preset="discord">
  DISCORD UPLOAD<br>
  <span>8 MB clearance</span>
</button>
```

Discord Emoji must appear first — it is the primary use case.

Make preset buttons full-width, large, and the dominant UI element after file drop. These should not look like secondary options.

---

### 3.3 Show dimensions in before/after panels

**File:** `templates/index.html`, `static/js/upload.js`

Before panel: read dimensions from the image after FileReader loads it, display as: `5.4 MB · 600×400`
After panel: use the `compressed_dimensions` from the API response: `243 KB · 128×128`

Update `upload.js` to extract image dimensions from the loaded image element:
```js
beforeImg.onload = () => {
  beforeSize.textContent = formatBytes(file.size) + ' · ' + beforeImg.naturalWidth + '×' + beforeImg.naturalHeight;
};
```

---

### 3.4 Add quality warning display

**File:** `templates/index.html`, `static/js/upload.js`, `static/css/styles.css`

After compression, if `data.quality_warning === true`, show a warning bar between the comparison and the download bar:

```html
<div class="quality-warning hidden" id="quality-warning">
  <i class="ti ti-alert-triangle"></i>
  <span id="quality-warning-text"></span>
</div>
```

Style: amber left-border, small, not alarming — informational. "Heavy compression applied — check quality before uploading."

In `upload.js`:
```js
if (data.quality_warning) {
    qualityWarning.querySelector('#quality-warning-text').textContent = data.warning_reason;
    qualityWarning.classList.remove('hidden');
}
```

---

### 3.5 Add locked batch zone with upgrade CTA

**File:** `templates/index.html`, `static/css/styles.css`

Below the single-file tool, add a visually distinct batch section that is permanently locked on the free tier:

```html
<div class="batch-zone locked">
  <div class="batch-lock-overlay">
    <i class="ti ti-lock"></i>
    <p>BATCH PROCESSING</p>
    <p class="muted">Drop up to 50 GIFs (up to 150 MB each). All compressed to spec in one run.</p>
    <a href="/upgrade" class="upgrade-btn">Upgrade to GifFit Pro</a>
  </div>
  <div class="batch-drop-area">
    <!-- greyed out, non-interactive -->
  </div>
</div>
```

Styling: same blueprint aesthetic but at 40% opacity with a lock icon overlay. The user can see exactly what they'd get — they just can't use it. This is the conversion moment.

---

### 3.6 Remember last-used preset (localStorage)

**File:** `static/js/upload.js`

When a preset button is clicked, store it:
```js
localStorage.setItem('giffit_last_preset', btn.dataset.preset);
```

On page load, re-select the stored preset:
```js
const lastPreset = localStorage.getItem('giffit_last_preset');
if (lastPreset) {
    document.querySelector(`[data-preset="${lastPreset}"]`)?.classList.add('active');
    activePreset = lastPreset;
}
```

---

## Section 4 — UI (not yet explored — desktop first, mobile later)

These are tracked here but should not be implemented until Sections 1–3 are complete and tested on desktop.

- [ ] Test current layout on 375px viewport (iPhone SE) — document what breaks
- [ ] Make preset buttons stack vertically on mobile
- [ ] Simplify/hide pipeline animation on screens under 600px wide (show a simple progress bar instead)
- [ ] Before/after panels stack vertically on mobile (currently side-by-side)
- [ ] Batch zone readable and clearly locked on mobile
- [ ] Touch-friendly tap targets (minimum 44px height on interactive elements)

---

## Section 5 — /upgrade page (stub)

Create a basic `/upgrade` route and `templates/upgrade.html` that explains the Pro tier. Does not need payment integration at this stage — just the value proposition and a contact/waitlist form.

Content:
- What's included in Pro: batch up to 50 GIFs, API access, priority processing
- Price: TBD (placeholder: "£4.99/month or £39.99/year")
- CTA: email capture / waitlist ("Join the waitlist — we'll email you when Pro launches")

---

## Files to touch — summary

| File | Changes |
|---|---|
| `utils/compressor.py` | Dimension resizing, quality warning detection, remove slider mode |
| `config.py` | Update PRESETS to include dimensions, remove rate limit config |
| `routes/compress.py` | Return dimensions + quality warning, add batch endpoint, remove rate limiting |
| `utils/auth.py` | New file — API key validation |
| `app.py` | Remove Flask-Limiter from compress blueprint |
| `templates/index.html` | Remove slider, reorder presets, add batch zone, add quality warning element, add dimensions to panels |
| `static/js/upload.js` | Remove slider logic, add quality warning display, add localStorage preset memory, add dimensions to panels |
| `static/css/styles.css` | Remove slider styles, add batch zone styles, add quality warning styles, make preset buttons prominent |
| `templates/upgrade.html` | New file — Pro tier landing page |

---

## Definition of done

- [ ] Discord Emoji preset resizes output to exactly 128×128px
- [ ] Quality warning appears when compression degrades significantly  
- [ ] Quality slider is gone — no trace in HTML, JS, or CSS
- [ ] Only two presets shown: Discord Emoji (first) and Discord Upload
- [ ] Before/after shows dimensions alongside file size
- [ ] Single-file compression has no rate limit
- [ ] `/api/compress/batch` returns 402 with upgrade message for free tier
- [ ] Batch zone visible on homepage, locked, with /upgrade link
- [ ] `/upgrade` page exists and is reachable
- [ ] Last-used preset remembered across page refreshes
- [ ] All existing single-file compression functionality still works
