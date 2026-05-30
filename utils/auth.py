from flask import current_app, request as flask_request


def is_pro_request(req=None):
    if req is None:
        req = flask_request
    key = req.headers.get("X-GifFit-Key", "").strip()
    keys = current_app.config.get("PRO_API_KEYS", set())
    return bool(key) and key in keys
