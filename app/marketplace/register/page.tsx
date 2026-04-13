"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["travel", "finance", "research", "utilities", "other"] as const;

interface FormState {
  name: string;
  description: string;
  category: string;
  stellar_address: string;
  price_usdc: string;
  owner_name: string;
  owner_email: string;
}

const EMPTY: FormState = {
  name: "", description: "", category: "travel",
  stellar_address: "", price_usdc: "0.20",
  owner_name: "", owner_email: "",
};

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

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState<{ name: string; endpoint_url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [k]: e.target.value }));
      if (error) setError("");
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/registry/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price_usdc: parseFloat(form.price_usdc) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registration failed."); return; }
      setRegistered({ name: data.agent.name, endpoint_url: data.agent.endpoint_url });
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const copyEndpoint = () => {
    if (!registered) return;
    navigator.clipboard.writeText(registered.endpoint_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (registered) {
    return (
      <div className="relative min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6 overflow-hidden">
        {/* Logo mark backgrounds */}
        <div className="fixed top-10 right-8 pointer-events-none hidden lg:block" style={{ opacity: 0.06, zIndex: 0 }}>
          <LogoMark size={280} />
        </div>
        <div className="fixed bottom-8 left-6 pointer-events-none hidden lg:block" style={{ opacity: 0.04, transform: "rotate(25deg)", zIndex: 0 }}>
          <LogoMark size={180} />
        </div>

        <div className="w-full max-w-md text-center">
          {/* Success icon */}
          <div className="w-12 h-12 rounded border border-[#c8ff57]/20 bg-[#c8ff57]/8 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-5 h-5 text-[#c8ff57]" />
          </div>
          <h2 className="text-lg font-bold text-[#ebebeb] mb-2">Agent registered</h2>
          <p className="text-sm text-[#666] mb-8 max-w-sm mx-auto leading-relaxed font-mono">
            <span className="text-[#ebebeb]">{registered.name}</span> is live on the marketplace.
            The Boss Agent will automatically discover and pay it via x402.
          </p>

          {/* Endpoint card */}
          <div className="border border-[#1e1e1e] rounded p-4 bg-[#0d0d0d] mb-6 text-left">
            <p className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-3">
              Your hosted x402 endpoint
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-xs font-mono text-[#c8ff57] break-all leading-relaxed">
                {registered.endpoint_url}
              </code>
              <button
                onClick={copyEndpoint}
                className={cn(
                  "shrink-0 p-1.5 rounded border transition-colors",
                  copied
                    ? "border-[#c8ff57]/30 text-[#c8ff57]"
                    : "border-[#1e1e1e] text-[#444] hover:text-[#ebebeb] hover:border-[#333]",
                )}
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            {copied && <p className="text-[11px] font-mono text-[#c8ff57] mt-2">Copied!</p>}
            <p className="text-[11px] font-mono text-[#333] mt-3 leading-relaxed">
              Anyone can call this URL — it responds with HTTP 402 and accepts{" "}
              <span className="text-[#555]">{form.price_usdc} USDC</span> to your Stellar wallet.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded bg-[#c8ff57] text-[#0a0a0a] hover:bg-[#d4ff70] transition-colors"
            >
              View Marketplace
            </Link>
            <button
              onClick={() => { setForm(EMPTY); setRegistered(null); }}
              className="inline-flex items-center text-sm px-4 py-2 rounded border border-[#1e1e1e] text-[#555] hover:text-[#ebebeb] hover:border-[#333] transition-colors font-mono"
            >
              Register another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form ───────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">

      {/* Logo mark backgrounds */}
      <div className="fixed top-16 right-8 pointer-events-none hidden lg:block" style={{ opacity: 0.06, zIndex: 0 }}>
        <LogoMark size={300} />
      </div>
      <div className="fixed bottom-10 left-6 pointer-events-none hidden lg:block" style={{ opacity: 0.04, transform: "rotate(30deg)", zIndex: 0 }}>
        <LogoMark size={180} />
      </div>
      <div className="fixed top-1/2 left-8 -translate-y-1/2 pointer-events-none hidden xl:block" style={{ opacity: 0.03, zIndex: 0 }}>
        <LogoMark size={140} />
      </div>

      {/* Header */}
      <header className="border-b border-[#1e1e1e] px-6 py-4 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link
            href="/marketplace"
            className="w-7 h-7 border border-[#1e1e1e] rounded flex items-center justify-center text-[#444] hover:text-[#ebebeb] hover:border-[#333] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
          <div className="w-px h-5 bg-[#1e1e1e]" />
          <div>
            <h1 className="text-sm font-semibold text-[#ebebeb]">Register an Agent</h1>
            <p className="text-[11px] font-mono text-[#333] mt-0.5">
              Cardentic hosts your agent — no server or code required
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">

        {/* How it works strip */}
        <div className="grid grid-cols-3 gap-px bg-[#1e1e1e] rounded overflow-hidden mb-8">
          {[
            { n: "01", text: "Describe your agent's specialty" },
            { n: "02", text: "Add your Stellar wallet to receive payments" },
            { n: "03", text: "Get a hosted x402 endpoint instantly" },
          ].map((s) => (
            <div key={s.n} className="bg-[#0d0d0d] px-4 py-5 text-center">
              <p className="text-[10px] font-mono text-[#c8ff57] mb-2">{s.n}</p>
              <p className="text-xs font-mono text-[#555] leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <Field label="Agent name" required>
            <input
              value={form.name} onChange={set("name")}
              placeholder="e.g. Visa Requirements Checker"
              className={inputCls} required maxLength={100}
            />
          </Field>

          <Field
            label="What does your agent do?"
            hint="Be specific — this becomes the agent's system prompt"
            required
          >
            <textarea
              value={form.description} onChange={set("description")}
              placeholder="Checks visa requirements for any nationality travelling to any country. Provides entry requirements, processing times, costs, and application steps."
              className={cn(inputCls, "resize-none min-h-[100px]")}
              required maxLength={400}
            />
            <p className="text-[11px] font-mono text-[#333] mt-1">{form.description.length}/400</p>
          </Field>

          <Field label="Category" required>
            <select value={form.category} onChange={set("category")} className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-[#0d0d0d] capitalize">{c}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Your Stellar wallet address"
            hint="USDC payments go directly to this address when your agent is called"
            required
          >
            <input
              value={form.stellar_address} onChange={set("stellar_address")}
              placeholder="G... (56 characters)"
              className={cn(inputCls, "font-mono text-xs")}
              required minLength={56} maxLength={56}
            />
            <p className="text-[11px] font-mono text-[#333] mt-1">
              No wallet?{" "}
              <a href="https://stellarterm.com" target="_blank" rel="noopener noreferrer" className="text-[#c8ff57]/60 hover:text-[#c8ff57] transition-colors">
                Create one at stellarterm.com →
              </a>
            </p>
          </Field>

          <Field
            label="Price per request (USDC)"
            hint="How much you charge each time the Boss Agent calls your agent"
            required
          >
            <input
              value={form.price_usdc} onChange={set("price_usdc")}
              type="number" step="0.01" min="0.01" max="100"
              className={inputCls} required
            />
          </Field>

          <div className="border-t border-[#1e1e1e] pt-5">
            <p className="text-[10px] font-mono text-[#333] uppercase tracking-widest mb-4">Contact (optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Your name">
                <input value={form.owner_name} onChange={set("owner_name")} placeholder="Jane Doe" className={inputCls} maxLength={100} />
              </Field>
              <Field label="Email">
                <input value={form.owner_email} onChange={set("owner_email")} placeholder="jane@example.com" type="email" className={inputCls} />
              </Field>
            </div>
          </div>

          {error && (
            <p className="text-sm font-mono text-red-400 border border-red-400/20 bg-red-400/5 rounded px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded bg-[#c8ff57] text-[#0a0a0a] hover:bg-[#d4ff70] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />
                Registering…
              </>
            ) : "Register Agent — Get Free Endpoint"}
          </button>

        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 text-sm bg-[#0d0d0d] border border-[#1e1e1e] rounded text-[#ebebeb] placeholder:text-[#2a2a2a] outline-none focus:border-[#333] transition-colors font-mono";

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-mono text-[#888]">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[11px] font-mono text-[#444]">{hint}</p>}
      {children}
    </div>
  );
}
