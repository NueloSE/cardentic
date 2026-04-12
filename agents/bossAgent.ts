/**
 * Boss Agent
 *
 * Responsibilities:
 *  1. Use Claude to decompose the user's task into sub-tasks
 *  2. Assign each sub-task to a specialized sub-agent endpoint
 *  3. Call each endpoint via x402 (paying with USDC from boss wallet)
 *  4. Stream live events to the UI via the SSE emitter
 *  5. Pass all results to the Summarizer agent
 *  6. Return the final aggregated result
 */

import Anthropic from "@anthropic-ai/sdk";
import { emit } from "@/lib/emitter";
import { createX402Fetch } from "@/lib/x402";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Use NEXT_PUBLIC_APP_URL if set, otherwise fall back to whatever port Next.js is running on.
// process.env.PORT is set automatically by Next.js (e.g. 3001 if 3000 was taken).
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  `http://localhost:${process.env.PORT ?? 3000}`;

export interface BossAgentInput {
  sessionId: string;
  task: string;
}

export interface BossAgentResult {
  summary: string;
  sections: { title: string; content: string }[];
}

// Map task keywords → which agents to use
const AGENT_REGISTRY = [
  {
    name: "Flight Researcher",
    endpoint: "/api/agents/flight-researcher",
    triggers: ["flight", "travel", "trip", "visit", "destination", "airport", "airline"],
  },
  {
    name: "Hotel Researcher",
    endpoint: "/api/agents/hotel-researcher",
    triggers: ["hotel", "stay", "accommodation", "lodge", "hostel", "airbnb", "room", "trip", "travel", "visit"],
  },
  {
    name: "Activity Planner",
    endpoint: "/api/agents/activity-planner",
    triggers: ["activity", "things to do", "experience", "food", "restaurant", "sightseeing", "trip", "travel", "visit", "plan"],
  },
  {
    name: "Summarizer",
    endpoint: "/api/agents/summarizer",
    triggers: ["*"], // always included — final aggregation step
  },
];

interface SubTaskPlan {
  agent: string;
  endpoint: string;
  subtask: string;
}

/** Strip markdown code fences and parse JSON safely */
function parseJSON<T>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

/**
 * Use Claude to decompose the task into sub-tasks and select agents.
 */
async function planSubTasks(task: string): Promise<SubTaskPlan[]> {
  const agentList = AGENT_REGISTRY.filter((a) => a.name !== "Summarizer")
    .map((a) => `- ${a.name}: ${a.triggers.slice(0, 4).join(", ")}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are a task planning agent. Break the following user task into sub-tasks for specialized AI agents.

User task: "${task}"

Available agents:
${agentList}

Select 2-3 relevant agents (always include at least 2). For each, write a specific sub-task focused on that agent's specialty.

Respond ONLY with a JSON array, no other text:
[
  { "agent": "Agent Name", "subtask": "specific sub-task description" }
]`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const plans = parseJSON<{ agent: string; subtask: string }[]>(text, []);

  // Map agent names to endpoints, filter valid ones
  return plans
    .map((p) => {
      const reg = AGENT_REGISTRY.find((a) => a.name === p.agent);
      if (!reg) return null;
      return { agent: p.agent, endpoint: reg.endpoint, subtask: p.subtask };
    })
    .filter(Boolean) as SubTaskPlan[];
}

/**
 * Call a sub-agent endpoint with x402 payment.
 * Emits SSE events before and after payment.
 */
async function callSubAgent(
  fetchWithPay: typeof fetch,
  plan: SubTaskPlan,
  sessionId: string,
  extraBody: Record<string, unknown> = {},
): Promise<unknown> {
  // Notify UI: payment starting
  emit(sessionId, {
    type: "agent_paying",
    agent: plan.agent,
    amount: plan.agent === "Summarizer" ? "0.20" : plan.agent.includes("Researcher") ? "0.30" : "0.20",
  });

  const res = await fetchWithPay(`${APP_URL}${plan.endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subtask: plan.subtask, ...extraBody }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new Error(`${plan.agent} returned ${res.status}: ${errText.slice(0, 100)}`);
  }

  const data = await res.json() as { agent: string; price: number; result: unknown };

  // Extract tx hash from X-Payment-Response header if available
  const settleHeader = res.headers.get("x-payment-response");
  let txHash: string | undefined;
  if (settleHeader) {
    try {
      const { decodePaymentResponseHeader } = await import("@x402/core/http");
      const settled = decodePaymentResponseHeader(settleHeader);
      txHash = (settled as Record<string, unknown>).transaction as string | undefined;
    } catch { /* no hash available */ }
  }

  // Notify UI: paid + working
  emit(sessionId, {
    type: "agent_paid",
    agent: plan.agent,
    amount: String(data.price ?? "0.20"),
    txHash: txHash ?? "",
  });

  return data.result;
}

/**
 * Main Boss Agent entry point.
 */
export async function runBossAgent({
  sessionId,
  task,
}: BossAgentInput): Promise<BossAgentResult> {
  // ── Step 1: Plan sub-tasks ─────────────────────────────────────────────────
  emit(sessionId, { type: "planning_start" });

  const plans = await planSubTasks(task);

  // Ensure we always have at least basic agents for travel tasks
  if (plans.length === 0) {
    plans.push(
      { agent: "Flight Researcher", endpoint: "/api/agents/flight-researcher", subtask: task },
      { agent: "Hotel Researcher", endpoint: "/api/agents/hotel-researcher", subtask: task },
    );
  }

  emit(sessionId, {
    type: "planning",
    subtasks: plans.map((p) => ({ agent: p.agent, subtask: p.subtask })),
  });

  console.log(`[boss] planned ${plans.length} sub-tasks for session ${sessionId}`);

  // ── Step 2: Create x402-enabled fetch ──────────────────────────────────────
  const fetchWithPay = await createX402Fetch();

  // ── Step 3: Run sub-agents sequentially (boss pays each via x402) ──────────
  const agentResults: Record<string, unknown> = {};

  for (const plan of plans) {
    console.log(`[boss] calling ${plan.agent}…`);
    try {
      const result = await callSubAgent(fetchWithPay, plan, sessionId);

      // Notify UI: agent done
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

  const summarizerPlan: SubTaskPlan = {
    agent: "Summarizer",
    endpoint: "/api/agents/summarizer",
    subtask: "Synthesize all research into a complete, actionable response",
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
    // Fallback: build a basic result from agent outputs
    finalResult = buildFallbackResult(task, agentResults);
  }

  return finalResult;
}

/** Extract a one-line preview string from any agent result */
function extractPreview(result: unknown): string {
  if (!result || typeof result !== "object") return String(result ?? "Done");
  const r = result as Record<string, unknown>;
  if (typeof r.summary === "string") return r.summary.slice(0, 120);
  const firstVal = Object.values(r)[0];
  if (typeof firstVal === "string") return firstVal.slice(0, 120);
  return "Research complete";
}

/** Build a basic result if the summarizer fails */
function buildFallbackResult(
  task: string,
  agentResults: Record<string, unknown>,
): BossAgentResult {
  const sections = Object.entries(agentResults).map(([agent, result]) => ({
    title: agent,
    content:
      typeof result === "object" && result !== null
        ? ((result as Record<string, unknown>).summary as string) ?? JSON.stringify(result).slice(0, 300)
        : String(result),
  }));

  return {
    summary: `Your task "${task.slice(0, 80)}" has been researched by ${sections.length} specialized agents.`,
    sections,
  };
}
