"""
ML Engine: loads condition, brand, and price models; runs inference.
"""
import io
from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms

# Add project root for imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(PROJECT_ROOT))

from training.models import LightweightCNN, PriceRegressionModel

MODELS_DIR = PROJECT_ROOT / "models"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMAGE_SIZE = 224


def get_image_transform():
    return transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])


class MLEngine:
    def __init__(self, models_dir: Path = None):
        self.models_dir = models_dir or MODELS_DIR
        self.transform = get_image_transform()
        self.condition_model = None
        self.brand_model = None
        self.price_model = None
        self.condition_to_idx = None
        self.idx_to_condition = None
        self.brand_to_idx = None
        self.idx_to_brand = None
        self.category_to_idx = None
        self._loaded = False

    def load(self):
        if self._loaded:
            return
        cond_path = self.models_dir / "condition_model.pt"
        brand_path = self.models_dir / "brand_model.pt"
        price_path = self.models_dir / "price_model.pt"
        if not cond_path.exists() or not brand_path.exists() or not price_path.exists():
            raise FileNotFoundError(
                "Missing model files. Run training first (e.g. training/train_all.py)."
            )
        cond_ckpt = torch.load(cond_path, map_location=DEVICE)
        brand_ckpt = torch.load(brand_path, map_location=DEVICE)
        price_ckpt = torch.load(price_path, map_location=DEVICE)

        self.condition_to_idx = cond_ckpt["condition_to_idx"]
        self.idx_to_condition = {v: k for k, v in self.condition_to_idx.items()}
        self.brand_to_idx = brand_ckpt["brand_to_idx"]
        self.idx_to_brand = {v: k for k, v in self.brand_to_idx.items()}
        self.category_to_idx = price_ckpt["category_to_idx"]

        self.condition_model = LightweightCNN(
            num_classes=cond_ckpt["num_classes"],
            embedding_dim=64,
        ).to(DEVICE)
        self.condition_model.load_state_dict(cond_ckpt["model_state_dict"])
        self.condition_model.eval()

        self.brand_model = LightweightCNN(
            num_classes=brand_ckpt["num_classes"],
            embedding_dim=64,
        ).to(DEVICE)
        self.brand_model.load_state_dict(brand_ckpt["model_state_dict"])
        self.brand_model.eval()

        self.price_model = PriceRegressionModel(
            condition_embed_dim=64,
            brand_embed_dim=64,
            num_categories=price_ckpt["num_categories"],
            category_embed_dim=32,
            hidden_dims=[128, 64],
        ).to(DEVICE)
        self.price_model.load_state_dict(price_ckpt["model_state_dict"])
        self.price_model.eval()
        self._loaded = True

    def _image_to_tensor(self, image_bytes: bytes) -> torch.Tensor:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return self.transform(img).unsqueeze(0).to(DEVICE)

    def predict(
        self,
        image_full_bytes: bytes,
        image_label_bytes: bytes,
        category: str,
    ) -> dict:
        self.load()
        full_t = self._image_to_tensor(image_full_bytes)
        label_t = self._image_to_tensor(image_label_bytes)
        category_idx = self.category_to_idx.get(category, 0)
        category_t = torch.tensor([category_idx], dtype=torch.long, device=DEVICE)

        with torch.no_grad():
            cond_logits, cond_embed = self.condition_model(full_t)
            brand_logits, brand_embed = self.brand_model(label_t)
            price = self.price_model(cond_embed, brand_embed, category_t)

        condition_idx = cond_logits.argmax(1).item()
        brand_idx = brand_logits.argmax(1).item()
        price_php = max(0.0, price.item())

        return {
            "condition": self.idx_to_condition.get(condition_idx, "good"),
            "brand": self.idx_to_brand.get(brand_idx, "unbranded"),
            "estimated_price_php": round(price_php, 2),
            "currency": "PHP",
        }


# Singleton for API
_engine: MLEngine = None


def get_engine() -> MLEngine:
    global _engine
    if _engine is None:
        _engine = MLEngine()
    return _engine
