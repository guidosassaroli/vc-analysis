# Deal Flow Intelligence Dashboard

A full-stack VC deal flow tool that fetches startups from public sources, scores them against a configurable investment thesis using multi-dimensional AI scoring, and generates structured due diligence memos — with multi-user auth, analyst memory, and pipeline tracking.

---

## Stack

- **Backend**: Python + FastAPI + SQLModel (PostgreSQL / SQLite)
- **Frontend**: React 18 + Vite + Tailwind CSS
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`)
- **Auth**: Supabase (magic link, JWT)

---

## Structure

```
vc-dealflow/
├── backend/
│   ├── main.py              # All API routes
│   ├── models.py            # SQLModel DB models
│   ├── claude_scorer.py     # AI scoring + memo generation
│   ├── database.py          # DB engine
│   ├── auth.py              # Supabase JWT verification
│   ├── seed_data.py         # Curated seed startups
│   └── sources/
│       ├── hn.py            # HackerNews
│       ├── github.py        # GitHub Search
│       └── rss.py           # EU startup news (tech.eu, TechCrunch EU)
└── frontend/
    └── src/
        ├── App.jsx
        ├── api.js
        ├── pages/           # Login, AuthCallback
        ├── context/         # AuthContext
        ├── utils/           # scoreColors, statusColors
        └── components/
            ├── Header.jsx
            ├── StartupCard.jsx
            ├── MemoModal.jsx       # DD memo, chat, notes, subscores
            ├── AddStartupModal.jsx
            ├── SettingsModal.jsx   # Custom thesis config
            ├── AnalyticsPanel.jsx
            └── FilterBar.jsx
```

---

## Setup

```bash
# 1. Configure environment
cp .env.example .env   # set ANTHROPIC_API_KEY

# 2. Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3. Frontend
cd frontend && npm install && npm run dev

# Or run both at once
./start.sh
```

---

## Environment Variables

**Backend (`backend/.env`)**

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `DATABASE_URL` | No | PostgreSQL or SQLite (default: local SQLite) |
| `SUPABASE_JWT_SECRET` | Auth only | JWT secret from Supabase → Settings → API |
| `ANTHROPIC_MODEL` | No | Default: `claude-sonnet-4-6` |
| `GITHUB_TOKEN` | No | Higher GitHub API rate limits |

**Frontend (`frontend/.env.local`)**

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Production | Backend base URL |
| `VITE_SUPABASE_URL` | Auth only | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Auth only | Supabase anon key |

> **Dev mode**: leave Supabase variables unset — app runs without login using a fixed dev user ID.

---

## Key Features

- **AI Scoring** — 5 weighted subscores (Team 25%, Technology 25%, Market 20%, Geography 15%, Stage 15%). Final score computed deterministically in Python.
- **DD Memos** — 6-section memos (Problem, Solution, Team, Traction, Thesis Fit, Red Flags). Quick (1-2 sentences) or Deep Dive (IC-ready, 4-6 sentences with named competitors and diligence questions).
- **Add from URL** — paste any website URL; backend crawls homepage + 6 subpages, uses HTML metadata (OG tags, JSON-LD) + Claude to extract all fields.
- **Analyst Memory** — notes and chat history persist per startup; re-scoring incorporates analyst feedback automatically.
- **Deal Pipeline** — Sourced → In Review → Meeting Booked → Term Sheet → Pass (with required pass reason).
- **Multi-source feed** — HackerNews, GitHub, EU news RSS, all fetched concurrently.
- **Custom thesis** — per-user thesis configuration injected into every scoring prompt.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/startups` | List startups (filterable) |
| POST | `/api/startups/from-url` | Add startup by URL |
| POST | `/api/startups/{id}/score` | Score a startup |
| POST | `/api/startups/{id}/memo` | Generate DD memo |
| POST | `/api/startups/{id}/deep-memo` | Generate IC-ready deep dive memo |
| PATCH | `/api/startups/{id}/status` | Update pipeline status |
| PATCH | `/api/startups/{id}/notes` | Save analyst notes |
| POST | `/api/startups/{id}/chat` | Chat about a startup |
| POST | `/api/refresh` | Fetch from all sources |
| POST | `/api/score-all` | Score all unscored startups |
| GET | `/api/export/pdf` | Download top 10 as PDF |
| GET/PUT | `/api/config` | Get/save user thesis config |

---

## Deployment

**Backend → Railway**: set `ANTHROPIC_API_KEY`, `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS`. Root directory: `backend`.

**Frontend → Vercel**: set `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Framework: Vite.

**Supabase Auth**: set Site URL and add `/auth/callback` to Redirect URLs.
