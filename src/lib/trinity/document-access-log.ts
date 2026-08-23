import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ulid } from "ulid";
import { stringify } from "yaml";
import { PROJECT_VERSION } from "@/lib/trinity/project-identity";
import { TRINITY_ROOT } from "@/lib/trinity/store-paths";

/*
 * Who touched which document, when, and from where.
 *
 * In this field a document carries sensitive personal data of health, so every
 * reading of one is an event that has to be traceable: the entity reading a
 * passage to answer a lawyer, a preview opened on a screen, a download taken to
 * a computer. The file is append only, one YAML document per event, and the
 * application never edits or deletes a line of it.
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

const ACCESS_DIR = path.join(TRINITY_ROOT, "access");
const ACCESS_FILE = path.join(ACCESS_DIR, "document-access.yaml");

export async function recordDocumentAccess(
  event: Omit<DocumentAccessEvent, "id" | "at" | "projectVersion">,
): Promise<void> {
  const full: DocumentAccessEvent = {
    id: ulid(),
    at: new Date().toISOString(),
    projectVersion: PROJECT_VERSION,
    ...event,
  };
  await mkdir(ACCESS_DIR, { recursive: true });
  await appendFile(
    ACCESS_FILE,
    `---\n${stringify(full, { lineWidth: 0 })}`,
    "utf8",
  );
}
