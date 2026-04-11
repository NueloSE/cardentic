import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenHash(hash: string, chars = 8): string {
  if (!hash) return "";
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

export function stellarExplorerTxUrl(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}

export function stellarExplorerAccountUrl(publicKey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}
