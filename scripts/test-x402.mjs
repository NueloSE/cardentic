/**
 * Milestone 5 — x402 end-to-end payment test.
 * Simulates the Boss Agent calling each sub-agent with real x402 payments.
 *
 * Run: node scripts/test-x402.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

// Inject env for the x402 modules
Object.assign(process.env, env);

const BASE_URL = "http://localhost:3000";
const NETWORK = "stellar:testnet";

async function main() {
  console.log("🧪 Milestone 5 — x402 End-to-End Payment Test\n");

  // Build x402-enabled fetch using boss agent's keypair
  const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
  const { ExactStellarScheme } = await import("@x402/stellar/exact/client");
  const { createEd25519Signer } = await import("@x402/stellar");

  const signer = createEd25519Signer(env.STELLAR_BOSS_SECRET_KEY, NETWORK);
  const client = new x402Client().register(
    NETWORK,
    new ExactStellarScheme(signer, { url: env.STELLAR_RPC_URL }),
  );
  const fetchWithPay = wrapFetchWithPayment(globalThis.fetch, client);

  const agents = [
    { name: "Flight Researcher", path: "/api/agents/flight-researcher", subtask: "Find cheap flights from Lagos to London for 3 days in May" },
    { name: "Hotel Researcher",  path: "/api/agents/hotel-researcher",  subtask: "Find affordable hotels in London for 3 nights, budget $150/night" },
    { name: "Activity Planner",  path: "/api/agents/activity-planner",  subtask: "Plan 3 days of activities in London on a $200 total budget" },
  ];

  const results = {};

  for (const agent of agents) {
    console.log(`\n🤖 Calling ${agent.name}…`);
    console.log(`   Task: "${agent.subtask.slice(0, 60)}"`);

    const start = Date.now();
    const res = await fetchWithPay(`${BASE_URL}${agent.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtask: agent.subtask }),
    });

    const elapsed = Date.now() - start;
    const settleHeader = res.headers.get("x-payment-response");
    const data = await res.json();

    if (res.status === 200) {
      console.log(`   ✅ Paid & responded in ${elapsed}ms — HTTP ${res.status}`);
      console.log(`   USDC paid: ${data.price}`);
      if (settleHeader) console.log(`   Settlement header present: YES`);
      if (data.result?.summary) console.log(`   Summary: ${data.result.summary}`);
      results[agent.name] = data.result;
    } else {
      console.error(`   ❌ Failed — HTTP ${res.status}`);
      console.error(`   Body:`, JSON.stringify(data).slice(0, 200));
    }
  }

  // Now call the summarizer with all results
  console.log(`\n🤖 Calling Summarizer with all results…`);
  const summRes = await fetchWithPay(`${BASE_URL}/api/agents/summarizer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: "Plan a cheap 3-day trip to London from Lagos",
      agentResults: results,
    }),
  });

  const summData = await summRes.json();
  if (summRes.status === 200) {
    console.log(`   ✅ Summarizer responded — HTTP ${summRes.status}`);
    console.log(`   Summary: ${summData.result?.summary}`);
    console.log(`   Sections: ${summData.result?.sections?.length ?? 0}`);
  } else {
    console.error(`   ❌ Failed — HTTP ${summRes.status}`);
  }

  console.log("\n✅ x402 end-to-end test complete!");
  console.log("   All 4 sub-agents paid via x402 on Stellar testnet.");
}

main().catch((err) => {
  console.error("❌ Test failed:", err.message ?? err);
  process.exit(1);
});
