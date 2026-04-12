/**
 * Server-Sent Events (SSE) emitter.
 *
 * Each processing session gets a queue of events. The SSE route
 * (/api/agent/stream/[sessionId]) drains the queue and pushes events
 * to the browser in real time.
 *
 * Pinned to Node.js global so it's shared across Next.js route modules.
 */

export interface SseEvent {
  type: string;
  [key: string]: unknown;
}

type Listener = (event: SseEvent) => void;

declare global {
  // eslint-disable-next-line no-var
  var __cardenticEmitter: EventEmitterMap | undefined;
}

class EventEmitterMap {
  private listeners = new Map<string, Set<Listener>>();

  on(sessionId: string, fn: Listener) {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)!.add(fn);
  }

  off(sessionId: string, fn: Listener) {
    this.listeners.get(sessionId)?.delete(fn);
  }

  emit(sessionId: string, event: SseEvent) {
    this.listeners.get(sessionId)?.forEach((fn) => fn(event));
  }

  cleanup(sessionId: string) {
    this.listeners.delete(sessionId);
  }
}

export const emitter: EventEmitterMap =
  global.__cardenticEmitter ??
  (global.__cardenticEmitter = new EventEmitterMap());

/** Convenience helper used throughout the pipeline */
export function emit(sessionId: string, event: SseEvent) {
  emitter.emit(sessionId, event);
}
