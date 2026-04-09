import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Loader2,
  Send,
  Terminal,
  Bot,
  Phone,
  User,
  Activity,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceCallPanel } from "@/components/dashboard/VoiceCallPanel";
import {
  CustomerWithId,
  ExternalCustomerProfile,
  OutreachResponse,
  fetchExternalCustomerProfile,
  generateExternalOutreach,
  getCurrentTime,
} from "@/lib/externalApi";

interface PlaybookVisualizerProps {
  customers: CustomerWithId[];
  initialCustomerId: string | null;
  onReasoningUpdate: (trace: string, label: string) => void;
}

export function PlaybookVisualizer({
  customers,
  initialCustomerId,
  onReasoningUpdate,
}: PlaybookVisualizerProps) {
  const [activeMode, setActiveMode] = useState<"written" | "voice">("written");

  // Own independent customer selection — not tied to left panel after mount
  const [selectedId, setSelectedId] = useState<string>(initialCustomerId ?? "");
  const [profile, setProfile] = useState<ExternalCustomerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [outreach, setOutreach] = useState<OutreachResponse | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  // Seed the selection once when the parent first resolves customers
  useEffect(() => {
    if (!selectedId && initialCustomerId) {
      setSelectedId(initialCustomerId);
    }
  }, [initialCustomerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch profile whenever playbook's own selected customer changes
  useEffect(() => {
    if (!selectedId) return;
    setProfile(null);
    setOutreach(null);
    setOutreachError(null);
    setIsBlocked(false);
    setLoadingProfile(true);
    fetchExternalCustomerProfile(selectedId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, [selectedId]);

  const handleCustomerChange = (id: string) => {
    setSelectedId(id);
  };

  const handleGenerate = async () => {
    if (!selectedId) return;
    setIsGenerating(true);
    setOutreach(null);
    setOutreachError(null);
    setIsBlocked(false);

    try {
      const result = await generateExternalOutreach(selectedId, getCurrentTime());
      if (result.compliance_status === "blocked") {
        setIsBlocked(true);
        setOutreachError("Contact blocked outside allowed hours (8:00 AM – 9:00 PM).");
      } else {
        setOutreach(result);
        if (result.reasoning_trace) {
          onReasoningUpdate(result.reasoning_trace, "Outreach Generation");
        }
      }
    } catch (e) {
      setOutreachError(e instanceof Error ? e.message : "Failed to generate outreach.");
    } finally {
      setIsGenerating(false);
    }
  };

  const messageText = outreach?.message ?? outreach?.outreach_message ?? null;

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* ── Header: title + mode tabs ── */}
      <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-mono font-semibold uppercase tracking-wider">
            Agent Playbook
          </h2>
        </div>

        <Tabs
          value={activeMode}
          onValueChange={(v) => setActiveMode(v as "written" | "voice")}
          className="w-auto"
        >
          <TabsList className="h-8 bg-background border border-border rounded-sm">
            <TabsTrigger
              value="written"
              className="text-xs font-mono rounded-sm px-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
              data-testid="tab-written-mode"
            >
              WRITTEN
            </TabsTrigger>
            <TabsTrigger
              value="voice"
              className="text-xs font-mono rounded-sm px-3 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
              data-testid="tab-voice-mode"
            >
              <Phone className="w-3 h-3 mr-1.5" />
              LIVE CALL
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Written Outreach ── */}
      {activeMode === "written" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Customer selector row — independent of left panel */}
          <div className="px-4 py-3 border-b border-border bg-card/30 space-y-3 shrink-0">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Target Selection — Written Outreach
            </div>

            <Select
              value={selectedId}
              onValueChange={handleCustomerChange}
              disabled={isGenerating}
            >
              <SelectTrigger
                className="w-full bg-background border-border font-mono text-sm rounded-sm"
                data-testid="select-playbook-customer"
              >
                <SelectValue placeholder="Select target..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    data-testid={`playbook-customer-${c.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 opacity-50" />
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        — ${c.debt_amount.toLocaleString()}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Profile strip */}
            {loadingProfile ? (
              <div className="flex gap-3">
                <Skeleton className="h-4 w-24 bg-muted/40 rounded-sm" />
                <Skeleton className="h-4 w-28 bg-muted/40 rounded-sm" />
                <Skeleton className="h-4 w-16 bg-muted/40 rounded-sm" />
              </div>
            ) : profile ? (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Risk:</span>
                  <span
                    className={`text-[10px] font-mono font-semibold ${
                      profile.risk_score <= 40
                        ? "text-emerald-400"
                        : profile.risk_score <= 70
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {profile.risk_score} ({profile.risk_level.toUpperCase()})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Persona:</span>
                  <span className="text-[10px] font-mono text-primary">{profile.agent_persona}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {profile.compliance_status === "allowed" ? (
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <ShieldX className="w-3 h-3 text-red-400" />
                  )}
                  <span
                    className={`text-[10px] font-mono font-semibold ${
                      profile.compliance_status === "allowed"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {profile.compliance_status.toUpperCase()}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Generate button + output */}
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="mb-4">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedId}
                className="w-full sm:w-auto font-mono text-sm tracking-wide rounded-sm"
                size="lg"
                data-testid="btn-generate-outreach"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    GENERATING PAYLOAD...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    GENERATE OUTREACH
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1 relative flex flex-col min-h-0">
              {isGenerating ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-muted-foreground font-mono text-sm">
                    <Terminal className="w-8 h-8 animate-pulse text-primary/50" />
                    COMPUTING OPTIMAL PATHWAY...
                  </div>
                </div>
              ) : isBlocked || outreachError ? (
                <div
                  className="bg-red-500/10 border border-red-500/30 rounded-sm p-6 text-red-400 font-mono"
                  data-testid="compliance-blocked-banner"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <AlertCircle className="w-5 h-5" />
                    <h3 className="text-base font-bold tracking-tight">
                      {isBlocked ? "COMPLIANCE BLOCKED" : "ERROR"}
                    </h3>
                  </div>
                  <p className="text-sm opacity-90">{outreachError}</p>
                </div>
              ) : !outreach ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-muted-foreground font-mono text-sm border border-dashed border-border/60 p-10 rounded-sm text-center">
                    <Bot className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    AWAITING GENERATION COMMAND
                  </div>
                </div>
              ) : messageText ? (
                <div
                  className="flex flex-col h-full bg-card border border-border rounded-sm overflow-hidden"
                  data-testid="generated-message"
                >
                  <div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between shrink-0">
                    <div className="text-[10px] font-mono text-muted-foreground">
                      DRAFT: OUTREACH MESSAGE
                    </div>
                    <div className="flex items-center gap-2">
                      {outreach.agent_persona && (
                        <span className="text-[10px] font-mono text-primary/70">
                          {String(outreach.agent_persona)}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[10px] rounded-sm bg-primary/10 text-primary border-primary/30"
                      >
                        READY
                      </Badge>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-6">
                    <div className="bg-background rounded-sm p-6 text-sm font-sans text-foreground whitespace-pre-wrap border border-border/60 leading-relaxed">
                      {messageText}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-sm p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap overflow-auto">
                  {JSON.stringify(outreach, null, 2)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Voice Call Mode (already has its own independent selector) ── */}
      {activeMode === "voice" && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <VoiceCallPanel onReasoningUpdate={onReasoningUpdate} />
        </div>
      )}
    </div>
  );
}
