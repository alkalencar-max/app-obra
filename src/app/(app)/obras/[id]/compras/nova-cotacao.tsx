"use client";

import { useActionState, useState } from "react";
import { criarCotacao, type Estado } from "./acoes";

type Opcao = { id: string; nome: string };
type Item = { descricao: string; quantidade: string; unidade: string };

const vazio = (): Item => ({ descricao: "", quantidade: "", unidade: "" });

export function NovaCotacao({
  obraId,
  proximoNumero,
  apropriacoes,
  grupos,
  fornecedores,
}: {
  obraId: string;
  proximoNumero: number;
  apropriacoes: Opcao[];
  grupos: Opcao[];
  fornecedores: string[];
}) {
  const [estado, acao, salvando] = useActionState<Estado, FormData>(criarCotacao.bind(null, obraId), {});
  const [itens, setItens] = useState<Item[]>([vazio(), vazio(), vazio()]);
  const muda = (i: number, campo: keyof Item, v: string) => setItens((l) => l.map((it, n) => (n === i ? { ...it, [campo]: v } : it)));
  const materiais = grupos.find((g) => g.nome === "MATERIAIS")?.id ?? "";

  return (
    <form action={acao} className="cartao space-y-4">
      <h2 className="font-semibold">Nova cotação</h2>
      <div className="grid gap-3 sm:grid-cols-6">
        <div>
          <label className="rotulo" htmlFor="numero">Número (COT)</label>
          <input className="campo" id="numero" name="numero" inputMode="numeric" defaultValue={proximoNumero} required />
        </div>
        <div className="sm:col-span-5">
          <label className="rotulo" htmlFor="titulo">Nome da cotação</label>
          <input className="campo" id="titulo" name="titulo" placeholder="ex.: MAT RAMPA E CX DE RETARDO" required />
        </div>
        <div className="sm:col-span-3">
          <label className="rotulo" htmlFor="apropriacao_id">Apropriação (onde o gasto vai entrar)</label>
          <select className="campo" id="apropriacao_id" name="apropriacao_id" defaultValue="">
            <option value="">escolher depois</option>
            {apropriacoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="rotulo" htmlFor="grupo_id">Grupo</label>
          <select className="campo" id="grupo_id" name="grupo_id" defaultValue={materiais}>
            <option value="">sem grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
      </div>

      <div>
        <p className="rotulo">Itens</p>
        <div className="space-y-2">
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_5.5rem_4.5rem_2rem] gap-2">
              <input className="campo" placeholder="Descrição (ex.: CIMENTO VOTORAN 50KG)" value={it.descricao} onChange={(e) => muda(i, "descricao", e.target.value)} aria-label="Descrição" />
              <input className="campo" placeholder="Qtde" inputMode="decimal" value={it.quantidade} onChange={(e) => muda(i, "quantidade", e.target.value)} aria-label="Quantidade" />
              <input className="campo" placeholder="Un" value={it.unidade} onChange={(e) => muda(i, "unidade", e.target.value)} aria-label="Unidade" />
              <button type="button" className="text-stone-400 hover:text-red-600" title="Remover item" onClick={() => setItens((l) => (l.length > 1 ? l.filter((_, n) => n !== i) : l))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="mt-2 text-sm text-amber-700 underline" onClick={() => setItens((l) => [...l, vazio()])}>
          + item
        </button>
        <input type="hidden" name="itens" value={JSON.stringify(itens)} />
      </div>

      <div>
        <p className="rotulo">Fornecedores para cotar</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <input key={n} className="campo" name="fornecedor" list="fornecedores-cot" autoComplete="off" placeholder={`Fornecedor ${n}`} />
          ))}
        </div>
        <datalist id="fornecedores-cot">
          {fornecedores.map((f) => <option key={f} value={f} />)}
        </datalist>
        <p className="mt-1 text-xs text-stone-500">Dá para incluir mais fornecedores depois, no mapa de cotações.</p>
      </div>

      {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      <button className="botao" disabled={salvando}>{salvando ? "Criando..." : "Criar cotação"}</button>
    </form>
  );
}
