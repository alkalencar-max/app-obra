"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoLogin = { erro?: string; aviso?: string };

export async function entrar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("senha")),
  });
  if (error) return { erro: "E-mail ou senha incorretos." };
  redirect("/");
}

export async function criarConta(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const senha = String(form.get("senha"));
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };

  const origem = (await headers()).get("origin") ?? "";
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: String(form.get("email")),
    password: senha,
    options: { emailRedirectTo: `${origem}/auth/confirmar` },
  });
  if (error) return { erro: error.message };
  if (data.session) redirect("/bem-vindo");
  return { aviso: "Conta criada. Abra o e-mail de confirmação que enviamos e depois entre aqui." };
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
