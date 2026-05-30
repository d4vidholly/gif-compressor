"""Management commands. Usage: python manage.py <command>"""
import sys
from app import create_app

app = create_app()

if "ping_indexnow" in sys.argv:
    with app.app_context():
        from routes.seo import _get_all_posts
        from utils.indexnow import ping

        posts = _get_all_posts()
        urls = ["https://giffit.io/blog/" + p.metadata["slug"] for p in posts]
        urls += [
            "https://giffit.io/",
            "https://giffit.io/discord-emoji",
            "https://giffit.io/discord",
        ]
        ping(urls)
        print(f"Pinged {len(urls)} URLs")
else:
    print("Usage: python manage.py ping_indexnow")
