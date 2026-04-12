/**
 * Test-only endpoint — triggers the agent pipeline directly without Stripe.
 * Used by scripts/test-pipeline.mjs to validate the full pipeline end-to-end.
 *
 * NOT for production use. Only enabled in development.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession, createSession } from "@/lib/session";
import { emit } from "@/lib/emitter";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { sessionId, task } = await req.json();

  if (!sessionId || !task) {
    return NextResponse.json({ error: "sessionId and task are required" }, { status: 400 });
  }

  let session = getSession(sessionId);
  if (!session) {
    session = createSession(sessionId, task, 1000);
  }

  updateSession(sessionId, { status: "paid" });
  emit(sessionId, { type: "session_start", task, amount: "10.00", status: "paid" });

  console.log(`[test/trigger-pipeline] triggering pipeline for session ${sessionId}`);

  // Fire off the pipeline async — respond immediately
  runPipeline(sessionId, task).catch((err) => {
    console.error(`[test/trigger-pipeline] pipeline error:`, err);
    updateSession(sessionId, { status: "error", error: String(err) });
    emit(sessionId, { type: "error", message: String(err) });
  });

  return NextResponse.json({ ok: true, sessionId });
}

async function runPipeline(sessionId: string, task: string) {
  const { fundBossAgent } = await import("@/lib/stellar");
  const { runBossAgent } = await import("@/agents/bossAgent");

  updateSession(sessionId, { status: "funding" });
  emit(sessionId, { type: "funding" });

  const txHash = await fundBossAgent(10);

  updateSession(sessionId, { status: "funded", fundingTxHash: txHash });
  emit(sessionId, { type: "funded", txHash });

  updateSession(sessionId, { status: "running" });

  const result = await runBossAgent({ sessionId, task });

  updateSession(sessionId, { status: "complete", result });
  emit(sessionId, { type: "complete", result });
}
