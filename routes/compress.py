import json
import os
import threading
import uuid
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from PIL import Image

from validators.file_validator import validate_gif_upload
from utils.compressor import compress_gif
from utils.auth import is_pro_request

compress_bp = Blueprint("compress", __name__, url_prefix="/api")


def _write_status(path, data):
    # Direct write — OneDrive locks the target file during sync, breaking
    # atomic rename (os.replace) with "Access is denied" on Windows.
    # status.json is polled every 2s so the partial-read window is negligible.
    with open(path, "w") as f:
        json.dump(data, f)


def _compression_worker(session_dir, original_path, compressed_path,
                         target_bytes, target_dimensions,
                         original_size, orig_w, orig_h, original_frame_count):
    status_path = os.path.join(session_dir, "status.json")

    def _progress(pct, step):
        _write_status(status_path, {"state": "processing", "progress": pct, "step": step})

    try:
        result = compress_gif(
            input_path=original_path,
            output_path=compressed_path,
            target_bytes=target_bytes,
            target_dimensions=target_dimensions,
            progress_cb=_progress,
        )

        if not result["success"]:
            _write_status(status_path, {"state": "error", "error": result["error"]})
            return

        compressed_size = os.path.getsize(compressed_path)
        reduction_pct = round((1 - compressed_size / original_size) * 100, 1)

        out_w, out_h = result.get("output_dimensions") or [orig_w, orig_h]

        session_id = os.path.basename(session_dir)
        _write_status(status_path, {
            "state": "done",
            "result": {
                "session_id": session_id,
                "original_size": original_size,
                "original_dimensions": [orig_w, orig_h],
                "original_frame_count": original_frame_count,
                "compressed_size": compressed_size,
                "compressed_dimensions": [out_w, out_h],
                "reduction_pct": reduction_pct,
                "quality_warning": result.get("quality_warning", False),
                "warning_reason": result.get("warning_reason", ""),
                "engine": result.get("engine", "pillow"),
                "download_url": f"/api/download/{session_id}/compressed.gif",
                "final_palette": result.get("final_palette"),
                "final_frame_count": result.get("final_frame_count"),
            },
        })
    except Exception as e:
        _write_status(status_path, {"state": "error", "error": str(e)})


@compress_bp.route("/compress", methods=["POST"])
def compress():
    file = request.files.get("file")
    error, status = validate_gif_upload(file, current_app.config)
    if error:
        return jsonify({"error": error}), status

    preset_key = request.form.get("preset")
    if not preset_key or preset_key not in current_app.config["PRESETS"]:
        return jsonify({"error": "Select a platform preset before compressing."}), 400

    preset_config = current_app.config["PRESETS"][preset_key]
    target_bytes = preset_config["max_bytes"]
    target_dimensions = preset_config.get("dimensions")

    session_id = str(uuid.uuid4())
    session_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], session_id)
    os.makedirs(session_dir, exist_ok=True)

    original_path = os.path.join(session_dir, "original.gif")
    compressed_path = os.path.join(session_dir, "compressed.gif")

    file.save(original_path)
    original_size = os.path.getsize(original_path)

    with Image.open(original_path) as img:
        orig_w, orig_h = img.size
        original_frame_count = getattr(img, 'n_frames', 1)

    status_path = os.path.join(session_dir, "status.json")
    _write_status(status_path, {
        "state": "processing", "progress": 0, "step": "Starting",
        "original_frame_count": original_frame_count,
    })

    thread = threading.Thread(
        target=_compression_worker,
        args=(session_dir, original_path, compressed_path,
              target_bytes, target_dimensions,
              original_size, orig_w, orig_h, original_frame_count),
        daemon=True,
    )
    thread.start()

    return jsonify({
        "session_id": session_id,
        "status_url": f"/api/status/{session_id}",
    }), 202


@compress_bp.route("/compress/batch", methods=["POST"])
def compress_batch():
    if not is_pro_request(request):
        return jsonify({
            "error": "batch_locked",
            "message": "Batch processing requires GifFit Pro.",
            "upgrade_url": "/upgrade",
        }), 402
    # Pro batch logic — Section 2.3
    return jsonify({"error": "not_implemented"}), 501


@compress_bp.route("/status/<session_id>")
def status(session_id):
    if not session_id.replace("-", "").isalnum():
        return jsonify({"error": "Invalid request."}), 400

    status_path = os.path.join(
        current_app.config["UPLOAD_FOLDER"], session_id, "status.json"
    )

    if not os.path.isfile(status_path):
        return jsonify({"error": "Session not found."}), 404

    try:
        with open(status_path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        # File mid-write — omit progress so the client holds its current bar position
        return jsonify({"state": "processing"})

    return jsonify(data)


@compress_bp.route("/download/<session_id>/<filename>")
def download(session_id, filename):
    if not session_id.replace("-", "").isalnum() or filename != "compressed.gif":
        return jsonify({"error": "Invalid request."}), 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    session_dir = os.path.join(upload_folder, session_id)

    if not os.path.isdir(session_dir):
        return jsonify({"error": "File not found or expired."}), 404

    return send_from_directory(
        session_dir,
        filename,
        as_attachment=True,
        download_name="compressed.gif",
    )
