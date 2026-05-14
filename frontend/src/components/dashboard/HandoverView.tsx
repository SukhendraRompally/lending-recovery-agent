import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  PhoneForwarded,
  ShieldAlert,
  ArrowRight,
  Activity,
  Brain,
  Sparkles,
  Clock,
  Hash,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalCustomerProfile, EscalateResponse, escalateCustomer } from "@/lib/externalApi";

interface HandoverViewProps {
  customerId: string;
  profile: ExternalCustomerProfile | null;
  reasoningTrace: string | null;
  reasoningLabel: string;
}

export function HandoverView({ customerId, profile, reasoningTrace, reasoningLabel }: HandoverViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalationError, setEscalationError] = useState<string | null>(null);
  const [isNoCall, setIsNoCall] = useState(false);
  const [memo, setMemo] = useState<EscalateResponse | null>(null);

  const handleEscalate = async () => {
    setIsEscalating(true);
    setEscalationError(null);
    setIsNoCall(false);

    try {
      const result = await escalateCustomer(customerId);
      setMemo(result);
      setIsModalOpen(true);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 404) {
        setIsNoCall(true);
        setEscalationError(err.message);
      } else {
        setEscalationError(err.message ?? "Failed to retrieve transfer memo.");
      }
    } finally {
      setIsEscalating(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Reasoning Trace ── */}
      <div className="flex flex-col border-b border-border" style={{ minHeight: 0, flex: "1 1 0" }}>
        <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center gap-2 shrink-0">
          <Brain className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-primary">
            Reasoning Trace
          </h2>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {reasoningTrace ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-primary/70" />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    {reasoningLabel}
                  </span>
                </div>
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap bg-primary/5 border border-primary/15 rounded-sm p-4 font-mono text-xs">
                  {reasoningTrace}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <Brain className="w-8 h-8 text-muted-foreground/30" />
                <div className="text-xs font-mono text-muted-foreground/50 uppercase tracking-wider">
                  Awaiting AI action
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/30 max-w-[160px] leading-relaxed">
                  Select a customer, generate outreach, or start a call to see AI reasoning
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Escalation Protocol ── */}
      <div className="flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-mono font-semibold uppercase tracking-wider text-amber-400">
            Escalation Protocol
          </h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Session context */}
          <div className="bg-card border border-border rounded-sm p-4">
            <h3 className="text-[10px] font-mono font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
              <Activity className="w-3 h-3" />
              Session Context
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Current Persona</span>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] rounded-sm bg-secondary/50 max-w-[120px] truncate"
                >
                  {profile?.agent_persona ?? "—"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Compliance</span>
                <span className={`text-[10px] font-mono font-semibold ${
                  profile?.compliance_status === "allowed" ? "text-emerald-400" : "text-red-400"
                }`}>
                  {profile ? profile.compliance_status.toUpperCase() : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Error / 404 feedback */}
          {escalationError && (
            <div
              className={`rounded-sm p-3 font-mono text-xs border ${
                isNoCall
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
              data-testid="escalation-error"
            >
              {isNoCall ? (
                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{escalationError}</span>
                </div>
              ) : (
                escalationError
              )}
            </div>
          )}

          <Button
            variant="destructive"
            className="w-full h-11 text-xs font-mono tracking-wider font-bold rounded-sm bg-red-600 hover:bg-red-700 shadow-md shadow-red-900/20"
            onClick={handleEscalate}
            disabled={isEscalating || !profile}
            data-testid="btn-escalate"
          >
            {isEscalating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PhoneForwarded className="w-4 h-4 mr-2" />
            )}
            {isEscalating ? "RETRIEVING MEMO..." : "ESCALATE TO HUMAN"}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground font-mono uppercase">
            Retrieves transfer memo from last completed call
          </p>
        </div>
      </div>

      {/* Transfer Memo Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-2xl bg-card border border-border shadow-2xl p-0 overflow-hidden"
          data-testid="transfer-memo-modal"
        >
          <div className="bg-amber-500/10 border-b border-border p-4 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <div>
              <DialogTitle className="text-lg font-mono font-bold tracking-tight text-amber-400">
                TRANSFER MEMO
              </DialogTitle>
              <DialogDescription className="text-xs font-mono opacity-70">
                Authorized Handover Document — Smart Collections Engine
              </DialogDescription>
            </div>
          </div>

          {memo && (
            <ScrollArea className="max-h-[70vh]">
              <div className="p-6 space-y-5">
                {/* Identity row */}
                <div className="flex items-start justify-between pb-4 border-b border-border/50">
                  <div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1 flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Customer
                    </div>
                    <div className="text-xl font-bold tracking-tight">{memo.customer_name}</div>
                    <div className="text-xs font-mono text-muted-foreground mt-1">ID: {memo.customer_id}</div>
                  </div>
                  <div className="text-right">
                    <Badge
                      className={`rounded-sm font-mono text-xs uppercase px-3 py-1 border-0 ${
                        memo.escalation_recommended
                          ? "bg-red-500 text-white"
                          : "bg-emerald-500 text-white"
                      }`}
                    >
                      {memo.escalation_recommended ? "ESCALATION RECOMMENDED" : "LOW PRIORITY"}
                    </Badge>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mt-2">
                      {new Date(memo.ended_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Call stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-background p-3 rounded-sm border border-border">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Turns
                    </div>
                    <div className="text-xl font-mono">{memo.total_turns}</div>
                  </div>
                  <div className="bg-background p-3 rounded-sm border border-border">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Duration
                    </div>
                    <div className="text-xl font-mono">{formatDuration(memo.duration_seconds)}</div>
                  </div>
                  <div className="bg-background p-3 rounded-sm border border-border">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Persona</div>
                    <div className="text-sm font-mono text-primary truncate">{memo.persona}</div>
                  </div>
                </div>

                {/* Memo body */}
                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold text-muted-foreground uppercase flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> Handover Memo
                  </div>
                  <p className="text-sm bg-background border border-border p-4 rounded-sm leading-relaxed whitespace-pre-wrap">
                    {memo.handover_memo}
                  </p>
                </div>

                {/* Recommended action */}
                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold text-muted-foreground uppercase">
                    Recommended Next Action
                  </div>
                  <div className="bg-primary/10 border border-primary/30 p-4 rounded-sm flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-primary">
                      Route to Tier 2 human agent for review and direct customer contact.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
