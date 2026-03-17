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
    source: str = "seed"  # "hn" | "seed"
    hn_url: Optional[str] = None
    hn_points: Optional[int] = None

    # Claude scoring
    fit_score: Optional[float] = None
    score_rationale: Optional[str] = None
    red_flag: Optional[str] = None

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
    source: str
    hn_url: Optional[str]
    hn_points: Optional[int]
    fit_score: Optional[float]
    score_rationale: Optional[str]
    red_flag: Optional[str]
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
