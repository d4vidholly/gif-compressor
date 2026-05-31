"""
Playwright end-to-end tests for GifFit.

Starts a Flask dev server on port 5001 so it doesn't clash with the normal
port 5000 dev server. Uses test.gif (8 KB) for fast compression runs.
"""
import os
import subprocess
import time

import pytest
import requests
from playwright.sync_api import sync_playwright, expect

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON   = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
TEST_GIF = os.path.join(BASE_DIR, "test.gif")
PORT     = 5001
URL      = f"http://127.0.0.1:{PORT}"


# ─── Server fixture ────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def live_server():
    server_script = os.path.join(BASE_DIR, "tests", "server_5001.py")
    proc = subprocess.Popen(
        [PYTHON, server_script],
        cwd=BASE_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Poll /health until ready (up to 10 s)
    for _ in range(20):
        try:
            if requests.get(f"{URL}/health", timeout=1).ok:
                break
        except Exception:
            pass
        time.sleep(0.5)
    else:
        proc.terminate()
        pytest.fail("Flask server did not start within 10 s")

    yield URL

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


# ─── Browser fixture ───────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def pw_browser():
    with sync_playwright() as pw:
        # Use system Edge — Playwright Chromium download blocked by TLS proxy
        browser = pw.chromium.launch(channel="msedge", headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(live_server, pw_browser):
    ctx  = pw_browser.new_context()
    page = ctx.new_page()
    page.goto(live_server)
    yield page
    ctx.close()


# ─── Tests ─────────────────────────────────────────────────────────────────────

def test_page_loads(page):
    """Title and hero heading are present."""
    expect(page).to_have_title("GifFit — Free GIF Compressor for Discord, Slack & Web")
    expect(page.locator("h1")).to_contain_text("Make your GIF fit")


def test_mode_tabs_present(page):
    """Both mode buttons render and Single is active by default."""
    single_btn = page.locator(".mode-btn[data-mode='single']")
    batch_btn  = page.locator(".mode-btn[data-mode='batch']")
    expect(single_btn).to_be_visible()
    expect(batch_btn).to_be_visible()
    expect(single_btn).to_have_class("mode-btn active")


def test_batch_tab_switch(page):
    """Clicking Batch tab shows the batch panel and hides single mode."""
    page.locator(".mode-btn[data-mode='batch']").click()
    expect(page.locator("#batch-mode")).to_be_visible()
    expect(page.locator("#single-mode")).to_be_hidden()


def test_batch_email_form(page):
    """Email form submission shows confirmation and hides the form."""
    page.locator(".mode-btn[data-mode='batch']").click()
    page.locator("#batch-email").fill("test@example.com")
    page.locator("#batch-form button[type='submit']").click()
    expect(page.locator("#batch-confirm")).to_be_visible()
    expect(page.locator("#batch-form")).to_be_hidden()


def test_compress_button_disabled_initially(page):
    """Compress button is disabled before a file and preset are selected."""
    expect(page.locator("#compress-btn")).to_be_disabled()


def test_preset_selection(page):
    """After loading a file, clicking a preset marks it active; compress btn enabled."""
    page.locator("#file-input").set_input_files(TEST_GIF)
    expect(page.locator("#stage")).to_have_attribute("data-state", "ready", timeout=5_000)
    page.locator(".preset-btn[data-preset='discord_emoji']").click()
    expect(page.locator(".preset-btn[data-preset='discord_emoji']")).to_have_class(
        "preset-btn active"
    )
    expect(page.locator("#compress-btn")).to_be_enabled()


def test_full_compression_golden_path(page):
    """Upload test.gif, select discord preset, compress, verify done state."""
    # Upload file via hidden input
    page.locator("#file-input").set_input_files(TEST_GIF)

    # Stage should enter 'ready' state
    expect(page.locator("#stage")).to_have_attribute("data-state", "ready", timeout=5_000)

    # Select discord preset (8 MB — test.gif is 8 KB, fast)
    page.locator(".preset-btn[data-preset='discord']").click()

    # Compress button should now be enabled
    expect(page.locator("#compress-btn")).to_be_enabled()

    # Start compression
    page.locator("#compress-btn").click()

    # Should enter compressing state
    expect(page.locator("#stage")).to_have_attribute(
        "data-state", "compressing", timeout=10_000
    )

    # Wait for done state — allow up to 60 s for small file
    expect(page.locator("#stage")).to_have_attribute(
        "data-state", "done", timeout=60_000
    )

    # Download button should be visible and linked
    download_btn = page.locator("#download-btn")
    expect(download_btn).to_be_visible()
    href = download_btn.get_attribute("href")
    assert href and "/api/download/" in href, f"Unexpected download href: {href!r}"

    # Stats row should show size info
    expect(page.locator("#stat-reduction")).to_contain_text("→")


def test_wrong_file_type_rejected(page):
    """A non-GIF upload shows an error state."""
    # Create a tiny fake PNG in memory by writing bytes to a temp file path
    import tempfile, pathlib
    tmp = pathlib.Path(tempfile.mktemp(suffix=".png"))
    tmp.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)
    try:
        page.locator("#file-input").set_input_files(str(tmp))
        # Printer text should mention the error
        expect(page.locator("#printer-text")).to_contain_text(
            "Unrecognised material", timeout=5_000
        )
    finally:
        tmp.unlink(missing_ok=True)
