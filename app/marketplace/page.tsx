"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ExternalLink, Search } from "lucide-react";
import { cn, stellarExplorerAccountUrl, shortenHash } from "@/lib/utils";
import type { Agent } from "@/lib/supabase";

const CATEGORIES = ["all", "travel", "finance", "research", "utilities", "other"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<string, string> = {
  travel:     "text-blue-400 border-blue-400/30 bg-blue-400/5",
  finance:    "text-green-400 border-green-400/30 bg-green-400/5",
  research:   "text-purple-400 border-purple-400/30 bg-purple-400/5",
  utilities:  "text-orange-400 border-orange-400/30 bg-orange-400/5",
  other:      "text-muted-foreground border-border bg-secondary/30",
};

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
    <div className="min-h-[calc(100vh-41px)] flex flex-col">

      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Agent Marketplace</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Public registry of x402-enabled AI agents on Stellar
              </p>
            </div>
          </div>
          <Link
            href="/marketplace/register"
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Agent
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize",
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${agents.length} agent${agents.length !== 1 ? "s" : ""} registered`}
          </p>
          <span className="text-[10px] font-mono text-muted-foreground/40 border border-border rounded px-2 py-1">
            x402 · Stellar Testnet
          </span>
        </div>

        {/* Agent grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border border-border rounded-lg p-5 bg-card animate-pulse">
                <div className="h-3 bg-secondary rounded w-2/3 mb-3" />
                <div className="h-2 bg-secondary rounded w-full mb-2" />
                <div className="h-2 bg-secondary rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-sm mb-2">No agents found</p>
            <Link href="/marketplace/register" className="text-xs text-primary hover:underline">
              Be the first to register one →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-sm font-medium text-foreground mb-1">Built an AI agent?</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
            Register it here with a Stellar address and set your price. The Boss Agent
            will automatically discover and pay it via x402.
          </p>
          <Link
            href="/marketplace/register"
            className="inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Register your agent
          </Link>
        </div>

      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="border border-border rounded-lg p-5 bg-card card-highlight hover:border-primary/20 transition-all duration-200 flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
          {agent.owner_name && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">by {agent.owner_name}</p>
          )}
        </div>
        <span className={cn(
          "shrink-0 text-[10px] font-medium border rounded px-1.5 py-0.5 capitalize",
          CATEGORY_COLORS[agent.category] ?? CATEGORY_COLORS.other,
        )}>
          {agent.category}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {agent.description}
      </p>

      {/* Price + address */}
      <div className="pt-3 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Price per request</span>
          <span className="text-xs font-mono text-success font-medium">{agent.price_usdc} USDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Stellar address</span>
          <a
            href={stellarExplorerAccountUrl(agent.stellar_address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors group"
          >
            {shortenHash(agent.stellar_address, 5)}
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Endpoint</span>
          <span className="text-[11px] font-mono text-muted-foreground/60 truncate max-w-[140px]">
            {agent.endpoint_url.replace(/^https?:\/\/[^/]+/, "")}
          </span>
        </div>
      </div>
    </div>
  );
}
