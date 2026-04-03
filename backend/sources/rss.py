"""EU startup RSS feed fetcher — uses Claude to extract structured startup data from articles."""

import asyncio
import json
import os
import xml.etree.ElementTree as ET
from typing import Optional

import anthropic
import httpx

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

RSS_FEEDS = [
    "https://tech.eu/feed/",
    "https://techcrunch.com/tag/europe/feed/",
]

MAX_ARTICLES_PER_FEED = 15


def _parse_feed(xml_text: str) -> list[dict]:
    """Parse RSS/Atom XML and return list of {title, summary, link} dicts."""
    articles = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"[RSS] XML parse error: {e}")
        return []

    # Handle both RSS <item> and Atom <entry>
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    # RSS 2.0
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        summary = (item.findtext("description") or item.findtext("summary") or "").strip()
        # Strip basic HTML from summary
        import re
        summary = re.sub(r"<[^>]+>", " ", summary).strip()[:400]
        if title and link:
            articles.append({"title": title, "summary": summary, "link": link})

    # Atom
    if not articles:
        for entry in root.iter("{http://www.w3.org/2005/Atom}entry"):
            title_el = entry.find("{http://www.w3.org/2005/Atom}title")
            link_el = entry.find("{http://www.w3.org/2005/Atom}link")
            summary_el = entry.find("{http://www.w3.org/2005/Atom}summary") or entry.find("{http://www.w3.org/2005/Atom}content")
            title = (title_el.text or "").strip() if title_el is not None else ""
            link = (link_el.get("href") or "").strip() if link_el is not None else ""
            summary = (summary_el.text or "").strip()[:400] if summary_el is not None else ""
            if title and link:
                articles.append({"title": title, "summary": summary, "link": link})

    return articles


def _extract_with_claude(articles: list[dict]) -> list[Optional[dict]]:
    """
    Send a batch of articles to Claude and get back structured startup data.
    Returns a list of the same length: either a startup dict or None.
    """
    if not articles:
        return []

    numbered = "\n".join(
        f'[{i+1}] Title: "{a["title"]}"\n    Summary: "{a["summary"]}"'
        for i, a in enumerate(articles)
    )

    prompt = f"""From these EU startup news article titles and summaries, extract structured data.
For each article about a SPECIFIC startup's funding round, product launch, or founding: return a JSON object.
For general opinion pieces, list articles, market overviews, or non-startup content: return null.

Articles:
{numbered}

Respond with ONLY a JSON array of exactly {len(articles)} elements (one per article, null if not a specific startup article):
[{{"name":"...","description":"...","sector":"...","stage":"...","country":"...","website":null}}, null, ...]

sector must be one of: AI/ML, Biotech, Quantum, Cybersecurity, Climate Tech, Semiconductors, Fintech, Industrial Robotics, Software
stage must be one of: Pre-Seed, Seed, Series A, Series B, Early Stage
country should be the startup's country (e.g. France, Germany, Spain, Israel, United Kingdom, Sweden, Netherlands, Unknown)"""

    client = anthropic.Anthropic()
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        if isinstance(parsed, list) and len(parsed) == len(articles):
            return parsed
        print(f"[RSS] Claude returned unexpected length: {len(parsed)} vs {len(articles)}")
        return [None] * len(articles)
    except Exception as e:
        print(f"[RSS] Claude extraction failed: {e}")
        return [None] * len(articles)


async def _fetch_feed(url: str, client: httpx.AsyncClient) -> list[dict]:
    try:
        resp = await client.get(url, follow_redirects=True)
        resp.raise_for_status()
        return _parse_feed(resp.text)
    except Exception as e:
        print(f"[RSS] Failed to fetch {url}: {e}")
        return []


async def fetch_rss_startups(existing_urls: set = None) -> list[dict]:
    """Fetch EU startup RSS feeds and use Claude to extract startup data."""
    existing_urls = existing_urls or set()
    results = []

    headers = {"User-Agent": "Mozilla/5.0 (compatible; DealFlowBot/1.0)"}
    async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
        feed_results = await asyncio.gather(*[_fetch_feed(url, client) for url in RSS_FEEDS])

    for articles in feed_results:
        # Deduplicate by link, skip already-known URLs
        new_articles = [a for a in articles if a["link"] not in existing_urls]
        batch = new_articles[:MAX_ARTICLES_PER_FEED]
        if not batch:
            continue

        # Run Claude extraction in thread pool (synchronous client)
        loop = asyncio.get_event_loop()
        extracted = await loop.run_in_executor(None, _extract_with_claude, batch)

        for article, startup_data in zip(batch, extracted):
            if not startup_data or not isinstance(startup_data, dict):
                continue
            name = startup_data.get("name", "").strip()
            description = startup_data.get("description", "").strip()
            if not name or not description:
                continue

            results.append({
                "name": name[:100],
                "description": description[:500],
                "sector": startup_data.get("sector") or "Software",
                "stage": startup_data.get("stage") or "Early Stage",
                "country": startup_data.get("country") or "Unknown",
                "website": startup_data.get("website") or None,
                "source": "rss",
                "hn_url": article["link"],  # article URL for dedup
                "hn_points": 0,
                "founders": None,
                "founded_year": None,
            })

    return results
