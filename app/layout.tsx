import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Cardentic — AI Agents Powered by Stellar x402",
  description:
    "Pay once with a credit card. A Boss Agent breaks your task into sub-tasks, hires specialized AI agents, and pays each one via x402 micropayments on Stellar.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans min-h-screen antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
