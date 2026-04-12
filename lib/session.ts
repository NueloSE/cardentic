/**
 * In-memory session store.
 * Tracks each payment session from Stripe checkout → agent completion.
 *
 * In production you'd use Redis/Vercel KV — for this hackathon demo
 * in-memory is fine since we run a single Node process.
 */

export type SessionStatus =
  | "pending_payment"   // Stripe checkout opened, not yet paid
  | "paid"              // Stripe webhook confirmed payment
  | "funding"           // USDC transfer to boss agent in progress
  | "funded"            // Boss agent has USDC, agents about to start
  | "running"           // Agents are working
  | "complete"          // All done, result available
  | "error";            // Something failed

export interface Session {
  id: string;                  // Stripe checkout session ID
  task: string;                // User's natural language task
  status: SessionStatus;
  amount: number;              // USD cents (e.g. 1000 = $10)
  createdAt: Date;
  updatedAt: Date;
  fundingTxHash?: string;      // Stellar tx hash for USDC transfer
  result?: unknown;            // Final aggregated result from boss agent
  error?: string;
}

// Pin to Node.js global so the Map is shared across Next.js route module instances.
// Without this, each API route gets its own module copy and can't see each other's sessions.
declare global {
  // eslint-disable-next-line no-var
  var __cardenticSessions: Map<string, Session> | undefined;
}
const sessions: Map<string, Session> =
  global.__cardenticSessions ?? (global.__cardenticSessions = new Map());

export function createSession(id: string, task: string, amount: number): Session {
  const session: Session = {
    id,
    task,
    status: "pending_payment",
    amount,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, patch: Partial<Session>): Session | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  const updated = { ...session, ...patch, updatedAt: new Date() };
  sessions.set(id, updated);
  return updated;
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values());
}
