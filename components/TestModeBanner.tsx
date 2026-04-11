import { Badge } from "@/components/ui/badge";
import { FlaskConical } from "lucide-react";

export function TestModeBanner() {
  return (
    <div className="sticky top-0 z-50 w-full border-b border-amber-500/20 bg-amber-500/5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2">
        <FlaskConical className="h-4 w-4 text-amber-400" />
        <p className="text-xs text-amber-400">
          <span className="font-semibold">TEST MODE</span> — Stripe test payments only · Stellar Testnet · No real money
        </p>
        <Badge variant="testmode" className="text-[10px]">
          HACKATHON DEMO
        </Badge>
      </div>
    </div>
  );
}
