import { reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";
import { definirEtapa, novaApropriacao, salvarEtapa } from "../acoes";
import { SeletorEtapa } from "./seletor-etapa";

export default async function Apropriacoes({ params }: PageProps<"/obras/[id]/apropriacoes">) {
  const { id } = await params;
  const { supabase } = await exigirEmpresa();
  const [{ data: etapas }, { data: apropriacoes }] = await Promise.all([
    supabase.from("etapas").select("id, nome, ordem, valor_orcado").eq("obra_id", id).order("ordem"),
    supabase.from("v_apropriacao_resumo").select("apropriacao_id, nome, etapa_id, pago").eq("obra_id", id).order("nome"),
  ]);
  const orcado = (etapas ?? []).reduce((s, e) => s + Number(e.valor_orcado), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="cartao overflow-x-auto">
        <h2 className="font-semibold">Etapas do orçamento</h2>
        <p className="mb-3 text-xs text-stone-500">Total orçado: {reais(orcado)}</p>
        <table className="tabela">
          <thead>
            <tr><th>Etapa</th><th className="text-right">Orçado (R$)</th><th></th></tr>
          </thead>
          <tbody>
            {(etapas ?? []).map((e) => (
              <tr key={e.id}>
                <td colSpan={3} className="!p-0">
                  <form action={salvarEtapa.bind(null, id)} className="flex items-center gap-2 px-2 py-1">
                    <input type="hidden" name="id" value={e.id} />
                    <input name="nome" defaultValue={e.nome} className="campo !py-1" aria-label="Nome da etapa" />
                    <input
                      name="valor_orcado"
                      defaultValue={Number(e.valor_orcado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      className="campo !w-36 !py-1 text-right"
                      inputMode="decimal"
                      aria-label="Valor orçado"
                    />
                    <button className="text-xs text-stone-500 underline">salvar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={salvarEtapa.bind(null, id)} className="mt-3 flex gap-2">
          <input name="nome" required placeholder="Nova etapa" className="campo" />
          <input name="valor_orcado" placeholder="Orçado" className="campo !w-36 text-right" inputMode="decimal" />
          <input type="hidden" name="ordem" value={(etapas?.length ?? 0) + 1} />
          <button className="botao-secundario">Adicionar</button>
        </form>
      </section>

      <section className="cartao overflow-x-auto">
        <h2 className="font-semibold">Apropriações</h2>
        <p className="mb-3 text-xs text-stone-500">
          A apropriação é o que você escolhe ao lançar. Cada uma soma no realizado da etapa escolhida aqui.
        </p>
        <table className="tabela">
          <thead>
            <tr><th>Apropriação</th><th className="text-right">Realizado</th><th>Etapa do orçamento</th></tr>
          </thead>
          <tbody>
            {(apropriacoes ?? []).map((a) => (
              <tr key={a.apropriacao_id}>
                <td>{a.nome}</td>
                <td className="text-right tabular-nums">{Number(a.pago) ? reais(a.pago) : ""}</td>
                <td>
                  <SeletorEtapa
                    acao={definirEtapa.bind(null, id)}
                    apropriacaoId={a.apropriacao_id}
                    etapaId={a.etapa_id}
                    etapas={(etapas ?? []).map((e) => ({ id: e.id, nome: e.nome }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={novaApropriacao.bind(null, id)} className="mt-3 flex gap-2">
          <input name="nome" required placeholder="Nova apropriação" className="campo" />
          <select name="etapa_id" className="campo" defaultValue="">
            <option value="">sem etapa</option>
            {(etapas ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <button className="botao-secundario">Adicionar</button>
        </form>
      </section>
    </div>
  );
}
