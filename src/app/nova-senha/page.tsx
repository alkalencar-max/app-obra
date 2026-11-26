"use client";

import { useActionState } from "react";
import { definirSenha, type EstadoLogin } from "../login/acoes";

// Aberta pelo link do e-mail de recuperação: a pessoa já está logada e escolhe a senha nova.
export default function NovaSenha() {
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(definirSenha, {});
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={acao} className="cartao w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold">Nova senha</h1>
          <p className="text-sm text-stone-500">Escolha a senha que vai usar para entrar.</p>
        </div>
        <div>
          <label className="rotulo" htmlFor="senha">Senha nova (mínimo 8 caracteres)</label>
          <input className="campo" id="senha" name="senha" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className="rotulo" htmlFor="confirmar">Repita a senha</label>
          <input className="campo" id="confirmar" name="confirmar" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        {estado.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        <button className="botao w-full" disabled={enviando}>{enviando ? "Salvando..." : "Salvar senha"}</button>
      </form>
    </main>
  );
}
