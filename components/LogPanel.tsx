"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type LogLevel = "info" | "success" | "payment" | "error" | "system";

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  meta?: string; // e.g. tx hash or amount
}

interface LogPanelProps {
  entries: LogEntry[];
}

const LEVEL_STYLES: Record<LogLevel, string> = {
  info:    "text-muted-foreground",
  success: "text-success",
  payment: "text-primary",
  error:   "text-destructive",
  system:  "text-muted-foreground/50",
};

const LEVEL_PREFIX: Record<LogLevel, string> = {
  info:    "›",
  success: "✓",
  payment: "⟁",
  error:   "✗",
  system:  "#",
};

export function LogPanel({ entries }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="border border-border rounded-lg bg-card card-highlight overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">live log</span>
          {entries.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary dot-pulse" />
          )}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/40">{entries.length} events</span>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px]">
        {entries.length === 0 && (
          <p className="text-muted-foreground/30 text-center py-8">Waiting for events…</p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={cn("flex gap-2 animate-slide-up", LEVEL_STYLES[entry.level])}
          >
            <span className="shrink-0 text-muted-foreground/30 w-4 text-center">
              {LEVEL_PREFIX[entry.level]}
            </span>
            <span className="flex-1 break-all leading-relaxed">
              {entry.message}
              {entry.meta && (
                <span className="ml-1 text-muted-foreground/50">[{entry.meta}]</span>
              )}
            </span>
            <span className="shrink-0 text-muted-foreground/25 text-[10px] tabular-nums">
              {entry.timestamp.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
