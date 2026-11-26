import Link from "next/link";
import { redirect } from "next/navigation";
import { reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";

async function novaObra(form: FormData) {
  "use server";
  const { supabase, empresaId } = await exigirEmpresa();
  const area = Number(String(form.get("area") ?? "").replace(",", "."));
  const { data, error } = await supabase
    .from("obras")
    .insert({
      empresa_id: empresaId,
      nome: String(form.get("nome")).trim(),
      endereco: String(form.get("endereco") ?? "").trim() || null,
      area_m2: area > 0 ? area : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/obras/${data.id}/apropriacoes`);
}

export default async function Obras() {
  const { supabase } = await exigirEmpresa();
  const [{ data: obras }, { data: resumo }] = await Promise.all([
    supabase.from("obras").select("id, nome, endereco, area_m2, status").order("nome"),
    supabase.from("v_etapa_resumo").select("obra_id, orcado, pago"),
  ]);

  const totais = new Map<string, { orcado: number; pago: number }>();
  for (const r of resumo ?? []) {
    const t = totais.get(r.obra_id) ?? { orcado: 0, pago: 0 };
    t.orcado += Number(r.orcado);
    t.pago += Number(r.pago);
    totais.set(r.obra_id, t);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Obras</h1>
        <Link href="/importar" className="botao">Importar planilha de obra</Link>
      </div>

      {obras?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {obras.map((o) => {
            const t = totais.get(o.id) ?? { orcado: 0, pago: 0 };
            const pct = t.orcado ? Math.min(t.pago / t.orcado, 1) : 0;
            return (
              <Link key={o.id} href={`/obras/${o.id}`} className="cartao block hover:border-amber-400">
                <h2 className="font-semibold">{o.nome}</h2>
                <p className="truncate text-xs text-stone-500">{o.endereco}</p>
                <div className="mt-3 flex justify-between text-sm">
                  <span>Realizado</span>
                  <span className="font-semibold">{reais(t.pago)}</span>
                </div>
                <div className="flex justify-between text-xs text-stone-500">
                  <span>Orçado</span>
                  <span>{reais(t.orcado)}</span>
                </div>
                <div className="mt-2 h-1.5 rounded bg-stone-100">
                  <div className="h-1.5 rounded bg-amber-500" style={{ width: `${pct * 100}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="cartao text-sm text-stone-600">
          Nenhuma obra ainda. O jeito mais rápido é <Link href="/importar" className="underline">importar a sua planilha de centro de custos</Link>.
        </p>
      )}

      <details className="cartao">
        <summary className="cursor-pointer text-sm font-semibold">Cadastrar obra do zero</summary>
        <form action={novaObra} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="nome">Nome</label>
            <input className="campo" id="nome" name="nome" required />
          </div>
          <div>
            <label className="rotulo" htmlFor="endereco">Endereço</label>
            <input className="campo" id="endereco" name="endereco" />
          </div>
          <div>
            <label className="rotulo" htmlFor="area">Área construída (m²)</label>
            <input className="campo" id="area" name="area" inputMode="decimal" />
          </div>
          <div>
            <button className="botao">Criar obra</button>
          </div>
        </form>
      </details>
    </div>
  );
}
