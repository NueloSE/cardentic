"use client";

import { useState } from "react";
import { ArrowRight, CreditCard, Zap, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLE_TASKS = [
  "Plan a 3-day trip to Lagos under $600 including flights and hotels",
  "Research and summarize the top 5 AI agent papers published this month",
  "Find the best cloud GPU providers and compare pricing for ML training",
  "Analyze the pros and cons of starting a SaaS vs a service business",
];

const FLOW_STEPS = [
  { icon: CreditCard, label: "You pay $10", sub: "Stripe test checkout" },
  { icon: Zap,        label: "10 USDC minted", sub: "Stellar testnet" },
  { icon: Globe,      label: "Boss Agent hired", sub: "Plans your task" },
  { icon: Shield,     label: "Sub-agents paid", sub: "x402 micropayments" },
];

export default function HomePage() {
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!task.trim() || task.trim().length < 10) {
      setError("Please describe your task in a bit more detail.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim() }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Check your connection.");
      setLoading(false);
    }
  };

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
          Pay once with a card. Your $10 becomes USDC on Stellar. A Boss Agent
          breaks your task apart, hires specialists, and pays each one via
          x402 micropayments — all on-chain.
        </p>

        {/* Input card */}
        <div className="w-full border border-border rounded-xl bg-card card-highlight overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <span className="font-mono text-[10px] bg-secondary px-1.5 py-0.5 rounded">TASK</span>
              <span>Describe what you need done</span>
            </div>
            <textarea
              value={task}
              onChange={(e) => {
                setTask(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
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
            <div className="flex items-center gap-3">
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">⌘ + Enter</span> to submit
                </p>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || !task.trim()}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Redirecting…
                </>
              ) : (
                <>
                  <CreditCard className="w-3.5 h-3.5" />
                  Pay $10 with Card
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Test card hint */}
        <p className="mt-3 text-xs text-muted-foreground/60 text-center">
          Test card: <span className="font-mono text-muted-foreground">4242 4242 4242 4242</span> · Any future date · Any CVC
        </p>

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
