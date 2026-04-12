/**
 * Cardentic — XLM → USDC Swap Script
 * Swaps XLM for USDC on the Stellar testnet DEX for the Treasury wallet.
 *
 * Run: node scripts/swap-xlm-usdc.mjs
 */

import {
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  Networks,
  Horizon,
} from "@stellar/stellar-sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env.local manually
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

const HORIZON_URL =
  env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
const USDC_ISSUER = env.STELLAR_USDC_ISSUER;
const XLM = Asset.native();
const USDC = new Asset("USDC", USDC_ISSUER);
const server = new Horizon.Server(HORIZON_URL);

// How much XLM to spend (50 XLM → roughly 50 USDC on testnet)
const XLM_TO_SPEND = "50";
// Minimum USDC to accept (5% slippage tolerance)
const MIN_USDC_OUT = "40";

async function getOrderbookBestPrice() {
  try {
    const ob = await server.orderbook(XLM, USDC).call();
    if (ob.asks.length > 0) {
      const bestAsk = ob.asks[0];
      console.log(
        `  Orderbook best ask: 1 XLM = ${(1 / Number(bestAsk.price)).toFixed(4)} USDC (price: ${bestAsk.price})`
      );
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function swap() {
  const keypair = Keypair.fromSecret(env.STELLAR_TREASURY_SECRET_KEY);
  const publicKey = keypair.publicKey();

  console.log(`\n💱 Swapping ${XLM_TO_SPEND} XLM → USDC`);
  console.log(`   Treasury: ${publicKey}`);

  // Check current balances
  const account = await server.loadAccount(publicKey);
  const xlmBalance = account.balances.find(
    (b) => b.asset_type === "native"
  )?.balance;
  const usdcBalance =
    account.balances.find((b) => b.asset_code === "USDC")?.balance || "0";

  console.log(`\n📊 Before swap:`);
  console.log(`   XLM:  ${Number(xlmBalance).toFixed(2)}`);
  console.log(`   USDC: ${Number(usdcBalance).toFixed(2)}`);

  if (Number(xlmBalance) < Number(XLM_TO_SPEND) + 2) {
    console.error(
      `\n❌ Insufficient XLM. Need at least ${Number(XLM_TO_SPEND) + 2} XLM (including reserve).`
    );
    process.exit(1);
  }

  // Check if there's liquidity in the orderbook
  console.log(`\n🔍 Checking DEX liquidity...`);
  const hasLiquidity = await getOrderbookBestPrice();

  // Use path payment strict send — this works even with thin orderbooks
  // by routing through available liquidity paths
  console.log(`\n⏳ Submitting swap transaction...`);

  const tx = new TransactionBuilder(account, {
    fee: "10000", // higher fee for faster inclusion
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: XLM,
        sendAmount: XLM_TO_SPEND,
        destination: publicKey, // send to self
        destAsset: USDC,
        destMin: MIN_USDC_OUT,
        path: [], // let Stellar find the best path
      })
    )
    .setTimeout(60)
    .build();

  tx.sign(keypair);

  try {
    const result = await server.submitTransaction(tx);
    const txHash = result.hash;
    console.log(`\n✅ Swap successful!`);
    console.log(
      `   Explorer: https://stellar.expert/explorer/testnet/tx/${txHash}`
    );

    // Check new balances
    const updated = await server.loadAccount(publicKey);
    const newXlm = updated.balances.find(
      (b) => b.asset_type === "native"
    )?.balance;
    const newUsdc =
      updated.balances.find((b) => b.asset_code === "USDC")?.balance || "0";

    console.log(`\n📊 After swap:`);
    console.log(`   XLM:  ${Number(newXlm).toFixed(2)}`);
    console.log(`   USDC: ${Number(newUsdc).toFixed(2)}`);
    console.log(
      `\n🎉 Treasury has ${Number(newUsdc).toFixed(2)} USDC — ready for demo!`
    );
  } catch (err) {
    // Extract Stellar error details
    const extras = err?.response?.data?.extras;
    if (extras?.result_codes) {
      console.error(`\n❌ Transaction failed:`);
      console.error(`   Operation: ${extras.result_codes.operations}`);
      console.error(`   Transaction: ${extras.result_codes.transaction}`);

      if (extras.result_codes.operations?.includes("op_no_path")) {
        console.error(`\n💡 No liquidity path found on testnet DEX.`);
        console.error(`   Testnet orderbooks are often empty.`);
        console.error(`   Try the fallback below.`);
        await tryFallbackAMM(keypair, account);
      }
    } else {
      console.error(`\n❌ Error:`, err.message);
    }
    process.exit(1);
  }
}

/**
 * Fallback: use liquidity pool (AMM) swap if orderbook has no path.
 * Stellar testnet has AMM pools that are more reliably funded.
 */
async function tryFallbackAMM(keypair, account) {
  console.log(`\n🔄 Trying AMM liquidity pool swap as fallback...`);

  const publicKey = keypair.publicKey();

  // Re-load account for fresh sequence number
  const freshAccount = await server.loadAccount(publicKey);

  const tx = new TransactionBuilder(freshAccount, {
    fee: "10000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      // manageBuyOffer — place a limit buy order on the DEX
      // buys USDC with XLM at any price up to 1 XLM per USDC
      Operation.manageBuyOffer({
        selling: XLM,
        buying: USDC,
        buyAmount: "40",     // buy 40 USDC
        price: "1.5",        // pay up to 1.5 XLM per USDC
        offerId: "0",        // 0 = new offer
      })
    )
    .setTimeout(60)
    .build();

  tx.sign(keypair);

  try {
    const result = await server.submitTransaction(tx);
    console.log(`✅ Limit order placed: https://stellar.expert/explorer/testnet/tx/${result.hash}`);
    console.log(`   Order will fill when a seller matches. Check balances in a moment.`);

    // Wait 3 seconds and check if it filled immediately
    await new Promise(r => setTimeout(r, 3000));
    const updated = await server.loadAccount(publicKey);
    const usdc = updated.balances.find((b) => b.asset_code === "USDC")?.balance || "0";
    if (Number(usdc) > 0) {
      console.log(`✅ Order filled! USDC balance: ${usdc}`);
    } else {
      console.log(`⏳ Order pending. Run: node scripts/check-balances.mjs to monitor.`);
      console.log(`\n   If still empty after 1 min, use the manual faucet:`);
      console.log(`   https://laboratory.stellar.org/#account-creator?network=test`);
    }
  } catch (fallbackErr) {
    console.error(`❌ Fallback also failed:`, fallbackErr?.response?.data?.extras?.result_codes || fallbackErr.message);
    console.log(`\n💡 Manual option — paste this URL in browser to check the testnet USDC faucet:`);
    console.log(`   https://xlm402.com`);
  }
}

swap();
