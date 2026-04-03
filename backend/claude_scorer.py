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

# ─── Default thesis values (used when no user config is set) ─────────────────

_DEFAULT_GEOGRAPHIES = ["France", "Spain", "Israel", "Germany"]
_DEFAULT_SECTORS = [
    "AI/ML infrastructure", "Quantum Computing", "Biotech/Drug Discovery",
    "Cybersecurity", "Climate Tech", "Semiconductors", "Industrial Robotics",
    "Fintech Infrastructure",
]
_DEFAULT_STAGES = ["Pre-Seed", "Seed", "Series A"]
_DEFAULT_TEAM_SIGNAL = (
    "Academic/PhD founders, university spinoffs, "
    "CNRS/INRIA/Pasteur/Fraunhofer/Weizmann/Unit 8200 backgrounds, prior exits"
)
_DEFAULT_TECH_SIGNAL = (
    "Proprietary research, patents, novel algorithms, hardware IP, deep tech defensibility"
)
_DEFAULT_EXCLUSIONS = (
    "Pure SaaS with no deep tech differentiation, US-only focused companies, "
    "late stage (Series B and beyond), B2C consumer apps, commodity tech with no IP protection"
)

MEMO_SYSTEM = """You are a senior investment analyst writing internal due diligence memos.
Write concise, analytical, and insightful content. Be direct and honest about both opportunities and risks.
Each section must be exactly 1-2 sentences — no more. Always respond with valid JSON only."""

MEMO_PROMPT = """Write a due diligence memo for this startup.

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
{thesis_context}
Write a structured memo in this JSON format. Each value must be 1-2 sentences only — be direct and specific:
{{
  "problem": "<market problem and pain point — 1-2 sentences>",
  "solution": "<technical approach and unique value proposition — 1-2 sentences>",
  "team": "<founding team credentials, experience, and gaps — 1-2 sentences>",
  "traction": "<current traction, customers, revenue, market validation — 1-2 sentences>",
  "elaia_fit": "<alignment with the investment thesis and why we are the right investor — 1-2 sentences>",
  "red_flags": "<top 2 risks or open diligence questions — 1-2 sentences>"
}}"""


def _build_scoring_system(thesis: Optional[dict]) -> str:
    t = thesis or {}
    geos = t.get("geographies") or _DEFAULT_GEOGRAPHIES
    sectors = t.get("sectors") or _DEFAULT_SECTORS
    stages = t.get("stages") or _DEFAULT_STAGES
    team_signal = t.get("team_signal") or _DEFAULT_TEAM_SIGNAL
    tech_signal = t.get("tech_signal") or _DEFAULT_TECH_SIGNAL
    exclusions = t.get("exclusions") or _DEFAULT_EXCLUSIONS

    geo_str = ", ".join(geos)
    sector_str = ", ".join(sectors)
    stage_str = ", ".join(stages)

    return f"""You are a senior investment analyst at a European deep tech venture capital firm.

Investment thesis:
STRONG FIT indicators:
- Geography: {geo_str}
- Sectors: {sector_str}
- Stage: {stage_str}
- Team: {team_signal}
- Technical moat: {tech_signal}

WEAK FIT indicators:
- {exclusions}

Always respond with valid JSON only. No markdown, no explanation outside the JSON."""


def _build_scoring_prompt(thesis: Optional[dict]) -> str:
    t = thesis or {}
    geos = t.get("geographies") or _DEFAULT_GEOGRAPHIES
    stages = t.get("stages") or _DEFAULT_STAGES
    team_signal = t.get("team_signal") or _DEFAULT_TEAM_SIGNAL
    tech_signal = t.get("tech_signal") or _DEFAULT_TECH_SIGNAL

    strong_geos = "/".join(geos[:4]) if geos else "France/Spain/Israel/Germany"
    strong_stages = "/".join(stages) if stages else "Pre-Seed/Seed/Series A"

    return """Analyze this startup against the investment thesis by scoring 5 dimensions independently.

Startup:
Name: {name}
Description: {description}
Sector: {sector}
Stage: {stage}
Country: {country}
Founders: {founders}
{analyst_context}
Score each dimension 0–100 against the thesis criteria:
- team (25%%): """ + team_signal + """ — penalize weak or unknown teams
- technology (25%%): """ + tech_signal + """ — penalize commodity SaaS
- market (20%%): TAM size, timing, growth signal, B2B vs B2C (B2C penalized)
- geography (15%%): """ + strong_geos + """ = strong fit; other EU = moderate; outside target = weak
- stage (15%%): """ + strong_stages + """ = strong; later stages = progressively weaker

Respond with JSON in exactly this format:
{{
  "team": <integer 0-100>,
  "technology": <integer 0-100>,
  "market": <integer 0-100>,
  "geography": <integer 0-100>,
  "stage": <integer 0-100>,
  "rationale": "<exactly 2 sentences summarising overall thesis fit>",
  "red_flag": "<one specific red flag, or null if none>"
}}"""


def _parse_json_response(text: str) -> Optional[dict]:
    """Robustly extract JSON from model response."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


_SUBSCORE_WEIGHTS = {
    "team": 0.25,
    "technology": 0.25,
    "market": 0.20,
    "geography": 0.15,
    "stage": 0.15,
}


def _clamp(v, lo=0, hi=100) -> float:
    return max(lo, min(hi, float(v)))


def score_startup(startup_data: dict, thesis_config: Optional[dict] = None) -> dict:
    """
    Score a startup synchronously using Claude API.
    Returns subscores + weighted fit_score + rationale + red_flag.
    Accepts optional thesis_config dict to override hard-coded defaults.
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Build analyst context block from notes + chat history
    context_parts = []
    if startup_data.get("user_notes"):
        context_parts.append(f"Analyst notes: {startup_data['user_notes']}")
    if startup_data.get("chat_history"):
        try:
            history = json.loads(startup_data["chat_history"]) if isinstance(startup_data["chat_history"], str) else startup_data["chat_history"]
            user_msgs = [m["content"] for m in history if m.get("role") == "user"][:6]
            if user_msgs:
                context_parts.append("Analyst chat feedback:\n" + "\n".join(f"- {m}" for m in user_msgs))
        except Exception:
            pass
    analyst_context = ("\nANALYST CONTEXT — adjust subscores to reflect this:\n" + "\n".join(context_parts) + "\n") if context_parts else ""

    scoring_system = _build_scoring_system(thesis_config)
    scoring_prompt_template = _build_scoring_prompt(thesis_config)

    prompt = scoring_prompt_template.format(
        name=startup_data.get("name", ""),
        description=startup_data.get("description", "")[:800],
        sector=startup_data.get("sector", ""),
        stage=startup_data.get("stage", ""),
        country=startup_data.get("country", ""),
        founders=startup_data.get("founders") or "Unknown",
        analyst_context=analyst_context,
    )

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=512,
            system=scoring_system,
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

        subscores = {k: _clamp(parsed.get(k, 50)) for k in _SUBSCORE_WEIGHTS}
        fit_score = round(sum(subscores[k] * w for k, w in _SUBSCORE_WEIGHTS.items()))

        return {
            "fit_score": fit_score,
            "subscore_team": subscores["team"],
            "subscore_technology": subscores["technology"],
            "subscore_market": subscores["market"],
            "subscore_geography": subscores["geography"],
            "subscore_stage": subscores["stage"],
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


def generate_memo(startup_data: dict, thesis_config: Optional[dict] = None) -> dict:
    """
    Generate a full DD memo for a startup using Claude API.
    Returns dict with memo section fields.
    Accepts optional thesis_config dict to override hard-coded defaults.
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Build optional thesis context line for the memo prompt
    thesis_context = ""
    if thesis_config:
        geos = thesis_config.get("geographies")
        sectors = thesis_config.get("sectors")
        stages = thesis_config.get("stages")
        parts = []
        if geos:
            parts.append(f"Target geographies: {', '.join(geos)}")
        if sectors:
            parts.append(f"Target sectors: {', '.join(sectors)}")
        if stages:
            parts.append(f"Target stages: {', '.join(stages)}")
        if parts:
            thesis_context = "Investment thesis focus: " + " | ".join(parts) + "\n"

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
        thesis_context=thesis_context,
    )

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=2048,
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
            "memo_problem": parsed.get("problem", ""),
            "memo_solution": parsed.get("solution", ""),
            "memo_team": parsed.get("team", ""),
            "memo_traction": parsed.get("traction", ""),
            "memo_elaia_fit": parsed.get("elaia_fit", ""),
            "memo_red_flags": parsed.get("red_flags", ""),
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
