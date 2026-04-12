/**
 * Cardentic Wallet Setup Script
 * Adds USDC trustlines to all 6 wallets and sends USDC to the treasury.
 *
 * Run: node scripts/setup-wallets.mjs
 */

import { Keypair, Asset, TransactionBuilder, Operation, Networks, Horizon } from "@stellar/stellar-sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env.local manually
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const HORIZON_URL = env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
const USDC_ISSUER = env.STELLAR_USDC_ISSUER;
const USDC = new Asset("USDC", USDC_ISSUER);
const server = new Horizon.Server(HORIZON_URL);

const WALLETS = [
  { name: "Treasury",          secret: env.STELLAR_TREASURY_SECRET_KEY },
  { name: "Boss Agent",        secret: env.STELLAR_BOSS_SECRET_KEY },
  { name: "Flight Agent",      secret: env.STELLAR_AGENT_FLIGHT_SECRET_KEY },
  { name: "Hotel Agent",       secret: env.STELLAR_AGENT_HOTEL_SECRET_KEY },
  { name: "Activity Agent",    secret: env.STELLAR_AGENT_ACTIVITY_SECRET_KEY },
  { name: "Summarizer Agent",  secret: env.STELLAR_AGENT_SUMMARIZER_SECRET_KEY },
];

async function hasTrustline(publicKey) {
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.some(
      b => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
    );
  } catch {
    return false;
  }
}

async function addTrustline(wallet) {
  const keypair = Keypair.fromSecret(wallet.secret);
  const publicKey = keypair.publicKey();

  const already = await hasTrustline(publicKey);
  if (already) {
    console.log(`  ✓ ${wallet.name} (${publicKey.slice(0, 8)}...) — trustline already exists`);
    return;
  }

  const account = await server.loadAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: USDC, limit: "10000" }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  await server.submitTransaction(tx);
  console.log(`  ✓ ${wallet.name} (${publicKey.slice(0, 8)}...) — trustline added`);
}

async function checkBalances() {
  console.log("\n📊 Balances after setup:");
  for (const wallet of WALLETS) {
    const keypair = Keypair.fromSecret(wallet.secret);
    const account = await server.loadAccount(keypair.publicKey());
    const xlm = account.balances.find(b => b.asset_type === "native")?.balance || "0";
    const usdc = account.balances.find(b => b.asset_code === "USDC")?.balance || "0";
    console.log(`  ${wallet.name.padEnd(20)} XLM: ${Number(xlm).toFixed(2).padStart(10)}  USDC: ${Number(usdc).toFixed(2).padStart(8)}`);
  }
}

async function main() {
  console.log("🚀 Cardentic Wallet Setup\n");

  // Validate all secrets are present
  const missing = WALLETS.filter(w => !w.secret || w.secret.startsWith("S...") || w.secret === "");
  if (missing.length > 0) {
    console.error("❌ Missing secret keys for:", missing.map(w => w.name).join(", "));
    console.error("   Fill in .env.local before running this script.");
    process.exit(1);
  }

  console.log("1️⃣  Adding USDC trustlines to all wallets...");
  for (const wallet of WALLETS) {
    await addTrustline(wallet);
  }

  await checkBalances();

  console.log("\n✅ Setup complete!");
  console.log("\n⚠️  Next step: Fund the Treasury wallet with testnet USDC.");
  console.log("   Options:");
  console.log("   • https://xlm402.com (USDC faucet)");
  console.log(`   • Treasury public key: ${Keypair.fromSecret(env.STELLAR_TREASURY_SECRET_KEY).publicKey()}`);
}

main().catch(err => {
  console.error("❌ Setup failed:", err.message);
  process.exit(1);
});
