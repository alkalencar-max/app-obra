// Extrai data, valor e favorecido do texto de um comprovante brasileiro (PIX, TED, boleto, recibo).
// Funciona com o texto de um PDF ou com o texto lido por OCR de uma foto. Não usa internet nem IA.

export type Extraido = { data: string | null; valor: number | null; favorecido: string | null; descricao: string | null };

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function dataValida(d: number, m: number, a: number): string | null {
  if (a < 100) a += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 2000 || a > 2100) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function datasDaLinha(linha: string): string[] {
  const achadas: string[] = [];
  const l = semAcento(linha.toLowerCase());
  for (const m of l.matchAll(/\b(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4})\b/g)) {
    const d = dataValida(+m[1], +m[2], +m[3]);
    if (d) achadas.push(d);
  }
  for (const m of l.matchAll(/\b(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*(?:de\s+)?(\d{4})\b/g)) {
    const d = dataValida(+m[1], MESES[m[2]], +m[3]);
    if (d) achadas.push(d);
  }
  return achadas;
}

// "1.234,56" ou "1234,56" ou "1234.56" → número
function numero(txt: string): number | null {
  let t = txt.replace(/\s/g, "");
  if (/,\d{2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{2}$/.test(t)) t = t.replace(/,/g, "");
  else return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function valoresDaLinha(linha: string): number[] {
  const achados: number[] = [];
  for (const m of linha.matchAll(/R\s?\$\s*([\d.\s]*\d[,.]\d{2})\b/gi)) {
    const n = numero(m[1]);
    if (n != null) achados.push(n);
  }
  return achados;
}

const ROTULO_FAVORECIDO =
  /^(para|destino|destinatario|favorecido|recebedor|beneficiario|cedente|quem recebeu|dados do recebedor|dados do favorecido|dados de quem recebeu|conta de destino|pago para|pagamento para|enviado para|transferido para)\b\s*:?\s*(.*)$/i;
const ROTULO_NOME = /^(nome|razao social|nome do favorecido|nome do recebedor|nome\/razao social)\b\s*:?\s*(.*)$/i;
// Linhas que não são nome de ninguém.
const NAO_E_NOME =
  /^(cpf|cnpj|chave|instituicao|banco|agencia|conta|tipo|data|valor|r\$|id|codigo|autenticacao|pix|ted|doc|nome|origem|pagador|de\b|ispb|horario|hora)/i;

function pareceNome(l: string) {
  const s = semAcento(l).trim();
  if (s.length < 3 || NAO_E_NOME.test(s)) return false;
  const letras = (s.match(/[a-z]/gi) ?? []).length;
  const digitos = (s.match(/\d/g) ?? []).length;
  return letras >= 3 && digitos <= 2 && letras > s.length * 0.5;
}

function limparNome(l: string) {
  return l.replace(/\s+/g, " ").replace(/^[\s:•\-–]+|[\s:•\-–]+$/g, "").trim();
}

function acharFavorecido(linhas: string[]): string | null {
  const norm = linhas.map((l) => semAcento(l).trim());
  for (let i = 0; i < norm.length; i++) {
    const m = norm[i].match(ROTULO_FAVORECIDO);
    if (!m) continue;
    // Nome na mesma linha ("Para: FULANO").
    if (m[2] && pareceNome(m[2])) return limparNome(linhas[i].slice(linhas[i].length - m[2].length));
    // Senão, procura nas próximas linhas: primeiro um rótulo "Nome", depois a primeira linha com cara de nome.
    for (let j = i + 1; j < Math.min(i + 6, norm.length); j++) {
      const n = norm[j].match(ROTULO_NOME);
      if (n) {
        if (n[2] && pareceNome(n[2])) return limparNome(linhas[j].slice(linhas[j].length - n[2].length));
        if (j + 1 < norm.length && pareceNome(norm[j + 1])) return limparNome(linhas[j + 1]);
        continue;
      }
      if (pareceNome(norm[j])) return limparNome(linhas[j]);
    }
  }
  return null;
}

export function extrairComprovante(texto: string): Extraido {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const baixo = linhas.map((l) => semAcento(l.toLowerCase()));

  // Valor: o que estiver na linha (ou logo abaixo) de "valor"/"total"; senão o maior R$ do comprovante.
  let valor: number | null = null;
  for (let i = 0; i < linhas.length && valor == null; i++) {
    if (!/\b(valor|total|pago|quantia)\b/.test(baixo[i]) || /\b(desconto|juros|multa|tarifa)\b/.test(baixo[i])) continue;
    valor = valoresDaLinha(linhas[i])[0] ?? (linhas[i + 1] ? valoresDaLinha(linhas[i + 1])[0] : undefined) ?? null;
  }
  if (valor == null) {
    const todos = linhas.flatMap(valoresDaLinha);
    if (todos.length) valor = Math.max(...todos);
  }

  // Data: a da linha de "data/pagamento/realizado"; senão a primeira que aparecer.
  // Vencimento e emissão ficam de fora: o que interessa é quando foi pago.
  let data: string | null = null;
  for (const rotulo of [/(pagamento|pago|realizad|efetuad|debitad|transferencia)/, /\b(data|em)\b/]) {
    for (let i = 0; i < linhas.length && !data; i++) {
      if (!rotulo.test(baixo[i]) || /(vencimento|emissao|validade|nascimento)/.test(baixo[i])) continue;
      data = datasDaLinha(linhas[i])[0] ?? (linhas[i + 1] ? datasDaLinha(linhas[i + 1])[0] : undefined) ?? null;
    }
  }
  if (!data) data = linhas.flatMap(datasDaLinha)[0] ?? null;

  const tudo = baixo.join(" ");
  const tipo = /\bpix\b/.test(tudo) ? "PIX" : /\bboleto\b/.test(tudo) ? "BOLETO" : /\bted\b/.test(tudo) ? "TED" : null;

  return { data, valor, favorecido: acharFavorecido(linhas), descricao: tipo };
}
