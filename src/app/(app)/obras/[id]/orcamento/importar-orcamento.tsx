"use client";

import readExcelFile from "read-excel-file/browser";
import { useState, useTransition } from "react";
import { reais } from "@/lib/formato";
import { lerColado, lerOrcamento, normalizar, totalEtapa, type Celula, type EtapaOrcamento } from "@/lib/orcamento";
import { importarOrcamento } from "./acoes";

// Importa o orçamento da planilha (arquivo .xlsx ou trecho colado do Excel), com prévia antes de gravar.
export function ImportarOrcamento({ obraId, aberto }: { obraId: string; aberto: boolean }) {
  const [resultado, setResultado] = useState<{ etapas: EtapaOrcamento[]; avisos: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [colado, setColado] = useState("");
  const [gravando, iniciar] = useTransition();

  function processar(linhas: Celula[][]) {
    setErro(null);
    setFeito(null);
    const r = lerOrcamento(linhas);
    if (r.etapas.length === 0) setErro("Não achei etapas com itens. Confira se a planilha tem as colunas Descrição, Quant., Und. e Custo unit.");
    setResultado(r);
  }

  async function lerArquivo(arquivo: File) {
    try {
      const abas = (await readExcelFile(arquivo)) as unknown as { sheet: string; data: Celula[][] }[];
      const aba = abas.find((a) => normalizar(a.sheet).includes("ORCAMENTO")) ?? abas[0];
      processar(aba.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    }
  }

  function gravar() {
    if (!resultado) return;
    iniciar(async () => {
      const r = await importarOrcamento(obraId, resultado.etapas);
      if (r.erro) setErro(r.erro);
      else {
        setFeito(`${r.itens} itens importados.`);
        setResultado(null);
        setColado("");
      }
    });
  }

  const total = resultado?.etapas.reduce((s, e) => s + totalEtapa(e), 0) ?? 0;

  return (
    <details className="cartao" open={aberto}>
      <summary className="cursor-pointer font-semibold">Importar orçamento da planilha</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-stone-600">
          Use a sua planilha de orçamento (títulos das etapas e, abaixo, os itens com Descrição, Quant., Und. e Custo unit.).
          As etapas importadas têm os itens substituídos; as outras ficam como estão.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx" onChange={(e) => e.target.files?.[0] && lerArquivo(e.target.files[0])} className="text-sm" />
          <span className="text-stone-400">ou</span>
        </div>
        <textarea
          className="campo h-28 font-mono text-xs"
          placeholder="Cole aqui as linhas copiadas do Excel (Ctrl+C na planilha, Ctrl+V aqui)"
          value={colado}
          onChange={(e) => setColado(e.target.value)}
        />
        {colado.trim() && <button type="button" className="botao-secundario" onClick={() => processar(lerColado(colado))}>Ler o que colei</button>}

        {erro && <p className="text-red-600">{erro}</p>}
        {feito && <p className="text-emerald-700">✓ {feito}</p>}

        {resultado && resultado.etapas.length > 0 && (
          <div className="space-y-2">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th className="text-right">Itens</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {resultado.etapas.map((e) => (
                  <tr key={e.nome}>
                    <td>{e.nome}</td>
                    <td className="text-right tabular-nums">{e.itens.length}</td>
                    <td className="text-right tabular-nums">{reais(totalEtapa(e))}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td>Total</td>
                  <td className="text-right tabular-nums">{resultado.etapas.reduce((s, e) => s + e.itens.length, 0)}</td>
                  <td className="text-right tabular-nums">{reais(total)}</td>
                </tr>
              </tbody>
            </table>
            {resultado.avisos.map((a) => <p key={a} className="text-xs text-amber-700">{a}</p>)}
            <button type="button" className="botao" onClick={gravar} disabled={gravando}>{gravando ? "Gravando..." : "Gravar orçamento"}</button>
          </div>
        )}
      </div>
    </details>
  );
}
