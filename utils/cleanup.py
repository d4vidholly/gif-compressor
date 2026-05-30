import os
import shutil
import time
import logging
from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)


def cleanup_old_files(upload_folder, max_age_minutes=60):
    """
    Delete any session directories in upload_folder whose last-modified
    time is older than max_age_minutes. If max_age_minutes=0, delete all.
    """
    if not os.path.isdir(upload_folder):
        return

    now = time.time()
    cutoff = now - (max_age_minutes * 60)
    removed = 0

    for entry in os.scandir(upload_folder):
        if entry.is_dir():
            try:
                mtime = entry.stat().st_mtime
                if mtime < cutoff:
                    shutil.rmtree(entry.path, ignore_errors=True)
                    removed += 1
            except Exception as e:
                logger.warning(f"Cleanup error for {entry.path}: {e}")

    if removed:
        logger.info(f"Cleanup: removed {removed} session(s) from {upload_folder}")


def start_cleanup_scheduler(upload_folder, interval_minutes=10, max_age_minutes=60):
    """Start a background scheduler that runs cleanup periodically."""
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(
        func=cleanup_old_files,
        trigger="interval",
        minutes=interval_minutes,
        kwargs={"upload_folder": upload_folder, "max_age_minutes": max_age_minutes},
        id="cleanup_job",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        f"Cleanup scheduler started: every {interval_minutes}min, "
        f"max file age {max_age_minutes}min"
    )
    return scheduler
