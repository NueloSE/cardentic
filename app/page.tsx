"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Plan a 3-day trip to Lagos under $600 including flights and hotels",
  "Research and summarize the top 5 AI agent papers this month",
  "Find the best cloud GPU providers and compare pricing for ML training",
  "Analyze the pros and cons of starting a SaaS vs a service business",
];

const STEPS = [
  { n: "01", title: "Describe", body: "Tell us the task. Claude selects the best agents and shows a line-item cost breakdown — before you pay." },
  { n: "02", title: "Pay once", body: "Stripe charges the exact total. Payment is converted to USDC and sent to the Boss Agent on Stellar testnet." },
  { n: "03", title: "Agents execute", body: "The Boss Agent pays each specialist via x402 micropayments. Every settlement is a real Stellar transaction." },
  { n: "04", title: "Result", body: "A Summarizer agent synthesises all research into a structured, actionable answer. Watch every step live." },
];

interface AgentEstimate { name: string; subtask: string; price_usdc: number; }
interface Estimate {
  planId: string;
  agents: AgentEstimate[];
  subtotal_usdc: number;
  platform_fee_usdc: number;
  total_usdc: number;
  charge_usd: number;
}

// ── Shared logo mark used as background decoration ────────────────────────────
function LogoMark({ size = 160 }: { size?: number }) {
  const c = size / 2;
  const r = size * 0.43;
  // 3 spoke angles: top (270°), bottom-left (150°), bottom-right (30°)
  const angles = [270, 150, 30];
  const spokes = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: c + r * Math.cos(rad), y: c + r * Math.sin(rad) };
  });
  const boss = size * 0.11;   // boss node radius
  const sub  = size * 0.065;  // sub-agent node radius
  const ring1 = size * 0.22;
  const ring2 = size * 0.38;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {/* Concentric rings */}
      <circle cx={c} cy={c} r={ring1} stroke="#c8ff57" strokeWidth="0.8" opacity="0.35" />
      <circle cx={c} cy={c} r={ring2} stroke="#c8ff57" strokeWidth="0.8" opacity="0.18" />
      {/* Spokes */}
      {spokes.map((pt, i) => (
        <line key={i} x1={c} y1={c} x2={pt.x} y2={pt.y} stroke="#c8ff57" strokeWidth="1.2" opacity="0.55" strokeDasharray="4 3" />
      ))}
      {/* Sub-agent nodes */}
      {spokes.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={sub} fill="#c8ff57" opacity="0.65" />
      ))}
      {/* Boss node */}
      <circle cx={c} cy={c} r={boss} fill="#c8ff57" opacity="0.9" />
    </svg>
  );
}

function agentIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("flight") || n.includes("airline")) return "✈";
  if (n.includes("hotel") || n.includes("accommodation")) return "⌂";
  if (n.includes("activity") || n.includes("food")) return "◎";
  if (n.includes("visa") || n.includes("passport")) return "⊕";
  if (n.includes("weather")) return "◐";
  if (n.includes("budget") || n.includes("finance")) return "$";
  if (n.includes("research") || n.includes("summar")) return "≡";
  return "◈";
}

export default function HomePage() {
  const [task, setTask] = useState("");
  const [step, setStep] = useState<"input" | "preview">("input");
  const [estimating, setEstimating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => { setVisible(true); }, []);

  const handleEstimate = async () => {
    if (!task.trim() || task.trim().length < 10) { setError("Describe your task in a bit more detail."); return; }
    setError(""); setEstimating(true);
    try {
      const res = await fetch("/api/agent/estimate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not estimate. Try again."); return; }
      setEstimate(data); setStep("preview");
    } catch { setError("Network error."); }
    finally { setEstimating(false); }
  };

  const handlePay = async () => {
    if (!estimate) return;
    setError(""); setPaying(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim(), planId: estimate.planId }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { setError(data.error ?? "Something went wrong."); setPaying(false); }
    } catch { setError("Network error."); setPaying(false); }
  };

  return (
    <div className={cn("min-h-screen flex flex-col transition-opacity duration-500", visible ? "opacity-100" : "opacity-0")}>

      {/* ── Animated background orbs (fixed, pointer-events-none) ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        {/* Large slow orb — top left */}
        <div
          className="absolute rounded-full animate-float-a"
          style={{
            width: 600, height: 600,
            top: "-20%", left: "-10%",
            background: "radial-gradient(circle, rgba(200,255,87,0.055) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        {/* Medium orb — bottom right */}
        <div
          className="absolute rounded-full animate-float-b"
          style={{
            width: 480, height: 480,
            bottom: "-15%", right: "-8%",
            background: "radial-gradient(circle, rgba(200,255,87,0.04) 0%, transparent 70%)",
            filter: "blur(32px)",
          }}
        />
        {/* Small accent orb — center right */}
        <div
          className="absolute rounded-full animate-float-a"
          style={{
            width: 200, height: 200,
            top: "40%", right: "15%",
            background: "radial-gradient(circle, rgba(200,255,87,0.06) 0%, transparent 70%)",
            filter: "blur(20px)",
            animationDelay: "-6s",
          }}
        />
      </div>

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#1e1e1e] px-6 py-4 bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Cardentic" className="h-7 w-auto" />
          </div>
          <nav className="flex items-center gap-1">
            <Link href="/marketplace" className="text-xs text-[#616161] hover:text-[#ebebeb] px-3 py-1.5 rounded transition-colors">
              Marketplace
            </Link>
            <span className="pill">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57] dot-pulse" />
              Testnet
            </span>
          </nav>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center w-full">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative w-full flex flex-col items-center text-center px-6 pt-24 pb-16 border-b border-[#1e1e1e] overflow-hidden">

          {/* Grid lines — hero only */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(200,255,87,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(200,255,87,0.05) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* Centre glow burst behind headline */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: "10%", left: "50%", transform: "translateX(-50%)",
              width: 700, height: 400,
              background: "radial-gradient(ellipse at center, rgba(200,255,87,0.08) 0%, transparent 65%)",
              filter: "blur(8px)",
            }}
          />

          {/* Logo mark — large, top right */}
          <div className="absolute top-6 right-6 pointer-events-none hidden lg:block" style={{ opacity: 0.18 }}>
            <LogoMark size={200} />
          </div>

          {/* Logo mark — medium, bottom left */}
          <div className="absolute bottom-6 left-6 pointer-events-none hidden lg:block" style={{ opacity: 0.10, transform: "rotate(60deg)" }}>
            <LogoMark size={140} />
          </div>

          {/* Logo mark — small accent, mid-left */}
          <div className="absolute top-1/2 left-10 -translate-y-1/2 pointer-events-none hidden xl:block" style={{ opacity: 0.07 }}>
            <LogoMark size={90} />
          </div>

          {/* Logo mark — small accent, mid-right */}
          <div className="absolute top-1/3 right-20 pointer-events-none hidden xl:block" style={{ opacity: 0.07, transform: "rotate(-30deg)" }}>
            <LogoMark size={70} />
          </div>

          <p className="text-xs font-mono text-[#666] uppercase tracking-[0.18em] mb-8">
            Stellar × x402 × Stripe
          </p>
          <h1 className="text-[clamp(3rem,8vw,6rem)] font-bold leading-[0.9] tracking-tight mb-7">
            <span className="text-[#ebebeb]">AI agents.</span><br />
            <span className="text-[#c8ff57]">One payment.</span>
          </h1>
          <p className="text-[#999] text-lg max-w-xl leading-relaxed mb-6">
            Describe any task — research, travel, finance, analysis. Cardentic assembles
            a team of specialised AI agents, shows you exactly what each one costs, and
            lets them loose — every agent paid individually via{" "}
            <span className="text-[#c8ff57]/90">x402 micropayments</span> on{" "}
            <span className="text-[#c8ff57]/90">Stellar testnet</span>.
          </p>

          {/* Marketplace CTA inline in hero */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            <div className="flex items-center gap-2 border border-[#1e1e1e] rounded px-4 py-2.5 bg-[#0d0d0d]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff57] dot-pulse shrink-0" />
              <span className="text-sm text-[#777]">
                Have an AI agent?{" "}
                <Link href="/marketplace/register" className="text-[#c8ff57] hover:text-[#d4ff70] transition-colors font-medium">
                  List it on the marketplace →
                </Link>
              </span>
            </div>
          </div>
        </section>

        {/* ── Task input / Preview ──────────────────────────────── */}
        <section className="w-full border-b border-[#1e1e1e]">
          <div className="max-w-5xl mx-auto px-6 py-14">

          {step === "input" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[#1e1e1e]">

              {/* Left — CLI input */}
              <div className="bg-[#0a0a0a] pr-0 lg:pr-10 py-2">
                <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-4">
                  Enter task
                </p>
                <div className="border border-[#1e1e1e] rounded-md overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e1e] bg-[#111]">
                    <span className="text-[#c8ff57] font-mono text-sm select-none">›</span>
                    <span className="text-xs font-mono text-[#555] uppercase tracking-widest">task</span>
                  </div>
                  <div className="bg-[#0d0d0d] px-4 pt-4 pb-3">
                    <textarea
                      value={task}
                      onChange={(e) => { setTask(e.target.value); if (error) setError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleEstimate(); }}
                      placeholder="e.g. Plan a 3-day trip to Lagos under $600 including flights and hotels..."
                      className="w-full bg-transparent text-sm text-[#e0e0e0] placeholder:text-[#333] resize-none outline-none leading-relaxed min-h-[110px] font-mono"
                      rows={4}
                    />
                  </div>
                  <div className="px-4 py-3 border-t border-[#1e1e1e] flex items-center justify-between bg-[#111]">
                    {error
                      ? <p className="text-sm font-mono text-red-400">{error}</p>
                      : <p className="text-xs font-mono text-[#3a3a3a]">⌘ + Enter</p>
                    }
                    <button
                      onClick={handleEstimate}
                      disabled={estimating || !task.trim()}
                      className={cn(
                        "inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded",
                        "bg-[#c8ff57] text-[#0a0a0a] hover:bg-[#d4ff70] transition-colors",
                        "disabled:opacity-30 disabled:cursor-not-allowed",
                      )}
                    >
                      {estimating ? (
                        <><span className="w-3.5 h-3.5 border border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />Selecting agents</>
                      ) : (
                        <>See cost breakdown<ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs font-mono text-[#333]">
                  Test card: 4242 4242 4242 4242 · any future date · any CVC
                </p>
              </div>

              {/* Right — example prompts */}
              <div className="bg-[#0a0a0a] pl-0 lg:pl-10 py-2">
                <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-4">
                  Example tasks
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {EXAMPLES.map((ex, i) => (
                    <button
                      key={ex}
                      onClick={() => setTask(ex)}
                      className={cn(
                        "group flex items-start gap-3 text-left w-full",
                        "border border-[#1a1a1a] rounded p-4 bg-[#0d0d0d]",
                        "hover:border-[#c8ff57]/20 hover:bg-[#0f0f0f] transition-all",
                        task === ex && "border-[#c8ff57]/30 bg-[#0f0f0f]",
                      )}
                    >
                      <span className="text-xs font-mono text-[#444] mt-0.5 shrink-0 w-5">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={cn(
                        "text-sm font-mono leading-relaxed transition-colors",
                        task === ex ? "text-[#c8ff57]/90" : "text-[#777] group-hover:text-[#aaa]",
                      )}>
                        {ex}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {step === "preview" && estimate && (
            <div className="max-w-xl mx-auto w-full animate-slide-up">
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => { setStep("input"); setEstimate(null); }} className="text-[#444] hover:text-[#ebebeb] transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="text-xs font-mono text-[#444] truncate flex-1">
                  <span className="text-[#555]">task: </span>{task}
                </p>
              </div>

              <div className="border border-[#1e1e1e] rounded-md overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e1e1e] bg-[#111] flex items-center justify-between">
                  <span className="text-xs font-mono text-[#555] uppercase tracking-widest">Selected agents</span>
                  <span className="text-xs font-mono text-[#444]">{estimate.agents.length} agents</span>
                </div>
                {estimate.agents.map((a, i) => (
                  <div key={a.name} className="flex items-start gap-4 px-4 py-3.5 border-b border-[#1a1a1a] hover:bg-[#0f0f0f] transition-colors">
                    <span className="text-[#333] font-mono text-xs w-4 mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-mono text-sm text-[#444] shrink-0 w-4">{agentIcon(a.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#ebebeb]">{a.name}</p>
                      <p className="text-sm text-[#666] mt-0.5 truncate font-mono">{a.subtask}</p>
                    </div>
                    <span className="text-xs font-mono text-[#c8ff57] shrink-0">{a.price_usdc.toFixed(2)} USDC</span>
                  </div>
                ))}
                <div className="px-4 py-3 bg-[#111] space-y-1.5">
                  <div className="flex justify-between text-sm font-mono text-[#666]">
                    <span>Agent costs</span><span>{estimate.subtotal_usdc.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm font-mono text-[#666]">
                    <span>Platform fee</span><span>{estimate.platform_fee_usdc.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#1e1e1e]">
                    <span className="text-sm font-bold text-[#ebebeb]">Total</span>
                    <span className="text-sm font-bold font-mono text-[#c8ff57]">${estimate.charge_usd.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {error && <p className="text-xs font-mono text-red-400 mt-3 text-center">{error}</p>}

              <button
                onClick={handlePay}
                disabled={paying}
                className={cn(
                  "mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-bold py-3.5 rounded",
                  "bg-[#c8ff57] text-[#0a0a0a] hover:bg-[#d4ff70] transition-colors",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                )}
              >
                {paying ? (
                  <><span className="w-3.5 h-3.5 border border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />Redirecting…</>
                ) : (
                  <>Pay ${estimate.charge_usd.toFixed(2)} with card<ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              <p className="mt-3 text-xs font-mono text-[#444] text-center">
                Test card: 4242 4242 4242 4242 · any future date · any CVC
              </p>
            </div>
          )}

          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="relative w-full border-t border-[#1e1e1e] overflow-hidden">
          <div className="absolute top-6 right-6 pointer-events-none hidden lg:block" style={{ opacity: 0.05 }}>
            <LogoMark size={260} />
          </div>
          <div className="absolute bottom-4 left-4 pointer-events-none hidden lg:block" style={{ opacity: 0.035, transform: "rotate(45deg)" }}>
            <LogoMark size={160} />
          </div>
          <div className="max-w-5xl mx-auto px-6 py-16">
            <p className="text-xs font-mono text-[#555] uppercase tracking-[0.18em] mb-10 text-center">
              How it works
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#1e1e1e]">
              {STEPS.map((s) => (
                <div key={s.n} className="bg-[#0a0a0a] p-8">
                  <p className="text-xs font-mono text-[#c8ff57] mb-5">{s.n}</p>
                  <h3 className="text-base font-bold text-[#ebebeb] mb-3">{s.title}</h3>
                  <p className="text-sm text-[#666] leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Protocol strip ───────────────────────────────────── */}
        <section className="relative w-full border-t border-[#1e1e1e] overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden lg:block" style={{ opacity: 0.04 }}>
            <LogoMark size={320} />
          </div>
          <div className="max-w-5xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#1e1e1e]">
              {[
                { label: "x402 Protocol", text: "Each agent responds with HTTP 402. The Boss Agent signs a Stellar transaction and retries — settles on-chain in milliseconds." },
                { label: "Stellar Testnet", text: "Every micropayment is a real Stellar transaction. Every tx hash is verifiable on stellar.expert. No mocks, no simulation." },
                { label: "Open Registry", text: "Anyone can register an agent with a Stellar address. Cardentic hosts the x402 endpoint. You earn USDC per request." },
              ].map((item) => (
                <div key={item.label} className="bg-[#0a0a0a] p-8">
                  <p className="text-xs font-mono text-[#c8ff57] uppercase tracking-wider mb-3">{item.label}</p>
                  <p className="text-sm text-[#666] leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-[#1e1e1e] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xs font-mono text-[#444]">Cardentic · Stellar Agents × x402 Hackathon 2026</span>
          <span className="text-xs font-mono text-[#444]">testnet · no real funds</span>
        </div>
      </footer>

    </div>
  );
}
