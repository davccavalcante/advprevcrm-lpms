import "server-only";
import { ulid } from "ulid";
import { serverSupabase } from "@/lib/supabase/server";
import { PROJECT_VERSION } from "@/lib/trinity/project-identity";

/*
 * Who touched which document, when, and from where.
 *
 * In this field a document carries sensitive personal data of health, so every
 * reading of one is an event that has to be traceable: the entity reading a
 * passage to answer a lawyer, a preview opened on a screen, a download taken to
 * a computer. The rows live in the office database, only the administration
 * reads them, and the application holds no privilege to update or delete one,
 * which is what makes the trail a trail.
 */

export type DocumentAccessAction =
  | "entity-read"
  | "preview"
  | "download"
  | "extraction";

export type DocumentAccessEvent = {
  id: string;
  at: string;
  actor: string;
  role: string;
  action: DocumentAccessAction;
  documentId: string;
  fileName: string;
  clientId: string;
  caseId: string;
  page?: number;
  confidence?: number;
  origin: string;
  projectVersion: string;
};

export async function recordDocumentAccess(
  event: Omit<DocumentAccessEvent, "id" | "at" | "projectVersion">,
): Promise<void> {
  const supabase = await serverSupabase();
  await supabase.from("document_access_events").insert({
    id: ulid(),
    at: new Date().toISOString(),
    actor: event.actor,
    actor_role: event.role,
    action: event.action,
    document_id: event.documentId,
    file_name: event.fileName,
    client_id: event.clientId,
    case_id: event.caseId,
    page: event.page ?? null,
    confidence: event.confidence ?? null,
    origin: event.origin,
    project_version: PROJECT_VERSION,
  });
}
