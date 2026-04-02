"""Pydantic models for request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class ComplianceStatus(str, Enum):
    allowed = "allowed"
    blocked = "blocked"


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class AgentPersona(str, Enum):
    supportive_partner = "Supportive Partner"
    formal_officer = "Formal Officer"
    balanced_advisor = "Balanced Advisor"


class CustomerResponse(BaseModel):
    id: str
    name: str
    loan_id: str
    debt_amount: float
    currency: str
    delinquency_count: int
    delinquency_label: str
    tenure_years: float
    loyalty: str
    ltv_segment: str
    contact_attempts_today: int
    jurisdiction: str
    timezone: str
    utc_offset: float
    hardship_flag: bool
    # Computed fields
    risk_score: int = Field(..., description="0-100 risk score")
    risk_level: RiskLevel
    agent_persona: AgentPersona
    compliance_status: ComplianceStatus
    compliance_reason: Optional[str] = None
    max_contact_attempts: int = 3


class GenerateOutreachRequest(BaseModel):
    customer_id: str
    current_time: Optional[str] = Field(
        default=None,
        description="UTC time in HH:MM format. Omit to use server UTC now (recommended).",
        examples=["14:30", "08:00"],
    )


class GenerateOutreachResponse(BaseModel):
    customer_id: str
    customer_name: str
    compliance_status: ComplianceStatus
    compliance_reason: Optional[str] = None
    agent_persona: Optional[AgentPersona] = None
    message: Optional[str] = None
    policy_references: Optional[List[str]] = None


class ChatMessage(BaseModel):
    role: str = Field(..., description="'agent' or 'customer'")
    content: str


class SummarizeRequest(BaseModel):
    customer_id: str
    chat_history: List[ChatMessage]


class SummarizeResponse(BaseModel):
    customer_id: str
    customer_name: str
    handover_memo: str
    escalation_recommended: bool


# ── Voice Call Models ─────────────────────────────────────────────────────────

class VoiceCallStartRequest(BaseModel):
    customer_id: str
    current_time: Optional[str] = Field(
        default=None,
        description="UTC time in HH:MM format. Omit to use server UTC now (recommended).",
        examples=["14:00", "09:30"],
    )


class VoiceCallStartResponse(BaseModel):
    session_id: Optional[str] = None
    customer_name: str
    agent_persona: Optional[AgentPersona] = None
    compliance_status: ComplianceStatus
    compliance_reason: Optional[str] = None
    agent_text: Optional[str] = None     # None if compliance blocked
    audio_base64: Optional[str] = None   # None if blocked or TTS unavailable
    audio_available: bool = False


class VoiceCallRespondRequest(BaseModel):
    customer_message: str = Field(
        ...,
        description="Transcribed customer speech from browser Web Speech API",
        min_length=1,
    )


class VoiceCallRespondResponse(BaseModel):
    session_id: str
    agent_text: str
    audio_base64: Optional[str] = None
    audio_available: bool
    turn_number: int


class VoiceSessionStatus(BaseModel):
    session_id: str
    customer_id: str
    customer_name: str
    agent_persona: AgentPersona
    status: str
    turn_count: int
    created_at: str
    last_activity: str


class VoiceCallEndResponse(BaseModel):
    session_id: str
    customer_name: str
    handover_memo: str
    escalation_recommended: bool
    total_turns: int
    duration_seconds: int
