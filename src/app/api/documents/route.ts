import type { NextRequest } from "next/server";
import { readDocumentBytes } from "@/lib/records-store";
import { recordDocumentAccess } from "@/lib/trinity/document-access-log";
import { currentSession } from "@/lib/trinity/nhe-actions";

/*
 * Serves one stored document to the operator, for preview or download. It never
 * reads a path from the request: the request carries identifiers only, and the
 * store resolves the path itself and refuses anything that is not a ULID.
 *
 * The response is never cached and never indexed, because the bytes are personal
 * data and, in the medical documents, sensitive personal data.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const clientId = params.get("cliente") ?? "";
  const caseId = params.get("caso") ?? "";
  const documentId = params.get("documento") ?? "";
  const asDownload = params.get("baixar") === "1";

  let found: Awaited<ReturnType<typeof readDocumentBytes>> = null;
  try {
    found = await readDocumentBytes(clientId, caseId, documentId);
  } catch {
    return new Response("Identificador inválido.", { status: 400 });
  }
  if (!found) {
    return new Response("Documento não encontrado.", { status: 404 });
  }

  /* The bytes carry sensitive personal data, so opening or taking them is an
   * event of the office, with author, document, moment and origin. */
  /* The author and the role are the ones of the session, never a constant: a
   * trail that names the wrong role is worse than no trail. */
  const session = await currentSession();
  await recordDocumentAccess({
    actor: session.lawyerName,
    role: session.role,
    action: asDownload ? "download" : "preview",
    documentId: found.document.id,
    fileName: found.document.fileName,
    clientId,
    caseId,
    origin: request.headers.get("referer") ?? "rota de documento",
  });

  const disposition = asDownload ? "attachment" : "inline";
  const safeName = found.document.fileName.replace(/["\r\n]/g, "");
  return new Response(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": found.document.mimeType,
      "Content-Length": String(found.bytes.byteLength),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
