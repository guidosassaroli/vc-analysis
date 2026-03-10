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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    _seed_if_empty()


_STARTUP_FIELDS = set(Startup.model_fields.keys()) if hasattr(Startup, "model_fields") else set(Startup.__fields__.keys())


class FetchUrlRequest(BaseModel):
    url: str


class _TextExtractor(HTMLParser):
    SKIP = {'script', 'style', 'noscript', 'nav', 'footer', 'head'}

    def __init__(self):
        super().__init__()
        self._texts = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self._skip_depth = max(0, self._skip_depth - 1)

    def handle_data(self, data):
        if not self._skip_depth:
            t = data.strip()
            if t:
                self._texts.append(t)

    def get_text(self):
        return re.sub(r'\s+', ' ', ' '.join(self._texts))


def _extract_startup_info(url: str, text: str) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    prompt = (
        f"Extract startup info from this website content.\n"
        f"URL: {url}\n"
        f"Content: {text[:4000]}\n\n"
        "Return JSON with these fields:\n"
        '- name: company name (string)\n'
        '- description: 1-2 sentence description of what the company does, max 200 chars, factual and concise\n'
        '- sector: one of ["AI/ML","Biotech","Quantum","Cybersecurity","Climate Tech","Semiconductors","Fintech","Industrial Robotics","Software"]\n'
        '- stage: one of ["Pre-Seed","Seed","Series A","Series B"] if mentioned, else null\n'
        '- country: country where company is based, else null\n'
        '- founders: founder names as a string, else null\n'
        f'- website: canonical website URL (use {url} if unclear)\n\n'
        "Return only valid JSON, no markdown."
    )
    response = client.messages.create(
        model=model,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(response.content[0].text)


def _make_startup(data: dict) -> Startup:
    """Create a Startup instance, ignoring any extra fields not in the model."""
    return Startup(**{k: v for k, v in data.items() if k in _STARTUP_FIELDS})


def _seed_if_empty():
    """Populate DB with seed startups on first run."""
    with Session(__import__("database").engine) as session:
        existing = session.exec(select(Startup).where(Startup.source == "seed")).first()
        if existing:
            return

        print("[Seed] Inserting seed startups...")
        for data in SEED_STARTUPS:
            startup = _make_startup(data)
            session.add(startup)
        session.commit()
        print(f"[Seed] Inserted {len(SEED_STARTUPS)} mock startups.")


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
    """Fetch a startup's website, extract info with Claude, create and return it."""
    url = req.url

    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ElaiaBot/1.0)"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch page: {e}")

    extractor = _TextExtractor()
    extractor.feed(html)
    text = extractor.get_text()

    if len(text) < 100:
        raise HTTPException(status_code=422, detail="Not enough text content on page")

    loop = asyncio.get_event_loop()
    try:
        info = await loop.run_in_executor(None, _extract_startup_info, url, text)
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
        "founders": info.get("founders"),
        "website": website,
        "source": "manual",
        "hn_url": url,
    }
    startup = _make_startup(startup_data)
    session.add(startup)
    session.commit()
    session.refresh(startup)
    return startup


@app.get("/api/startups/{startup_id}", response_model=StartupRead)
def get_startup(startup_id: int, session: Session = Depends(get_session)):
    startup = session.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    return startup


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
    scored_count = 0

    # Score new startups (max 10 to keep latency reasonable)
    for startup in to_score[:10]:
        session.refresh(startup)
        result = score_startup(startup.__dict__)
        startup.fit_score = result.get("fit_score")
        startup.score_rationale = result.get("rationale")
        startup.red_flag = result.get("red_flag")
        startup.scored_at = result.get("scored_at")
        session.add(startup)
        scored_count += 1

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
    """Delete all startups and re-seed from seed_data."""
    all_startups = session.exec(select(Startup)).all()
    for startup in all_startups:
        session.delete(startup)
    session.commit()

    for data in SEED_STARTUPS:
        session.add(_make_startup(data))

    session.commit()

    return {"cleared": len(all_startups), "seeded": len(SEED_STARTUPS), "message": f"Cleared {len(all_startups)} entries, re-seeded {len(SEED_STARTUPS)} startups."}


@app.post("/api/score-all")
def score_all_unscored(session: Session = Depends(get_session)):
    """Score all startups that haven't been scored yet."""
    unscored = session.exec(
        select(Startup).where(Startup.fit_score == None)
    ).all()

    scored = 0
    for startup in unscored:
        result = score_startup({
            "name": startup.name,
            "description": startup.description,
            "sector": startup.sector,
            "stage": startup.stage,
            "country": startup.country,
            "founders": startup.founders,
        })
        startup.fit_score = result.get("fit_score")
        startup.score_rationale = result.get("rationale")
        startup.red_flag = result.get("red_flag")
        startup.scored_at = result.get("scored_at")
        session.add(startup)
        scored += 1

    session.commit()
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
