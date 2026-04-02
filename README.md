# Applicant Tracking System (ATS)

A full-stack, self-contained Applicant Tracking System for managing the complete recruitment lifecycle — from requisition creation through candidate sourcing, interview scheduling, and final disposition.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend | Django 5, Django REST Framework, JWT auth |
| Database | PostgreSQL 16 |
| Task Queue | Celery + Redis |
| Dev Setup | Docker Compose |

## Features

- **Role-based access** — Admin, Hiring Manager, Recruiter
- **Requisition workflow** — Create → Approve → Activate
- **Candidate pipeline** — Upload resumes, track through stages (Applied → Screening → Interview → Offer → Hired/Rejected)
- **Interview scheduling** — Multi-round interviews with feedback templates
- **Department & job management**
- **Dashboard analytics** — Real-time recruitment metrics
- **JWT authentication** with refresh tokens

## Project Structure

```
.
├── backend/          # Django REST API
│   ├── apps/
│   │   ├── accounts/     # User auth & management
│   │   ├── candidates/   # Candidate profiles & pipeline
│   │   ├── core/         # Shared models, permissions, pagination
│   │   ├── dashboard/    # Analytics endpoints
│   │   ├── departments/  # Department management
│   │   ├── interviews/   # Interview scheduling & feedback
│   │   ├── jobs/         # Job postings
│   │   └── requisitions/ # Requisition workflow
│   ├── config/           # Django settings (base/dev/prod)
│   ├── Dockerfile.dev
│   └── pyproject.toml
├── frontend/         # React + Vite SPA
│   └── src/
│       ├── components/
│       ├── pages/
│       └── lib/
├── docker-compose.yml
└── .env.example
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- (Optional) Python 3.11+ and Node.js 18+ for local dev without Docker

### 1. Clone & configure environment

```bash
git clone <repo-url>
cd ATS
cp .env.example .env
# Edit .env — set SECRET_KEY and DATABASE_URL at minimum
```

### 2. Start with Docker Compose

```bash
docker compose up --build
```

This starts:
- PostgreSQL on port `5432`
- Redis on port `6379`
- Django API on port `8000` (with auto-migrate on startup)
- Celery worker
- Mailhog (dev email) on port `8025`

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

### 4. Seed sample data (optional)

```bash
docker compose exec backend uv run python seed.py
```

## API

API documentation is available at `http://localhost:8000/api/schema/swagger-ui/` when running in dev mode (powered by drf-spectacular).

## Environment Variables

See [.env.example](.env.example) for all available configuration options.

Key variables:

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `DJANGO_SETTINGS_MODULE` | Use `config.settings.dev` or `config.settings.prod` |
| `CLAUDE_API_KEY` | Anthropic API key (for AI-assisted resume parsing) |

## Roles

| Role | Permissions |
|---|---|
| `admin` | Full access — manage users, system config, all data |
| `hiring_manager` | Create/approve requisitions, review candidates, give final sign-off |
| `recruiter` | Upload resumes, manage talent pool, schedule interviews, track pipeline |
