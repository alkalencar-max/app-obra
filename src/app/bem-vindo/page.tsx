import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

async function criarEmpresa(form: FormData) {
  "use server";
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("criar_empresa", {
    p_nome: String(form.get("nome")).trim(),
    p_cnpj: String(form.get("cnpj") ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  redirect("/");
}

export default async function BemVindo() {
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const { count } = await supabase.from("membros").select("*", { count: "exact", head: true });
  if (count) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={criarEmpresa} className="cartao w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold">Bem-vindo!</h1>
          <p className="text-sm text-stone-500">Para começar, qual é o nome da sua empresa?</p>
        </div>
        <div>
          <label className="rotulo" htmlFor="nome">Nome da empresa</label>
          <input className="campo" id="nome" name="nome" required placeholder="Ex.: AM Engenharia" />
        </div>
        <div>
          <label className="rotulo" htmlFor="cnpj">CNPJ (opcional)</label>
          <input className="campo" id="cnpj" name="cnpj" />
        </div>
        <button className="botao w-full">Continuar</button>
      </form>
    </main>
  );
}
