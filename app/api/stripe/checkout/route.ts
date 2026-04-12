import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSession } from "@/lib/session";
import { attachStripeSession } from "@/lib/agentPlanner";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

/** Derive base URL from the incoming request — works on any port automatically. */
function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const APP_URL = getBaseUrl(req);
    const body = await req.json();
    const task: string = (body.task ?? "").trim();
    const planId: string = (body.planId ?? "").trim();

    if (!task || task.length < 5) {
      return NextResponse.json({ error: "Task is required." }, { status: 400 });
    }

    if (task.length > 500) {
      return NextResponse.json({ error: "Task must be under 500 characters." }, { status: 400 });
    }

    // Look up the pre-computed plan for the dynamic amount
    let chargeCents = 1000; // fallback: $10.00
    let chargeUsd = 10.0;
    let planDescription = task.length > 80 ? task.slice(0, 80) + "…" : task;

    if (planId) {
      const { data: plan } = await supabaseAdmin
        .from("task_plans")
        .select("charge_usd, agents")
        .eq("id", planId)
        .single();

      if (plan) {
        chargeUsd = plan.charge_usd;
        chargeCents = Math.round(plan.charge_usd * 100);
        const agentNames = (plan.agents as { name: string }[]).map((a) => a.name).join(", ");
        planDescription = `${agentNames} — ${planDescription}`;
      }
    }

    // Create Stripe Checkout Session with dynamic amount
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: chargeCents,
            product_data: {
              name: "Cardentic Agent Task",
              description: planDescription,
              images: [],
            },
          },
          quantity: 1,
        },
      ],
      metadata: { task, planId },
      success_url: `${APP_URL}/process/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/?cancelled=true`,
      payment_intent_data: {
        description: `Cardentic task: ${task.slice(0, 100)}`,
      },
    });

    // Create our session record
    createSession(checkoutSession.id, task, chargeCents);

    // Link the plan to this Stripe session
    if (planId) {
      await attachStripeSession(planId, checkoutSession.id);
    }

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      chargeUsd,
    });
  } catch (err) {
    console.error("[stripe/checkout] error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
