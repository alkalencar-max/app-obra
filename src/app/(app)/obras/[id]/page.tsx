import { bm, mesAno, porcento, reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";
import { CurvaS, type PontoCurva } from "./curva-s";
import { BarraInline, BarrasEtapas, COR, ColunasMedicao, Legenda } from "./graficos";

const EMPREITEIRO = "SERVIÇOS EMPREITEIRO";

export default async function Dashboard({ params, searchParams }: PageProps<"/obras/[id]">) {
  const { id } = await params;
  const { mes: mesParam } = await searchParams;
  const { supabase } = await exigirEmpresa();

  const [{ data: obra }, { data: etapas }, { data: grupos }, { data: medicoes }, { data: cronograma }, { data: apropriacoes }, { data: realizadoMensal }] =
    await Promise.all([
      supabase.from("obras").select("area_m2").eq("id", id).single(),
      supabase.from("v_etapa_resumo").select("etapa_id, nome, ordem, orcado, pago, a_pagar").eq("obra_id", id).order("ordem"),
      supabase.from("v_grupo_resumo").select("grupo, pago").eq("obra_id", id).order("pago", { ascending: false }),
      supabase.from("v_medicao_resumo").select("numero, pago").eq("obra_id", id).order("numero"),
      supabase.from("v_cronograma_mensal").select("mes, previsto").eq("obra_id", id).order("mes"),
      supabase.from("v_apropriacao_resumo").select("nome, pago").eq("obra_id", id).gt("pago", 0).order("pago", { ascending: false }),
      supabase.from("v_realizado_mensal").select("mes, pago").eq("obra_id", id).order("mes"),
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

  const curva = montarCurva(
    (cronograma ?? []).map((c) => ({ mes: c.mes as string, valor: Number(c.previsto) })),
    (realizadoMensal ?? []).map((r) => ({ mes: r.mes as string, valor: Number(r.pago) })),
  );
  const listaEtapas = (etapas ?? []).map((e) => ({ nome: e.nome as string, orcado: Number(e.orcado), pago: Number(e.pago) }));

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

      {curva.length > 1 && (
        <section className="cartao space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Previsto x realizado, acumulado mês a mês</h2>
            <Legenda
              itens={[
                { cor: COR.previsto, nome: "Previsto (cronograma)", tracejado: true },
                { cor: COR.realizado, nome: "Realizado (pago)" },
              ]}
            />
          </div>
          <CurvaS pontos={curva} />
        </section>
      )}

      <section className="cartao space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Orçado x realizado por etapa</h2>
          <Legenda
            itens={[
              { cor: COR.orcado, nome: "Orçado" },
              { cor: COR.realizado, nome: "Realizado" },
              { cor: COR.estouro, nome: "Acima do orçado" },
            ]}
          />
        </div>
        <BarrasEtapas etapas={listaEtapas} />
        <details className="overflow-x-auto">
          <summary className="cursor-pointer text-sm text-stone-600">Ver tabela</summary>
        <table className="tabela mt-2">
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
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Resumo titulo="Gasto por grupo" linhas={(grupos ?? []).map((g) => ({ nome: g.grupo, valor: Number(g.pago) }))} total={pago} area={area} />
        <Resumo titulo="Gasto por apropriação" linhas={(apropriacoes ?? []).map((a) => ({ nome: a.nome, valor: Number(a.pago) }))} total={pago} area={area} />
        <Resumo titulo="Valor por medição" linhas={(medicoes ?? []).map((m) => ({ nome: bm(m.numero), valor: Number(m.pago) }))} total={pago} area={area}>
          {(medicoes ?? []).length > 1 && <ColunasMedicao medicoes={(medicoes ?? []).map((m) => ({ nome: bm(m.numero), valor: Number(m.pago) }))} />}
        </Resumo>
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

function Resumo({
  titulo,
  linhas,
  total,
  area,
  children,
}: {
  titulo: string;
  linhas: { nome: string; valor: number }[];
  total: number;
  area: number;
  children?: React.ReactNode;
}) {
  const max = Math.max(0, ...linhas.map((l) => l.valor));
  return (
    <section className="cartao overflow-x-auto">
      <h2 className="mb-2 font-semibold">{titulo}</h2>
      {children}
      <table className="tabela">
        <thead>
          <tr>
            <th></th>
            <th className="text-right">R$</th>
            <th className="text-right">R$/m²</th>
            <th className="text-right">%</th>
            <th className="w-24"></th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome}>
              <td>{l.nome}</td>
              <td className="text-right tabular-nums">{reais(l.valor)}</td>
              <td className="text-right tabular-nums">{area ? reais(l.valor / area) : ""}</td>
              <td className="text-right tabular-nums">{total ? porcento(l.valor / total) : ""}</td>
              <td>
                <BarraInline valor={l.valor} max={max} />
              </td>
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

// Junta cronograma (previsto por mês) e realizado por mês numa série acumulada contínua.
// O realizado vai até o último mês com pagamento; depois disso só o previsto segue.
function montarCurva(previsto: { mes: string; valor: number }[], realizado: { mes: string; valor: number }[]): PontoCurva[] {
  const todos = [...previsto, ...realizado].map((p) => p.mes.slice(0, 7)).sort();
  if (todos.length === 0) return [];
  const ultimoRealizado = realizado.map((r) => r.mes.slice(0, 7)).sort().at(-1);
  const soma = (lista: { mes: string; valor: number }[], m: string) =>
    lista.filter((p) => p.mes.slice(0, 7) === m).reduce((s, p) => s + p.valor, 0);

  const pontos: PontoCurva[] = [];
  let [ano, mes] = todos[0].split("-").map(Number);
  const fim = todos.at(-1)!;
  let accP = 0, accR = 0;
  for (;;) {
    const m = `${ano}-${String(mes).padStart(2, "0")}`;
    accP += soma(previsto, m);
    accR += soma(realizado, m);
    pontos.push({ mes: `${m}-01`, previsto: accP, realizado: ultimoRealizado && m <= ultimoRealizado ? accR : null });
    if (m >= fim || pontos.length > 240) break;
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return pontos;
}
