import os
import glob
from datetime import datetime
from flask import Blueprint, render_template, abort, Response, current_app

import frontmatter
import markdown as md_lib

seo_bp = Blueprint("seo", __name__)

BLOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "blog")


# ── Landing pages ──────────────────────────────────────────────────────────────

@seo_bp.route("/discord-emoji")
def discord_emoji():
    return render_template(
        "landing.html",
        preset="discord_emoji",
        page_title="GIF Compressor for Discord Emoji — Make it 128×128 under 256 KB",
        page_description="Compress animated GIFs to Discord emoji spec in one click. Output is exactly 128×128 px and under 256 KB. Free, no account, no watermark.",
        canonical="https://giffit.io/discord-emoji",
        h1="GIF compressor for Discord emoji.",
        h2="Drop it in. Get it under 256 KB and 128×128.",
        blog_slug="compress-gif-under-256kb-discord-emoji",
        blog_title="How to compress a GIF under 256 KB for Discord emoji →",
        faqs=[
            {
                "q": "What size does a Discord animated emoji need to be?",
                "a": "Discord animated emoji must be under 256 KB and exactly 128×128 pixels. GifFit's Discord Emoji preset handles both automatically.",
            },
            {
                "q": "Why does Discord reject my GIF emoji?",
                "a": "Discord rejects emoji GIFs that exceed 256 KB or are not 128×128 pixels. Both conditions must be met. GifFit resizes and compresses in a single step.",
            },
            {
                "q": "How do I make a GIF smaller for Discord emoji?",
                "a": "Drop your GIF into GifFit, select the Discord Emoji preset, and download. The output will be under 256 KB at exactly 128×128 px.",
            },
        ],
    )


@seo_bp.route("/discord")
def discord():
    return render_template(
        "landing.html",
        preset="discord",
        page_title="GIF Compressor for Discord — Compress Under 8 MB Free",
        page_description="Compress animated GIFs to fit Discord's 8 MB upload limit. Free, no account, no watermark. Make your GIF fit.",
        canonical="https://giffit.io/discord",
        h1="GIF compressor for Discord.",
        h2="Drop it in. Get it under 8 MB.",
        blog_slug="compress-gif-under-8mb-discord",
        blog_title="How to compress a GIF under 8 MB for Discord →",
        faqs=[
            {
                "q": "What is the Discord GIF file size limit?",
                "a": "Discord free accounts can upload files up to 8 MB. GIFs over 8 MB fail to upload. GifFit's Discord preset compresses any GIF to fit.",
            },
            {
                "q": "How do I compress a GIF for Discord?",
                "a": "Drop your GIF into GifFit and select the Discord preset. The output will be optimised and under 8 MB.",
            },
            {
                "q": "Does Discord Nitro increase the GIF limit?",
                "a": "Discord Nitro raises the general upload limit to 500 MB — but animated emoji still require 256 KB and 128×128 px regardless of Nitro status.",
            },
        ],
    )


# ── Blog ───────────────────────────────────────────────────────────────────────

def _get_all_posts():
    posts = []
    for path in sorted(glob.glob(os.path.join(BLOG_DIR, "*.md")), reverse=True):
        post = frontmatter.load(path)
        post.metadata["slug"] = os.path.splitext(os.path.basename(path))[0]
        posts.append(post)
    return posts


def _get_post(slug):
    path = os.path.join(BLOG_DIR, slug + ".md")
    if not os.path.exists(path):
        return None
    post = frontmatter.load(path)
    post.metadata["slug"] = slug
    post.metadata["html"] = md_lib.markdown(
        post.content,
        extensions=["extra", "meta", "toc", "tables"],
    )
    return post


@seo_bp.route("/blog/")
def blog_index():
    posts = _get_all_posts()
    return render_template("blog/index.html", posts=posts)


@seo_bp.route("/blog/<slug>")
def blog_post(slug):
    if not slug.replace("-", "").isalnum():
        abort(404)
    post = _get_post(slug)
    if post is None:
        abort(404)
    return render_template("blog/post.html", post=post)


# ── Sitemap ────────────────────────────────────────────────────────────────────

@seo_bp.route("/sitemap.xml")
def sitemap():
    base = "https://giffit.io"
    today = datetime.utcnow().strftime("%Y-%m-%d")

    static_pages = [
        {"url": base + "/",              "priority": "1.0", "changefreq": "weekly",  "lastmod": today},
        {"url": base + "/discord-emoji", "priority": "0.9", "changefreq": "monthly", "lastmod": today},
        {"url": base + "/discord",       "priority": "0.9", "changefreq": "monthly", "lastmod": today},
        {"url": base + "/upgrade",       "priority": "0.6", "changefreq": "monthly", "lastmod": today},
        {"url": base + "/blog/",         "priority": "0.7", "changefreq": "weekly",  "lastmod": today},
    ]

    blog_pages = []
    for post in _get_all_posts():
        slug = post.metadata.get("slug", "")
        date = str(post.metadata.get("updated", post.metadata.get("date", today)))
        blog_pages.append({
            "url": base + "/blog/" + slug,
            "priority": "0.8",
            "changefreq": "monthly",
            "lastmod": date,
        })

    xml = render_template("sitemap.xml", pages=static_pages + blog_pages)
    return Response(xml, mimetype="application/xml")


# ── robots.txt ─────────────────────────────────────────────────────────────────

@seo_bp.route("/robots.txt")
def robots():
    content = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        "Disallow: /uploads/\n"
        "\n"
        "Sitemap: https://giffit.io/sitemap.xml\n"
    )
    return Response(content, mimetype="text/plain")


# ── IndexNow key file ──────────────────────────────────────────────────────────

@seo_bp.route("/<key>.txt")
def indexnow_key(key):
    expected = current_app.config.get("INDEXNOW_KEY", "")
    if key == expected and expected:
        return Response(expected, mimetype="text/plain")
    abort(404)
