# Deployment Guide

**Frontend → Vercel | Backend → Railway | Database → Supabase**

---

## Architecture

```
User → Vercel (React SPA)
          │
          │  /api/* rewrites (vercel.json)
          ▼
       Railway
       ├── Web Service (Django + Gunicorn)
       ├── Worker Service (Celery)
       └── Redis (Celery broker)
          │
          ▼
       Supabase (PostgreSQL)
       AWS S3 (resume file storage)
```

---

## Pre-requisites

- GitHub repo with this code pushed to `main`
- [Railway](https://railway.app) account
- [Vercel](https://vercel.com) account
- Supabase project (already configured in `.env`)
- AWS S3 bucket (or Cloudflare R2) for media file storage

---

## Phase 1 — Railway (Backend)

### 1.1 Create Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → select this repo
3. When asked for Root Directory → set to **`backend`**

### 1.2 Add Redis

In the Railway project dashboard:
1. Click **+ New** → **Database** → **Add Redis**
2. After it provisions, click the Redis service → **Variables** tab
3. Copy the value of `REDIS_URL`

### 1.3 Set Environment Variables (Web Service)

Go to the Django service → **Variables** tab → add these:

| Variable | Value |
|----------|-------|
| `DJANGO_SETTINGS_MODULE` | `config.settings.prod` |
| `SECRET_KEY` | Generate: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DEBUG` | `False` |
| `DATABASE_URL` | Your Supabase connection string |
| `ALLOWED_HOSTS` | `your-service.up.railway.app` (fill after first deploy) |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` (fill after Vercel deploy) |
| `CELERY_BROKER_URL` | Redis URL from step 1.2 |
| `CELERY_RESULT_BACKEND` | Redis URL from step 1.2 |
| `GEMINI_API_KEYS` | Your Gemini API key |
| `GEMINI_MODEL_NAME` | `gemini-2.0-flash` |
| `RESUME_MAX_FILE_SIZE_MB` | `10` |
| `AWS_ACCESS_KEY_ID` | Your AWS/R2 access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS/R2 secret key |
| `AWS_S3_BUCKET` | Your S3 bucket name |
| `AWS_REGION` | `us-west-2` (or your region) |

### 1.4 Set Deploy Command

Railway service → **Settings** → **Deploy** section → **Deploy Command**:

```
python manage.py migrate && python manage.py collectstatic --noinput
```

### 1.5 Deploy

Click **Deploy**. Wait for build + deploy to complete.

After deploy succeeds, copy your Railway URL (e.g. `https://backend-xyz.up.railway.app`).

Update the `ALLOWED_HOSTS` variable with this URL and redeploy.

### 1.6 Add Celery Worker Service

1. In the same Railway project → **+ New** → **GitHub Repo** (same repo)
2. Root Directory: `backend`
3. **Settings → Start Command** (override):
   ```
   celery -A config worker -l info
   ```
4. Add **all the same environment variables** as the web service
5. Deploy

> The worker has no HTTP port — Railway won't expose one. That's expected.

---

## Phase 2 — Vercel (Frontend)

### 2.1 Update `vercel.json`

Open [frontend/vercel.json](frontend/vercel.json) and replace `REPLACE_WITH_YOUR_RAILWAY_URL` with your actual Railway URL from Phase 1.5:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://backend-xyz.up.railway.app/api/:path*"
    }
  ]
}
```

Commit and push to GitHub.

### 2.2 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import from GitHub → select this repo
3. **Root Directory** → `frontend`
4. Framework Preset → **Vite** (auto-detected)
5. Build Command → `npm run build` (default)
6. Output Directory → `dist` (default)
7. Environment Variables → *(none required)*
8. Click **Deploy**

### 2.3 Update Railway CORS

After Vercel deploys, get your Vercel URL (e.g. `https://ats-app.vercel.app`).

Go to Railway → Web service → Variables → update:

```
CORS_ALLOWED_ORIGINS=https://ats-app.vercel.app
```

Railway will auto-redeploy.

---

## Phase 3 — Verification

| Check | URL / Action |
|-------|-------------|
| Frontend loads | `https://your-app.vercel.app` — login page visible |
| Login works | Credentials → JWT returned from Railway |
| Dashboard data | API calls proxy via Vercel rewrites |
| API docs | `https://your-railway.up.railway.app/api/docs/` |
| Django admin | `https://your-railway.up.railway.app/admin/` |
| Celery works | Upload a resume → check Railway worker service logs |

---

## Environment Variables Reference

### Railway — Web Service & Celery Worker (same vars for both)

```env
DJANGO_SETTINGS_MODULE=config.settings.prod
SECRET_KEY=<fresh generated key>
DEBUG=False
DATABASE_URL=<supabase url>
ALLOWED_HOSTS=your-service.up.railway.app
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
CELERY_BROKER_URL=<railway redis url>
CELERY_RESULT_BACKEND=<railway redis url>
GEMINI_API_KEYS=<key>
GEMINI_MODEL_NAME=gemini-2.0-flash
RESUME_MAX_FILE_SIZE_MB=10
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_S3_BUCKET=<bucket>
AWS_REGION=us-west-2
```

### Vercel — Frontend

No environment variables required.

---

## Files Changed for Production

| File | What Changed |
|------|-------------|
| `backend/config/settings/base.py` | Added `STATIC_ROOT` |
| `backend/config/settings/prod.py` | Fixed SSL redirect loop — Railway terminates SSL at proxy |
| `backend/requirements.txt` | Added `whitenoise==6.9.0` |
| `backend/Dockerfile` | New — production Docker image with gunicorn |
| `backend/railway.toml` | New — Railway build & deploy config |
| `frontend/vercel.json` | New — rewrites `/api/*` to Railway backend |

---

## Troubleshooting

**Build fails with `STATIC_ROOT` error**
→ Ensure `STATIC_ROOT = BASE_DIR / 'staticfiles'` is in `base.py`

**502 / redirect loop on Railway**
→ Confirm `SECURE_SSL_REDIRECT = False` and `SECURE_PROXY_SSL_HEADER` is set in `prod.py`

**API calls return 404 on Vercel**
→ Check `vercel.json` has the correct Railway URL in the `destination` field

**CORS errors in browser**
→ Set `CORS_ALLOWED_ORIGINS` on Railway to your exact Vercel URL (no trailing slash)

**Celery tasks not running**
→ Check worker service is deployed and has same env vars as web service
→ Verify `CELERY_BROKER_URL` points to the Railway Redis URL

**Resume files lost after Railway restart**
→ Ensure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` are set on Railway
→ S3 is already configured in `base.py` — just set the env vars
