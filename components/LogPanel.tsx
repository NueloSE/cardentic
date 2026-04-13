"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type LogLevel = "info" | "success" | "payment" | "error" | "system";

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  meta?: string;
}

interface LogPanelProps {
  entries: LogEntry[];
}

const LEVEL_STYLE: Record<LogLevel, { text: string; prefix: string }> = {
  system:  { text: "text-[#2e2e2e]",     prefix: "#" },
  info:    { text: "text-[#555]",         prefix: ">" },
  success: { text: "text-[#c8ff57]/80",   prefix: "✓" },
  payment: { text: "text-[#c8ff57]",      prefix: "⟁" },
  error:   { text: "text-red-400",        prefix: "✗" },
};

export function LogPanel({ entries }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="border border-[#1e1e1e] rounded overflow-hidden h-full flex flex-col bg-[#080808]">

      {/* Terminal titlebar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1a1a1a] bg-[#0d0d0d]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e1e1e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e1e1e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e1e1e]" />
        </div>
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-[10px] font-mono text-[#2e2e2e] uppercase tracking-widest">
            agent.log
          </span>
          {entries.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57] dot-pulse" />
          )}
        </div>
        <span className="text-[10px] font-mono text-[#222] tabular-nums">
          {entries.length}
        </span>
      </div>

      {/* Log body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 font-mono text-[11px]">
        {entries.length === 0 && (
          <div className="flex items-center gap-2 text-[#1e1e1e] pt-2">
            <span>$</span>
            <span className="animate-blink">_</span>
          </div>
        )}

        {entries.map((entry) => {
          const style = LEVEL_STYLE[entry.level];
          return (
            <div
              key={entry.id}
              className={cn("flex gap-2.5 leading-relaxed animate-slide-up", style.text)}
            >
              <span className="shrink-0 w-3 text-center">{style.prefix}</span>
              <span className="flex-1 break-all">
                {entry.message}
                {entry.meta && (
                  <span className="ml-1.5 text-[10px] text-[#333] border border-[#1a1a1a] rounded px-1.5 py-px align-middle">
                    {entry.meta}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[#1e1e1e] tabular-nums text-[10px] mt-px">
                {entry.timestamp.toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
