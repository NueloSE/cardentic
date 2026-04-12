import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSession, updateSession, createSession } from "@/lib/session";
import { emit } from "@/lib/emitter";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const sessionId = checkoutSession.id;
    const task = checkoutSession.metadata?.task ?? "";
    const amountTotal = checkoutSession.amount_total ?? 1000;

    let session = getSession(sessionId);
    if (!session) {
      session = createSession(sessionId, task, amountTotal);
    }

    updateSession(sessionId, { status: "paid" });

    // Confirm payment to the UI immediately
    emit(sessionId, {
      type: "session_start",
      task,
      amount: (amountTotal / 100).toFixed(2),
      status: "paid",
    });

    console.log(`[stripe/webhook] ${sessionId} paid — task: "${task.slice(0, 60)}"`);

    // Kick off the pipeline in the background — respond to Stripe instantly
    triggerAgentPipeline(sessionId, task).catch((err) => {
      console.error(`[stripe/webhook] pipeline error for ${sessionId}:`, err);
      updateSession(sessionId, { status: "error", error: String(err) });
      emit(sessionId, { type: "error", message: String(err) });
    });
  }

  return NextResponse.json({ received: true });
}

async function triggerAgentPipeline(sessionId: string, task: string) {
  const { fundBossAgent } = await import("@/lib/stellar");
  const { runBossAgent } = await import("@/agents/bossAgent");

  // ── Step 1: Fund boss agent ──────────────────────────────────────────────
  updateSession(sessionId, { status: "funding" });
  emit(sessionId, { type: "funding" });

  const txHash = await fundBossAgent(10);

  updateSession(sessionId, { status: "funded", fundingTxHash: txHash });
  emit(sessionId, { type: "funded", txHash });

  // ── Step 2: Run boss agent (it emits its own events via emit()) ──────────
  updateSession(sessionId, { status: "running" });

  const result = await runBossAgent({ sessionId, task });

  updateSession(sessionId, { status: "complete", result });
  emit(sessionId, { type: "complete", result });
}
