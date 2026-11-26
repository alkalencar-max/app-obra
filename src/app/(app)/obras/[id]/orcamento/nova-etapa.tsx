"use client";

import { useActionState, useEffect } from "react";
import { novaEtapa } from "./acoes";

// Cria uma etapa, mostra o resultado e rola a página até ela.
export function NovaEtapa({ obraId }: { obraId: string }) {
  const [estado, enviar, enviando] = useActionState(novaEtapa.bind(null, obraId), {});

  useEffect(() => {
    if (estado.id) document.getElementById(`etapa-${estado.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [estado.id]);

  return (
    <form action={enviar} className="cartao flex flex-wrap items-end gap-2 border-dashed">
      <div className="min-w-56 flex-1">
        <label className="rotulo" htmlFor="nova-etapa">Nova etapa</label>
        <input className="campo" id="nova-etapa" name="nome" placeholder="ex.: FUNDAÇÃO, ALVENARIA, COBERTURA" required />
      </div>
      <button className="botao" disabled={enviando}>{enviando ? "Criando..." : "+ Criar etapa"}</button>
      {estado.erro && <p className="w-full text-sm text-red-600">{estado.erro}</p>}
      {estado.nome && <p className="w-full text-sm text-emerald-700">✓ Etapa {estado.nome} criada. Agora inclua os itens dela.</p>}
      <p className="w-full text-xs text-stone-500">Depois de criar, inclua os materiais, serviços e equipamentos dentro dela.</p>
    </form>
  );
}
