/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow server-side use of node modules used by Stellar SDK and x402
  experimental: {
    serverComponentsExternalPackages: ["@stellar/stellar-sdk", "@x402/stellar", "@x402/core", "@x402/fetch", "@x402/express"],
  },

  // Stripe webhook requires raw body — disable body parsing for that route
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Payment, X-Payment-Response, PAYMENT-SIGNATURE, PAYMENT-REQUIRED, PAYMENT-RESPONSE" },
          { key: "Access-Control-Expose-Headers", value: "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Payment-Response" },
        ],
      },
    ];
  },
};

export default nextConfig;
