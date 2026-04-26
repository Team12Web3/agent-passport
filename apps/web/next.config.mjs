/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@supabase/supabase-js"],
  },
  transpilePackages: [],
  webpack: (config) => {
    // Optional deps of pino/WalletConnect — not used at runtime, mark external
    // so webpack stops trying to resolve them.
    config.externals.push("lokijs", "encoding");

    // Silence "Critical dependency: the request of a dependency is an expression"
    // from `ox` (dynamic require in tempo/virtualMasterPool) — known safe.
    config.ignoreWarnings = [
      { module: /node_modules\/ox\// },
      { module: /node_modules\/@walletconnect\// },
    ];

    return config;
  },
};

export default nextConfig;
