"""
Train the price regression model using condition embeddings, brand embeddings, and category.
"""
import json
import sys
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from training.models import LightweightCNN, PriceRegressionModel
from dataset.dataset_loader import ThriftItemDataset

DATA_DIR = PROJECT_ROOT / "data"
SPLITS_DIR = DATA_DIR / "splits"
MODELS_DIR = PROJECT_ROOT / "models"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMAGE_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 50
LR = 1e-3
EMBED_DIM = 64


def get_mappings():
    with open(SPLITS_DIR / "train.json") as f:
        train = json.load(f)
    categories = sorted(set(item["category"] for item in train))
    conditions = sorted(set(item["condition"] for item in train))
    brands = sorted(set(item["brand"] for item in train))
    cat_to_idx = {c: i for i, c in enumerate(categories)}
    cond_to_idx = {c: i for i, c in enumerate(conditions)}
    brand_to_idx = {b: i for i, b in enumerate(brands)}
    return cat_to_idx, cond_to_idx, brand_to_idx


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    cat_to_idx, cond_to_idx, brand_to_idx = get_mappings()
    num_categories = len(cat_to_idx)
    num_conditions = len(cond_to_idx)
    num_brands = len(brand_to_idx)

    cond_ckpt = torch.load(MODELS_DIR / "condition_model.pt", map_location=DEVICE)
    brand_ckpt = torch.load(MODELS_DIR / "brand_model.pt", map_location=DEVICE)

    condition_model = LightweightCNN(num_classes=num_conditions, embedding_dim=EMBED_DIM).to(DEVICE)
    condition_model.load_state_dict(cond_ckpt["model_state_dict"])
    condition_model.eval()

    brand_model = LightweightCNN(num_classes=num_brands, embedding_dim=EMBED_DIM).to(DEVICE)
    brand_model.load_state_dict(brand_ckpt["model_state_dict"])
    brand_model.eval()

    price_model = PriceRegressionModel(
        condition_embed_dim=EMBED_DIM,
        brand_embed_dim=EMBED_DIM,
        num_categories=num_categories,
        category_embed_dim=32,
        hidden_dims=[128, 64],
    ).to(DEVICE)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(price_model.parameters(), lr=LR)

    train_ds = ThriftItemDataset(
        split="train",
        data_dir=DATA_DIR,
        image_size=IMAGE_SIZE,
        train=True,
        category_to_idx=cat_to_idx,
        condition_to_idx=cond_to_idx,
        brand_to_idx=brand_to_idx,
    )
    val_ds = ThriftItemDataset(
        split="val",
        data_dir=DATA_DIR,
        image_size=IMAGE_SIZE,
        train=False,
        category_to_idx=cat_to_idx,
        condition_to_idx=cond_to_idx,
        brand_to_idx=brand_to_idx,
    )
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    for epoch in range(EPOCHS):
        price_model.train()
        train_loss = 0.0
        for batch in train_loader:
            full_img = batch["image_full"].to(DEVICE)
            label_img = batch["image_label"].to(DEVICE)
            category_idx = batch["category_idx"].to(DEVICE)
            price = batch["price"].to(DEVICE)
            with torch.no_grad():
                _, cond_embed = condition_model(full_img)
                _, brand_embed = brand_model(label_img)
            pred = price_model(cond_embed, brand_embed, category_idx)
            loss = criterion(pred, price)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        train_loss /= len(train_loader)

        price_model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch in val_loader:
                full_img = batch["image_full"].to(DEVICE)
                label_img = batch["image_label"].to(DEVICE)
                category_idx = batch["category_idx"].to(DEVICE)
                price = batch["price"].to(DEVICE)
                _, cond_embed = condition_model(full_img)
                _, brand_embed = brand_model(label_img)
                pred = price_model(cond_embed, brand_embed, category_idx)
                val_loss += criterion(pred, price).item()
        val_loss /= len(val_loader)
        print(f"Epoch {epoch+1}/{EPOCHS}  train_mse={train_loss:.2f}  val_mse={val_loss:.2f}")

    torch.save(
        {
            "model_state_dict": price_model.state_dict(),
            "category_to_idx": cat_to_idx,
            "num_categories": num_categories,
        },
        MODELS_DIR / "price_model.pt",
    )
    print(f"Saved price model to {MODELS_DIR / 'price_model.pt'}")


if __name__ == "__main__":
    main()
