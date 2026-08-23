import { execFile } from "node:child_process";
import { promisify } from "node:util";

/*
 * The local extraction engine of the office. Three binaries do the work on this
 * machine and nothing leaves it: poppler reads the text layer of a PDF and
 * renders a page that has none, and tesseract reads the rendered page.
 *
 * The rule that governs this whole folder, and it is not negotiable: no image,
 * no page and no scanned document is ever sent to the model to be transcribed.
 * The model reasons over text that was already extracted here. A page of a scan
 * costs thousands of tokens to transcribe and costs nothing to read locally.
 *
 * When a binary is missing the office says so, honestly, and the document stays
 * in the failed state with the reason. It never falls back to the model.
 */

const run = promisify(execFile);

export type EngineTool = {
  binary: string;
  available: boolean;
  version: string | null;
  purpose: string;
};

export type EngineReport = {
  ready: boolean;
  tools: EngineTool[];
  missing: string[];
  summary: string;
};

const TOOLS: { binary: string; args: string[]; purpose: string }[] = [
  {
    binary: "pdftotext",
    args: ["-v"],
    purpose: "Lê a camada de texto de um PDF, sem reconhecimento óptico.",
  },
  {
    binary: "pdftoppm",
    args: ["-v"],
    purpose: "Rasteriza a página que é imagem, para o reconhecimento óptico.",
  },
  {
    binary: "tesseract",
    args: ["--version"],
    purpose: "Reconhecimento óptico local, em português do Brasil.",
  },
];

function firstLine(value: string): string {
  return value.split("\n")[0]?.trim() ?? "";
}

async function probe(binary: string, args: string[]): Promise<string | null> {
  try {
    const { stdout, stderr } = await run(binary, args, { timeout: 15_000 });
    /* poppler prints its version on standard error. */
    return firstLine(stdout.trim().length > 0 ? stdout : stderr) || null;
  } catch {
    return null;
  }
}

let cached: EngineReport | null = null;

export async function engineReport(force = false): Promise<EngineReport> {
  if (cached && !force) {
    return cached;
  }
  const tools: EngineTool[] = [];
  for (const tool of TOOLS) {
    const version = await probe(tool.binary, tool.args);
    tools.push({
      binary: tool.binary,
      available: version !== null,
      version,
      purpose: tool.purpose,
    });
  }
  const missing = tools.filter((tool) => !tool.available).map((t) => t.binary);
  const report: EngineReport = {
    ready: missing.length === 0,
    tools,
    missing,
    summary:
      missing.length === 0
        ? tools.map((tool) => tool.version ?? tool.binary).join(" | ")
        : `Motor local incompleto. Falta instalar: ${missing.join(", ")}.`,
  };
  cached = report;
  return report;
}

/* Language of the recognition. The office works in Brazilian Portuguese and the
 * data pack is chosen by name, never by guessing from the document. */
export const OCR_LANGUAGE = process.env.OCR_LANGUAGE?.trim() || "por";

export async function runTool(
  binary: string,
  args: string[],
  timeoutMs = 120_000,
): Promise<{ stdout: string; stderr: string }> {
  return run(binary, args, {
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
}
