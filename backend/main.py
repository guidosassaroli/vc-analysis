"""
Elaia VC Deal Flow Intelligence — FastAPI Backend
"""

import asyncio
import json
import os
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select

from database import create_db_and_tables, get_session
from models import RefreshStatus, Startup, StartupRead
from seed_data import SEED_STARTUPS
from sources.hn import fetch_hn_startups
from sources.github import fetch_github_startups
from sources.rss import fetch_rss_startups
from claude_scorer import score_startup, generate_memo

app = FastAPI(
    title="Elaia Deal Flow API",
    description="VC Deal Flow Intelligence Dashboard for Elaia",
    version="1.0.0",
)

_cors_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _run_migrations():
    """Add new columns to existing tables without dropping data."""
    import sqlalchemy
    from database import engine
    new_columns = [
        ("startup", "funding", "VARCHAR"),
        ("startup", "linkedin_url", "VARCHAR"),
        ("startup", "status", "VARCHAR DEFAULT 'Sourced'"),
        ("startup", "subscore_team", "FLOAT"),
        ("startup", "subscore_technology", "FLOAT"),
        ("startup", "subscore_market", "FLOAT"),
        ("startup", "subscore_geography", "FLOAT"),
        ("startup", "subscore_stage", "FLOAT"),
        ("startup", "user_notes", "TEXT"),
        ("startup", "chat_history", "TEXT"),
    ]
    # Use AUTOCOMMIT so each DDL statement is its own transaction — avoids
    # PostgreSQL leaving the connection in an aborted state on duplicate columns.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for table, col, col_type in new_columns:
            try:
                # IF NOT EXISTS: no-op if column already present (PostgreSQL 9.6+)
                conn.execute(sqlalchemy.text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type}"
                ))
            except Exception as e:
                print(f"[Migration] Warning for {table}.{col}: {e}")


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    _run_migrations()
    _seed_if_empty()


_STARTUP_FIELDS = set(Startup.model_fields.keys()) if hasattr(Startup, "model_fields") else set(Startup.__fields__.keys())


class FetchUrlRequest(BaseModel):
    url: str

class StatusUpdateRequest(BaseModel):
    status: str

class NotesUpdateRequest(BaseModel):
    user_notes: str

class ChatHistoryRequest(BaseModel):
    history: list  # list of {role, content} dicts

class ChatMessage(BaseModel):
    role: str      # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

_VALID_STATUSES = {"Sourced", "In Review", "Meeting Booked", "Term Sheet", "Pass"}


class _TextExtractor(HTMLParser):
    SKIP = {'script', 'style', 'noscript', 'nav', 'head'}
    HEADINGS = {'h1', 'h2', 'h3'}

    def __init__(self):
        super().__init__()
        self._texts = []
        self._skip_depth = 0
        self._current_heading = None

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip_depth += 1
        elif tag in self.HEADINGS:
            self._current_heading = tag.upper()

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self._skip_depth = max(0, self._skip_depth - 1)
        elif tag in self.HEADINGS:
            self._current_heading = None

    def handle_data(self, data):
        if not self._skip_depth:
            t = data.strip()
            if t:
                if self._current_heading:
                    self._texts.append(f'[{self._current_heading}] {t}')
                else:
                    self._texts.append(t)

    def get_text(self):
        return re.sub(r'\s+', ' ', ' '.join(self._texts))


_TEAM_SUBPATHS = ['/about', '/team', '/about-us', '/company', '/people', '/founders']

_HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def _html_to_text(html: str) -> str:
    if len(html) > 300_000:
        html = html[:300_000]
    try:
        extractor = _TextExtractor()
        extractor.feed(html)
        return extractor.get_text()
    except Exception:
        return ""


async def _fetch_subpage_text(client: httpx.AsyncClient, base_url: str, path: str) -> str:
    """Try fetching a subpage; return its text or empty string on any error."""
    from urllib.parse import urlparse, urlunparse
    parsed = urlparse(base_url)
    subpage_url = urlunparse((parsed.scheme, parsed.netloc, path, '', '', ''))
    try:
        resp = await client.get(subpage_url, timeout=httpx.Timeout(8.0, connect=4.0))
        resp.raise_for_status()
        return _html_to_text(resp.text)
    except Exception:
        return ""


def _extract_startup_info(url: str, text: str) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    prompt = (
        f"Extract startup info from this website content. Headings are marked [H1]/[H2]/[H3] to help locate sections.\n"
        f"URL: {url}\n"
        f"Content: {text[:12000]}\n\n"
        "Return JSON with these fields:\n"
        '- name: company name (string)\n'
        '- description: 1-2 sentence description of what the company does, max 200 chars, factual and concise\n'
        '- sector: one of ["AI/ML","Biotech","Quantum","Cybersecurity","Climate Tech","Semiconductors","Fintech","Industrial Robotics","Software"]\n'
        '- stage: one of ["Pre-Seed","Seed","Series A","Series B"] if mentioned, else null\n'
        '- country: country where company is based, else null\n'
        '- founded_year: integer year the company was founded if mentioned, else null\n'
        '- founders: names of founders or co-founders as a comma-separated string; look carefully in [H2]/[H3] team, about, people, and founders sections; else null\n'
        '- funding: funding info as a short string (e.g. "Raised $2M Seed") if mentioned, else null\n'
        '- linkedin_url: LinkedIn company page URL if present in the content, else null\n'
        f'- website: canonical website URL (use {url} if unclear)\n\n'
        "Return only valid JSON, no markdown."
    )
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    return json.loads(raw)


def _make_startup(data: dict) -> Startup:
    """Create a Startup instance, ignoring any extra fields not in the model."""
    return Startup(**{k: v for k, v in data.items() if k in _STARTUP_FIELDS})


# ─── User startup persistence ─────────────────────────────────────────────────

USER_STARTUPS_PATH = os.path.join(os.path.dirname(__file__), "user_startups.json")


def _load_user_startups() -> list[dict]:
    if not os.path.exists(USER_STARTUPS_PATH):
        return []
    try:
        with open(USER_STARTUPS_PATH) as f:
            return json.load(f)
    except Exception:
        return []


def _save_user_startup(data: dict):
    try:
        startups = _load_user_startups()
        if any(s.get("website") == data.get("website") for s in startups):
            return
        startups.append(data)
        with open(USER_STARTUPS_PATH, "w") as f:
            json.dump(startups, f, indent=2, ensure_ascii=False)
    except OSError:
        pass  # Read-only filesystem in serverless environments — Supabase is the source of truth


def _seed_if_empty():
    """Populate DB with seed startups on first run."""
    with Session(__import__("database").engine) as session:
        existing = session.exec(select(Startup).where(Startup.source == "seed")).first()
        if not existing:
            print("[Seed] Inserting seed startups...")
            for data in SEED_STARTUPS:
                session.add(_make_startup(data))
            session.commit()
            print(f"[Seed] Inserted {len(SEED_STARTUPS)} mock startups.")

        # Re-add any user-added startups that are missing (e.g. after a DB wipe)
        for data in _load_user_startups():
            website = data.get("website")
            if website and session.exec(select(Startup).where(Startup.website == website)).first():
                continue
            session.add(_make_startup(data))
        session.commit()


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/api/startups", response_model=list[StartupRead])
def list_startups(
    sector: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    source: Optional[str] = Query(None),  # "hn" | "seed" | None = all
    session: Session = Depends(get_session),
):
    query = select(Startup)

    if sector and sector != "All":
        query = query.where(Startup.sector == sector)
    if stage and stage != "All":
        query = query.where(Startup.stage == stage)
    if country and country != "All":
        query = query.where(Startup.country == country)
    if min_score is not None:
        query = query.where(Startup.fit_score >= min_score)
    if source and source != "all":
        query = query.where(Startup.source == source)

    startups = session.exec(query.order_by(Startup.fit_score.desc().nullslast())).all()
    return startups


@app.post("/api/startups/from-url", response_model=StartupRead)
async def startup_from_url(req: FetchUrlRequest, session: Session = Depends(get_session)):
    """Fetch a startup's website (+ team/about subpages), extract info with Claude, score and return it."""
    url = req.url

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),
        follow_redirects=True,
        headers=_HTTP_HEADERS,
    ) as client:
        # Fetch homepage
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            homepage_text = _html_to_text(resp.text)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not fetch page: {e}")

        if len(homepage_text) < 100:
            raise HTTPException(
                status_code=422,
                detail="Not enough readable text on this page. It may require JavaScript to render (e.g. Framer, React SPA). Try pasting the startup's details manually."
            )

        # Concurrently fetch team/about subpages to find founders
        subpage_tasks = [_fetch_subpage_text(client, url, path) for path in _TEAM_SUBPATHS]
        subpage_texts = await asyncio.gather(*subpage_tasks)

    # Combine: homepage first, then unique subpage content (skip duplicates of homepage)
    combined_parts = [homepage_text]
    for sub_text in subpage_texts:
        if sub_text and sub_text[:200] != homepage_text[:200]:  # skip identical pages
            combined_parts.append(sub_text)
    combined_text = ' '.join(combined_parts)

    loop = asyncio.get_running_loop()
    try:
        info = await loop.run_in_executor(None, _extract_startup_info, url, combined_text)
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        raise HTTPException(status_code=422, detail=f"Could not parse startup info: {e}")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Info extraction failed: {e}")

    website = info.get("website") or url
    existing = session.exec(select(Startup).where(Startup.website == website)).first()
    if existing:
        return existing

    startup_data = {
        "name": info.get("name", "Unknown"),
        "description": info.get("description", ""),
        "sector": info.get("sector", "Software"),
        "stage": info.get("stage") or "Unknown",
        "country": info.get("country", "Unknown"),
        "founded_year": info.get("founded_year"),
        "founders": info.get("founders"),
        "funding": info.get("funding"),
        "linkedin_url": info.get("linkedin_url"),
        "website": website,
        "source": "manual",
        "hn_url": url,
    }
    startup = _make_startup(startup_data)
    session.add(startup)
    session.commit()
    _save_user_startup(startup_data)
    session.refresh(startup)

    # Auto-score inline so the card appears with a score immediately
    try:
        result = await loop.run_in_executor(None, score_startup, startup.__dict__.copy())
        startup.fit_score = result.get("fit_score")
        startup.score_rationale = result.get("rationale")
        startup.red_flag = result.get("red_flag")
        startup.scored_at = result.get("scored_at")
        startup.subscore_team = result.get("subscore_team")
        startup.subscore_technology = result.get("subscore_technology")
        startup.subscore_market = result.get("subscore_market")
        startup.subscore_geography = result.get("subscore_geography")
        startup.subscore_stage = result.get("subscore_stage")

        startup_dict_for_memo = {
            "name": startup.name,
            "description": startup.description,
            "sector": startup.sector,
            "stage": startup.stage,
            "country": startup.country,
            "founders": startup.founders,
            "fit_score": startup.fit_score,
            "score_rationale": startup.score_rationale,
            "red_flag": startup.red_flag,
        }
        memo = await loop.run_in_executor(None, generate_memo, startup_dict_for_memo)
        for k, v in memo.items():
            setattr(startup, k, v)

        session.add(startup)
        session.commit()
        session.refresh(startup)
    except Exception:
        pass  # scoring failure must not block the startup from being added

    return startup


@app.get("/api/startups/{startup_id}", response_model=StartupRead)
def get_startup(startup_id: int, session: Session = Depends(get_session)):
    startup = session.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    return startup


@app.delete("/api/startups/{startup_id}", status_code=204)
def delete_startup(startup_id: int, session: Session = Depends(get_session)):
    """Remove a single startup from the pipeline."""
    startup = session.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    session.delete(startup)
    session.commit()


@app.post("/api/startups/{startup_id}/score", response_model=StartupRead)
def score_one(startup_id: int, session: Session = Depends(get_session)):
    """Score (or re-score) a single startup with Claude."""
    startup = session.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")

    result = score_startup(startup.__dict__)
    startup.fit_score = result.get("fit_score")
    startup.score_rationale = result.get("rationale")
    startup.red_flag = result.get("red_flag")
    startup.scored_at = result.get("scored_at")
    startup.subscore_team = result.get("subscore_team")
    startup.subscore_technology = result.get("subscore_technology")
    startup.subscore_market = result.get("subscore_market")
    startup.subscore_geography = result.get("subscore_geography")
    startup.subscore_stage = result.get("subscore_stage")

    # Also generate memo
    startup_dict = {
        "name": startup.name,
        "description": startup.description,
        "sector": startup.sector,
        "stage": startup.stage,
        "country": startup.country,
        "founders": startup.founders,
        "fit_score": result.get("fit_score"),
        "score_rationale": result.get("rationale"),
        "red_flag": result.get("red_flag"),
    }
    memo = generate_memo(startup_dict)
    for k, v in memo.items():
        setattr(startup, k, v)

    session.add(startup)
    session.commit()
    session.refresh(startup)
    return startup


@app.post("/api/startups/{startup_id}/memo", response_model=StartupRead)
def generate_memo_for(startup_id: int, session: Session = Depends(get_session)):
    """Generate or regenerate the DD memo for a startup."""
    startup = session.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")

    startup_dict = {
        "name": startup.name,
        "description": startup.description,
        "sector": startup.sector,
        "stage": startup.stage,
        "country": startup.country,
        "founders": startup.founders,
        "fit_score": startup.fit_score,
        "score_rationale": startup.score_rationale,
        "red_flag": startup.red_flag,
    }
    memo = generate_memo(startup_dict)
    for k, v in memo.items():
        setattr(startup, k, v)

    session.add(startup)
    session.commit()
    session.refresh(startup)
    return startup


@app.patch("/api/startups/{startup_id}/status", response_model=StartupRead)
def update_status(startup_id: int, req: StatusUpdateRequest, session: Session = Depends(get_session)):
    """Update the pipeline status of a startup."""
    if req.status not in _VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {sorted(_VALID_STATUSES)}")
    startup = session.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    startup.status = req.status
    session.add(startup)
    session.commit()
    session.refresh(startup)
    return startup


@app.patch("/api/startups/{startup_id}/notes", response_model=StartupRead)
def update_notes(startup_id: int, req: NotesUpdateRequest, session: Session = Depends(get_session)):
    """Save analyst notes for a startup."""
    startup = session.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    startup.user_notes = req.user_notes
    session.add(startup)
    session.commit()
    session.refresh(startup)
    return startup


@app.patch("/api/startups/{startup_id}/chat-history")
def save_chat_history(startup_id: int, req: ChatHistoryRequest, session: Session = Depends(get_session)):
    """Persist the chat conversation for a startup."""
    startup = session.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    startup.chat_history = json.dumps(req.history, ensure_ascii=False)
    session.add(startup)
    session.commit()
    return {"ok": True}


@app.post("/api/startups/{startup_id}/chat")
def chat_with_startup(startup_id: int, req: ChatRequest, session: Session = Depends(get_session)):
    """Answer a free-form question about a startup using Claude."""
    startup = session.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")

    import anthropic as _anthropic
    client = _anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

    system = f"""You are an AI research assistant helping a VC analyst at Elaia Partners evaluate a startup. \
Answer in 2-3 sentences max, plain text only — no Markdown, headers, bullets, or tables. \
Be direct and analytical. Base your answers on the information below; acknowledge when something is unknown.

Startup: {startup.name}
Description: {startup.description}
Sector: {startup.sector} | Stage: {startup.stage} | Country: {startup.country}
Founded: {startup.founded_year or 'Unknown'} | Founders: {startup.founders or 'Unknown'}
Funding: {startup.funding or 'Unknown'}
Fit Score: {f"{startup.fit_score}/100" if startup.fit_score is not None else "Not scored"}
Score Rationale: {startup.score_rationale or 'N/A'}
Red Flag: {startup.red_flag or 'None identified'}
Problem: {startup.memo_problem or 'N/A'}
Solution: {startup.memo_solution or 'N/A'}
Team: {startup.memo_team or 'N/A'}
Traction: {startup.memo_traction or 'N/A'}
Elaia Fit: {startup.memo_elaia_fit or 'N/A'}
Risks: {startup.memo_red_flags or 'N/A'}"""

    messages = [{"role": m.role, "content": m.content} for m in req.history]
    messages.append({"role": "user", "content": req.message})

    response = client.messages.create(
        model=model,
        max_tokens=200,
        system=system,
        messages=messages,
    )
    return {"reply": response.content[0].text.strip()}


@app.post("/api/refresh", response_model=RefreshStatus)
async def refresh_feed(session: Session = Depends(get_session)):
    """
    Fetch from HackerNews, GitHub, and EU startup RSS feeds concurrently.
    Deduplicates across all sources by hn_url. Scores new entries with Claude.
    """
    # Build set of all known source URLs to skip
    existing_urls = set(
        s.hn_url
        for s in session.exec(select(Startup).where(Startup.hn_url != None)).all()
        if s.hn_url
    )

    # Fetch all three sources concurrently
    hn_posts, github_repos, rss_startups = await asyncio.gather(
        fetch_hn_startups(max_results=20, existing_urls=existing_urls),
        fetch_github_startups(max_per_query=5, existing_urls=existing_urls),
        fetch_rss_startups(existing_urls=existing_urls),
    )

    # Dedup within this batch by hn_url (in case sources overlap)
    seen_in_batch: set[str] = set()
    all_posts = []
    source_counts = {"hn": 0, "github": 0, "rss": 0}

    for posts, source in [(hn_posts, "hn"), (github_repos, "github"), (rss_startups, "rss")]:
        for post in posts:
            url = post.get("hn_url")
            if url and (url in existing_urls or url in seen_in_batch):
                continue
            if url:
                seen_in_batch.add(url)
            all_posts.append(post)
            source_counts[source] += 1

    to_score = []
    for post in all_posts:
        startup = Startup(**post)
        session.add(startup)
        to_score.append(startup)

    session.commit()
    new_count = len(to_score)

    # Score new startups concurrently (max 10 to keep latency reasonable)
    batch = to_score[:10]
    for startup in batch:
        session.refresh(startup)

    loop = asyncio.get_running_loop()
    startup_dicts = [dict(startup.__dict__) for startup in batch]
    results = await asyncio.gather(
        *[loop.run_in_executor(None, score_startup, d) for d in startup_dicts]
    )
    for startup, result in zip(batch, results):
        startup.fit_score = result.get("fit_score")
        startup.score_rationale = result.get("rationale")
        startup.red_flag = result.get("red_flag")
        startup.scored_at = result.get("scored_at")
        session.add(startup)

    scored_count = len(batch)
    session.commit()

    hn_n = source_counts["hn"]
    gh_n = source_counts["github"]
    rss_n = source_counts["rss"]
    fetched = len(hn_posts) + len(github_repos) + len(rss_startups)

    return RefreshStatus(
        fetched=fetched,
        new=new_count,
        scored=scored_count,
        message=f"HN: {hn_n} new, GitHub: {gh_n} new, News: {rss_n} new — scored {scored_count}.",
    )


@app.post("/api/reset")
def reset_database(session: Session = Depends(get_session)):
    """Delete all startups and re-seed from seed_data + user_startups.json."""
    all_startups = session.exec(select(Startup)).all()
    for startup in all_startups:
        session.delete(startup)
    session.commit()

    for data in SEED_STARTUPS:
        session.add(_make_startup(data))

    user_startups = _load_user_startups()
    for data in user_startups:
        session.add(_make_startup(data))

    session.commit()

    total = len(SEED_STARTUPS) + len(user_startups)
    return {"cleared": len(all_startups), "seeded": total, "message": f"Cleared {len(all_startups)} entries, re-seeded {len(SEED_STARTUPS)} curated + {len(user_startups)} user-added startups."}


@app.post("/api/score-all")
async def score_all_unscored(session: Session = Depends(get_session)):
    """Score all unscored startups concurrently (capped at 20 per call)."""
    unscored = session.exec(
        select(Startup).where(Startup.fit_score == None)
    ).all()

    batch = unscored[:20]
    if not batch:
        return {"scored": 0, "message": "No unscored startups."}

    loop = asyncio.get_running_loop()
    startup_dicts = [
        {
            "name": s.name,
            "description": s.description,
            "sector": s.sector,
            "stage": s.stage,
            "country": s.country,
            "founders": s.founders,
        }
        for s in batch
    ]
    results = await asyncio.gather(
        *[loop.run_in_executor(None, score_startup, d) for d in startup_dicts]
    )
    for startup, result in zip(batch, results):
        startup.fit_score = result.get("fit_score")
        startup.score_rationale = result.get("rationale")
        startup.red_flag = result.get("red_flag")
        startup.scored_at = result.get("scored_at")
        session.add(startup)

    session.commit()
    scored = len(batch)
    return {"scored": scored, "message": f"Scored {scored} startups."}


@app.get("/api/stats")
def get_stats(session: Session = Depends(get_session)):
    """Return dashboard summary statistics."""
    all_startups = session.exec(select(Startup)).all()

    total = len(all_startups)
    scored = [s for s in all_startups if s.fit_score is not None]
    high_fit = [s for s in scored if s.fit_score >= 70]
    sectors = list(set(s.sector for s in all_startups))
    countries = list(set(s.country for s in all_startups))
    avg_score = (sum(s.fit_score for s in scored) / len(scored)) if scored else 0

    return {
        "total": total,
        "scored": len(scored),
        "high_fit": len(high_fit),
        "sectors": len(sectors),
        "countries": len(countries),
        "avg_score": round(avg_score, 1),
    }


@app.get("/api/export/pdf")
def export_pdf(session: Session = Depends(get_session)):
    """Export top 10 scored startups as a PDF report."""
    from fpdf import FPDF

    top_startups = session.exec(
        select(Startup)
        .where(Startup.fit_score != None)
        .order_by(Startup.fit_score.desc())
        .limit(10)
    ).all()

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Header
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_fill_color(10, 22, 40)
    pdf.set_text_color(255, 255, 255)
    pdf.rect(0, 0, 210, 40, "F")
    pdf.set_xy(10, 8)
    pdf.cell(0, 10, "Elaia", ln=False)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_xy(10, 20)
    pdf.cell(0, 8, "Deal Flow Intelligence — Top 10 Opportunities")
    pdf.set_xy(10, 30)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, f"Generated {datetime.now().strftime('%B %d, %Y')}")

    pdf.set_text_color(0, 0, 0)
    pdf.set_y(50)

    for i, s in enumerate(top_startups, 1):
        # Score color
        score = s.fit_score or 0
        if score >= 70:
            r, g, b = 34, 197, 94
        elif score >= 40:
            r, g, b = 245, 158, 11
        else:
            r, g, b = 239, 68, 68

        # Card background
        card_y = pdf.get_y()
        if card_y > 240:
            pdf.add_page()
            card_y = pdf.get_y()

        pdf.set_fill_color(248, 250, 252)
        pdf.rect(10, card_y, 190, 48, "F")

        # Rank + Name
        pdf.set_xy(14, card_y + 4)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(10, 22, 40)
        pdf.cell(0, 7, f"#{i}  {s.name}")

        # Score badge
        pdf.set_fill_color(r, g, b)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 11)
        pdf.rect(170, card_y + 3, 26, 9, "F")
        pdf.set_xy(170, card_y + 4)
        pdf.cell(26, 7, f"{int(score)}/100", align="C")

        # Metadata
        pdf.set_text_color(100, 116, 139)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_xy(14, card_y + 13)
        pdf.cell(0, 5, f"{s.sector}  |  {s.stage}  |  {s.country}")

        # Description
        pdf.set_text_color(51, 65, 85)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_xy(14, card_y + 20)
        desc = s.description[:180] + "..." if len(s.description) > 180 else s.description
        pdf.multi_cell(162, 4, desc)

        # Rationale
        if s.score_rationale:
            pdf.set_text_color(100, 116, 139)
            pdf.set_font("Helvetica", "I", 8)
            next_y = pdf.get_y()
            pdf.set_xy(14, next_y + 1)
            rationale = s.score_rationale[:160] + "..." if len(s.score_rationale) > 160 else s.score_rationale
            pdf.multi_cell(162, 4, f"Elaia Fit: {rationale}")

        pdf.set_y(card_y + 52)

    # Footer
    pdf.set_y(-20)
    pdf.set_text_color(148, 163, 184)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, "Confidential — Elaia Internal Use Only", align="C")

    pdf_bytes = pdf.output()

    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=elaia-dealflow-{datetime.now().strftime('%Y%m%d')}.pdf"
        },
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "model": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")}
