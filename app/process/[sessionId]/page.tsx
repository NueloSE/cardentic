"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { FlowStep, type StepStatus } from "@/components/FlowStep";
import { AgentCard, type AgentCardProps, type AgentStatus } from "@/components/AgentCard";
import { LogPanel, type LogEntry } from "@/components/LogPanel";
import { TransactionBadge } from "@/components/TransactionBadge";
import { cn, shortenHash } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PipelineStep {
  label: string;
  sub: string;
  status: StepStatus;
  detail?: string;
}

interface AgentState extends AgentCardProps {}

interface SessionResult {
  summary: string;
  sections: { title: string; content: string }[];
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STEPS: PipelineStep[] = [
  { label: "Payment confirmed",    sub: "Stripe checkout",                  status: "pending" },
  { label: "USDC minted",          sub: "Stellar testnet transfer",         status: "pending" },
  { label: "Boss Agent activated", sub: "Task decomposition",               status: "pending" },
  { label: "Sub-agents running",   sub: "x402 micropayments",               status: "pending" },
  { label: "Result delivered",     sub: "Boss Agent aggregates",            status: "pending" },
];

// Agent list is built dynamically from the planning SSE event — not hardcoded.
// This ensures only agents actually selected for the task are shown.
const INITIAL_AGENTS: AgentState[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLog(
  level: LogEntry["level"],
  message: string,
  meta?: string,
): LogEntry {
  return { id: crypto.randomUUID(), level, message, timestamp: new Date(), meta };
}

/** Pick an emoji for an agent based on its name */
function agentEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("flight") || n.includes("airline") || n.includes("transit")) return "✈️";
  if (n.includes("hotel") || n.includes("accommodation") || n.includes("stay") || n.includes("lodge")) return "🏨";
  if (n.includes("activity") || n.includes("food") || n.includes("dining") || n.includes("restaurant")) return "🗺️";
  if (n.includes("visa") || n.includes("passport") || n.includes("entry")) return "🛂";
  if (n.includes("weather") || n.includes("climate") || n.includes("forecast")) return "🌤️";
  if (n.includes("budget") || n.includes("cost") || n.includes("price") || n.includes("finance")) return "💰";
  if (n.includes("research") || n.includes("analys") || n.includes("summar")) return "📋";
  if (n.includes("rent") || n.includes("property") || n.includes("real estate")) return "🏠";
  if (n.includes("electric") || n.includes("utility") || n.includes("power")) return "⚡";
  return "🤖";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProcessPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [task, setTask] = useState<string>("");
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [fundingTx, setFundingTx] = useState<string>("");
  const [phase, setPhase] = useState<"loading" | "running" | "done" | "error">("loading");
  const [copied, setCopied] = useState(false);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const updateStep = useCallback((index: number, patch: Partial<PipelineStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  const updateAgent = useCallback((name: string, patch: Partial<AgentState>) => {
    setAgents((prev) =>
      prev.map((a) => (a.name === name ? { ...a, ...patch } : a))
    );
  }, []);

  // Keep a stable ref to handleEvent so the SSE listener never goes stale
  const handleEventRef = useRef<((event: Record<string, unknown>) => void) | null>(null);

  // ── SSE connection ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    addLog(makeLog("system", `Session ${sessionId} initialised`));
    addLog(makeLog("info", "Connecting to agent stream…"));

    const es = new EventSource(`/api/agent/stream/${sessionId}`);

    es.addEventListener("message", (e) => {
      try {
        const event = JSON.parse(e.data) as Record<string, unknown>;
        handleEventRef.current?.(event);
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener("error", () => {
      addLog(makeLog("error", "Stream disconnected"));
      es.close();
    });

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Event handler ───────────────────────────────────────────────────────────
  const handleEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = event.type as string;

      switch (type) {
        case "session_start": {
          const amount = event.amount as string;
          setTask(event.task as string);
          setPhase("running");
          updateStep(0, {
            status: "done",
            sub: `Stripe → $${amount} charged`,
            detail: `session ${sessionId?.slice(0, 12)}…`,
          });
          addLog(makeLog("success", "Payment confirmed via Stripe", `$${amount}`));
          break;
        }

        case "funding": {
          updateStep(1, { status: "active" });
          addLog(makeLog("info", "Converting to USDC on Stellar testnet…"));
          break;
        }

        case "funded": {
          const hash = event.txHash as string;
          setFundingTx(hash);
          updateStep(1, { status: "done", detail: `tx: ${shortenHash(hash, 8)}` });
          addLog(makeLog("success", `10 USDC sent to Boss Agent`, shortenHash(hash)));
          updateStep(2, { status: "active" });
          addLog(makeLog("info", "Boss Agent analysing task…"));
          break;
        }

        case "planning": {
          const subtasks = event.subtasks as { agent: string; subtask: string }[];
          updateStep(2, { status: "done", detail: `${subtasks.length} sub-tasks planned` });
          updateStep(3, { status: "active" });
          subtasks.forEach((st) => {
            addLog(makeLog("info", `→ ${st.agent}: ${st.subtask.slice(0, 60)}…`));
          });
          // Build agent list dynamically — only agents selected for this task + Summarizer
          const dynamicAgents: AgentState[] = [
            ...subtasks.map((st) => ({
              name: st.agent,
              role: st.subtask.slice(0, 40),
              emoji: agentEmoji(st.agent),
              status: "waiting" as AgentStatus,
            })),
            {
              name: "Summarizer",
              role: "Synthesises final output",
              emoji: "📋",
              status: "idle" as AgentStatus,
            },
          ];
          setAgents(dynamicAgents);
          break;
        }

        case "agent_paying": {
          const agentName = event.agent as string;
          updateAgent(agentName, { status: "working" });
          addLog(makeLog("payment", `Boss paying ${agentName} via x402…`, `${event.amount} USDC`));
          break;
        }

        case "agent_paid": {
          const agentName = event.agent as string;
          const txHash = (event.txHash as string) || undefined;
          updateAgent(agentName, {
            status: "paid",
            amount: event.amount as string,
            txHash,
          });
          const logMeta = txHash ? `tx: ${shortenHash(txHash)}` : undefined;
          addLog(makeLog("payment", `${agentName} paid & working`, logMeta));
          break;
        }

        case "agent_done": {
          const agentName = event.agent as string;
          updateAgent(agentName, {
            status: "done",
            result: event.preview as string,
          });
          addLog(makeLog("success", `${agentName} completed task`));
          break;
        }

        case "aggregating": {
          updateStep(3, { status: "done" });
          updateStep(4, { status: "active" });
          addLog(makeLog("info", "Boss Agent synthesising results…"));
          break;
        }

        case "complete": {
          updateStep(4, { status: "done" });
          setResult(event.result as SessionResult);
          setPhase("done");
          addLog(makeLog("success", "Task complete — result ready"));
          break;
        }

        case "error": {
          setPhase("error");
          addLog(makeLog("error", event.message as string));
          break;
        }
      }
    },
    [sessionId, updateStep, updateAgent, addLog],
  );

  // Keep ref in sync so SSE listener always calls the latest version
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.summary + "\n\n" + result.sections.map(s => `## ${s.title}\n${s.content}`).join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-41px)] flex flex-col">

      {/* Top bar */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {phase === "loading" && "Connecting…"}
                  {phase === "running" && "Agents working"}
                  {phase === "done"    && "Complete"}
                  {phase === "error"   && "Something went wrong"}
                </span>
                {phase === "running" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-warning dot-pulse" />
                )}
                {phase === "done" && (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                )}
              </div>
              {task && (
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md truncate">{task}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fundingTx && <TransactionBadge hash={fundingTx} label="funding tx" />}
            <span className="text-[10px] font-mono text-muted-foreground/40 border border-border rounded px-2 py-1">
              {sessionId?.slice(0, 16)}…
            </span>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-6">

        {/* Left: Pipeline */}
        <div>
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-4">Pipeline</p>
          <div>
            {steps.map((step, i) => (
              <FlowStep
                key={step.label}
                index={i}
                label={step.label}
                sub={step.sub}
                status={step.status}
                isLast={i === steps.length - 1}
                detail={step.detail}
              />
            ))}
          </div>
        </div>

        {/* Center: Agents + Result */}
        <div className="min-w-0 flex flex-col gap-6">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-4">Sub-agents</p>
            {agents.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border border-border rounded-lg p-4 bg-card/50 animate-pulse">
                    <div className="h-3 bg-secondary rounded w-2/3 mb-2" />
                    <div className="h-2 bg-secondary rounded w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
                {agents.map((agent) => (
                  <AgentCard key={agent.name} {...agent} />
                ))}
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="border border-border rounded-lg bg-card card-highlight animate-slide-up">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium">Result</span>
                </div>
                <button
                  onClick={copyResult}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="p-5 space-y-5">
                <p className="text-sm text-foreground leading-relaxed">{result.summary}</p>
                {result.sections.map((sec) => (
                  <div key={sec.title}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{sec.title}</p>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{sec.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {phase === "loading" && (
            <div className="border border-border rounded-lg p-6 animate-pulse bg-card">
              <div className="h-3 bg-secondary rounded w-1/3 mb-4" />
              <div className="space-y-2">
                <div className="h-2 bg-secondary rounded w-full" />
                <div className="h-2 bg-secondary rounded w-5/6" />
                <div className="h-2 bg-secondary rounded w-4/6" />
              </div>
            </div>
          )}
        </div>

        {/* Right: Log */}
        <div className="flex flex-col" style={{ height: "calc(100vh - 200px)" }}>
          <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-4">Live log</p>
          <div className="flex-1 min-h-0">
            <LogPanel entries={logs} />
          </div>
        </div>

      </div>
    </div>
  );
}
