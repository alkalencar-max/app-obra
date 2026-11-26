import Link from "next/link";
import { dataBr, reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";
import { NovaCotacao } from "./nova-cotacao";

type Cotacao = {
  id: string;
  numero: number;
  titulo: string;
  data: string;
  status: "aberta" | "pedido" | "cancelada";
  cotacao_propostas: { id: string }[];
  pedidos: { total: number; status: string; fornecedores: { nome: string } | null }[] | { total: number; status: string; fornecedores: { nome: string } | null } | null;
};

const SITUACAO: Record<string, { nome: string; cor: string }> = {
  aberta: { nome: "Cotando", cor: "bg-amber-100 text-amber-800" },
  emitido: { nome: "Pedido emitido", cor: "bg-sky-100 text-sky-800" },
  recebido: { nome: "Recebido", cor: "bg-emerald-100 text-emerald-800" },
  cancelada: { nome: "Cancelada", cor: "bg-stone-100 text-stone-500" },
  cancelado: { nome: "Cancelado", cor: "bg-stone-100 text-stone-500" },
};

export default async function Compras({ params, searchParams }: PageProps<"/obras/[id]/compras">) {
  const { id } = await params;
  const { nova } = await searchParams;
  const { supabase } = await exigirEmpresa();

  const [{ data }, { data: ultima }, { data: apropriacoes }, { data: grupos }, { data: fornecedores }] = await Promise.all([
    supabase
      .from("cotacoes")
      .select("id, numero, titulo, data, status, cotacao_propostas(id), pedidos(total, status, fornecedores(nome))")
      .eq("obra_id", id)
      .order("numero", { ascending: false }),
    supabase.from("cotacoes").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("apropriacoes").select("id, nome").eq("obra_id", id).order("nome"),
    supabase.from("grupos").select("id, nome").order("ordem").order("nome"),
    supabase.from("fornecedores").select("nome").order("nome"),
  ]);
  const cotacoes = (data ?? []) as unknown as Cotacao[];
  const abrirForm = nova !== undefined || cotacoes.length === 0;

  return (
    <div className="space-y-6">
      {abrirForm ? (
        <NovaCotacao
          obraId={id}
          proximoNumero={(ultima?.numero ?? 0) + 1}
          apropriacoes={apropriacoes ?? []}
          grupos={grupos ?? []}
          fornecedores={(fornecedores ?? []).map((f) => f.nome)}
        />
      ) : (
        <Link href={`/obras/${id}/compras?nova`} className="botao">+ Nova cotação</Link>
      )}

      {cotacoes.length > 0 && (
        <section className="cartao overflow-x-auto">
          <h2 className="mb-2 font-semibold">Cotações e pedidos</h2>
          <table className="tabela">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Data</th>
                <th>Descrição</th>
                <th>Situação</th>
                <th>Fornecedor</th>
                <th className="text-right">Valor do pedido</th>
              </tr>
            </thead>
            <tbody>
              {cotacoes.map((c) => {
                const ped = Array.isArray(c.pedidos) ? c.pedidos[0] : c.pedidos;
                const sit = SITUACAO[ped?.status ?? c.status];
                return (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap font-medium">
                      <Link href={`/obras/${id}/compras/${c.id}`} className="underline decoration-stone-300 hover:decoration-amber-500">
                        {ped ? `PED${c.numero}` : `COT${c.numero}`}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{dataBr(c.data)}</td>
                    <td>{c.titulo}</td>
                    <td><span className={`rounded px-2 py-0.5 text-xs ${sit.cor}`}>{sit.nome}</span></td>
                    <td>{ped?.fornecedores?.nome ?? <span className="text-xs text-stone-500">{c.cotacao_propostas.length} cotando</span>}</td>
                    <td className="text-right tabular-nums">{ped ? reais(ped.total) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
