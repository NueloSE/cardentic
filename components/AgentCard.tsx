import { cn } from "@/lib/utils";
import { TransactionBadge } from "./TransactionBadge";

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

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle:    "queued",
  waiting: "queued",
  working: "working",
  paid:    "paid",
  done:    "done",
  error:   "error",
};

export function AgentCard({ name, role, emoji, status, amount, txHash, result }: AgentCardProps) {
  const isActive  = status === "working" || status === "paid";
  const isDone    = status === "done";
  const isIdle    = status === "idle" || status === "waiting";
  const isError   = status === "error";

  return (
    <div
      className={cn(
        "relative border rounded overflow-hidden transition-all duration-300",
        isDone   && "border-[#c8ff57]/20 bg-[#0d0d0d]",
        isActive && "border-[#c8ff57]/30 bg-[#0d0d0d]",
        isIdle   && "border-[#1a1a1a] bg-[#0d0d0d] opacity-50",
        isError  && "border-red-500/20 bg-[#0d0d0d]",
      )}
    >
      {/* Lime left-border accent when active/done */}
      {(isActive || isDone) && (
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-[2px]",
          isDone   ? "bg-[#c8ff57]/50"  : "bg-[#c8ff57]",
        )} />
      )}

      {/* Scan line when working */}
      {isActive && (
        <div
          className="absolute inset-x-0 h-[1px] bg-[#c8ff57]/40 animate-scan-h pointer-events-none"
          style={{ top: "50%" }}
        />
      )}

      <div className="px-4 py-3.5 pl-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#ebebeb] truncate">{name}</p>
            <p className="text-[11px] font-mono text-[#444] truncate mt-0.5">{role}</p>
          </div>
          <span
            className={cn(
              "shrink-0 text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border",
              isDone   && "border-[#c8ff57]/20 text-[#c8ff57] bg-[#c8ff57]/5",
              isActive && "border-[#c8ff57]/30 text-[#c8ff57]/80",
              isIdle   && "border-[#1e1e1e] text-[#333]",
              isError  && "border-red-500/25 text-red-400",
            )}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Result preview */}
        {result && isDone && (
          <p className="text-[11px] font-mono text-[#444] line-clamp-2 leading-relaxed mb-3 border-t border-[#1a1a1a] pt-2.5 mt-2.5">
            {result}
          </p>
        )}

        {/* Payment footer */}
        {(amount || txHash) && (
          <div className="flex items-center justify-between pt-2.5 border-t border-[#1a1a1a] mt-2">
            {amount && (
              <span className="text-[11px] font-mono text-[#c8ff57]">+{amount} USDC</span>
            )}
            {txHash && <TransactionBadge hash={txHash} />}
          </div>
        )}
      </div>
    </div>
  );
}
