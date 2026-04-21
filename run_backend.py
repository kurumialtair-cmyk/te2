"""Run the backend API from project root so that training/models are on PYTHONPATH."""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = os.environ.get("PORT", "8000")
subprocess.run(
    [sys.executable, "-m", "uvicorn", "backend.main:app", "--reload", "--host", "0.0.0.0", "--port", PORT],
    cwd=str(ROOT),
)
