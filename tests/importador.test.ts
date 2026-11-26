import assert from "node:assert/strict";
import { test } from "node:test";
import { lerCentroDeCustos, sugerirEtapa, type Aba } from "../src/lib/importador.ts";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

// Planilha mínima no formato do "Centro de Custos" (dados fictícios).
const abas: Aba[] = [
  {
    sheet: "LANÇAMENTO",
    data: [
      [null, "CENTRO DE CUSTOS DE OBRAS"],
      [null, "OBRA: RESIDÊNCIA TESTE"],
      [null, "ENDEREÇO: RUA A, 10"],
      [null, "ÁREA (M2):", null, 200],
      [null, "ITEM", "DATA", "R$ DESPESA", "R$ TRANSF.", "FORNECEDOR/PRETADOR", "PEDIDO - BREVE DESCRIÇÃO", "ETAPA", "GRUPO", "OBS", "Nº MEDIÇÃO"],
      [null, 1, d("2026-01-10"), 1000, null, "LOJA A", "PED01 CIMENTO", "ESTRUTURAL ", "MATERIAIS", null, "BM01"],
      [null, 2, "24/032026", 500.555, null, "LOJA B", "PED02 AREIA", "CHAPISCO E REBOCO", "MATERIAIS", "obs", "BM02"],
      [null, 3, d("2026-03-25"), 200, null, "PREFEITURA", "ALVARÁ", "TAXAS", "TAXAS", null, "BM02"],
      [null, 4, null, 0, null, null, null, null, null, null, null],
    ],
  },
  {
    sheet: "DADOS",
    data: [
      [null, "APROPRIAÇÕES", null, "GRUPOS", null, "FORNECEDORES", "CONTA"],
      [null, "ESTRUTURAL", null, "MATERIAIS", null, "NOME", "CATEGORIA FORNECEDOR"],
      [null, "CHAPISCO E REBOCO", null, "TAXAS", null, "LOJA A", "MAT. CONSTRUÇÃO"],
      [null, "JARDIM", null, null, null, null, null],
    ],
  },
  {
    sheet: "BASE-CRONO GERAL",
    data: [
      ["CRONOGRAMA FÍSICO-FINANCEIRO"],
      ["Etapa", "Descrição da Etapa", "Gasto por Etapa", "Total\r\n(R$)", "Início da Etapa", d("2026-01-01"), d("2026-02-01")],
      [1, "ESTRUTURA", 0.5, 3000, d("2021-01-01"), 1500, 1500],
      [0.5, 0.5, null, null, null, 0.5, 0.5],
      [2, "FASE CINZA", 0.4, 2000, d("2021-01-01"), 0, 2000],
      [null, null, null, null, null, 0, 1],
      [3, "PAISAGISMO", 0.1, 500, d("2021-01-01"), 0, 0],
      [null, null, null, null, null, 0, 0],
    ],
  },
];

test("lê obra, lançamentos, cronograma e liga apropriações às etapas", () => {
  const { pacote, avisos } = lerCentroDeCustos(abas);

  assert.deepEqual(pacote.obra, { nome: "RESIDÊNCIA TESTE", endereco: "RUA A, 10", area_m2: 200 });
  assert.equal(pacote.lancamentos.length, 3);
  assert.deepEqual(pacote.lancamentos[1], {
    data: "2026-03-24",
    valor: 500.56,
    fornecedor: "LOJA B",
    descricao: "PED02 AREIA",
    apropriacao: "CHAPISCO E REBOCO",
    grupo: "MATERIAIS",
    obs: "obs",
    medicao: 2,
  });

  const estrutura = pacote.etapas.find((e) => e.nome === "ESTRUTURA");
  assert.deepEqual(estrutura?.cronograma, [
    { mes: "2026-01-01", percentual: 0.5 },
    { mes: "2026-02-01", percentual: 0.5 },
  ]);

  const etapaDe = Object.fromEntries(pacote.apropriacoes.map((a) => [a.nome, a.etapa]));
  assert.equal(etapaDe["ESTRUTURAL"], "ESTRUTURA");
  assert.equal(etapaDe["CHAPISCO E REBOCO"], "FASE CINZA");
  assert.equal(etapaDe["JARDIM"], "PAISAGISMO");
  // TAXAS tem lançamento e não existe no orçamento: vira etapa sem valor orçado.
  assert.equal(etapaDe["TAXAS"], "TAXAS");
  assert.equal(pacote.etapas.find((e) => e.nome === "TAXAS")?.valor_orcado, 0);
  assert.match(avisos.join(" "), /TAXAS/);

  assert.deepEqual(pacote.fornecedores.find((f) => f.nome === "LOJA A"), { nome: "LOJA A", categoria: "MAT. CONSTRUÇÃO" });
  assert.ok(pacote.fornecedores.some((f) => f.nome === "PREFEITURA"));
});

test("sugere etapa ignorando acentos e caixa", () => {
  assert.equal(sugerirEtapa("Inst-Elétrica", ["INSTALAÇÕES ELÉTRICAS"]), "INSTALAÇÕES ELÉTRICAS");
  assert.equal(sugerirEtapa("Alvenaria", ["ALVENARIA"]), "ALVENARIA");
  assert.equal(sugerirEtapa("Qualquer coisa", ["ALVENARIA"]), null);
});

test("planilha sem aba LANÇAMENTO dá erro claro", () => {
  assert.throws(() => lerCentroDeCustos([{ sheet: "OUTRA", data: [] }]), /LANÇAMENTO/);
});
