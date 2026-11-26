"use server";

import { revalidatePath } from "next/cache";
import { exigirEmpresa } from "@/lib/sessao";

export async function salvarCronograma(
  obraId: string,
  linhas: { etapa_id: string; mes: string; percentual: number }[],
): Promise<{ erro?: string }> {
  const { supabase } = await exigirEmpresa();
  if (linhas.some((l) => !(l.percentual >= 0 && l.percentual <= 1))) return { erro: "Cada mês deve ficar entre 0% e 100%." };
  const { error } = await supabase.rpc("salvar_cronograma", { p_obra_id: obraId, p_linhas: linhas });
  if (error) return { erro: error.message };
  revalidatePath(`/obras/${obraId}`, "layout");
  return {};
}
