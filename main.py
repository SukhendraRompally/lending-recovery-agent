"""
Lending Recovery Agent — FastAPI Backend
Provides compliance-guarded, persona-driven debt collection outreach via Claude AI.
"""

import os
from fastapi import FastAPI, HTTPException, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import CUSTOMERS
from compliance import check_compliance, check_daily_limit
from call_store import append_call_record, get_calls_for_customer, build_call_record
from llm import generate_outreach_message, generate_handover_memo, _get_persona_for_customer, build_persona_trace, build_escalation_trace
from voice_sessions import (
    create_session,
    get_session,
    add_message,
    end_session,
    session_duration_seconds,
)
from voice_llm import generate_voice_response, text_to_speech, audio_to_base64
from models import (
    CustomerResponse,
    GenerateOutreachRequest,
    GenerateOutreachResponse,
    SummarizeRequest,
    SummarizeResponse,
    ComplianceStatus,
    RiskLevel,
    AgentPersona,
    RiskScoreBreakdown,
    VoiceCallStartRequest,
    VoiceCallStartResponse,
    VoiceCallRespondRequest,
    VoiceCallRespondResponse,
    VoiceSessionStatus,
    VoiceCallEndResponse,
    EscalateResponse,
)

app = FastAPI(
    title="Lending Recovery Agent API",
    description=(
        "Agentic AI backend for regulatory-compliant, empathy-driven debt collection. "
        "Built with FastAPI + Claude claude-opus-4-6."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _compute_risk_score(customer: dict) -> tuple[int, RiskLevel, RiskScoreBreakdown]:
    """
    Simple risk scoring:
      - Delinquency count:  +30 per occurrence (max 90)
      - Low loyalty:        +20 | medium: +10 | high: 0
      - Debt > $1000:       +10
      - Hardship flag:      -10 (mitigating factor — not higher risk, just different handling)
    """
    delinquency_component = min(customer["delinquency_count"] * 30, 90)
    loyalty_map = {"high": 0, "medium": 10, "low": 20}
    loyalty_component = loyalty_map.get(customer["loyalty"], 10)
    debt_component = 10 if customer["debt_amount"] > 1000 else 0
    hardship_adjustment = -10 if customer["hardship_flag"] else 0

    score = min(delinquency_component + loyalty_component + debt_component + hardship_adjustment, 100)
    score = max(score, 0)

    if score < 35:
        level = RiskLevel.low
    elif score < 65:
        level = RiskLevel.medium
    else:
        level = RiskLevel.high

    breakdown = RiskScoreBreakdown(
        delinquency_component=delinquency_component,
        loyalty_component=loyalty_component,
        debt_component=debt_component,
        hardship_adjustment=hardship_adjustment,
        final_score=score,
    )

    return score, level, breakdown


def _get_customer_or_404(customer_id: str) -> dict:
    customer = CUSTOMERS.get(customer_id)
    if not customer:
        raise HTTPException(
            status_code=404,
            detail=f"Customer '{customer_id}' not found. Available IDs: {list(CUSTOMERS.keys())}",
        )
    return customer


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "service": "Lending Recovery Agent API",
        "status": "online",
        "version": "1.0.0",
        "endpoints": [
            "/customer/{id}", "/generate-outreach", "/summarize", "/customers",
            "/voice/call/start", "/voice/call/{id}/respond",
            "/voice/call/{id}/status", "/voice/call/{id}/end",
        ],
    }


@app.get("/customers", tags=["Customers"])
def list_customers():
    """Return the list of all mock customer IDs and names."""
    return {
        cid: {"name": c["name"], "loan_id": c["loan_id"], "debt_amount": c["debt_amount"]}
        for cid, c in CUSTOMERS.items()
    }


@app.get("/customer/{customer_id}", response_model=CustomerResponse, tags=["Customers"])
def get_customer(customer_id: str):
    """
    Return full customer metadata, computed risk score, agent persona, and compliance status.
    Compliance status here is based on current contact-attempt count only (time-independent).
    """
    customer = _get_customer_or_404(customer_id)
    risk_score, risk_level, risk_breakdown = _compute_risk_score(customer)
    persona = _get_persona_for_customer(customer)
    persona_trace = build_persona_trace(customer)

    time_ok, time_reason = check_compliance(customer)
    attempt_ok, attempt_reason = check_daily_limit(customer["contact_attempts_today"])
    compliance_status = ComplianceStatus.allowed if (time_ok and attempt_ok) else ComplianceStatus.blocked

    return CustomerResponse(
        id=customer["id"],
        name=customer["name"],
        loan_id=customer["loan_id"],
        debt_amount=customer["debt_amount"],
        currency=customer["currency"],
        delinquency_count=customer["delinquency_count"],
        delinquency_label=customer["delinquency_label"],
        tenure_years=customer["tenure_years"],
        loyalty=customer["loyalty"],
        ltv_segment=customer["ltv_segment"],
        contact_attempts_today=customer["contact_attempts_today"],
        jurisdiction=customer["jurisdiction"],
        timezone=customer["timezone"],
        utc_offset=customer["utc_offset"],
        hardship_flag=customer["hardship_flag"],
        risk_score=risk_score,
        risk_level=risk_level,
        agent_persona=persona,
        compliance_status=compliance_status,
        compliance_reason=time_reason if not time_ok else attempt_reason,
        max_contact_attempts=3,
        risk_score_breakdown=risk_breakdown,
        persona_trace=persona_trace,
    )


@app.get("/customer/{customer_id}/calls", tags=["Customers"])
def get_customer_calls(customer_id: str):
    """
    Return the full call history for a customer, oldest first.
    Each record includes session metadata, Transfer Memo, and full transcript.
    """
    _get_customer_or_404(customer_id)  # 404 if unknown ID
    return {"customer_id": customer_id, "calls": get_calls_for_customer(customer_id)}


@app.get("/customer/{customer_id}/escalate", response_model=EscalateResponse, tags=["Customers"])
def escalate_to_human(customer_id: str):
    """
    Return the Transfer Memo from the most recent completed call for this customer.
    Intended for the 'Escalate to Human' button — no need to re-generate anything,
    the memo was already produced when the call ended.
    """
    customer = _get_customer_or_404(customer_id)
    calls = get_calls_for_customer(customer_id)

    if not calls:
        raise HTTPException(
            status_code=404,
            detail=f"No completed calls found for customer '{customer_id}'. End a voice call first to generate a Transfer Memo.",
        )

    last = calls[-1]  # most recent call
    return EscalateResponse(
        customer_id=customer_id,
        customer_name=customer["name"],
        session_id=last.get("session_id"),
        handover_memo=last["handover_memo"],
        escalation_recommended=last["escalation_recommended"],
        persona=last.get("persona"),
        total_turns=last.get("turn_count"),
        duration_seconds=last.get("duration_seconds"),
        ended_at=last.get("ended_at"),
    )


@app.post("/generate-outreach", response_model=GenerateOutreachResponse, tags=["Outreach"])
def generate_outreach(request: GenerateOutreachRequest):
    """
    Generate a persona-driven, policy-grounded outreach message — or return a
    'Compliance Blocked' response if the time or daily limit rules are violated.

    Priority chain:
      1. Time compliance check  (FDCPA 08:00–21:00)
      2. Daily attempt limit    (max 3/day)
      3. LLM persona generation (if both pass)
    """
    customer = _get_customer_or_404(request.customer_id)

    # ── 1. Time compliance ────────────────────────────────────────────────────
    time_ok, time_reason = check_compliance(customer, request.current_time)
    if not time_ok:
        return GenerateOutreachResponse(
            customer_id=customer["id"],
            customer_name=customer["name"],
            compliance_status=ComplianceStatus.blocked,
            compliance_reason=time_reason,
        )

    # ── 2. Daily attempt limit ────────────────────────────────────────────────
    attempt_ok, attempt_reason = check_daily_limit(customer["contact_attempts_today"])
    if not attempt_ok:
        return GenerateOutreachResponse(
            customer_id=customer["id"],
            customer_name=customer["name"],
            compliance_status=ComplianceStatus.blocked,
            compliance_reason=attempt_reason,
        )

    # ── 3. LLM outreach generation ────────────────────────────────────────────
    message_text, persona, policy_refs = generate_outreach_message(customer)
    _, _, risk_breakdown = _compute_risk_score(customer)

    return GenerateOutreachResponse(
        customer_id=customer["id"],
        customer_name=customer["name"],
        compliance_status=ComplianceStatus.allowed,
        compliance_reason=time_reason,
        agent_persona=persona,
        message=message_text,
        policy_references=policy_refs,
        persona_trace=build_persona_trace(customer),
        risk_score_breakdown=risk_breakdown,
    )


@app.post("/summarize", response_model=SummarizeResponse, tags=["Summary"])
def summarize_interaction(request: SummarizeRequest):
    """
    Synthesize the full chat history into a 2-sentence Transfer Memo for agency
    handover or supervisor review — ensuring zero context loss.
    """
    customer = _get_customer_or_404(request.customer_id)

    if not request.chat_history:
        raise HTTPException(
            status_code=422,
            detail="chat_history must contain at least one message.",
        )

    chat_history_dicts = [msg.model_dump() for msg in request.chat_history]
    memo, escalation = generate_handover_memo(customer, chat_history_dicts)

    return SummarizeResponse(
        customer_id=customer["id"],
        customer_name=customer["name"],
        handover_memo=memo,
        escalation_recommended=escalation,
    )


# ── Voice Call Router ─────────────────────────────────────────────────────────

voice_router = APIRouter(prefix="/voice", tags=["Voice Call"])


@voice_router.post("/call/start", response_model=VoiceCallStartResponse)
def voice_call_start(request: VoiceCallStartRequest):
    """
    Initiate a live voice call session.

    1. Compliance check (time window + daily limit) — blocks immediately if violated.
    2. Create in-memory session.
    3. Generate opening greeting via multi-turn Claude (voice tone).
    4. Convert greeting to speech via ElevenLabs → return as base64 audio.
    """
    customer = _get_customer_or_404(request.customer_id)

    # ── Compliance ────────────────────────────────────────────────────────────
    time_ok, time_reason = check_compliance(customer, request.current_time)
    if not time_ok:
        return VoiceCallStartResponse(
            customer_name=customer["name"],
            compliance_status=ComplianceStatus.blocked,
            compliance_reason=time_reason,
            audio_available=False,
        )

    attempt_ok, attempt_reason = check_daily_limit(customer["contact_attempts_today"])
    if not attempt_ok:
        return VoiceCallStartResponse(
            customer_name=customer["name"],
            compliance_status=ComplianceStatus.blocked,
            compliance_reason=attempt_reason,
            audio_available=False,
        )

    # ── Create session ────────────────────────────────────────────────────────
    persona = _get_persona_for_customer(customer)
    session = create_session(customer["id"], customer, persona)

    # ── Generate opening greeting ─────────────────────────────────────────────
    greeting_text = generate_voice_response(session)
    add_message(session, "assistant", greeting_text)

    # ── TTS ───────────────────────────────────────────────────────────────────
    audio_bytes = text_to_speech(greeting_text, persona)
    audio_b64 = audio_to_base64(audio_bytes) if audio_bytes else None

    return VoiceCallStartResponse(
        session_id=session.session_id,
        customer_name=customer["name"],
        agent_persona=persona,
        compliance_status=ComplianceStatus.allowed,
        compliance_reason=time_reason,
        agent_text=greeting_text,
        audio_base64=audio_b64,
        audio_available=bool(audio_bytes),
        persona_trace=build_persona_trace(customer),
    )


@voice_router.post("/call/{session_id}/respond", response_model=VoiceCallRespondResponse)
def voice_call_respond(session_id: str, request: VoiceCallRespondRequest):
    """
    Process the customer's spoken reply and return the agent's next response.

    - Appends customer message to session history
    - Calls Claude with full conversation context
    - Converts agent reply to speech via ElevenLabs
    """
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found or expired.")
    if session.status == "ended":
        raise HTTPException(status_code=409, detail="This call session has already ended.")

    # Append customer message
    add_message(session, "user", request.customer_message)

    # Generate agent response
    agent_text = generate_voice_response(session)
    add_message(session, "assistant", agent_text)

    # TTS
    audio_bytes = text_to_speech(agent_text, session.persona)
    audio_b64 = audio_to_base64(audio_bytes) if audio_bytes else None

    return VoiceCallRespondResponse(
        session_id=session_id,
        agent_text=agent_text,
        audio_base64=audio_b64,
        audio_available=bool(audio_bytes),
        turn_number=session.turn_count,
    )


@voice_router.get("/call/{session_id}/status", response_model=VoiceSessionStatus)
def voice_call_status(session_id: str):
    """Return current session metadata."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found or expired.")

    return VoiceSessionStatus(
        session_id=session.session_id,
        customer_id=session.customer_id,
        customer_name=session.customer["name"],
        agent_persona=session.persona,
        status=session.status,
        turn_count=session.turn_count,
        created_at=session.created_at.isoformat(),
        last_activity=session.last_activity.isoformat(),
    )


@voice_router.post("/call/{session_id}/end", response_model=VoiceCallEndResponse)
def voice_call_end(session_id: str):
    """
    End the call session and generate a Transfer Memo for handover.
    Reuses the existing generate_handover_memo() from llm.py.
    """
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found or expired.")

    duration = session_duration_seconds(session)
    end_session(session)

    # Convert session messages to ChatMessage-compatible dicts for memo generation
    chat_history = [
        {"role": "agent" if m["role"] == "assistant" else "customer", "content": m["content"]}
        for m in session.messages
    ]

    memo, escalation = generate_handover_memo(session.customer, chat_history)

    chat_text = "\n".join(f"[{m['role'].upper()}]: {m['content']}" for m in session.messages)
    escalation_trace = build_escalation_trace(session.customer, memo, chat_text)

    # Persist call record to file
    record = build_call_record(session, memo, escalation, duration)
    append_call_record(record)

    # Increment in-memory contact attempt counter
    cid = session.customer_id
    if cid in CUSTOMERS:
        CUSTOMERS[cid]["contact_attempts_today"] = CUSTOMERS[cid].get("contact_attempts_today", 0) + 1

    return VoiceCallEndResponse(
        session_id=session_id,
        customer_name=session.customer["name"],
        handover_memo=memo,
        escalation_recommended=escalation,
        total_turns=session.turn_count,
        duration_seconds=duration,
        escalation_trace=escalation_trace,
    )


app.include_router(voice_router)
