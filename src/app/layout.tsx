import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "App Obra",
  description: "Gestão de custos de obras: orçamento, cronograma, lançamentos e dashboard.",
  appleWebApp: { title: "App Obra", statusBarStyle: "black-translucent" },
};

// viewportFit "cover" + safe-area no CSS: no iPhone a barra escura vai até o topo, sem faixa branca.
export const viewport: Viewport = {
  themeColor: "#1c1917",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
