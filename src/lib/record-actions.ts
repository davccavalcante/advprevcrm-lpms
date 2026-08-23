"use server";

import { revalidatePath } from "next/cache";
import {
  caseInputSchema,
  clientInputSchema,
  type DocumentStateId,
  documentStateIds,
} from "@/lib/case-domain";
import {
  ensureExtraction,
  readExtraction,
} from "@/lib/extraction/extraction-store";
import { CONFIDENCE_PROCESSED } from "@/lib/extraction/local-extraction";
import {
  acceptedDocumentMimeTypes,
  createCase,
  createClient,
  readDocumentBytes,
  saveDocument,
  setDocumentState,
  updateCase,
  updateClient,
} from "@/lib/records-store";
import { recordDocumentAccess } from "@/lib/trinity/document-access-log";

/*
 * Every write of this phase passes through here, and every one of them validates
 * with Zod before touching the disk. The result carries the message per field so
 * the form can show the error beside the input that caused it.
 */
export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; formError?: string; fieldErrors: Record<string, string> };

const OPERATOR = "Mendelsson Sandrini Alves Maciel";

function fieldErrorsOf(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

function textOf(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

function clientPayload(form: FormData) {
  return {
    fullName: textOf(form, "fullName"),
    cpf: textOf(form, "cpf"),
    rg: textOf(form, "rg"),
    birthDate: textOf(form, "birthDate"),
    motherName: textOf(form, "motherName"),
    phone: textOf(form, "phone"),
    email: textOf(form, "email"),
    address: textOf(form, "address"),
    cityState: textOf(form, "cityState"),
    notes: textOf(form, "notes"),
  };
}

function casePayload(form: FormData) {
  return {
    sphere: textOf(form, "sphere"),
    caseType: textOf(form, "caseType"),
    opposingParty: textOf(form, "opposingParty"),
    status: textOf(form, "status"),
    responsibleLawyer: textOf(form, "responsibleLawyer"),
    reference: textOf(form, "reference"),
    factSummary: textOf(form, "factSummary"),
  };
}

export async function saveClientAction(
  clientId: string | null,
  form: FormData,
): Promise<ActionResult> {
  const parsed = clientInputSchema.safeParse(clientPayload(form));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    const record = clientId
      ? await updateClient(clientId, parsed.data)
      : await createClient(parsed.data);
    revalidatePath("/clients");
    revalidatePath("/clientes");
    revalidatePath(`/clients/${record.id}`);
    revalidatePath(`/clientes/${record.id}`);
    return { ok: true, id: record.id };
  } catch (error) {
    return {
      ok: false,
      formError:
        error instanceof Error ? error.message : "Falha ao gravar o cliente.",
      fieldErrors: {},
    };
  }
}

export async function saveCaseAction(
  clientId: string,
  caseId: string | null,
  form: FormData,
): Promise<ActionResult> {
  const parsed = caseInputSchema.safeParse(casePayload(form));
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  }
  try {
    const record = caseId
      ? await updateCase(clientId, caseId, parsed.data)
      : await createCase(clientId, parsed.data);
    revalidatePath("/cases");
    revalidatePath("/casos");
    revalidatePath(`/clients/${clientId}`);
    revalidatePath(`/clientes/${clientId}`);
    revalidatePath(`/cases/${clientId}/${record.id}`);
    revalidatePath(`/casos/${clientId}/${record.id}`);
    return { ok: true, id: record.id };
  } catch (error) {
    return {
      ok: false,
      formError:
        error instanceof Error ? error.message : "Falha ao gravar o caso.",
      fieldErrors: {},
    };
  }
}

export type UploadOutcome = {
  fileName: string;
  ok: boolean;
  reason?: string;
  documentId?: string;
};

export async function uploadDocumentsAction(
  clientId: string,
  caseId: string,
  form: FormData,
): Promise<UploadOutcome[]> {
  const files = form.getAll("files").filter((entry): entry is File => {
    return (
      typeof entry === "object" && entry !== null && "arrayBuffer" in entry
    );
  });

  if (files.length === 0) {
    return [{ fileName: "", ok: false, reason: "Nenhum arquivo selecionado." }];
  }

  const outcomes: UploadOutcome[] = [];
  for (const file of files) {
    const accepted = (acceptedDocumentMimeTypes as readonly string[]).includes(
      file.type,
    );
    if (!accepted) {
      outcomes.push({
        fileName: file.name,
        ok: false,
        reason: `Formato não aceito (${file.type || "desconhecido"}). Envie PDF, PNG, JPG ou WEBP.`,
      });
      continue;
    }
    if (file.size === 0) {
      outcomes.push({
        fileName: file.name,
        ok: false,
        reason: "Arquivo vazio, nada foi gravado.",
      });
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = await saveDocument(
        clientId,
        caseId,
        { name: file.name, type: file.type, bytes },
        OPERATOR,
      );
      outcomes.push({ fileName: file.name, ok: true, documentId: document.id });
      /* The reading starts now and does not hold the upload. The lawyer sees
       * the document in "em processamento" and the state moves on its own when
       * the local engine finishes. Nothing here reaches the model. */
      void startExtraction(clientId, caseId, document.id);
    } catch (error) {
      outcomes.push({
        fileName: file.name,
        ok: false,
        reason:
          error instanceof Error ? error.message : "Falha ao gravar o arquivo.",
      });
    }
  }
  revalidatePath(`/cases/${clientId}/${caseId}`);
  revalidatePath(`/casos/${clientId}/${caseId}`);
  return outcomes;
}

/*
 * Reads one document with the local engine and records the outcome on the
 * document itself, so the interface shows the real state and the confidence
 * that was measured. Runs once per document: a second call over unchanged bytes
 * returns what is already on disk.
 */
export async function startExtraction(
  clientId: string,
  caseId: string,
  documentId: string,
): Promise<void> {
  try {
    await setDocumentState(
      clientId,
      caseId,
      documentId,
      "processing",
      "Leitura local em andamento, sem envio do arquivo a qualquer serviço externo.",
    );
    const extraction = await ensureExtraction(clientId, caseId, documentId);
    if (!extraction) {
      await setDocumentState(
        clientId,
        caseId,
        documentId,
        "failed",
        "O arquivo não foi encontrado no cadastro do caso.",
      );
      return;
    }
    await setDocumentState(
      clientId,
      caseId,
      documentId,
      extraction.state,
      extraction.note,
      {
        extractedAt: extraction.extractedAt,
        meanConfidence: extraction.meanConfidence,
        pageCount: extraction.pageCount,
        ocrPages: extraction.ocrPages,
      },
    );
  } catch (error) {
    await setDocumentState(
      clientId,
      caseId,
      documentId,
      "failed",
      `A leitura local falhou: ${error instanceof Error ? error.message.slice(0, 160) : "erro desconhecido"}`,
    );
  }
}

export type ExtractedPage = {
  page: number;
  source: "text-layer" | "ocr";
  confidence: number;
  /* True when the machine read this page below the threshold. The lawyer sees
   * the page marked and checks it against the original, which is why the two
   * are shown side by side and never one without the other. */
  uncertain: boolean;
  text: string;
};

export type ExtractedText = {
  ok: boolean;
  reason?: string;
  engine?: string;
  extractedAt?: string;
  meanConfidence?: number;
  pageCount?: number;
  ocrPages?: number;
  pages: ExtractedPage[];
};

/*
 * The text the local engine read from one document, for the lawyer to check
 * beside the original. It reads what is already on disk and never runs the
 * engine, so opening it costs nothing and changes nothing.
 *
 * Reading the extracted text is reading the content of a document that carries
 * sensitive personal data, so it writes an access event exactly like opening the
 * original does.
 */
export async function readExtractedText(
  clientId: string,
  caseId: string,
  documentId: string,
): Promise<ExtractedText> {
  let found: Awaited<ReturnType<typeof readDocumentBytes>> = null;
  try {
    found = await readDocumentBytes(clientId, caseId, documentId);
  } catch {
    return { ok: false, reason: "Identificador inválido.", pages: [] };
  }
  if (!found) {
    return { ok: false, reason: "Documento não encontrado.", pages: [] };
  }

  const extraction = await readExtraction(clientId, caseId, documentId);
  if (!extraction) {
    return {
      ok: false,
      reason:
        "Este documento ainda não foi lido pelo motor local. Nenhum texto foi extraído dele até agora.",
      pages: [],
    };
  }

  await recordDocumentAccess({
    actor: OPERATOR,
    role: "admin",
    action: "preview",
    documentId,
    fileName: found.document.fileName,
    clientId,
    caseId,
    confidence: extraction.meanConfidence,
    origin: "leitura do texto extraído na ficha do caso",
  });

  return {
    ok: true,
    engine: extraction.engine,
    extractedAt: extraction.extractedAt,
    meanConfidence: extraction.meanConfidence,
    pageCount: extraction.pageCount,
    ocrPages: extraction.ocrPages,
    pages: extraction.pages.map((page) => ({
      page: page.page,
      source: page.source,
      confidence: page.confidence,
      uncertain: page.confidence < CONFIDENCE_PROCESSED,
      text: page.text,
    })),
  };
}

export async function setDocumentStateAction(
  clientId: string,
  caseId: string,
  documentId: string,
  state: string,
  stateNote?: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!(documentStateIds as readonly string[]).includes(state)) {
    return { ok: false, reason: "Estado desconhecido." };
  }
  try {
    await setDocumentState(
      clientId,
      caseId,
      documentId,
      state as DocumentStateId,
      stateNote,
    );
    revalidatePath(`/cases/${clientId}/${caseId}`);
    revalidatePath(`/casos/${clientId}/${caseId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error ? error.message : "Falha ao alterar o estado.",
    };
  }
}
