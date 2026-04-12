/**
 * Stellar testnet utilities.
 * Handles USDC transfers between wallets on Stellar testnet.
 * Full implementation used in Milestone 4 — stubs exported here so
 * TypeScript is satisfied during Milestone 3 compilation.
 */

import {
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  Networks,
  Horizon,
  Memo,
} from "@stellar/stellar-sdk";

const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const USDC_ISSUER = process.env.STELLAR_USDC_ISSUER!;
const USDC = new Asset("USDC", USDC_ISSUER);
const server = new Horizon.Server(HORIZON_URL);

/**
 * Send USDC from the treasury wallet to the boss agent wallet.
 * Returns the Stellar transaction hash.
 */
export async function fundBossAgent(amountUsdc: number): Promise<string> {
  const treasuryKeypair = Keypair.fromSecret(process.env.STELLAR_TREASURY_SECRET_KEY!);
  const bossPublicKey = process.env.STELLAR_BOSS_PUBLIC_KEY!;

  const account = await server.loadAccount(treasuryKeypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: bossPublicKey,
        asset: USDC,
        amount: amountUsdc.toFixed(7),
      }),
    )
    .addMemo(Memo.text("cardentic:fund"))
    .setTimeout(60)
    .build();

  tx.sign(treasuryKeypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

/**
 * Send USDC from the boss agent wallet to a sub-agent wallet.
 * Returns the Stellar transaction hash.
 */
export async function paySubAgent(
  toPublicKey: string,
  amountUsdc: string,
  memo?: string,
): Promise<string> {
  const bossKeypair = Keypair.fromSecret(process.env.STELLAR_BOSS_SECRET_KEY!);

  const account = await server.loadAccount(bossKeypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: toPublicKey,
        asset: USDC,
        amount: amountUsdc,
      }),
    )
    .addMemo(Memo.text(memo ? memo.slice(0, 28) : "cardentic:pay"))
    .setTimeout(60)
    .build();

  tx.sign(bossKeypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

/**
 * Get USDC balance of a wallet.
 */
export async function getUsdcBalance(publicKey: string): Promise<string> {
  const account = await server.loadAccount(publicKey);
  const balance = account.balances.find(
    (b) =>
      b.asset_type !== "native" &&
      "asset_code" in b &&
      b.asset_code === "USDC" &&
      b.asset_issuer === USDC_ISSUER,
  );
  return balance?.balance ?? "0";
}

/** Build a Stellar Expert testnet explorer URL for a transaction. */
export function stellarTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

/** Build a Stellar Expert testnet explorer URL for an account. */
export function stellarAccountUrl(publicKey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}
