import "server-only";
import type { DocumentStateId } from "@/lib/case-domain";
import {
  type DocumentExtraction,
  extractDocument,
  fingerprintOf,
} from "@/lib/extraction/local-extraction";
import { readDocumentBytes } from "@/lib/records-store";
import { serverSupabase } from "@/lib/supabase/server";

/*
 * What was read from a document lives beside the document, in the database, one
 * row per page, with the confidence that page was measured with and where the
 * text came from. Beside the document and never instead of it: the original
 * bytes stay in the private bucket and the case record shows both, page by
 * page, because a text without its source cannot be checked by a lawyer.
 *
 * A document is read once. The fingerprint of the bytes is stored with the
 * document, so a second pass over the same file returns what the database holds
 * and never pays for the work again. Two byte identical documents in the office
 * share a fingerprint, which the corpus of this office proved on the first run:
 * the physiotherapy report was uploaded twice under different names.
 */

type DocumentRow = {
  file_name: string;
  fingerprint: string | null;
  state: string;
  extracted_at: string | null;
  mean_confidence: number | null;
  page_count: number | null;
  ocr_pages: number | null;
  text_layer_pages: number | null;
  extraction_engine: string | null;
  extraction_language: string | null;
  extraction_duration_ms: number | null;
  extraction_note: string | null;
};

const DOCUMENT_FIELDS =
  "file_name, fingerprint, state, extracted_at, mean_confidence, page_count, ocr_pages, text_layer_pages, extraction_engine, extraction_language, extraction_duration_ms, extraction_note";

export async function readExtraction(
  _clientId: string,
  caseId: string,
  documentId: string,
): Promise<DocumentExtraction | null> {
  const supabase = await serverSupabase();
  const { data: document } = await supabase
    .from("case_documents")
    .select(DOCUMENT_FIELDS)
    .eq("id", documentId)
    .eq("case_id", caseId)
    .maybeSingle<DocumentRow>();

  /* No reading recorded yet is not a failure: the document exists and the text
   * does not, and the interface says exactly that. */
  if (!document?.extracted_at || !document.fingerprint) {
    return null;
  }

  const { data: pages } = await supabase
    .from("document_pages")
    .select("page_number, text, source, confidence, words, attempt")
    .eq("document_id", documentId)
    .order("page_number", { ascending: true });

  return {
    documentId,
    fileName: document.file_name,
    fingerprint: document.fingerprint,
    engine: document.extraction_engine ?? "",
    language: document.extraction_language ?? "",
    extractedAt: document.extracted_at,
    durationMs: document.extraction_duration_ms ?? 0,
    pageCount: document.page_count ?? 0,
    ocrPages: document.ocr_pages ?? 0,
    textLayerPages: document.text_layer_pages ?? 0,
    meanConfidence: Number(document.mean_confidence ?? 0),
    state: document.state as DocumentStateId,
    note: document.extraction_note ?? "",
    pages: (pages ?? []).map((page) => ({
      page: page.page_number,
      source: page.source as DocumentExtraction["pages"][number]["source"],
      text: page.text,
      confidence: Number(page.confidence),
      words: page.words,
      attempt: page.attempt,
    })),
  };
}

/*
 * Reads the document once and keeps the result. Returns what the database holds
 * when the fingerprint matches, which is what makes the reading instantaneous
 * and free for every question that follows.
 */
export async function ensureExtraction(
  clientId: string,
  caseId: string,
  documentId: string,
  options: { force?: boolean } = {},
): Promise<DocumentExtraction | null> {
  const found = await readDocumentBytes(clientId, caseId, documentId);
  if (!found) {
    return null;
  }
  const fingerprint = fingerprintOf(found.bytes);
  const existing = await readExtraction(clientId, caseId, documentId);
  if (!options.force && existing && existing.fingerprint === fingerprint) {
    return existing;
  }

  const extraction = await extractDocument({
    documentId,
    fileName: found.document.fileName,
    mimeType: found.document.mimeType,
    bytes: found.bytes,
  });

  const supabase = await serverSupabase();
  /* The pages of this document are replaced as a whole, never merged, because a
   * second reading of the same bytes is one measurement and not an addition to
   * an older one. */
  await supabase.from("document_pages").delete().eq("document_id", documentId);
  if (extraction.pages.length > 0) {
    await supabase.from("document_pages").insert(
      extraction.pages.map((page) => ({
        document_id: documentId,
        page_number: page.page,
        text: page.text,
        source: page.source,
        confidence: page.confidence,
        words: page.words,
        attempt: page.attempt,
      })),
    );
  }
  await supabase
    .from("case_documents")
    .update({
      state: extraction.state,
      state_note: extraction.note,
      fingerprint: extraction.fingerprint,
      extracted_at: extraction.extractedAt,
      mean_confidence: extraction.meanConfidence,
      page_count: extraction.pageCount,
      ocr_pages: extraction.ocrPages,
      text_layer_pages: extraction.textLayerPages,
      extraction_engine: extraction.engine,
      extraction_language: extraction.language,
      extraction_duration_ms: extraction.durationMs,
      extraction_note: extraction.note,
    })
    .eq("id", documentId)
    .eq("case_id", caseId);

  return extraction;
}

/*
 * The local index. A passage is a page of a document, which is the unit a
 * lawyer can check by opening the original, and the unit the entity must cite.
 */
export type Passage = {
  /* True when the question named this document, by file name. */
  named: boolean;
  clientId: string;
  caseId: string;
  caseRef: string;
  clientName: string;
  documentId: string;
  fileName: string;
  page: number;
  source: "text-layer" | "ocr";
  confidence: number;
  text: string;
  score: number;
};

const STOP_WORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "um",
  "uma",
  "uns",
  "umas",
  "por",
  "para",
  "com",
  "sem",
  "que",
  "qual",
  "quais",
  "e",
  "ou",
  "se",
  "ao",
  "aos",
  "à",
  "às",
  "sobre",
  "meu",
  "minha",
  "seu",
  "sua",
  "este",
  "esta",
  "esse",
  "essa",
  "isso",
  "me",
  "diga",
  "mostre",
  "qualquer",
  "tem",
  "há",
  "ha",
  "foi",
  "ser",
  "está",
  "esta",
  "são",
  "sao",
]);

export function queryTerms(question: string): string[] {
  return [
    ...new Set(
      question
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^0-9a-z]+/)
        .filter((term) => term.length >= 3 && !STOP_WORDS.has(term)),
    ),
  ];
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/*
 * Scores a page against the question by how many of the question's terms it
 * carries and how often, with a light penalty for a page that was read with low
 * confidence, because a passage the machine read badly is worth less than one
 * it read well even when both mention the term.
 */
export function scorePage(
  text: string,
  terms: string[],
  confidence: number,
): number {
  if (terms.length === 0) {
    return 0;
  }
  const haystack = normalise(text);
  let hits = 0;
  let distinct = 0;
  for (const term of terms) {
    const matches = haystack.split(term).length - 1;
    if (matches > 0) {
      distinct += 1;
      hits += Math.min(matches, 8);
    }
  }
  if (distinct === 0) {
    return 0;
  }
  const coverage = distinct / terms.length;
  const density = Math.log2(1 + hits);
  const trust = 0.6 + 0.4 * Math.min(1, confidence / 100);
  return coverage * 2 * density * trust;
}

export function excerptAround(
  text: string,
  terms: string[],
  size: number,
): string {
  const haystack = normalise(text);
  let at = -1;
  for (const term of terms) {
    const index = haystack.indexOf(term);
    if (index >= 0 && (at < 0 || index < at)) {
      at = index;
    }
  }
  if (at < 0) {
    return text.slice(0, size).trim();
  }
  const start = Math.max(0, at - Math.floor(size / 3));
  return `${start > 0 ? "..." : ""}${text.slice(start, start + size).trim()}${start + size < text.length ? "..." : ""}`;
}

/*
 * Whether the question is about what a document says. When it is not, the
 * entity answers from the structured record of the office and no document is
 * touched, which is the rule the director fixed: a question about a deadline,
 * a situation or any field the system already holds is answered from the field.
 */
const DOCUMENT_INTENT =
  /\b(documento|documentos|laudo|laudos|exame|exames|atestado|receita|carteira|ctps|cnis|extrato|procura(c|ç)(a|ã)o|substabelecimento|declara(c|ç)(a|ã)o|carta|peti(c|ç)(a|ã)o|contrato|comprovante|anexo|arquivo|p(a|á)gina|trecho|texto|escrito|consta|diz|menciona|assinatura|carimbo|digitaliza|ocr|leitura|transcri|comprova|prova|cid|diagn(o|ó)stico|per(i|í)cia m(e|é)dica)\b/i;

export function questionTouchesDocuments(question: string): boolean {
  return DOCUMENT_INTENT.test(question);
}

/*
 * The local search. It reads what was already extracted, never the bytes, and
 * returns only the passages the question actually reaches, ordered by how well
 * they answer it. The entity receives these and nothing else of the document,
 * which is what keeps a thirty page process from ever entering a prompt.
 */
export async function findPassages(
  question: string,
  options: {
    cases: {
      clientId: string;
      caseId: string;
      caseRef: string;
      clientName: string;
      documents: { id: string; fileName: string }[];
    }[];
    limit?: number;
    excerptSize?: number;
    minimumScore?: number;
  },
): Promise<Passage[]> {
  const terms = queryTerms(question);
  if (terms.length === 0) {
    return [];
  }
  const limit = options.limit ?? 6;
  const excerptSize = options.excerptSize ?? 900;
  const minimumScore = options.minimumScore ?? 0.6;

  const found: Passage[] = [];
  for (const entry of options.cases) {
    for (const document of entry.documents) {
      const extraction = await readExtraction(
        entry.clientId,
        entry.caseId,
        document.id,
      );
      if (!extraction) {
        continue;
      }
      /* A lawyer names the document he wants, so a term that matches the file
       * name is evidence about the whole file, not about one page. Measured on
       * the office corpus: without this, a question about the orthopaedic
       * report returned pages of the petition that merely repeat the word. */
      const fileName = normalise(document.fileName);
      const nameHits = terms.filter((term) => {
        /* Portuguese inflects: the lawyer types "ortopédico" and the file says
         * "ortopedista". A prefix carries the word; the whole word does not. */
        const stem = term.length >= 6 ? term.slice(0, 6) : term;
        return fileName.includes(stem);
      }).length;
      const nameRatio = nameHits / terms.length;
      /* Naming a document does not get weaker because the lawyer wrote a longer
       * sentence. Measured on 2026-08-12: with a ratio over every term of the
       * question, "o que diz o laudo ortopédico do caso acidentário, e qual a
       * confiança dessa leitura" stopped recognising the report it names, and
       * the entity answered from the petition instead. Two stems of the file
       * name, or one when the question is short, is what naming means. */
      const named = nameHits >= 2 || (nameHits === 1 && terms.length <= 3);
      const nameBoost = nameHits > 0 ? 1 + nameRatio : 1;
      /* A document the lawyer named must surface even when the machine read it
       * badly and its text carries none of the terms, which is exactly the case
       * of the handwritten report: the office needs to see that it exists, that
       * it was read with low confidence, and to open the original. */
      const nameFloor = nameHits > 0 ? 1.2 * nameRatio : 0;

      for (const page of extraction.pages) {
        const score =
          scorePage(page.text, terms, page.confidence) * nameBoost + nameFloor;
        /* The floor of relevance does not apply to a document the lawyer named.
         * Measured on 2026-08-12: the orthopaedic report, whose optical reading
         * carries almost none of the words of the question, was being filtered
         * out before the ranking, and the entity answered from the petition
         * that merely describes it. The office wants the report itself, with
         * its low confidence stated. */
        if (!named && score < minimumScore) {
          continue;
        }
        found.push({
          named,
          clientId: entry.clientId,
          caseId: entry.caseId,
          caseRef: entry.caseRef,
          clientName: entry.clientName,
          documentId: document.id,
          fileName: document.fileName,
          page: page.page,
          source: page.source,
          confidence: page.confidence,
          text: excerptAround(page.text, terms, excerptSize),
          score,
        });
      }
    }
  }
  /* Two tiers on purpose. When the lawyer names a document, that document
   * answers first, even if another file repeats the same words more often; the
   * rest follows by score. Measured on the office corpus: without this, a
   * question about the orthopaedic report answered with pages of the petition
   * that merely mention the injury. */
  return found
    .sort((a, b) => {
      if (a.named !== b.named) {
        return a.named ? -1 : 1;
      }
      return b.score - a.score;
    })
    .slice(0, limit);
}
