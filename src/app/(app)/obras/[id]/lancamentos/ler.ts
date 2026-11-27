import { lerComprovanteLocal, reduzirFoto } from "@/lib/ler-comprovante-local";
import { lerComprovante, type LeituraComprovante } from "../comprovante";

// Guarda o comprovante e lê os dados: com a IA se houver chave, senão de graça no navegador.
export async function lerArquivo(obraId: string, arquivo: File): Promise<LeituraComprovante> {
  const dados = new FormData();
  dados.append("arquivo", await reduzirFoto(arquivo));
  const r = await lerComprovante(obraId, dados);
  if (!r.semIA) return r;
  try {
    const lido = await lerComprovanteLocal(arquivo);
    const achou = lido.valor != null || lido.data != null || lido.favorecido != null;
    return { ...r, ...lido, erro: achou ? undefined : "Comprovante guardado, mas não consegui ler os dados. Preencha os campos à mão." };
  } catch (e) {
    console.error("lerComprovanteLocal", e);
    return { ...r, erro: "Comprovante guardado, mas a leitura falhou. Preencha os campos à mão." };
  }
}

export function valorBrTexto(v: number | null | undefined) {
  return v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, useGrouping: false }) : "";
}
