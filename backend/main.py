"""
Backend API: receives category + two images, returns condition, brand, estimated price (PHP).
By default it uses a pretrained zero-shot engine (no model training required).
Set USE_LOCAL_TRAINED_MODELS=1 to use local trained .pt models instead.
"""
import logging
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from backend.pretrained_engine import get_pretrained_engine
    from backend.ml_engine import get_engine as get_local_engine
except ImportError:
    from pretrained_engine import get_pretrained_engine
    from ml_engine import get_engine as get_local_engine

logger = logging.getLogger("te2.api")
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

origins_env = os.getenv("ALLOWED_ORIGINS", "*")
if origins_env.strip() == "*":
    allow_origins = ["*"]
    allow_credentials = False
else:
    allow_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
    allow_credentials = True

MAX_IMAGE_MB = int(os.getenv("MAX_IMAGE_MB", "5"))
USE_LOCAL_TRAINED_MODELS = os.getenv("USE_LOCAL_TRAINED_MODELS", "0") == "1"
DEFAULT_CATEGORIES = ["clothing", "bags", "shoes", "accessories", "electronics", "other"]
MODEL_VERSION = os.getenv("MODEL_VERSION", "pretrained-clip-v1")
CALIBRATION_VERSION = os.getenv("CALIBRATION_VERSION", "2026-04")
_ready_state = {"ready": False, "reason": "initializing"}
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CALIBRATION_FILE = PROJECT_ROOT / "data" / "calibration.json"


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        engine, mode = _get_runtime_engine()
        engine.load()
        _ready_state["ready"] = True
        _ready_state["reason"] = "ok"
        logger.info('event=startup_ready mode=%s model_version=%s', mode, MODEL_VERSION)
    except Exception as exc:
        _ready_state["ready"] = False
        _ready_state["reason"] = str(exc)
        logger.exception("event=startup_failed")
    yield


app = FastAPI(
    title="Thrift Price Estimator API",
    description="Estimate thrift item prices from full-item and brand-label images.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_runtime_engine():
    if USE_LOCAL_TRAINED_MODELS:
        return get_local_engine(), "local_trained"
    return get_pretrained_engine(), "pretrained"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "local_trained" if USE_LOCAL_TRAINED_MODELS else "pretrained_zero_shot",
        "ready": _ready_state["ready"],
    }


@app.get("/")
def root():
    return {"message": "API is running"}


@app.get("/ready")
def ready():
    if not _ready_state["ready"]:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": _ready_state["reason"]},
        )
    return {"status": "ready"}


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


@app.get("/calibration")
def calibration():
    if CALIBRATION_FILE.exists():
        with open(CALIBRATION_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        data.setdefault("version", CALIBRATION_VERSION)
        return data
    return {
        "version": CALIBRATION_VERSION,
        "pricePriors": {},
        "residualStd": {"default": 0.18},
    }


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception('event=request_unhandled method=%s path=%s request_id=%s', request.method, request.url.path, request_id)
        return JSONResponse(
            status_code=500,
            content={"error": "internal_server_error", "request_id": request_id},
        )

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    response.headers["x-request-id"] = request_id
    logger.info(
        "event=request_complete method=%s path=%s status=%s latency_ms=%s request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
        request_id,
    )
    return response


@app.post("/estimate")
async def estimate_price(
    request: Request,
    category: str = Form(...),
    image_full: UploadFile = File(...),
    image_label: UploadFile = File(...),
    selected_brand: str = Form("unbranded"),
    photo_category_match: bool = Form(True),
    manual_condition: str = Form(""),
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
    started = time.perf_counter()
    try:
        result = engine.predict(full_bytes, label_bytes, category)
        if isinstance(result, dict) and "engine" not in result:
            result["engine"] = mode
        if selected_brand and selected_brand != "unbranded":
            result["selected_brand"] = selected_brand.lower()
        if manual_condition:
            result["manual_condition_hint"] = manual_condition.lower()
        result["photo_category_match"] = bool(photo_category_match)
        result["confidence"] = round(
            float(result.get("condition_confidence", 0.65) + result.get("brand_confidence", 0.65)) / 2.0,
            4,
        )
        result["metadata"] = {
            "model_version": MODEL_VERSION,
            "calibration_version": CALIBRATION_VERSION,
            "inference_ms": int((time.perf_counter() - started) * 1000),
            "request_id": request.headers.get("x-request-id"),
        }
        return result
    except FileNotFoundError:
        raise HTTPException(503, "Local models missing. Either train models or use pretrained mode.")
    except Exception:
        logger.exception("event=estimate_failed")
        raise HTTPException(500, "Inference failed. Please retry.")
