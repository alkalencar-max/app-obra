// Leitura de campos de formulário usados pelas server actions.
export const txt = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim() || null;

// Aceita "1.234,56", "1234,56", "1234.56" e "1.500" (ponto de milhar, como se digita no Brasil).
export const valorBr = (s: string | null | undefined) => {
  if (!s) return NaN;
  const limpo = s.replace(/[^\d,.-]/g, "");
  if (limpo.includes(",")) return Number(limpo.replace(/\./g, "").replace(",", "."));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) return Number(limpo.replace(/\./g, ""));
  return Number(limpo);
};

// Data de hoje no fuso de Brasília, em "aaaa-mm-dd".
export const hojeBr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

// Divide um total em n parcelas iguais (em centavos); a diferença do arredondamento vai na última.
export function dividirParcelas(total: number, n: number, primeiroVencimento: string, intervaloDias: number) {
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  const [a, m, d] = primeiroVencimento.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const data = new Date(Date.UTC(a, m - 1, d + i * intervaloDias));
    return {
      vencimento: data.toISOString().slice(0, 10),
      valor: (i === n - 1 ? centavos - base * (n - 1) : base) / 100,
    };
  });
}
