"use server";

import { redirect } from "next/navigation";
import type { PacoteImportacao } from "@/lib/importador";
import { exigirEmpresa } from "@/lib/sessao";

export async function importarObra(pacote: PacoteImportacao): Promise<{ erro: string }> {
  const { supabase, empresaId } = await exigirEmpresa();
  const { data, error } = await supabase.rpc("importar_obra", { p_empresa_id: empresaId, p_payload: pacote });
  if (error) return { erro: error.message };
  redirect(`/obras/${data}`);
}
