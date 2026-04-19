"""
Run full training pipeline: dataset preparation → condition → brand → price.
"""
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def run(script: str, description: str):
    print(f"\n{'='*60}\n{description}\n{'='*60}")
    r = subprocess.run([sys.executable, str(PROJECT_ROOT / script)], cwd=str(PROJECT_ROOT))
    if r.returncode != 0:
        print(f"Failed: {script}")
        sys.exit(r.returncode)


def main():
    run("dataset/prepare_dataset.py", "1. Dataset preparation")
    run("training/train_condition.py", "2. Condition model training")
    run("training/train_brand.py", "3. Brand model training")
    run("training/train_price.py", "4. Price regression training")
    print("\nAll training steps completed.")


if __name__ == "__main__":
    main()
