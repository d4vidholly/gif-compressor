import os


def validate_gif_upload(file, config):
    """
    Validates an incoming file upload.
    Returns (error_message, http_status) or (None, None) if valid.
    """
    if file is None or file.filename == "":
        return "No file provided.", 400

    # Extension check
    ext = os.path.splitext(file.filename)[1].lower().lstrip(".")
    if ext not in config["ALLOWED_EXTENSIONS"]:
        return "Only GIF files are supported.", 415

    # MIME type check (read first 6 bytes for GIF magic header)
    header = file.stream.read(6)
    file.stream.seek(0)

    if not (header[:3] == b"GIF" and header[3:6] in (b"87a", b"89a")):
        return "File does not appear to be a valid GIF.", 415

    # Size check — read content-length header first to avoid reading whole file
    file.stream.seek(0, 2)  # seek to end
    file_size = file.stream.tell()
    file.stream.seek(0)

    max_bytes = config["MAX_UPLOAD_BYTES"]
    if file_size > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        return f"File too large. Maximum size is {max_mb} MB.", 413

    return None, None
