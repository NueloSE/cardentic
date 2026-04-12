/**
 * POST /api/agent/estimate
 * Pre-payment: selects agents for a task and returns cost breakdown.
 * Stores the plan in Supabase so Boss Agent can retrieve it after payment.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchAvailableAgents,
  selectAgentsForTask,
  createTaskPlan,
} from "@/lib/agentPlanner";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const task: string = body?.task?.trim() ?? "";

  if (!task || task.length < 5) {
    return NextResponse.json({ error: "task is required (min 5 chars)" }, { status: 400 });
  }

  if (task.length > 500) {
    return NextResponse.json({ error: "task too long (max 500 chars)" }, { status: 400 });
  }

  try {
    // 1. Fetch all available agents from registry
    const availableAgents = await fetchAvailableAgents();

    // 2. Use Claude to select the right agents + generate subtasks
    let selectedAgents = await selectAgentsForTask(task, availableAgents);

    // Fallback: use first 2 agents if Claude selection fails
    if (selectedAgents.length === 0 && availableAgents.length > 0) {
      selectedAgents = availableAgents.slice(0, 2).map((a) => ({
        name: a.name,
        endpoint_url: a.endpoint_url,
        subtask: task,
        price_usdc: a.price_usdc,
      }));
    }

    // 3. Persist plan + calculate cost
    const estimate = await createTaskPlan(task, selectedAgents);

    console.log(
      `[estimate] planId=${estimate.planId} agents=${selectedAgents.map((a) => a.name).join(", ")} total=$${estimate.charge_usd}`,
    );

    return NextResponse.json(estimate);
  } catch (err) {
    console.error("[estimate] error:", err);
    return NextResponse.json({ error: "Failed to estimate task cost" }, { status: 500 });
  }
}
