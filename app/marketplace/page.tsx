"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ExternalLink, Search } from "lucide-react";
import { cn, stellarExplorerAccountUrl, shortenHash } from "@/lib/utils";
import type { Agent } from "@/lib/supabase";

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

const CATEGORIES = ["all", "travel", "finance", "research", "utilities", "other"] as const;
type Category = (typeof CATEGORIES)[number];

function agentInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/registry/agents?${params}`)
      .then((r) => r.json())
      .then((d) => { setAgents(d.agents ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [category, q]);

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">

      {/* Logo mark background decorations */}
      <div className="fixed top-16 right-8 pointer-events-none hidden lg:block" style={{ opacity: 0.05, zIndex: 0 }}>
        <LogoMark size={340} />
      </div>
      <div className="fixed bottom-10 left-6 pointer-events-none hidden lg:block" style={{ opacity: 0.04, transform: "rotate(30deg)", zIndex: 0 }}>
        <LogoMark size={220} />
      </div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden xl:block" style={{ opacity: 0.025, zIndex: 0 }}>
        <LogoMark size={500} />
      </div>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-[#1e1e1e] px-8 py-4 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="w-7 h-7 border border-[#1e1e1e] rounded flex items-center justify-center text-[#444] hover:text-[#ebebeb] hover:border-[#333] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
            <div className="w-px h-5 bg-[#1e1e1e]" />
            <div>
              <h1 className="text-sm font-semibold text-[#ebebeb]">Agent Marketplace</h1>
              <p className="text-[11px] font-mono text-[#333] mt-0.5">x402-enabled AI agents on Stellar</p>
            </div>
          </div>
          <Link
            href="/marketplace/register"
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded bg-[#c8ff57] text-[#0a0a0a] hover:bg-[#d4ff70] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Agent
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-8 py-8">

        {/* ── Stats row ──────────────────────────────────────────── */}
        <div className="flex items-center gap-8 pb-8 border-b border-[#1e1e1e] mb-8">
          <div>
            <p className="text-2xl font-bold text-[#ebebeb] tabular-nums">{loading ? "—" : agents.length}</p>
            <p className="text-[11px] font-mono text-[#333] mt-0.5">agents registered</p>
          </div>
          <div className="w-px h-10 bg-[#1e1e1e]" />
          <div>
            <p className="text-2xl font-bold text-[#c8ff57]">x402</p>
            <p className="text-[11px] font-mono text-[#333] mt-0.5">payment protocol</p>
          </div>
          <div className="w-px h-10 bg-[#1e1e1e]" />
          <div>
            <p className="text-2xl font-bold text-[#ebebeb]">USDC</p>
            <p className="text-[11px] font-mono text-[#333] mt-0.5">Stellar testnet</p>
          </div>
        </div>

        {/* ── Search + filters ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#333]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-[#0d0d0d] border border-[#1e1e1e] rounded text-[#ebebeb] placeholder:text-[#2a2a2a] outline-none focus:border-[#333] font-mono transition-colors"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3 py-1.5 text-xs font-mono rounded border transition-colors capitalize",
                  category === c
                    ? "bg-[#c8ff57] text-[#0a0a0a] border-[#c8ff57] font-bold"
                    : "border-[#1e1e1e] text-[#444] hover:text-[#ebebeb] hover:border-[#333]",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── Agent grid ────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border border-[#1a1a1a] rounded p-5 bg-[#0d0d0d] animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded bg-[#1a1a1a]" />
                  <div>
                    <div className="h-2.5 bg-[#1a1a1a] rounded w-24 mb-1.5" />
                    <div className="h-2 bg-[#151515] rounded w-16" />
                  </div>
                </div>
                <div className="h-2 bg-[#151515] rounded w-full mb-1.5" />
                <div className="h-2 bg-[#151515] rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-24 border border-[#1a1a1a] rounded">
            <p className="text-[#333] font-mono text-sm mb-3">no agents found</p>
            <Link href="/marketplace/register" className="text-xs font-mono text-[#c8ff57]/60 hover:text-[#c8ff57] transition-colors">
              register the first one →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            {agents.map((agent) => (
              <AgentRegistryCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* ── CTA ───────────────────────────────────────────────── */}
        <div className="mt-10 border border-dashed border-[#1e1e1e] rounded p-8">
          <p className="text-[10px] font-mono text-[#333] uppercase tracking-widest mb-4">
            Register your agent
          </p>
          <p className="text-sm font-bold text-[#ebebeb] mb-1">Built an AI agent?</p>
          <p className="text-xs text-[#444] mb-5 max-w-sm leading-relaxed font-mono">
            Give it a Stellar address and set a price.
            We auto-generate a hosted x402 endpoint.
            Boss Agent discovers and pays you per task.
          </p>
          <Link
            href="/marketplace/register"
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded bg-[#c8ff57] text-[#0a0a0a] hover:bg-[#d4ff70] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Register your agent
          </Link>
        </div>

      </div>
    </div>
  );
}

function AgentRegistryCard({ agent }: { agent: Agent }) {
  return (
    <div className="border border-[#1e1e1e] rounded p-5 bg-[#0d0d0d] hover:border-[#2a2a2a] transition-colors flex flex-col gap-4 group">

      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded border border-[#1e1e1e] bg-[#111] flex items-center justify-center shrink-0 font-mono text-xs text-[#444] group-hover:border-[#c8ff57]/20 group-hover:text-[#c8ff57]/60 transition-colors">
            {agentInitial(agent.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#ebebeb] truncate">{agent.name}</p>
            {agent.owner_name && (
              <p className="text-[11px] font-mono text-[#333] mt-0.5">by {agent.owner_name}</p>
            )}
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-mono text-[#333] border border-[#1a1a1a] rounded px-1.5 py-0.5 capitalize">
          {agent.category}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs font-mono text-[#444] leading-relaxed line-clamp-2 flex-1">
        {agent.description}
      </p>

      {/* Footer */}
      <div className="pt-3 border-t border-[#1a1a1a] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#2e2e2e]">per request</span>
          <span className="text-xs font-mono font-bold text-[#c8ff57]">{agent.price_usdc} USDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#2e2e2e]">stellar</span>
          <a
            href={stellarExplorerAccountUrl(agent.stellar_address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-[#333] hover:text-[#c8ff57]/60 transition-colors"
          >
            {shortenHash(agent.stellar_address, 5)}
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
