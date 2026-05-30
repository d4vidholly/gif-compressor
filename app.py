import os
from flask import Flask, render_template

from config import Config
from utils.cleanup import start_cleanup_scheduler


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Ensure uploads directory exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Register blueprints
    from routes.compress import compress_bp
    from routes.health import health_bp

    app.register_blueprint(compress_bp)
    app.register_blueprint(health_bp)

    # Error handlers
    @app.errorhandler(413)
    def file_too_large(e):
        return {"error": "File too large. Maximum size is 50 MB."}, 413

    # Index route
    @app.route("/")
    def index():
        return render_template("index.html")

    # Startup cleanup of any leftover files
    with app.app_context():
        from utils.cleanup import cleanup_old_files
        cleanup_old_files(app.config["UPLOAD_FOLDER"], max_age_minutes=0)
        start_cleanup_scheduler(
            app.config["UPLOAD_FOLDER"],
            app.config["CLEANUP_INTERVAL_MINUTES"],
            app.config["FILE_MAX_AGE_MINUTES"],
        )

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=app.config["DEBUG"], host="0.0.0.0", port=5000)
