"""GitHub Search API — find early-stage deep tech repos matching Elaia sectors."""

import os
import httpx

GITHUB_API = "https://api.github.com/search/repositories"

# One broad query per Elaia sector cluster; cap 5 results each → max 25 total
SECTOR_QUERIES = [
    ("AI/ML",              "topic:machine-learning stars:>10 created:>2023-01-01"),
    ("Biotech",            "topic:bioinformatics stars:>10 created:>2023-01-01"),
    ("Quantum",            "topic:quantum-computing stars:>10 created:>2023-01-01"),
    ("Cybersecurity",      "topic:cybersecurity stars:>10 created:>2023-01-01"),
    ("Climate Tech",       "topic:climate-change stars:>10 created:>2023-01-01"),
]

COUNTRY_HINTS = {
    "france": "France", "paris": "France",
    "germany": "Germany", "berlin": "Germany", "munich": "Germany",
    "spain": "Spain", "barcelona": "Spain", "madrid": "Spain",
    "israel": "Israel", "tel aviv": "Israel",
    "uk": "United Kingdom", "london": "United Kingdom",
    "sweden": "Sweden", "stockholm": "Sweden",
    "netherlands": "Netherlands", "amsterdam": "Netherlands",
}


def _to_display_name(repo_name: str) -> str:
    """Convert snake_case/kebab-case repo name to Title Case display name."""
    return repo_name.replace("-", " ").replace("_", " ").title()


def _detect_country(location: str) -> str:
    if not location:
        return "Unknown"
    loc_lower = location.lower()
    for hint, country in COUNTRY_HINTS.items():
        if hint in loc_lower:
            return country
    return "Unknown"


def _detect_stage(stars: int) -> str:
    if stars >= 500:
        return "Seed"
    if stars >= 100:
        return "Pre-Seed"
    return "Early Stage"


async def fetch_github_startups(max_per_query: int = 5, existing_urls: set = None) -> list[dict]:
    """Search GitHub for deep tech repos across Elaia sectors."""
    existing_urls = existing_urls or set()
    results = []
    seen_urls: set[str] = set()

    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
        for sector, query in SECTOR_QUERIES:
            params = {
                "q": query,
                "sort": "stars",
                "order": "desc",
                "per_page": max_per_query * 3,  # fetch extra to filter
            }
            try:
                resp = await client.get(GITHUB_API, params=params)
                if resp.status_code == 403:
                    print("[GitHub] Rate limit hit — skipping remaining queries")
                    break
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                print(f"[GitHub] Query '{query}' failed: {e}")
                continue

            count = 0
            for item in data.get("items", []):
                html_url = item.get("html_url", "")
                if not html_url or html_url in seen_urls or html_url in existing_urls:
                    continue

                description = item.get("description") or ""
                if not description:
                    continue  # skip repos without description

                # Require at least a description (homepage optional)
                stars = item.get("stargazers_count", 0)
                owner = item.get("owner", {})
                location = (owner.get("location") or "") if isinstance(owner, dict) else ""

                repo_name = item.get("name", "")
                display_name = _to_display_name(repo_name)

                # Derive a richer description
                topics = item.get("topics", [])
                topics_str = ", ".join(topics[:5]) if topics else ""
                full_desc = description
                if topics_str:
                    full_desc = f"{description} Topics: {topics_str}."

                seen_urls.add(html_url)
                results.append({
                    "name": display_name,
                    "description": full_desc[:500],
                    "sector": sector,
                    "stage": _detect_stage(stars),
                    "country": _detect_country(location),
                    "website": item.get("homepage") or None,
                    "source": "github",
                    "hn_url": html_url,  # store repo URL in hn_url for dedup
                    "hn_points": stars,
                    "founders": None,
                    "founded_year": None,
                })

                count += 1
                if count >= max_per_query:
                    break

    return results
