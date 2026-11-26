import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas as telas dependem do usuário logado, então renderizam sob demanda.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
