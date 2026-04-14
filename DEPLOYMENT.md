# Railway Deployment Guide — ATS Backend

**Stack: Django + Celery + Redis → Railway | PostgreSQL → Supabase | Files → AWS S3 | Frontend → Vercel**

---

## Architecture

```
User → Vercel (React SPA)
          │
          │  /api/* rewrites (vercel.json)
          ▼
       Railway Project
       ├── Web Service    (Django + Gunicorn, built from Dockerfile)
       ├── Worker Service (Celery, same repo, different start command)
       └── Redis          (Railway managed add-on)
                │
                ├──► Supabase (PostgreSQL — external, already configured)
                └──► AWS S3   (resume file storage — external)
```

---

## Pre-requisites

- [ ] Code pushed to GitHub (`main` branch)
- [ ] [Railway](https://railway.app) account (free hobby plan works)
- [ ] Supabase project with `DATABASE_URL` ready
- [ ] AWS S3 bucket for resume storage (with IAM user credentials)
- [ ] Gemini API key for resume parsing

---

## Environment Variables Reference

Both the **Web Service** and **Worker Service** need all of these variables.

| Variable | Example Value | Notes |
|----------|--------------|-------|
| `DJANGO_SETTINGS_MODULE` | `config.settings.prod` | Required — activates production settings |
| `SECRET_KEY` | `50-char-random-string` | Generate with command below |
| `DEBUG` | `False` | Must be `False` in production |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Your Supabase connection string |
| `ALLOWED_HOSTS` | `backend-xyz.up.railway.app` | Your Railway domain (no `https://`) |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` | Your Vercel frontend URL |
| `CSRF_TRUSTED_ORIGINS` | `https://backend-xyz.up.railway.app` | Same as ALLOWED_HOSTS with `https://` prefix |
| `CELERY_BROKER_URL` | `${{Redis.REDIS_URL}}` | Railway variable reference — auto-resolves |
| `CELERY_RESULT_BACKEND` | `${{Redis.REDIS_URL}}` | Railway variable reference — auto-resolves |
| `GEMINI_API_KEYS` | `AIzaSy...` | Gemini key for resume parsing |
| `GEMINI_MODEL_NAME` | `gemini-2.0-flash` | LLM model name |
| `RESUME_MAX_FILE_SIZE_MB` | `10` | Max resume upload size in MB |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | AWS IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | `abc123...` | AWS IAM user secret key |
| `AWS_S3_BUCKET` | `my-ats-resumes` | S3 bucket name |
| `AWS_REGION` | `us-west-2` | Bucket's AWS region |

**Generate a fresh SECRET_KEY (run locally):**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## Phase 1 — Railway: Web Service

### Step 1.1 — Create Railway Project

1. Go to [railway.app](https://railway.app) → click **New Project**
2. Select **Deploy from GitHub repo**
3. Authorize Railway to access your GitHub and select this repository
4. When prompted for **Root Directory** → enter `backend`
5. **Do not deploy yet** — set up Redis first

### Step 1.2 — Add Redis

1. In the Railway project canvas → click **+ New**
2. Select **Database** → **Add Redis**
3. Wait ~30 seconds for Redis to provision
4. Click the Redis service tile → **Variables** tab → you'll see `REDIS_URL`
   - You don't need to copy it manually — use Railway variable references in the next step

### Step 1.3 — Configure Web Service Environment Variables

1. Click your **Django web service** tile → **Variables** tab
2. Add each variable from the table above one by one using **+ New Variable**
3. For the Redis variables, use Railway's reference syntax (it resolves at runtime):
   ```
   CELERY_BROKER_URL    →  ${{Redis.REDIS_URL}}
   CELERY_RESULT_BACKEND → ${{Redis.REDIS_URL}}
   ```
4. For `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`: use `*` temporarily for the first deploy — you'll update them once you have the Railway URL
5. Make sure `DJANGO_SETTINGS_MODULE=config.settings.prod` is set

### Step 1.4 — Verify railway.toml Settings

The `backend/railway.toml` is already configured correctly:

```toml
[build]
dockerfile = "Dockerfile"

[deploy]
preDeployCommand = "python manage.py migrate --noinput"
startCommand = "gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120 --preload"
healthcheckPath = "/admin/login/"
healthcheckTimeout = 60
restartPolicyType = "on_failure"
```

No changes needed here.

### Step 1.5 — First Deploy

1. Click **Deploy** on the web service
2. Watch the **Build Logs** — Railway will:
   - Pull your GitHub repo
   - Build the Docker image (`pip install`, `collectstatic` baked in)
   - Run `python manage.py migrate --noinput` (preDeployCommand)
   - Start Gunicorn
3. Wait for the health check to pass (`/admin/login/` returns 200)

If the build fails, check the logs — the most common issue is a missing environment variable.

### Step 1.6 — Update ALLOWED_HOSTS

1. Once the deploy succeeds, click **Settings** on the web service
2. Under **Domains**, copy your Railway URL (e.g. `backend-xyz.up.railway.app`)
3. Go back to **Variables** → update:
   ```
   ALLOWED_HOSTS       → backend-xyz.up.railway.app
   CSRF_TRUSTED_ORIGINS → https://backend-xyz.up.railway.app
   ```
4. Railway will automatically redeploy with the new values

### Step 1.7 — Create Django Superuser

1. Web service → **Deploy** tab → **Shell** (or install Railway CLI)
2. Run:
   ```bash
   python manage.py createsuperuser
   ```
3. Enter email, name, password
4. Test at: `https://backend-xyz.up.railway.app/admin/`

---

## Phase 2 — Railway: Celery Worker Service

The Celery worker runs from the **same code** but with a different start command. It has no HTTP port.

### Step 2.1 — Add Worker Service

1. Railway project canvas → **+ New** → **GitHub Repo** → select the same repo
2. Root Directory: `backend`
3. Railway will try to deploy it the same way as the web service — override the start command next

### Step 2.2 — Override Start Command

1. Click the new worker service → **Settings**
2. Under **Deploy** → **Start Command** → enter:
   ```
   celery -A config worker -l info --concurrency 2
   ```
3. There is no health check needed for workers — Railway won't expose a port

### Step 2.3 — Copy Environment Variables

The worker needs **all the same environment variables** as the web service.

**Option A — Manual copy** (for first time):
Go to Variables tab and add the same set of variables.

**Option B — Railway "shared variables"**:
In the Railway project → **Variables** (project-level, not service-level) → add variables here and both services inherit them automatically.

### Step 2.4 — Deploy Worker

Click Deploy. Watch logs for:
```
[celery] ready.
celery@hostname ready.
```

To test the worker, upload a resume via the frontend/API and watch the worker service logs for a `process_resume` task being picked up and executed.

---

## Phase 3 — Vercel: Connect Frontend to Railway

### Step 3.1 — Update vercel.json

Open [frontend/vercel.json](frontend/vercel.json) and replace the placeholder with your Railway URL:

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

Commit and push to GitHub:
```bash
git add frontend/vercel.json
git commit -m "chore: point vercel rewrite to railway backend"
git push origin main
```

Vercel will auto-redeploy.

### Step 3.2 — Update CORS on Railway

After Vercel deploys, get your Vercel URL (e.g. `https://ats-app.vercel.app`).

Railway → Web service → Variables → update:
```
CORS_ALLOWED_ORIGINS=https://ats-app.vercel.app
```

Railway auto-redeploys. No code change needed.

---

## Phase 4 — Verification Checklist

Run through each check after all services are deployed:

| Check | How to verify |
|-------|--------------|
| Django admin login | Visit `https://backend-xyz.up.railway.app/admin/` — login with superuser |
| API docs load | Visit `https://backend-xyz.up.railway.app/api/docs/` — Swagger UI visible |
| Health check passes | `curl https://backend-xyz.up.railway.app/admin/login/` returns 200 |
| Frontend loads | Visit your Vercel URL — login page visible, no blank screen |
| JWT login works | Login with credentials — JWT returned, dashboard loads |
| API proxy works | Dashboard data loads (proxied through Vercel → Railway) |
| Resume upload | Upload a PDF resume — check worker service logs for `process_resume` task |
| S3 storage | Uploaded resume file accessible via pre-signed URL |

---

## Troubleshooting

### `DisallowedHost at /`
```
ALLOWED_HOSTS does not include 'backend-xyz.up.railway.app'
```
**Fix:** Set `ALLOWED_HOSTS=backend-xyz.up.railway.app` in Railway variables (no `https://`, no trailing slash)

---

### 502 Bad Gateway / SSL redirect loop
**Fix:** Confirm these are in `backend/config/settings/prod.py`:
```python
SECURE_SSL_REDIRECT = False   # Railway terminates SSL at its proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

---

### CSRF verification failed on admin login
```
CSRF verification failed. Request aborted.
```
**Fix:** Set in Railway variables:
```
CSRF_TRUSTED_ORIGINS=https://backend-xyz.up.railway.app
```

---

### CORS error in browser
```
Access to XMLHttpRequest blocked by CORS policy
```
**Fix:**
- Set `CORS_ALLOWED_ORIGINS=https://your-app.vercel.app` (exact URL, `https://`, no trailing slash)
- For multiple origins use comma-separated: `https://a.vercel.app,https://custom-domain.com`

---

### Celery tasks not running
**Fix:**
1. Confirm worker service is deployed and running (green status in Railway)
2. Check `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` are set and point to Railway Redis
3. Check worker service has the same env vars as web service
4. In worker logs look for connection errors to Redis

---

### Resume upload fails (S3 error)
**Fix:**
1. Verify `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION` are set
2. Verify the S3 bucket exists in the specified region
3. Verify the IAM user has these permissions on the bucket:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`

---

### Build fails: `ModuleNotFoundError`
**Fix:**
- Ensure the missing package is in `backend/requirements.txt`
- Run `pip freeze > requirements.txt` locally and commit the updated file

---

### Migration errors on deploy
```
django.db.utils.OperationalError: could not connect to server
```
**Fix:**
1. Verify `DATABASE_URL` is correct and Supabase is accepting connections
2. Supabase requires the pooled connection string for Django — use the one with port 5432 (not 6543)
3. Run migrations manually via Railway shell: `python manage.py migrate`

---

## Files Changed for Production

| File | What Changed |
|------|-------------|
| `backend/.dockerignore` | New — prevents `.env`, `venv/`, `media/` from leaking into Docker image |
| `backend/config/settings/base.py` | `.env` file reading made conditional (safe on Railway with no `.env`) |
| `backend/config/settings/prod.py` | Added `CSRF_TRUSTED_ORIGINS` env var for Django admin HTTPS compatibility |
| `backend/Dockerfile` | Already production-ready (collectstatic at build time, gunicorn CMD) |
| `backend/railway.toml` | Already configured (migrate pre-deploy, gunicorn start, health check) |
| `frontend/vercel.json` | Update `destination` with actual Railway URL after Phase 1 |
