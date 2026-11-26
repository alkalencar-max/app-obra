const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export const reais = (v: number | string | null | undefined) => brl.format(Number(v ?? 0));
export const porcento = (v: number) => pct.format(Number.isFinite(v) ? v : 0);

// "2026-10-21" -> "21/10/2026", sem passar por fuso horário.
export const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesAno = (iso: string) => `${MESES.at(Number(iso.slice(5, 7)) - 1)}/${iso.slice(2, 4)}`;

export const bm = (n: number | null | undefined) => (n ? `BM${String(n).padStart(2, "0")}` : "");
