import { cn } from "@/lib/utils";
import { TransactionBadge } from "./TransactionBadge";
import { CheckCircle2, Clock, Loader2, Circle } from "lucide-react";

export type AgentStatus = "idle" | "waiting" | "working" | "paid" | "done" | "error";

export interface AgentCardProps {
  name: string;
  role: string;
  emoji: string;
  status: AgentStatus;
  amount?: string;
  txHash?: string;
  result?: string;
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; icon: React.ReactNode; className: string }> = {
  idle:    { label: "Waiting",  icon: <Circle className="w-3 h-3" />,                              className: "text-muted-foreground/40 border-border" },
  waiting: { label: "Queued",   icon: <Clock className="w-3 h-3" />,                               className: "text-muted-foreground border-border" },
  working: { label: "Working",  icon: <Loader2 className="w-3 h-3 animate-spin" />,                className: "text-warning border-warning/30 bg-warning/5" },
  paid:    { label: "Paid",     icon: <Loader2 className="w-3 h-3 animate-spin" />,                className: "text-primary border-primary/30 bg-primary/5" },
  done:    { label: "Done",     icon: <CheckCircle2 className="w-3 h-3" />,                        className: "text-success border-success/30 bg-success/5" },
  error:   { label: "Error",    icon: <Circle className="w-3 h-3 fill-destructive text-destructive" />, className: "text-destructive border-destructive/30" },
};

export function AgentCard({ name, role, emoji, status, amount, txHash, result }: AgentCardProps) {
  const cfg = STATUS_CONFIG[status];
  const isActive = status === "working" || status === "paid";

  return (
    <div
      className={cn(
        "border rounded-lg p-4 transition-all duration-300",
        isActive ? "border-border bg-card card-highlight" : "border-border bg-card/50",
        status === "done" && "border-border bg-card card-highlight",
        status === "idle" && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-lg leading-none">{emoji}</span>
          <div>
            <p className="text-sm font-medium text-foreground leading-none mb-0.5">{name}</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 shrink-0",
            cfg.className,
          )}
        >
          {cfg.icon}
          {cfg.label}
        </span>
      </div>

      {/* Payment info */}
      {(amount || txHash) && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          {amount && (
            <span className="text-xs font-mono text-success">+{amount} USDC</span>
          )}
          {txHash && <TransactionBadge hash={txHash} />}
        </div>
      )}

      {/* Result preview */}
      {result && status === "done" && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{result}</p>
        </div>
      )}
    </div>
  );
}
