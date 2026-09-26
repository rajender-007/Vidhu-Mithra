from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class DomainLabel(BaseModel):
    code: str
    name: str
    confidence: float = Field(ge=0, le=1)


class JurisdictionGuess(BaseModel):
    country: str = "India"
    state: str | None = None
    city: str | None = None
    status: Literal["confirmed", "inferred", "unknown"] = "unknown"


class MissingFact(BaseModel):
    question: str
    why_asking: str


class Option(BaseModel):
    title: str
    description: str
    prerequisites: list[str] = []
    evidence_needed: list[str] = []
    risk: RiskLevel = "MEDIUM"


class RiskItem(BaseModel):
    dimension: str
    level: RiskLevel
    explanation: str
    evidence: list[str] = []
    what_would_lower_it: list[str] = []


class NextStep(BaseModel):
    order: int
    title: str
    description: str
    owner: Literal["user", "lawyer", "system"] = "user"


class Citation(BaseModel):
    source_id: UUID | None = None
    title: str
    section_ref: str | None = None
    quote: str | None = None
    url: HttpUrl | None = None
    jurisdiction: str = "India"
    effective_date: date | None = None
    version: str | None = None
    verification: Literal["verified", "partial", "unverified"] = "unverified"
    verified_at: datetime | None = None


class LegalResponse(BaseModel):
    case_summary: str
    legal_domains: list[DomainLabel]
    jurisdiction: JurisdictionGuess
    important_facts: list[str]
    missing_facts: list[MissingFact]
    documents_needed: list[str]
    possible_options: list[Option]
    risks: list[RiskItem]
    next_steps: list[NextStep]
    citations: list[Citation]
    confidence: Literal["high", "medium", "low"]
    risk_level: RiskLevel
    handoff_recommended: bool
    disclaimer: str = "This is general legal information, not legal advice. Consider discussing your situation with a qualified lawyer."


class MatterCreate(BaseModel):
    title: str | None = None
    description: str
    language: str = "en"
    state: str | None = None
    city: str | None = None


class Matter(BaseModel):
    id: UUID
    title: str
    description: str
    language: str
    state: str | None = None
    city: str | None = None
    stage: str = "intake"
    risk_level: RiskLevel = "LOW"
    journey_progress: dict[str, str]
    created_at: datetime
    updated_at: datetime


class MessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=12000)
    language: str = "en"


class ExplainRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    level: Literal[1, 2, 3, 4] = 1
    language: str = "en"


class TimelineEvent(BaseModel):
    id: UUID
    event_date: date
    title: str
    description: str = ""
    source: str = "user"
    date_precision: Literal["exact", "month", "approximate"] = "exact"
    verification_status: Literal["verified", "partial", "unverified"] = "unverified"
    confidence: float = 0.5


class ActionPlan(BaseModel):
    version: int = 1
    current_situation: str
    known: list[str]
    unknown: list[str]
    options: list[Option]
    documents_required: list[str]
    evidence_to_preserve: list[str]
    risks: list[RiskItem]
    lawyer_questions: list[str]
    next_best_action: str
    disclaimer: str = "This is general legal information, not legal advice. Consider discussing your situation with a qualified lawyer."
