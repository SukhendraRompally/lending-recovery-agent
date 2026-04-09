import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  ActivitySquare,
  User,
  Bot,
  CalendarDays,
} from "lucide-react";
import { CustomerWithId, ExternalCustomerProfile } from "@/lib/externalApi";

interface CollectionsPanelProps {
  customers: CustomerWithId[];
  profile: ExternalCustomerProfile | null;
  selectedCustomerId: string | null;
  onSelectCustomer: (id: string) => void;
  isLoadingProfile: boolean;
}

export function CollectionsPanel({
  customers,
  profile,
  selectedCustomerId,
  onSelectCustomer,
  isLoadingProfile,
}: CollectionsPanelProps) {
  const getRiskColor = (score: number) => {
    if (score <= 40) return "text-emerald-400";
    if (score <= 70) return "text-amber-400";
    return "text-red-400";
  };

  const isCompliant = profile?.compliance_status === "allowed";

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="text-[10px] font-mono text-muted-foreground mb-2 flex items-center gap-2 uppercase tracking-wider">
          <ActivitySquare className="w-3.5 h-3.5 text-primary" />
          Target Selection
        </div>
        <Select value={selectedCustomerId || ""} onValueChange={onSelectCustomer}>
          <SelectTrigger
            className="w-full bg-background border-border font-mono text-sm rounded-sm"
            data-testid="select-customer"
          >
            <SelectValue placeholder="Select target..." />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id} data-testid={`customer-option-${c.id}`}>
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 opacity-50" />
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">[{c.id}]</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoadingProfile || !profile ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full bg-muted/40 rounded-sm" />
            <Skeleton className="h-24 w-full bg-muted/40 rounded-sm" />
            <Skeleton className="h-20 w-full bg-muted/40 rounded-sm" />
            <Skeleton className="h-20 w-full bg-muted/40 rounded-sm" />
            <Skeleton className="h-20 w-full bg-muted/40 rounded-sm" />
          </div>
        ) : (
          <>
            {/* Risk Score */}
            <Card className="rounded-sm border-border bg-card shadow-none">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  Risk Assessment
                  <ActivitySquare className="w-3.5 h-3.5 opacity-40" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex items-end gap-3">
                  <div className={`text-4xl font-mono font-light tracking-tighter ${getRiskColor(profile.risk_score)}`}>
                    {profile.risk_score.toString().padStart(2, "0")}
                  </div>
                  <div className="pb-1 flex-1 space-y-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500/80" style={{ width: "40%" }} />
                      <div className="h-full bg-amber-500/80" style={{ width: "30%" }} />
                      <div className="h-full bg-red-500/80" style={{ width: "30%" }} />
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase">
                      {profile.risk_level} risk
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Outstanding Balance */}
            {profile.debt_amount !== undefined && (
              <Card className="rounded-sm border-border bg-card shadow-none">
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    Outstanding Balance
                    <DollarSign className="w-3.5 h-3.5 opacity-40" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-mono tracking-tight text-foreground">
                    ${profile.debt_amount.toLocaleString()}
                  </div>
                  {profile.loan_id && (
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">
                      Loan ID: {profile.loan_id}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Customer Tenure */}
            {profile.tenure_years !== undefined && (
              <Card className="rounded-sm border-border bg-card shadow-none">
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    Customer Tenure
                    <CalendarDays className="w-3.5 h-3.5 opacity-40" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-2xl font-mono tracking-tight text-foreground">
                    {profile.tenure_years} yr{profile.tenure_years !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {profile.loyalty && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                        {profile.loyalty} loyalty
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Attempts */}
            {profile.contact_attempts_today !== undefined && (
              <Card className="rounded-sm border-border bg-card shadow-none">
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider">
                    Contact Attempts Today
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-mono">{profile.contact_attempts_today}</span>
                    <span className="text-sm font-mono text-muted-foreground pb-0.5">
                      / {profile.max_contact_attempts ?? 3} max
                    </span>
                  </div>
                  {profile.delinquency_label && (
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">
                      {profile.delinquency_label}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Assigned Persona */}
            <Card className="rounded-sm border-border bg-card shadow-none">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  Assigned Persona
                  <Bot className="w-3.5 h-3.5 opacity-40" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <Badge
                  variant="secondary"
                  className="rounded-sm font-mono text-xs uppercase bg-primary/10 text-primary border border-primary/20 py-1 px-2"
                >
                  {profile.agent_persona}
                </Badge>
              </CardContent>
            </Card>

            {/* Compliance Window — status and reason both from backend */}
            <Card
              className={`rounded-sm border shadow-none ${
                isCompliant
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-red-500/25 bg-red-500/5"
              }`}
            >
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  Comms Window
                  {isCompliant ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isCompliant ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    }`}
                  />
                  <span
                    className={`text-xs font-mono font-semibold uppercase ${
                      isCompliant ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isCompliant ? "APPROVED" : "BLOCKED"}
                  </span>
                </div>
                {profile.compliance_reason && (
                  <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    {profile.compliance_reason}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
