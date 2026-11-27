"use client";

import { useState } from "react";
import { salvarLancamento } from "../acoes";
import { lerArquivo, valorBrTexto } from "./ler";

type Opcao = { id: string; nome: string };

type Item = {
  chave: string;
  arquivo: string;
  lendo: boolean;
  caminho: string;
  data: string;
  valor: string;
  fornecedor: string;
  descricao: string;
  apropriacao_id: string;
  aviso?: string;
};

// Vários comprovantes de uma vez: cada um vira uma linha já preenchida; você escolhe a apropriação e lança todos.
export function LoteComprovantes({
  obraId,
  apropriacoes,
  grupos,
  medicaoPadrao,
}: {
  obraId: string;
  apropriacoes: Opcao[];
  grupos: Opcao[];
  medicaoPadrao: number;
}) {
  const [itens, setItens] = useState<Item[]>([]);
  const [medicao, setMedicao] = useState(String(medicaoPadrao));
  const [status, setStatus] = useState("pago");
  const [grupo, setGrupo] = useState("");
  const [lancando, setLancando] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);

  const mudar = (chave: string, campos: Partial<Item>) =>
    setItens((lista) => lista.map((i) => (i.chave === chave ? { ...i, ...campos } : i)));

  async function receber(arquivos: File[]) {
    setResumo(null);
    const hoje = new Date().toLocaleDateString("sv-SE");
    const novos: Item[] = arquivos.map((f) => ({
      chave: crypto.randomUUID(),
      arquivo: f.name,
      lendo: true,
      caminho: "",
      data: hoje,
      valor: "",
      fornecedor: "",
      descricao: "",
      apropriacao_id: "",
    }));
    setItens((lista) => [...lista, ...novos]);
    // Um de cada vez: o leitor fica carregado e o celular não trava.
    for (let n = 0; n < arquivos.length; n++) {
      const r = await lerArquivo(obraId, arquivos[n]);
      mudar(novos[n].chave, {
        lendo: false,
        caminho: r.caminho ?? "",
        data: r.data ?? hoje,
        valor: valorBrTexto(r.valor),
        fornecedor: r.favorecido?.toUpperCase() ?? "",
        descricao: r.descricao?.toUpperCase() ?? "",
        aviso: r.erro,
      });
    }
  }

  async function lancarTodos() {
    setLancando(true);
    setResumo(null);
    let ok = 0;
    for (const item of itens) {
      if (item.lendo) continue;
      const form = new FormData();
      for (const campo of ["data", "valor", "fornecedor", "descricao", "apropriacao_id"] as const) form.set(campo, item[campo]);
      form.set("comprovante_path", item.caminho);
      form.set("medicao", medicao);
      form.set("status", status);
      form.set("grupo_id", grupo);
      const r = await salvarLancamento(obraId, {}, form);
      if (r.erro) mudar(item.chave, { aviso: r.erro });
      else {
        ok++;
        setItens((lista) => lista.filter((i) => i.chave !== item.chave));
      }
    }
    setLancando(false);
    setResumo(ok ? `✓ ${ok} lançamento${ok > 1 ? "s" : ""} feito${ok > 1 ? "s" : ""}.` : null);
  }

  const lendo = itens.some((i) => i.lendo);
  const prontos = itens.filter((i) => !i.lendo && i.apropriacao_id && i.valor).length;

  return (
    <section className="cartao space-y-3">
      <h2 className="font-semibold">Vários comprovantes de uma vez</h2>
      <div className="flex flex-wrap items-center gap-3">
        <label className={`botao-secundario cursor-pointer ${lancando ? "pointer-events-none opacity-50" : ""}`}>
          📚 Escolher comprovantes
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (fs.length) receber(fs);
            }}
          />
        </label>
        <span className="text-sm text-stone-600">
          Selecione vários PIX, boletos ou recibos. Cada um vira uma linha: confira e escolha a apropriação.
        </span>
        {resumo && <span className="text-sm font-medium text-emerald-700">{resumo}</span>}
      </div>

      {itens.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="rotulo" htmlFor="lote-medicao">Nº medição (todos)</label>
              <input className="campo" id="lote-medicao" inputMode="numeric" value={medicao} onChange={(e) => setMedicao(e.target.value)} />
            </div>
            <div>
              <label className="rotulo" htmlFor="lote-status">Situação (todos)</label>
              <select className="campo" id="lote-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pago">Pago</option>
                <option value="a_pagar">A pagar</option>
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="lote-grupo">Grupo (todos)</label>
              <select className="campo" id="lote-grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                <option value="">—</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="lote-aprop">Apropriação para todos</label>
              <select
                className="campo"
                id="lote-aprop"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setItens((lista) => lista.map((i) => ({ ...i, apropriacao_id: v })));
                }}
              >
                <option value="">Aplicar em todas as linhas…</option>
                {apropriacoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
          </div>

          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200">
            {itens.map((i) => (
              <li key={i.chave} className="grid gap-2 p-3 sm:grid-cols-12 sm:items-end">
                <p className="truncate text-xs text-stone-500 sm:col-span-12">
                  📎 {i.arquivo} {i.lendo && <span className="font-medium text-amber-700">· lendo…</span>}
                </p>
                <input className="campo sm:col-span-2" type="date" aria-label="Data" value={i.data} disabled={i.lendo} onChange={(e) => mudar(i.chave, { data: e.target.value })} />
                <input className="campo sm:col-span-2" inputMode="decimal" placeholder="Valor" aria-label="Valor" value={i.valor} disabled={i.lendo} onChange={(e) => mudar(i.chave, { valor: e.target.value })} />
                <input className="campo sm:col-span-3" placeholder="Fornecedor" aria-label="Fornecedor" list="lista-fornecedores" value={i.fornecedor} disabled={i.lendo} onChange={(e) => mudar(i.chave, { fornecedor: e.target.value })} />
                <input className="campo sm:col-span-2" placeholder="Descrição" aria-label="Descrição" value={i.descricao} disabled={i.lendo} onChange={(e) => mudar(i.chave, { descricao: e.target.value })} />
                <select
                  className={`campo sm:col-span-2 ${!i.lendo && !i.apropriacao_id ? "border-amber-500 bg-amber-50" : ""}`}
                  aria-label="Apropriação"
                  value={i.apropriacao_id}
                  disabled={i.lendo}
                  onChange={(e) => mudar(i.chave, { apropriacao_id: e.target.value })}
                >
                  <option value="">Apropriação…</option>
                  {apropriacoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
                <button
                  type="button"
                  className="text-sm text-red-600 underline sm:col-span-1 sm:self-center"
                  onClick={() => setItens((lista) => lista.filter((x) => x.chave !== i.chave))}
                >
                  remover
                </button>
                {i.aviso && <p className="text-sm text-amber-700 sm:col-span-12">{i.aviso}</p>}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="botao" disabled={lancando || lendo || prontos !== itens.length} onClick={lancarTodos}>
              {lancando ? "Lançando…" : `Lançar ${itens.length > 1 ? `os ${itens.length}` : "o lançamento"}`}
            </button>
            <span className="text-sm text-stone-600">
              {lendo
                ? "Lendo os comprovantes…"
                : prontos === itens.length
                  ? "Tudo pronto."
                  : `Falta escolher a apropriação (ou o valor) em ${itens.length - prontos} linha${itens.length - prontos > 1 ? "s" : ""}.`}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
