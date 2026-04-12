import { NextRequest } from "next/server";
import { emitter } from "@/lib/emitter";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const { sessionId } = params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Helper to push an SSE event
      const send = (event: Record<string, unknown>) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // client disconnected
        }
      };

      // Send current session state immediately on connect
      const session = getSession(sessionId);
      if (session) {
        send({
          type: "session_start",
          task: session.task,
          amount: (session.amount / 100).toFixed(2),
          status: session.status,
        });

        // If already funded, replay the funding event
        if (session.fundingTxHash) {
          send({ type: "funded", txHash: session.fundingTxHash });
        }

        // If already complete, send the result immediately
        if (session.status === "complete" && session.result) {
          send({ type: "complete", result: session.result });
        }
      } else {
        // Session not yet in store — the webhook may be in-flight.
        // The client will get events as they arrive.
        send({ type: "waiting", message: "Waiting for payment confirmation…" });
      }

      // Subscribe to future events for this session
      const listener = (event: Record<string, unknown>) => {
        send(event);
        // Close the stream when the pipeline finishes
        if (event.type === "complete" || event.type === "error") {
          setTimeout(() => {
            try { controller.close(); } catch { /* already closed */ }
          }, 500);
        }
      };

      emitter.on(sessionId, listener);

      // Heartbeat every 15s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup when client disconnects
      return () => {
        clearInterval(heartbeat);
        emitter.off(sessionId, listener);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
