/**
 * Milestone 4 — Stellar testnet integration test.
 * Tests fundBossAgent and paySubAgent against the real testnet.
 *
 * Run: node scripts/test-stellar.mjs
 */

import { Keypair, Asset, Horizon, Networks } from "@stellar/stellar-sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env.local
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

const HORIZON_URL = env.STELLAR_HORIZON_URL;
const USDC_ISSUER = env.STELLAR_USDC_ISSUER;
const USDC = new Asset("USDC", USDC_ISSUER);
const server = new Horizon.Server(HORIZON_URL);

async function getUsdc(publicKey) {
  const account = await server.loadAccount(publicKey);
  const b = account.balances.find(
    (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
  );
  return b?.balance ?? "0";
}

function explorerUrl(hash) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

// ── Re-implement the functions inline (no TS, uses env directly) ──────────────
import {
  TransactionBuilder,
  Operation,
  Memo,
} from "@stellar/stellar-sdk";

async function fundBossAgent(amountUsdc) {
  const treasuryKeypair = Keypair.fromSecret(env.STELLAR_TREASURY_SECRET_KEY);
  const bossPublicKey = env.STELLAR_BOSS_PUBLIC_KEY;
  const account = await server.loadAccount(treasuryKeypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({ destination: bossPublicKey, asset: USDC, amount: amountUsdc.toFixed(7) }))
    .addMemo(Memo.text("cardentic:fund"))
    .setTimeout(60)
    .build();
  tx.sign(treasuryKeypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

async function paySubAgent(fromSecret, toPublicKey, amountUsdc, memo) {
  const keypair = Keypair.fromSecret(fromSecret);
  const account = await server.loadAccount(keypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.payment({ destination: toPublicKey, asset: USDC, amount: amountUsdc }))
    .addMemo(Memo.text(memo ?? "cardentic:pay"))
    .setTimeout(60)
    .build();
  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🧪 Milestone 4 — Stellar Testnet Integration Test\n");

  const wallets = {
    treasury: env.STELLAR_TREASURY_PUBLIC_KEY,
    boss:     env.STELLAR_BOSS_PUBLIC_KEY,
    flight:   env.STELLAR_AGENT_FLIGHT_PUBLIC_KEY,
    hotel:    env.STELLAR_AGENT_HOTEL_PUBLIC_KEY,
    activity: env.STELLAR_AGENT_ACTIVITY_PUBLIC_KEY,
    summarizer: env.STELLAR_AGENT_SUMMARIZER_PUBLIC_KEY,
  };

  // ── Step 1: Print starting balances ────────────────────────────────────────
  console.log("📊 Starting balances:");
  for (const [name, pub] of Object.entries(wallets)) {
    const usdc = await getUsdc(pub);
    console.log(`   ${name.padEnd(12)} ${pub.slice(0, 8)}…  USDC: ${Number(usdc).toFixed(2)}`);
  }

  // ── Step 2: Treasury → Boss (simulate Stripe payment) ─────────────────────
  console.log("\n1️⃣  Treasury → Boss Agent (10 USDC)…");
  const fundHash = await fundBossAgent(10);
  console.log(`   ✅ tx: ${explorerUrl(fundHash)}`);

  const bossAfterFund = await getUsdc(wallets.boss);
  console.log(`   Boss balance: ${Number(bossAfterFund).toFixed(2)} USDC`);

  // ── Step 3: Boss → each sub-agent (simulate x402 payments) ────────────────
  const subAgents = [
    { name: "Flight Agent",    pub: wallets.flight,   secret: env.STELLAR_BOSS_SECRET_KEY, amount: "0.30" },
    { name: "Hotel Agent",     pub: wallets.hotel,    secret: env.STELLAR_BOSS_SECRET_KEY, amount: "0.30" },
    { name: "Activity Agent",  pub: wallets.activity, secret: env.STELLAR_BOSS_SECRET_KEY, amount: "0.20" },
    { name: "Summarizer",      pub: wallets.summarizer, secret: env.STELLAR_BOSS_SECRET_KEY, amount: "0.20" },
  ];

  console.log("\n2️⃣  Boss Agent paying sub-agents via Stellar…");
  const payHashes = [];
  for (const agent of subAgents) {
    const hash = await paySubAgent(
      agent.secret,
      agent.pub,
      agent.amount,
      `cardentic:${agent.name.slice(0, 20)}`,
    );
    payHashes.push({ name: agent.name, hash, amount: agent.amount });
    console.log(`   ✅ Paid ${agent.name} ${agent.amount} USDC — ${explorerUrl(hash)}`);
  }

  // ── Step 4: Final balances ─────────────────────────────────────────────────
  console.log("\n📊 Final balances:");
  for (const [name, pub] of Object.entries(wallets)) {
    const usdc = await getUsdc(pub);
    console.log(`   ${name.padEnd(12)} USDC: ${Number(usdc).toFixed(2)}`);
  }

  console.log("\n✅ All Stellar transactions confirmed on testnet!");
  console.log("\n🔗 Transaction links:");
  console.log(`   Funding:  ${explorerUrl(fundHash)}`);
  payHashes.forEach(({ name, hash }) => {
    console.log(`   ${name.padEnd(16)} ${explorerUrl(hash)}`);
  });
}

main().catch((err) => {
  const extras = err?.response?.data?.extras;
  if (extras?.result_codes) {
    console.error("❌ Stellar error:", JSON.stringify(extras.result_codes));
  } else {
    console.error("❌ Error:", err.message);
  }
  process.exit(1);
});
