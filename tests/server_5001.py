"""Starts the GifFit app on port 5001 for testing."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app
app = create_app()
app.run(host="127.0.0.1", port=5001, debug=False, use_reloader=False)
