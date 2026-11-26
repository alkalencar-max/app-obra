import Link from "next/link";
import { notFound } from "next/navigation";
import { dataBr } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";
import { cancelarCotacao, definirApropriacao, removerFornecedor } from "../acoes";
import { BotaoImprimir } from "./imprimir";
import { GerarPedido, Mapa, type PropostaMapa } from "./mapa";

export default async function CotacaoPage({ params }: PageProps<"/obras/[id]/compras/[cot]">) {
  const { id, cot } = await params;
  const { supabase, empresaNome } = await exigirEmpresa();

  const { data: cotacao } = await supabase
    .from("cotacoes")
    .select("id, numero, titulo, data, status, apropriacao_id, grupo_id, obras(nome), pedidos(id)")
    .eq("id", cot)
    .eq("obra_id", id)
    .maybeSingle();
  if (!cotacao) notFound();

  const [{ data: itens }, { data: props }, { data: precos }, { data: totais }, { data: apropriacoes }, { data: grupos }, { data: fornecedores }] =
    await Promise.all([
      supabase.from("cotacao_itens").select("id, descricao, quantidade, unidade").eq("cotacao_id", cot).order("ordem"),
      supabase
        .from("cotacao_propostas")
        .select("id, frete, desconto, condicao_pagamento, prazo_entrega, fornecedores(nome)")
        .eq("cotacao_id", cot)
        .order("ordem"),
      supabase.from("cotacao_precos").select("proposta_id, item_id, valor_unitario").eq("cotacao_id", cot),
      supabase.from("v_proposta_total").select("proposta_id, total, itens_cotados").eq("cotacao_id", cot),
      supabase.from("apropriacoes").select("id, nome").eq("obra_id", id).order("nome"),
      supabase.from("grupos").select("id, nome").order("ordem").order("nome"),
      supabase.from("fornecedores").select("nome").order("nome"),
    ]);

  const propostas: PropostaMapa[] = (props ?? []).map((p) => ({
    id: p.id,
    fornecedor: (p.fornecedores as unknown as { nome: string } | null)?.nome ?? "",
    frete: Number(p.frete),
    desconto: Number(p.desconto),
    condicao: p.condicao_pagamento,
    prazo: p.prazo_entrega,
    precos: Object.fromEntries((precos ?? []).filter((x) => x.proposta_id === p.id).map((x) => [x.item_id, Number(x.valor_unitario)])),
  }));
  const listaItens = (itens ?? []).map((i) => ({ ...i, quantidade: Number(i.quantidade) }));
  const opcoes = propostas
    .map((p) => ({ id: p.id, fornecedor: p.fornecedor, condicao: p.condicao, total: Number(totais?.find((t) => t.proposta_id === p.id)?.total ?? 0) }))
    .filter((o) => o.total > 0);
  const pedido = cotacao.pedidos as unknown as { id: string } | { id: string }[] | null;
  const temPedido = Array.isArray(pedido) ? pedido.length > 0 : !!pedido;
  const aberta = cotacao.status === "aberta";
  const obra = (cotacao.obras as unknown as { nome: string } | null)?.nome;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500 print:block">{empresaNome} · Mapa de cotações</p>
          <h2 className="text-xl font-bold">COT{cotacao.numero} - {cotacao.titulo}</h2>
          <p className="text-sm text-stone-500">Data {dataBr(cotacao.data)} · Obra {obra}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          {temPedido && <Link href={`/obras/${id}/compras/${cot}/pedido`} className="botao">Ver pedido PED{cotacao.numero}</Link>}
          <BotaoImprimir />
          {aberta && (
            <form action={cancelarCotacao.bind(null, id, cot)}>
              <button className="botao-secundario text-stone-500">Cancelar cotação</button>
            </form>
          )}
        </div>
      </div>

      {aberta && (
        <form action={definirApropriacao.bind(null, id, cot)} className="flex flex-wrap items-end gap-2 text-sm print:hidden">
          <div>
            <label className="rotulo" htmlFor="apropriacao_id">Apropriação</label>
            <select className="campo w-auto" id="apropriacao_id" name="apropriacao_id" defaultValue={cotacao.apropriacao_id ?? ""}>
              <option value="">escolha</option>
              {(apropriacoes ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="grupo_id">Grupo</label>
            <select className="campo w-auto" id="grupo_id" name="grupo_id" defaultValue={cotacao.grupo_id ?? ""}>
              <option value="">sem grupo</option>
              {(grupos ?? []).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          <button className="botao-secundario">Salvar</button>
        </form>
      )}

      {propostas.length === 0 ? (
        <p className="cartao text-sm text-stone-600">Nenhum fornecedor ainda. Inclua o primeiro abaixo.</p>
      ) : null}
      <Mapa obraId={id} cotacaoId={cot} itens={listaItens} propostas={propostas} editavel={aberta} />
      <datalist id="fornecedores-cot">
        {(fornecedores ?? []).map((f) => <option key={f.nome} value={f.nome} />)}
      </datalist>

      {aberta && propostas.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-stone-500 print:hidden">
          {propostas.map((p) => (
            <form key={p.id} action={removerFornecedor.bind(null, id, cot)}>
              <input type="hidden" name="proposta_id" value={p.id} />
              <button className="hover:text-red-600">remover {p.fornecedor}</button>
            </form>
          ))}
        </div>
      )}

      {aberta && <GerarPedido obraId={id} cotacaoId={cot} opcoes={opcoes} semApropriacao={!cotacao.apropriacao_id} />}
      {cotacao.status === "cancelada" && <p className="text-sm text-stone-500">Esta cotação foi cancelada.</p>}
    </div>
  );
}
