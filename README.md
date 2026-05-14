# Lending Recovery Agent — AI-Powered Debt Collection Platform

> **A prototype demonstrating how Agentic AI can automate debt collections while guaranteeing 100% regulatory compliance and genuine customer empathy.**

---

## What Did We Build?

Imagine a bank's debt collection department — typically staffed by human agents making hundreds of calls a day, following strict legal rules about *when* they can call, *how many times* they can reach out, and *what they can say*. One mistake means a lawsuit. One missed call means lost revenue.

We built an **AI agent** that handles this entire process automatically. It reads a customer's profile, decides how to speak to them (tough but fair? warm and supportive?), generates a personalised message or conducts a live voice call — all while never breaking a single compliance rule.

This is not a chatbot. This is a full **Agentic AI system**: it reasons, it adapts, it enforces rules, and it hands off cleanly to a human when needed.

---

## The Problem It Solves

| Today (Manual) | With This Agent |
|---|---|
| Agent reads customer file, decides tone | AI reads profile and auto-selects the right persona |
| Supervisor checks if call time is legal | Compliance engine blocks calls automatically, globally |
| Agent writes notes after the call | AI generates a 2-sentence handover memo instantly |
| One agent, one call at a time | Scales to thousands of simultaneous customers |
| Human forgets policy options | AI always references the exact right policy |

---

## How It Works — The Three Engines

### 1. The Compliance Guardrail (Non-Negotiable Rules)
Before any message is sent or any call is made, the system runs a hard check:

- **Time window**: Is it between 8 AM and 9 PM in *the customer's local timezone*? (US, UK, India, Dubai, Japan, Australia — each customer has their own clock)
- **Daily limit**: Has this customer already been contacted 3 times today?

If either check fails, the system returns `"COMPLIANCE BLOCKED"` and the AI never runs. No exceptions. This mirrors real-world **FDCPA (Fair Debt Collection Practices Act)** and **Regulation F** requirements.

### 2. The Empathy Orchestrator (Personalised Tone)
Not every customer should be spoken to the same way. The system reads each customer's profile and assigns one of three AI personas:

| Persona | Triggered When | Tone |
|---|---|---|
| **Supportive Partner** | Loyal customer (5+ years), first time ever missing a payment | Warm, solution-focused, "we're here to help" |
| **Formal Officer** | New customer or repeated missed payments (3rd+) | Direct, firm, references consequences |
| **Balanced Advisor** | Mid-tier customer, second missed payment | Professional, empathetic but clear about urgency |

The AI then generates a message or conducts a voice call *in character* — every word matches the assigned persona.

### 3. The Synthesis Layer (Zero Context Loss)
When a call ends, the AI automatically writes a **2-sentence Transfer Memo** summarising:
- Who was called, what was owed, what was offered
- What the recommended next step is for a human supervisor or external agency

This memo travels with the case if it needs to be escalated — no information is ever lost between agents.

---

## The Voice Call Demo

This is where it gets impressive for a live demonstration:

1. **Click "Initiate Call"** — the AI greets the customer in their assigned persona voice
2. **Speak as the customer** — the browser's microphone captures your reply and converts it to text
3. **The AI responds** — it maintains the full conversation history, stays in character, references bank policy naturally ("we do have a 3-month deferral option available to you...")
4. **Click "End Call"** — the system instantly produces the Transfer Memo

Three distinct AI voices are used — one warm and calm for the Supportive Partner, one authoritative for the Formal Officer, and one professional for the Balanced Advisor.

---

## The 10 Test Customers

We created 10 fictional customers spanning 7 countries and timezones, so the demo works at *any time of day* without hitting a compliance block:

| Customer | Country | Debt | Situation | AI Persona |
|---|---|---|---|---|
| Margaret Thompson | USA 🇺🇸 | $500 | 10-yr customer, recently widowed, 1st missed payment | Supportive Partner |
| Oliver Bennett | UK 🇬🇧 | £750 | 7-yr customer, new job, 1st missed payment | Supportive Partner |
| Carlos Reyes | USA 🇺🇸 | $320 | 12-yr customer (longest), small balance, 1st miss | Supportive Partner |
| Sophie Chen | Australia 🇦🇺 | AUD 450 | 8-yr customer, starting parental leave | Supportive Partner |
| Jordan Rivera | USA 🇺🇸 | $2,000 | 6-month customer, 3rd missed payment, unresponsive | Formal Officer |
| Aisha Al-Rashidi | UAE 🇦🇪 | $4,500 | 1-yr customer, 3rd miss, previously dismissive | Formal Officer |
| Hiroshi Tanaka | Japan 🇯🇵 | $7,500 | Highest risk — 4th missed payment, near escalation | Formal Officer |
| Priya Nair | India 🇮🇳 | $1,200 | 3-yr customer, medical hardship, 2nd miss | Balanced Advisor |
| Lena Müller | Germany 🇩🇪 | €2,800 | 4-yr customer, carer for elderly parent, 2nd miss | Balanced Advisor |
| Zanele Dlamini | South Africa 🇿🇦 | $1,600 | 2-yr customer, promised to call back but didn't | Balanced Advisor |

---

## Tech Stack

```
Frontend  →  React + Vite + Tailwind (Vercel)
Backend   →  Python + FastAPI (Railway)
AI Model  →  GPT-4.1 via Azure OpenAI
Voice     →  Text-to-Speech API
```

### Backend API Endpoints

| Endpoint | What It Does |
|---|---|
| `GET /customers` | Returns all 10 test customers |
| `GET /customer/{id}` | Full profile — risk score, persona, current compliance status |
| `POST /generate-outreach` | Generates a written debt collection message |
| `POST /voice/call/start` | Starts a live voice call session, returns opening audio |
| `POST /voice/call/{id}/respond` | Sends customer reply, returns agent response + audio |
| `POST /voice/call/{id}/end` | Ends call, returns Transfer Memo |
| `POST /summarize` | Summarises any chat history into a 2-sentence memo |

---

## Running It Locally

### Prerequisites
- Python 3.11+
- An Azure OpenAI deployment (GPT-4.1 or equivalent)
- A text-to-speech API key (for voice — optional, text still works without it)

### Setup
```bash
git clone https://github.com/SukhendraRompally/lending-recovery-agent.git
cd lending-recovery-agent

pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your keys
```

### Environment Variables
```
AZURE_OPENAI_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_OPENAI_API_VERSION=2025-01-01-preview
ELEVENLABS_API_KEY=...          # optional — voice works without it
```

### Start the Backend
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Open `http://localhost:8000/docs` to explore all endpoints interactively.

### Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

Set `VITE_BACKEND_URL=http://localhost:8000` in `frontend/.env.local` when running locally.

---

## Deployment

| Layer | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploys on push to `main` |
| Backend | Railway | Set env vars in Railway dashboard |

**Vercel** — set `VITE_BACKEND_URL` to your Railway backend URL in Vercel → Settings → Environment Variables, then redeploy.

**Railway** — connect this repo, Railway detects the `Procfile` and starts `uvicorn main:app` automatically.

---

## Project Structure

```
lending-recovery-agent/
│
├── main.py              # FastAPI app — all API routes
├── database.py          # 10 mock customers + Bank Hardship Policy (RAG)
├── compliance.py        # Timezone-aware FDCPA compliance engine
├── llm.py               # Azure OpenAI — written outreach + memo generation
├── voice_llm.py         # Azure OpenAI (voice mode) + TTS integration
├── voice_sessions.py    # In-memory call session manager
├── models.py            # Request/response data models
├── requirements.txt     # Python dependencies
├── Procfile             # Railway start command
└── .env.example         # Environment variable template
```

---

## Key Design Principles

**Compliance is deterministic, not AI.** The time/frequency checks are pure code — the AI cannot override them. This is intentional: legal guardrails must never be delegated to a model.

**The AI only runs if it's legally safe to do so.** The compliance check happens *before* any LLM call is made. Blocked = no API call, no cost, no risk.

**Context is never lost.** Every call session maintains full conversation history. The Transfer Memo is generated from the complete transcript, not a summary of a summary.

**Tone is data-driven.** Persona assignment is based on two fields: `loyalty` and `delinquency_count`. Change the data, change the tone — no prompt editing required.

---

*Built as a 0-to-1 prototype demonstrating Agentic AI for financial services.*
