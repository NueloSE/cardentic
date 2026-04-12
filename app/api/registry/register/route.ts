/**
 * POST /api/registry/register
 * Registers a new agent in the public marketplace.
 * Endpoint URL is auto-generated — users don't need their own server.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const CATEGORIES = ["travel", "finance", "research", "utilities", "other"] as const;

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { name, description, category, stellar_address, price_usdc, owner_name, owner_email } = body;

  // Validate required fields
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ error: "description is required" }, { status: 400 });
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: `category must be one of: ${CATEGORIES.join(", ")}` }, { status: 400 });
  if (!stellar_address?.trim()) return NextResponse.json({ error: "stellar_address is required" }, { status: 400 });

  if (!/^G[A-Z2-7]{55}$/.test(stellar_address.trim())) {
    return NextResponse.json({ error: "stellar_address must be a valid Stellar public key (starts with G, 56 characters)" }, { status: 400 });
  }

  const price = parseFloat(price_usdc ?? "0.20");
  if (isNaN(price) || price < 0.01 || price > 100) {
    return NextResponse.json({ error: "price_usdc must be between 0.01 and 100" }, { status: 400 });
  }

  // Step 1: Insert without endpoint_url to get the generated ID
  const { data, error } = await supabase.from("agents").insert({
    name: name.trim(),
    description: description.trim(),
    category,
    endpoint_url: "pending", // temporary — updated below
    stellar_address: stellar_address.trim(),
    price_usdc: price,
    owner_name: owner_name?.trim() || null,
    owner_email: owner_email?.trim() || null,
    is_active: true,
  }).select().single();

  if (error) {
    console.error("[registry/register] insert error:", error.message);
    return NextResponse.json({ error: "Failed to register agent" }, { status: 500 });
  }

  // Step 2: Auto-generate the hosted endpoint URL using the real ID
  const baseUrl = getBaseUrl(req);
  const endpoint_url = `${baseUrl}/api/hosted/${data.id}`;

  const { data: updated, error: updateError } = await supabase
    .from("agents")
    .update({ endpoint_url })
    .eq("id", data.id)
    .select()
    .single();

  if (updateError) {
    console.error("[registry/register] update endpoint error:", updateError.message);
    // Return what we have — the endpoint can be derived
    return NextResponse.json({ ok: true, agent: { ...data, endpoint_url } }, { status: 201 });
  }

  console.log(`[registry/register] "${name}" registered → ${endpoint_url}`);
  return NextResponse.json({ ok: true, agent: updated }, { status: 201 });
}
