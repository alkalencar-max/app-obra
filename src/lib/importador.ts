// Lê a planilha "Centro de Custos" (abas LANÇAMENTO, DADOS e BASE-CRONO GERAL) e monta o
// pacote que a função importar_obra do banco recebe. É puro: recebe as abas já lidas
// (linhas como arrays de valores), para funcionar igual no navegador e nos testes.

export type Celula = string | number | boolean | Date | null;
export type Aba = { sheet: string; data: Celula[][] };

export type PacoteImportacao = {
  obra: { nome: string; endereco: string | null; area_m2: number | null };
  etapas: { nome: string; ordem: number; valor_orcado: number; cronograma: { mes: string; percentual: number }[] }[];
  apropriacoes: { nome: string; etapa: string | null }[];
  grupos: string[];
  fornecedores: { nome: string; categoria: string | null }[];
  lancamentos: {
    data: string;
    valor: number;
    fornecedor: string | null;
    descricao: string;
    apropriacao: string;
    grupo: string | null;
    obs: string | null;
    medicao: number | null;
  }[];
};

export type ResultadoImportacao = { pacote: PacoteImportacao; avisos: string[] };

const texto = (v: Celula | undefined): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};

const numero = (v: Celula | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const dataIso = (v: Celula | undefined): string | null => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (typeof v === "string") {
    // "24/03/2026", ou digitado sem uma das barras ("24/032026")
    const d = v.replace(/\D/g, "");
    if (d.length === 8) {
      const [dia, mes, ano] = [d.slice(0, 2), d.slice(2, 4), d.slice(4)];
      const iso = `${ano}-${mes}-${dia}`;
      if (!Number.isNaN(Date.parse(iso)) && Number(mes) <= 12 && Number(dia) <= 31) return iso;
    }
  }
  return null;
};

// "Instalações Elétricas" e "INSTALACOES ELETRICAS" contam como o mesmo nome.
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

// Apropriações comuns que não têm o mesmo nome da etapa do orçamento.
// Tirado do dashboard da planilha, onde essa soma é feita à mão.
const SINONIMOS: Record<string, string[]> = {
  "DESPESAS ADMINISTRATIVAS": ["ADM"],
  "SERVICOS INICIAIS E PROJETOS": ["SERVICOS INICIAIS", "PROJETOS", "CANTEIRO DE OBRAS", "TERRAPLANAGEM"],
  ESTRUTURA: ["ESTRUTURAL"],
  COBERTURA: ["CALHAS RUFOS E PINGADEIRAS"],
  "FASE CINZA": ["CHAPISCO E REBOCO", "CONTRAPISO"],
  "MUROS E CALCADAS": ["MUROS RAMPAS E CALCADAS"],
  "INSTALACOES ELETRICAS": ["INST ELETRICA", "INST COMUNICACAO"],
  "INSTALACOES HIDROSSANITARIAS": ["INST HIDROSSANITARIO"],
  "INSTALACOES GAS E CLIMATIZACAO": ["INST GAS E AR CONDICIONADO"],
  "REVESTIMENTO CERAMICOS": ["REVESTIMENTOS CERAMICOS"],
  "REVESTIMENTO EM GRANITO": ["PEDRAS DE GRANITO"],
  "REVESTIMENTO PINTURA": ["PINTURA"],
  "REVESTIMENTO VINILICO E RODAPES": ["VINILICO E RODAPES"],
  "ESQUADRIAS DE ALUMINIO": ["ESQUADRIAS DE ALUMINIO"],
  PAISAGISMO: ["JARDIM"],
  "SERVICOS FINAIS": ["LIMPEZA"],
  "IMPOSTOS DE OBRA": ["IMPOSTO ISS", "IMPOSTO INSS"],
};

export function sugerirEtapa(apropriacao: string, etapas: string[]): string | null {
  const alvo = normalizar(apropriacao);
  const porNome = new Map(etapas.map((e) => [normalizar(e), e]));
  if (porNome.has(alvo)) return porNome.get(alvo)!;
  for (const [etapa, apelidos] of Object.entries(SINONIMOS)) {
    if (apelidos.includes(alvo) && porNome.has(etapa)) return porNome.get(etapa)!;
  }
  return null;
}

const acharAba = (abas: Aba[], nome: string) => abas.find((a) => normalizar(a.sheet) === normalizar(nome));

const acharLinha = (linhas: Celula[][], ...titulos: string[]) =>
  linhas.findIndex((linha) => {
    const textos = linha.map((c) => (typeof c === "string" ? normalizar(c) : ""));
    return titulos.every((t) => textos.includes(normalizar(t)));
  });

const acharColuna = (linha: Celula[], titulo: string) =>
  linha.findIndex((c) => typeof c === "string" && normalizar(c) === normalizar(titulo));

// Valor escrito ao lado de um rótulo do cabeçalho ("ÁREA (M2):" -> 264).
function valorDoRotulo(linhas: Celula[][], rotulo: string): Celula {
  for (const linha of linhas.slice(0, 15)) {
    const i = linha.findIndex((c) => typeof c === "string" && normalizar(c).startsWith(normalizar(rotulo)));
    if (i >= 0) {
      const resto = String(linha[i]).split(":").slice(1).join(":").trim();
      if (resto) return resto;
      return linha.slice(i + 1).find((c) => c !== null && c !== "") ?? null;
    }
  }
  return null;
}

function lerCronograma(aba: Aba | undefined, avisos: string[]): PacoteImportacao["etapas"] {
  if (!aba) {
    avisos.push("Aba BASE-CRONO GERAL não encontrada: a obra entra sem orçamento e sem cronograma.");
    return [];
  }
  const linhas = aba.data;
  const iCab = acharLinha(linhas, "Etapa", "Descrição da Etapa");
  if (iCab < 0) {
    avisos.push("Não achei o cabeçalho do cronograma (Etapa / Descrição da Etapa).");
    return [];
  }
  const cab = linhas[iCab];
  const colNome = acharColuna(cab, "Descrição da Etapa");
  const colTotal = cab.findIndex((c) => typeof c === "string" && normalizar(c).startsWith("TOTAL"));
  const meses = cab
    .map((c, i) => ({ i, mes: dataIso(c) }))
    .filter((m): m is { i: number; mes: string } => m.mes !== null && m.i > colTotal)
    .map((m) => ({ i: m.i, mes: m.mes.slice(0, 8) + "01" }));

  const etapas: PacoteImportacao["etapas"] = [];
  for (let r = iCab + 1; r < linhas.length; r++) {
    const linha = linhas[r];
    const ordem = numero(linha[0]);
    const nome = texto(linha[colNome]);
    if (ordem === null || !Number.isInteger(ordem) || !nome) continue;
    const pct = linhas[r + 1] ?? [];
    etapas.push({
      nome,
      ordem,
      valor_orcado: Math.round((numero(linha[colTotal]) ?? 0) * 100) / 100,
      cronograma: meses
        .map((m) => ({ mes: m.mes, percentual: Math.round((numero(pct[m.i]) ?? 0) * 1e10) / 1e10 }))
        .filter((c) => c.percentual > 0),
    });
  }
  return etapas;
}

// Lista da aba DADOS: os valores abaixo de um título, até a primeira célula vazia.
function lerLista(aba: Aba | undefined, titulo: string): { valor: string; vizinho: string | null }[] {
  if (!aba) return [];
  const iCab = acharLinha(aba.data, titulo);
  if (iCab < 0) return [];
  const col = acharColuna(aba.data[iCab], titulo);
  const itens: { valor: string; vizinho: string | null }[] = [];
  for (let r = iCab + 1; r < aba.data.length; r++) {
    const v = texto(aba.data[r][col]);
    if (!v) break;
    itens.push({ valor: v, vizinho: texto(aba.data[r][col + 1]) });
  }
  return itens;
}

export function lerCentroDeCustos(abas: Aba[]): ResultadoImportacao {
  const avisos: string[] = [];
  const lanc = acharAba(abas, "LANÇAMENTO") ?? acharAba(abas, "LANÇAMENTOS");
  if (!lanc) throw new Error("A planilha precisa ter a aba LANÇAMENTO.");
  const dados = acharAba(abas, "DADOS");

  const nomeObra = texto(valorDoRotulo(lanc.data, "OBRA")) ?? "Obra importada";
  const endereco = texto(valorDoRotulo(lanc.data, "ENDEREÇO"));
  const area = valorDoRotulo(lanc.data, "ÁREA");
  const etapas = lerCronograma(acharAba(abas, "BASE-CRONO GERAL"), avisos);

  const iCab = acharLinha(lanc.data, "DATA", "R$ DESPESA");
  if (iCab < 0) throw new Error("Não achei o cabeçalho dos lançamentos (DATA / R$ DESPESA).");
  const cab = lanc.data[iCab];
  const col = {
    data: acharColuna(cab, "DATA"),
    valor: acharColuna(cab, "R$ DESPESA"),
    fornecedor: acharColuna(cab, "FORNECEDOR/PRETADOR") >= 0 ? acharColuna(cab, "FORNECEDOR/PRETADOR") : acharColuna(cab, "FORNECEDOR"),
    descricao: cab.findIndex((c) => typeof c === "string" && normalizar(c).includes("DESCRICAO")),
    apropriacao: acharColuna(cab, "ETAPA") >= 0 ? acharColuna(cab, "ETAPA") : acharColuna(cab, "APROPRIAÇÃO"),
    grupo: acharColuna(cab, "GRUPO"),
    obs: acharColuna(cab, "OBS"),
    medicao: cab.findIndex((c) => typeof c === "string" && normalizar(c).includes("MEDICAO")),
  };

  const lancamentos: PacoteImportacao["lancamentos"] = [];
  let ignoradas = 0;
  for (const linha of lanc.data.slice(iCab + 1)) {
    const valor = numero(linha[col.valor]);
    const data = dataIso(linha[col.data]);
    if (!valor) continue; // linhas em branco ou zeradas no fim da planilha
    const apropriacao = texto(linha[col.apropriacao]);
    if (!data || !apropriacao) {
      ignoradas++;
      continue;
    }
    const bm = texto(linha[col.medicao]);
    const nBm = bm ? Number(bm.replace(/\D/g, "")) : NaN;
    lancamentos.push({
      data,
      valor: Math.round(valor * 100) / 100,
      fornecedor: texto(linha[col.fornecedor]),
      descricao: texto(linha[col.descricao]) ?? "",
      apropriacao,
      grupo: col.grupo >= 0 ? texto(linha[col.grupo]) : null,
      obs: col.obs >= 0 ? texto(linha[col.obs]) : null,
      medicao: Number.isInteger(nBm) && nBm > 0 ? nBm : null,
    });
  }
  if (ignoradas) avisos.push(`${ignoradas} linha(s) com valor mas sem data ou sem etapa foram ignoradas.`);

  // Apropriações: a lista da aba DADOS, mais qualquer uma usada nos lançamentos e fora da lista.
  const nomesEtapas = etapas.map((e) => e.nome);
  const apropriacoes = new Map<string, string>();
  for (const { valor } of lerLista(dados, "APROPRIAÇÕES")) apropriacoes.set(valor, valor);
  for (const l of lancamentos) if (!apropriacoes.has(l.apropriacao)) apropriacoes.set(l.apropriacao, l.apropriacao);

  const grupos = new Set(lerLista(dados, "GRUPOS").map((g) => g.valor));
  for (const l of lancamentos) if (l.grupo) grupos.add(l.grupo);

  const fornecedores = new Map<string, string | null>();
  for (const { valor, vizinho } of lerLista(dados, "FORNECEDORES")) {
    if (normalizar(valor) !== "NOME") fornecedores.set(valor, vizinho);
  }
  for (const l of lancamentos) if (l.fornecedor && !fornecedores.has(l.fornecedor)) fornecedores.set(l.fornecedor, null);

  const pacote: PacoteImportacao = {
    obra: {
      nome: nomeObra,
      endereco,
      area_m2: typeof area === "number" ? area : area ? Number(String(area).replace(",", ".")) || null : null,
    },
    etapas,
    apropriacoes: [...apropriacoes.keys()].map((nome) => ({ nome, etapa: sugerirEtapa(nome, nomesEtapas) })),
    grupos: [...grupos],
    fornecedores: [...fornecedores].map(([nome, categoria]) => ({ nome, categoria })),
    lancamentos,
  };

  // Apropriação com lançamentos e sem etapa equivalente vira uma etapa sem orçamento (como TAXAS no dashboard).
  const semEtapa = pacote.apropriacoes.filter((a) => !a.etapa && lancamentos.some((l) => l.apropriacao === a.nome));
  for (const a of semEtapa) {
    pacote.etapas.push({ nome: a.nome, ordem: pacote.etapas.length + 1, valor_orcado: 0, cronograma: [] });
    a.etapa = a.nome;
  }
  if (semEtapa.length && etapas.length) {
    avisos.push(
      `Sem etapa equivalente no orçamento, viraram etapas sem valor orçado: ${semEtapa.map((a) => a.nome).join(", ")}. ` +
        "Dá para mudar depois em Apropriações.",
    );
  }
  return { pacote, avisos };
}
