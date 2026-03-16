# Elaia — Deal Flow Intelligence Dashboard

A full-stack VC deal flow intelligence tool that fetches startups from public sources, scores them against Elaia's investment thesis, and generates mini due diligence memos.

## Architecture

```
vc-dealflow/
├── backend/                  # Python + FastAPI
│   ├── main.py               # API routes & PDF export
│   ├── models.py             # SQLModel database models
│   ├── database.py           # DB engine (SQLite or Supabase PostgreSQL)
│   ├── seed_data.py          # Curated deep tech startups
│   ├── user_startups.json    # Persisted manually-added startups (auto-generated)
│   ├── claude_scorer.py      # Claude AI scoring & memo generation
│   ├── sources/
│   │   ├── hn.py             # HackerNews Algolia API integration
│   │   ├── github.py         # GitHub Search API integration
│   │   └── rss.py            # EU startup RSS feeds (tech.eu, TechCrunch Europe)
│   └── requirements.txt
└── frontend/                 # React + Vite + Tailwind CSS
    └── src/
        ├── App.jsx
        ├── api.js
        └── components/
            ├── Header.jsx          # Nav + action buttons (Fetch, Score All, Export PDF)
            ├── StatsBar.jsx        # Dashboard KPIs
            ├── FilterBar.jsx       # Sector/stage/country/source/score filters
            ├── StartupCard.jsx     # Startup card with score ring + delete button
            ├── MemoModal.jsx       # Full DD memo modal
            ├── AddStartupModal.jsx # Add startup from URL modal
            └── LoadingOverlay.jsx
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- Anthropic API key
- (Optional) GitHub token for higher rate limits
- (Optional) Supabase project for cloud persistence

## Setup

### 1. Clone & configure environment

```bash
cd vc-dealflow
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY and optionally DATABASE_URL
```

### 2. Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate   # Linux/macOS
# venv\Scripts\activate    # Windows

pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000` · Interactive docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard available at `http://localhost:5173`.

### 4. Quick start (both at once)

```bash
./start.sh
```

## Environment Variables

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for scoring and memo generation |
| `ANTHROPIC_MODEL` | No | Claude model (default: `claude-sonnet-4-6`) |
| `DATABASE_URL` | No | Database connection string (default: local SQLite) |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed origins (default: localhost) |
| `GITHUB_TOKEN` | No | GitHub token for higher API rate limits |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Production only | Backend base URL, e.g. `https://your-backend.vercel.app` |

**Database options:**

```bash
# Local SQLite (default — no setup needed)
DATABASE_URL=sqlite:///./dealflow.db

# Supabase PostgreSQL (cloud — persists across restarts and machines)
# Get from: Supabase dashboard → Project Settings → Database → Connection string (Transaction pooler, port 6543)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

## Deployment (Vercel)

Deploy the backend and frontend as two separate Vercel projects from the same repository.

> **Note:** Vercel Hobby plan has a 10-second function timeout. Claude scoring and memo calls typically take 15–30s — upgrade to Vercel Pro (60s timeout) for reliable operation.

### Backend

1. Create a new Vercel project, set **Root Directory** to `backend`
2. Add environment variables:
   - `ANTHROPIC_API_KEY`
   - `DATABASE_URL` (Supabase PostgreSQL connection string)
   - `ALLOWED_ORIGINS` → set after the frontend is deployed, e.g. `https://your-frontend.vercel.app`
3. Deploy — Vercel auto-detects `vercel.json` and uses the Python runtime

### Frontend

1. Create a new Vercel project, set **Root Directory** to `frontend`
2. Framework preset: **Vite**
3. Add environment variable:
   - `VITE_API_URL` → your deployed backend URL, e.g. `https://your-backend.vercel.app`
4. Deploy

## First Run

1. The backend automatically seeds curated deep tech startups on first launch
2. Open `http://localhost:5173`
3. Click **"Score All"** to score all seeded startups (runs concurrently, ~10–20 seconds)
4. Click **"View Memo"** on any scored startup to generate a full DD memo
5. Click **"Add Startup"** to add any company by pasting its website URL
6. Use **"Fetch Sources"** to pull new startups from HackerNews, GitHub, and EU news
7. Use **"Export PDF"** to download the top 10 opportunities as a formatted report

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/startups` | List startups (supports `?sector=AI/ML&stage=Seed&country=France&min_score=70&source=manual`) |
| GET | `/api/startups/{id}` | Get a single startup |
| POST | `/api/startups/from-url` | Add a startup by URL — fetches page, extracts info with Claude, deduplicates |
| POST | `/api/startups/{id}/score` | Score + generate memo for one startup |
| POST | `/api/startups/{id}/memo` | Regenerate DD memo for one startup |
| DELETE | `/api/startups/{id}` | Remove a single startup from the pipeline |
| POST | `/api/refresh` | Fetch new startups from HN, GitHub, and RSS feeds (scores up to 10 concurrently) |
| POST | `/api/score-all` | Score all unscored startups (concurrent, capped at 20 per call) |
| POST | `/api/reset` | Clear all startups and re-seed (curated + user-added) |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/export/pdf` | Download top 10 as PDF |
| GET | `/api/health` | Health check |

## Features

- **AI Scoring** — Each startup gets a 0–100 Elaia Fit Score, a rationale, and a red flag (if any), generated by Claude
- **DD Memos** — Structured due diligence memos with Problem / Solution / Team / Traction / Elaia Fit / Red Flags sections
- **Add from URL** — Paste any startup's website URL; Claude extracts name, sector, stage, country, and founders automatically
- **Multi-source Feed** — Fetches from HackerNews ("Show HN"), GitHub Search, and EU startup news (tech.eu, TechCrunch Europe); all sources run concurrently
- **Concurrent Scoring** — Refresh and Score All use `asyncio.gather` to score multiple startups in parallel, reducing wait time significantly
- **Remove Startups** — Delete individual startups from the pipeline with a two-step confirmation directly on each card
- **PDF Export** — Elaia-branded PDF report of the top 10 opportunities, downloadable from the header
- **Cloud Persistence** — Connect Supabase to persist all data across restarts and machines
- **Advanced Filters** — Filter by sector, stage, country, source (curated / HN / GitHub / News / Added), and minimum fit score
- **Full-text Search** — Search across names, descriptions, founders, and sectors
- **Score Caching** — Scores and memos are stored in the DB; Claude is only called once per startup (or on explicit rescore)

## Sector Taxonomy

The following sectors are supported across all sources and UI filters:

`AI/ML` · `Biotech` · `Quantum` · `Cybersecurity` · `Climate Tech` · `Semiconductors` · `Fintech` · `Industrial Robotics` · `Software`

When adding startups manually via URL, Claude maps the company to the closest matching sector.

## Scoring Thesis (Elaia)

**Strong fit signals (+score):**
- Geography: France, Spain, Israel, Germany
- Sectors: AI/ML, Quantum, Biotech, Cybersecurity, Climate Tech, Semiconductors
- Stage: Pre-Seed, Seed, Series A
- Team: PhD founders, university spinoffs, academic research background (CNRS, INRIA, Fraunhofer, Unit 8200…)

**Weak fit signals (−score):**
- Pure SaaS with no deep tech differentiation
- US-only market focus
- Late stage (Series B+)
- B2C consumer applications

## Customization

- **Scoring thesis** — Edit `backend/claude_scorer.py` to modify scoring criteria and memo prompts
- **Seed data** — Edit `backend/seed_data.py` to add or modify curated startups (use sectors from the taxonomy above)
- **Claude model** — Set `ANTHROPIC_MODEL` in `.env` (default: `claude-sonnet-4-6`)
- **Sectors / Countries** — Edit filter options in `frontend/src/components/FilterBar.jsx` and `StartupCard.jsx`

## Cost Estimate

Each startup scoring call uses ~500 input + ~150 output tokens.
Each memo generation uses ~600 input + ~400 output tokens.
Each "Add from URL" extraction uses ~4,000 input + ~150 output tokens.

At Sonnet 4.6 pricing, scoring + memo for all seeds ≈ $0.05–$0.10.
