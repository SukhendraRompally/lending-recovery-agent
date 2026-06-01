"""Multi-turn LLM conversation (DeepSeek) + ElevenLabs TTS for voice call demo."""

import os
import base64
import logging
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

logger = logging.getLogger(__name__)

from database import BANK_HARDSHIP_POLICY
from models import AgentPersona

_az_client: OpenAI | None = None

def _get_client() -> OpenAI:
    global _az_client
    if _az_client is None:
        _az_client = OpenAI(
            api_key=os.environ.get("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com",
        )
    return _az_client

DEPLOYMENT = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

# Custom voice ID used for all personas
CUSTOM_VOICE_ID = "yLZAvtg5PITL2tUmz4UB"


def _build_voice_system_prompt(persona: AgentPersona, customer: dict) -> str:
    """Build a voice-optimised (conversational) system prompt for phone call simulation."""

    if persona == AgentPersona.supportive_partner:
        persona_instructions = """
AGENT PERSONA: Supportive Partner

You are a warm, empathetic financial wellbeing advisor at Greenleaf Bank on a live phone call.
You genuinely care about helping the customer find a solution. Treat them as a partner.

TONE:
- Warm, understanding, and non-judgmental
- Lead with empathy before pivoting to options
- Emphasise deferral and flexible repayment as first resort
- Use phrases like "I completely understand", "we can work through this together"
- NEVER use threatening or urgent language
"""

    elif persona == AgentPersona.formal_officer:
        persona_instructions = """
AGENT PERSONA: Formal Officer

You are a professional debt recovery officer at Greenleaf Bank on a live phone call.
You are firm, direct, and clear about consequences — but always professional and compliant.

TONE:
- Formal and direct
- State the outstanding amount and delinquency clearly
- Reference consequences (credit bureau reporting, escalation) where appropriate
- Still offer at least one resolution path per turn
- Use phrases like "it is important that we resolve this", "I need to make you aware"
- Never harass or use language that could constitute a threat of illegal action
"""

    else:  # balanced_advisor
        persona_instructions = """
AGENT PERSONA: Balanced Advisor

You are a professional yet empathetic debt recovery advisor at Greenleaf Bank on a live phone call.
Balance firmness with understanding.

TONE:
- Professional but approachable
- Acknowledge difficulty without dismissing urgency
- Present options alongside consequences of inaction
- Use phrases like "we understand this may be a difficult time", "let's find a resolution together"
"""

    return f"""{persona_instructions}

--- BANK HARDSHIP & RECOVERY POLICY (use this to cite specific options) ---
{BANK_HARDSHIP_POLICY}
--- END OF POLICY ---

CRITICAL VOICE CALL RULES:
- Keep each response to 2-3 spoken sentences MAXIMUM — this is a phone call, not a letter
- Use natural conversational spoken language — no "Dear Mr/Ms", no formal letter structure
- ALWAYS mention at least one concrete policy option per response (e.g. "we have a 3-month deferral option")
- If customer seems distressed or emotional, acknowledge their feelings FIRST before pivoting to solutions
- When asked for specifics, reference the policy (minimum 10% payment, 3/6/12 month plans, etc.)
- Close each turn with either a question or a clear next step to keep the conversation moving
- NEVER threaten illegal action or use abusive/harassing language (FDCPA compliant)
"""


def generate_voice_response(session) -> str:
    """
    Generate the agent's next conversational reply using full session history.

    Args:
        session: VoiceSession instance with .messages, .persona, .customer

    Returns:
        Agent response text (2-3 spoken sentences)
    """
    system_prompt = _build_voice_system_prompt(session.persona, session.customer)

    messages = list(session.messages)
    if not messages:
        # Opening turn — inject call context as the first user message
        opening_context = (
            f"[CALL CONNECTED] You are calling {session.customer['name']} regarding "
            f"loan {session.customer['loan_id']}. Outstanding balance: "
            f"${session.customer['debt_amount']:,.2f} USD. "
            f"Delinquency status: {session.customer['delinquency_label']}. "
            f"Customer tenure: {session.customer['tenure_years']} year(s). "
            f"Hardship flag: {'Yes' if session.customer['hardship_flag'] else 'No'}. "
            f"Begin the call with a professional greeting, introduce yourself and the purpose of the call."
        )
        messages = [{"role": "user", "content": opening_context}]

    az_messages = [{"role": "system", "content": system_prompt}] + messages

    response = _get_client().chat.completions.create(
        model=DEPLOYMENT,
        max_tokens=256,
        messages=az_messages,
    )

    return (response.choices[0].message.content or "I apologise, there was a technical issue. Please hold.").strip()


def text_to_speech(text: str, persona: AgentPersona) -> bytes:
    """
    Convert agent text to speech using ElevenLabs.

    Returns:
        Raw MP3 bytes, or empty bytes on failure (caller sets audio_available=False).
    """
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        logger.error("ELEVENLABS_API_KEY not set — TTS disabled. Set this env var to enable voice.")
        return b""

    try:
        from elevenlabs.client import ElevenLabs
        from elevenlabs import VoiceSettings

        el_client = ElevenLabs(api_key=api_key)

        audio_generator = el_client.text_to_speech.convert(
            voice_id=CUSTOM_VOICE_ID,
            text=text,
            model_id="eleven_turbo_v2_5",
            voice_settings=VoiceSettings(
                stability=0.5,
                similarity_boost=0.75,
                style=0.0,
                use_speaker_boost=True,
            ),
        )
        return b"".join(audio_generator)

    except Exception as exc:
        logger.error("ElevenLabs TTS failed (voice_id=%s): %s", CUSTOM_VOICE_ID, exc)
        return b""



def audio_to_base64(audio_bytes: bytes) -> str:
    """Encode raw audio bytes to a base64 string for JSON transport."""
    return base64.b64encode(audio_bytes).decode("utf-8")
