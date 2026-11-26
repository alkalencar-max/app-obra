import Link from "next/link";
import { notFound } from "next/navigation";
import { hojeBr } from "@/lib/campos";
import { dataBr, reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";
import { marcarPago } from "../../../acoes";
import { registrarRecebimento } from "../../acoes";
import { BotaoImprimir } from "../imprimir";

type Pedido = {
  id: string;
  numero: number;
  data: string;
  total: number;
  status: "emitido" | "recebido" | "cancelado";
  condicao_pagamento: string | null;
  recebido_em: string | null;
  nota_fiscal: string | null;
  proposta_id: string;
  fornecedores: { nome: string; cnpj: string | null; telefone: string | null; chave_pix: string | null } | null;
  cotacoes: { titulo: string; obras: { nome: string; endereco: string | null } | null; apropriacoes: { nome: string } | null } | null;
};

export default async function PedidoPage({ params, searchParams }: PageProps<"/obras/[id]/compras/[cot]/pedido">) {
  const { id, cot } = await params;
  const { novo } = await searchParams;
  const { supabase, empresaNome } = await exigirEmpresa();

  const { data } = await supabase
    .from("pedidos")
    .select(
      "id, numero, data, total, status, condicao_pagamento, recebido_em, nota_fiscal, proposta_id, fornecedores(nome, cnpj, telefone, chave_pix), cotacoes(titulo, obras(nome, endereco), apropriacoes(nome))",
    )
    .eq("cotacao_id", cot)
    .eq("obra_id", id)
    .maybeSingle();
  if (!data) notFound();
  const pedido = data as unknown as Pedido;

  const [{ data: proposta }, { data: itens }, { data: precos }, { data: parcelas }] = await Promise.all([
    supabase.from("cotacao_propostas").select("frete, desconto, prazo_entrega, obs").eq("id", pedido.proposta_id).single(),
    supabase.from("cotacao_itens").select("id, descricao, quantidade, unidade").eq("cotacao_id", cot).order("ordem"),
    supabase.from("cotacao_precos").select("item_id, valor_unitario").eq("proposta_id", pedido.proposta_id),
    supabase.from("lancamentos").select("id, vencimento, data, valor, status, descricao").eq("pedido_id", pedido.id).order("vencimento"),
  ]);

  const linhas = (itens ?? []).map((i) => {
    const unit = Number(precos?.find((p) => p.item_id === i.id)?.valor_unitario ?? 0);
    return { ...i, quantidade: Number(i.quantidade), unit, total: Math.round(unit * Number(i.quantidade) * 100) / 100 };
  });
  const soma = linhas.reduce((s, l) => s + l.total, 0);
  const frete = Number(proposta?.frete ?? 0);
  const desconto = Number(proposta?.desconto ?? 0);
  const f = pedido.fornecedores;

  return (
    <div className="space-y-4">
      {novo && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 print:hidden">Pedido gerado. As parcelas já estão no financeiro como a pagar.</p>}

      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <Link href={`/obras/${id}/compras/${cot}`} className="botao-secundario">Ver mapa de cotações</Link>
        <BotaoImprimir rotulo="Imprimir / salvar PDF" />
      </div>

      <article className="cartao space-y-4 print:border-0 print:p-0">
        <header className="border-b border-stone-200 pb-3 text-center">
          <p className="text-lg font-bold uppercase">{empresaNome} - Pedido de compra</p>
          <p className="text-sm">PED{pedido.numero} - {pedido.cotacoes?.titulo}</p>
        </header>
        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <p><span className="text-stone-500">Data:</span> {dataBr(pedido.data)}</p>
          <p><span className="text-stone-500">Obra:</span> {pedido.cotacoes?.obras?.nome}</p>
          <p className="sm:col-span-2"><span className="text-stone-500">Endereço de entrega:</span> {pedido.cotacoes?.obras?.endereco}</p>
          <p><span className="text-stone-500">Fornecedor:</span> <b>{f?.nome}</b>{f?.cnpj ? ` · CNPJ ${f.cnpj}` : ""}</p>
          <p>{f?.telefone ? <><span className="text-stone-500">Telefone:</span> {f.telefone}</> : null}</p>
        </div>

        <table className="tabela">
          <thead>
            <tr>
              <th>Descrição</th>
              <th className="text-right">Qtde</th>
              <th>Un</th>
              <th className="text-right">R$ unit</th>
              <th className="text-right">R$ total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td>{l.descricao}</td>
                <td className="text-right tabular-nums">{l.quantidade.toLocaleString("pt-BR")}</td>
                <td>{l.unidade}</td>
                <td className="text-right tabular-nums">{reais(l.unit)}</td>
                <td className="text-right tabular-nums">{reais(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-stone-500">Soma</dt><dd className="text-right tabular-nums">{reais(soma)}</dd>
          {frete > 0 && <><dt className="text-stone-500">Adicional de frete</dt><dd className="text-right tabular-nums">{reais(frete)}</dd></>}
          {desconto > 0 && <><dt className="text-stone-500">Desconto à vista/PIX</dt><dd className="text-right tabular-nums">- {reais(desconto)}</dd></>}
          <dt className="font-semibold">Total</dt><dd className="text-right font-semibold tabular-nums">{reais(pedido.total)}</dd>
        </dl>

        <div className="grid gap-1 text-sm">
          <p><span className="text-stone-500">Condição de pagamento:</span> {pedido.condicao_pagamento ?? "—"}</p>
          <p><span className="text-stone-500">Prazo de entrega:</span> {proposta?.prazo_entrega ?? "—"}</p>
          {f?.chave_pix && <p><span className="text-stone-500">Chave PIX:</span> {f.chave_pix}</p>}
          {proposta?.obs && <p><span className="text-stone-500">Obs.:</span> {proposta.obs}</p>}
        </div>

        <p className="pt-10 text-center text-sm">
          <span className="inline-block w-64 border-t border-stone-400 pt-1">{empresaNome}</span>
        </p>
      </article>

      <section className="cartao print:hidden">
        <h3 className="mb-2 font-semibold">Recebimento na obra</h3>
        {pedido.status === "recebido" ? (
          <p className="text-sm text-emerald-700">✓ Recebido em {dataBr(pedido.recebido_em)}{pedido.nota_fiscal ? ` · NF ${pedido.nota_fiscal}` : ""}</p>
        ) : (
          <form action={registrarRecebimento.bind(null, id, cot, pedido.id)} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="rotulo" htmlFor="recebido_em">Data do recebimento</label>
              <input className="campo" id="recebido_em" name="recebido_em" type="date" defaultValue={hojeBr()} required />
            </div>
            <div>
              <label className="rotulo" htmlFor="nota_fiscal">Nº da nota fiscal</label>
              <input className="campo" id="nota_fiscal" name="nota_fiscal" placeholder="ex.: 12345" />
            </div>
            <button className="botao">Confirmar recebimento</button>
          </form>
        )}
      </section>

      <section className="cartao overflow-x-auto print:hidden">
        <h3 className="mb-2 font-semibold">Parcelas no financeiro</h3>
        <table className="tabela">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Descrição</th>
              <th className="text-right">Valor</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {(parcelas ?? []).map((p) => (
              <tr key={p.id}>
                <td>{dataBr(p.vencimento)}</td>
                <td>{p.descricao}</td>
                <td className="text-right tabular-nums">{reais(p.valor)}</td>
                <td>
                  {p.status === "pago" ? (
                    <span className="text-xs text-emerald-700">✓ pago em {dataBr(p.data)}</span>
                  ) : (
                    <form action={marcarPago.bind(null, id)} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <span className="mr-2 text-xs text-amber-700">a pagar</span>
                      <button className="text-xs text-emerald-700 underline">marcar pago</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
