import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas as telas dependem do usuário logado, então renderizam sob demanda.
  cacheComponents: false,
  // Comprovantes (foto/PDF) sobem por server action; fotos são reduzidas no navegador antes de enviar.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
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
