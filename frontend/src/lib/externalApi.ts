const BACKEND_BASE = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

export interface ExternalCustomer {
  name: string;
  loan_id: string;
  debt_amount: number;
}

export type CustomerWithId = { id: string } & ExternalCustomer;

export interface PersonaTrace {
  assigned_persona?: string;
  trigger_rule?: string;
  reasoning?: string;
  key_signals?: Record<string, unknown>;
}

export interface ExternalCustomerProfile {
  name: string;
  loan_id?: string;
  debt_amount?: number;
  risk_score: number;
  risk_level: string;
  agent_persona: string;
  compliance_status: "allowed" | "blocked";
  compliance_reason?: string;
  tenure_years?: number;
  loyalty?: string;
  ltv_segment?: string;
  delinquency_count?: number;
  delinquency_label?: string;
  contact_attempts_today?: number;
  max_contact_attempts?: number;
  hardship_flag?: boolean;
  jurisdiction?: string;
  persona_trace?: PersonaTrace;
  reasoning_trace?: string;
}

export interface StartCallResponse {
  session_id: string | null;
  customer_name?: string;
  agent_persona?: string;
  compliance_status: "allowed" | "blocked";
  agent_text?: string;
  audio_base64?: string;
  audio_available: boolean;
  compliance_reason?: string;
  reasoning_trace?: string;
}

export interface CallTurnResponse {
  session_id: string;
  agent_text: string;
  audio_base64?: string;
  audio_available: boolean;
  turn_number: number;
  reasoning_trace?: string;
}

export interface EndCallResponse {
  session_id: string;
  customer_name: string;
  handover_memo: string;
  escalation_recommended: boolean;
  total_turns: number;
  duration_seconds: number;
  reasoning_trace?: string;
}

export interface OutreachResponse {
  message?: string;
  outreach_message?: string;
  agent_persona?: string;
  compliance_status?: string;
  reasoning_trace?: string;
  [key: string]: unknown;
}

export interface EscalateResponse {
  customer_id: string;
  customer_name: string;
  session_id: string;
  handover_memo: string;
  escalation_recommended: boolean;
  persona: string;
  total_turns: number;
  duration_seconds: number;
  ended_at: string;
}

export async function fetchExternalCustomers(): Promise<Record<string, ExternalCustomer>> {
  const res = await fetch(`${BACKEND_BASE}/customers`);
  if (!res.ok) throw new Error(`Failed to fetch customers: ${res.status}`);
  return res.json();
}

export async function fetchExternalCustomerProfile(customerId: string): Promise<ExternalCustomerProfile> {
  const res = await fetch(`${BACKEND_BASE}/customer/${customerId}`);
  if (!res.ok) throw new Error(`Failed to fetch customer: ${res.status}`);
  return res.json();
}

export async function startVoiceCall(customerId: string, currentTime: string): Promise<StartCallResponse> {
  const res = await fetch(`${BACKEND_BASE}/voice/call/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: customerId, current_time: currentTime }),
  });
  if (!res.ok) throw new Error(`Failed to start call: ${res.status}`);
  return res.json();
}

export async function sendCustomerReply(sessionId: string, customerMessage: string): Promise<CallTurnResponse> {
  const res = await fetch(`${BACKEND_BASE}/voice/call/${sessionId}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_message: customerMessage }),
  });
  if (!res.ok) throw new Error(`Failed to send reply: ${res.status}`);
  return res.json();
}

export async function endVoiceCall(sessionId: string): Promise<EndCallResponse> {
  const res = await fetch(`${BACKEND_BASE}/voice/call/${sessionId}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to end call: ${res.status}`);
  return res.json();
}

export async function generateExternalOutreach(customerId: string, currentTime: string): Promise<OutreachResponse> {
  const res = await fetch(`${BACKEND_BASE}/generate-outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: customerId, current_time: currentTime }),
  });
  if (!res.ok) throw new Error(`Failed to generate outreach: ${res.status}`);
  return res.json();
}

export async function escalateCustomer(customerId: string): Promise<EscalateResponse> {
  const res = await fetch(`${BACKEND_BASE}/customer/${customerId}/escalate`);
  if (res.status === 404) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.detail ?? "No completed call found for this customer."), { status: 404 });
  }
  if (!res.ok) throw new Error(`Escalation failed: ${res.status}`);
  return res.json();
}

// Backend treats current_time as UTC and applies the customer's utc_offset
// to derive their local time for FDCPA compliance window checks.
// Always send UTC — never local browser time.
export function getCurrentTime(): string {
  const now = new Date();
  const h = now.getUTCHours().toString().padStart(2, "0");
  const m = now.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function playAudioBase64(base64: string): HTMLAudioElement {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.play().catch(() => {});
  return audio;
}
