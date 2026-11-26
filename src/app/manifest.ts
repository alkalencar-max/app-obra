import type { MetadataRoute } from "next";

// Permite "Adicionar à Tela de Início" no iPhone/Android: abre em tela cheia, com ícone próprio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "App Obra",
    short_name: "App Obra",
    description: "Gestão de obras: orçamento, cronograma, compras, contas a pagar e relatórios.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
