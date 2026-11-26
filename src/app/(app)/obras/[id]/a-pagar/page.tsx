import Link from "next/link";
import { hojeBr } from "@/lib/campos";
import { dataBr, reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";
import { marcarPago } from "../acoes";

type Conta = {
  id: string;
  data: string;
  vencimento: string | null;
  valor: number;
  descricao: string;
  fornecedores: { nome: string; chave_pix: string | null } | null;
  pedidos: { cotacao_id: string; status: string } | null;
};

// Contas a pagar da obra, por vencimento: vencidas, desta semana e depois.
export default async function APagar({ params }: PageProps<"/obras/[id]/a-pagar">) {
  const { id } = await params;
  const { supabase } = await exigirEmpresa();
  const { data } = await supabase
    .from("lancamentos")
    .select("id, data, vencimento, valor, descricao, fornecedores(nome, chave_pix), pedidos(cotacao_id, status)")
    .eq("obra_id", id)
    .eq("status", "a_pagar")
    .order("vencimento", { ascending: true, nullsFirst: false })
    .order("data");
  const contas = (data ?? []) as unknown as Conta[];

  const hoje = hojeBr();
  const [a, m, d] = hoje.split("-").map(Number);
  const semana = new Date(Date.UTC(a, m - 1, d + 7)).toISOString().slice(0, 10);
  const venc = (c: Conta) => c.vencimento ?? c.data;
  const grupos = [
    { nome: "Vencidas", cor: "text-red-600", lista: contas.filter((c) => venc(c) < hoje) },
    { nome: "Próximos 7 dias", cor: "text-amber-700", lista: contas.filter((c) => venc(c) >= hoje && venc(c) <= semana) },
    { nome: "Depois", cor: "text-stone-700", lista: contas.filter((c) => venc(c) > semana) },
  ];
  const total = contas.reduce((s, c) => s + Number(c.valor), 0);

  if (contas.length === 0)
    return <p className="cartao text-sm text-stone-600">Nada a pagar nesta obra. As parcelas aparecem aqui quando você gera um pedido em Compras.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {grupos.map((g) => (
          <div key={g.nome} className="cartao">
            <p className="text-xs text-stone-500">{g.nome}</p>
            <p className={`text-lg font-bold tabular-nums ${g.lista.length ? g.cor : "text-stone-400"}`}>{reais(g.lista.reduce((s, c) => s + Number(c.valor), 0))}</p>
          </div>
        ))}
        <div className="cartao border-amber-400 bg-amber-50">
          <p className="text-xs text-stone-500">Total a pagar</p>
          <p className="text-lg font-bold tabular-nums">{reais(total)}</p>
        </div>
      </div>

      {grupos.filter((g) => g.lista.length).map((g) => (
        <section key={g.nome} className="cartao overflow-x-auto">
          <h2 className={`mb-2 font-semibold ${g.cor}`}>{g.nome}</h2>
          <table className="tabela">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Fornecedor</th>
                <th>Descrição</th>
                <th className="text-right">Valor</th>
                <th>Entrega</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {g.lista.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{dataBr(venc(c))}</td>
                  <td>
                    {c.fornecedores?.nome}
                    {c.fornecedores?.chave_pix && <span className="block text-xs text-stone-500">PIX {c.fornecedores.chave_pix}</span>}
                  </td>
                  <td>
                    {c.pedidos ? <Link href={`/obras/${id}/compras/${c.pedidos.cotacao_id}/pedido`} className="underline decoration-stone-300">{c.descricao}</Link> : c.descricao}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">{reais(c.valor)}</td>
                  <td className="text-xs">{c.pedidos ? (c.pedidos.status === "recebido" ? <span className="text-emerald-700">✓ recebido</span> : <span className="text-stone-500">aguardando</span>) : ""}</td>
                  <td className="text-right">
                    <form action={marcarPago.bind(null, id)}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-xs text-emerald-700 underline">marcar pago</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
