import { test } from "node:test";
import assert from "node:assert/strict";
import { classificar, lerColado, lerOrcamento, numero, totalEtapa } from "../src/lib/orcamento.ts";

// Dados fictícios no formato do modelo "ORÇAMENTO GERAL DE OBRA".
const planilha = [
  ["ORÇAMENTO GERAL DE OBRA", null, null, null, null],
  [null, null, null, "CUSTO TOTAL", 100000],
  ["DESCRIÇÃO", "QUANT.", "UND.", "CUSTO UNIT.", "CUSTO TOTAL"],
  ["SERVIÇOS INICIAIS", null, null, null, null],
  ["Sondagem do terreno", 1, "vb", 3000, 3000],
  ["Locação de betoneira", 2, "mês", 400, 800],
  [null, null, null, "Total Item", 3800],
  ["ESTRUTURA", 50, "M3", null, null],
  ["Concreto usinado c/ bomba", 50, "m³", 550, 27500],
  ["Laje vigotada H8", 0, "m2", 50, 0],
  ["Mão de obra empreiteiro", 1, "vb", 10000, 10000],
  [null, null, null, "Total Item", 37500],
  ["COBERTURA", null, null, null, null],
];

test("lê etapas e itens da planilha de orçamento", () => {
  const { etapas, avisos } = lerOrcamento(planilha);
  assert.deepEqual(etapas.map((e) => e.nome), ["SERVIÇOS INICIAIS", "ESTRUTURA"]);
  assert.equal(etapas[0].itens.length, 2);
  assert.equal(totalEtapa(etapas[0]), 3800);
  assert.equal(totalEtapa(etapas[1]), 37500);
  assert.equal(etapas[1].itens[1].tipo, "servico");
  assert.equal(etapas[0].itens[1].tipo, "equipamento");
  assert.ok(avisos.some((a) => a.includes("quantidade zero")));
  assert.ok(avisos.some((a) => a.includes("COBERTURA")));
});

test("aceita trecho colado do Excel com R$ e vírgula", () => {
  const colado = "ALVENARIA\t\t\t\t\nTijolo 12 furos\t1.000,50\tpc\tR$ 1,10\tR$ 1.100,55\nArgamassa\t2\tm3\tR$ 470,00\tR$ 940,00\n\t\t\tTotal Item\tR$ 2.040,55";
  const { etapas } = lerOrcamento(lerColado(colado));
  assert.equal(etapas.length, 1);
  assert.equal(etapas[0].itens[0].quantidade, 1000.5);
  assert.equal(etapas[0].itens[0].custo_unitario, 1.1);
  assert.equal(etapas[0].itens[1].custo_unitario, 470);
});

test("números e classificação", () => {
  assert.equal(numero("R$ 1.234,56"), 1234.56);
  assert.equal(numero("-"), null);
  assert.equal(numero("vb"), null);
  assert.equal(classificar("Concreto usinado c/ bomba estacionária"), "material");
  assert.equal(classificar("Aluguel de andaime"), "equipamento");
});

test("valor digitado com ponto de milhar", async () => {
  const { valorBr } = await import("../src/lib/campos.ts");
  assert.equal(valorBr("1.500"), 1500);
  assert.equal(valorBr("6.275"), 6275);
  assert.equal(valorBr("1.234,56"), 1234.56);
  assert.equal(valorBr("43.2"), 43.2);
  assert.equal(valorBr("6275"), 6275);
  assert.equal(numero("6.275"), 6275);
});
