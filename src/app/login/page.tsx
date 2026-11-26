"use client";

import { useActionState, useState } from "react";
import { criarConta, entrar, recuperarSenha, type EstadoLogin } from "./acoes";

export default function Login() {
  const [modo, setModo] = useState<"entrar" | "criar" | "esqueci">("entrar");
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(modo === "entrar" ? entrar : modo === "criar" ? criarConta : recuperarSenha, {});

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={acao} className="cartao w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold">App Obra</h1>
          <p className="text-sm text-stone-500">{modo === "entrar" ? "Entre na sua conta" : modo === "criar" ? "Crie a sua conta" : "Informe o seu e-mail para receber o link de nova senha"}</p>
        </div>
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input className="campo" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        {modo !== "esqueci" && <div>
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input
            className="campo"
            id="senha"
            name="senha"
            type="password"
            required
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
          />
        </div>}
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado.aviso && <p className="text-sm text-emerald-700">{estado.aviso}</p>}
        <button className="botao w-full" disabled={enviando}>
          {modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar conta" : "Enviar link"}
        </button>
        {modo === "entrar" && (
          <button type="button" className="w-full text-center text-sm text-stone-600 underline" onClick={() => setModo("esqueci")}>
            Esqueci minha senha
          </button>
        )}
        <button
          type="button"
          className="w-full text-center text-sm text-stone-600 underline"
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
        >
          {modo === "entrar" ? "Primeiro acesso? Criar conta" : "Voltar para entrar"}
        </button>
      </form>
    </main>
  );
}
