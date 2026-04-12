/**
 * Hosted Agent Endpoint
 * GET  /api/hosted/[agentId]  — returns agent info (public)
 * POST /api/hosted/[agentId]  — x402-gated AI agent, hosted by Cardentic
 *
 * Any agent registered via the marketplace gets a free hosted endpoint here.
 * The Boss Agent calls this URL, pays via x402 to the agent's Stellar address,
 * and gets a Claude-powered response scoped to the agent's description.
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import {
  buildPaymentRequired,
  verifyAndSettle,
  paymentRequiredResponse,
} from "@/lib/x402";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── GET — public agent info ────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { agentId: string } },
) {
  const { data, error } = await supabase
    .from("agents")
    .select("id, name, description, category, price_usdc, stellar_address, owner_name, is_active")
    .eq("id", params.agentId)
    .single();

  if (error || !data) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  return Response.json(data);
}

// ── POST — x402-gated execution ───────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } },
) {
  // Look up agent config from Supabase
  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", params.agentId)
    .eq("is_active", true)
    .single();

  if (fetchError || !agent) {
    return Response.json({ error: "Agent not found or inactive" }, { status: 404 });
  }

  const path = `/api/hosted/${params.agentId}`;

  // Build x402 payment requirement using the agent's own Stellar address + price
  const paymentRequired = buildPaymentRequired(
    agent.price_usdc,
    agent.stellar_address,
    path,
    `${agent.name} — ${agent.description}`,
  );

  // Return 402 if no payment header
  if (!req.headers.get("payment-signature") && !req.headers.get("x-payment")) {
    return paymentRequiredResponse(paymentRequired);
  }

  // Parse body before verifyAndSettle (stream can only be read once)
  const body = await req.json().catch(() => ({}));

  // Verify and settle payment
  const result = await verifyAndSettle(req, paymentRequired);
  if (!result.ok) return result.response;

  const subtask: string = body.subtask ?? body.task ?? "Help the user";

  console.log(`[hosted/${params.agentId}] "${agent.name}" paid & working — subtask: "${subtask.slice(0, 60)}"`);

  // Run Claude scoped to this agent's specialty
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `You are a specialized AI agent: ${agent.name}.

Your specialty: ${agent.description}

Task assigned to you: ${subtask}

Output ONLY raw JSON (no markdown, no code fences) with this structure:
{
  "summary": "One sentence summary of your findings",
  "result": "Detailed response covering the task thoroughly",
  "tips": "One practical actionable tip"
}`,
      },
      { role: "assistant", content: "{" },
    ],
  });

  let parsed;
  try {
    const partial = message.content[0].type === "text" ? message.content[0].text : "}";
    const raw = "{" + partial;
    const stripped = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const s = stripped.indexOf("{");
    const e = stripped.lastIndexOf("}");
    parsed = JSON.parse(s !== -1 && e !== -1 ? stripped.slice(s, e + 1) : stripped);
  } catch {
    const text = message.content[0].type === "text" ? message.content[0].text : "Done";
    parsed = { summary: text.slice(0, 120), result: text, tips: "" };
  }

  return Response.json(
    { agent: agent.name, price: agent.price_usdc, result: parsed },
    { headers: { "X-Payment-Response": result.settleHeader } },
  );
}
