import io
import os
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image, ImageSequence

_PARALLEL_THRESHOLD = 30
_PALETTE_MIN = 32
_SCALES = [1.0, 0.75, 0.5, 0.25]
_SKIPS = [2, 4, 8]


def _get_frames_and_durations(img):
    frames, durations = [], []
    for frame in ImageSequence.Iterator(img):
        frames.append(frame.copy())
        durations.append(frame.info.get("duration", 100))
    return frames, durations


def _parallel(fn, items):
    if len(items) < _PARALLEL_THRESHOLD:
        return [fn(x) for x in items]
    with ThreadPoolExecutor() as ex:
        return list(ex.map(fn, items))


def _to_rgba(frames):
    return _parallel(lambda f: f.convert("RGBA"), frames)


def _quantize(rgba_frames, n_colors, frame_cb=None):
    def _one(f):
        return f.quantize(colors=n_colors, method=Image.Quantize.FASTOCTREE, dither=0)
    if frame_cb is None:
        return _parallel(_one, rgba_frames)
    # Tracked variant: fire frame_cb after each frame via as_completed.
    # as_completed yields in the calling thread, so frame_cb has no concurrency concerns.
    n = len(rgba_frames)
    if n < _PARALLEL_THRESHOLD:
        results = []
        for f in rgba_frames:
            results.append(_one(f))
            frame_cb(len(results), n)
        return results
    results = [None] * n
    done = 0
    with ThreadPoolExecutor() as ex:
        futures = {ex.submit(_one, f): i for i, f in enumerate(rgba_frames)}
        for fut in as_completed(futures):
            results[futures[fut]] = fut.result()
            done += 1
            frame_cb(done, n)
    return results


def _drop_frames(rgba_frames, durations, keep_every_n):
    return rgba_frames[::keep_every_n], [d * keep_every_n for d in durations[::keep_every_n]]


def _resize_frames(rgba_frames, target_dimensions):
    """Centre-crop to square then resize to target_dimensions."""
    target_w, target_h = target_dimensions
    def _one(frame):
        w, h = frame.size
        if w != h:
            side = min(w, h)
            left, top = (w - side) // 2, (h - side) // 2
            frame = frame.crop((left, top, left + side, top + side))
        return frame.resize((target_w, target_h), Image.LANCZOS)
    return _parallel(_one, rgba_frames)


def _scale_frames(rgba_frames, scale):
    def _one(f):
        w, h = f.size
        return f.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    return _parallel(_one, rgba_frames)


def _probe(frames, durations, palette, loop, frame_cb=None):
    """Quantize and encode to memory. Returns (size, bytes)."""
    buf = io.BytesIO()
    quantized = _quantize(frames, palette, frame_cb=frame_cb)
    quantized[0].save(
        buf, format="GIF", save_all=True, append_images=quantized[1:],
        optimize=True, duration=durations, loop=loop, disposal=2,
    )
    data = buf.getvalue()
    return len(data), data


def _binary_search(frames, durations, loop, target_bytes, floor_data, probe_fn=None):
    """Return bytes of the highest-palette encode that fits within target_bytes."""
    if probe_fn is None:
        probe_fn = _probe
    best = floor_data
    lo, hi = _PALETTE_MIN + 1, 255
    while lo <= hi:
        mid = (lo + hi) // 2
        size, data = probe_fn(frames, durations, mid, loop)
        if size <= target_bytes:
            best = data
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def compress_gif(input_path, output_path, target_bytes, target_dimensions=None, progress_cb=None):
    """Compress a GIF to fit within target_bytes. Returns result dict."""
    def _report(pct, step="Optimising"):
        if progress_cb:
            progress_cb(pct, step)

    try:
        original_size = os.path.getsize(input_path)
        if original_size <= target_bytes:
            shutil.copy2(input_path, output_path)
            return {"success": True, "error": None, "quality_warning": False,
                    "warning_reason": "", "engine": "pillow", "output_dimensions": None}

        _report(5, "Loading")
        img = Image.open(input_path)
        loop = img.info.get("loop", 0)
        original_frames, original_durations = _get_frames_and_durations(img)

        if not original_frames:
            return {"success": False, "error": "GIF contains no frames."}

        _report(10, "Preparing")
        rgba_source = _to_rgba(original_frames)
        if target_dimensions:
            rgba_source = _resize_frames(rgba_source, target_dimensions)

        _report(15, "Optimising")

        # Each probe advances the bar via an exponential curve (15–94%).
        # Probe count is not known upfront, so this gives diminishing returns
        # per probe, asymptoting toward 94% until the job completes.
        probe_count = [0]

        def _probing(frames, durations, palette, loop_val):
            n = probe_count[0]
            pct_start = 15 + int(80 * (1 - 0.7 ** n)) if n > 0 else 15
            pct_end   = min(15 + int(80 * (1 - 0.7 ** (n + 1))), 94)
            step = max(1, len(frames) // 8)  # ~8 sub-reports per probe during quantize

            def _frame_cb(done, total):
                if done % step == 0:
                    # Quantize is ~70% of probe time; interpolate through that share
                    sub_pct = pct_start + int((pct_end - pct_start) * 0.7 * done / total)
                    _report(sub_pct, "Optimising")

            result = _probe(frames, durations, palette, loop_val, frame_cb=_frame_cb)
            probe_count[0] += 1
            _report(pct_end, "Optimising")
            return result

        best_data = None

        for scale in _SCALES:
            scaled_rgba = _scale_frames(rgba_source, scale) if scale < 1.0 else rgba_source
            base_dur = list(original_durations)

            size, data = _probing(scaled_rgba, base_dur, 256, loop)
            if size <= target_bytes:
                best_data = data
                break

            floor_size, floor_data = _probing(scaled_rgba, base_dur, _PALETTE_MIN, loop)
            if floor_size <= target_bytes:
                best_data = _binary_search(scaled_rgba, base_dur, loop, target_bytes, floor_data, probe_fn=_probing)
                break

            needed_skip = int(floor_size / target_bytes) + 1
            candidate_skips = [s for s in _SKIPS if s >= needed_skip]

            for skip in candidate_skips:
                frames, durations = _drop_frames(scaled_rgba, original_durations, skip)

                size, data = _probing(frames, durations, 256, loop)
                if size <= target_bytes:
                    best_data = data
                    break

                floor_size, floor_data = _probing(frames, durations, _PALETTE_MIN, loop)
                if floor_size > target_bytes:
                    continue

                best_data = _binary_search(frames, durations, loop, target_bytes, floor_data, probe_fn=_probing)
                break
            else:
                continue
            break

        if best_data is None or len(best_data) >= original_size:
            shutil.copy2(input_path, output_path)
            out_dims = None
        else:
            with open(output_path, "wb") as f:
                f.write(best_data)
            with Image.open(io.BytesIO(best_data)) as out_img:
                out_dims = list(out_img.size)

        final_size = os.path.getsize(output_path)
        quality_warning = final_size > target_bytes
        return {
            "success": True,
            "error": None,
            "quality_warning": quality_warning,
            "warning_reason": "Could not fully reach target size — best effort applied." if quality_warning else "",
            "engine": "pillow",
            "output_dimensions": out_dims,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
