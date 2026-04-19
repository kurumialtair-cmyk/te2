"""
Train the brand recognition model (brand-label image → brand class).
"""
import json
import sys
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from training.models import LightweightCNN
from dataset.dataset_loader import ThriftItemDataset

DATA_DIR = PROJECT_ROOT / "data"
SPLITS_DIR = DATA_DIR / "splits"
MODELS_DIR = PROJECT_ROOT / "models"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMAGE_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 20
LR = 1e-3


def get_brand_mappings():
    with open(SPLITS_DIR / "train.json") as f:
        train = json.load(f)
    brands = sorted(set(item["brand"] for item in train))
    brand_to_idx = {b: i for i, b in enumerate(brands)}
    return brand_to_idx


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    brand_to_idx = get_brand_mappings()
    num_classes = len(brand_to_idx)

    train_ds = ThriftItemDataset(
        split="train",
        data_dir=DATA_DIR,
        image_size=IMAGE_SIZE,
        train=True,
        brand_to_idx=brand_to_idx,
    )
    val_ds = ThriftItemDataset(
        split="val",
        data_dir=DATA_DIR,
        image_size=IMAGE_SIZE,
        train=False,
        brand_to_idx=brand_to_idx,
    )
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = LightweightCNN(num_classes=num_classes, embedding_dim=64).to(DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        for batch in train_loader:
            x = batch["image_label"].to(DEVICE)
            y = batch["brand_idx"].to(DEVICE)
            optimizer.zero_grad()
            logits, _ = model(x)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        train_loss /= len(train_loader)

        model.eval()
        val_loss = 0.0
        correct = 0
        total = 0
        with torch.no_grad():
            for batch in val_loader:
                x = batch["image_label"].to(DEVICE)
                y = batch["brand_idx"].to(DEVICE)
                logits, _ = model(x)
                loss = criterion(logits, y)
                val_loss += loss.item()
                pred = logits.argmax(1)
                correct += (pred == y).sum().item()
                total += y.size(0)
        val_loss /= len(val_loader)
        acc = correct / total if total else 0
        print(f"Epoch {epoch+1}/{EPOCHS}  train_loss={train_loss:.4f}  val_loss={val_loss:.4f}  val_acc={acc:.4f}")

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "num_classes": num_classes,
            "brand_to_idx": brand_to_idx,
        },
        MODELS_DIR / "brand_model.pt",
    )
    print(f"Saved brand model to {MODELS_DIR / 'brand_model.pt'}")


if __name__ == "__main__":
    main()
