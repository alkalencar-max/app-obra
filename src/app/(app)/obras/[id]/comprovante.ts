"use server";

import Anthropic from "@anthropic-ai/sdk";
import { exigirEmpresa } from "@/lib/sessao";

export type LeituraComprovante = {
  erro?: string;
  // true quando não há chave da IA: o navegador faz a leitura grátis (OCR).
  semIA?: boolean;
  caminho?: string;
  data?: string | null;
  valor?: number | null;
  favorecido?: string | null;
  descricao?: string | null;
};

const TIPOS: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

// Campos que a leitura devolve; null quando não aparece no comprovante.
const ESQUEMA = {
  type: "object",
  properties: {
    data: { type: ["string", "null"], description: "Data do pagamento no formato AAAA-MM-DD" },
    valor: { type: ["number", "null"], description: "Valor pago em reais, número com ponto decimal" },
    favorecido: { type: ["string", "null"], description: "Quem recebeu o pagamento (empresa ou pessoa), como aparece no comprovante" },
    descricao: { type: ["string", "null"], description: "Descrição curta do que foi pago, se houver (ex.: número da nota, boleto, pedido)" },
  },
  required: ["data", "valor", "favorecido", "descricao"],
  additionalProperties: false,
} as const;

// Guarda o comprovante no Storage e, se houver chave da IA, lê data, valor e favorecido com o Claude.
// Sem chave, devolve semIA e a leitura é feita de graça no navegador.
export async function lerComprovante(obraId: string, form: FormData): Promise<LeituraComprovante> {
  const { supabase, empresaId } = await exigirEmpresa();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha a foto ou o PDF do comprovante." };
  const ehPdf = arquivo.type === "application/pdf";
  if (!ehPdf && !TIPOS[arquivo.type]) return { erro: "Envie uma foto (JPG/PNG) ou um PDF." };

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const extensao = ehPdf ? "pdf" : arquivo.type.split("/")[1];
  const caminho = `${empresaId}/${obraId}/${crypto.randomUUID()}.${extensao}`;
  const { error: erroUpload } = await supabase.storage.from("comprovantes").upload(caminho, bytes, { contentType: arquivo.type });
  if (erroUpload) return { erro: `Não consegui guardar o arquivo: ${erroUpload.message}` };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { caminho, semIA: true };
  }

  const anexo: Anthropic.Beta.BetaContentBlockParam = ehPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } }
    : { type: "image", source: { type: "base64", media_type: TIPOS[arquivo.type], data: bytes.toString("base64") } };

  try {
    const client = new Anthropic();
    const resposta = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
      messages: [
        {
          role: "user",
          content: [
            anexo,
            {
              type: "text",
              text: "Este é um comprovante de pagamento de uma obra no Brasil (PIX, TED, boleto, recibo ou nota). Extraia a data do pagamento, o valor pago, o favorecido (quem recebeu) e uma descrição curta. Use null no que não estiver legível.",
            },
          ],
        },
      ],
    });
    if (resposta.stop_reason === "refusal") return { caminho, erro: "Não consegui ler este comprovante. Preencha os campos à mão." };
    const texto = resposta.content.find((b) => b.type === "text");
    const lido = JSON.parse(texto && texto.type === "text" ? texto.text : "{}") as Omit<LeituraComprovante, "erro" | "caminho">;
    return { caminho, ...lido };
  } catch (e) {
    console.error("lerComprovante", e);
    return { caminho, erro: "Comprovante guardado, mas a leitura falhou. Preencha os campos à mão." };
  }
}
