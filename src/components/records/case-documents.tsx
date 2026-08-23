"use client";

import {
  ArrowClockwise,
  DownloadSimple,
  Eye,
  FilePdf,
  Image as ImageIcon,
  TextAlignLeft,
  UploadSimple,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  FormNotice,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "@/components/ui/form-field";
import {
  type DocumentStateId,
  documentStates,
  type StoredDocument,
} from "@/lib/case-domain";
import {
  type ExtractedText,
  readExtractedText,
  setDocumentStateAction,
  type UploadOutcome,
  uploadDocumentsAction,
} from "@/lib/record-actions";

/*
 * Document management of one case. The local engine reads every upload, so a
 * document reaches "Processado", "Requer revisão humana" or "Falha no
 * processamento" by measurement and never by guess, and the operator may still
 * set a state by hand, which is the human validation the reading depends on.
 *
 * The original and what was read from it are shown side by side, because a
 * reading below the threshold is only useful to a lawyer who can check it
 * against the page it came from.
 */

const stateClasses: Record<DocumentStateId, string> = {
  uploading: "bg-neutral-soft text-ink",
  uploaded: "bg-critical-soft text-ink",
  processing: "bg-neutral-soft text-ink",
  processed: "bg-critical-soft text-ink",
  "needs-review": "bg-attention-soft text-ink",
  failed: "bg-attention-soft text-ink",
};

/* A decimal in this interface is written the way Brazil writes it, with a
 * comma. The engine reports a number; the screen speaks Portuguese. */
function decimalLabel(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/* A note written to a record before this screen learned to write decimals in
 * Portuguese keeps the text it was written with, because a record of the office
 * is not rewritten to look newer. Only the separator is corrected on the way to
 * the screen, and only where the pipeline writes a percentage, never on a legal
 * reference like Law 8.213. */
function noteLabel(note: string): string {
  return note.replace(/(\d)\.(\d)(?= por cento)/g, "$1,$2");
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} kB`;
  }
  return `${decimalLabel(bytes / (1024 * 1024))} MB`;
}

function dateTimeLabel(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`;
}

function documentHref(
  clientId: string,
  caseId: string,
  documentId: string,
  download: boolean,
): string {
  const params = new URLSearchParams({
    cliente: clientId,
    caso: caseId,
    documento: documentId,
  });
  if (download) {
    params.set("baixar", "1");
  }
  return `/api/documentos?${params.toString()}`;
}

/*
 * What the local engine read, page by page, beside the page it came from. Each
 * page carries how it was read and with how much confidence, and a page below
 * the threshold is marked as pending human validation, because a lawyer has to
 * know which line he may trust and which line he has to check.
 */
function ExtractedTextPanel({
  loading,
  result,
}: {
  loading: boolean;
  result: ExtractedText | undefined;
}) {
  if (loading || result === undefined) {
    return (
      <p
        aria-live="polite"
        className="rounded-md border border-line bg-inset p-4 text-sm text-ink-soft"
      >
        Abrindo o texto já extraído deste documento.
      </p>
    );
  }

  if (!result.ok) {
    return (
      <p className="rounded-md border border-line bg-inset p-4 text-sm text-ink">
        {result.reason}
      </p>
    );
  }

  return (
    <div className="flex max-h-(--overlay-max-height) flex-col gap-3 overflow-y-auto rounded-md border border-line bg-inset p-4">
      {result.pages.map((page) => (
        <div className="flex flex-col gap-1" key={page.page}>
          <p className="text-xs font-bold text-ink">
            Página {page.page},{" "}
            {page.source === "text-layer"
              ? "camada de texto do arquivo, transcrição exata"
              : `reconhecimento óptico local, confiança de ${decimalLabel(page.confidence)} por cento`}
            {page.uncertain
              ? ", abaixo do limiar, pendente de validação humana"
              : ""}
          </p>
          <p className="text-xs leading-relaxed whitespace-pre-wrap text-ink">
            {page.text.trim().length > 0
              ? page.text
              : "Nenhum texto foi lido nesta página."}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CaseDocuments({
  clientId,
  caseId,
  documents,
}: {
  clientId: string;
  caseId: string;
  documents: StoredDocument[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [outcomes, setOutcomes] = useState<UploadOutcome[]>([]);
  const [preview, setPreview] = useState<StoredDocument | null>(null);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  /* The extracted text is fetched only when the lawyer opens the document, and
   * kept by document, so closing and reopening does not read the disk again. */
  const [texts, setTexts] = useState<Record<string, ExtractedText>>({});
  const [loadingText, setLoadingText] = useState<string | null>(null);

  function openPreview(document: StoredDocument) {
    setPreview(document);
    if (texts[document.id] || loadingText === document.id) {
      return;
    }
    setLoadingText(document.id);
    startTransition(async () => {
      const result = await readExtractedText(clientId, caseId, document.id);
      setTexts((current) => ({ ...current, [document.id]: result }));
      setLoadingText(null);
    });
  }

  function onFilesChosen(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const form = new FormData();
    const names: string[] = [];
    for (const file of Array.from(fileList)) {
      form.append("files", file);
      names.push(file.name);
    }
    setUploadingNames(names);
    setOutcomes([]);
    startTransition(async () => {
      const result = await uploadDocumentsAction(clientId, caseId, form);
      setOutcomes(result);
      setUploadingNames([]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      router.refresh();
    });
  }

  function onStateChange(document: StoredDocument, state: string) {
    startTransition(async () => {
      await setDocumentStateAction(clientId, caseId, document.id, state);
      router.refresh();
    });
  }

  const failures = outcomes.filter((outcome) => !outcome.ok);
  const successes = outcomes.filter((outcome) => outcome.ok);

  return (
    <section
      aria-labelledby="case-documents-heading"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <FilePdf size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <h2
            id="case-documents-heading"
            className="text-lg font-bold text-ink"
          >
            Documentos,{" "}
            {documents.length === 1
              ? "1 arquivo"
              : `${documents.length} arquivos`}
          </h2>
          <p className="text-sm text-ink-soft">
            PDF, PNG, JPG e WEBP. Os arquivos ficam na pasta do caso, separados
            dos demais casos do mesmo cliente.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className={primaryButtonClasses}>
          <UploadSimple size={18} weight="bold" aria-hidden />
          {pending ? "Enviando" : "Enviar documentos"}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp"
            disabled={pending}
            onChange={(event) => onFilesChosen(event.target.files)}
            className="sr-only"
          />
        </label>
        <p aria-live="polite" className="text-xs text-ink-soft">
          {pending
            ? `Enviando ${uploadingNames.length === 1 ? "1 arquivo" : `${uploadingNames.length} arquivos`}.`
            : "Aceita vários arquivos de uma vez."}
        </p>
      </div>

      {uploadingNames.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {uploadingNames.map((name) => (
            <li
              key={name}
              className="flex items-center gap-3 rounded-md bg-inset px-4 py-3 text-sm text-ink"
            >
              <ArrowClockwise size={16} weight="bold" aria-hidden />
              <span className="min-w-0 flex-1 break-words">{name}</span>
              <span className="shrink-0 rounded-full bg-neutral-soft px-3 py-1 text-xs font-bold whitespace-nowrap">
                Enviando
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {failures.length > 0 ? (
        <FormNotice tone="attention">
          {failures.length === 1
            ? "Um arquivo não foi aceito: "
            : `${failures.length} arquivos não foram aceitos: `}
          {failures
            .map((outcome) => `${outcome.fileName} (${outcome.reason})`)
            .join("; ")}
        </FormNotice>
      ) : null}

      {successes.length > 0 ? (
        <p
          role="status"
          className="rounded-md bg-inset px-4 py-3 text-sm text-ink"
        >
          {successes.length === 1
            ? "1 arquivo enviado e gravado."
            : `${successes.length} arquivos enviados e gravados.`}{" "}
          A leitura local começou em segundo plano, sem enviar o arquivo a
          qualquer serviço externo. Atualize a página em instantes para ver o
          estado e a confiança medida de cada documento.
        </p>
      ) : null}

      {documents.length === 0 ? (
        <p className="rounded-md bg-inset p-4 text-sm text-ink">
          Nenhum documento anexado a este caso.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {documents.map((document) => {
            const isPdf = document.mimeType === "application/pdf";
            return (
              <li
                key={document.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-ink">
                    {isPdf ? (
                      <FilePdf size={18} weight="bold" aria-hidden />
                    ) : (
                      <ImageIcon size={18} weight="bold" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="text-sm font-bold break-words text-ink">
                      {document.fileName}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {sizeLabel(document.byteSize)}, enviado em{" "}
                      {dateTimeLabel(document.uploadedAt)} por{" "}
                      {document.uploadedBy}
                    </p>
                    {document.extractedAt !== undefined &&
                    document.meanConfidence !== undefined ? (
                      <p className="text-xs text-ink-soft">
                        Leitura local em {dateTimeLabel(document.extractedAt)}:{" "}
                        {document.pageCount === 1
                          ? "1 página"
                          : `${document.pageCount} páginas`}
                        {document.ocrPages !== undefined
                          ? document.ocrPages === 0
                            ? ", nenhuma por reconhecimento óptico"
                            : `, ${document.ocrPages === 1 ? "1 por reconhecimento óptico" : `${document.ocrPages} por reconhecimento óptico`}`
                          : ""}
                        , confiança média de{" "}
                        {decimalLabel(document.meanConfidence)} por cento.
                      </p>
                    ) : null}
                    {document.stateNote ? (
                      <p className="text-xs text-ink-soft">
                        {noteLabel(document.stateNote)}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${stateClasses[document.state]}`}
                  >
                    {documentStates.find((state) => state.id === document.state)
                      ?.label ?? document.state}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (preview?.id === document.id) {
                        setPreview(null);
                        return;
                      }
                      openPreview(document);
                    }}
                    aria-expanded={preview?.id === document.id}
                    className={secondaryButtonClasses}
                  >
                    <Eye size={16} weight="bold" aria-hidden />
                    {preview?.id === document.id
                      ? "Fechar original e texto"
                      : "Ver original e texto extraído"}
                  </button>
                  <a
                    href={documentHref(clientId, caseId, document.id, true)}
                    className={secondaryButtonClasses}
                  >
                    <DownloadSimple size={16} weight="bold" aria-hidden />
                    Baixar
                  </a>
                  <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                    Estado
                    <select
                      value={document.state}
                      disabled={pending}
                      onChange={(event) =>
                        onStateChange(document, event.target.value)
                      }
                      className="cursor-pointer rounded-md border border-line bg-inset px-3 py-2 text-xs font-normal text-ink"
                    >
                      {documentStates.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {preview?.id === document.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <h3 className="text-xs font-bold text-ink">
                          Documento original
                        </h3>
                        {isPdf ? (
                          <object
                            aria-label={`Pré-visualização de ${document.fileName}`}
                            className="h-(--overlay-max-height) max-h-(--overlay-max-height) w-full rounded-md border border-line bg-inset"
                            data={documentHref(
                              clientId,
                              caseId,
                              document.id,
                              false,
                            )}
                            type="application/pdf"
                          >
                            <p className="p-4 text-sm text-ink">
                              Este navegador não exibiu o PDF aqui. Use "Baixar"
                              para abrir o arquivo original.
                            </p>
                          </object>
                        ) : (
                          // biome-ignore lint/performance/noImgElement: the bytes are served by a private route, never optimized by the image pipeline
                          <img
                            alt={`Pré-visualização de ${document.fileName}`}
                            className="max-h-(--overlay-max-height) w-full rounded-md border border-line bg-inset object-contain"
                            src={documentHref(
                              clientId,
                              caseId,
                              document.id,
                              false,
                            )}
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <h3 className="flex items-center gap-1.5 text-xs font-bold text-ink">
                          <TextAlignLeft aria-hidden size={14} weight="bold" />
                          Texto lido pelo motor local
                        </h3>
                        <ExtractedTextPanel
                          loading={loadingText === document.id}
                          result={texts[document.id]}
                        />
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-ink-soft">
                      O documento original fica sempre ao lado do texto
                      extraído, para conferência. A leitura é feita por motor
                      local nesta máquina, o arquivo nunca é enviado a serviço
                      externo para ser transcrito, e página lida abaixo do
                      limiar de confiança fica pendente de validação humana e
                      não vale como dado certo em cálculo, peça ou decisão.
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
