# GifFit — SEO Architecture & Implementation

This document is the build spec for everything SEO-related. Once built, content (blog posts) drives organic traffic indefinitely with no additional engineering.

---

## Site map — every URL

| URL | Purpose | Target keyword | Priority | Schema |
|---|---|---|---|---|
| `giffit.io/` | Homepage — the tool | gif compressor for discord | 1.0 | WebApplication |
| `giffit.io/discord-emoji` | Landing page — preset pre-selected | discord emoji gif size · compress gif under 256kb | 0.9 | WebApplication + FAQPage |
| `giffit.io/discord` | Landing page — preset pre-selected | gif compressor discord · compress gif for discord | 0.9 | WebApplication + FAQPage |
| `giffit.io/upgrade` | Pro tier | — | 0.6 | — |
| `giffit.io/blog/` | Blog index | gif compression guides | 0.7 | Blog |
| `giffit.io/blog/compress-gif-under-256kb-discord-emoji` | Post 1 | compress gif under 256kb · discord animated emoji | 0.8 | Article + FAQPage |
| `giffit.io/blog/compress-gif-under-8mb-discord` | Post 2 | compress gif for discord · gif too large discord | 0.8 | Article + FAQPage |
| `giffit.io/blog/why-are-gifs-so-big` | Post 3 | why is my gif so large · reduce gif file size | 0.8 | Article + FAQPage |
| `giffit.io/blog/freeconvert-gif-compressor-alternative` | Post 4 | freeconvert gif compressor · freeconvert alternative | 0.8 | Article + FAQPage |
| `giffit.io/blog/ezgif-alternatives` | Post 5 | ezgif alternative · gif compressor no ads | 0.8 | Article + FAQPage |
| `giffit.io/sitemap.xml` | Sitemap | — | — | — |
| `giffit.io/robots.txt` | Robots | — | — | — |
| `giffit.io/<indexnow-key>.txt` | IndexNow verification | — | — | — |

---

## New Flask routes to build

**File:** `routes/seo.py`

```python
from flask import Blueprint, render_template, abort, Response, current_app
import os, glob, frontmatter, markdown
from datetime import datetime

seo_bp = Blueprint("seo", __name__)

# ── Landing pages ─────────────────────────────────────────────────────────────

@seo_bp.route("/discord-emoji")
def discord_emoji():
    return render_template("landing.html",
        preset="discord_emoji",
        page_title="GIF Compressor for Discord Emoji — Make it 128×128 under 256 KB",
        page_description="Compress animated GIFs to Discord emoji spec in one click. Output is exactly 128×128 px and under 256 KB. Free, no account, no watermark.",
        h1="GIF compressor for Discord emoji.",
        h2="Drop it in. Get it under 256 KB and 128×128.",
        faqs=[
            {"q": "What size does a Discord animated emoji need to be?",
             "a": "Discord animated emoji must be under 256 KB and exactly 128×128 pixels. GifFit's Discord Emoji preset handles both automatically."},
            {"q": "Why does Discord reject my GIF emoji?",
             "a": "Discord rejects emoji GIFs that exceed 256 KB or are not 128×128 pixels. Both conditions must be met. GifFit resizes and compresses in a single step."},
            {"q": "How do I make a GIF smaller for Discord emoji?",
             "a": "Drop your GIF into GifFit, select the Discord Emoji preset, and download. The output will be under 256 KB at exactly 128×128 px."},
        ]
    )

@seo_bp.route("/discord")
def discord():
    return render_template("landing.html",
        preset="discord",
        page_title="GIF Compressor for Discord — Compress Under 8 MB Free",
        page_description="Compress animated GIFs to fit Discord's 8 MB upload limit. Free, no account, no watermark. Make your GIF fit.",
        h1="GIF compressor for Discord.",
        h2="Drop it in. Get it under 8 MB.",
        faqs=[
            {"q": "What is the Discord GIF file size limit?",
             "a": "Discord free accounts can upload files up to 8 MB. GIFs over 8 MB fail to upload. GifFit's Discord preset compresses any GIF to fit."},
            {"q": "How do I compress a GIF for Discord?",
             "a": "Drop your GIF into GifFit and select the Discord preset. The output will be optimised and under 8 MB."},
            {"q": "Does Discord Nitro increase the GIF limit?",
             "a": "Discord Nitro raises the general upload limit to 500 MB — but animated emoji still require 256 KB and 128×128 px regardless of Nitro status."},
        ]
    )

# ── Blog ──────────────────────────────────────────────────────────────────────

BLOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "blog")

def get_all_posts():
    posts = []
    for path in sorted(glob.glob(os.path.join(BLOG_DIR, "*.md")), reverse=True):
        post = frontmatter.load(path)
        post.metadata["slug"] = os.path.splitext(os.path.basename(path))[0]
        posts.append(post)
    return posts

def get_post(slug):
    path = os.path.join(BLOG_DIR, slug + ".md")
    if not os.path.exists(path):
        return None
    post = frontmatter.load(path)
    post.metadata["slug"] = slug
    post.metadata["html"] = markdown.markdown(
        post.content,
        extensions=["extra", "meta", "toc", "tables"]
    )
    return post

@seo_bp.route("/blog/")
def blog_index():
    posts = get_all_posts()
    return render_template("blog/index.html", posts=posts)

@seo_bp.route("/blog/<slug>")
def blog_post(slug):
    # Sanitise slug
    if not slug.replace("-", "").isalnum():
        abort(404)
    post = get_post(slug)
    if post is None:
        abort(404)
    return render_template("blog/post.html", post=post)

# ── Sitemap ───────────────────────────────────────────────────────────────────

@seo_bp.route("/sitemap.xml")
def sitemap():
    base = "https://giffit.io"
    today = datetime.utcnow().strftime("%Y-%m-%d")

    # Static pages
    static_pages = [
        {"url": base + "/",               "priority": "1.0", "changefreq": "weekly",  "lastmod": today},
        {"url": base + "/discord-emoji",  "priority": "0.9", "changefreq": "monthly", "lastmod": today},
        {"url": base + "/discord",        "priority": "0.9", "changefreq": "monthly", "lastmod": today},
        {"url": base + "/upgrade",        "priority": "0.6", "changefreq": "monthly", "lastmod": today},
        {"url": base + "/blog/",          "priority": "0.7", "changefreq": "weekly",  "lastmod": today},
    ]

    # Blog posts — read from filesystem
    blog_pages = []
    for post in get_all_posts():
        slug = post.metadata.get("slug", "")
        date = str(post.metadata.get("updated", post.metadata.get("date", today)))
        blog_pages.append({
            "url": base + "/blog/" + slug,
            "priority": "0.8",
            "changefreq": "monthly",
            "lastmod": date,
        })

    all_pages = static_pages + blog_pages
    xml = render_template("sitemap.xml", pages=all_pages)
    return Response(xml, mimetype="application/xml")

# ── robots.txt ────────────────────────────────────────────────────────────────

@seo_bp.route("/robots.txt")
def robots():
    content = """User-agent: *
Allow: /
Disallow: /api/
Disallow: /uploads/

Sitemap: https://giffit.io/sitemap.xml
"""
    return Response(content, mimetype="text/plain")

# ── IndexNow key file ─────────────────────────────────────────────────────────

@seo_bp.route("/<key>.txt")
def indexnow_key(key):
    expected = current_app.config.get("INDEXNOW_KEY", "")
    if key == expected and expected:
        return Response(expected, mimetype="text/plain")
    abort(404)
```

Register in `app.py`:
```python
from routes.seo import seo_bp
app.register_blueprint(seo_bp)
```

---

## IndexNow — instant indexing on new content

**File:** `utils/indexnow.py`

```python
import requests, logging, os
logger = logging.getLogger(__name__)

def ping(urls, host="giffit.io"):
    """
    Notify IndexNow (Bing, Yandex, etc.) about new or updated URLs.
    Call this whenever a new blog post is deployed.
    """
    key = os.environ.get("INDEXNOW_KEY", "")
    if not key:
        logger.warning("INDEXNOW_KEY not set — skipping ping")
        return

    payload = {
        "host": host,
        "key": key,
        "keyLocation": f"https://{host}/{key}.txt",
        "urlList": urls if isinstance(urls, list) else [urls],
    }
    try:
        r = requests.post("https://api.indexnow.org/indexnow",
                          json=payload, timeout=10)
        logger.info(f"IndexNow ping: {r.status_code} for {len(payload['urlList'])} URLs")
    except Exception as e:
        logger.warning(f"IndexNow ping failed: {e}")
```

**When to call it:** Add a management command `python manage.py ping_indexnow` that pings all blog URLs. Run it after deploying a new post.

```python
# manage.py (new file)
import sys
from app import create_app
from utils.indexnow import ping

app = create_app()
with app.app_context():
    if "ping_indexnow" in sys.argv:
        from routes.seo import get_all_posts
        urls = ["https://giffit.io/blog/" + p.metadata["slug"] for p in get_all_posts()]
        urls += ["https://giffit.io/", "https://giffit.io/discord-emoji", "https://giffit.io/discord"]
        ping(urls)
        print(f"Pinged {len(urls)} URLs")
```

---

## Blog — markdown files with frontmatter

**File structure:**
```
blog/
  compress-gif-under-256kb-discord-emoji.md    ← Post 1 (write first)
  compress-gif-under-8mb-discord.md            ← Post 2
  why-are-gifs-so-big.md                       ← Post 3
  freeconvert-gif-compressor-alternative.md    ← Post 4
  ezgif-alternatives.md                        ← Post 5
```

**Frontmatter spec — every post must have all these fields:**

```yaml
---
title: "How to Compress a GIF Under 256 KB for Discord Emoji (2026)"
description: "Step-by-step guide to compress animated GIFs under Discord's 256 KB emoji limit. Free tool, no account required."
date: 2026-06-01
updated: 2026-06-01
author: GifFit
slug: compress-gif-under-256kb-discord-emoji
keywords:
  - compress gif under 256kb
  - discord animated emoji size
  - discord gif emoji too large
---
```

**Post structure — every post must follow this format:**

```markdown
---
[frontmatter as above]
---

**TL;DR:** [One sentence answer to the question. AI systems cite this first.]

---

## [Main answer heading]

[Content...]

---

## FAQ

**What is the Discord animated emoji size limit?**
Discord animated emoji must be under 256 KB and exactly 128×128 pixels.

**Why is my GIF being rejected by Discord?**
[Answer...]

**How do I compress a GIF for Discord emoji?**
[Answer linking to GifFit...]
```

---

## Templates to build

### `templates/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{% for page in pages %}
  <url>
    <loc>{{ page.url }}</loc>
    <lastmod>{{ page.lastmod }}</lastmod>
    <changefreq>{{ page.changefreq }}</changefreq>
    <priority>{{ page.priority }}</priority>
  </url>
{% endfor %}
</urlset>
```

### `templates/landing.html`

Extends `base.html`. Renders the full tool with the correct preset pre-selected. Includes:
- `<title>{{ page_title }}</title>`
- `<meta name="description" content="{{ page_description }}">`
- `<h1>{{ h1 }}</h1>` and `<h2>{{ h2 }}</h2>`
- The tool (same as homepage but preset pre-selected via JS reading URL or data attribute)
- FAQPage schema block
- Internal link to the relevant blog post

### `templates/blog/index.html`

List of all posts with title, date, description excerpt. Blog schema. Internal links.

### `templates/blog/post.html`

Full post with:
- `<title>{{ post.title }} | GifFit</title>`
- `<meta name="description" content="{{ post.description }}">`
- `<link rel="canonical" href="https://giffit.io/blog/{{ post.slug }}">`
- Article schema (see below)
- FAQPage schema if the post has an FAQ section
- CTA block linking to the tool at the bottom of every post

---

## Schema markup

### Homepage (`/`)

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "GifFit",
  "url": "https://giffit.io",
  "description": "Free GIF compressor for Discord. Compress animated GIFs to Discord emoji size (256 KB, 128×128) or Discord upload size (8 MB). No account required.",
  "applicationCategory": "UtilitiesApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
}
```

### Landing pages (`/discord-emoji`, `/discord`)

```json
[
  { "@type": "WebApplication", ... },
  {
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What size does a Discord animated emoji need to be?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Discord animated emoji must be under 256 KB and exactly 128×128 pixels."
        }
      }
    ]
  }
]
```

### Blog posts

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{ post.title }}",
  "description": "{{ post.description }}",
  "datePublished": "{{ post.date }}",
  "dateModified": "{{ post.updated }}",
  "author": {
    "@type": "Organization",
    "name": "GifFit",
    "url": "https://giffit.io"
  },
  "publisher": {
    "@type": "Organization",
    "name": "GifFit",
    "url": "https://giffit.io"
  }
}
```

---

## Meta tags — per page type

Every page needs these in `<head>`. Build a `base.html` template with blocks for each.

```html
<!-- Required on every page -->
<title>{% block title %}GifFit — Free GIF Compressor for Discord{% endblock %}</title>
<meta name="description" content="{% block description %}Compress animated GIFs for Discord in one click.{% endblock %}">
<link rel="canonical" href="{% block canonical %}https://giffit.io/{% endblock %}">

<!-- Open Graph -->
<meta property="og:title" content="{% block og_title %}GifFit — Make your GIF fit.{% endblock %}">
<meta property="og:description" content="{% block og_description %}GIF compression for Discord. Two presets. One click.{% endblock %}">
<meta property="og:type" content="website">
<meta property="og:url" content="{% block og_url %}https://giffit.io{% endblock %}">
<meta property="og:image" content="https://giffit.io/static/og-image.png">

<!-- Schema — injected per page -->
{% block schema %}{% endblock %}
```

The OG image (`og-image.png`) needs to be created — a 1200×630 screenshot of the blueprint UI or wordmark. This is what appears when the URL is shared on Discord, Twitter, Slack.

---

## Internal linking strategy

**Every blog post must:**
1. Link to the tool (`giffit.io/` or the relevant landing page) at least twice — once early, once as the CTA at the end
2. Link to at least one other blog post
3. Be linked from the blog index

**Landing pages must:**
1. Link to the relevant blog post ("Learn why Discord requires 128×128 →")
2. Link to `/upgrade` once, naturally

**Homepage must:**
1. Link to `/discord-emoji` and `/discord` in copy or as secondary nav
2. Link to `/blog/` in footer

---

## New dependencies

Add to `requirements.txt`:
```
python-frontmatter==1.1.0
Markdown==3.6
```

---

## Environment variables

Add to server config:
```
INDEXNOW_KEY=<generate a random 32-char hex string>
```

The IndexNow key file is served at `giffit.io/<key>.txt` — this is how Bing/Bing verifies ownership before accepting URL submissions.

---

## File structure after implementation

```
gif-fit/
├── blog/                              ← NEW: markdown posts live here
│   ├── compress-gif-under-256kb-discord-emoji.md
│   ├── compress-gif-under-8mb-discord.md
│   ├── why-are-gifs-so-big.md
│   ├── freeconvert-gif-compressor-alternative.md
│   └── ezgif-alternatives.md
├── routes/
│   ├── compress.py
│   ├── health.py
│   ├── seo.py                         ← NEW: landing pages, blog, sitemap, robots
│   └── __init__.py
├── utils/
│   ├── compressor.py
│   ├── cleanup.py
│   ├── indexnow.py                    ← NEW: IndexNow ping utility
│   └── __init__.py
├── templates/
│   ├── base.html                      ← NEW: base with meta blocks
│   ├── index.html                     ← extends base.html
│   ├── landing.html                   ← NEW: /discord-emoji, /discord
│   ├── upgrade.html                   ← exists
│   ├── sitemap.xml                    ← NEW
│   └── blog/
│       ├── index.html                 ← NEW
│       └── post.html                  ← NEW
├── static/
│   └── og-image.png                   ← NEW: 1200×630 OG image
├── manage.py                          ← NEW: CLI commands (IndexNow ping)
├── app.py
├── config.py
└── requirements.txt
```

---

## Definition of done

- [ ] `GET /discord-emoji` returns 200 with correct title, h1, FAQPage schema, preset pre-selected
- [ ] `GET /discord` returns 200 with correct title, h1, FAQPage schema, preset pre-selected
- [ ] `GET /blog/` returns 200, lists all posts in reverse date order
- [ ] `GET /blog/compress-gif-under-256kb-discord-emoji` returns 200 with Article schema
- [ ] `GET /sitemap.xml` returns valid XML including all static pages and all blog posts
- [ ] `GET /robots.txt` returns correct content, Disallow /api/ and /uploads/
- [ ] `GET /<indexnow-key>.txt` returns the key
- [ ] Every page has `<title>`, `<meta name="description">`, `<link rel="canonical">`, OG tags
- [ ] Blog post template includes Article schema
- [ ] Landing pages include FAQPage schema
- [ ] `python manage.py ping_indexnow` successfully POSTs to IndexNow API
- [ ] `og-image.png` exists at `/static/og-image.png`
- [ ] All 5 blog posts have valid frontmatter and render without error
- [ ] Internal links: each post links to the tool, each landing page links to a blog post

---

## Content calendar — first 5 posts

Write in this order. Post 1 is the highest SEO priority.

### Post 1 — week 1 of launch

**File:** `blog/compress-gif-under-256kb-discord-emoji.md`
**Title:** How to Compress a GIF Under 256 KB for Discord Emoji (2026)
**Target:** compress gif under 256kb · discord animated emoji size · discord gif emoji too large
**Word count:** 600–800 words
**Must include:**
- TL;DR in first 2 sentences
- The actual limit: 256 KB AND 128×128 px (both required)
- Step-by-step using GifFit Discord Emoji preset
- What GifFit does technically (brief — palette reduction, resize, frame trimming)
- What to do if quality degrades
- FAQ section with 4 questions (FAQPage schema)
- Link to the tool twice, link to Post 2

### Post 2 — week 1 of launch

**File:** `blog/compress-gif-under-8mb-discord.md`
**Title:** How to Compress a GIF Under 8 MB for Discord (2026)
**Target:** compress gif for discord · gif too large discord · discord 8mb limit
**Word count:** 500–700 words

### Post 3 — week 2

**File:** `blog/why-are-gifs-so-big.md`
**Title:** Why Are GIFs So Big? (And How to Fix It)
**Target:** why is my gif so large · reduce gif file size · gif file size explained
**Word count:** 700–900 words
**Key data:** GIF from 1987, no inter-frame compression, 256 colours per frame, 10s clip = 25MB as GIF vs 2MB as MP4

### Post 4 — week 2

**File:** `blog/freeconvert-gif-compressor-alternative.md`
**Title:** FreeConvert GIF Compressor: What It Gets Wrong for Discord Users
**Target:** freeconvert gif compressor · freeconvert alternative · gif compressor no account
**Word count:** 600–800 words
**Tone:** Fair — acknowledge 1GB limit and 7 strategies, but explain why no Discord presets makes it wrong for server admins

### Post 5 — week 3

**File:** `blog/ezgif-alternatives.md`
**Title:** ezgif Alternatives: GIF Compressors Without the Ads (2026)
**Target:** ezgif alternative · gif compressor no ads · better than ezgif
**Word count:** 700–900 words
