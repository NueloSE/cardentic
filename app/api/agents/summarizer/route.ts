/**
 * Summarizer Sub-Agent
 * x402 paywall: 0.20 USDC per request
 * Combines all sub-agent results into a polished final output.
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildPaymentRequired,
  verifyAndSettle,
  paymentRequiredResponse,
} from "@/lib/x402";

const PATH = "/api/agents/summarizer";
const PRICE_USD = 0.2;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const paymentRequired = buildPaymentRequired(
    PRICE_USD,
    process.env.STELLAR_AGENT_SUMMARIZER_PUBLIC_KEY!,
    PATH,
    "AI synthesis service — aggregates research into actionable final output",
  );

  if (!req.headers.get("payment-signature") && !req.headers.get("x-payment")) {
    return paymentRequiredResponse(paymentRequired);
  }

  const body = await req.json().catch(() => ({}));

  const result = await verifyAndSettle(req, paymentRequired);
  if (!result.ok) return result.response;
  const task: string = body.task ?? "";
  const agentResults: Record<string, unknown> = body.agentResults ?? {};

  console.log(`[summarizer] paid & working — task: "${task.slice(0, 60)}"`);

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a synthesis specialist. Combine the following research from multiple AI agents into a clear, actionable final report for the user.

Original task: ${task}

Research collected:
${JSON.stringify(agentResults, null, 2)}

Write a comprehensive, well-structured response. Use clear sections. Be specific and actionable.
Output ONLY raw JSON (no markdown, no code fences), in this exact format:
{
  "summary": "2-3 sentence executive summary of the complete plan",
  "sections": [
    { "title": "Section title", "content": "Detailed content for this section" }
  ]
}

Include 3-5 sections covering the key aspects of the task.`,
      },
      {
        role: "assistant",
        content: "{",
      },
    ],
  });

  let parsed;
  try {
    // Prepend "{" because we used it as assistant prefill to avoid markdown wrapping
    const partial = message.content[0].type === "text" ? message.content[0].text : "}";
    const raw = "{" + partial;
    const stripped = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const jsonStart = stripped.indexOf("{");
    const jsonEnd = stripped.lastIndexOf("}");
    const jsonStr = jsonStart !== -1 && jsonEnd !== -1 ? stripped.slice(jsonStart, jsonEnd + 1) : stripped;
    parsed = JSON.parse(jsonStr);
  } catch {
    const partial = message.content[0].type === "text" ? message.content[0].text : "Complete";
    parsed = {
      summary: "Your task has been completed by the agent team.",
      sections: [{ title: "Result", content: partial }],
    };
  }

  return Response.json(
    { agent: "summarizer", price: PRICE_USD, result: parsed },
    { headers: { "X-Payment-Response": result.settleHeader } },
  );
}
