"use client";

import readExcelFile from "read-excel-file/browser";
import { useState, useTransition } from "react";
import { reais } from "@/lib/formato";
import { lerCentroDeCustos, type Aba, type ResultadoImportacao } from "@/lib/importador";
import { importarObra } from "./acoes";

export function Importador() {
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [importando, iniciar] = useTransition();

  async function ler(arquivo: File | undefined) {
    setResultado(null);
    setErro(null);
    if (!arquivo) return;
    try {
      const abas = (await readExcelFile(arquivo)) as unknown as Aba[];
      setResultado(lerCentroDeCustos(abas));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    }
  }

  const p = resultado?.pacote;
  const total = p?.lancamentos.reduce((s, l) => s + l.valor, 0) ?? 0;
  const orcado = p?.etapas.reduce((s, e) => s + e.valor_orcado, 0) ?? 0;

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".xlsx"
        className="campo"
        onChange={(e) => ler(e.target.files?.[0])}
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {p && (
        <div className="cartao space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{p.obra.nome}</h2>
            <p className="text-sm text-stone-500">
              {p.obra.endereco} {p.obra.area_m2 ? `· ${p.obra.area_m2} m²` : ""}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Item rotulo="Lançamentos" valor={`${p.lancamentos.length} · ${reais(total)}`} />
            <Item rotulo="Etapas do orçamento" valor={`${p.etapas.length} · ${reais(orcado)}`} />
            <Item rotulo="Apropriações" valor={String(p.apropriacoes.length)} />
            <Item rotulo="Fornecedores" valor={String(p.fornecedores.length)} />
          </dl>
          {resultado.avisos.length > 0 && (
            <ul className="list-disc space-y-1 rounded-md bg-amber-50 p-3 pl-6 text-sm text-amber-900">
              {resultado.avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-medium">Ver como cada apropriação entra no orçamento</summary>
            <table className="tabela mt-2">
              <thead>
                <tr><th>Apropriação</th><th>Etapa do orçamento</th></tr>
              </thead>
              <tbody>
                {p.apropriacoes.map((a) => (
                  <tr key={a.nome}>
                    <td>{a.nome}</td>
                    <td className={a.etapa ? "" : "text-stone-400"}>{a.etapa ?? "sem etapa (sem lançamentos)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <button
            className="botao"
            disabled={importando}
            onClick={() =>
              iniciar(async () => {
                const r = await importarObra(p);
                if (r?.erro) setErro(r.erro);
              })
            }
          >
            {importando ? "Importando…" : "Confirmar e importar"}
          </button>
        </div>
      )}
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{rotulo}</dt>
      <dd className="font-semibold">{valor}</dd>
    </div>
  );
}
