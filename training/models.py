"""
Lightweight CNNs for condition and brand classification; regression head for price.
"""
import torch
import torch.nn as nn
from torchvision import models


class LightweightCNN(nn.Module):
    """Lightweight CNN for condition or brand classification; outputs class logits + embedding."""

    def __init__(self, num_classes: int, embedding_dim: int = 64, pretrained: bool = True):
        super().__init__()
        self.backbone = models.mobilenet_v3_small(weights="DEFAULT" if pretrained else None)
        in_features = self.backbone.classifier[0].in_features
        self.backbone.classifier = nn.Identity()
        self.fc_embed = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, embedding_dim),
        )
        self.fc_class = nn.Linear(embedding_dim, num_classes)
        self.embedding_dim = embedding_dim
        self.num_classes = num_classes

    def forward(self, x):
        features = self.backbone(x)
        embedding = self.fc_embed(features)
        logits = self.fc_class(embedding)
        return logits, embedding


class PriceRegressionModel(nn.Module):
    """Takes condition embedding, brand embedding, category one-hot; outputs price (PHP)."""

    def __init__(
        self,
        condition_embed_dim: int = 64,
        brand_embed_dim: int = 64,
        num_categories: int = 6,
        category_embed_dim: int = 32,
        hidden_dims: list = None,
    ):
        super().__init__()
        hidden_dims = hidden_dims or [128, 64]
        input_dim = condition_embed_dim + brand_embed_dim + category_embed_dim
        layers = []
        prev = input_dim
        for h in hidden_dims:
            layers += [nn.Linear(prev, h), nn.ReLU(inplace=True), nn.Dropout(0.2)]
            prev = h
        layers.append(nn.Linear(prev, 1))
        self.mlp = nn.Sequential(*layers)
        self.category_embed = nn.Embedding(num_categories, category_embed_dim)

    def forward(self, condition_embed: torch.Tensor, brand_embed: torch.Tensor, category_idx: torch.Tensor):
        cat_embed = self.category_embed(category_idx)
        x = torch.cat([condition_embed, brand_embed, cat_embed], dim=1)
        return self.mlp(x).squeeze(-1)
