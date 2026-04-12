/**
 * GET /api/registry/agents
 * Returns all active registered agents, optionally filtered by category.
 *
 * Query params:
 *   ?category=travel   — filter by category
 *   ?q=flight          — search by name/description
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  let query = supabase
    .from("agents")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[registry/agents] query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }

  return NextResponse.json({ agents: data, count: data.length });
}
