"use client";

// Troca a etapa assim que o usuário escolhe, sem botão de salvar.
export function SeletorEtapa({
  acao,
  apropriacaoId,
  etapaId,
  etapas,
}: {
  acao: (form: FormData) => Promise<void>;
  apropriacaoId: string;
  etapaId: string | null;
  etapas: { id: string; nome: string }[];
}) {
  return (
    <form action={acao}>
      <input type="hidden" name="id" value={apropriacaoId} />
      <select
        name="etapa_id"
        defaultValue={etapaId ?? ""}
        className={`campo !py-1 ${etapaId ? "" : "text-stone-400"}`}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Etapa do orçamento"
      >
        <option value="">sem etapa</option>
        {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select>
    </form>
  );
}
