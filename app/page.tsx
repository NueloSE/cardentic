"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CreditCard, Zap, Shield, Globe, ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLE_TASKS = [
  "Plan a 3-day trip to Lagos under $600 including flights and hotels",
  "Research and summarize the top 5 AI agent papers published this month",
  "Find the best cloud GPU providers and compare pricing for ML training",
  "Analyze the pros and cons of starting a SaaS vs a service business",
];

const FLOW_STEPS = [
  { icon: CreditCard, label: "You pay exact amount", sub: "Stripe test checkout" },
  { icon: Zap,        label: "USDC minted",          sub: "Stellar testnet" },
  { icon: Globe,      label: "Boss Agent hired",      sub: "Plans your task" },
  { icon: Shield,     label: "Sub-agents paid",       sub: "x402 micropayments" },
];

interface AgentEstimate {
  name: string;
  subtask: string;
  price_usdc: number;
}

interface Estimate {
  planId: string;
  agents: AgentEstimate[];
  subtotal_usdc: number;
  platform_fee_usdc: number;
  total_usdc: number;
  charge_usd: number;
}

// ── Emoji helper ──────────────────────────────────────────────────────────────
function agentEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("flight") || n.includes("airline")) return "✈️";
  if (n.includes("hotel") || n.includes("accommodation") || n.includes("stay")) return "🏨";
  if (n.includes("activity") || n.includes("food") || n.includes("dining")) return "🗺️";
  if (n.includes("visa") || n.includes("passport")) return "🛂";
  if (n.includes("weather") || n.includes("forecast")) return "🌤️";
  if (n.includes("budget") || n.includes("finance") || n.includes("cost")) return "💰";
  if (n.includes("research") || n.includes("summar")) return "📋";
  return "🤖";
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [task, setTask] = useState("");
  const [step, setStep] = useState<"input" | "preview">("input");
  const [estimating, setEstimating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState("");

  // ── Step 1: Get estimate ───────────────────────────────────────────────────
  const handleEstimate = async () => {
    if (!task.trim() || task.trim().length < 10) {
      setError("Please describe your task in a bit more detail.");
      return;
    }
    setError("");
    setEstimating(true);
    try {
      const res = await fetch("/api/agent/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not estimate cost. Try again."); return; }
      setEstimate(data);
      setStep("preview");
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setEstimating(false);
    }
  };

  // ── Step 2: Confirm and pay ────────────────────────────────────────────────
  const handlePay = async () => {
    if (!estimate) return;
    setError("");
    setPaying(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim(), planId: estimate.planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Something went wrong. Try again.");
        setPaying(false);
      }
    } catch {
      setError("Network error. Check your connection.");
      setPaying(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-41px)] flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">C</span>
          </div>
          <span className="font-semibold tracking-tight text-foreground">Cardentic</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 border border-border rounded px-2 py-1 hover:border-primary/40 hover:text-foreground transition-colors"
          >
            Agent Marketplace
          </Link>
          <span className="inline-flex items-center gap-1.5 border border-border rounded px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-warning dot-pulse" />
            Stellar Testnet
          </span>
          <span className="inline-flex items-center gap-1.5 border border-border rounded px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-warning dot-pulse" />
            Stripe Test Mode
          </span>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16 max-w-3xl mx-auto w-full">

        {/* Eyebrow */}
        <div className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Human → Stripe → Stellar → AI Agents → Result
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-center leading-[1.1] mb-4">
          One payment.
          <br />
          <span className="text-muted-foreground font-normal">A team of agents gets to work.</span>
        </h1>

        <p className="text-muted-foreground text-center text-base max-w-md mb-10 leading-relaxed">
          Describe your task. We select the right AI agents, show you exactly what they cost,
          and you pay only what's needed — via x402 micropayments on Stellar.
        </p>

        {/* ── Step 1: Task input ── */}
        {step === "input" && (
          <div className="w-full border border-border rounded-xl bg-card card-highlight overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="font-mono text-[10px] bg-secondary px-1.5 py-0.5 rounded">TASK</span>
                <span>Describe what you need done</span>
              </div>
              <textarea
                value={task}
                onChange={(e) => { setTask(e.target.value); if (error) setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleEstimate(); }}
                placeholder="Plan a cheap 3-day weekend trip to Lagos under $600 including flights and hotel..."
                className={cn(
                  "w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50",
                  "resize-none outline-none leading-relaxed min-h-[80px]",
                )}
                rows={3}
              />
            </div>

            {/* Example prompts */}
            <div className="px-4 py-3 border-b border-border flex flex-wrap gap-2">
              {EXAMPLE_TASKS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTask(t)}
                  className={cn(
                    "text-[11px] text-muted-foreground border border-border rounded-md px-2.5 py-1",
                    "hover:border-primary/40 hover:text-foreground transition-colors text-left",
                    task === t && "border-primary/40 text-foreground",
                  )}
                >
                  {t.length > 48 ? t.slice(0, 48) + "…" : t}
                </button>
              ))}
            </div>

            {/* Submit row */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">⌘ + Enter</span> to continue
                  </p>
                )}
              </div>
              <button
                onClick={handleEstimate}
                disabled={estimating || !task.trim()}
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                {estimating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Selecting agents…
                  </>
                ) : (
                  <>
                    See cost breakdown
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Cost preview ── */}
        {step === "preview" && estimate && (
          <div className="w-full animate-slide-up">

            {/* Task summary */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => { setStep("input"); setEstimate(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <p className="text-sm text-muted-foreground flex-1 truncate">
                <span className="text-foreground font-medium">Task: </span>{task}
              </p>
            </div>

            {/* Agent breakdown card */}
            <div className="border border-border rounded-xl bg-card card-highlight overflow-hidden mb-3">
              <div className="px-5 py-4 border-b border-border">
                <p className="text-sm font-medium text-foreground">Selected agents</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {estimate.agents.length} agent{estimate.agents.length !== 1 ? "s" : ""} selected from the marketplace
                </p>
              </div>

              {/* Agent rows */}
              <div className="divide-y divide-border">
                {estimate.agents.map((agent) => (
                  <div key={agent.name} className="px-5 py-3.5 flex items-start gap-3">
                    <span className="text-base leading-none mt-0.5">{agentEmoji(agent.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
                        {agent.subtask}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-success shrink-0">
                      {agent.price_usdc.toFixed(2)} USDC
                    </span>
                  </div>
                ))}
              </div>

              {/* Cost summary */}
              <div className="px-5 py-4 border-t border-border bg-secondary/20 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Agent costs</span>
                  <span className="font-mono">{estimate.subtotal_usdc.toFixed(2)} USDC</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Platform fee</span>
                  <span className="font-mono">{estimate.platform_fee_usdc.toFixed(2)} USDC</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-foreground pt-1 border-t border-border">
                  <span>Total</span>
                  <span className="font-mono text-primary">${estimate.charge_usd.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Pay button */}
            {error && <p className="text-xs text-destructive mb-3">{error}</p>}

            <button
              onClick={handlePay}
              disabled={paying}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-3 rounded-xl",
                "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {paying ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Redirecting to payment…
                </>
              ) : (
                <>
                  <CreditCard className="w-3.5 h-3.5" />
                  Pay ${estimate.charge_usd.toFixed(2)} with Card
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <p className="mt-3 text-xs text-muted-foreground/60 text-center">
              Test card: <span className="font-mono text-muted-foreground">4242 4242 4242 4242</span> · Any future date · Any CVC
            </p>
          </div>
        )}

        {/* Test card hint — only on input step */}
        {step === "input" && (
          <p className="mt-3 text-xs text-muted-foreground/60 text-center">
            Test card: <span className="font-mono text-muted-foreground">4242 4242 4242 4242</span> · Any future date · Any CVC
          </p>
        )}

        {/* How it works */}
        <div className="mt-16 w-full">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-5 text-center">How it works</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.label} className="border border-border rounded-lg p-4 bg-card card-highlight">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-mono text-muted-foreground/60 w-4">{String(i + 1).padStart(2, "0")}</span>
                  <step.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground mb-0.5">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.sub}</p>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-[11px] text-muted-foreground/50">
          <span>Cardentic · Stellar Agents x402 Hackathon 2026</span>
          <span className="font-mono">testnet · no real funds used</span>
        </div>
      </footer>

    </div>
  );
}
