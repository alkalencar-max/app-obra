"use client";

import { useActionState, useEffect, useRef } from "react";
import { salvarLancamento, type EstadoLancamento } from "../acoes";

type Opcao = { id: string; nome: string };

export function FormLancamento({
  obraId,
  apropriacoes,
  grupos,
  fornecedores,
  medicaoPadrao,
}: {
  obraId: string;
  apropriacoes: Opcao[];
  grupos: Opcao[];
  fornecedores: string[];
  medicaoPadrao: number;
}) {
  const [estado, acao, salvando] = useActionState<EstadoLancamento, FormData>(salvarLancamento.bind(null, obraId), {});
  const form = useRef<HTMLFormElement>(null);

  // Depois de salvar, limpa o valor e a descrição e mantém o resto (data, BM, apropriação) para o próximo.
  useEffect(() => {
    if (!estado.ok || !form.current) return;
    for (const campo of ["valor", "descricao", "obs"]) {
      const el = form.current.elements.namedItem(campo) as HTMLInputElement | null;
      if (el) el.value = "";
    }
    (form.current.elements.namedItem("valor") as HTMLInputElement | null)?.focus();
  }, [estado.ok]);

  const hoje = new Date().toLocaleDateString("sv-SE");

  return (
    <form ref={form} action={acao} className="cartao grid gap-3 sm:grid-cols-6">
      <h2 className="font-semibold sm:col-span-6">Novo lançamento</h2>
      <div>
        <label className="rotulo" htmlFor="data">Data</label>
        <input className="campo" id="data" name="data" type="date" defaultValue={hoje} required />
      </div>
      <div>
        <label className="rotulo" htmlFor="valor">Valor (R$)</label>
        <input className="campo" id="valor" name="valor" inputMode="decimal" placeholder="0,00" required />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="fornecedor">Fornecedor</label>
        <input className="campo" id="fornecedor" name="fornecedor" list="lista-fornecedores" autoComplete="off" />
        <datalist id="lista-fornecedores">
          {fornecedores.map((f) => <option key={f} value={f} />)}
        </datalist>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="descricao">Pedido / breve descrição</label>
        <input className="campo" id="descricao" name="descricao" placeholder="ex.: PED87 - AREIA E BRITA" />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="apropriacao_id">Apropriação</label>
        <select className="campo" id="apropriacao_id" name="apropriacao_id" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          {apropriacoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="grupo_id">Grupo</label>
        <select className="campo" id="grupo_id" name="grupo_id" defaultValue="">
          <option value="">—</option>
          {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
      </div>
      <div>
        <label className="rotulo" htmlFor="medicao">Nº medição</label>
        <input className="campo" id="medicao" name="medicao" inputMode="numeric" defaultValue={medicaoPadrao} />
      </div>
      <div>
        <label className="rotulo" htmlFor="status">Situação</label>
        <select className="campo" id="status" name="status" defaultValue="pago">
          <option value="pago">Pago</option>
          <option value="a_pagar">A pagar</option>
        </select>
      </div>
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor="obs">Obs</label>
        <input className="campo" id="obs" name="obs" />
      </div>
      <div className="flex items-end gap-3 sm:col-span-2">
        <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Lançar"}</button>
        {estado.erro && <span className="text-sm text-red-600">{estado.erro}</span>}
        {estado.ok && !estado.erro && <span className="text-sm text-emerald-700">Lançado!</span>}
      </div>
    </form>
  );
}
