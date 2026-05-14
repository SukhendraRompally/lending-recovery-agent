"""LLM integration using Azure OpenAI with persona-based system prompts."""

import os
from dotenv import load_dotenv
from openai import AzureOpenAI
from database import BANK_HARDSHIP_POLICY
from models import AgentPersona, PersonaTrace, EscalationTrace

load_dotenv()

_client: AzureOpenAI | None = None

def _get_client() -> AzureOpenAI:
    global _client
    if _client is None:
        _client = AzureOpenAI(
            azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT"),
            api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
        )
    return _client

DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4.1")


def build_persona_trace(customer: dict) -> PersonaTrace:
    """Return a structured trace explaining why a persona was assigned."""
    loyalty = customer.get("loyalty", "medium").lower()
    delinquency_count = customer.get("delinquency_count", 1)
    tenure_years = customer.get("tenure_years", 0)
    hardship = customer.get("hardship_flag", False)

    if loyalty == "high" and delinquency_count <= 1:
        return PersonaTrace(
            assigned_persona="Supportive Partner",
            trigger_rule="loyalty == 'high' AND delinquency_count <= 1",
            reasoning=(
                f"{customer['name']} has been a customer for {tenure_years} year(s) with high loyalty "
                f"and only {delinquency_count} missed payment — relationship preservation protocol activated. "
                f"Warm, empathetic tone selected to keep the customer engaged and find a solution together."
                + (" Hardship flag noted — deferral options will be foregrounded." if hardship else "")
            ),
            key_signals={
                "loyalty": loyalty,
                "delinquency_count": delinquency_count,
                "tenure_years": tenure_years,
                "hardship_flag": hardship,
            },
        )
    elif loyalty == "low" or delinquency_count >= 3:
        trigger = "loyalty == 'low'" if loyalty == "low" else f"delinquency_count >= 3 ({delinquency_count} missed)"
        return PersonaTrace(
            assigned_persona="Formal Officer",
            trigger_rule=f"loyalty == 'low' OR delinquency_count >= 3  →  triggered: {trigger}",
            reasoning=(
                f"{customer['name']} has {delinquency_count} missed payment(s) "
                f"and {loyalty} loyalty ({tenure_years} year(s)) — "
                f"formal recovery stance required. Direct, consequence-aware tone selected; "
                f"resolution options framed as the customer's last opportunity before escalation."
            ),
            key_signals={
                "loyalty": loyalty,
                "delinquency_count": delinquency_count,
                "tenure_years": tenure_years,
                "hardship_flag": hardship,
            },
        )
    else:
        return PersonaTrace(
            assigned_persona="Balanced Advisor",
            trigger_rule="loyalty == 'medium' AND 1 < delinquency_count < 3",
            reasoning=(
                f"{customer['name']} has {tenure_years} year(s) of tenure with medium loyalty "
                f"and {delinquency_count} missed payment(s) — balanced approach selected. "
                f"Professional but empathetic tone acknowledges difficulty while maintaining urgency."
                + (" Hardship context will be acknowledged proactively." if hardship else "")
            ),
            key_signals={
                "loyalty": loyalty,
                "delinquency_count": delinquency_count,
                "tenure_years": tenure_years,
                "hardship_flag": hardship,
            },
        )


def build_escalation_trace(customer: dict, memo_text: str, chat_text: str) -> EscalationTrace:
    """Return a structured trace explaining the escalation recommendation."""
    triggers = []

    if customer["delinquency_count"] >= 3:
        triggers.append(f"Delinquency count is {customer['delinquency_count']} (threshold: ≥3 missed payments)")

    if customer.get("contact_attempts_today", 0) >= 2:
        triggers.append(f"Contact attempts today: {customer['contact_attempts_today']} (threshold: ≥2)")

    escalation_keywords = ["no response", "unresponsive", "refused", "disconnected", "escalat"]
    memo_lower = memo_text.lower()
    chat_lower = chat_text.lower()
    keyword_hits = [kw for kw in escalation_keywords if kw in memo_lower or kw in chat_lower]
    if keyword_hits:
        triggers.append(f"Escalation language detected in transcript: {', '.join(keyword_hits)}")

    recommended = bool(triggers)

    if recommended:
        reasoning = (
            f"Escalation flagged based on {len(triggers)} trigger(s): "
            + "; ".join(triggers)
            + ". Case should be reviewed by a human supervisor or transferred to an external collections agency."
        )
    else:
        reasoning = (
            f"No escalation triggers met — delinquency count is {customer['delinquency_count']} (<3), "
            f"contact attempts are within limit, and no unresponsive behaviour detected. "
            f"Standard follow-up process recommended."
        )

    return EscalationTrace(
        escalation_recommended=recommended,
        triggered_by=triggers,
        reasoning=reasoning,
    )


def _get_persona_for_customer(customer: dict) -> AgentPersona:
    """Determine the agent persona based on customer loyalty and LTV segment."""
    loyalty = customer.get("loyalty", "medium").lower()
    delinquency_count = customer.get("delinquency_count", 1)

    if loyalty == "high" and delinquency_count <= 1:
        return AgentPersona.supportive_partner
    elif loyalty == "low" or delinquency_count >= 3:
        return AgentPersona.formal_officer
    else:
        return AgentPersona.balanced_advisor


def _build_system_prompt(persona: AgentPersona, customer: dict) -> str:
    """Build a persona-specific system prompt, injecting the RAG policy context."""

    base_policy_block = f"""
--- BANK HARDSHIP & RECOVERY POLICY (RAG CONTEXT) ---
{BANK_HARDSHIP_POLICY}
--- END OF POLICY ---
"""

    if persona == AgentPersona.supportive_partner:
        persona_instructions = """
AGENT PERSONA: Supportive Partner

You are a warm, empathetic financial wellbeing advisor at Greenleaf Bank. Your primary goal is to
HELP the customer find a solution, not to collect. Approach this conversation as a partner who is
genuinely concerned about the customer's wellbeing.

TONE GUIDELINES:
- Warm, understanding, and non-judgmental
- Emphasize available options and flexibility (deferral, repayment plans)
- Acknowledge the customer's long relationship with the bank and loyalty
- Use language like "we can work through this together", "there are options available to you"
- Proactively reference the hardship deferral program as a first option
- NEVER use threatening or urgent language
- Express genuine concern for their situation
"""

    elif persona == AgentPersona.formal_officer:
        persona_instructions = """
AGENT PERSONA: Formal Officer

You are a professional debt recovery officer at Greenleaf Bank. Your tone is formal, firm, and
clear about the consequences of continued non-payment. While always professional and compliant,
you communicate urgency and the seriousness of the situation.

TONE GUIDELINES:
- Formal, direct, and matter-of-fact
- Clearly state the outstanding amount and number of missed payments
- Reference the consequences: credit bureau reporting, potential escalation to collections agency
- Still offer resolution options (repayment plan, settlement) but frame them as the customer's
  last opportunity to resolve this before escalation
- Use language like "it is imperative that you respond", "failure to act may result in..."
- Remain professional and never harass or threaten illegal action
- Always provide at least one actionable path to resolution
"""

    else:  # balanced_advisor
        persona_instructions = """
AGENT PERSONA: Balanced Advisor

You are a professional yet empathetic debt recovery advisor at Greenleaf Bank. Balance firmness
with understanding — acknowledge the customer's situation while making clear that resolution is
necessary.

TONE GUIDELINES:
- Professional but approachable
- Acknowledge the difficulty of financial hardship without being dismissive of the urgency
- Present options clearly (deferral, repayment plan) alongside consequences of inaction
- Use language like "we understand this may be a difficult time", "we need to work together to
  find a resolution"
"""

    return f"""{persona_instructions}

{base_policy_block}

CRITICAL COMPLIANCE RULES:
- NEVER threaten illegal action or use abusive language
- ALWAYS offer at least one resolution option from the bank's hardship policy
- ALWAYS include a specific policy reference (e.g., "3-month payment deferral program")
- Keep the message concise: 3–5 short paragraphs maximum
- End with a clear call to action (phone number, next step)
- The message should read as a professional written communication (email/letter format)
"""


def generate_outreach_message(customer: dict) -> tuple[str, AgentPersona, list[str]]:
    """
    Generate a personalized, policy-grounded outreach message for a customer.

    Returns:
        (message_text, persona_used, policy_references_cited)
    """
    persona = _get_persona_for_customer(customer)
    system_prompt = _build_system_prompt(persona, customer)

    user_prompt = f"""Generate a debt collection outreach message for the following customer.
The message will be delivered as a formal written communication.

CUSTOMER DETAILS:
- Name: {customer['name']}
- Outstanding Balance: ${customer['debt_amount']:,.2f} {customer['currency']}
- Loan Reference: {customer['loan_id']}
- Delinquency Status: {customer['delinquency_label']}
- Customer Since: {customer['tenure_years']} year(s)
- Hardship Flag: {'Yes – customer has self-reported financial difficulty' if customer['hardship_flag'] else 'No'}
- Additional Context: {customer.get('notes', 'N/A')}

INSTRUCTIONS:
1. Open with an appropriate greeting based on your persona
2. Clearly state the account status and outstanding amount
3. Reference at least ONE specific resolution option from the bank policy (e.g., "3-month payment deferral", "structured repayment plan")
4. Include a clear call to action with a next step
5. Close professionally

Output only the outreach message text. Do not add any preamble or meta-commentary."""

    response = _get_client().chat.completions.create(
        model=DEPLOYMENT,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    message_text = response.choices[0].message.content or ""

    # Extract policy references mentioned in the message
    policy_references = []
    policy_keywords = {
        "3-month payment deferral": "3-Month Payment Deferral Program",
        "payment deferral": "Payment Deferral Program",
        "repayment plan": "Structured Repayment Plan",
        "interest rate reduction": "Interest Rate Reduction Option",
        "debt settlement": "Debt Settlement Option",
        "credit counsell": "Credit Counselling Referral (NFCC)",
        "hardship": "Customer Hardship Declaration Program",
    }
    msg_lower = message_text.lower()
    for keyword, label in policy_keywords.items():
        if keyword in msg_lower and label not in policy_references:
            policy_references.append(label)

    return message_text, persona, policy_references


def generate_handover_memo(customer: dict, chat_history: list[dict]) -> tuple[str, bool]:
    """
    Summarize a chat history into a 2-sentence Transfer Memo for handover.

    Returns:
        (memo_text, escalation_recommended)
    """
    chat_text = "\n".join(
        f"[{msg['role'].upper()}]: {msg['content']}" for msg in chat_history
    )

    system_prompt = """You are a senior debt recovery supervisor at Greenleaf Bank.
Your task is to produce a concise Transfer Memo summarizing a debt collection interaction
for handover to an external collections agency or human supervisor.

The memo must be EXACTLY 2 sentences:
- Sentence 1: Factual summary of the interaction (who, what debt, what was discussed/offered, outcome)
- Sentence 2: Recommended next action and any critical context the next handler needs

Be precise, professional, and include the key financial figures. Do not add any preamble."""

    user_prompt = f"""CUSTOMER PROFILE:
- ID: {customer['id']}
- Name: {customer['name']}
- Outstanding Balance: ${customer['debt_amount']:,.2f} USD
- Loan: {customer['loan_id']}
- Delinquency: {customer['delinquency_label']}
- Loyalty: {customer['loyalty']} ({customer['tenure_years']} year(s))
- Hardship Flag: {'Yes' if customer['hardship_flag'] else 'No'}

INTERACTION TRANSCRIPT:
{chat_text}

Generate the 2-sentence Transfer Memo now."""

    response = _get_client().chat.completions.create(
        model=DEPLOYMENT,
        max_tokens=512,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    memo_text = response.choices[0].message.content or ""

    # Heuristic: recommend escalation if customer was unresponsive or repeated delinquent
    escalation_keywords = ["no response", "unresponsive", "refused", "disconnected", "escalat"]
    memo_lower = memo_text.lower()
    chat_lower = chat_text.lower()
    escalation_recommended = (
        customer["delinquency_count"] >= 3
        or customer["contact_attempts_today"] >= 2
        or any(kw in memo_lower or kw in chat_lower for kw in escalation_keywords)
    )

    return memo_text, escalation_recommended
