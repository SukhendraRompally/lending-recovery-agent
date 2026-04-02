"""In-memory voice call session store."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from models import AgentPersona

SESSION_TTL_MINUTES = 60

@dataclass
class VoiceSession:
    session_id: str
    customer_id: str
    customer: dict
    persona: AgentPersona
    messages: list = field(default_factory=list)  # [{"role": "user"|"assistant", "content": str}]
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)
    status: str = "active"   # "active" | "ended"
    turn_count: int = 0


# Global in-memory store
SESSIONS: dict[str, VoiceSession] = {}


def create_session(customer_id: str, customer: dict, persona: AgentPersona) -> VoiceSession:
    session_id = str(uuid.uuid4())
    session = VoiceSession(
        session_id=session_id,
        customer_id=customer_id,
        customer=customer,
        persona=persona,
    )
    SESSIONS[session_id] = session
    return session


def get_session(session_id: str) -> Optional[VoiceSession]:
    session = SESSIONS.get(session_id)
    if session is None:
        return None
    # Auto-expire check
    if datetime.utcnow() - session.last_activity > timedelta(minutes=SESSION_TTL_MINUTES):
        del SESSIONS[session_id]
        return None
    return session


def add_message(session: VoiceSession, role: str, content: str) -> None:
    """Append a message to history and update activity timestamp."""
    session.messages.append({"role": role, "content": content})
    session.last_activity = datetime.utcnow()
    if role == "assistant":
        session.turn_count += 1


def end_session(session: VoiceSession) -> None:
    session.status = "ended"
    session.last_activity = datetime.utcnow()


def session_duration_seconds(session: VoiceSession) -> int:
    return int((session.last_activity - session.created_at).total_seconds())
