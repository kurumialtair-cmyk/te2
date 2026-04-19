# Thrift Item Price Estimator

A machine learningâ€“powered mobile application that estimates thrift item prices using two captured images: one for **condition** (full item) and one for **brand authenticity** (brand label). The system combines lightweight CNNs for visual analysis with a regression model for price prediction in Philippine Peso (PHP).

## Architecture

- **Mobile App (Frontend)**: UI module + camera module for category selection and two-image capture.
- **Backend Server**: API controller + ML engine (Condition model, Brand model, Price model).
- **Data flow**: Category + Image 1 (full item) + Image 2 (brand label) â†’ Condition + Brand analysis â†’ Price regression â†’ Estimated price (PHP).

## Project Structure

```
te2/
â”œâ”€â”€ data/                 # Dataset (images, annotations)
â”‚   â”œâ”€â”€ annotations.json  # Labeled items (category, condition, brand, price_php, image paths)
â”‚   â”œâ”€â”€ images/           # Full-item and brand-label images
â”‚   â””â”€â”€ splits/           # train.json, val.json, test.json (generated)
â”œâ”€â”€ dataset/              # Dataset preparation scripts
â”œâ”€â”€ models/               # Trained model weights (condition_model.pt, brand_model.pt, price_model.pt)
â”œâ”€â”€ training/             # Model training and evaluation
â”œâ”€â”€ backend/              # FastAPI inference server
â”œâ”€â”€ mobile/               # Mobile app (Expo / React Native)
â”œâ”€â”€ config/               # config.yaml (categories, labels, training params)
â””â”€â”€ README.md
```

## Dataset Format

`data/annotations.json` should contain an array of items:

```json
{
  "items": [
    {
      "id": "unique_id",
      "category": "clothing",
      "condition": "good",
      "brand": "local",
      "price_php": 150.0,
      "image_full": "images/item1_full.jpg",
      "image_label": "images/item1_label.jpg"
    }
  ]
}
```

- **category**: one of `clothing`, `bags`, `shoes`, `accessories`, `electronics`, `other`.
- **condition**: `poor`, `fair`, `good`, `excellent`.
- **brand**: your brand labels (e.g. `unbranded`, `local`, `nike`, â€¦).
- **price_php**: resale price in Philippine Peso.
- **image_full**: path under `data/` to full-item photo.
- **image_label**: path under `data/` to brand-label photo.

Add more categories/brands in `config/config.yaml` as needed.

## Quick Start

1. **Dataset**  
   Add your thrift item annotations and images under `data/`. Then:
   ```bash
   python dataset/prepare_dataset.py
   ```
   This generates `data/splits/train.json`, `val.json`, `test.json`.

2. **Training**  
   Train condition â†’ brand â†’ price (in order):
   ```bash
   python training/train_all.py
   ```
   Or step by step: `train_condition.py` â†’ `train_brand.py` â†’ `train_price.py`.

3. **Evaluation**  
   ```bash
   python training/evaluate.py
   ```
   Reports condition accuracy, brand accuracy, and price RMSE (PHP) on the test set.

4. **Backend**  
   From project root:
   ```bash
   pip install -r backend/requirements.txt
   python run_backend.py
   ```
   Default mode is **pretrained zero-shot** (no custom training needed). The first run will auto-download `openai/clip-vit-base-patch32` from Hugging Face.  
   To use your own trained `.pt` models instead, set `USE_LOCAL_TRAINED_MODELS=1`.  
   API docs: http://localhost:8000/docs

5. **Mobile**  
   In `mobile/api.js` set `API_BASE` to your backend URL (e.g. your machineâ€™s IP for a physical device). Then:
   ```bash
   cd mobile && npm install && npx expo start
   ```
   Use â€œGet price estimateâ€ after selecting category and adding both images.

## API

- **POST /estimate**  
  - Form fields: `category` (string), `image_full` (file), `image_label` (file).  
  - Response: `{ "condition", "brand", "estimated_price_php", "currency": "PHP" }`.

- **GET /categories**  
  - Returns list of categories (from trained price model or defaults).

## Deployment

- **Backend**: Run behind gunicorn/uvicorn and a reverse proxy (e.g. Nginx). Ensure `models/` is present on the server and Python can import `training.models` (run from project root or set `PYTHONPATH`).
- **Mobile**: Build with `expo build` or EAS; set `API_BASE` in `api.js` (or via env) to your production API URL.

## Requirements

- **Python 3.10+**: PyTorch, torchvision, FastAPI, uvicorn, Pillow, PyYAML (see `backend/requirements.txt`).
- **Node.js 18+** for mobile (Expo). See `mobile/package.json`.


## Pretrained Models Used

- openai/clip-vit-base-patch32 (Hugging Face): zero-shot condition and brand-label classification.
- Price is estimated via configurable thrift heuristics using category + condition + brand confidence (fast, no training).
- Your mercari_lgb_tuned.py file is a training script (not a ready pretrained checkpoint).
- Your customer-segmentation.ipynb is for clustering and does not help image-based thrift pricing directly.

