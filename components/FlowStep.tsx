import { cn } from "@/lib/utils";

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
  const isDone   = status === "done";
  const isActive = status === "active";
  const isError  = status === "error";

  return (
    <div className="relative flex gap-3 group">

      {/* Connector line */}
      {!isLast && (
        <div className={cn(
          "pipeline-connector",
          isDone && "pipeline-connector-done",
        )} />
      )}

      {/* Node */}
      <div className="shrink-0 mt-0.5">
        {isDone && (
          <div className="w-[22px] h-[22px] rounded-sm border border-[#c8ff57]/40 bg-[#c8ff57]/8 flex items-center justify-center">
            <span className="text-[#c8ff57] text-[10px] font-mono">✓</span>
          </div>
        )}
        {isActive && (
          <div className="w-[22px] h-[22px] rounded-sm border border-[#c8ff57] bg-[#c8ff57]/5 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57] dot-pulse" />
          </div>
        )}
        {status === "pending" && (
          <div className="w-[22px] h-[22px] rounded-sm border border-[#1e1e1e] flex items-center justify-center">
            <span className="text-[#2e2e2e] text-[9px] font-mono">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
        )}
        {isError && (
          <div className="w-[22px] h-[22px] rounded-sm border border-red-500/30 bg-red-500/5 flex items-center justify-center">
            <span className="text-red-400 text-[10px] font-mono">✗</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pb-6 flex-1 min-w-0">
        <p className={cn(
          "text-xs font-semibold leading-none mb-1",
          isDone    && "text-[#ebebeb]",
          isActive  && "text-[#c8ff57]",
          status === "pending" && "text-[#333]",
          isError   && "text-red-400",
        )}>
          {label}
        </p>
        <p className={cn(
          "text-[11px] font-mono",
          isDone || isActive ? "text-[#444]" : "text-[#2a2a2a]",
        )}>
          {sub}
        </p>
        {detail && (
          <p className={cn(
            "mt-1.5 text-[10px] font-mono truncate",
            isDone ? "text-[#c8ff57]/50" : "text-[#333]",
          )}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
