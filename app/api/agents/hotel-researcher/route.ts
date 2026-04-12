/**
 * Hotel Researcher Sub-Agent
 * x402 paywall: 0.30 USDC per request
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildPaymentRequired,
  verifyAndSettle,
  paymentRequiredResponse,
} from "@/lib/x402";

const PATH = "/api/agents/hotel-researcher";
const PRICE_USD = 0.3;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const paymentRequired = buildPaymentRequired(
    PRICE_USD,
    process.env.STELLAR_AGENT_HOTEL_PUBLIC_KEY!,
    PATH,
    "AI-powered hotel research service — finds best accommodation options",
  );

  if (!req.headers.get("payment-signature") && !req.headers.get("x-payment")) {
    return paymentRequiredResponse(paymentRequired);
  }

  const body = await req.json().catch(() => ({}));

  const result = await verifyAndSettle(req, paymentRequired);
  if (!result.ok) return result.response;
  const subtask: string = body.subtask ?? "Find hotels for a trip";

  console.log(`[hotel-researcher] paid & working — subtask: "${subtask.slice(0, 60)}"`);

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are a hotel research specialist. Research the following task and provide specific, actionable hotel options with estimated prices.

Task: ${subtask}

Output ONLY raw JSON (no markdown, no code fences), in this exact format:
{
  "summary": "One sentence summary of hotel options",
  "options": [
    { "name": "...", "location": "...", "estimatedPrice": "...", "rating": "...", "highlights": "..." }
  ],
  "tips": "One practical tip for booking"
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
    const jsonStart = stripped.indexOf("{"); const jsonEnd = stripped.lastIndexOf("}");
    const jsonStr = jsonStart !== -1 && jsonEnd !== -1 ? stripped.slice(jsonStart, jsonEnd + 1) : stripped;
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { summary: message.content[0].type === "text" ? message.content[0].text : "Research complete", options: [], tips: "" };
  }

  return Response.json(
    { agent: "hotel-researcher", price: PRICE_USD, result: parsed },
    { headers: { "X-Payment-Response": result.settleHeader } },
  );
}
