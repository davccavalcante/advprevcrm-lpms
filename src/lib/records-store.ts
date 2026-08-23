import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ulid } from "ulid";
import { parse, stringify } from "yaml";
import {
  type CaseDeadline,
  type CaseEvent,
  type CaseInput,
  type CaseReminder,
  type CaseTask,
  type ClientInput,
  type ClientNotice,
  caseInputSchema,
  clientInputSchema,
  type DocumentStateId,
  type StoredCase,
  type StoredClient,
  type StoredDocument,
  storedCaseSchema,
  storedClientSchema,
} from "@/lib/case-domain";

/*
 * File store of this phase. There is no database, no ORM and no external
 * persistence service: everything a client and a case carry lives under data/,
 * which is outside the repository because it holds personal and, in the medical
 * documents, sensitive personal data.
 *
 * Metadata is YAML on purpose. It is readable by a person and by a language
 * model, which is what the next phase of this system needs.
 */

const DATA_ROOT = path.join(process.cwd(), "data");
const CLIENT_FILE = "client.yaml";
const CASE_FILE = "case.yaml";
const DOCUMENTS_DIR = "documents";

/* A ULID is 26 characters of Crockford base32. Anything else is not an id we
 * wrote, and is refused before it can walk out of data/. */
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("records-store runs on the server only");
  }
}

function assertId(value: string, field: string): string {
  if (!ULID_PATTERN.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readYaml<T>(file: string): Promise<T | null> {
  try {
    const raw = await readFile(file, "utf8");
    return parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeYaml(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, stringify(value, { lineWidth: 0 }), "utf8");
}

function clientDir(clientId: string): string {
  return path.join(DATA_ROOT, assertId(clientId, "client id"));
}

/* The folder of one case. Exported because the extraction of a document lives
 * beside the document, inside this same folder, and only this module knows how
 * a path of the store is built. */
export function caseDirOf(clientId: string, caseId: string): string {
  return caseDir(clientId, caseId);
}

function caseDir(clientId: string, caseId: string): string {
  return path.join(clientDir(clientId), assertId(caseId, "case id"));
}

export async function listClients(): Promise<StoredClient[]> {
  assertServer();
  if (!(await exists(DATA_ROOT))) {
    return [];
  }
  const entries = await readdir(DATA_ROOT, { withFileTypes: true });
  const clients: StoredClient[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !ULID_PATTERN.test(entry.name)) {
      continue;
    }
    const raw = await readYaml<unknown>(
      path.join(DATA_ROOT, entry.name, CLIENT_FILE),
    );
    const parsed = storedClientSchema.safeParse(raw);
    if (parsed.success) {
      clients.push(parsed.data);
    }
  }
  /* ULID sorts chronologically, so the newest registration comes first. */
  return clients.sort((a, b) => b.id.localeCompare(a.id));
}

export async function readClient(
  clientId: string,
): Promise<StoredClient | null> {
  assertServer();
  const raw = await readYaml<unknown>(
    path.join(clientDir(clientId), CLIENT_FILE),
  );
  const parsed = storedClientSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function createClient(input: ClientInput): Promise<StoredClient> {
  assertServer();
  const data = clientInputSchema.parse(input);
  const timestamp = nowIso();
  const record: StoredClient = {
    ...data,
    notices: [],
    id: ulid(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await writeYaml(path.join(clientDir(record.id), CLIENT_FILE), record);
  return record;
}

export async function updateClient(
  clientId: string,
  input: ClientInput,
): Promise<StoredClient> {
  assertServer();
  const current = await readClient(clientId);
  if (!current) {
    throw new Error("Client not found");
  }
  const data = clientInputSchema.parse(input);
  const record: StoredClient = {
    ...current,
    ...data,
    updatedAt: nowIso(),
  };
  await writeYaml(path.join(clientDir(clientId), CLIENT_FILE), record);
  return record;
}

export async function listCasesOfClient(
  clientId: string,
): Promise<StoredCase[]> {
  assertServer();
  const dir = clientDir(clientId);
  if (!(await exists(dir))) {
    return [];
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const cases: StoredCase[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !ULID_PATTERN.test(entry.name)) {
      continue;
    }
    const raw = await readYaml<unknown>(path.join(dir, entry.name, CASE_FILE));
    const parsed = storedCaseSchema.safeParse(raw);
    if (parsed.success) {
      cases.push(parsed.data);
    }
  }
  return cases.sort((a, b) => b.id.localeCompare(a.id));
}

export type CaseWithClient = { record: StoredCase; client: StoredClient };

export async function listAllCases(): Promise<CaseWithClient[]> {
  assertServer();
  const clients = await listClients();
  const all: CaseWithClient[] = [];
  for (const client of clients) {
    for (const record of await listCasesOfClient(client.id)) {
      all.push({ record, client });
    }
  }
  return all.sort((a, b) => b.record.id.localeCompare(a.record.id));
}

export async function readCase(
  clientId: string,
  caseId: string,
): Promise<StoredCase | null> {
  assertServer();
  const raw = await readYaml<unknown>(
    path.join(caseDir(clientId, caseId), CASE_FILE),
  );
  const parsed = storedCaseSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function createCase(
  clientId: string,
  input: CaseInput,
): Promise<StoredCase> {
  assertServer();
  const client = await readClient(clientId);
  if (!client) {
    throw new Error("Client not found");
  }
  const data = caseInputSchema.parse(input);
  const timestamp = nowIso();
  const record: StoredCase = {
    ...data,
    id: ulid(),
    clientId: client.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    documents: [],
    deadlines: [],
    tasks: [],
    events: [],
    reminders: [],
  };
  await writeYaml(path.join(caseDir(clientId, record.id), CASE_FILE), record);
  return record;
}

export async function updateCase(
  clientId: string,
  caseId: string,
  input: CaseInput,
): Promise<StoredCase> {
  assertServer();
  const current = await readCase(clientId, caseId);
  if (!current) {
    throw new Error("Case not found");
  }
  const data = caseInputSchema.parse(input);
  const record: StoredCase = { ...current, ...data, updatedAt: nowIso() };
  await writeYaml(path.join(caseDir(clientId, caseId), CASE_FILE), record);
  return record;
}

/*
 * The stored name never comes from the browser. The original name is kept in the
 * metadata for the operator to read, and the bytes live under an identifier we
 * generated, so a crafted name cannot escape the case folder.
 */
function storedNameFor(id: string, fileName: string): string {
  const extension = path.extname(fileName).toLowerCase().slice(0, 10);
  const safeExtension = /^\.[a-z0-9]{1,9}$/.test(extension) ? extension : "";
  return `${id}${safeExtension}`;
}

export const acceptedDocumentMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export async function saveDocument(
  clientId: string,
  caseId: string,
  file: { name: string; type: string; bytes: Uint8Array },
  uploadedBy: string,
): Promise<StoredDocument> {
  assertServer();
  const record = await readCase(clientId, caseId);
  if (!record) {
    throw new Error("Case not found");
  }
  const id = ulid();
  const storedName = storedNameFor(id, file.name);
  const target = path.join(
    caseDir(clientId, caseId),
    DOCUMENTS_DIR,
    storedName,
  );
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, file.bytes);

  const document: StoredDocument = {
    id,
    fileName: file.name,
    storedName,
    mimeType: file.type,
    byteSize: file.bytes.byteLength,
    fingerprint: createHash("sha256").update(file.bytes).digest("hex"),
    /* Uploaded, never processed: optical recognition does not exist yet and the
     * interface must not claim a state the system cannot reach. */
    state: "uploaded",
    uploadedAt: nowIso(),
    uploadedBy,
  };
  const next: StoredCase = {
    ...record,
    documents: [...record.documents, document],
    updatedAt: nowIso(),
  };
  await writeYaml(path.join(caseDir(clientId, caseId), CASE_FILE), next);
  return document;
}

export async function setDocumentState(
  clientId: string,
  caseId: string,
  documentId: string,
  state: DocumentStateId,
  stateNote?: string,
  /* What the local reading measured, when it ran. The interface shows these
   * beside the state so a lawyer sees the confidence, not only the label. */
  measured?: {
    extractedAt?: string;
    meanConfidence?: number;
    pageCount?: number;
    ocrPages?: number;
  },
): Promise<StoredCase> {
  assertServer();
  const record = await readCase(clientId, caseId);
  if (!record) {
    throw new Error("Case not found");
  }
  const next: StoredCase = {
    ...record,
    documents: record.documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            state,
            ...(stateNote === undefined ? {} : { stateNote }),
            ...(measured ?? {}),
          }
        : document,
    ),
    updatedAt: nowIso(),
  };
  await writeYaml(path.join(caseDir(clientId, caseId), CASE_FILE), next);
  return next;
}

export async function readDocumentBytes(
  clientId: string,
  caseId: string,
  documentId: string,
): Promise<{ document: StoredDocument; bytes: Buffer } | null> {
  assertServer();
  const record = await readCase(clientId, caseId);
  const document = record?.documents.find((entry) => entry.id === documentId);
  if (!record || !document) {
    return null;
  }
  const target = path.join(
    caseDir(clientId, caseId),
    DOCUMENTS_DIR,
    document.storedName,
  );
  /* Belt and braces: the resolved path must still sit inside the case folder. */
  if (!target.startsWith(path.join(caseDir(clientId, caseId), DOCUMENTS_DIR))) {
    return null;
  }
  try {
    return { document, bytes: await readFile(target) };
  } catch {
    return null;
  }
}

/* Fingerprint used to tell two uploads of the same bytes apart in a report. */
export function fingerprintOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

/*
 * What a captured act writes inside the case and inside the client record.
 *
 * Every one of these is an append, never a rewrite: a deadline, an event, a
 * task, a reminder and a notice are added, and what changes afterwards is only
 * the state a human sets. The confirmation of a deadline is the one transition
 * that matters most in this system, and it exists here in one place, requiring a
 * name and a moment, so no code path can ever produce it by automation.
 */
export async function appendCaseRecords(
  clientId: string,
  caseId: string,
  records: {
    deadline?: CaseDeadline | null;
    event?: CaseEvent | null;
    task?: CaseTask | null;
    reminder?: CaseReminder | null;
  },
): Promise<StoredCase | null> {
  assertServer();
  const current = await readCase(clientId, caseId);
  if (!current) {
    return null;
  }
  const record: StoredCase = {
    ...current,
    deadlines: records.deadline
      ? [...current.deadlines, records.deadline]
      : current.deadlines,
    events: records.event ? [...current.events, records.event] : current.events,
    tasks: records.task ? [...current.tasks, records.task] : current.tasks,
    reminders: records.reminder
      ? [...current.reminders, records.reminder]
      : current.reminders,
    updatedAt: nowIso(),
  };
  await writeYaml(path.join(caseDir(clientId, caseId), CASE_FILE), record);
  return record;
}

export async function appendClientNotice(
  clientId: string,
  notice: ClientNotice,
): Promise<StoredClient | null> {
  assertServer();
  const current = await readClient(clientId);
  if (!current) {
    return null;
  }
  const record: StoredClient = {
    ...current,
    notices: [...current.notices, notice],
    updatedAt: nowIso(),
  };
  await writeYaml(path.join(clientDir(clientId), CLIENT_FILE), record);
  return record;
}

/* The number of the process on the case, written when a human confirms the link
 * of a communication, so every later act of that process finds its case alone. */
export async function setLawsuitNumber(
  clientId: string,
  caseId: string,
  lawsuitNumber: string,
): Promise<StoredCase | null> {
  assertServer();
  const current = await readCase(clientId, caseId);
  if (!current) {
    return null;
  }
  const record: StoredCase = { ...current, lawsuitNumber, updatedAt: nowIso() };
  await writeYaml(path.join(caseDir(clientId, caseId), CASE_FILE), record);
  return record;
}

/*
 * The transition a lawyer makes with his own hand. It carries who did it and
 * when, and there is no other way in this application to reach the state
 * `confirmed`.
 */
export async function confirmDeadline(
  clientId: string,
  caseId: string,
  deadlineId: string,
  confirmedBy: string,
): Promise<StoredCase | null> {
  assertServer();
  const current = await readCase(clientId, caseId);
  if (!current) {
    return null;
  }
  const at = nowIso();
  const record: StoredCase = {
    ...current,
    deadlines: current.deadlines.map((deadline) =>
      deadline.id === deadlineId
        ? {
            ...deadline,
            state: "confirmed" as const,
            confirmedBy,
            confirmedAt: at,
          }
        : deadline,
    ),
    updatedAt: at,
  };
  await writeYaml(path.join(caseDir(clientId, caseId), CASE_FILE), record);
  return record;
}

export async function setTaskState(
  clientId: string,
  caseId: string,
  taskId: string,
  state: CaseTask["state"],
  decidedBy: string,
): Promise<StoredCase | null> {
  assertServer();
  const current = await readCase(clientId, caseId);
  if (!current) {
    return null;
  }
  const at = nowIso();
  const record: StoredCase = {
    ...current,
    tasks: current.tasks.map((task) =>
      task.id === taskId ? { ...task, state, decidedBy, decidedAt: at } : task,
    ),
    updatedAt: at,
  };
  await writeYaml(path.join(caseDir(clientId, caseId), CASE_FILE), record);
  return record;
}

export async function setReminderDone(
  clientId: string,
  caseId: string,
  reminderId: string,
  doneBy: string,
): Promise<StoredCase | null> {
  assertServer();
  const current = await readCase(clientId, caseId);
  if (!current) {
    return null;
  }
  const at = nowIso();
  const record: StoredCase = {
    ...current,
    reminders: current.reminders.map((reminder) =>
      reminder.id === reminderId
        ? { ...reminder, state: "done" as const, doneBy, doneAt: at }
        : reminder,
    ),
    updatedAt: at,
  };
  await writeYaml(path.join(caseDir(clientId, caseId), CASE_FILE), record);
  return record;
}
