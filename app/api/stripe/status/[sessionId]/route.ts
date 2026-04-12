import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const session = getSession(params.sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    status: session.status,
    task: session.task,
    fundingTxHash: session.fundingTxHash ?? null,
    result: session.result ?? null,
    error: session.error ?? null,
  });
}
