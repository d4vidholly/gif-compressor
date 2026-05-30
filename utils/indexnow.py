import logging
import os
import requests

logger = logging.getLogger(__name__)


def ping(urls, host="giffit.io"):
    """Notify IndexNow about new or updated URLs. Call after deploying new blog posts."""
    key = os.environ.get("INDEXNOW_KEY", "")
    if not key:
        logger.warning("INDEXNOW_KEY not set — skipping IndexNow ping")
        return

    payload = {
        "host": host,
        "key": key,
        "keyLocation": f"https://{host}/{key}.txt",
        "urlList": urls if isinstance(urls, list) else [urls],
    }
    try:
        r = requests.post("https://api.indexnow.org/indexnow", json=payload, timeout=10)
        logger.info("IndexNow ping: %d for %d URLs", r.status_code, len(payload["urlList"]))
    except Exception as exc:
        logger.warning("IndexNow ping failed: %s", exc)
