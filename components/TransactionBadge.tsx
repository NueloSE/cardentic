import { stellarExplorerTxUrl, shortenHash } from "@/lib/utils";

interface TransactionBadgeProps {
  hash: string;
  label?: string;
}

export function TransactionBadge({ hash, label }: TransactionBadgeProps) {
  return (
    <a
      href={stellarExplorerTxUrl(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#444] hover:text-[#c8ff57] border border-[#1e1e1e] hover:border-[#c8ff57]/20 rounded px-2 py-0.5 transition-colors"
    >
      {label && <span className="text-[#2e2e2e] mr-0.5">{label}</span>}
      {shortenHash(hash, 6)}
      <span className="text-[#2e2e2e] group-hover:text-[#c8ff57]">↗</span>
    </a>
  );
}
