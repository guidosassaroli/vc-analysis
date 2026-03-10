"""
Claude API integration for startup scoring and due diligence memo generation.
Uses Anthropic's claude-sonnet-4-6 model with structured JSON outputs.
"""

import json
import os
import re
from datetime import datetime, timezone
from typing import Optional

import anthropic

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

SCORING_SYSTEM = """You are a senior investment analyst at Elaia Partners, a French deep tech venture capital firm with €850M AUM, investing across Paris, Barcelona, and Tel Aviv.

Elaia's investment thesis:
STRONG FIT indicators:
- Geography: France, Spain, Israel, Germany (European deep tech ecosystem)
- Sectors: AI/ML infrastructure, Quantum Computing, Biotech/Drug Discovery, Cybersecurity, Climate Tech, Semiconductors, Industrial Robotics, Fintech Infrastructure
- Stage: Pre-Seed, Seed, Series A
- Team: Academic/PhD founders, university spinoffs, CNRS/INRIA/Pasteur/Fraunhofer/Weizmann/Unit 8200 backgrounds
- Technical moat: proprietary research, patents, novel algorithms, hardware IP

WEAK FIT indicators:
- Pure SaaS with no deep tech differentiation
- US-only focused companies
- Late stage (Series B and beyond)
- B2C consumer apps
- Commodity tech with no IP protection

Always respond with valid JSON only. No markdown, no explanation outside the JSON."""

SCORING_PROMPT = """Analyze this startup against Elaia Partners' investment thesis.

Startup:
Name: {name}
Description: {description}
Sector: {sector}
Stage: {stage}
Country: {country}
Founders: {founders}

Respond with JSON in exactly this format:
{{
  "fit_score": <integer 0-100>,
  "rationale": "<exactly 2 sentences explaining the score>",
  "red_flag": "<one specific red flag, or null if none>"
}}"""

MEMO_SYSTEM = """You are a senior investment analyst at Elaia Partners writing internal due diligence memos.
Write concise, analytical, and insightful content. Be direct and honest about both opportunities and risks.
Always respond with valid JSON only."""

MEMO_PROMPT = """Write a due diligence memo for this startup being considered by Elaia Partners.

Startup:
Name: {name}
Description: {description}
Sector: {sector}
Stage: {stage}
Country: {country}
Founders: {founders}
Fit Score: {fit_score}/100
Score Rationale: {rationale}
Red Flag: {red_flag}

Write a structured memo in this JSON format (2-3 sentences per section):
{{
  "problem": "<market problem and pain point the startup addresses>",
  "solution": "<technical approach and unique value proposition>",
  "team": "<assessment of founding team credentials, relevant experience, and gaps>",
  "traction": "<current traction, milestones, customers, revenue, and market validation>",
  "elaia_fit": "<specific alignment with Elaia's thesis, portfolio synergies, and why Elaia is the right investor>",
  "red_flags": "<key risks, concerns, and open diligence questions>"
}}"""


def _parse_json_response(text: str) -> Optional[dict]:
    """Robustly extract JSON from model response."""
    text = text.strip()
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to extract JSON block
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def score_startup(startup_data: dict) -> dict:
    """
    Score a startup synchronously using Claude API.
    Returns dict with fit_score, rationale, red_flag.
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = SCORING_PROMPT.format(
        name=startup_data.get("name", ""),
        description=startup_data.get("description", "")[:800],
        sector=startup_data.get("sector", ""),
        stage=startup_data.get("stage", ""),
        country=startup_data.get("country", ""),
        founders=startup_data.get("founders") or "Unknown",
    )

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=512,
            system=SCORING_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text
        parsed = _parse_json_response(raw)

        if not parsed:
            return {
                "fit_score": 50,
                "rationale": "Unable to parse scoring response. Manual review required.",
                "red_flag": "Automated scoring failed",
                "scored_at": datetime.now(timezone.utc),
            }

        return {
            "fit_score": max(0, min(100, int(parsed.get("fit_score", 50)))),
            "rationale": str(parsed.get("rationale", ""))[:500],
            "red_flag": parsed.get("red_flag") or None,
            "scored_at": datetime.now(timezone.utc),
        }

    except Exception as e:
        print(f"[Claude] Scoring failed for {startup_data.get('name')}: {e}")
        return {
            "fit_score": 0,
            "rationale": f"Scoring error: {str(e)[:200]}",
            "red_flag": "API error during scoring",
            "scored_at": datetime.now(timezone.utc),
        }


def generate_memo(startup_data: dict) -> dict:
    """
    Generate a full DD memo for a startup using Claude API.
    Returns dict with memo section fields.
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = MEMO_PROMPT.format(
        name=startup_data.get("name", ""),
        description=startup_data.get("description", "")[:800],
        sector=startup_data.get("sector", ""),
        stage=startup_data.get("stage", ""),
        country=startup_data.get("country", ""),
        founders=startup_data.get("founders") or "Unknown",
        fit_score=startup_data.get("fit_score", "N/A"),
        rationale=startup_data.get("score_rationale", ""),
        red_flag=startup_data.get("red_flag") or "None identified",
    )

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=1200,
            system=MEMO_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text
        parsed = _parse_json_response(raw)

        if not parsed:
            return {
                "memo_problem": "Unable to generate memo. Please retry.",
                "memo_solution": None,
                "memo_team": None,
                "memo_traction": None,
                "memo_elaia_fit": None,
                "memo_red_flags": None,
            }

        return {
            "memo_problem": parsed.get("problem", "")[:600],
            "memo_solution": parsed.get("solution", "")[:600],
            "memo_team": parsed.get("team", "")[:600],
            "memo_traction": parsed.get("traction", "")[:600],
            "memo_elaia_fit": parsed.get("elaia_fit", "")[:600],
            "memo_red_flags": parsed.get("red_flags", "")[:600],
        }

    except Exception as e:
        print(f"[Claude] Memo generation failed for {startup_data.get('name')}: {e}")
        return {
            "memo_problem": f"Memo generation error: {str(e)[:200]}",
            "memo_solution": None,
            "memo_team": None,
            "memo_traction": None,
            "memo_elaia_fit": None,
            "memo_red_flags": None,
        }
