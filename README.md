# Elaia — Deal Flow Intelligence Dashboard

A full-stack VC deal flow intelligence tool built for Elaia Partners. Fetches startups from public sources, scores them against Elaia's investment thesis using a multi-dimensional AI scoring engine, and generates structured due diligence memos — with analyst memory, pipeline tracking, and interactive AI-powered research.

Built by [Guido Sassaroli](https://www.linkedin.com/in/guido-sassaroli-778548169/).

---

## Architecture

```
vc-dealflow/
├── backend/                    # Python + FastAPI
│   ├── main.py                 # All API routes
│   ├── models.py               # SQLModel database models
│   ├── database.py             # DB engine (SQLite or PostgreSQL)
│   ├── seed_data.py            # Curated deep tech startups
│   ├── claude_scorer.py        # AI scoring (subscores) & memo generation
│   ├── user_startups.json      # Persisted manually-added startups
│   ├── sources/
│   │   ├── hn.py               # HackerNews Algolia API
│   │   ├── github.py           # GitHub Search API
│   │   └── rss.py              # EU startup RSS feeds (tech.eu, TechCrunch Europe)
│   └── requirements.txt
└── frontend/                   # React 18 + Vite + Tailwind CSS
    └── src/
        ├── App.jsx
        ├── api.js
        ├── utils/
        │   ├── scoreColors.js      # WCAG AA-compliant score color tokens
        │   └── statusColors.js     # Pipeline status color tokens
        └── components/
            ├── Header.jsx          # Nav + action buttons
            ├── AnalyticsPanel.jsx  # Collapsible stats + charts dashboard
            ├── FilterBar.jsx       # Sector/stage/country/source/score filters
            ├── StartupCard.jsx     # Startup card with score ring + status pill
            ├── MemoModal.jsx       # DD memo modal with chat, notes, subscores
            ├── AddStartupModal.jsx # Add startup from URL
            └── LoadingOverlay.jsx
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Anthropic API key
- (Optional) GitHub token for higher rate limits
- (Optional) Supabase project for cloud persistence

---

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

API available at `http://localhost:8000` · Docs: `http://localhost:8000/docs`

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

---

## Environment Variables

### Backend

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | API key for scoring and memo generation |
| `ANTHROPIC_MODEL` | No | Model ID (default: `claude-sonnet-4-6`) |
| `DATABASE_URL` | No | DB connection string (default: local SQLite) |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed origins (default: localhost) |
| `GITHUB_TOKEN` | No | GitHub token for higher API rate limits |

### Frontend

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Production only | Backend base URL, e.g. `https://your-backend.vercel.app` |

**Database options:**

```bash
# Local SQLite (default — no setup needed)
DATABASE_URL=sqlite:///./dealflow.db

# Supabase PostgreSQL (cloud persistence)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

---

## First Run

1. Backend auto-seeds curated deep tech startups on first launch
2. Open `http://localhost:5173`
3. Click **Score All** to score all seeded startups (~10–20 seconds)
4. Click **View Memo** on any scored card to open the full DD memo
5. Use **Add Startup** to add any company by URL
6. Use **Fetch Sources** to pull new startups from HackerNews, GitHub, and EU news
7. Use **Export PDF** to download the top 10 opportunities as a branded report

---

## Features

### AI Scoring — 5 subscores, 1 weighted total

Each startup is evaluated across 5 dimensions independently (Claude cannot anchor on a single number):

| Dimension | Weight | What's evaluated |
|---|---|---|
| **Team** | 25% | Academic pedigree, PhD backgrounds, CNRS/INRIA/Unit 8200, prior exits |
| **Technology** | 25% | Proprietary research, patents, hardware IP, deep tech defensibility |
| **Market** | 20% | TAM, timing, growth signal, B2B vs B2C |
| **Geography** | 15% | FR/ES/IL/DE = strong; other EU = moderate; US-only = weak |
| **Stage Fit** | 15% | Pre-Seed/Seed/Series A = strong; Series B+ = weak |

The `fit_score` is computed deterministically in Python as a weighted average — Claude never picks the final number.

### Analyst Memory

- **Notes** — free-text field per startup, saved on blur, amber-highlighted in the modal
- **Persistent chat** — conversations survive page refreshes (stored as JSON in DB)
- **Feedback-aware rescoring** — when you click Re-score, the scoring prompt includes your notes and the last 6 user messages from the chat. Write "the CEO has a PhD from MIT" → re-score → Team subscore adjusts automatically

### DD Memos

Structured 6-section due diligence memos: Problem · Solution · Team Assessment · Traction & Market · Elaia Fit · Red Flags. Regenerable at any time.

### Deal Pipeline

Each startup has a pipeline status: **Sourced → In Review → Meeting Booked → Term Sheet → Pass**. Change it via dropdown in the memo modal; color-coded pill appears on every card.

### AI Chat (per startup)

Ask anything about a startup directly from the memo modal. Answers are grounded in all available data (description, score, memo sections, founders, funding). Suggested questions pre-loaded. Conversation is persisted across sessions.

### Add from URL — multi-page crawling

Paste any website URL. The backend:
1. Fetches the homepage with heading structure preserved (`[H1]`, `[H2]`, `[H3]`)
2. Concurrently fetches 6 subpages (`/about`, `/team`, `/about-us`, `/company`, `/people`, `/founders`)
3. Sends combined text to Claude to extract: name, description, sector, stage, country, founded year, founders, funding, LinkedIn URL
4. Auto-scores and generates a memo immediately — card appears ready

### Analytics Panel

Collapsible panel above the pipeline showing:
- 6 KPI stats: total startups, scored, high fit (≥70), sectors, countries, avg score
- Sector distribution bar chart
- Score distribution histogram (color-coded red/orange/green)
- Stage breakdown bar chart

### Multi-source Feed

Fetches concurrently from HackerNews ("Show HN"), GitHub Search (5 sector queries), and EU startup news (tech.eu, TechCrunch Europe). All sources run in parallel via `asyncio.gather`.

### Other

- **Full-text search** — across name, description, founders, sector, country
- **Filters** — sector, stage, country, source, minimum fit score
- **PDF export** — Elaia-branded top 10 report (downloadable from header)
- **Score caching** — AI is only called once per startup (or on explicit re-score)
- **Cloud persistence** — Supabase PostgreSQL with automatic column migrations on startup

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/startups` | List startups (`?sector=AI/ML&stage=Seed&country=France&min_score=70`) |
| GET | `/api/startups/{id}` | Get a single startup |
| POST | `/api/startups/from-url` | Add startup by URL — crawl, extract, score, return |
| POST | `/api/startups/{id}/score` | Score + generate memo |
| POST | `/api/startups/{id}/memo` | Regenerate DD memo |
| PATCH | `/api/startups/{id}/status` | Update pipeline status |
| PATCH | `/api/startups/{id}/notes` | Save analyst notes |
| PATCH | `/api/startups/{id}/chat-history` | Persist chat conversation |
| POST | `/api/startups/{id}/chat` | Ask a question about a startup |
| DELETE | `/api/startups/{id}` | Remove from pipeline |
| POST | `/api/refresh` | Fetch from HN + GitHub + RSS (scores up to 10 concurrently) |
| POST | `/api/score-all` | Score all unscored startups (up to 20 concurrently) |
| POST | `/api/reset` | Clear all and re-seed |
| GET | `/api/stats` | Dashboard KPIs |
| GET | `/api/export/pdf` | Download top 10 as PDF |

---

## Scoring Thesis (Elaia)

**Strong fit signals:**
- Geography: France, Spain, Israel, Germany
- Sectors: AI/ML, Quantum, Biotech, Cybersecurity, Climate Tech, Semiconductors
- Stage: Pre-Seed, Seed, Series A
- Team: PhD founders, university spinoffs, CNRS / INRIA / Fraunhofer / Weizmann / Unit 8200 backgrounds

**Weak fit signals:**
- Pure SaaS with no deep tech differentiation
- US-only market focus
- Late stage (Series B+)
- B2C consumer applications

---

## Sector Taxonomy

`AI/ML` · `Biotech` · `Quantum` · `Cybersecurity` · `Climate Tech` · `Semiconductors` · `Fintech` · `Industrial Robotics` · `Software`

---

## Customization

- **Scoring thesis** — edit `backend/claude_scorer.py` (prompts + subscore weights)
- **Seed startups** — edit `backend/seed_data.py`
- **AI model** — set `ANTHROPIC_MODEL` in `.env` (default: `claude-sonnet-4-6`)
- **Sectors / Countries** — edit `frontend/src/components/FilterBar.jsx`

---

## Deployment (Vercel)

Deploy backend and frontend as two separate Vercel projects from the same repo.

> **Note:** Vercel Hobby plan has a 10s function timeout. AI scoring and memo calls take 15–30s — use Vercel Pro (60s timeout) for reliable operation.

### Backend
1. New Vercel project → Root Directory: `backend`
2. Add env vars: `ANTHROPIC_API_KEY`, `DATABASE_URL` (Supabase), `ALLOWED_ORIGINS`
3. Deploy — `vercel.json` configures the Python runtime automatically

### Frontend
1. New Vercel project → Root Directory: `frontend` → Framework: **Vite**
2. Add env var: `VITE_API_URL` → your deployed backend URL
3. Deploy

---

## Cost Estimate

| Operation | Approx. tokens | Approx. cost (Sonnet 4.6) |
|---|---|---|
| Score one startup (5 subscores) | ~600 in + ~200 out | ~$0.003 |
| Generate DD memo | ~600 in + ~400 out | ~$0.004 |
| Add from URL (extract) | ~5,000 in + ~200 out | ~$0.016 |
| Chat message | ~800 in + ~100 out | ~$0.003 |

Scoring + memo for all seeds ≈ **$0.05–$0.10** total.
