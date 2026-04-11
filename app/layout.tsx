import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Cardentic — AI Agents Powered by Stellar x402",
  description:
    "Pay once with a credit card. A Boss Agent breaks your task into sub-tasks, hires specialized AI agents, and pays each one via x402 micropayments on Stellar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans min-h-screen antialiased bg-background text-foreground`}>
        {/* Test mode banner */}
        <div className="w-full bg-warning/5 border-b border-warning/15 py-1.5 px-4 flex items-center justify-center gap-3 text-[11px] text-warning/70">
          <span className="w-1.5 h-1.5 rounded-full bg-warning/60 shrink-0" />
          <span>
            <span className="font-semibold text-warning/90">TEST MODE</span>
            {" "}— Stripe test payments · Stellar Testnet · No real funds
          </span>
          <span className="font-mono border border-warning/20 rounded px-1.5 py-0.5 text-warning/50">
            HACKATHON DEMO
          </span>
        </div>
        {children}
      </body>
    </html>
  );
}
