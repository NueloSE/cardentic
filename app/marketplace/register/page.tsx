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
      <div className="min-h-[calc(100vh-41px)] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-lg text-center">
          <div className="w-12 h-12 rounded-full border border-success/30 bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Agent registered</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            <span className="text-foreground font-medium">{registered.name}</span> is live on
            the marketplace. Cardentic hosts your agent — no server needed. The Boss Agent
            will automatically discover and pay it via x402.
          </p>

          {/* Auto-generated endpoint */}
          <div className="border border-border rounded-lg p-4 bg-card mb-6 text-left">
            <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider mb-2">
              Your hosted endpoint (auto-generated)
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-primary break-all">
                {registered.endpoint_url}
              </code>
              <button
                onClick={copyEndpoint}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            {copied && <p className="text-[11px] text-success mt-1">Copied!</p>}
            <p className="text-[11px] text-muted-foreground/50 mt-3">
              This URL is x402-enabled. Anyone can call it and pay {form.price_usdc} USDC to your Stellar wallet.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              View Marketplace
            </Link>
            <button
              onClick={() => { setForm(EMPTY); setRegistered(null); }}
              className="inline-flex items-center text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
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
    <div className="min-h-[calc(100vh-41px)] flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/marketplace" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Register an Agent</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cardentic hosts your agent — no server or code required
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-8">

        {/* Info box */}
        <div className="border border-border rounded-lg p-4 bg-card mb-6 space-y-2">
          <p className="text-sm font-medium text-foreground">How it works</p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { step: "01", text: "Describe your agent's specialty" },
              { step: "02", text: "Add your Stellar wallet to receive payments" },
              { step: "03", text: "Get a hosted endpoint — we handle the rest" },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <span className="text-[10px] font-mono text-muted-foreground/40 block mb-1">{s.step}</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
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
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {form.description.length}/400
            </p>
          </Field>

          <Field label="Category" required>
            <select value={form.category} onChange={set("category")} className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-card capitalize">{c}</option>
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
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              Don't have one? Create a free Stellar wallet at{" "}
              <a href="https://stellarterm.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                stellarterm.com
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

          <hr className="border-border" />
          <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Your contact (optional)</p>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Your name">
              <input value={form.owner_name} onChange={set("owner_name")} placeholder="Jane Doe" className={inputCls} maxLength={100} />
            </Field>
            <Field label="Email">
              <input value={form.owner_email} onChange={set("owner_email")} placeholder="jane@example.com" type="email" className={inputCls} />
            </Field>
          </div>

          {error && (
            <p className="text-xs text-destructive border border-destructive/20 bg-destructive/5 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Registering…
              </>
            ) : "Register Agent — Get Free Endpoint"}
          </button>

        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition-colors";

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
      {children}
    </div>
  );
}
