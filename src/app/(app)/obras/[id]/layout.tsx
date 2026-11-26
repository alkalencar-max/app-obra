import { notFound } from "next/navigation";
import { exigirEmpresa } from "@/lib/sessao";
import { Abas } from "./abas";

export default async function LayoutObra({ children, params }: LayoutProps<"/obras/[id]">) {
  const { id } = await params;
  const { supabase } = await exigirEmpresa();
  const { data: obra } = await supabase.from("obras").select("nome, endereco, area_m2").eq("id", id).maybeSingle();
  if (!obra) notFound();

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold">{obra.nome}</h1>
        <p className="text-sm text-stone-500">
          {obra.endereco} {obra.area_m2 ? `· ${Number(obra.area_m2).toLocaleString("pt-BR")} m²` : ""}
        </p>
      </div>
      <Abas id={id} />
      {children}
    </div>
  );
}
