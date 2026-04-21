"""
Dataset preparation for thrift item price estimation.
Creates train/val/test splits and annotation files from raw labeled data.
"""
import json
import os
import random
from pathlib import Path

import yaml

# Default paths relative to project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "config" / "config.yaml"
DATA_DIR = PROJECT_ROOT / "data"
ANNOTATIONS_FILE = DATA_DIR / "annotations.json"
SPLITS_DIR = DATA_DIR / "splits"


def load_config():
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def load_annotations(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path) as f:
        data = json.load(f)
    return data if isinstance(data, list) else data.get("items", [])


def save_annotations(path: Path, items: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump({"items": items, "count": len(items)}, f, indent=2)


def create_splits(
    items: list[dict],
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    test_ratio: float = 0.1,
    seed: int = 42,
):
    random.seed(seed)
    shuffled = items.copy()
    random.shuffle(shuffled)
    n = len(shuffled)
    t = int(n * train_ratio)
    v = int(n * val_ratio)
    train = shuffled[:t]
    val = shuffled[t : t + v]
    test = shuffled[t + v :]
    return train, val, test


def prepare_dataset():
    config = load_config()
    ds = config.get("dataset", {})
    data_dir = PROJECT_ROOT / ds.get("data_dir", "data")
    annotations_path = data_dir / ds.get("annotations_file", "annotations.json")

    items = load_annotations(annotations_path)
    if not items:
        # Create sample placeholder structure for development
        sample = [
            {
                "id": "sample_1",
                "category": "clothing",
                "condition": "good",
                "brand": "local",
                "price_php": 150.0,
                "image_full": "images/sample_full.jpg",
                "image_label": "images/sample_label.jpg",
            }
        ]
        save_annotations(annotations_path, sample)
        items = sample
        print("Created sample annotations. Add real data to data/annotations.json and image paths under data/.")

    valid_items = []
    skipped = 0
    for item in items:
        full_path = data_dir / str(item.get("image_full", ""))
        label_path = data_dir / str(item.get("image_label", ""))
        if full_path.exists() and label_path.exists():
            valid_items.append(item)
        else:
            skipped += 1
    if skipped:
        print(f"Skipped {skipped} items with missing image files.")
    items = valid_items or items

    train_ratio = ds.get("train_ratio", 0.8)
    val_ratio = ds.get("val_ratio", 0.1)
    test_ratio = ds.get("test_ratio", 0.1)
    if abs((train_ratio + val_ratio + test_ratio) - 1.0) > 0.001:
        raise ValueError("train_ratio + val_ratio + test_ratio must equal 1.0")
    train, val, test = create_splits(items, train_ratio, val_ratio, test_ratio)

    SPLITS_DIR.mkdir(parents=True, exist_ok=True)
    for name, split in [("train", train), ("val", val), ("test", test)]:
        out = SPLITS_DIR / f"{name}.json"
        with open(out, "w") as f:
            json.dump(split, f, indent=2)
        print(f"Wrote {len(split)} items to {out}")

    return train, val, test


if __name__ == "__main__":
    prepare_dataset()
