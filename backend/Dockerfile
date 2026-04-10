FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml requirements.txt ./
RUN uv pip install --system -r requirements.txt

COPY . .

# Run collectstatic at build time so staticfiles are baked into the image.
# Dummy env vars are only used here — real values are injected at runtime.
RUN SECRET_KEY=dummy-build-key \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    DATABASE_URL=sqlite:////tmp/dummy.db \
    ALLOWED_HOSTS=localhost \
    CORS_ALLOWED_ORIGINS=http://localhost \
    python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]
