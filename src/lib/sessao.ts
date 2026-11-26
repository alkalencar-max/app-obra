import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

// Usuário logado e a empresa dele. Quem ainda não tem empresa vai para o primeiro acesso.
export async function exigirEmpresa() {
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: membro } = await supabase
    .from("membros")
    .select("empresa_id, papel, empresas(nome)")
    .eq("user_id", auth.claims.sub)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!membro) redirect("/bem-vindo");

  const empresa = membro.empresas as unknown as { nome: string } | null;
  return {
    supabase,
    email: (auth.claims.email as string | undefined) ?? "",
    empresaId: membro.empresa_id as string,
    empresaNome: empresa?.nome ?? "",
  };
}
