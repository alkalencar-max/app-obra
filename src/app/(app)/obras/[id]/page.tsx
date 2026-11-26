import { bm, mesAno, porcento, reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";

const EMPREITEIRO = "SERVIÇOS EMPREITEIRO";

export default async function Dashboard({ params, searchParams }: PageProps<"/obras/[id]">) {
  const { id } = await params;
  const { mes: mesParam } = await searchParams;
  const { supabase } = await exigirEmpresa();

  const [{ data: obra }, { data: etapas }, { data: grupos }, { data: medicoes }, { data: cronograma }, { data: apropriacoes }] =
    await Promise.all([
      supabase.from("obras").select("area_m2").eq("id", id).single(),
      supabase.from("v_etapa_resumo").select("etapa_id, nome, ordem, orcado, pago, a_pagar").eq("obra_id", id).order("ordem"),
      supabase.from("v_grupo_resumo").select("grupo, pago").eq("obra_id", id).order("pago", { ascending: false }),
      supabase.from("v_medicao_resumo").select("numero, pago").eq("obra_id", id).order("numero"),
      supabase.from("v_cronograma_mensal").select("mes, previsto").eq("obra_id", id).order("mes"),
      supabase.from("v_apropriacao_resumo").select("nome, pago").eq("obra_id", id).gt("pago", 0).order("pago", { ascending: false }),
    ]);

  const area = Number(obra?.area_m2 ?? 0);
  const pago = (etapas ?? []).reduce((s, e) => s + Number(e.pago), 0);
  const aPagar = (etapas ?? []).reduce((s, e) => s + Number(e.a_pagar), 0);
  const orcado = (etapas ?? []).reduce((s, e) => s + Number(e.orcado), 0);
  const empreiteiro = Number(grupos?.find((g) => g.grupo === EMPREITEIRO)?.pago ?? 0);
  const ultimaMedicao = medicoes?.at(-1);

  // Previsto acumulado pelo cronograma até o mês escolhido (padrão: mês atual).
  const hoje = new Date().toISOString().slice(0, 7) + "-01";
  const meses = (cronograma ?? []).map((c) => c.mes as string);
  const mesRef = typeof mesParam === "string" && meses.includes(mesParam) ? mesParam : hoje;
  const previsto = (cronograma ?? []).filter((c) => c.mes <= mesRef).reduce((s, c) => s + Number(c.previsto), 0);

  const somaApropriacoes = (apropriacoes ?? []).reduce((s, a) => s + Number(a.pago), 0);
  const somaGrupos = (grupos ?? []).reduce((s, g) => s + Number(g.pago), 0);
  const somaMedicoes = (medicoes ?? []).reduce((s, m) => s + Number(m.pago), 0);
  const lancSemMedicao = pago - somaMedicoes;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo={`Medição atual ${bm(ultimaMedicao?.numero)}`} valor={reais(ultimaMedicao?.pago)} />
        <Indicador rotulo="Total realizado (pago)" valor={reais(pago)} destaque />
        <Indicador rotulo="Preço por m²" valor={area ? reais(pago / area) : "informe a área"} />
        <Indicador rotulo="Pago ao empreiteiro" valor={reais(empreiteiro)} />
        <Indicador rotulo="Orçamento global" valor={reais(orcado)} />
        <Indicador rotulo="Saldo do orçamento" valor={reais(orcado - pago)} />
        <Indicador rotulo={`Previsto no cronograma até ${mesAno(mesRef)}`} valor={reais(previsto)} />
        <Indicador
          rotulo="Divergência realizado x previsto"
          valor={reais(pago - previsto)}
          cor={pago - previsto > 0 ? "text-red-600" : "text-emerald-700"}
        />
      </section>
      {aPagar > 0 && <p className="text-sm text-stone-600">Além do realizado, há {reais(aPagar)} lançados como a pagar.</p>}

      {meses.length > 0 && (
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label className="rotulo" htmlFor="mes">Mês de referência do cronograma</label>
          <select id="mes" name="mes" defaultValue={meses.includes(mesRef) ? mesRef : ""} className="campo w-auto">
            <option value="">mês atual</option>
            {meses.map((m) => <option key={m} value={m}>{mesAno(m)}</option>)}
          </select>
          <button className="botao-secundario">Atualizar</button>
        </form>
      )}

      <section className="cartao overflow-x-auto">
        <h2 className="mb-2 font-semibold">Orçado x realizado por etapa</h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Etapa</th>
              <th className="text-right">Orçado</th>
              <th className="text-right">Realizado</th>
              <th className="text-right">Diferença</th>
              <th className="w-40">Consumo</th>
            </tr>
          </thead>
          <tbody>
            {(etapas ?? []).map((e) => {
              const o = Number(e.orcado), p = Number(e.pago);
              const consumo = o ? p / o : p ? 1 : 0;
              return (
                <tr key={e.etapa_id ?? "sem-etapa"}>
                  <td>{e.nome}</td>
                  <td className="text-right tabular-nums">{reais(o)}</td>
                  <td className="text-right tabular-nums">{reais(p)}</td>
                  <td className={`text-right tabular-nums ${o - p < 0 ? "font-semibold text-red-600" : ""}`}>{reais(o - p)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded bg-stone-100">
                        <div
                          className={`h-1.5 rounded ${consumo > 1 ? "bg-red-500" : "bg-amber-500"}`}
                          style={{ width: `${Math.min(consumo, 1) * 100}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-stone-500">{o ? porcento(consumo) : ""}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="px-2 py-2">Total</td>
              <td className="px-2 text-right tabular-nums">{reais(orcado)}</td>
              <td className="px-2 text-right tabular-nums">{reais(pago)}</td>
              <td className="px-2 text-right tabular-nums">{reais(orcado - pago)}</td>
              <td className="px-2 text-xs text-stone-500">{orcado ? porcento(pago / orcado) : ""}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Resumo titulo="Gasto por grupo" linhas={(grupos ?? []).map((g) => ({ nome: g.grupo, valor: Number(g.pago) }))} total={pago} area={area} />
        <Resumo titulo="Gasto por apropriação" linhas={(apropriacoes ?? []).map((a) => ({ nome: a.nome, valor: Number(a.pago) }))} total={pago} area={area} />
        <Resumo titulo="Valor por medição" linhas={(medicoes ?? []).map((m) => ({ nome: bm(m.numero), valor: Number(m.pago) }))} total={pago} area={area} />
        <section className="cartao">
          <h2 className="mb-2 font-semibold">Prova real</h2>
          <ul className="space-y-1 text-sm">
            <Conferencia nome="Lançamentos (por apropriação)" valor={somaApropriacoes} esperado={somaApropriacoes} />
            <Conferencia nome="Soma por etapas" valor={pago} esperado={somaApropriacoes} />
            <Conferencia nome="Soma por grupos" valor={somaGrupos} esperado={somaApropriacoes} />
            <Conferencia nome="Soma por medições" valor={somaMedicoes} esperado={somaApropriacoes} />
          </ul>
          {Math.abs(lancSemMedicao) >= 0.01 && (
            <p className="mt-2 text-xs text-stone-500">Diferença nas medições: {reais(lancSemMedicao)} em lançamentos sem nº de medição.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor, destaque, cor }: { rotulo: string; valor: string; destaque?: boolean; cor?: string }) {
  return (
    <div className={`cartao ${destaque ? "border-amber-400 bg-amber-50" : ""}`}>
      <p className="text-xs text-stone-500">{rotulo}</p>
      <p className={`text-lg font-bold tabular-nums ${cor ?? ""}`}>{valor}</p>
    </div>
  );
}

function Resumo({ titulo, linhas, total, area }: { titulo: string; linhas: { nome: string; valor: number }[]; total: number; area: number }) {
  return (
    <section className="cartao overflow-x-auto">
      <h2 className="mb-2 font-semibold">{titulo}</h2>
      <table className="tabela">
        <thead>
          <tr>
            <th></th>
            <th className="text-right">R$</th>
            <th className="text-right">R$/m²</th>
            <th className="text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome}>
              <td>{l.nome}</td>
              <td className="text-right tabular-nums">{reais(l.valor)}</td>
              <td className="text-right tabular-nums">{area ? reais(l.valor / area) : ""}</td>
              <td className="text-right tabular-nums">{total ? porcento(l.valor / total) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Conferencia({ nome, valor, esperado }: { nome: string; valor: number; esperado: number }) {
  const ok = Math.abs(valor - esperado) < 0.01;
  return (
    <li className="flex justify-between">
      <span>{nome}</span>
      <span className={`tabular-nums ${ok ? "text-emerald-700" : "text-red-600"}`}>
        {reais(valor)} {ok ? "✓" : "✗"}
      </span>
    </li>
  );
}
