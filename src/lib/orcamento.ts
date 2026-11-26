// Lê o orçamento da planilha própria (modelo "ORÇAMENTO GERAL DE OBRA"):
// linha de título da etapa, linhas de itens (descrição, quant., und., custo unit., custo total) e "Total Item".
// Funciona com o arquivo .xlsx lido no navegador ou com o trecho copiado do Excel e colado (separado por tab).

export type Celula = string | number | boolean | Date | null | undefined;
export type TipoItem = "material" | "servico" | "equipamento";
export type ItemOrcamento = { descricao: string; tipo: TipoItem; quantidade: number; unidade: string | null; custo_unitario: number };
export type EtapaOrcamento = { nome: string; itens: ItemOrcamento[] };

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

const texto = (c: Celula) => (c == null ? "" : c instanceof Date ? "" : String(c).trim());

// "R$ 1.234,56" | "1234,56" | 1234.56 -> número; vazio, "-" ou texto -> null.
export function numero(c: Celula): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const s = texto(c).replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s || s === "-") return null;
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const v = Number(s.includes(",") || /^-?\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(v) ? v : null;
}

const SERVICO = /\b(MAO DE OBRA|EMPREITEIRO|SERVICO|EXECUCAO|INSTALACAO|PROJETO|SONDAGEM|LEVANTAMENTO|TAXA|CONTABILIDADE|ADMINISTRACAO|TERRAPLANAGEM|LIMPEZA|PINTURA|APLICACAO|MONTAGEM)\b/;
const EQUIPAMENTO = /\b(LOCACAO|ALUGUEL|EQUIPAMENTO|BETONEIRA|ANDAIME|CACAMBA|ESCAVADEIRA|RETROESCAVADEIRA|GUINCHO|BOMBA|COMPACTADOR|MUNCK|GUINDASTE)\b/;

export function classificar(descricao: string): TipoItem {
  const d = normalizar(descricao);
  if (EQUIPAMENTO.test(d) && !/\bCONCRETO\b/.test(d)) return "equipamento";
  if (SERVICO.test(d)) return "servico";
  return "material";
}

type Colunas = { desc: number; quant: number; und: number; unit: number };

function acharCabecalho(linhas: Celula[][]): { linha: number; col: Colunas } | null {
  for (let r = 0; r < Math.min(linhas.length, 40); r++) {
    const cab = linhas[r].map((c) => normalizar(texto(c)));
    const desc = cab.findIndex((c) => c.startsWith("DESCRI"));
    const quant = cab.findIndex((c) => c.startsWith("QUANT") || c === "QTDE" || c === "QTD");
    if (desc < 0 || quant < 0) continue;
    const und = cab.findIndex((c) => ["UND", "UND.", "UN", "UNID", "UNID.", "UNIDADE"].includes(c));
    const unit = cab.findIndex((c) => c.includes("UNIT"));
    return { linha: r, col: { desc, quant, und: und < 0 ? quant + 1 : und, unit: unit < 0 ? quant + 2 : unit } };
  }
  return null;
}

export function lerOrcamento(linhas: Celula[][]): { etapas: EtapaOrcamento[]; avisos: string[] } {
  const avisos: string[] = [];
  const cab = acharCabecalho(linhas);
  // Sem cabeçalho (trecho colado): Descrição | Quant. | Und. | Custo unit. | Custo total, a partir da 1ª coluna com texto.
  const inicio = cab ? cab.linha + 1 : 0;

  const etapas: EtapaOrcamento[] = [];
  let atual: EtapaOrcamento | null = null;
  let semEtapa = 0, zerados = 0;

  for (let r = inicio; r < linhas.length; r++) {
    const linha = linhas[r] ?? [];
    let col = cab?.col;
    if (!col) {
      const primeira = linha.findIndex((c) => texto(c) !== "" && numero(c) == null);
      if (primeira < 0) continue;
      col = { desc: primeira, quant: primeira + 1, und: primeira + 2, unit: primeira + 3 };
    }
    const desc = texto(linha[col.desc]);
    if (!desc) continue;
    const tudo = normalizar(linha.map(texto).join(" "));
    if (tudo.includes("TOTAL ITEM") || /^(TOTAL|SUBTOTAL|CUSTO TOTAL)\b/.test(normalizar(desc))) continue;

    const unit = numero(linha[col.unit]);
    if (unit == null) {
      // Linha só com o nome (às vezes com a quantidade da etapa, ex.: "ESTRUTURA 92,50 M3"): começa uma etapa.
      atual = { nome: desc.toUpperCase().replace(/\s+/g, " "), itens: [] };
      etapas.push(atual);
      continue;
    }
    const quantidade = numero(linha[col.quant]) ?? 1;
    if (quantidade === 0) { zerados++; continue; }
    if (!atual) { semEtapa++; continue; }
    atual.itens.push({
      descricao: desc.replace(/\s+/g, " "),
      tipo: classificar(desc),
      quantidade,
      unidade: texto(linha[col.und]) || null,
      custo_unitario: unit,
    });
  }

  const comItens = etapas.filter((e) => e.itens.length > 0);
  const vazias = etapas.length - comItens.length;
  if (semEtapa) avisos.push(`${semEtapa} item(ns) antes do primeiro título de etapa foram ignorados.`);
  if (zerados) avisos.push(`${zerados} item(ns) com quantidade zero foram ignorados.`);
  if (vazias) avisos.push(`${vazias} título(s) sem itens foram ignorados: ${etapas.filter((e) => !e.itens.length).map((e) => e.nome).join(", ")}.`);
  return { etapas: comItens, avisos };
}

// Texto colado do Excel: linhas por quebra, colunas por tab.
export const lerColado = (texto: string): Celula[][] => texto.replace(/\r/g, "").split("\n").map((l) => l.split("\t"));

export const totalEtapa = (e: EtapaOrcamento) => e.itens.reduce((s, i) => s + Math.round(i.quantidade * i.custo_unitario * 100) / 100, 0);
