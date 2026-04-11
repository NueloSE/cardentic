import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export type StepStatus = "pending" | "active" | "done" | "error";

interface FlowStepProps {
  index: number;
  label: string;
  sub: string;
  status: StepStatus;
  isLast?: boolean;
  detail?: string;
}

export function FlowStep({ index, label, sub, status, isLast, detail }: FlowStepProps) {
  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[15px] top-8 bottom-0 w-px",
            status === "done" ? "bg-primary/30" : "bg-border",
          )}
        />
      )}

      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        {status === "done" && (
          <div className="w-8 h-8 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
        )}
        {status === "active" && (
          <div className="w-8 h-8 rounded-full border border-warning/40 bg-warning/10 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-warning animate-spin" />
          </div>
        )}
        {status === "pending" && (
          <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
            <span className="text-[10px] font-mono text-muted-foreground/50">{String(index + 1).padStart(2, "0")}</span>
          </div>
        )}
        {status === "error" && (
          <div className="w-8 h-8 rounded-full border border-destructive/40 bg-destructive/10 flex items-center justify-center">
            <Circle className="w-4 h-4 text-destructive fill-destructive" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pb-7 flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium leading-none mb-1",
            status === "done" && "text-foreground",
            status === "active" && "text-foreground",
            status === "pending" && "text-muted-foreground/50",
            status === "error" && "text-destructive",
          )}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground/60 mb-1">{sub}</p>
        {detail && (
          <p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1 mt-2 truncate">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
