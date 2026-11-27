"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { salvarLancamento, type EstadoLancamento } from "../acoes";
import { lerComprovante } from "../comprovante";
import { lerComprovanteLocal } from "@/lib/ler-comprovante-local";

// Reduz a foto no navegador (máx. 1800 px, JPEG) para subir rápido e caber no limite de envio.
async function reduzirFoto(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/")) return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    return blob ? new File([blob], "comprovante.jpg", { type: "image/jpeg" }) : arquivo;
  } catch {
    return arquivo;
  }
}

type Opcao = { id: string; nome: string };

export function FormLancamento({
  obraId,
  apropriacoes,
  grupos,
  fornecedores,
  medicaoPadrao,
}: {
  obraId: string;
  apropriacoes: Opcao[];
  grupos: Opcao[];
  fornecedores: string[];
  medicaoPadrao: number;
}) {
  const [estado, acao, salvando] = useActionState<EstadoLancamento, FormData>(salvarLancamento.bind(null, obraId), {});
  const form = useRef<HTMLFormElement>(null);
  const [comprovante, setComprovante] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [lendo, iniciarLeitura] = useTransition();

  function preencher(campo: string, valor: string | null | undefined) {
    const el = form.current?.elements.namedItem(campo) as HTMLInputElement | null;
    if (el && valor) el.value = valor;
  }

  function enviarComprovante(arquivo: File) {
    setAviso(null);
    iniciarLeitura(async () => {
      const dados = new FormData();
      dados.append("arquivo", await reduzirFoto(arquivo));
      let r = await lerComprovante(obraId, dados);
      if (r.caminho) setComprovante(r.caminho);
      if (r.semIA) {
        // Leitura grátis no navegador (OCR).
        try {
          const lido = await lerComprovanteLocal(arquivo);
          const achou = lido.valor != null || lido.data != null || lido.favorecido != null;
          r = { ...r, ...lido, erro: achou ? undefined : "Comprovante guardado, mas não consegui ler os dados. Preencha os campos à mão." };
        } catch (e) {
          console.error("lerComprovanteLocal", e);
          r = { ...r, erro: "Comprovante guardado, mas a leitura falhou. Preencha os campos à mão." };
        }
      }
      preencher("data", r.data);
      preencher("valor", r.valor != null ? r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, useGrouping: false }) : null);
      preencher("fornecedor", r.favorecido?.toUpperCase());
      preencher("descricao", r.descricao?.toUpperCase());
      if (r.erro) setAviso({ tipo: "erro", texto: r.erro });
      else {
        const faltou = [r.data ? null : "data", r.valor != null ? null : "valor", r.favorecido ? null : "favorecido"].filter(Boolean);
        setAviso({
          tipo: "ok",
          texto: `Comprovante lido. Confira os valores${faltou.length ? ` (não achei: ${faltou.join(", ")})` : ""}, escolha a apropriação e clique em Lançar.`,
        });
        (form.current?.elements.namedItem("apropriacao_id") as HTMLSelectElement | null)?.focus();
      }
    });
  }

  // Depois de salvar, limpa o valor e a descrição e mantém o resto (data, BM, apropriação) para o próximo.
  useEffect(() => {
    if (!estado.ok || !form.current) return;
    setComprovante(null);
    setAviso(null);
    for (const campo of ["valor", "descricao", "obs"]) {
      const el = form.current.elements.namedItem(campo) as HTMLInputElement | null;
      if (el) el.value = "";
    }
    (form.current.elements.namedItem("valor") as HTMLInputElement | null)?.focus();
  }, [estado.ok]);

  const hoje = new Date().toLocaleDateString("sv-SE");

  return (
    <form ref={form} action={acao} className="cartao grid gap-3 sm:grid-cols-6">
      <h2 className="font-semibold sm:col-span-6">Novo lançamento</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-3 sm:col-span-6">
        <label className={`botao cursor-pointer ${lendo ? "pointer-events-none opacity-50" : ""}`}>
          {lendo ? "Lendo comprovante…" : "📎 Enviar comprovante"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={lendo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviarComprovante(f);
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-sm text-stone-600">
          {comprovante ? "✓ Comprovante anexado a este lançamento." : "Foto ou PDF do PIX, boleto ou recibo: eu leio data, valor e favorecido, você só escolhe a apropriação."}
        </span>
        {aviso && <p className={`w-full text-sm ${aviso.tipo === "ok" ? "text-emerald-700" : "text-amber-700"}`}>{aviso.texto}</p>}
        <input type="hidden" name="comprovante_path" value={comprovante ?? ""} />
      </div>
      <div>
        <label className="rotulo" htmlFor="data">Data</label>
        <input className="campo" id="data" name="data" type="date" defaultValue={hoje} required />
      </div>
      <div>
        <label className="rotulo" htmlFor="valor">Valor (R$)</label>
        <input className="campo" id="valor" name="valor" inputMode="decimal" placeholder="0,00" required />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="fornecedor">Fornecedor</label>
        <input className="campo" id="fornecedor" name="fornecedor" list="lista-fornecedores" autoComplete="off" />
        <datalist id="lista-fornecedores">
          {fornecedores.map((f) => <option key={f} value={f} />)}
        </datalist>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="descricao">Pedido / breve descrição</label>
        <input className="campo" id="descricao" name="descricao" placeholder="ex.: PED87 - AREIA E BRITA" />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="apropriacao_id">Apropriação</label>
        <select className="campo" id="apropriacao_id" name="apropriacao_id" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          {apropriacoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="grupo_id">Grupo</label>
        <select className="campo" id="grupo_id" name="grupo_id" defaultValue="">
          <option value="">—</option>
          {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
      </div>
      <div>
        <label className="rotulo" htmlFor="medicao">Nº medição</label>
        <input className="campo" id="medicao" name="medicao" inputMode="numeric" defaultValue={medicaoPadrao} />
      </div>
      <div>
        <label className="rotulo" htmlFor="status">Situação</label>
        <select className="campo" id="status" name="status" defaultValue="pago">
          <option value="pago">Pago</option>
          <option value="a_pagar">A pagar</option>
        </select>
      </div>
      <div className="sm:col-span-4">
        <label className="rotulo" htmlFor="obs">Obs</label>
        <input className="campo" id="obs" name="obs" />
      </div>
      <div className="flex items-end gap-3 sm:col-span-2">
        <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Lançar"}</button>
        {estado.erro && <span className="text-sm text-red-600">{estado.erro}</span>}
        {estado.ok && !estado.erro && <span className="text-sm text-emerald-700">Lançado!</span>}
      </div>
    </form>
  );
}
