"use server";

import { revalidatePath } from "next/cache";
import { hojeBr, txt, valorBr } from "@/lib/campos";
import { exigirEmpresa } from "@/lib/sessao";

export type EstadoLancamento = { erro?: string; ok?: number };

export async function salvarLancamento(obraId: string, _: EstadoLancamento, form: FormData): Promise<EstadoLancamento> {
  const { supabase, empresaId } = await exigirEmpresa();

  const valor = valorBr(txt(form, "valor"));
  if (!Number.isFinite(valor) || valor === 0) return { erro: "Informe o valor." };
  const apropriacaoId = txt(form, "apropriacao_id");
  if (!apropriacaoId) return { erro: "Escolha a apropriação." };

  let fornecedorId: string | null = null;
  const fornecedor = txt(form, "fornecedor")?.toUpperCase() ?? null;
  if (fornecedor) {
    const { data, error } = await supabase
      .from("fornecedores")
      .upsert({ empresa_id: empresaId, nome: fornecedor }, { onConflict: "empresa_id,nome", ignoreDuplicates: false })
      .select("id")
      .single();
    if (error) return { erro: error.message };
    fornecedorId = data.id;
  }

  let medicaoId: string | null = null;
  const numeroBm = Number(txt(form, "medicao")?.replace(/\D/g, ""));
  if (numeroBm > 0) {
    const { data, error } = await supabase
      .from("medicoes")
      .upsert({ empresa_id: empresaId, obra_id: obraId, numero: numeroBm }, { onConflict: "obra_id,numero" })
      .select("id")
      .single();
    if (error) return { erro: error.message };
    medicaoId = data.id;
  }

  const { error } = await supabase.from("lancamentos").insert({
    empresa_id: empresaId,
    obra_id: obraId,
    data: txt(form, "data"),
    valor: Math.round(valor * 100) / 100,
    fornecedor_id: fornecedorId,
    descricao: txt(form, "descricao")?.toUpperCase() ?? "",
    apropriacao_id: apropriacaoId,
    grupo_id: txt(form, "grupo_id"),
    medicao_id: medicaoId,
    obs: txt(form, "obs"),
    status: form.get("status") === "a_pagar" ? "a_pagar" : "pago",
  });
  if (error) return { erro: error.message };
  revalidatePath(`/obras/${obraId}`, "layout");
  return { ok: Date.now() };
}

export async function excluirLancamento(obraId: string, form: FormData) {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase.from("lancamentos").delete().eq("id", String(form.get("id"))).eq("obra_id", obraId);
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}`, "layout");
}

export async function marcarPago(obraId: string, form: FormData) {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase.from("lancamentos").update({ status: "pago", data: hojeBr() }).eq("id", String(form.get("id"))).eq("obra_id", obraId);
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}`, "layout");
}

export async function definirEtapa(obraId: string, form: FormData) {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase
    .from("apropriacoes")
    .update({ etapa_id: txt(form, "etapa_id") })
    .eq("id", String(form.get("id")))
    .eq("obra_id", obraId);
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}`, "layout");
}

export async function salvarEtapa(obraId: string, form: FormData) {
  const { supabase, empresaId } = await exigirEmpresa();
  const id = txt(form, "id");
  const linha = {
    nome: txt(form, "nome")?.toUpperCase() ?? "",
    valor_orcado: valorBr(txt(form, "valor_orcado")) || 0,
  };
  const { error } = id
    ? await supabase.from("etapas").update(linha).eq("id", id).eq("obra_id", obraId)
    : await supabase.from("etapas").insert({ ...linha, empresa_id: empresaId, obra_id: obraId, ordem: Number(form.get("ordem")) || 999 });
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}`, "layout");
}

export async function novaApropriacao(obraId: string, form: FormData) {
  const { supabase, empresaId } = await exigirEmpresa();
  const { error } = await supabase.from("apropriacoes").insert({
    empresa_id: empresaId,
    obra_id: obraId,
    nome: txt(form, "nome")?.toUpperCase() ?? "",
    etapa_id: txt(form, "etapa_id"),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}`, "layout");
}
