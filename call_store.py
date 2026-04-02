"""File-based call log persistence — appends JSON records to call_logs.jsonl."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

CALL_LOG_FILE = Path(__file__).parent / "call_logs.jsonl"


def append_call_record(record: dict) -> None:
    """Append a single call record as a JSON line to the log file."""
    with open(CALL_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")


def get_calls_for_customer(customer_id: str) -> list[dict]:
    """Return all call records for a given customer, oldest first."""
    if not CALL_LOG_FILE.exists():
        return []

    records = []
    with open(CALL_LOG_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                if record.get("customer_id") == customer_id:
                    records.append(record)
            except json.JSONDecodeError:
                continue

    return records


def get_all_calls() -> list[dict]:
    """Return every call record across all customers."""
    if not CALL_LOG_FILE.exists():
        return []

    records = []
    with open(CALL_LOG_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    return records


def build_call_record(session, memo: str, escalation: bool, duration_seconds: int) -> dict:
    """Construct a serialisable call record from a VoiceSession."""
    return {
        "session_id": session.session_id,
        "customer_id": session.customer_id,
        "customer_name": session.customer["name"],
        "persona": session.persona.value,
        "started_at": session.created_at.isoformat(),
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": duration_seconds,
        "turn_count": session.turn_count,
        "handover_memo": memo,
        "escalation_recommended": escalation,
        "transcript": [
            {"role": m["role"], "content": m["content"]}
            for m in session.messages
        ],
    }
