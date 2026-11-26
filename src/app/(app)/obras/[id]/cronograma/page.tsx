import { exigirEmpresa } from "@/lib/sessao";
import { GradeCronograma } from "./grade";

const mesDe = (d: string) => `${d.slice(0, 7)}-01`;
function intervalo(de: string, ate: string) {
  const meses: string[] = [];
  let [a, m] = de.split("-").map(Number);
  const fim = ate.slice(0, 7);
  while (meses.length < 120) {
    const atual = `${a}-${String(m).padStart(2, "0")}`;
    meses.push(`${atual}-01`);
    if (atual >= fim) break;
    if (++m > 12) { m = 1; a++; }
  }
  return meses;
}

export default async function Cronograma({ params }: PageProps<"/obras/[id]/cronograma">) {
  const { id } = await params;
  const { supabase } = await exigirEmpresa();
  const [{ data: obra }, { data: etapas }, { data: linhas }] = await Promise.all([
    supabase.from("obras").select("inicio_planejado, fim_planejado").eq("id", id).single(),
    supabase.from("etapas").select("id, nome, valor_orcado").eq("obra_id", id).order("ordem").order("nome"),
    supabase.from("cronograma").select("etapa_id, mes, percentual").eq("obra_id", id).order("mes"),
  ]);

  // Meses da grade: os do cronograma salvo; senão, o prazo da obra; senão, 12 meses a partir de agora.
  const salvos = (linhas ?? []).map((l) => l.mes as string);
  const hoje = new Date().toISOString().slice(0, 10);
  const de = salvos[0] ?? (obra?.inicio_planejado ? mesDe(obra.inicio_planejado) : mesDe(hoje));
  const ate = salvos.at(-1) ?? (obra?.fim_planejado ? mesDe(obra.fim_planejado) : intervalo(de, "9999-12").slice(0, 12).at(-1)!);
  const meses = intervalo(de, ate);
  const valores = Object.fromEntries((linhas ?? []).map((l) => [`${l.etapa_id}|${l.mes}`, Number(l.percentual)]));

  if (!etapas?.length) return <p className="cartao text-sm text-stone-600">Cadastre ou importe o orçamento primeiro: o cronograma distribui o valor de cada etapa nos meses.</p>;

  return (
    <GradeCronograma
      obraId={id}
      etapas={etapas.map((e) => ({ id: e.id, nome: e.nome, orcado: Number(e.valor_orcado) }))}
      meses={meses}
      valores={valores}
    />
  );
}
