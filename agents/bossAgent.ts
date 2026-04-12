/**
 * Boss Agent
 *
 * Responsibilities:
 *  1. Fetch available agents from the Supabase registry (live, not hardcoded)
 *  2. Use Claude to decompose the user's task and select the best agents
 *  3. Call each agent via x402 (paying with USDC from boss wallet)
 *  4. Stream live events to the UI via the SSE emitter
 *  5. Pass all results to the Summarizer agent for final aggregation
 *  6. Return the final result
 */

import { emit } from "@/lib/emitter";
import { createX402Fetch } from "@/lib/x402";
import {
  fetchAvailableAgents,
  fetchSummarizer,
  selectAgentsForTask,
  getPlanByStripeSession,
  type AgentPlanItem,
} from "@/lib/agentPlanner";


const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  `http://localhost:${process.env.PORT ?? 3000}`;

export interface BossAgentInput {
  sessionId: string;   // Stripe checkout session ID
  task: string;
}

export interface BossAgentResult {
  summary: string;
  sections: { title: string; content: string }[];
}

interface SubTaskPlan {
  agent: string;
  endpoint: string;
  subtask: string;
  price: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveEndpoint(endpoint_url: string): string {
  if (endpoint_url.startsWith("http")) return endpoint_url;
  return `${APP_URL}${endpoint_url}`;
}

function planItemToSubTask(item: AgentPlanItem): SubTaskPlan {
  return {
    agent: item.name,
    endpoint: resolveEndpoint(item.endpoint_url),
    subtask: item.subtask,
    price: item.price_usdc,
  };
}

// ── Step 3: Call a sub-agent via x402 ────────────────────────────────────────

async function callSubAgent(
  fetchWithPay: typeof fetch,
  plan: SubTaskPlan,
  sessionId: string,
  extraBody: Record<string, unknown> = {},
): Promise<unknown> {
  emit(sessionId, {
    type: "agent_paying",
    agent: plan.agent,
    amount: String(plan.price),
  });

  const res = await fetchWithPay(plan.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subtask: plan.subtask, ...extraBody }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new Error(`${plan.agent} returned ${res.status}: ${errText.slice(0, 100)}`);
  }

  const data = await res.json() as { agent: string; price: number; result: unknown };

  // Extract tx hash from settlement header if present
  const settleHeader = res.headers.get("x-payment-response") ?? res.headers.get("X-Payment-Response");
  let txHash: string | undefined;
  if (settleHeader) {
    try {
      const { decodePaymentResponseHeader } = await import("@x402/core/http");
      const settled = decodePaymentResponseHeader(settleHeader) as Record<string, unknown>;
      // Try all known field names the facilitator might use
      txHash = (settled.transaction ?? settled.txHash ?? settled.txid ?? settled.hash) as string | undefined;
    } catch { /* no hash */ }
  }

  emit(sessionId, {
    type: "agent_paid",
    agent: plan.agent,
    amount: String(data.price ?? plan.price),
    txHash: txHash ?? undefined,
  });

  return data.result;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runBossAgent({
  sessionId,
  task,
}: BossAgentInput): Promise<BossAgentResult> {

  // ── Step 1: Load plan ─────────────────────────────────────────────────────
  emit(sessionId, { type: "planning_start" });

  const summarizer = await fetchSummarizer();
  let plans: SubTaskPlan[] = [];

  // Try to retrieve the pre-computed plan from Supabase (set during /api/agent/estimate)
  const storedPlanItems = await getPlanByStripeSession(sessionId);

  if (storedPlanItems && storedPlanItems.length > 0) {
    // Use stored plan — no need to run Claude again
    plans = storedPlanItems.map(planItemToSubTask);
    console.log(`[boss] using stored plan (${plans.length} agents) for session ${sessionId}`);
  } else {
    // Fallback: run fresh selection (no pre-computed plan found or expired)
    console.log(`[boss] no stored plan found — running fresh selection`);
    const availableAgents = await fetchAvailableAgents();
    const selected = await selectAgentsForTask(task, availableAgents);
    plans = selected.length > 0
      ? selected.map(planItemToSubTask)
      : availableAgents.slice(0, 2).map((a) => ({
          agent: a.name,
          endpoint: resolveEndpoint(a.endpoint_url),
          subtask: task,
          price: a.price_usdc,
        }));
  }

  emit(sessionId, {
    type: "planning",
    subtasks: plans.map((p) => ({ agent: p.agent, subtask: p.subtask })),
  });

  console.log(`[boss] planned ${plans.length} sub-tasks for session ${sessionId}`);

  // ── Step 2: Create x402-enabled fetch ─────────────────────────────────────
  const fetchWithPay = await createX402Fetch();

  // ── Step 3: Run sub-agents sequentially ───────────────────────────────────
  const agentResults: Record<string, unknown> = {};

  for (const plan of plans) {
    console.log(`[boss] calling ${plan.agent} at ${plan.endpoint}…`);
    try {
      const result = await callSubAgent(fetchWithPay, plan, sessionId);
      emit(sessionId, {
        type: "agent_done",
        agent: plan.agent,
        preview: extractPreview(result),
      });
      agentResults[plan.agent] = result;
    } catch (err) {
      console.error(`[boss] ${plan.agent} failed:`, err);
      emit(sessionId, {
        type: "agent_done",
        agent: plan.agent,
        preview: "Agent encountered an error — skipping.",
      });
      agentResults[plan.agent] = { error: String(err) };
    }
  }

  // ── Step 4: Summarizer aggregates all results ──────────────────────────────
  emit(sessionId, { type: "aggregating" });

  // Use registry summarizer if found, else fall back to built-in
  const summarizerEndpoint = summarizer
    ? resolveEndpoint(summarizer.endpoint_url)
    : `${APP_URL}/api/agents/summarizer`;

  const summarizerPlan: SubTaskPlan = {
    agent: "Summarizer",
    endpoint: summarizerEndpoint,
    subtask: "Synthesize all research into a complete, actionable response",
    price: summarizer?.price_usdc ?? 0.20,
  };

  let finalResult: BossAgentResult;

  try {
    const summaryData = await callSubAgent(
      fetchWithPay,
      summarizerPlan,
      sessionId,
      { task, agentResults },
    );

    emit(sessionId, {
      type: "agent_done",
      agent: "Summarizer",
      preview: extractPreview(summaryData),
    });

    const typed = summaryData as BossAgentResult;
    finalResult = {
      summary: typed.summary ?? "Task completed by agent team.",
      sections: Array.isArray(typed.sections) ? typed.sections : [],
    };
  } catch (err) {
    console.error("[boss] summarizer failed:", err);
    finalResult = buildFallbackResult(task, agentResults);
  }

  return finalResult;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function extractPreview(result: unknown): string {
  if (!result || typeof result !== "object") return String(result ?? "Done");
  const r = result as Record<string, unknown>;
  if (typeof r.summary === "string") return r.summary.slice(0, 120);
  const firstVal = Object.values(r)[0];
  if (typeof firstVal === "string") return firstVal.slice(0, 120);
  return "Research complete";
}

function buildFallbackResult(
  task: string,
  agentResults: Record<string, unknown>,
): BossAgentResult {
  const sections = Object.entries(agentResults).map(([agent, result]) => ({
    title: agent,
    content:
      typeof result === "object" && result !== null
        ? ((result as Record<string, unknown>).summary as string) ??
          JSON.stringify(result).slice(0, 300)
        : String(result),
  }));

  return {
    summary: `Your task "${task.slice(0, 80)}" has been researched by ${sections.length} specialized agents.`,
    sections,
  };
}
