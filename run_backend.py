"""Render-safe backend entrypoint with PORT support."""
import os

import uvicorn

from backend.main import app


def get_port() -> int:
    try:
        return int(os.getenv("PORT", "8000"))
    except ValueError:
        return 8000


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=get_port())
