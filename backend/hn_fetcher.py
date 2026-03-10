"""Fetches and parses 'Show HN' startup posts from HackerNews Algolia API."""

import httpx
import re
from typing import Optional

HN_API_URL = "https://hn.algolia.com/api/v1/search"

# Keywords that suggest a startup (not a side project or tool)
STARTUP_KEYWORDS = [
    "ai", "ml", "machine learning", "startup", "saas", "platform", "api",
    "biotech", "quantum", "cyber", "security", "semiconductor", "chip",
    "robot", "autonomous", "fintech", "payments", "climate", "energy",
    "drug", "medical", "deep tech", "infrastructure", "enterprise",
    "software", "hardware", "b2b", "data", "cloud", "devtools",
]

# Map broad keywords to Elaia sectors
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

# Map country hints in text to country names
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
    "seed": "Seed",
    "series a": "Series A",
    "series b": "Series B",
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
    """Extract company/project name from 'Show HN: Name – description' format."""
    # Remove "Show HN:" prefix
    name = re.sub(r"^Show HN:\s*", "", title, flags=re.IGNORECASE).strip()
    # Take the part before em-dash, en-dash, or colon
    for sep in [" – ", " — ", " - ", ": "]:
        if sep in name:
            name = name.split(sep)[0].strip()
            break
    # Truncate if too long
    if len(name) > 60:
        name = name[:57] + "..."
    return name


async def fetch_hn_startups(max_results: int = 20) -> list[dict]:
    """
    Fetches Show HN posts from Algolia and parses them into startup-like dicts.
    Returns a list of dicts compatible with the Startup model.
    """
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

        hits = data.get("hits", [])

        for hit in hits:
            title = hit.get("title", "")
            story_text = _strip_html(hit.get("story_text", ""))
            url = hit.get("url", "")
            hn_id = hit.get("objectID", "")

            if not title.lower().startswith("show hn"):
                continue

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
                "website": url or None,
                "source": "hn",
                "hn_url": f"https://news.ycombinator.com/item?id={hn_id}",
                "hn_points": hit.get("points", 0),
                "founders": None,
                "founded_year": None,
            })

            if len(results) >= max_results:
                break

    return results
