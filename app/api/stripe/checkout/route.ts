import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSession } from "@/lib/session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const AMOUNT = Number(process.env.STRIPE_PAYMENT_AMOUNT ?? 1000); // cents

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

    if (!task || task.length < 5) {
      return NextResponse.json({ error: "Task is required." }, { status: 400 });
    }

    if (task.length > 500) {
      return NextResponse.json({ error: "Task must be under 500 characters." }, { status: 400 });
    }

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: AMOUNT,
            product_data: {
              name: "Cardentic Agent Task",
              description: task.length > 80 ? task.slice(0, 80) + "…" : task,
              images: [],
            },
          },
          quantity: 1,
        },
      ],
      // Pass task in metadata so the webhook can retrieve it
      metadata: { task },
      // After payment, redirect to the processing page
      success_url: `${APP_URL}/process/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/?cancelled=true`,
      // Pre-fill test card hint
      payment_intent_data: {
        description: `Cardentic task: ${task.slice(0, 100)}`,
      },
    });

    // Create a pending session in our store
    createSession(checkoutSession.id, task, AMOUNT);

    return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id });
  } catch (err) {
    console.error("[stripe/checkout] error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }
}
