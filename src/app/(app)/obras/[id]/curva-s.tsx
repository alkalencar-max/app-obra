"use client";

import { useEffect, useRef, useState } from "react";
import { mesAno, reais } from "@/lib/formato";
import { COR, reaisCurto } from "./graficos";

export type PontoCurva = { mes: string; previsto: number; realizado: number | null };

const L = 64, R = 12, T = 12, B = 28;

// Curva S: previsto acumulado (cronograma) x realizado acumulado (pago), mês a mês.
export function CurvaS({ pontos }: { pontos: PontoCurva[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [W, setW] = useState(720);
  const caixa = useRef<HTMLDivElement>(null);
  // Desenha na largura real da tela para o texto manter o tamanho no celular.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  if (pontos.length === 0) return null;
  const H = W < 500 ? 220 : 280;

  const max = Math.max(1, ...pontos.map((p) => Math.max(p.previsto, p.realizado ?? 0))) * 1.05;
  const passo = (W - L - R) / pontos.length;
  const x = (i: number) => L + passo * (i + 0.5);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => (max / 1.05) * f);
  const cadaN = Math.ceil(pontos.length / Math.max(2, Math.floor((W - L - R) / 56)));

  const linha = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");

  const p = ativo == null ? null : pontos[ativo];

  return (
    <div className="relative" ref={caixa}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full print:h-auto print:w-full" role="img" aria-label="Curva previsto x realizado acumulado">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e7e5e4" strokeWidth={1} />
            <text x={L - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#78716c">
              {reaisCurto(t)}
            </text>
          </g>
        ))}
        {pontos.map((pt, i) =>
          i % cadaN === 0 ? (
            <text key={pt.mes} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#78716c">
              {mesAno(pt.mes)}
            </text>
          ) : null,
        )}
        {ativo != null && <line x1={x(ativo)} x2={x(ativo)} y1={T} y2={H - B} stroke="#a8a29e" strokeWidth={1} />}
        <polyline points={linha(pontos.map((pt) => pt.previsto))} fill="none" stroke={COR.previsto} strokeWidth={2} strokeDasharray="6 4" strokeLinejoin="round" />
        <polyline points={linha(pontos.map((pt) => pt.realizado))} fill="none" stroke={COR.realizado} strokeWidth={2} strokeLinejoin="round" />
        {p && (
          <>
            <circle cx={x(ativo!)} cy={y(p.previsto)} r={4.5} fill={COR.previsto} stroke="#fff" strokeWidth={2} />
            {p.realizado != null && <circle cx={x(ativo!)} cy={y(p.realizado)} r={4.5} fill={COR.realizado} stroke="#fff" strokeWidth={2} />}
          </>
        )}
        {pontos.map((pt, i) => (
          <rect
            key={pt.mes}
            x={L + passo * i}
            y={T}
            width={passo}
            height={H - T - B}
            fill="transparent"
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
            onTouchStart={() => setAtivo(i)}
          />
        ))}
      </svg>
      {p && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-52 rounded-md border border-stone-200 bg-white p-2 text-xs shadow-md"
          style={{ left: Math.min(Math.max(0, x(ativo!) + (ativo! < pontos.length / 2 ? 12 : -220)), W - 208) }}
        >
          <p className="mb-1 font-semibold">{mesAno(p.mes)} (acumulado)</p>
          <Linha cor={COR.previsto} nome="Previsto" valor={reais(p.previsto)} />
          <Linha cor={COR.realizado} nome="Realizado" valor={p.realizado == null ? "—" : reais(p.realizado)} />
          {p.realizado != null && (
            <p className={`mt-1 border-t border-stone-100 pt-1 tabular-nums ${p.realizado > p.previsto ? "text-red-600" : "text-emerald-700"}`}>
              {p.realizado > p.previsto ? "▲ acima" : "▼ abaixo"} do previsto: {reais(Math.abs(p.realizado - p.previsto))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Linha({ cor, nome, valor }: { cor: string; nome: string; valor: string }) {
  return (
    <p className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-stone-600">
        <span className="inline-block h-0.5 w-3" style={{ background: cor }} />
        {nome}
      </span>
      <span className="tabular-nums text-stone-900">{valor}</span>
    </p>
  );
}
