"use client";

import { useMemo, useState, useTransition } from "react";
import { mesAno, reais } from "@/lib/formato";
import { salvarCronograma } from "./acoes";

type Etapa = { id: string; nome: string; orcado: number };

const somaMes = (mes: string, n: number) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
};
const pct = (s: string | undefined) => {
  if (!s) return 0;
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};
const fmt = (v: number) => (v ? String(Math.round(v * 10000) / 10000).replace(".", ",") : "");

// Grade do cronograma físico-financeiro: % do orçado de cada etapa em cada mês.
export function GradeCronograma({ obraId, etapas, meses: mesesIniciais, valores: iniciais }: { obraId: string; etapas: Etapa[]; meses: string[]; valores: Record<string, number> }) {
  const [meses, setMeses] = useState(mesesIniciais);
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(iniciais).map(([k, v]) => [k, fmt(v * 100)])));
  const [msg, setMsg] = useState<{ ok?: boolean; texto: string } | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [salvando, iniciar] = useTransition();
  const chave = (e: string, m: string) => `${e}|${m}`;

  const muda = (k: string, v: string) => {
    setValores((o) => ({ ...o, [k]: v }));
    setAlterado(true);
    setMsg(null);
  };

  // Reparte o que falta para 100% da etapa igualmente entre os meses vazios que ficam entre o primeiro e o último preenchido.
  function repartir(e: Etapa) {
    const preenchidos = meses.filter((m) => pct(valores[chave(e.id, m)]) > 0);
    const de = preenchidos.length ? meses.indexOf(preenchidos[0]) : 0;
    const ate = preenchidos.length > 1 ? meses.indexOf(preenchidos.at(-1)!) : meses.length - 1;
    let alvo = meses.slice(de, ate + 1).filter((m) => !pct(valores[chave(e.id, m)]));
    // Sem mês vazio no meio: usa o mês seguinte ao último preenchido.
    if (!alvo.length && preenchidos.length && meses[ate + 1]) alvo = [meses[ate + 1]];
    const falta = 100 - preenchidos.reduce((s, m) => s + pct(valores[chave(e.id, m)]), 0);
    if (!alvo.length || falta <= 0) return;
    const cada = Math.floor((falta / alvo.length) * 100) / 100;
    setValores((o) => {
      const n = { ...o };
      alvo.forEach((m, i) => (n[chave(e.id, m)] = fmt(i === alvo.length - 1 ? falta - cada * (alvo.length - 1) : cada)));
      return n;
    });
    setAlterado(true);
  }

  const totais = useMemo(() => {
    const porMes = meses.map((m) => etapas.reduce((s, e) => s + (pct(valores[chave(e.id, m)]) / 100) * e.orcado, 0));
    const acumulado = porMes.map((_, i) => porMes.slice(0, i + 1).reduce((s, v) => s + v, 0));
    return { porMes, acumulado };
  }, [meses, etapas, valores]);
  const orcadoTotal = etapas.reduce((s, e) => s + e.orcado, 0);

  function salvar() {
    const linhas = etapas.flatMap((e) =>
      meses.map((m) => ({ etapa_id: e.id, mes: m, percentual: Math.round(pct(valores[chave(e.id, m)]) * 1e8) / 1e10 })).filter((l) => l.percentual > 0),
    );
    iniciar(async () => {
      const r = await salvarCronograma(obraId, linhas);
      if (r.erro) setMsg({ texto: r.erro });
      else {
        setMsg({ ok: true, texto: "Cronograma salvo." });
        setAlterado(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="rotulo mb-0" htmlFor="inicio">Início</label>
        <input
          id="inicio"
          type="month"
          className="campo w-auto py-1"
          value={meses[0]?.slice(0, 7) ?? ""}
          onChange={(e) => {
            if (!e.target.value) return;
            const novo = `${e.target.value}-01`;
            const dif = (Number(novo.slice(0, 4)) - Number(meses[0].slice(0, 4))) * 12 + Number(novo.slice(5, 7)) - Number(meses[0].slice(5, 7));
            // Desloca a grade inteira, mantendo os percentuais nas mesmas colunas.
            setValores((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => { const [et, m] = k.split("|"); return [chave(et, somaMes(m, dif)), v]; })));
            setMeses((ms) => ms.map((m) => somaMes(m, dif)));
            setAlterado(true);
          }}
        />
        <span className="text-stone-500">{meses.length} meses</span>
        <button type="button" className="botao-secundario py-1" onClick={() => { setMeses((ms) => [...ms, somaMes(ms.at(-1)!, 1)]); setAlterado(true); }}>+ mês</button>
        <button type="button" className="botao-secundario py-1" disabled={meses.length <= 1} onClick={() => { setMeses((ms) => ms.slice(0, -1)); setAlterado(true); }}>− mês</button>
        <div className="ml-auto flex items-center gap-3">
          {alterado && <span className="text-xs text-amber-700">Há alterações não salvas.</span>}
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.texto}</span>}
          <button type="button" className="botao" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar cronograma"}</button>
        </div>
      </div>

      <div className="cartao overflow-x-auto p-0">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-stone-50 text-stone-500">
              <th className="sticky left-0 z-10 min-w-48 bg-stone-50 px-2 py-2 text-left font-semibold">Etapa</th>
              <th className="px-2 text-right font-semibold">Orçado</th>
              <th className="px-2 text-right font-semibold">Total %</th>
              {meses.map((m) => <th key={m} className="min-w-16 px-1 text-center font-semibold">{mesAno(m)}</th>)}
            </tr>
          </thead>
          <tbody>
            {etapas.map((e) => {
              const soma = meses.reduce((s, m) => s + pct(valores[chave(e.id, m)]), 0);
              const ok = Math.abs(soma - 100) < 0.01;
              return (
                <tr key={e.id} className="border-t border-stone-100">
                  <td className="sticky left-0 z-10 bg-white px-2 py-1">
                    <span className="block truncate font-medium">{e.nome}</span>
                    {!ok && <button type="button" className="text-[11px] text-amber-700 underline" onClick={() => repartir(e)}>repartir o que falta</button>}
                  </td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums">{reais(e.orcado)}</td>
                  <td className={`px-2 text-right font-semibold tabular-nums ${ok ? "text-emerald-700" : soma > 100 ? "text-red-600" : "text-amber-700"}`}>{fmt(soma) || "0"}%</td>
                  {meses.map((m) => {
                    const k = chave(e.id, m);
                    return (
                      <td key={m} className="px-0.5 py-0.5">
                        <input
                          className={`w-full rounded border px-1 py-1 text-right tabular-nums outline-none focus:border-amber-500 ${pct(valores[k]) ? "border-amber-200 bg-amber-50" : "border-stone-100"}`}
                          value={valores[k] ?? ""}
                          onChange={(ev) => muda(k, ev.target.value)}
                          inputMode="decimal"
                          aria-label={`${e.nome} ${mesAno(m)} %`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-stone-200 font-semibold">
            <tr>
              <td className="sticky left-0 bg-white px-2 py-1">Total do mês</td>
              <td className="px-2 text-right tabular-nums">{reais(orcadoTotal)}</td>
              <td />
              {totais.porMes.map((v, i) => <td key={i} className="whitespace-nowrap px-1 text-right tabular-nums">{v ? reais(v).replace("R$", "").trim() : ""}</td>)}
            </tr>
            <tr className="text-stone-500">
              <td className="sticky left-0 bg-white px-2 py-1">Acumulado</td>
              <td />
              <td />
              {totais.acumulado.map((v, i) => (
                <td key={i} className="whitespace-nowrap px-1 text-right tabular-nums">{orcadoTotal ? `${((v / orcadoTotal) * 100).toFixed(1).replace(".", ",")}%` : ""}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-stone-500">Digite o % do orçado de cada etapa em cada mês. Cada etapa deve fechar 100%. O dashboard usa este cronograma na curva previsto x realizado.</p>
    </div>
  );
}
