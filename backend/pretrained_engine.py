"""
Pretrained inference engine (no task-specific training required).
Uses Hugging Face CLIP zero-shot classification for condition and brand,
and a heuristic price regressor calibrated for thrift use-cases in PHP.
"""
import io
from pathlib import Path

import torch
import yaml
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "config" / "config.yaml"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

DEFAULT_CATEGORIES = ["clothing", "bags", "shoes", "accessories", "electronics", "other"]
DEFAULT_CONDITIONS = ["poor", "fair", "good", "excellent"]
DEFAULT_BRANDS = ["unbranded", "nike", "adidas", "zara", "h&m", "levis", "gucci", "louis vuitton"]
BASE_PRICE_BY_CATEGORY = {
    "clothing": 280.0,
    "bags": 420.0,
    "shoes": 550.0,
    "accessories": 240.0,
    "electronics": 900.0,
    "other": 300.0,
}
CONDITION_MULTIPLIER = {
    "poor": 0.45,
    "fair": 0.7,
    "good": 1.0,
    "excellent": 1.25,
}
PREMIUM_BRANDS = {
    "gucci", "prada", "chanel", "dior", "balenciaga", "louis vuitton", "burberry", "coach",
}


class PretrainedEngine:
    def __init__(self):
        self.model = None
        self.processor = None
        self.categories = DEFAULT_CATEGORIES
        self.condition_labels = DEFAULT_CONDITIONS
        self.brand_labels = DEFAULT_BRANDS
        self.category_to_idx = {c: i for i, c in enumerate(self.categories)}
        self._loaded = False

    def _load_config(self):
        if not CONFIG_PATH.exists():
            return
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
        ds = cfg.get("dataset", {})
        cats = ds.get("categories") or self.categories
        conds = ds.get("condition_labels") or self.condition_labels
        brands = ds.get("brand_labels") or self.brand_labels
        self.categories = [str(x).lower() for x in cats]
        self.condition_labels = [str(x).lower() for x in conds]
        self.brand_labels = [str(x).lower() for x in brands]
        self.category_to_idx = {c: i for i, c in enumerate(self.categories)}

    def load(self):
        if self._loaded:
            return
        self._load_config()
        self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(DEVICE)
        self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        self.model.eval()
        self._loaded = True

    @staticmethod
    def _to_image(image_bytes: bytes) -> Image.Image:
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")

    def _zero_shot_label(self, image: Image.Image, prompts: list[str], labels: list[str]):
        inputs = self.processor(text=prompts, images=image, return_tensors="pt", padding=True)
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits_per_image[0], dim=-1)
            idx = int(torch.argmax(probs).item())
            conf = float(probs[idx].item())
        return labels[idx], conf

    def _estimate_price(self, category: str, condition: str, brand: str, cond_conf: float, brand_conf: float) -> float:
        c = category.lower().strip()
        base = BASE_PRICE_BY_CATEGORY.get(c, BASE_PRICE_BY_CATEGORY["other"])
        cond_mult = CONDITION_MULTIPLIER.get(condition.lower(), 1.0)

        b = brand.lower().strip()
        if b in {"unbranded", "local", "other_brand"}:
            brand_mult = 0.85
        elif b in PREMIUM_BRANDS:
            brand_mult = 1.35
        else:
            brand_mult = 1.08

        confidence_scale = 0.8 + 0.2 * ((cond_conf + brand_conf) / 2.0)
        return round(max(0.0, base * cond_mult * brand_mult * confidence_scale), 2)

    def predict(self, image_full_bytes: bytes, image_label_bytes: bytes, category: str) -> dict:
        self.load()

        full_image = self._to_image(image_full_bytes)
        label_image = self._to_image(image_label_bytes)

        condition_prompts = [
            "a photo of a second-hand item in poor condition, damaged, stained, torn",
            "a photo of a second-hand item in fair condition, visible signs of wear",
            "a photo of a second-hand item in good condition, minor wear, usable",
            "a photo of a second-hand item in excellent condition, very clean, like new",
        ]
        brand_prompts = [f"a close-up photo of a thrift item brand label showing {b}" for b in self.brand_labels]

        condition, condition_conf = self._zero_shot_label(full_image, condition_prompts, self.condition_labels)
        brand, brand_conf = self._zero_shot_label(label_image, brand_prompts, self.brand_labels)
        estimated_price_php = self._estimate_price(category, condition, brand, condition_conf, brand_conf)

        return {
            "engine": "pretrained_clip_zero_shot",
            "condition": condition,
            "condition_confidence": round(condition_conf, 4),
            "brand": brand,
            "brand_confidence": round(brand_conf, 4),
            "estimated_price_php": estimated_price_php,
            "currency": "PHP",
            "notes": "No training required: CLIP zero-shot for condition/brand + heuristic price regression.",
        }


_pretrained_engine = None


def get_pretrained_engine() -> PretrainedEngine:
    global _pretrained_engine
    if _pretrained_engine is None:
        _pretrained_engine = PretrainedEngine()
    return _pretrained_engine
