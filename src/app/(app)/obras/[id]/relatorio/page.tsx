import Link from "next/link";
import { dataBr, porcento, reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";
import { BotaoImprimir } from "../compras/[cot]/imprimir";

type PedidoLinha = {
  numero: number;
  data: string;
  total: number;
  status: string;
  cotacao_id: string;
  fornecedores: { nome: string } | null;
  cotacoes: { titulo: string; apropriacoes: { etapa_id: string | null } | null } | null;
};

const VISOES = [
  { valor: "tudo", nome: "Orçado x pedido x pago" },
  { valor: "pedido", nome: "Só o que está pedido" },
  { valor: "pago", nome: "Só o que está pago" },
] as const;

// Relatório orçado x pedido x pago por etapa, com os pedidos de cada etapa.
export default async function Relatorio({ params, searchParams }: PageProps<"/obras/[id]/relatorio">) {
  const { id } = await params;
  const sp = await searchParams;
  const ver = VISOES.find((v) => v.valor === sp.ver)?.valor ?? "tudo";
  const { supabase } = await exigirEmpresa();

  const [{ data: obra }, { data: etapas }, { data: pedidosEtapa }, { data: pedidosData }] = await Promise.all([
    supabase.from("obras").select("nome").eq("id", id).single(),
    supabase.from("v_etapa_resumo").select("etapa_id, nome, ordem, orcado, pago, a_pagar").eq("obra_id", id).order("ordem"),
    supabase.from("v_etapa_pedido").select("etapa_id, pedido").eq("obra_id", id),
    supabase
      .from("pedidos")
      .select("numero, data, total, status, cotacao_id, fornecedores(nome), cotacoes(titulo, apropriacoes(etapa_id))")
      .eq("obra_id", id)
      .neq("status", "cancelado")
      .order("numero"),
  ]);
  const pedidos = (pedidosData ?? []) as unknown as PedidoLinha[];

  const linhas = (etapas ?? []).map((e) => {
    const pedido = Number(pedidosEtapa?.find((p) => p.etapa_id === e.etapa_id)?.pedido ?? 0);
    const orcado = Number(e.orcado), pago = Number(e.pago), aPagar = Number(e.a_pagar);
    return { ...e, orcado, pago, aPagar, pedido, peds: pedidos.filter((p) => (p.cotacoes?.apropriacoes?.etapa_id ?? null) === e.etapa_id) };
  });
  const soma = (k: "orcado" | "pago" | "aPagar" | "pedido") => linhas.reduce((s, l) => s + l[k], 0);
  const T = { orcado: soma("orcado"), pago: soma("pago"), aPagar: soma("aPagar"), pedido: soma("pedido") };

  const colunas =
    ver === "pedido"
      ? [
          { nome: "Orçado", v: (l: typeof T) => l.orcado },
          { nome: "Pedido", v: (l: typeof T) => l.pedido },
          { nome: "Saldo após pedidos", v: (l: typeof T) => l.orcado - l.pedido, saldo: true },
        ]
      : ver === "pago"
        ? [
            { nome: "Orçado", v: (l: typeof T) => l.orcado },
            { nome: "Pago", v: (l: typeof T) => l.pago },
            { nome: "Saldo", v: (l: typeof T) => l.orcado - l.pago, saldo: true },
          ]
        : [
            { nome: "Orçado", v: (l: typeof T) => l.orcado },
            { nome: "Pedido", v: (l: typeof T) => l.pedido },
            { nome: "Pago", v: (l: typeof T) => l.pago },
            { nome: "A pagar", v: (l: typeof T) => l.aPagar },
            { nome: "Saldo (orçado − pago − a pagar)", v: (l: typeof T) => l.orcado - l.pago - l.aPagar, saldo: true },
          ];
  const base = ver === "pedido" ? (l: typeof T) => l.pedido : ver === "pago" ? (l: typeof T) => l.pago : (l: typeof T) => l.pago + l.aPagar;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Relatório {VISOES.find((v) => v.valor === ver)?.nome.toLowerCase()}</h2>
          <p className="text-sm text-stone-500">{obra?.nome} · emitido em {dataBr(new Date().toISOString())}</p>
        </div>
        <div className="flex flex-wrap gap-1 print:hidden">
          {VISOES.map((v) => (
            <Link
              key={v.valor}
              href={`/obras/${id}/relatorio?ver=${v.valor}`}
              className={`rounded-md border px-3 py-1.5 text-sm ${ver === v.valor ? "border-amber-500 bg-amber-50 font-semibold" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"}`}
            >
              {v.nome}
            </Link>
          ))}
          <BotaoImprimir />
        </div>
      </div>

      <section className="cartao overflow-x-auto">
        <table className="tabela min-w-[720px]">
          <thead>
            <tr>
              <th>Etapa</th>
              {colunas.map((c) => <th key={c.nome} className="text-right">{c.nome}</th>)}
              <th className="text-right">% do orçado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const consumo = l.orcado ? base(l) / l.orcado : 0;
              return (
                <tr key={l.etapa_id ?? "sem"} className="align-top">
                  <td>
                    {l.peds.length > 0 ? (
                      <details>
                        <summary className="cursor-pointer">{l.nome} <span className="text-xs text-stone-500">({l.peds.length} pedido{l.peds.length > 1 ? "s" : ""})</span></summary>
                        <ul className="mt-1 space-y-0.5 text-xs text-stone-600">
                          {l.peds.map((p) => (
                            <li key={p.numero}>
                              <Link href={`/obras/${id}/compras/${p.cotacao_id}/pedido`} className="underline decoration-stone-300">PED{p.numero}</Link> · {p.fornecedores?.nome} · {dataBr(p.data)} · {reais(p.total)}
                              {p.status === "recebido" ? " · ✓ recebido" : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      l.nome
                    )}
                  </td>
                  {colunas.map((c) => {
                    const v = c.v(l);
                    return <td key={c.nome} className={`text-right tabular-nums ${c.saldo && v < 0 ? "font-semibold text-red-600" : ""}`}>{reais(v)}</td>;
                  })}
                  <td className={`text-right tabular-nums ${consumo > 1 ? "font-semibold text-red-600" : "text-stone-600"}`}>{l.orcado ? porcento(consumo) : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="px-2 py-2">Total</td>
              {colunas.map((c) => <td key={c.nome} className="px-2 text-right tabular-nums">{reais(c.v(T))}</td>)}
              <td className="px-2 text-right tabular-nums">{T.orcado ? porcento(base(T) / T.orcado) : ""}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      <p className="text-xs text-stone-500 print:hidden">
        Pedido: soma dos pedidos de compra da etapa (pela apropriação da cotação). Pago e a pagar: lançamentos do financeiro, com ou sem pedido.
      </p>
    </div>
  );
}
