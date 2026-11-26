import { porcento, reais } from "@/lib/formato";

// Cores dos gráficos: azul = realizado, laranja = previsto, cinza = orçado, vermelho só para estouro.
export const COR = { realizado: "#257de0", previsto: "#f47230", orcado: "#e7e5e4", estouro: "#dc2626" };

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
export const reaisCurto = (v: number) => `R$ ${compacto.format(v)}`;

export function Legenda({ itens }: { itens: { cor: string; nome: string; tracejado?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      {itens.map((i) => (
        <span key={i.nome} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-3 rounded-sm"
            style={i.tracejado ? { borderTop: `2px dashed ${i.cor}`, height: 0 } : { background: i.cor }}
          />
          {i.nome}
        </span>
      ))}
    </div>
  );
}

type Etapa = { nome: string; orcado: number; pago: number };

// Orçado (trilho cinza) x realizado (barra azul) por etapa; o que passa do orçado aparece em vermelho.
export function BarrasEtapas({ etapas }: { etapas: Etapa[] }) {
  const max = Math.max(1, ...etapas.map((e) => Math.max(e.orcado, e.pago)));
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="space-y-2.5">
      {etapas.map((e) => {
        const dentro = Math.min(e.pago, e.orcado || e.pago);
        const estouro = e.orcado ? Math.max(0, e.pago - e.orcado) : 0;
        const consumo = e.orcado ? e.pago / e.orcado : null;
        return (
          <div
            key={e.nome}
            className="grid grid-cols-[1fr_4.5rem] items-center gap-x-2 gap-y-1 text-xs sm:grid-cols-[minmax(0,14rem)_1fr_5.5rem]"
            title={`${e.nome}\nOrçado: ${reais(e.orcado)}\nRealizado: ${reais(e.pago)}\nSaldo: ${reais(e.orcado - e.pago)}`}
          >
            <span className="col-span-2 truncate text-stone-700 sm:col-span-1">{e.nome}</span>
            <div className="relative h-4">
              <div className="absolute inset-y-0 left-0 rounded" style={{ width: pct(e.orcado), background: COR.orcado }} />
              <div className="absolute inset-y-1 left-0 rounded" style={{ width: pct(dentro), background: COR.realizado }} />
              {estouro > 0 && (
                <div
                  className="absolute inset-y-1 rounded-r"
                  style={{ left: `calc(${pct(e.orcado)} + 2px)`, width: `calc(${pct(estouro)} - 2px)`, background: COR.estouro }}
                />
              )}
            </div>
            <span className={`text-right tabular-nums ${estouro > 0 ? "font-semibold text-red-600" : "text-stone-500"}`}>
              {consumo == null ? reaisCurto(e.pago) : `${estouro > 0 ? "▲ " : ""}${porcento(consumo)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Colunas do valor pago em cada boletim de medição.
export function ColunasMedicao({ medicoes }: { medicoes: { nome: string; valor: number }[] }) {
  const max = Math.max(1, ...medicoes.map((m) => m.valor));
  const ultima = medicoes.length - 1;
  return (
    <div className="mb-3">
      <p className="mb-1 text-right text-xs text-stone-500">
        Última: {medicoes[ultima]?.nome} · <span className="tabular-nums text-stone-800">{reais(medicoes[ultima]?.valor)}</span>
      </p>
      <div className="flex h-36 items-end gap-1 border-b border-stone-200">
        {medicoes.map((m, i) => (
          <div key={m.nome} className="flex h-full min-w-0 flex-1 items-end justify-center" title={`${m.nome}: ${reais(m.valor)}`}>
            <div
              className="w-full max-w-10 rounded-t"
              style={{ height: `${(Math.max(m.valor, 0) / max) * 100}%`, background: COR.realizado, opacity: i === ultima ? 1 : 0.7 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {medicoes.map((m) => (
          <span key={m.nome} className="min-w-0 flex-1 truncate text-center text-[10px] text-stone-500">{m.nome}</span>
        ))}
      </div>
    </div>
  );
}

// Barrinha horizontal usada dentro das tabelas de resumo.
export function BarraInline({ valor, max }: { valor: number; max: number }) {
  return (
    <div className="h-1.5 w-full rounded bg-stone-100">
      <div className="h-1.5 rounded" style={{ width: `${max ? (Math.max(valor, 0) / max) * 100 : 0}%`, background: COR.realizado }} />
    </div>
  );
}
