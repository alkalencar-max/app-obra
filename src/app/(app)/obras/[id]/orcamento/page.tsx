import { porcento, reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";
import { excluirItem, novaEtapa, salvarItem } from "./acoes";
import { ImportarOrcamento } from "./importar-orcamento";

type Item = { id: string; etapa_id: string; descricao: string; tipo: string; quantidade: number; unidade: string | null; custo_unitario: number; total: number };

const TIPOS = [
  { valor: "material", nome: "Material" },
  { valor: "servico", nome: "Serviço" },
  { valor: "equipamento", nome: "Equipamento" },
];
const nomeTipo = (t: string) => TIPOS.find((x) => x.valor === t)?.nome ?? t;

export default async function Orcamento({ params }: PageProps<"/obras/[id]/orcamento">) {
  const { id } = await params;
  const { supabase } = await exigirEmpresa();
  const [{ data: obra }, { data: etapas }, { data: itens }] = await Promise.all([
    supabase.from("obras").select("area_m2").eq("id", id).single(),
    supabase.from("etapas").select("id, nome, ordem, valor_orcado").eq("obra_id", id).order("ordem").order("nome"),
    supabase.from("orcamento_itens").select("id, etapa_id, descricao, tipo, quantidade, unidade, custo_unitario, total").eq("obra_id", id).order("ordem"),
  ]);
  const lista = (itens ?? []) as Item[];
  const area = Number(obra?.area_m2 ?? 0);
  const total = (etapas ?? []).reduce((s, e) => s + Number(e.valor_orcado), 0);
  const porTipo = TIPOS.map((t) => ({ ...t, soma: lista.filter((i) => i.tipo === t.valor).reduce((s, i) => s + Number(i.total), 0) }));

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="cartao border-amber-400 bg-amber-50">
          <p className="text-xs text-stone-500">Orçamento total</p>
          <p className="text-lg font-bold tabular-nums">{reais(total)}</p>
        </div>
        <div className="cartao">
          <p className="text-xs text-stone-500">R$ / m²</p>
          <p className="text-lg font-bold tabular-nums">{area ? reais(total / area) : "informe a área"}</p>
        </div>
        {porTipo.map((t) => (
          <div key={t.valor} className="cartao">
            <p className="text-xs text-stone-500">{t.nome}s</p>
            <p className="text-lg font-bold tabular-nums">{reais(t.soma)}</p>
            <p className="text-xs text-stone-500">{total ? porcento(t.soma / total) : ""}</p>
          </div>
        ))}
      </section>

      <ImportarOrcamento obraId={id} aberto={lista.length === 0} />

      {(etapas ?? []).map((e) => {
        const doEtapa = lista.filter((i) => i.etapa_id === e.id);
        return (
          <details key={e.id} className="cartao group" open>
            <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold"><span className="mr-1 inline-block text-stone-400 transition group-open:rotate-90">▸</span>{e.nome}</span>
              <span className="text-sm tabular-nums">
                {reais(e.valor_orcado)}
                <span className="ml-2 text-xs text-stone-500">{doEtapa.length} itens{total ? ` · ${porcento(Number(e.valor_orcado) / total)}` : ""}</span>
              </span>
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="tabela min-w-[720px]">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th className="text-right">Quant.</th>
                    <th>Und.</th>
                    <th className="text-right">Custo unit.</th>
                    <th className="text-right">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {doEtapa.map((i) => (
                    <tr key={i.id}>
                      <td colSpan={7} className="p-0">
                        <form action={salvarItem.bind(null, id)} className="grid grid-cols-[1fr_7rem_5rem_4rem_6.5rem_7rem_5.5rem] items-center gap-1 px-2 py-1">
                          <input type="hidden" name="id" value={i.id} />
                          <input className="rounded border border-transparent px-1 py-0.5 hover:border-stone-200 focus:border-amber-500" name="descricao" defaultValue={i.descricao} aria-label="Descrição" />
                          <select className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-stone-200" name="tipo" defaultValue={i.tipo} aria-label="Tipo">
                            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
                          </select>
                          <input className="rounded border border-transparent px-1 py-0.5 text-right tabular-nums hover:border-stone-200" name="quantidade" defaultValue={Number(i.quantidade).toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 4 })} aria-label="Quantidade" />
                          <input className="rounded border border-transparent px-1 py-0.5 hover:border-stone-200" name="unidade" defaultValue={i.unidade ?? ""} aria-label="Unidade" />
                          <input className="rounded border border-transparent px-1 py-0.5 text-right tabular-nums hover:border-stone-200" name="custo_unitario" defaultValue={Number(i.custo_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false })} aria-label="Custo unitário" />
                          <span className="text-right tabular-nums">{reais(i.total)}</span>
                          <span className="flex justify-end gap-2 text-xs">
                            <button className="text-amber-700 underline">salvar</button>
                            <button formAction={excluirItem.bind(null, id)} className="text-stone-400 hover:text-red-600" title="Excluir item">×</button>
                          </span>
                        </form>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={7} className="p-0">
                      <form action={salvarItem.bind(null, id)} className="grid grid-cols-[1fr_7rem_5rem_4rem_6.5rem_7rem_5.5rem] items-center gap-1 bg-stone-50 px-2 py-1">
                        <input type="hidden" name="etapa_id" value={e.id} />
                        <input className="campo py-1" name="descricao" placeholder="Novo item: descrição (ex.: Cimento 50kg)" aria-label="Descrição do novo item" />
                        <select className="campo py-1 text-xs" name="tipo" defaultValue="material" aria-label="Tipo">
                          {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{nomeTipo(t.valor)}</option>)}
                        </select>
                        <input className="campo py-1 text-right" name="quantidade" placeholder="qtd" aria-label="Quantidade" />
                        <input className="campo py-1" name="unidade" placeholder="un" aria-label="Unidade" />
                        <input className="campo py-1 text-right" name="custo_unitario" placeholder="R$" aria-label="Custo unitário" />
                        <span />
                        <button className="botao py-1 text-xs">+ incluir item</button>
                      </form>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
      <form action={novaEtapa.bind(null, id)} className="cartao flex flex-wrap items-end gap-2 border-dashed">
        <div className="min-w-56 flex-1">
          <label className="rotulo" htmlFor="nova-etapa">Nova etapa</label>
          <input className="campo" id="nova-etapa" name="nome" placeholder="ex.: FUNDAÇÃO, ALVENARIA, COBERTURA" required />
        </div>
        <button className="botao">+ Criar etapa</button>
        <p className="w-full text-xs text-stone-500">Depois de criar, inclua os materiais, serviços e equipamentos dentro dela.</p>
      </form>
      {(etapas ?? []).length === 0 && <p className="cartao text-sm text-stone-600">Esta obra ainda não tem etapas. Crie a primeira acima ou importe a planilha de orçamento.</p>}
    </div>
  );
}
