"""
Backend API: receives category + two images, returns condition, brand, estimated price (PHP).
By default it uses a pretrained zero-shot engine (no model training required).
Set USE_LOCAL_TRAINED_MODELS=1 to use local trained .pt models instead.
"""
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.pretrained_engine import get_pretrained_engine
    from backend.ml_engine import get_engine as get_local_engine
except ImportError:
    from pretrained_engine import get_pretrained_engine
    from ml_engine import get_engine as get_local_engine

app = FastAPI(
    title="Thrift Price Estimator API",
    description="Estimate thrift item prices from full-item and brand-label images.",
)

origins_env = os.getenv("ALLOWED_ORIGINS", "*")
if origins_env.strip() == "*":
    allow_origins = ["*"]
    allow_credentials = False
else:
    allow_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_IMAGE_MB = int(os.getenv("MAX_IMAGE_MB", "5"))
USE_LOCAL_TRAINED_MODELS = os.getenv("USE_LOCAL_TRAINED_MODELS", "0") == "1"
DEFAULT_CATEGORIES = ["clothing", "bags", "shoes", "accessories", "electronics", "other"]


def _get_runtime_engine():
    if USE_LOCAL_TRAINED_MODELS:
        return get_local_engine(), "local_trained"
    return get_pretrained_engine(), "pretrained"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "local_trained" if USE_LOCAL_TRAINED_MODELS else "pretrained_zero_shot",
    }


@app.get("/")
def root():
    return {
        "name": "Thrift Price Estimator API",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/categories")
def list_categories():
    engine, _ = _get_runtime_engine()
    try:
        engine.load()
        categories = getattr(engine, "category_to_idx", None)
        if isinstance(categories, dict) and categories:
            return {"categories": list(categories.keys())}
        categories = getattr(engine, "categories", None)
        if isinstance(categories, list) and categories:
            return {"categories": categories}
    except Exception:
        pass
    return {"categories": DEFAULT_CATEGORIES}


@app.post("/estimate")
async def estimate_price(
    category: str = Form(...),
    image_full: UploadFile = File(...),
    image_label: UploadFile = File(...),
):
    if not image_full.content_type or not image_full.content_type.startswith("image/"):
        raise HTTPException(400, "image_full must be an image")
    if not image_label.content_type or not image_label.content_type.startswith("image/"):
        raise HTTPException(400, "image_label must be an image")

    full_bytes = await image_full.read()
    label_bytes = await image_label.read()
    if len(full_bytes) > MAX_IMAGE_MB * 1024 * 1024 or len(label_bytes) > MAX_IMAGE_MB * 1024 * 1024:
        raise HTTPException(400, f"Images must be under {MAX_IMAGE_MB}MB each")

    engine, mode = _get_runtime_engine()
    try:
        result = engine.predict(full_bytes, label_bytes, category)
        if isinstance(result, dict) and "engine" not in result:
            result["engine"] = mode
        return result
    except FileNotFoundError:
        raise HTTPException(503, "Local models missing. Either train models or use pretrained mode.")
    except Exception as e:
        raise HTTPException(500, str(e))
