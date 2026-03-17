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

SCORING_SYSTEM = """You are a senior investment analyst at Elaia, a French deep tech venture capital firm with €850M AUM, investing across Paris, Barcelona, and Tel Aviv.

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

SCORING_PROMPT = """Analyze this startup against Elaia's investment thesis by scoring 5 dimensions independently.

Startup:
Name: {name}
Description: {description}
Sector: {sector}
Stage: {stage}
Country: {country}
Founders: {founders}
{analyst_context}
Score each dimension 0–100 against Elaia's thesis criteria:
- team (25%): academic pedigree, domain expertise, PhD/spinoff background, Unit 8200 / CNRS / INRIA / Fraunhofer / Weizmann credentials, prior exits
- technology (25%): proprietary research, patents, novel algorithms, hardware IP, deep tech defensibility — penalize commodity SaaS
- market (20%): TAM size, timing, growth signal, B2B vs B2C (B2C penalized)
- geography (15%): France/Spain/Israel/Germany = strong fit; other EU = moderate; US-only = weak
- stage (15%): Pre-Seed/Seed/Series A = strong; Series B = moderate; later = weak

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

MEMO_SYSTEM = """You are a senior investment analyst at Elaia writing internal due diligence memos.
Write concise, analytical, and insightful content. Be direct and honest about both opportunities and risks.
Each section must be exactly 1-2 sentences — no more. Always respond with valid JSON only."""

MEMO_PROMPT = """Write a due diligence memo for this startup being considered by Elaia.

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

Write a structured memo in this JSON format. Each value must be 1-2 sentences only — be direct and specific:
{{
  "problem": "<market problem and pain point — 1-2 sentences>",
  "solution": "<technical approach and unique value proposition — 1-2 sentences>",
  "team": "<founding team credentials, experience, and gaps — 1-2 sentences>",
  "traction": "<current traction, customers, revenue, market validation — 1-2 sentences>",
  "elaia_fit": "<alignment with Elaia's thesis and why Elaia is the right investor — 1-2 sentences>",
  "red_flags": "<top 2 risks or open diligence questions — 1-2 sentences>"
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


_SUBSCORE_WEIGHTS = {
    "team": 0.25,
    "technology": 0.25,
    "market": 0.20,
    "geography": 0.15,
    "stage": 0.15,
}


def _clamp(v, lo=0, hi=100) -> float:
    return max(lo, min(hi, float(v)))


def score_startup(startup_data: dict) -> dict:
    """
    Score a startup synchronously using Claude API.
    Returns subscores + weighted fit_score + rationale + red_flag.
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Build analyst context block from notes + chat history
    context_parts = []
    if startup_data.get("user_notes"):
        context_parts.append(f"Analyst notes: {startup_data['user_notes']}")
    if startup_data.get("chat_history"):
        try:
            history = json.loads(startup_data["chat_history"]) if isinstance(startup_data["chat_history"], str) else startup_data["chat_history"]
            # Include only user messages as feedback signal (concise)
            user_msgs = [m["content"] for m in history if m.get("role") == "user"][:6]
            if user_msgs:
                context_parts.append("Analyst chat feedback:\n" + "\n".join(f"- {m}" for m in user_msgs))
        except Exception:
            pass
    analyst_context = ("\nANALYST CONTEXT — adjust subscores to reflect this:\n" + "\n".join(context_parts) + "\n") if context_parts else ""

    prompt = SCORING_PROMPT.format(
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
