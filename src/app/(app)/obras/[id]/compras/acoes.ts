"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dividirParcelas, txt, valorBr } from "@/lib/campos";
import { exigirEmpresa } from "@/lib/sessao";

export type Estado = { erro?: string };

type ItemNovo = { descricao: string; quantidade: string; unidade: string; orcamento_item_id?: string };

async function fornecedorPorNome(supabase: Awaited<ReturnType<typeof exigirEmpresa>>["supabase"], empresaId: string, nome: string) {
  const { data, error } = await supabase
    .from("fornecedores")
    .upsert({ empresa_id: empresaId, nome: nome.toUpperCase() }, { onConflict: "empresa_id,nome" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function criarCotacao(obraId: string, _: Estado, form: FormData): Promise<Estado> {
  const { supabase, empresaId } = await exigirEmpresa();

  const numero = Number(txt(form, "numero"));
  const titulo = txt(form, "titulo")?.toUpperCase();
  if (!(numero > 0)) return { erro: "Informe o número da cotação." };
  if (!titulo) return { erro: "Dê um nome à cotação (ex.: MAT RAMPA E CX DE RETARDO)." };

  let itens: ItemNovo[] = [];
  try {
    itens = JSON.parse(String(form.get("itens") ?? "[]"));
  } catch {
    return { erro: "Não consegui ler os itens." };
  }
  const validos = itens
    .map((i) => ({
      descricao: i.descricao.trim().toUpperCase(),
      quantidade: valorBr(i.quantidade),
      unidade: i.unidade.trim().toUpperCase() || null,
      orcamento_item_id: i.orcamento_item_id || null,
    }))
    .filter((i) => i.descricao);
  if (validos.length === 0) return { erro: "Inclua pelo menos um item." };
  if (validos.some((i) => !(i.quantidade > 0))) return { erro: "Todo item precisa de quantidade maior que zero." };

  const nomes = [...new Set(form.getAll("fornecedor").map((f) => String(f).trim().toUpperCase()).filter(Boolean))];

  const { data: cot, error } = await supabase
    .from("cotacoes")
    .insert({
      empresa_id: empresaId,
      obra_id: obraId,
      numero,
      titulo,
      apropriacao_id: txt(form, "apropriacao_id"),
      grupo_id: txt(form, "grupo_id"),
    })
    .select("id")
    .single();
  if (error) return { erro: error.code === "23505" ? `Já existe a cotação COT${numero}. Use outro número.` : error.message };

  const { error: erroItens } = await supabase
    .from("cotacao_itens")
    .insert(validos.map((i, n) => ({ ...i, empresa_id: empresaId, cotacao_id: cot.id, ordem: n + 1 })));
  if (erroItens) return { erro: erroItens.message };

  for (const [n, nome] of nomes.entries()) {
    const fornecedorId = await fornecedorPorNome(supabase, empresaId, nome);
    const { error: e } = await supabase
      .from("cotacao_propostas")
      .insert({ empresa_id: empresaId, cotacao_id: cot.id, fornecedor_id: fornecedorId, ordem: n + 1 });
    if (e) return { erro: e.message };
  }

  revalidatePath(`/obras/${obraId}/compras`);
  redirect(`/obras/${obraId}/compras/${cot.id}`);
}

// Salva o mapa de cotações inteiro: preços unitários, frete, desconto, condição e prazo de cada fornecedor.
export async function salvarMapa(obraId: string, cotacaoId: string, _: Estado, form: FormData): Promise<Estado> {
  const { supabase, empresaId } = await exigirEmpresa();

  const { data: propostas } = await supabase.from("cotacao_propostas").select("id").eq("cotacao_id", cotacaoId);
  const { data: itens } = await supabase.from("cotacao_itens").select("id").eq("cotacao_id", cotacaoId);

  const precos: { empresa_id: string; cotacao_id: string; proposta_id: string; item_id: string; valor_unitario: number }[] = [];
  const apagar: { proposta_id: string; item_id: string }[] = [];
  for (const p of propostas ?? []) {
    for (const i of itens ?? []) {
      const v = valorBr(txt(form, `preco_${p.id}_${i.id}`));
      if (Number.isFinite(v)) precos.push({ empresa_id: empresaId, cotacao_id: cotacaoId, proposta_id: p.id, item_id: i.id, valor_unitario: v });
      else apagar.push({ proposta_id: p.id, item_id: i.id });
    }
    const { error } = await supabase
      .from("cotacao_propostas")
      .update({
        frete: valorBr(txt(form, `frete_${p.id}`)) || 0,
        desconto: valorBr(txt(form, `desconto_${p.id}`)) || 0,
        condicao_pagamento: txt(form, `condicao_${p.id}`),
        prazo_entrega: txt(form, `prazo_${p.id}`),
      })
      .eq("id", p.id);
    if (error) return { erro: error.message };
  }

  if (precos.length) {
    const { error } = await supabase.from("cotacao_precos").upsert(precos, { onConflict: "proposta_id,item_id" });
    if (error) return { erro: error.message };
  }
  for (const a of apagar) {
    await supabase.from("cotacao_precos").delete().eq("proposta_id", a.proposta_id).eq("item_id", a.item_id);
  }

  const novo = txt(form, "novo_fornecedor");
  if (novo) {
    const fornecedorId = await fornecedorPorNome(supabase, empresaId, novo);
    const { error } = await supabase
      .from("cotacao_propostas")
      .insert({ empresa_id: empresaId, cotacao_id: cotacaoId, fornecedor_id: fornecedorId, ordem: (propostas?.length ?? 0) + 1 });
    if (error) return { erro: error.code === "23505" ? "Esse fornecedor já está na cotação." : error.message };
  }

  revalidatePath(`/obras/${obraId}/compras/${cotacaoId}`);
  return {};
}

export async function removerFornecedor(obraId: string, cotacaoId: string, form: FormData) {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase.from("cotacao_propostas").delete().eq("id", String(form.get("proposta_id"))).eq("cotacao_id", cotacaoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}/compras/${cotacaoId}`);
}

export async function definirApropriacao(obraId: string, cotacaoId: string, form: FormData) {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase
    .from("cotacoes")
    .update({ apropriacao_id: txt(form, "apropriacao_id"), grupo_id: txt(form, "grupo_id") })
    .eq("id", cotacaoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}/compras/${cotacaoId}`);
}

export async function gerarPedido(obraId: string, cotacaoId: string, _: Estado, form: FormData): Promise<Estado> {
  const { supabase } = await exigirEmpresa();
  const propostaId = txt(form, "proposta_id");
  const n = Math.max(1, Math.min(60, Number(txt(form, "parcelas")) || 1));
  const primeiro = txt(form, "primeiro_vencimento");
  const intervalo = Math.max(0, Number(txt(form, "intervalo")) || 30);
  if (!propostaId) return { erro: "Escolha o fornecedor vencedor." };
  if (!primeiro) return { erro: "Informe o vencimento da 1ª parcela." };

  const { data: tot } = await supabase.from("v_proposta_total").select("total").eq("proposta_id", propostaId).single();
  const total = Number(tot?.total ?? 0);
  if (!(total > 0)) return { erro: "O fornecedor escolhido ainda não tem preços." };

  const { data: pedidoId, error } = await supabase.rpc("gerar_pedido", {
    p_proposta_id: propostaId,
    p_parcelas: dividirParcelas(total, n, primeiro, intervalo),
    p_condicao: txt(form, "condicao"),
  });
  if (error) return { erro: error.message };

  revalidatePath(`/obras/${obraId}`, "layout");
  redirect(`/obras/${obraId}/compras/${cotacaoId}/pedido?novo=${pedidoId}`);
}

export async function cancelarCotacao(obraId: string, cotacaoId: string) {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase.from("cotacoes").update({ status: "cancelada" }).eq("id", cotacaoId).eq("status", "aberta");
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}/compras`);
  redirect(`/obras/${obraId}/compras`);
}

export async function registrarRecebimento(obraId: string, cotacaoId: string, pedidoId: string, form: FormData) {
  const { supabase } = await exigirEmpresa();
  const { error } = await supabase
    .from("pedidos")
    .update({ status: "recebido", recebido_em: txt(form, "recebido_em"), nota_fiscal: txt(form, "nota_fiscal")?.toUpperCase() ?? null })
    .eq("id", pedidoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/obras/${obraId}/compras`);
  revalidatePath(`/obras/${obraId}/compras/${cotacaoId}/pedido`);
}
