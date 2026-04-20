# Production API Deployment (GitHub + Render)

This setup is based on Render's FastAPI + GitHub auto-deploy flow.

## Critical Render commands (fixes your error)

Your error came from this invalid start command:

- `uvicorn ../run_backend:app --host 0.0.0.0 --port $PORT`

Use these exact settings:

- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path:** `/health`
- **Environment Variable:** `PYTHON_VERSION=3.11.9`

Also keep `backend/runtime.txt` in repo as an extra Python version pin.

Do **not** use `../run_backend:app` in Render start command.

## 1) Connect repository

1. Open [Render Dashboard](https://dashboard.render.com/).
2. Click **New** -> **Blueprint**.
3. Select this GitHub repository (`te2`).
4. Render will detect `render.yaml` and create `te2-api` with the correct backend root and start command.

Render will now redeploy automatically on every push to `main`.

## 2) Confirm API is live

After first deploy, open:

- `https://<your-render-domain>/health`
- `https://<your-render-domain>/docs`

Current deployed URL in this project:

- `https://te2-ngw0.onrender.com/health`
- `https://te2-ngw0.onrender.com/docs`

If `/health` returns `{"status":"ok"...}`, API is production-ready.

## 3) Wire mobile app to production API

Choose one of these:

- **Recommended (build-time):**
  - Set env before build:
    - PowerShell: `setx EXPO_PUBLIC_API_BASE "https://te2-ngw0.onrender.com"`
  - Reopen terminal, then build APK.
- **Static config fallback:**
  - Set `expo.extra.apiBase` in `mobile/app.json`.

`mobile/api.js` priority is:

1. `EXPO_PUBLIC_API_BASE`
2. `expo.extra.apiBase`
3. dev auto-detect host (debug only)
4. production placeholder fallback

## 4) CORS for production clients

- Current default in `render.yaml`: `ALLOWED_ORIGINS=*`
- For stricter production security, replace it with comma-separated explicit domains, for example:
  - `https://your-web-app.com,https://admin.your-web-app.com`

## 5) Ongoing deployment model

- GitHub push to `main` -> Render auto-deploys API.
- Rebuild APK when API domain changes.
- Keep model mode in env:
  - `USE_LOCAL_TRAINED_MODELS=0` (pretrained mode)
  - `USE_LOCAL_TRAINED_MODELS=1` (custom local model files)
