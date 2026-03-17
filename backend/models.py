from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Startup(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: str
    sector: str = Field(index=True)
    stage: str = Field(index=True)
    country: str = Field(index=True)
    founded_year: Optional[int] = None
    website: Optional[str] = None
    founders: Optional[str] = None  # comma-separated list
    funding: Optional[str] = None   # e.g. "Raised $2M Seed"
    linkedin_url: Optional[str] = None
    status: str = Field(default="Sourced")  # pipeline stage
    source: str = "seed"  # "hn" | "seed"
    hn_url: Optional[str] = None
    hn_points: Optional[int] = None

    # Claude scoring — overall
    fit_score: Optional[float] = None
    score_rationale: Optional[str] = None
    red_flag: Optional[str] = None

    # Subscores (0-100 each, weighted into fit_score)
    subscore_team: Optional[float] = None        # 25%
    subscore_technology: Optional[float] = None  # 25%
    subscore_market: Optional[float] = None      # 20%
    subscore_geography: Optional[float] = None   # 15%
    subscore_stage: Optional[float] = None       # 15%

    # Analyst memory
    user_notes: Optional[str] = None       # free-text analyst annotations
    chat_history: Optional[str] = None     # JSON-serialised conversation

    # Due diligence memo sections
    memo_problem: Optional[str] = None
    memo_solution: Optional[str] = None
    memo_team: Optional[str] = None
    memo_traction: Optional[str] = None
    memo_elaia_fit: Optional[str] = None
    memo_red_flags: Optional[str] = None

    scored_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StartupRead(SQLModel):
    id: int
    name: str
    description: str
    sector: str
    stage: str
    country: str
    founded_year: Optional[int]
    website: Optional[str]
    founders: Optional[str]
    funding: Optional[str]
    linkedin_url: Optional[str]
    status: str
    source: str
    hn_url: Optional[str]
    hn_points: Optional[int]
    fit_score: Optional[float]
    score_rationale: Optional[str]
    red_flag: Optional[str]
    subscore_team: Optional[float]
    subscore_technology: Optional[float]
    subscore_market: Optional[float]
    subscore_geography: Optional[float]
    subscore_stage: Optional[float]
    user_notes: Optional[str]
    chat_history: Optional[str]
    memo_problem: Optional[str]
    memo_solution: Optional[str]
    memo_team: Optional[str]
    memo_traction: Optional[str]
    memo_elaia_fit: Optional[str]
    memo_red_flags: Optional[str]
    scored_at: Optional[datetime]
    created_at: datetime


class RefreshStatus(SQLModel):
    fetched: int
    new: int
    scored: int
    message: str
