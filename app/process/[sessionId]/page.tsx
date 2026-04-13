"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { FlowStep, type StepStatus } from "@/components/FlowStep";
import { AgentCard, type AgentCardProps, type AgentStatus } from "@/components/AgentCard";
import { LogPanel, type LogEntry } from "@/components/LogPanel";
import { TransactionBadge } from "@/components/TransactionBadge";
import { cn, shortenHash } from "@/lib/utils";
import { ArrowLeft, Copy } from "lucide-react";
import Link from "next/link";

function LogoMark({ size = 160 }: { size?: number }) {
  const c = size / 2;
  const r = size * 0.43;
  const angles = [270, 150, 30];
  const spokes = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: c + r * Math.cos(rad), y: c + r * Math.sin(rad) };
  });
  const boss = size * 0.11;
  const sub  = size * 0.065;
  const ring1 = size * 0.22;
  const ring2 = size * 0.38;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <circle cx={c} cy={c} r={ring1} stroke="#c8ff57" strokeWidth="0.8" opacity="0.35" />
      <circle cx={c} cy={c} r={ring2} stroke="#c8ff57" strokeWidth="0.8" opacity="0.18" />
      {spokes.map((pt, i) => (
        <line key={i} x1={c} y1={c} x2={pt.x} y2={pt.y} stroke="#c8ff57" strokeWidth="1.2" opacity="0.55" strokeDasharray="4 3" />
      ))}
      {spokes.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={sub} fill="#c8ff57" opacity="0.65" />
      ))}
      <circle cx={c} cy={c} r={boss} fill="#c8ff57" opacity="0.9" />
    </svg>
  );
}

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
  { label: "Payment confirmed",    sub: "Stripe checkout",          status: "pending" },
  { label: "USDC minted",          sub: "Stellar testnet transfer",  status: "pending" },
  { label: "Boss Agent activated", sub: "Task decomposition",        status: "pending" },
  { label: "Sub-agents running",   sub: "x402 micropayments",        status: "pending" },
  { label: "Result delivered",     sub: "Boss Agent aggregates",     status: "pending" },
];

const INITIAL_AGENTS: AgentState[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLog(level: LogEntry["level"], message: string, meta?: string): LogEntry {
  return { id: crypto.randomUUID(), level, message, timestamp: new Date(), meta };
}

function agentEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("flight") || n.includes("airline")) return "✈";
  if (n.includes("hotel") || n.includes("accommodation")) return "⌂";
  if (n.includes("activity") || n.includes("food")) return "◎";
  if (n.includes("visa") || n.includes("passport")) return "⊕";
  if (n.includes("weather")) return "◐";
  if (n.includes("budget") || n.includes("finance")) return "$";
  if (n.includes("research") || n.includes("analys") || n.includes("summar")) return "≡";
  return "◈";
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

  const addLog    = useCallback((e: LogEntry) => setLogs((p) => [...p, e]), []);
  const updateStep  = useCallback((i: number, patch: Partial<PipelineStep>) =>
    setSteps((p) => p.map((s, j) => j === i ? { ...s, ...patch } : s)), []);
  const updateAgent = useCallback((name: string, patch: Partial<AgentState>) =>
    setAgents((p) => p.map((a) => a.name === name ? { ...a, ...patch } : a)), []);

  const handleEventRef = useRef<((e: Record<string, unknown>) => void) | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    addLog(makeLog("system", `session ${sessionId} initialised`));
    addLog(makeLog("info", "connecting to agent stream…"));
    const es = new EventSource(`/api/agent/stream/${sessionId}`);
    es.addEventListener("message", (e) => {
      try { handleEventRef.current?.(JSON.parse(e.data)); } catch { /* ignore */ }
    });
    es.addEventListener("error", () => {
      addLog(makeLog("error", "stream disconnected"));
      es.close();
    });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleEvent = useCallback(
    (event: Record<string, unknown>) => {
      switch (event.type as string) {

        case "session_start": {
          const amount = event.amount as string;
          setTask(event.task as string);
          setPhase("running");
          updateStep(0, { status: "done", sub: `Stripe → $${amount} charged`, detail: `${sessionId?.slice(0, 12)}…` });
          addLog(makeLog("success", "payment confirmed via Stripe", `$${amount}`));
          break;
        }

        case "funding": {
          updateStep(1, { status: "active" });
          addLog(makeLog("info", "converting to USDC on Stellar testnet…"));
          break;
        }

        case "funded": {
          const hash = event.txHash as string;
          setFundingTx(hash);
          updateStep(1, { status: "done", detail: `tx ${shortenHash(hash, 8)}` });
          addLog(makeLog("success", "10 USDC sent to Boss Agent", shortenHash(hash)));
          updateStep(2, { status: "active" });
          addLog(makeLog("info", "Boss Agent analysing task…"));
          break;
        }

        case "planning": {
          const subtasks = event.subtasks as { agent: string; subtask: string }[];
          updateStep(2, { status: "done", detail: `${subtasks.length} agents selected` });
          updateStep(3, { status: "active" });
          subtasks.forEach((st) => addLog(makeLog("info", `→ ${st.agent}: ${st.subtask.slice(0, 60)}…`)));
          setAgents([
            ...subtasks.map((st) => ({
              name: st.agent,
              role: st.subtask.slice(0, 40),
              emoji: agentEmoji(st.agent),
              status: "waiting" as AgentStatus,
            })),
            { name: "Summarizer", role: "synthesises final output", emoji: "≡", status: "idle" as AgentStatus },
          ]);
          break;
        }

        case "agent_paying": {
          updateAgent(event.agent as string, { status: "working" });
          addLog(makeLog("payment", `paying ${event.agent} via x402`, `${event.amount} USDC`));
          break;
        }

        case "agent_paid": {
          const txHash = (event.txHash as string) || undefined;
          updateAgent(event.agent as string, { status: "paid", amount: event.amount as string, txHash });
          addLog(makeLog("payment", `${event.agent} paid`, txHash ? `tx ${shortenHash(txHash)}` : undefined));
          break;
        }

        case "agent_done": {
          updateAgent(event.agent as string, { status: "done", result: event.preview as string });
          addLog(makeLog("success", `${event.agent} complete`));
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
          addLog(makeLog("success", "task complete — result ready"));
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

  useEffect(() => { handleEventRef.current = handleEvent; }, [handleEvent]);

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(
      result.summary + "\n\n" +
      result.sections.map((s) => `## ${s.title}\n${s.content}`).join("\n\n"),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">

      {/* Logo mark background decorations */}
      <div className="fixed top-20 right-8 pointer-events-none hidden lg:block" style={{ opacity: 0.05, zIndex: 0 }}>
        <LogoMark size={300} />
      </div>
      <div className="fixed bottom-8 left-6 pointer-events-none hidden lg:block" style={{ opacity: 0.04, transform: "rotate(20deg)", zIndex: 0 }}>
        <LogoMark size={200} />
      </div>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="border-b border-[#1e1e1e] px-6 py-3.5 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="w-7 h-7 border border-[#1e1e1e] rounded flex items-center justify-center text-[#444] hover:text-[#ebebeb] hover:border-[#333] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>

            <div className="w-px h-5 bg-[#1e1e1e]" />

            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold text-[#ebebeb]">
                  {phase === "loading" && "Connecting"}
                  {phase === "running" && "Agents working"}
                  {phase === "done"    && "Complete"}
                  {phase === "error"   && "Error"}
                </span>
                {phase === "running" && (
                  <span className="pill pill-lime">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57] dot-pulse" />
                    LIVE
                  </span>
                )}
                {phase === "done" && (
                  <span className="pill pill-lime">✓ DONE</span>
                )}
              </div>
              {task && (
                <p className="text-[11px] font-mono text-[#333] mt-0.5 max-w-sm truncate">{task}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fundingTx && <TransactionBadge hash={fundingTx} label="funding" />}
            <span className="pill text-[#222] font-mono">
              {sessionId?.slice(0, 14)}…
            </span>
          </div>
        </div>
      </header>

      {/* ── Main grid ───────────────────────────────────────────── */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 grid gap-6 lg:grid-cols-[220px_1fr_280px] grid-cols-1">

        {/* ── Pipeline ─────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-mono text-[#333] uppercase tracking-widest mb-4">
            Pipeline
          </p>
          <div className="border border-[#1e1e1e] rounded p-4 bg-[#0d0d0d]">
            {steps.map((s, i) => (
              <FlowStep
                key={s.label}
                index={i}
                label={s.label}
                sub={s.sub}
                status={s.status}
                isLast={i === steps.length - 1}
                detail={s.detail}
              />
            ))}
          </div>

          <div className="mt-4 border border-[#1a1a1a] rounded p-3">
            <p className="text-[10px] font-mono text-[#c8ff57]/40 uppercase tracking-wider mb-1.5">x402</p>
            <p className="text-[11px] font-mono text-[#2e2e2e] leading-relaxed">
              HTTP 402 micropayments · Stellar testnet · USDC per agent call
            </p>
          </div>
        </div>

        {/* ── Center: Agents + Result ──────────────────────────── */}
        <div className="min-w-0 flex flex-col gap-6">

          <div>
            <p className="text-[10px] font-mono text-[#333] uppercase tracking-widest mb-4">
              Sub-agents
            </p>

            {agents.length === 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border border-[#1a1a1a] rounded p-4 bg-[#0d0d0d] animate-pulse">
                    <div className="h-2.5 bg-[#1a1a1a] rounded w-1/2 mb-2" />
                    <div className="h-2 bg-[#151515] rounded w-full" />
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

          {/* Loading state */}
          {phase === "loading" && (
            <div className="border border-[#1a1a1a] rounded p-6 animate-pulse">
              <div className="h-2.5 bg-[#1a1a1a] rounded w-1/4 mb-4" />
              <div className="space-y-2">
                <div className="h-2 bg-[#151515] rounded w-full" />
                <div className="h-2 bg-[#151515] rounded w-5/6" />
                <div className="h-2 bg-[#151515] rounded w-4/6" />
              </div>
            </div>
          )}

          {/* Result ─────────────────────────────────────────────── */}
          {result && (
            <div className="border border-[#c8ff57]/20 rounded overflow-hidden animate-slide-up">

              {/* Left accent bar */}
              <div className="flex">
                <div className="w-[3px] bg-[#c8ff57]/40 shrink-0" />
                <div className="flex-1 min-w-0">

                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e1e] bg-[#0d0d0d]">
                    <div>
                      <p className="text-sm font-bold text-[#ebebeb]">Result</p>
                      <p className="text-[11px] font-mono text-[#333] mt-0.5">synthesised by Boss Agent</p>
                    </div>
                    <button
                      onClick={copyResult}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded border transition-colors",
                        copied
                          ? "border-[#c8ff57]/30 text-[#c8ff57] bg-[#c8ff57]/5"
                          : "border-[#1e1e1e] text-[#444] hover:text-[#ebebeb] hover:border-[#333]",
                      )}
                    >
                      <Copy className="w-3 h-3" />
                      {copied ? "copied" : "copy"}
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-5 bg-[#080808]">
                    <p className="text-sm text-[#c4c4c4] leading-relaxed">{result.summary}</p>
                    {result.sections.map((sec) => (
                      <div key={sec.title}>
                        <p className="text-[10px] font-mono text-[#c8ff57]/50 uppercase tracking-widest mb-2.5">
                          {sec.title}
                        </p>
                        <p className="text-sm text-[#888] leading-relaxed whitespace-pre-wrap">{sec.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ── Log ──────────────────────────────────────────────── */}
        <div className="flex flex-col" style={{ height: "calc(100vh - 130px)" }}>
          <p className="text-[10px] font-mono text-[#333] uppercase tracking-widest mb-4">
            Live log
          </p>
          <div className="flex-1 min-h-0">
            <LogPanel entries={logs} />
          </div>
        </div>

      </div>
    </div>
  );
}
