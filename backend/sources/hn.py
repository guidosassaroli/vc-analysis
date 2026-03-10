"""Improved HackerNews Algolia API fetcher — filters Show HN startup posts."""

import re
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

HN_API_URL = "https://hn.algolia.com/api/v1/search"
MAX_AGE_DAYS = 90

STARTUP_KEYWORDS = [
    "ai", "ml", "machine learning", "startup", "saas", "platform", "api",
    "biotech", "quantum", "cyber", "security", "semiconductor", "chip",
    "robot", "autonomous", "fintech", "payments", "climate", "energy",
    "drug", "medical", "deep tech", "infrastructure", "enterprise",
    "software", "hardware", "b2b", "data", "cloud", "devtools",
]

SECTOR_MAP = [
    (["quantum", "photon", "qubit"], "Quantum"),
    (["biotech", "drug", "therapy", "genomic", "protein", "medical", "clinical", "pharma"], "Biotech"),
    (["semiconductor", "chip", "asic", "fpga", "processor", "silicon", "hardware"], "Semiconductors"),
    (["cyber", "security", "encryption", "cryptography", "threat", "vulnerability"], "Cybersecurity"),
    (["climate", "carbon", "energy", "fusion", "hydrogen", "solar", "wind", "clean"], "Climate Tech"),
    (["robot", "automation", "autonomous", "manufacturing", "industrial"], "Industrial Robotics"),
    (["fintech", "payment", "banking", "financial", "settlement", "lending"], "Fintech"),
    (["ai", "ml", "llm", "neural", "gpt", "inference", "model", "language"], "AI/ML"),
]

COUNTRY_HINTS = {
    "france": "France", "french": "France", "paris": "France",
    "germany": "Germany", "german": "Germany", "berlin": "Germany", "munich": "Germany",
    "spain": "Spain", "spanish": "Spain", "barcelona": "Spain", "madrid": "Spain",
    "israel": "Israel", "israeli": "Israel", "tel aviv": "Israel",
    "uk": "United Kingdom", "london": "United Kingdom", "british": "United Kingdom",
    "sweden": "Sweden", "stockholm": "Sweden",
    "netherlands": "Netherlands", "amsterdam": "Netherlands",
}

STAGE_HINTS = {
    "series b": "Series B",
    "series a": "Series A",
    "seed": "Seed",
    "pre-seed": "Pre-Seed",
    "bootstrap": "Bootstrapped",
}


def _detect_sector(text: str) -> str:
    text_lower = text.lower()
    for keywords, sector in SECTOR_MAP:
        if any(kw in text_lower for kw in keywords):
            return sector
    return "Software"


def _detect_country(text: str) -> str:
    text_lower = text.lower()
    for hint, country in COUNTRY_HINTS.items():
        if hint in text_lower:
            return country
    return "Unknown"


def _detect_stage(text: str) -> str:
    text_lower = text.lower()
    for hint, stage in STAGE_HINTS.items():
        if hint in text_lower:
            return stage
    return "Early Stage"


def _is_startup_post(title: str, story_text: Optional[str]) -> bool:
    combined = (title + " " + (story_text or "")).lower()
    return any(kw in combined for kw in STARTUP_KEYWORDS)


def _strip_html(text: Optional[str]) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", " ", text).strip()


def _extract_name_from_title(title: str) -> str:
    name = re.sub(r"^Show HN:\s*", "", title, flags=re.IGNORECASE).strip()
    for sep in [" – ", " — ", " - ", ": "]:
        if sep in name:
            name = name.split(sep)[0].strip()
            break
    if len(name) > 60:
        name = name[:57] + "..."
    return name


def _is_recent(created_at: Optional[str]) -> bool:
    if not created_at:
        return True
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
        return dt >= cutoff
    except Exception:
        return True


async def fetch_hn_startups(max_results: int = 20, existing_urls: set = None) -> list[dict]:
    """Fetch Show HN posts from Algolia, skip old posts and already-known URLs."""
    existing_urls = existing_urls or set()
    results = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        params = {
            "query": "Show HN",
            "tags": "show_hn",
            "hitsPerPage": 100,
            "attributesToRetrieve": "objectID,title,url,story_text,points,created_at,author",
        }
        try:
            resp = await client.get(HN_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[HN] Failed to fetch: {e}")
            return []

        for hit in data.get("hits", []):
            title = hit.get("title", "")
            if not title.lower().startswith("show hn"):
                continue

            hn_id = hit.get("objectID", "")
            hn_url = f"https://news.ycombinator.com/item?id={hn_id}"

            if hn_url in existing_urls:
                continue

            if not _is_recent(hit.get("created_at")):
                continue

            story_text = _strip_html(hit.get("story_text", ""))
            if not _is_startup_post(title, story_text):
                continue

            combined_text = f"{title} {story_text}"
            name = _extract_name_from_title(title)
            description = story_text[:500] if story_text else title

            results.append({
                "name": name,
                "description": description or title,
                "sector": _detect_sector(combined_text),
                "stage": _detect_stage(combined_text),
                "country": _detect_country(combined_text),
                "website": hit.get("url") or None,
                "source": "hn",
                "hn_url": hn_url,
                "hn_points": hit.get("points", 0),
                "founders": None,
                "founded_year": None,
            })

            if len(results) >= max_results:
                break

    return results
