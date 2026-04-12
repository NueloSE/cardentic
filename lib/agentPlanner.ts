/**
 * Shared agent planning logic.
 * Used by both /api/agent/estimate (pre-payment) and bossAgent (post-payment).
 * Extracted so we don't run Claude twice for the same task.
 */

import Anthropic from "@anthropic-ai/sdk";
import { supabase, supabaseAdmin, type Agent } from "./supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLATFORM_FEE_USDC = 0.50; // flat platform fee added to every task

export interface AgentPlanItem {
  name: string;
  endpoint_url: string;
  subtask: string;
  price_usdc: number;
}

export interface TaskEstimate {
  planId: string;
  task: string;
  agents: AgentPlanItem[];
  subtotal_usdc: number;       // sum of agent prices
  platform_fee_usdc: number;   // flat platform fee
  total_usdc: number;          // subtotal + platform fee
  charge_usd: number;          // what Stripe will charge (in USD cents → dollars)
  charge_cents: number;        // Stripe amount in cents
}

// ── Registry helpers ──────────────────────────────────────────────────────────

export async function fetchAvailableAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("is_active", true)
    .neq("name", "Summarizer")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[agentPlanner] failed to fetch agents:", error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchSummarizer(): Promise<Agent | null> {
  const { data } = await supabase
    .from("agents")
    .select("*")
    .eq("name", "Summarizer")
    .eq("is_active", true)
    .single();
  return data ?? null;
}

// ── Claude selection ──────────────────────────────────────────────────────────

export async function selectAgentsForTask(
  task: string,
  availableAgents: Agent[],
): Promise<AgentPlanItem[]> {
  if (availableAgents.length === 0) return [];

  const agentList = availableAgents
    .map((a) => `- "${a.name}" (${a.category}, ${a.price_usdc} USDC): ${a.description}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are a task planning agent. Select the best AI agents to handle the user's task.

User task: "${task}"

Available agents:
${agentList}

Select 2-4 agents most relevant to this task. Only include agents genuinely needed.
For each, write a specific focused sub-task (1 sentence).

Output ONLY a JSON array (no markdown):
[
  { "agent": "exact agent name", "subtask": "specific sub-task for this agent" }
]`,
      },
      { role: "assistant", content: "[" },
    ],
  });

  const partial = message.content[0].type === "text" ? message.content[0].text : "]";
  let plans: { agent: string; subtask: string }[] = [];
  try {
    const raw = "[" + partial;
    const s = raw.indexOf("["); const e = raw.lastIndexOf("]");
    plans = JSON.parse(s !== -1 && e !== -1 ? raw.slice(s, e + 1) : raw);
  } catch { plans = []; }

  return plans
    .map((p) => {
      const reg = availableAgents.find(
        (a) => a.name.toLowerCase() === p.agent.toLowerCase(),
      );
      if (!reg) return null;
      return {
        name: reg.name,
        endpoint_url: reg.endpoint_url,
        subtask: p.subtask,
        price_usdc: reg.price_usdc,
      };
    })
    .filter(Boolean) as AgentPlanItem[];
}

// ── Plan persistence ──────────────────────────────────────────────────────────

/** Create a task plan in Supabase and return the full estimate */
export async function createTaskPlan(
  task: string,
  agents: AgentPlanItem[],
): Promise<TaskEstimate> {
  const subtotal = agents.reduce((sum, a) => sum + a.price_usdc, 0);
  const total = parseFloat((subtotal + PLATFORM_FEE_USDC).toFixed(2));
  // Charge in USD = total USDC (1:1 for testnet). Minimum $1.00.
  const charge_usd = Math.max(total, 1.0);
  const charge_cents = Math.round(charge_usd * 100);

  const { data, error } = await supabaseAdmin
    .from("task_plans")
    .insert({
      task,
      agents: agents as unknown as Record<string, unknown>[],
      total_usdc: total,
      platform_fee_usdc: PLATFORM_FEE_USDC,
      charge_usd,
      status: "pending",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error("Failed to save task plan: " + error?.message);
  }

  return {
    planId: data.id,
    task,
    agents,
    subtotal_usdc: subtotal,
    platform_fee_usdc: PLATFORM_FEE_USDC,
    total_usdc: total,
    charge_usd,
    charge_cents,
  };
}

/** Link a Stripe session ID to a plan after checkout is created */
export async function attachStripeSession(planId: string, stripeSessionId: string) {
  await supabaseAdmin
    .from("task_plans")
    .update({ stripe_session_id: stripeSessionId, status: "checkout" })
    .eq("id", planId);
}

/** Retrieve a stored plan by Stripe session ID */
export async function getPlanByStripeSession(
  stripeSessionId: string,
): Promise<AgentPlanItem[] | null> {
  const { data } = await supabaseAdmin
    .from("task_plans")
    .select("*")
    .eq("stripe_session_id", stripeSessionId)
    .eq("status", "checkout")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!data) return null;

  // Mark as paid so it can't be replayed
  await supabaseAdmin
    .from("task_plans")
    .update({ status: "paid" })
    .eq("id", data.id);

  return data.agents as unknown as AgentPlanItem[];
}
