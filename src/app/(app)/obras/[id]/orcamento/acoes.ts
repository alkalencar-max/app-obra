"use server";

import { revalidatePath } from "next/cache";
import { txt, valorBr } from "@/lib/campos";
import { normalizar, type EtapaOrcamento } from "@/lib/orcamento";
import { exigirEmpresa } from "@/lib/sessao";

const TIPOS = ["material", "servico", "equipamento"];

export async function importarOrcamento(obraId: string, etapas: EtapaOrcamento[]): Promise<{ erro?: string; itens?: number }> {
  const { supabase } = await exigirEmpresa();
  // Casa o nome da planilha com a etapa que já existe, mesmo com acento ou espaço diferente.
  const { data: existentes } = await supabase.from("etapas").select("nome").eq("obra_id", obraId);
  const porNome = new Map((existentes ?? []).map((e) => [normalizar(e.nome), e.nome as string]));
  const payload = etapas.map((e) => ({ ...e, nome: porNome.get(normalizar(e.nome)) ?? e.nome }));

  const { data, error } = await supabase.rpc("importar_orcamento", { p_obra_id: obraId, p_etapas: payload });
  if (error) return { erro: error.message };
  revalidatePath(`/obras/${obraId}`, "layout");
  return { itens: data as number };
}

function linhaItem(form: FormData) {
  const tipo = String(form.get("tipo") ?? "material");
  return {
    descricao: txt(form, "descricao") ?? "",
    tipo: TIPOS.includes(tipo) ? tipo : "material",
    quantidade: valorBr(txt(form, "quantidade")) || 0,
    unidade: txt(form, "unidade"),
    custo_unitario: valorBr(txt(form, "custo_unitario")) || 0,
  };
}

export async function salvarItem(obraId: string, form: FormData) {
  const { supabase, empresaId } = await exigirEmpresa();
  const id = txt(form, "id");
  const linha = linhaItem(form);
  if (!linha.descricao) throw new Error("Informe a descrição do item.");
  const { error } = id
    ? await supabase.from("orcamento_itens").update(linha).eq("id", id).eq("obra_id", obraId)
    : await supabase.from("orcamento_itens").insert({ ...linha, empresa_id: empresaId, obra_id: obraId, etapa_id: txt(form, "etapa_id"), ordem: 999 });
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}`, "layout");
}

export async function excluirItem(obraId: string, form: FormData) {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase.from("orcamento_itens").delete().eq("id", String(form.get("id"))).eq("obra_id", obraId);
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}`, "layout");
}

// Cria a etapa no orçamento e uma apropriação com o mesmo nome, já ligada a ela (para lançar e cotar).
export async function novaEtapa(obraId: string, form: FormData) {
  const { supabase, empresaId } = await exigirEmpresa();
  const nome = txt(form, "nome")?.toUpperCase();
  if (!nome) throw new Error("Informe o nome da etapa.");
  const { data: ultima } = await supabase.from("etapas").select("ordem").eq("obra_id", obraId).order("ordem", { ascending: false }).limit(1).maybeSingle();
  const { data: etapa, error } = await supabase
    .from("etapas")
    .insert({ empresa_id: empresaId, obra_id: obraId, nome, ordem: (ultima?.ordem ?? 0) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(error.code === "23505" ? "Já existe uma etapa com esse nome." : error.message);
  await supabase.from("apropriacoes").upsert(
    { empresa_id: empresaId, obra_id: obraId, nome, etapa_id: etapa.id },
    { onConflict: "obra_id,nome", ignoreDuplicates: true },
  );
  revalidatePath(`/obras/${obraId}`, "layout");
}
