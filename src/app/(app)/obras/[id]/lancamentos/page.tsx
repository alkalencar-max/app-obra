import Link from "next/link";
import { bm, dataBr, reais } from "@/lib/formato";
import { exigirEmpresa } from "@/lib/sessao";
import { excluirLancamento, marcarPago } from "../acoes";
import { FormLancamento } from "./form-lancamento";

type Linha = {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  obs: string | null;
  status: "pago" | "a_pagar";
  comprovante_path: string | null;
  fornecedores: { nome: string } | null;
  apropriacoes: { nome: string } | null;
  grupos: { nome: string } | null;
  medicoes: { numero: number } | null;
};

export default async function Lancamentos({ params, searchParams }: PageProps<"/obras/[id]/lancamentos">) {
  const { id } = await params;
  const { bm: filtroBm, q } = await searchParams;
  const { supabase } = await exigirEmpresa();

  const [{ data: apropriacoes }, { data: grupos }, { data: fornecedores }, { data: medicoes }] = await Promise.all([
    supabase.from("apropriacoes").select("id, nome").eq("obra_id", id).order("nome"),
    supabase.from("grupos").select("id, nome").order("ordem").order("nome"),
    supabase.from("fornecedores").select("nome").order("nome"),
    supabase.from("medicoes").select("id, numero").eq("obra_id", id).order("numero"),
  ]);

  let consulta = supabase
    .from("lancamentos")
    .select("id, data, valor, descricao, obs, status, comprovante_path, fornecedores(nome), apropriacoes(nome), grupos(nome), medicoes(numero)")
    .eq("obra_id", id)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  const medicaoFiltro = medicoes?.find((m) => String(m.numero) === filtroBm);
  if (medicaoFiltro) consulta = consulta.eq("medicao_id", medicaoFiltro.id);
  if (typeof q === "string" && q.trim()) consulta = consulta.ilike("descricao", `%${q.trim()}%`);
  const { data } = await consulta;
  const linhas = (data ?? []) as unknown as Linha[];
  const total = linhas.reduce((s, l) => s + Number(l.valor), 0);
  const ultimoBm = medicoes?.at(-1)?.numero ?? 1;

  // Links temporários (1 h) para abrir os comprovantes guardados.
  const caminhos = linhas.map((l) => l.comprovante_path).filter((c): c is string => !!c);
  const { data: assinados } = caminhos.length
    ? await supabase.storage.from("comprovantes").createSignedUrls(caminhos, 3600)
    : { data: [] };
  const linkComprovante = new Map((assinados ?? []).flatMap((a) => (a.path && a.signedUrl ? [[a.path, a.signedUrl] as const] : [])));

  return (
    <div className="space-y-6">
      <FormLancamento
        obraId={id}
        apropriacoes={apropriacoes ?? []}
        grupos={grupos ?? []}
        fornecedores={(fornecedores ?? []).map((f) => f.nome)}
        medicaoPadrao={ultimoBm}
      />

      <section className="cartao overflow-x-auto">
        <form className="mb-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="rotulo" htmlFor="bm">Medição</label>
            <select id="bm" name="bm" defaultValue={typeof filtroBm === "string" ? filtroBm : ""} className="campo w-auto">
              <option value="">Todas</option>
              {(medicoes ?? []).map((m) => <option key={m.id} value={m.numero}>{bm(m.numero)}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="q">Descrição</label>
            <input id="q" name="q" defaultValue={typeof q === "string" ? q : ""} className="campo" placeholder="ex.: PED86" />
          </div>
          <button className="botao-secundario">Filtrar</button>
          {(filtroBm || q) && <Link href={`/obras/${id}/lancamentos`} className="text-sm underline">limpar</Link>}
          <p className="ml-auto text-sm">
            {linhas.length} lançamentos · <span className="font-semibold">{reais(total)}</span>
          </p>
        </form>
        <table className="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th className="text-right">Valor</th>
              <th>Fornecedor</th>
              <th>Descrição</th>
              <th>Apropriação</th>
              <th>Grupo</th>
              <th>BM</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className={l.status === "a_pagar" ? "bg-amber-50" : ""}>
                <td className="whitespace-nowrap">{dataBr(l.data)}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{reais(l.valor)}</td>
                <td>{l.fornecedores?.nome}</td>
                <td>
                  {l.descricao}
                  {l.obs && <span className="block text-xs text-stone-500">{l.obs}</span>}
                </td>
                <td>{l.apropriacoes?.nome}</td>
                <td className="text-xs">{l.grupos?.nome}</td>
                <td>{bm(l.medicoes?.numero)}</td>
                <td className="whitespace-nowrap text-right">
                  {l.comprovante_path && linkComprovante.get(l.comprovante_path) && (
                    <a href={linkComprovante.get(l.comprovante_path)} target="_blank" rel="noreferrer" className="mr-2 text-xs text-amber-700 underline" title="Ver comprovante">
                      📎 comprovante
                    </a>
                  )}
                  {l.status === "a_pagar" && (
                    <form action={marcarPago.bind(null, id)} className="inline">
                      <input type="hidden" name="id" value={l.id} />
                      <button className="mr-2 text-xs text-emerald-700 underline">marcar pago</button>
                    </form>
                  )}
                  <form action={excluirLancamento.bind(null, id)} className="inline">
                    <input type="hidden" name="id" value={l.id} />
                    <button className="text-xs text-stone-400 hover:text-red-600" title="Excluir lançamento">excluir</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
