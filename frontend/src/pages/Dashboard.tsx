import { useState, useEffect, useCallback } from "react";
import { CollectionsPanel } from "@/components/dashboard/CollectionsPanel";
import { PlaybookVisualizer } from "@/components/dashboard/PlaybookVisualizer";
import { HandoverView } from "@/components/dashboard/HandoverView";
import { Activity, ShieldCheck } from "lucide-react";
import {
  CustomerWithId,
  ExternalCustomerProfile,
  fetchExternalCustomers,
  fetchExternalCustomerProfile,
} from "@/lib/externalApi";

export default function Dashboard() {
  const [customers, setCustomers] = useState<CustomerWithId[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ExternalCustomerProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Reasoning trace — updated by any AI action across the app
  const [reasoningTrace, setReasoningTrace] = useState<string | null>(null);
  const [reasoningLabel, setReasoningLabel] = useState<string>("Customer Profile");

  const updateReasoning = useCallback((trace: string, label: string) => {
    setReasoningTrace(trace);
    setReasoningLabel(label);
  }, []);

  // Load customers from external backend once
  useEffect(() => {
    fetchExternalCustomers()
      .then((data) => {
        const list: CustomerWithId[] = Object.entries(data).map(([id, c]) => ({ id, ...c }));
        setCustomers(list);
        if (list.length > 0) setSelectedCustomerId(list[0].id);
      })
      .catch(() => {})
      .finally(() => setIsLoadingCustomers(false));
  }, []);

  // Reload profile whenever selected customer changes
  const loadProfile = useCallback((id: string) => {
    setProfile(null);
    setIsLoadingProfile(true);
    setReasoningTrace(null);
    fetchExternalCustomerProfile(id)
      .then((p) => {
        setProfile(p);
        // reasoning lives in persona_trace.reasoning from GET /customer/{id}
        const trace = p.persona_trace?.reasoning ?? p.reasoning_trace;
        if (trace) {
          setReasoningTrace(trace);
          setReasoningLabel("Persona Assignment — Why This Approach");
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingProfile(false));
  }, []);

  useEffect(() => {
    if (selectedCustomerId) loadProfile(selectedCustomerId);
  }, [selectedCustomerId, loadProfile]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground font-sans overflow-hidden">
      {/* Header — Interface AI brand */}
      <header className="flex-none h-14 border-b border-border bg-card/80 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-sm bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide uppercase text-foreground">
              Interface AI
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest">
              Smart Collections Engine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/20">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-primary font-semibold">System Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-card border border-border text-muted-foreground">
            {new Date().toISOString().split("T")[0]}{" "}
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 overflow-hidden">
        {isLoadingCustomers ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Activity className="w-8 h-8 text-primary animate-pulse" />
              <div className="text-sm font-mono text-muted-foreground">INITIALIZING TERMINAL...</div>
            </div>
          </div>
        ) : (
          <div className="h-full grid grid-cols-1 md:grid-cols-12 gap-px bg-border">
            {/* Left: Collections Manager */}
            <div className="md:col-span-3 bg-background flex flex-col overflow-y-auto">
              <CollectionsPanel
                customers={customers}
                profile={profile}
                selectedCustomerId={selectedCustomerId}
                onSelectCustomer={setSelectedCustomerId}
                isLoadingProfile={isLoadingProfile}
              />
            </div>

            {/* Center: Playbook Visualizer — has its own independent customer selector */}
            <div className="md:col-span-6 bg-background flex flex-col overflow-hidden">
              <PlaybookVisualizer
                customers={customers}
                initialCustomerId={selectedCustomerId}
                onReasoningUpdate={updateReasoning}
              />
            </div>

            {/* Right: Reasoning Trace + Escalation */}
            <div className="md:col-span-3 bg-background flex flex-col overflow-y-auto">
              {selectedCustomerId ? (
                <HandoverView
                  customerId={selectedCustomerId}
                  profile={profile}
                  reasoningTrace={reasoningTrace}
                  reasoningLabel={reasoningLabel}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono text-sm">
                  STANDBY
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
