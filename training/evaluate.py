"""
Evaluate condition (accuracy), brand (accuracy), and price (MAE, RMSE) on test set.
"""
import json
import sys
from pathlib import Path

import torch
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
EMBED_DIM = 64


def get_mappings():
    with open(SPLITS_DIR / "train.json") as f:
        train = json.load(f)
    cat_to_idx = {c: i for i, c in enumerate(sorted(set(i["category"] for i in train)))}
    cond_to_idx = {c: i for i, c in enumerate(sorted(set(i["condition"] for i in train)))}
    brand_to_idx = {b: i for i, b in enumerate(sorted(set(i["brand"] for i in train)))}
    return cat_to_idx, cond_to_idx, brand_to_idx


def main():
    cat_to_idx, cond_to_idx, brand_to_idx = get_mappings()
    test_ds = ThriftItemDataset(
        split="test",
        data_dir=DATA_DIR,
        image_size=IMAGE_SIZE,
        train=False,
        category_to_idx=cat_to_idx,
        condition_to_idx=cond_to_idx,
        brand_to_idx=brand_to_idx,
    )
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    cond_ckpt = torch.load(MODELS_DIR / "condition_model.pt", map_location=DEVICE)
    brand_ckpt = torch.load(MODELS_DIR / "brand_model.pt", map_location=DEVICE)
    price_ckpt = torch.load(MODELS_DIR / "price_model.pt", map_location=DEVICE)

    condition_model = LightweightCNN(num_classes=cond_ckpt["num_classes"], embedding_dim=EMBED_DIM).to(DEVICE)
    condition_model.load_state_dict(cond_ckpt["model_state_dict"])
    condition_model.eval()

    brand_model = LightweightCNN(num_classes=brand_ckpt["num_classes"], embedding_dim=EMBED_DIM).to(DEVICE)
    brand_model.load_state_dict(brand_ckpt["model_state_dict"])
    brand_model.eval()

    price_model = PriceRegressionModel(
        condition_embed_dim=EMBED_DIM,
        brand_embed_dim=EMBED_DIM,
        num_categories=price_ckpt["num_categories"],
        category_embed_dim=32,
        hidden_dims=[128, 64],
    ).to(DEVICE)
    price_model.load_state_dict(price_ckpt["model_state_dict"])
    price_model.eval()

    cond_correct = cond_total = brand_correct = brand_total = 0
    price_errors = []

    with torch.no_grad():
        for batch in test_loader:
            full = batch["image_full"].to(DEVICE)
            label = batch["image_label"].to(DEVICE)
            cat_idx = batch["category_idx"].to(DEVICE)
            cond_idx = batch["condition_idx"].to(DEVICE)
            brand_idx = batch["brand_idx"].to(DEVICE)
            price = batch["price"]

            cond_logits, cond_embed = condition_model(full)
            brand_logits, brand_embed = brand_model(label)
            pred_price = price_model(cond_embed, brand_embed, cat_idx)

            cond_pred = cond_logits.argmax(1)
            cond_correct += (cond_pred == cond_idx).sum().item()
            cond_total += cond_idx.size(0)

            brand_pred = brand_logits.argmax(1)
            brand_correct += (brand_pred == brand_idx).sum().item()
            brand_total += brand_idx.size(0)

            for i in range(price.size(0)):
                price_errors.append((pred_price[i].item() - price[i].item()) ** 2)

    cond_acc = cond_correct / cond_total if cond_total else 0
    brand_acc = brand_correct / brand_total if brand_total else 0
    mse = sum(price_errors) / len(price_errors) if price_errors else 0
    rmse = mse ** 0.5

    print("Test set metrics:")
    print(f"  Condition accuracy: {cond_acc:.4f}")
    print(f"  Brand accuracy:      {brand_acc:.4f}")
    print(f"  Price RMSE (PHP):    {rmse:.2f}")
    print(f"  Price MSE:           {mse:.2f}")


if __name__ == "__main__":
    main()
