/**
 * x402 protocol helpers for Cardentic.
 *
 * SERVER: build 402 responses, verify + settle incoming payments
 * CLIENT: create a payment-capable fetch for the boss agent
 *
 * Protocol flow:
 *   Boss agent → POST /api/agents/flight-researcher        (no X-Payment)
 *   Server     ← 402 + X-Payment-Required header
 *   Boss agent → signs Soroban tx via createEd25519Signer
 *   Boss agent → POST /api/agents/flight-researcher        (with X-Payment)
 *   Server     → facilitator /verify → /settle
 *   Server     ← 200 + result + X-Payment-Response header
 */

import type { NextRequest } from "next/server";
import {
  encodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type {
  PaymentRequired,
  PaymentRequirements,
} from "@x402/core/types";
import { USDC_TESTNET_ADDRESS, convertToTokenAmount } from "@x402/stellar";

const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? "https://www.x402.org/facilitator";
const NETWORK = (process.env.X402_NETWORK ??
  "stellar:testnet") as `${string}:${string}`;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

// ─── Server helpers ────────────────────────────────────────────────────────────

/**
 * Build a PaymentRequired object for a sub-agent endpoint.
 * @param priceUsd   e.g. 0.30
 * @param payTo      sub-agent public key (G...)
 * @param path       e.g. "/api/agents/flight-researcher"
 * @param description human-readable description
 */
export function buildPaymentRequired(
  priceUsd: number,
  payTo: string,
  path: string,
  description: string,
): PaymentRequired {
  // amount uses 7 decimals for Stellar USDC (e.g. 0.30 → "3000000")
  const amount = convertToTokenAmount(priceUsd.toString(), 7).toString();

  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: NETWORK,
    asset: USDC_TESTNET_ADDRESS,
    amount,
    payTo,
    maxTimeoutSeconds: 300,
    extra: { areFeesSponsored: true },
  };

  return {
    x402Version: 2,
    resource: {
      url: `${APP_URL}${path}`,
      description,
      mimeType: "application/json",
    },
    accepts: [requirements],
  };
}

/**
 * Return a 402 Payment Required response with the X-Payment-Required header.
 */
export function paymentRequiredResponse(
  paymentRequired: PaymentRequired,
): Response {
  return new Response(
    JSON.stringify({ error: "Payment required", x402Version: 2 }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        // The x402 client reads "PAYMENT-REQUIRED" (case-insensitive via fetch headers.get)
        "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired),
      },
    },
  );
}

/**
 * Verify and settle an incoming x402 payment.
 * Returns { ok: true, settleHeader } on success or { ok: false, response } on failure.
 */
export async function verifyAndSettle(
  req: NextRequest,
  paymentRequired: PaymentRequired,
): Promise<{ ok: true; settleHeader: string } | { ok: false; response: Response }> {
  // Next.js lowercases all incoming headers.
  // v2 client sends "PAYMENT-SIGNATURE", v1 sends "X-PAYMENT"
  const paymentHeader =
    req.headers.get("payment-signature") ??
    req.headers.get("x-payment");
  if (!paymentHeader) {
    return { ok: false, response: paymentRequiredResponse(paymentRequired) };
  }

  let paymentPayload;
  try {
    paymentPayload = decodePaymentSignatureHeader(paymentHeader);
  } catch {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Malformed X-Payment header" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const requirements = paymentRequired.accepts[0];

  // Verify with the public facilitator
  let verifyResult;
  try {
    verifyResult = await facilitator.verify(paymentPayload, requirements);
  } catch (err) {
    console.error("[x402] verify error:", err);
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Payment verification failed" }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  if (!verifyResult.isValid) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: "Payment invalid",
          reason: verifyResult.invalidReason,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  // Settle the payment
  let settleResult;
  try {
    settleResult = await facilitator.settle(paymentPayload, requirements);
  } catch (err) {
    console.error("[x402] settle error:", err);
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Payment settlement failed" }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const settleHeader = encodePaymentResponseHeader(settleResult);
  return { ok: true, settleHeader };
}

// ─── Client helpers ────────────────────────────────────────────────────────────

/**
 * Create an x402-payment-enabled fetch for the boss agent.
 * Uses the boss agent's Stellar secret key to sign Soroban auth entries.
 */
export async function createX402Fetch(): Promise<typeof fetch> {
  const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
  const { ExactStellarScheme } = await import("@x402/stellar/exact/client");
  const { createEd25519Signer } = await import("@x402/stellar");

  const STELLAR_RPC_URL =
    process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";

  const signer = createEd25519Signer(
    process.env.STELLAR_BOSS_SECRET_KEY!,
    NETWORK,
  );

  const client = new x402Client().register(
    NETWORK,
    new ExactStellarScheme(signer, { url: STELLAR_RPC_URL }),
  );

  return wrapFetchWithPayment(globalThis.fetch, client);
}
