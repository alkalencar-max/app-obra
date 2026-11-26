"use client";

// Abre a janela de impressão do navegador; nela dá para escolher "Salvar como PDF".
export function BotaoImprimir({ rotulo = "Imprimir / PDF" }: { rotulo?: string }) {
  return (
    <button type="button" className="botao-secundario print:hidden" onClick={() => window.print()}>
      {rotulo}
    </button>
  );
}
