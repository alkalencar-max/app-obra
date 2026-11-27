// Leitura grátis do comprovante, feita no próprio navegador (sem IA e sem custo).
// PDF com texto: lê o texto direto. Foto ou PDF escaneado: reconhece o texto com OCR (Tesseract, português).
// As bibliotecas só são baixadas na primeira vez que alguém envia um comprovante.
import { extrairComprovante, type Extraido } from "./extrair-comprovante";

const PDFJS_VERSAO = "6.4.299";

async function abrirPdf(arquivo: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSAO}/build/pdf.worker.min.mjs`;
  return pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
}

// Junta os pedaços de texto da página em linhas, pela posição vertical.
async function textoDoPdf(pdf: Awaited<ReturnType<typeof abrirPdf>>): Promise<string> {
  const linhas: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 2); n++) {
    const pagina = await pdf.getPage(n);
    const conteudo = await pagina.getTextContent();
    let y: number | null = null;
    let atual = "";
    for (const item of conteudo.items) {
      if (!("str" in item)) continue;
      const yi = Math.round(item.transform[5]);
      if (y != null && Math.abs(yi - y) > 3) {
        linhas.push(atual);
        atual = "";
      }
      atual += (atual && !atual.endsWith(" ") ? " " : "") + item.str;
      y = yi;
      if (item.hasEOL) {
        linhas.push(atual);
        atual = "";
        y = null;
      }
    }
    if (atual) linhas.push(atual);
  }
  return linhas.map((l) => l.trim()).filter(Boolean).join("\n");
}

async function primeiraPaginaComoImagem(pdf: Awaited<ReturnType<typeof abrirPdf>>): Promise<HTMLCanvasElement> {
  const pagina = await pdf.getPage(1);
  const vista = pagina.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = vista.width;
  canvas.height = vista.height;
  await pagina.render({ canvas, viewport: vista }).promise;
  return canvas;
}

// Prepara a foto para o OCR: tons de cinza, contraste esticado e tamanho bom para leitura.
// Texto colorido (laranja, roxo) em fundo claro fica escuro e nítido.
async function prepararImagem(imagem: File | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const origem = imagem instanceof HTMLCanvasElement ? imagem : await createImageBitmap(imagem);
  const escala = Math.min(3, Math.max(1, 1600 / Math.max(origem.width, origem.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(origem.width * escala);
  canvas.height = Math.round(origem.height * escala);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(origem, 0, 0, canvas.width, canvas.height);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = px.data;
  const cinza = new Uint8ClampedArray(d.length / 4);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < cinza.length; i++) {
    // Usa o canal mais escuro: cor viva vira escura, papel continua claro.
    const v = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    cinza[i] = v;
    hist[v]++;
  }
  // Estica o contraste: o tom mais escuro do texto vira preto e o tom do papel vira branco.
  // Texto ocupa pouco da imagem, então o escuro é o 0,3% mais escuro; o papel é a maioria, então o claro é a mediana.
  const total = cinza.length;
  let acum = 0, min = 0, max = 255;
  for (let v = 0; v < 256; v++) { acum += hist[v]; if (acum > total * 0.003) { min = v; break; } }
  acum = 0;
  for (let v = 255; v >= 0; v--) { acum += hist[v]; if (acum > total * 0.5) { max = v; break; } }
  if (max - min < 40) { min = 0; max = 255; }
  const faixa = Math.max(1, max - min);
  for (let i = 0; i < cinza.length; i++) {
    const v = ((cinza[i] - min) * 255) / faixa;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  ctx.putImageData(px, 0, 0);
  return canvas;
}

// Um só leitor por página: carregar o OCR demora, então ele fica pronto para os próximos comprovantes.
let leitor: Promise<import("tesseract.js").Worker> | null = null;

async function ocr(imagem: File | HTMLCanvasElement): Promise<string> {
  if (!leitor) leitor = import("tesseract.js").then(({ createWorker }) => createWorker("por"));
  try {
    const { data } = await (await leitor).recognize(await prepararImagem(imagem));
    return data.text;
  } catch (e) {
    leitor = null;
    throw e;
  }
}

export async function lerComprovanteLocal(arquivo: File): Promise<Extraido> {
  let texto = "";
  if (arquivo.type === "application/pdf") {
    const pdf = await abrirPdf(arquivo);
    texto = await textoDoPdf(pdf);
    if (texto.replace(/\s/g, "").length < 20) texto = await ocr(await primeiraPaginaComoImagem(pdf));
  } else {
    texto = await ocr(arquivo);
  }
  return extrairComprovante(texto);
}

// Reduz a foto no navegador (máx. 1800 px, JPEG) para subir rápido e caber no limite de envio.
export async function reduzirFoto(arquivo: File): Promise<File> {
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
