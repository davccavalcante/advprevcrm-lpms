import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DocumentStateId } from "@/lib/case-domain";
import { engineReport, OCR_LANGUAGE, runTool } from "@/lib/extraction/engine";

/*
 * Reading a document of this office, locally.
 *
 * Two paths and never a third. A PDF page that carries a text layer is read
 * directly, because the text is already there and running recognition over it
 * would be pure waste. A page that is really an image is rendered and read by
 * the local engine. Nothing is ever sent to the model to be transcribed.
 *
 * The rendering ladder is not taste, it was measured on the real corpus of this
 * office on 2026-08-12, nineteen documents and one hundred and forty seven
 * pages, of which only ten are images. Three hundred dots per inch in grey is
 * the best default; four hundred rescues the hardest document, a handwritten
 * orthopaedic report, from 68.5 to 69.8 per cent; six hundred and one bit black
 * and white both make it worse, the latter catastrophically, from 68.5 to 40.0;
 * and a blanket contrast filter, which sounds like an improvement, cost twelve
 * points on that same report. So the office renders at three hundred, measures,
 * and only retries when the page reads badly, keeping whichever attempt read
 * better. A retry never makes a page worse.
 */

export type ExtractionSource = "text-layer" | "ocr";

export type PageExtraction = {
  page: number;
  source: ExtractionSource;
  text: string;
  /* Zero to one hundred. A text layer is not a guess, it is the text the
   * document carries, so it is one hundred by construction. An optical read is
   * the mean confidence the engine itself reports, word by word. */
  confidence: number;
  words: number;
  attempt: string;
};

export type DocumentExtraction = {
  documentId: string;
  fileName: string;
  fingerprint: string;
  engine: string;
  language: string;
  extractedAt: string;
  durationMs: number;
  pageCount: number;
  ocrPages: number;
  textLayerPages: number;
  meanConfidence: number;
  state: DocumentStateId;
  note: string;
  pages: PageExtraction[];
};

/*
 * Thresholds, in mean confidence of a document. They come from the measurement
 * of the office's own corpus and each one has a document behind it: the power
 * of attorney reads at 91.8 and the physiotherapy report at 95.2, both plainly
 * usable; the handwritten orthopaedic report reads at 69.8, usable only after a
 * human confirms it; the knee radiograph reads at 21.5 and what comes out is
 * not language. Operators may move them by environment variable, never by
 * editing a number inside a component.
 */
function threshold(name: string, fallback: number): number {
  const raw = Number.parseFloat(process.env[name]?.trim() ?? "");
  return Number.isFinite(raw) ? raw : fallback;
}

export const CONFIDENCE_PROCESSED = threshold("OCR_CONFIDENCE_PROCESSED", 80);
export const CONFIDENCE_REVIEW = threshold("OCR_CONFIDENCE_REVIEW", 55);

/* A page with fewer characters than this is treated as an image even when the
 * PDF declares a text layer, because a scan often carries a header or a stamp
 * as text and nothing else. */
const TEXT_LAYER_MIN_CHARS = 120;

export function fingerprintOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

type Rung = { name: string; render: string[]; psm: string[] };

/* The ladder. The first rung answers for almost every page; the others exist
 * for the page that reads badly, and the best result wins. */
const LADDER: Rung[] = [
  { name: "300dpi cinza", render: ["-r", "300", "-gray"], psm: [] },
  { name: "400dpi cinza", render: ["-r", "400", "-gray"], psm: [] },
  {
    name: "300dpi cinza, segmentação com orientação",
    render: ["-r", "300", "-gray"],
    psm: ["--psm", "1"],
  },
];

async function pageCountOf(pdfPath: string): Promise<number> {
  const { stdout } = await runTool("pdfinfo", [pdfPath]);
  const match = stdout.match(/^Pages:\s+(\d+)/m);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

async function textLayerOf(pdfPath: string, page: number): Promise<string> {
  const { stdout } = await runTool("pdftotext", [
    "-layout",
    "-f",
    String(page),
    "-l",
    String(page),
    "-q",
    pdfPath,
    "-",
  ]);
  return stdout;
}

type OcrRead = { text: string; confidence: number; words: number };

async function readWithTesseract(
  imagePath: string,
  psm: string[],
): Promise<OcrRead> {
  const { stdout } = await runTool(
    "tesseract",
    [imagePath, "stdout", "-l", OCR_LANGUAGE, ...psm, "tsv"],
    180_000,
  );
  let sum = 0;
  let words = 0;
  const lines = new Map<string, string[]>();
  for (const row of stdout.split("\n").slice(1)) {
    const cols = row.split("\t");
    if (cols.length < 12) {
      continue;
    }
    const confidence = Number(cols[10]);
    const text = (cols[11] ?? "").trim();
    if (!Number.isFinite(confidence) || confidence < 0 || text.length === 0) {
      continue;
    }
    sum += confidence;
    words += 1;
    const key = `${cols[1]}:${cols[2]}:${cols[3]}:${cols[4]}`;
    const bucket = lines.get(key);
    if (bucket) {
      bucket.push(text);
    } else {
      lines.set(key, [text]);
    }
  }
  return {
    text: [...lines.values()].map((parts) => parts.join(" ")).join("\n"),
    confidence: words > 0 ? sum / words : 0,
    words,
  };
}

async function renderPage(
  workDir: string,
  pdfPath: string,
  page: number,
  render: string[],
): Promise<string | null> {
  const prefix = path.join(workDir, `page-${page}`);
  await runTool("pdftoppm", [
    ...render,
    "-png",
    "-f",
    String(page),
    "-l",
    String(page),
    pdfPath,
    prefix,
  ]);
  const produced = (await readdir(workDir)).find(
    (name) => name.startsWith(`page-${page}-`) && name.endsWith(".png"),
  );
  return produced ? path.join(workDir, produced) : null;
}

async function ocrPage(
  workDir: string,
  pdfPath: string,
  page: number,
): Promise<PageExtraction> {
  let best: PageExtraction = {
    page,
    source: "ocr",
    text: "",
    confidence: 0,
    words: 0,
    attempt: "nenhuma leitura",
  };

  for (const rung of LADDER) {
    const image = await renderPage(workDir, pdfPath, page, rung.render);
    if (!image) {
      continue;
    }
    const read = await readWithTesseract(image, rung.psm);
    await rm(image, { force: true });
    if (read.confidence > best.confidence) {
      best = {
        page,
        source: "ocr",
        text: read.text,
        confidence: read.confidence,
        words: read.words,
        attempt: rung.name,
      };
    }
    /* A page that already reads well does not pay for another attempt. */
    if (best.confidence >= CONFIDENCE_PROCESSED) {
      break;
    }
  }
  return best;
}

async function ocrImageFile(imagePath: string): Promise<PageExtraction> {
  let best: PageExtraction = {
    page: 1,
    source: "ocr",
    text: "",
    confidence: 0,
    words: 0,
    attempt: "nenhuma leitura",
  };
  for (const rung of LADDER) {
    const read = await readWithTesseract(imagePath, rung.psm);
    if (read.confidence > best.confidence) {
      best = {
        page: 1,
        source: "ocr",
        text: read.text,
        confidence: read.confidence,
        words: read.words,
        attempt: rung.name,
      };
    }
    if (best.confidence >= CONFIDENCE_PROCESSED) {
      break;
    }
  }
  return best;
}

/* The note goes to the record and to the screen, and the screen is written in
 * Brazilian Portuguese, where a decimal carries a comma. */
function percentLabel(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function stateOf(
  meanConfidence: number,
  pages: PageExtraction[],
): { state: DocumentStateId; note: string } {
  if (pages.length === 0) {
    return {
      state: "failed",
      note: "Nenhuma página pôde ser lida pelo motor local.",
    };
  }
  const onlyTextLayer = pages.every((page) => page.source === "text-layer");
  if (onlyTextLayer) {
    return {
      state: "processed",
      note: "Texto lido diretamente da camada de texto do arquivo, sem reconhecimento óptico.",
    };
  }
  if (meanConfidence >= CONFIDENCE_PROCESSED) {
    return {
      state: "processed",
      note: `Reconhecimento óptico local com confiança média de ${percentLabel(meanConfidence)} por cento.`,
    };
  }
  if (meanConfidence >= CONFIDENCE_REVIEW) {
    return {
      state: "needs-review",
      note: `Confiança média de ${percentLabel(meanConfidence)} por cento, abaixo do limiar de ${CONFIDENCE_PROCESSED}. O texto extraído depende de conferência humana antes de ser usado em cálculo, peça ou decisão.`,
    };
  }
  return {
    state: "failed",
    note: `Confiança média de ${percentLabel(meanConfidence)} por cento. O documento não foi lido de forma utilizável e o original permanece a única fonte.`,
  };
}

/*
 * The single entry point. It receives the bytes the office stored, never a path
 * from a request, and it returns what was read with the confidence it deserves.
 */
export async function extractDocument(input: {
  documentId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<DocumentExtraction> {
  const startedAt = Date.now();
  const report = await engineReport();
  const fingerprint = fingerprintOf(input.bytes);
  const base: Omit<DocumentExtraction, "state" | "note" | "pages"> = {
    documentId: input.documentId,
    fileName: input.fileName,
    fingerprint,
    engine: report.summary,
    language: OCR_LANGUAGE,
    extractedAt: new Date().toISOString(),
    durationMs: 0,
    pageCount: 0,
    ocrPages: 0,
    textLayerPages: 0,
    meanConfidence: 0,
  };

  if (!report.ready) {
    return {
      ...base,
      durationMs: Date.now() - startedAt,
      state: "failed",
      note: `${report.summary} Nenhum documento é enviado ao modelo para transcrição, então a leitura fica pendente até o motor local existir nesta máquina.`,
      pages: [],
    };
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "advprev-extract-"));
  try {
    const isPdf = input.mimeType === "application/pdf";
    const filePath = path.join(
      workDir,
      isPdf
        ? "document.pdf"
        : `document.${input.mimeType.split("/")[1] ?? "png"}`,
    );
    await writeFile(filePath, input.bytes);

    const pages: PageExtraction[] = [];
    if (isPdf) {
      const total = await pageCountOf(filePath);
      for (let page = 1; page <= total; page += 1) {
        const layer = await textLayerOf(filePath, page);
        if (layer.replace(/\s/g, "").length >= TEXT_LAYER_MIN_CHARS) {
          pages.push({
            page,
            source: "text-layer",
            text: layer.trim(),
            confidence: 100,
            words: layer.trim().split(/\s+/).filter(Boolean).length,
            attempt: "camada de texto",
          });
          continue;
        }
        pages.push(await ocrPage(workDir, filePath, page));
      }
    } else {
      pages.push(await ocrImageFile(filePath));
    }

    const ocrPagesList = pages.filter((page) => page.source === "ocr");
    const meanConfidence =
      ocrPagesList.length > 0
        ? ocrPagesList.reduce((sum, page) => sum + page.confidence, 0) /
          ocrPagesList.length
        : 100;
    const { state, note } = stateOf(meanConfidence, pages);

    return {
      ...base,
      durationMs: Date.now() - startedAt,
      pageCount: pages.length,
      ocrPages: ocrPagesList.length,
      textLayerPages: pages.length - ocrPagesList.length,
      meanConfidence,
      state,
      note,
      pages,
    };
  } catch (error) {
    return {
      ...base,
      durationMs: Date.now() - startedAt,
      state: "failed",
      note: `A leitura local falhou: ${error instanceof Error ? error.message.slice(0, 200) : "erro desconhecido"}`,
      pages: [],
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
