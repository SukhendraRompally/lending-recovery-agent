import { useState, useEffect, useRef, useCallback } from "react";
import {
  ExternalCustomer,
  ExternalCustomerProfile,
  StartCallResponse,
  EndCallResponse,
  fetchExternalCustomers,
  fetchExternalCustomerProfile,
  startVoiceCall,
  sendCustomerReply,
  endVoiceCall,
  getCurrentTime,
  playAudioBase64,
} from "@/lib/externalApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  Volume2,
  User,
  Activity,
  ShieldCheck,
  ShieldX,
  FileText,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

type CallState = "idle" | "connecting" | "active" | "agent_speaking" | "listening" | "processing" | "ending" | "ended";

interface ChatMessage {
  role: "agent" | "customer";
  text: string;
  turnNumber?: number;
}

interface VoiceCallPanelProps {
  onReasoningUpdate?: (trace: string, label: string) => void;
}

export function VoiceCallPanel({ onReasoningUpdate }: VoiceCallPanelProps) {
  const [customers, setCustomers] = useState<Record<string, ExternalCustomer>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [profile, setProfile] = useState<ExternalCustomerProfile | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);

  const [callState, setCallState] = useState<CallState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [complianceBlocked, setComplianceBlocked] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [callMemo, setCallMemo] = useState<EndCallResponse | null>(null);
  const [isMemoOpen, setIsMemoOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Fetch customers on mount
  useEffect(() => {
    fetchExternalCustomers()
      .then((data) => {
        setCustomers(data);
        const firstKey = Object.keys(data)[0];
        if (firstKey) setSelectedId(firstKey);
      })
      .catch((e) => setCustomersError(e.message))
      .finally(() => setLoadingCustomers(false));
  }, []);

  // Fetch profile when selected customer changes
  useEffect(() => {
    if (!selectedId) return;
    setProfile(null);
    setLoadingProfile(true);
    fetchExternalCustomerProfile(selectedId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [selectedId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  }, []);

  const playAndThen = useCallback((base64: string, onEnd: () => void) => {
    stopAudio();
    setCallState("agent_speaking");
    const audio = playAudioBase64(base64);
    currentAudioRef.current = audio;
    audio.onended = () => {
      currentAudioRef.current = null;
      onEnd();
    };
    audio.onerror = () => {
      currentAudioRef.current = null;
      onEnd();
    };
  }, [stopAudio]);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setCallError("Speech recognition not supported in this browser. Please use Chrome.");
      setCallState("active");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setCallState("listening");
      setTranscript("");
      setInterimTranscript("");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) setTranscript((prev) => prev + final);
      setInterimTranscript(interim);
    };

    recognition.onend = () => {
      setInterimTranscript("");
      setCallState("active");
    };

    recognition.onerror = () => {
      setInterimTranscript("");
      setCallState("active");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setCallState("active");
  }, []);

  const handleStartCall = useCallback(async () => {
    if (!selectedId) return;
    setCallState("connecting");
    setCallError(null);
    setComplianceBlocked(null);
    setChatLog([]);
    setTranscript("");
    setSessionId(null);

    try {
      const result: StartCallResponse = await startVoiceCall(selectedId, getCurrentTime());

      if (result.compliance_status === "blocked" || !result.session_id) {
        setComplianceBlocked(result.compliance_reason || "Contact blocked outside allowed hours (8:00 AM – 9:00 PM).");
        setCallState("idle");
        return;
      }

      setSessionId(result.session_id);

      if (result.reasoning_trace) {
        onReasoningUpdate?.(result.reasoning_trace, "Voice Call — Opening Strategy");
      }

      if (result.agent_text) {
        setChatLog([{ role: "agent", text: result.agent_text, turnNumber: 1 }]);
      }

      if (result.audio_available && result.audio_base64) {
        playAndThen(result.audio_base64, () => setCallState("active"));
      } else {
        setCallState("active");
      }
    } catch (e) {
      setCallError(`Failed to connect: ${e instanceof Error ? e.message : "Unknown error"}`);
      setCallState("idle");
    }
  }, [selectedId, playAndThen]);

  const handleSendReply = useCallback(async () => {
    if (!sessionId || !transcript.trim()) return;
    const userText = transcript.trim();
    setTranscript("");
    setCallState("processing");
    setChatLog((prev) => [...prev, { role: "customer", text: userText }]);

    try {
      const turn = await sendCustomerReply(sessionId, userText);
      if (turn.agent_text) {
        setChatLog((prev) => [...prev, { role: "agent", text: turn.agent_text, turnNumber: turn.turn_number }]);
      }
      if (turn.audio_available && turn.audio_base64) {
        playAndThen(turn.audio_base64, () => setCallState("active"));
      } else {
        setCallState("active");
      }
    } catch (e) {
      setCallError(`Turn failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      setCallState("active");
    }
  }, [sessionId, transcript, playAndThen]);

  const handleEndCall = useCallback(async () => {
    if (!sessionId) return;
    stopAudio();
    stopListening();
    setCallState("ending");

    try {
      const memo = await endVoiceCall(sessionId);
      setCallMemo(memo);
      if (memo.reasoning_trace) {
        onReasoningUpdate?.(memo.reasoning_trace, "Voice Call — Post-Call Analysis");
      }
      setCallState("ended");
      setIsMemoOpen(true);
    } catch (e) {
      setCallError(`Failed to end call: ${e instanceof Error ? e.message : "Unknown error"}`);
      setCallState("idle");
      setSessionId(null);
    }
  }, [sessionId, stopAudio, stopListening]);

  const handleResetCall = useCallback(() => {
    setCallState("idle");
    setSessionId(null);
    setChatLog([]);
    setTranscript("");
    setComplianceBlocked(null);
    setCallError(null);
    setCallMemo(null);
  }, []);

  const isInCall = callState !== "idle" && callState !== "ended";
  const customerList = Object.entries(customers);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Customer Selector */}
      <div className="p-4 border-b border-border bg-card/30 space-y-3 shrink-0">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Target Selection — Live Voice
        </div>
        {loadingCustomers ? (
          <div className="h-9 bg-muted/40 rounded-sm animate-pulse" />
        ) : customersError ? (
          <div className="text-xs text-red-500 font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {customersError}
          </div>
        ) : (
          <Select value={selectedId} onValueChange={setSelectedId} disabled={isInCall}>
            <SelectTrigger className="w-full bg-background border-border font-mono text-sm rounded-sm" data-testid="select-voice-customer">
              <SelectValue placeholder="Select customer..." />
            </SelectTrigger>
            <SelectContent>
              {customerList.map(([id, c]) => (
                <SelectItem key={id} value={id} data-testid={`voice-customer-${id}`}>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 opacity-50" />
                    <span>{c.name}</span>
                    <span className="text-xs text-muted-foreground">— ${c.debt_amount.toLocaleString()}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Customer Profile Strip */}
        {selectedId && !loadingProfile && profile && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Risk:</span>
              <span className={`text-[10px] font-mono font-semibold ${
                profile.risk_score <= 40 ? "text-emerald-500" : profile.risk_score <= 70 ? "text-amber-500" : "text-red-500"
              }`}>{profile.risk_score} ({profile.risk_level.toUpperCase()})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Persona:</span>
              <span className="text-[10px] font-mono text-primary">{profile.agent_persona}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {profile.compliance_status === "allowed" ? (
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
              ) : (
                <ShieldX className="w-3 h-3 text-red-500" />
              )}
              <span className={`text-[10px] font-mono font-semibold ${
                profile.compliance_status === "allowed" ? "text-emerald-500" : "text-red-500"
              }`}>{profile.compliance_status.toUpperCase()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Compliance Blocked Banner */}
      {complianceBlocked && (
        <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/30 rounded-sm p-4 text-red-500 font-mono text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-1">COMPLIANCE BLOCKED</div>
            <div className="text-xs opacity-80">{complianceBlocked}</div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {callError && (
        <div className="mx-4 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-sm p-3 text-amber-500 font-mono text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {callError}
        </div>
      )}

      {/* Call Status Banner */}
      {isInCall && (
        <div className="mx-4 mt-4 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-sm px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-emerald-500 font-semibold uppercase">
              {callState === "connecting" ? "Connecting..." :
               callState === "agent_speaking" ? "Agent Speaking..." :
               callState === "listening" ? "Listening — Speak Now" :
               callState === "processing" ? "Processing Response..." :
               callState === "ending" ? "Ending Call..." :
               "Call Active"}
            </span>
          </div>
          {customers[selectedId] && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {customers[selectedId].name}
            </span>
          )}
        </div>
      )}

      {/* Chat Log */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-4 pb-2">
        {callState === "idle" && chatLog.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground font-mono text-xs border border-dashed border-border rounded-sm p-8">
              <Phone className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <div className="uppercase tracking-wider">Select a customer and initiate call</div>
              <div className="mt-2 opacity-60">Powered by ElevenLabs voice synthesis</div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2">
              {chatLog.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-sm p-3 text-sm ${
                    msg.role === "agent"
                      ? "bg-card border border-border text-foreground"
                      : "bg-primary/20 border border-primary/30 text-primary"
                  }`}>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">
                      {msg.role === "agent" ? "AI Agent" : "Customer"}
                      {msg.turnNumber && ` — Turn ${msg.turnNumber}`}
                    </div>
                    <div className="leading-relaxed">{msg.text}</div>
                  </div>
                </div>
              ))}

              {/* Live transcript preview */}
              {(transcript || interimTranscript) && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-sm p-3 text-sm bg-primary/10 border border-primary/20 border-dashed">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">
                      Customer (transcribing...)
                    </div>
                    <div className="text-primary/80">
                      {transcript}
                      <span className="opacity-50 italic">{interimTranscript}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Agent thinking indicator */}
              {callState === "processing" && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-sm p-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span className="text-xs font-mono text-muted-foreground">Agent composing response...</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 pt-2 border-t border-border bg-card/20 shrink-0 space-y-3">
        {/* Transcript input row */}
        {isInCall && callState !== "connecting" && callState !== "ending" && (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-h-[38px] bg-background border border-border rounded-sm px-3 py-2 text-sm font-mono text-muted-foreground flex items-center">
              {callState === "listening" ? (
                <span className="text-primary animate-pulse">
                  {transcript || interimTranscript || "Listening..."}
                </span>
              ) : transcript ? (
                <span className="text-foreground">{transcript}</span>
              ) : (
                <span className="opacity-40 text-xs uppercase">Use mic to speak or type reply</span>
              )}
            </div>
            <Button
              size="icon"
              variant="outline"
              className={`shrink-0 rounded-sm border h-10 w-10 ${
                callState === "listening"
                  ? "border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={callState === "listening" ? stopListening : startListening}
              disabled={callState === "agent_speaking" || callState === "processing"}
              data-testid="btn-mic-toggle"
            >
              {callState === "listening" ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
            <Button
              size="sm"
              className="shrink-0 rounded-sm font-mono text-xs h-10 px-4"
              onClick={handleSendReply}
              disabled={!transcript.trim() || callState !== "active"}
              data-testid="btn-send-reply"
            >
              SEND
            </Button>
          </div>
        )}

        {/* Agent speaking indicator */}
        {callState === "agent_speaking" && (
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Volume2 className="w-4 h-4 text-primary animate-pulse" />
            <span>Agent audio playing...</span>
            <button
              className="ml-auto text-muted-foreground/50 hover:text-muted-foreground text-[10px] underline"
              onClick={() => { stopAudio(); setCallState("active"); }}
            >
              skip
            </button>
          </div>
        )}

        {/* Primary action buttons */}
        <div className="flex gap-2">
          {callState === "idle" || callState === "ended" ? (
            <Button
              className="flex-1 h-12 rounded-sm font-mono text-sm tracking-wider font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              onClick={callState === "ended" ? handleResetCall : handleStartCall}
              disabled={!selectedId || loadingCustomers}
              data-testid="btn-initiate-call"
            >
              {callState === "ended" ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  NEW CALL
                </>
              ) : (
                <>
                  <Phone className="w-5 h-5 mr-2" />
                  INITIATE CALL
                </>
              )}
            </Button>
          ) : (
            <>
              {callState === "connecting" && (
                <div className="flex-1 h-12 rounded-sm bg-emerald-600/30 border border-emerald-600/30 flex items-center justify-center gap-2 font-mono text-sm text-emerald-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  CONNECTING...
                </div>
              )}
              {callState !== "connecting" && callState !== "ending" && (
                <Button
                  variant="destructive"
                  className="flex-1 h-12 rounded-sm font-mono text-sm tracking-wider font-semibold bg-red-600 hover:bg-red-700 border-0"
                  onClick={handleEndCall}
                  disabled={callState === "ending"}
                  data-testid="btn-end-call"
                >
                  <PhoneOff className="w-5 h-5 mr-2" />
                  END CALL
                </Button>
              )}
              {callState === "ending" && (
                <div className="flex-1 h-12 rounded-sm bg-red-600/30 border border-red-600/30 flex items-center justify-center gap-2 font-mono text-sm text-red-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  ENDING CALL...
                </div>
              )}
            </>
          )}

          {callState === "ended" && callMemo && (
            <Button
              variant="outline"
              className="h-12 rounded-sm font-mono text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
              onClick={() => setIsMemoOpen(true)}
              data-testid="btn-view-memo"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              MEMO
            </Button>
          )}
        </div>
      </div>

      {/* Call Summary Modal */}
      <Dialog open={isMemoOpen} onOpenChange={setIsMemoOpen}>
        <DialogContent className="max-w-2xl bg-card border border-border shadow-2xl p-0 overflow-hidden" data-testid="call-memo-modal">
          <div className="bg-emerald-500/10 border-b border-border p-4 flex items-center gap-3">
            <Phone className="w-6 h-6 text-emerald-500" />
            <div>
              <DialogTitle className="text-lg font-mono font-bold tracking-tight text-emerald-500">
                CALL SUMMARY MEMO
              </DialogTitle>
              <div className="text-xs font-mono opacity-70 text-muted-foreground">
                ElevenLabs Voice Agent — Post-Call Analysis
              </div>
            </div>
          </div>

          {callMemo && (
            <ScrollArea className="max-h-[70vh]">
              <div className="p-6 space-y-5">
                {/* Header stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-background border border-border rounded-sm p-3 text-center">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Customer</div>
                    <div className="text-sm font-semibold">{callMemo.customer_name}</div>
                  </div>
                  <div className="bg-background border border-border rounded-sm p-3 text-center">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Turns</div>
                    <div className="text-sm font-mono font-semibold">{callMemo.total_turns}</div>
                  </div>
                  <div className="bg-background border border-border rounded-sm p-3 text-center">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Duration</div>
                    <div className="text-sm font-mono font-semibold">
                      {Math.floor(callMemo.duration_seconds / 60)}m {callMemo.duration_seconds % 60}s
                    </div>
                  </div>
                </div>

                {/* Escalation flag */}
                <div className={`flex items-center gap-3 p-3 rounded-sm border ${
                  callMemo.escalation_recommended
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-emerald-500/10 border-emerald-500/30"
                }`}>
                  {callMemo.escalation_recommended ? (
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  )}
                  <div>
                    <div className={`text-xs font-mono font-bold uppercase ${callMemo.escalation_recommended ? "text-red-500" : "text-emerald-500"}`}>
                      {callMemo.escalation_recommended ? "Escalation Recommended" : "No Escalation Required"}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {callMemo.escalation_recommended
                        ? "Human agent review required — see handover memo below"
                        : "AI agent handled call within normal parameters"}
                    </div>
                  </div>
                </div>

                {/* Handover Memo */}
                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold text-muted-foreground uppercase flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    AI-Generated Handover Memo
                  </div>
                  <div className="bg-background border border-border rounded-sm p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {callMemo.handover_memo}
                  </div>
                </div>

                {/* Chat replay */}
                {chatLog.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-semibold text-muted-foreground uppercase flex items-center gap-2">
                      <ArrowRight className="w-3.5 h-3.5" />
                      Call Transcript ({chatLog.length} turns)
                    </div>
                    <div className="bg-background border border-border rounded-sm p-4 space-y-3 max-h-48 overflow-y-auto">
                      {chatLog.map((msg, idx) => (
                        <div key={idx} className="text-xs">
                          <span className={`font-mono font-semibold uppercase mr-2 ${
                            msg.role === "agent" ? "text-primary" : "text-amber-500"
                          }`}>
                            {msg.role === "agent" ? "Agent:" : "Customer:"}
                          </span>
                          <span className="text-muted-foreground">{msg.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
