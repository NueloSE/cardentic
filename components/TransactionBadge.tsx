import { ExternalLink } from "lucide-react";
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
      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 rounded px-2 py-0.5 transition-colors group"
    >
      {label && <span className="text-muted-foreground/60 not-italic mr-0.5">{label}</span>}
      {shortenHash(hash, 6)}
      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}
