"use client";

import { useActionState, useMemo, useState } from "react";
import { reais } from "@/lib/formato";
import { dividirParcelas, valorBr } from "@/lib/campos";
import { gerarPedido, salvarMapa, type Estado } from "../acoes";

export type ItemMapa = { id: string; descricao: string; quantidade: number; unidade: string | null };
export type PropostaMapa = {
  id: string;
  fornecedor: string;
  frete: number;
  desconto: number;
  condicao: string | null;
  prazo: string | null;
  precos: Record<string, number>;
};

const num = (s: string) => {
  const v = valorBr(s);
  return s.trim() && Number.isFinite(v) ? v : null;
};
const br = (v: number | null | undefined) => (v == null ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false }));

// Mapa de cotações: uma coluna por fornecedor, totais ao vivo e o menor total destacado.
export function Mapa({ obraId, cotacaoId, itens, propostas, editavel }: { obraId: string; cotacaoId: string; itens: ItemMapa[]; propostas: PropostaMapa[]; editavel: boolean }) {
  const [estado, acao, salvando] = useActionState<Estado, FormData>(salvarMapa.bind(null, obraId, cotacaoId), {});
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const p of propostas) {
      for (const i of itens) v[`preco_${p.id}_${i.id}`] = br(p.precos[i.id]);
      v[`frete_${p.id}`] = p.frete ? br(p.frete) : "";
      v[`desconto_${p.id}`] = p.desconto ? br(p.desconto) : "";
    }
    return v;
  });
  const [alterado, setAlterado] = useState(false);
  const muda = (k: string, v: string) => {
    setValores((o) => ({ ...o, [k]: v }));
    setAlterado(true);
  };

  const totais = useMemo(
    () =>
      propostas.map((p) => {
        let soma = 0, cotados = 0;
        for (const i of itens) {
          const u = num(valores[`preco_${p.id}_${i.id}`] ?? "");
          if (u != null) { soma += Math.round(u * i.quantidade * 100) / 100; cotados++; }
        }
        const frete = num(valores[`frete_${p.id}`] ?? "") ?? 0;
        const desconto = num(valores[`desconto_${p.id}`] ?? "") ?? 0;
        return { soma, frete, desconto, total: soma + frete - desconto, completo: cotados === itens.length };
      }),
    [propostas, itens, valores],
  );
  const completos = totais.filter((t) => t.completo && t.soma > 0).map((t) => t.total);
  const menor = completos.length ? Math.min(...completos) : null;

  const campo = (k: string, placeholder = "") =>
    editavel ? (
      <input
        className="w-full rounded border border-stone-200 px-1.5 py-1 text-right tabular-nums outline-none focus:border-amber-500"
        name={k}
        value={valores[k] ?? ""}
        onChange={(e) => muda(k, e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
      />
    ) : (
      <span className="tabular-nums">{valores[k] ? reais(num(valores[k])) : ""}</span>
    );

  return (
    <form action={acao} className="cartao space-y-3 overflow-x-auto" onSubmit={() => setAlterado(false)}>
      <table className="tabela min-w-[640px]">
        <thead>
          <tr>
            <th rowSpan={2}>Descrição</th>
            <th rowSpan={2} className="text-right">Qtde</th>
            <th rowSpan={2}>Un</th>
            {propostas.map((p, n) => (
              <th key={p.id} colSpan={2} className={`text-center ${menor != null && totais[n].completo && totais[n].total === menor ? "bg-emerald-50 text-emerald-800" : ""}`}>
                {p.fornecedor}
              </th>
            ))}
          </tr>
          <tr>
            {propostas.map((p) => (
              <th key={p.id} colSpan={2} className="text-center font-normal normal-case">R$ unit · R$ total</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.id}>
              <td>{i.descricao}</td>
              <td className="text-right tabular-nums">{br(i.quantidade)}</td>
              <td>{i.unidade}</td>
              {propostas.map((p) => {
                const u = num(valores[`preco_${p.id}_${i.id}`] ?? "");
                return [
                  <td key={`${p.id}u`} className="w-28">{campo(`preco_${p.id}_${i.id}`)}</td>,
                  <td key={`${p.id}t`} className="w-28 text-right tabular-nums text-stone-600">{u == null ? "" : reais(u * i.quantidade)}</td>,
                ];
              })}
            </tr>
          ))}
          <Linha rotulo="Soma" valores={totais.map((t) => reais(t.soma))} />
          <tr>
            <td colSpan={3} className="text-stone-600">Adicional de frete</td>
            {propostas.map((p) => <td key={p.id} colSpan={2}>{campo(`frete_${p.id}`, "0,00")}</td>)}
          </tr>
          <tr>
            <td colSpan={3} className="text-stone-600">Desconto à vista ou PIX</td>
            {propostas.map((p) => <td key={p.id} colSpan={2}>{campo(`desconto_${p.id}`, "0,00")}</td>)}
          </tr>
          <tr className="font-semibold">
            <td colSpan={3}>Total</td>
            {totais.map((t, n) => (
              <td key={n} colSpan={2} className={`text-right tabular-nums ${menor != null && t.completo && t.total === menor ? "bg-emerald-50 text-emerald-800" : ""}`}>
                {reais(t.total)}
                {menor != null && t.completo && t.total === menor && <span className="ml-1 text-xs font-normal">✓ menor</span>}
                {!t.completo && t.soma > 0 && <span className="block text-xs font-normal text-amber-700">faltam itens</span>}
              </td>
            ))}
          </tr>
          <tr>
            <td colSpan={3} className="text-stone-600">Condição de pagamento</td>
            {propostas.map((p) => (
              <td key={p.id} colSpan={2}>
                {editavel ? <input className="w-full rounded border border-stone-200 px-1.5 py-1 text-xs" name={`condicao_${p.id}`} defaultValue={p.condicao ?? ""} placeholder="ex.: 30/60/90" onChange={() => setAlterado(true)} /> : <span className="text-xs">{p.condicao}</span>}
              </td>
            ))}
          </tr>
          <tr>
            <td colSpan={3} className="text-stone-600">Prazo de entrega</td>
            {propostas.map((p) => (
              <td key={p.id} colSpan={2}>
                {editavel ? <input className="w-full rounded border border-stone-200 px-1.5 py-1 text-xs" name={`prazo_${p.id}`} defaultValue={p.prazo ?? ""} placeholder="ex.: 5 dias" onChange={() => setAlterado(true)} /> : <span className="text-xs">{p.prazo}</span>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {editavel && (
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div>
            <label className="rotulo" htmlFor="novo_fornecedor">Incluir fornecedor</label>
            <input className="campo w-56" id="novo_fornecedor" name="novo_fornecedor" list="fornecedores-cot" autoComplete="off" placeholder="nome do fornecedor" onChange={() => setAlterado(true)} />
          </div>
          <button className="botao" disabled={salvando}>{salvando ? "Salvando..." : "Salvar preços"}</button>
          {alterado && !salvando && <span className="text-xs text-amber-700">Há alterações não salvas.</span>}
          {estado.erro && <span className="text-sm text-red-600">{estado.erro}</span>}
        </div>
      )}
    </form>
  );
}

function Linha({ rotulo, valores }: { rotulo: string; valores: string[] }) {
  return (
    <tr className="text-stone-700">
      <td colSpan={3}>{rotulo}</td>
      {valores.map((v, n) => <td key={n} colSpan={2} className="text-right tabular-nums">{v}</td>)}
    </tr>
  );
}

// Escolhe o fornecedor, a forma de pagamento e gera o pedido com as parcelas a pagar.
export function GerarPedido({
  obraId,
  cotacaoId,
  opcoes,
  semApropriacao,
}: {
  obraId: string;
  cotacaoId: string;
  opcoes: { id: string; fornecedor: string; total: number; condicao: string | null }[];
  semApropriacao: boolean;
}) {
  const [estado, acao, gerando] = useActionState<Estado, FormData>(gerarPedido.bind(null, obraId, cotacaoId), {});
  const menor = [...opcoes].sort((a, b) => a.total - b.total)[0];
  const [escolhida, setEscolhida] = useState(menor?.id ?? "");
  const [parcelas, setParcelas] = useState("1");
  const [intervalo, setIntervalo] = useState("30");
  const [vencimento, setVencimento] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const total = opcoes.find((o) => o.id === escolhida)?.total ?? 0;
  const previa = total > 0 && vencimento ? dividirParcelas(total, Math.max(1, Math.min(60, Number(parcelas) || 1)), vencimento, Number(intervalo) || 30) : [];

  if (opcoes.length === 0) return <p className="cartao text-sm text-stone-600">Preencha e salve os preços de pelo menos um fornecedor para gerar o pedido.</p>;

  return (
    <form action={acao} className="cartao space-y-3 print:hidden">
      <h2 className="font-semibold">Gerar pedido de compra</h2>
      {semApropriacao && <p className="text-sm text-amber-700">Escolha a apropriação da cotação (acima) antes de gerar o pedido.</p>}
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="rotulo" htmlFor="proposta_id">Fornecedor</label>
          <select className="campo" id="proposta_id" name="proposta_id" value={escolhida} onChange={(e) => setEscolhida(e.target.value)}>
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>{o.fornecedor} · {reais(o.total)}{o.id === menor?.id ? " (menor)" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="parcelas">Parcelas</label>
          <input className="campo" id="parcelas" name="parcelas" inputMode="numeric" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="primeiro_vencimento">1º vencimento</label>
          <input className="campo" id="primeiro_vencimento" name="primeiro_vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="intervalo">A cada (dias)</label>
          <input className="campo" id="intervalo" name="intervalo" inputMode="numeric" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="condicao">Condição (texto)</label>
          <input className="campo" id="condicao" name="condicao" key={escolhida} defaultValue={opcoes.find((o) => o.id === escolhida)?.condicao ?? ""} placeholder="ex.: PIX à vista" />
        </div>
      </div>
      {previa.length > 0 && (
        <p className="text-xs text-stone-600">
          Vai lançar no financeiro como <b>a pagar</b>: {previa.map((p) => `${p.vencimento.split("-").reverse().join("/")} ${reais(p.valor)}`).join(" · ")}
        </p>
      )}
      {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      <button className="botao" disabled={gerando || semApropriacao}>{gerando ? "Gerando..." : "Gerar pedido"}</button>
    </form>
  );
}
