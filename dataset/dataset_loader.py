"""
PyTorch dataset and data loaders for condition, brand, and price models.
"""
import json
from pathlib import Path

import torch
from torch.utils.data import Dataset
from PIL import Image
from torchvision import transforms

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
SPLITS_DIR = DATA_DIR / "splits"


def get_image_transform(image_size: int = 224, train: bool = True):
    base = [
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
    if train:
        base.insert(1, transforms.RandomHorizontalFlip())
    return transforms.Compose(base)


class ThriftItemDataset(Dataset):
    """Dataset that loads full image, label image, category, condition, brand, price."""

    def __init__(
        self,
        split: str = "train",
        data_dir: Path = None,
        image_size: int = 224,
        train: bool = True,
        category_to_idx: dict = None,
        condition_to_idx: dict = None,
        brand_to_idx: dict = None,
    ):
        data_dir = data_dir or DATA_DIR
        splits_dir = data_dir / "splits"
        with open(splits_dir / f"{split}.json") as f:
            self.items = json.load(f)
        self.data_dir = data_dir
        self.transform = get_image_transform(image_size, train=train)
        self.category_to_idx = category_to_idx or {}
        self.condition_to_idx = condition_to_idx or {}
        self.brand_to_idx = brand_to_idx or {}

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        item = self.items[idx]
        full_path = self.data_dir / item["image_full"]
        label_path = self.data_dir / item["image_label"]

        full_img = Image.open(full_path).convert("RGB") if full_path.exists() else Image.new("RGB", (224, 224), (128, 128, 128))
        label_img = Image.open(label_path).convert("RGB") if label_path.exists() else Image.new("RGB", (224, 224), (128, 128, 128))

        full_tensor = self.transform(full_img)
        label_tensor = self.transform(label_img)

        category_idx = self.category_to_idx.get(item["category"], 0)
        condition_idx = self.condition_to_idx.get(item["condition"], 0)
        brand_idx = self.brand_to_idx.get(item["brand"], 0)
        price = float(item["price_php"])

        return {
            "image_full": full_tensor,
            "image_label": label_tensor,
            "category_idx": torch.tensor(category_idx, dtype=torch.long),
            "condition_idx": torch.tensor(condition_idx, dtype=torch.long),
            "brand_idx": torch.tensor(brand_idx, dtype=torch.long),
            "price": torch.tensor(price, dtype=torch.float32),
            "id": item["id"],
        }
