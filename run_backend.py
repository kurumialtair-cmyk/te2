"""Run the backend API from project root so that training/models are on PYTHONPATH."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
subprocess.run(
    [sys.executable, "-m", "uvicorn", "backend.main:app", "--reload", "--host", "0.0.0.0"],
    cwd=str(ROOT),
)
