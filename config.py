import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    # Upload settings
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

    # Hard Flask limit — reject before any processing (pro ceiling)
    MAX_CONTENT_LENGTH = 200 * 1024 * 1024  # 200 MB

    # Per-tier upload limits (enforced in validator)
    # Pillow fallback: 35 MB (memory safety — Pillow loads all frames into RAM)
    # Gifsicle primary: 50 MB free, 150 MB pro (gifsicle streams, uses far less RAM)
    MAX_UPLOAD_BYTES_FREE_PILLOW   =  35 * 1024 * 1024   # 35 MB
    MAX_UPLOAD_BYTES_FREE_GIFSICLE =  50 * 1024 * 1024   # 50 MB
    MAX_UPLOAD_BYTES_PRO           = 150 * 1024 * 1024   # 150 MB
    MAX_UPLOAD_BYTES_HARD          = 200 * 1024 * 1024   # 200 MB — absolute ceiling

    # File validation
    ALLOWED_EXTENSIONS = {"gif"}
    ALLOWED_MIME_TYPES = {"image/gif"}

    # File validation (used by validator)
    MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

    # Pro API keys — comma-separated in PRO_API_KEYS env var, empty = no pro users
    PRO_API_KEYS = set(filter(None, os.environ.get("PRO_API_KEYS", "").split(",")))

    # Cleanup scheduler
    CLEANUP_INTERVAL_MINUTES = 10
    FILE_MAX_AGE_MINUTES = 60
    TEMPLATES_AUTO_RELOAD = True

    # Platform presets — two Discord functions only
    PRESETS = {
        "discord_emoji": {
            "max_bytes":  256 * 1024,    # 256 KB
            "dimensions": (128, 128),     # required by Discord, centre-cropped
        },
        "discord": {
            "max_bytes":  8 * 1024 * 1024,  # 8 MB
            "dimensions": None,              # preserve original dimensions
        },
    }

    # Compression engine
    # PALETTE_LEVELS used by Pillow fallback (pre-quantize + binary search)
    PALETTE_LEVELS = [256, 128, 64, 32]
    SCALE_FACTOR   = 0.75  # dimension scale-down as last resort

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-prod")
    DEBUG      = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
