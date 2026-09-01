import "server-only";
import { createHash } from "node:crypto";
import path from "node:path";
import { ulid } from "ulid";
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
import { serverSupabase } from "@/lib/supabase/server";

/*
 * The store of the office, in Postgres at Supabase.
 *
 * Every statement below travels as the member of the office who is asking,
 * because the client is built from the session cookie, so the row level
 * security policies decide what comes back and the interface only reflects a
 * rule it does not own. A lawyer who asks for a case that is not his receives
 * nothing, and it is the database that refuses him, not a condition in a
 * component.
 *
 * The bytes of a document live in the private storage bucket and never in a
 * column, and the name under which they live is an identifier this system
 * generated, never the name the browser sent.
 *
 * The public interface of this module did not change when the store moved from
 * file to database: the screens, the server actions and the capture call the
 * same functions with the same arguments they always did.
 */

const DOCUMENTS_BUCKET = "case-documents";

/* A ULID is 26 characters of Crockford base32. Anything else is not an id we
 * wrote, and is refused before it reaches a query. */
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function assertId(value: string, field: string): string {
  if (!ULID_PATTERN.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function nowIso(): string {
  return new Date().toISOString();
}

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optional(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function originOf(value: unknown): CaseDeadline["origin"] {
  const raw = (value ?? {}) as Row;
  return {
    communicationId: text(raw.communicationId ?? raw.communication_id),
    certificateCode: nullableText(raw.certificateCode ?? raw.certificate_code),
    certificateUrl: nullableText(raw.certificateUrl ?? raw.certificate_url),
    availableOn: text(raw.availableOn ?? raw.available_on),
    excerpt: text(raw.excerpt),
  };
}

/* ------------------------------------------------------------------------- */
/* Row readers. One per table, so the shape of the database is translated in a
 * single place and never leaks into a screen.                                */
/* ------------------------------------------------------------------------- */

function documentOf(row: Row): StoredDocument {
  const document: StoredDocument = {
    id: text(row.id),
    fileName: text(row.file_name),
    storedName: text(row.stored_name),
    mimeType: text(row.mime_type),
    byteSize: Number(row.byte_size ?? 0),
    state: text(row.state) as DocumentStateId,
    uploadedAt: text(row.uploaded_at),
    uploadedBy: text(row.uploaded_by),
  };
  const stateNote = optional(row.state_note);
  if (stateNote !== undefined) document.stateNote = stateNote;
  const fingerprint = optional(row.fingerprint);
  if (fingerprint !== undefined) document.fingerprint = fingerprint;
  const extractedAt = optional(row.extracted_at);
  if (extractedAt !== undefined) document.extractedAt = extractedAt;
  if (row.mean_confidence !== null && row.mean_confidence !== undefined) {
    document.meanConfidence = Number(row.mean_confidence);
  }
  if (row.page_count !== null && row.page_count !== undefined) {
    document.pageCount = Number(row.page_count);
  }
  if (row.ocr_pages !== null && row.ocr_pages !== undefined) {
    document.ocrPages = Number(row.ocr_pages);
  }
  return document;
}

function deadlineOf(row: Row): CaseDeadline {
  return {
    id: text(row.id),
    label: text(row.label),
    regime: text(row.regime) as CaseDeadline["regime"],
    availableOn: text(row.available_on),
    publishedOn: text(row.published_on),
    startsOn: text(row.starts_on),
    dueOn: text(row.due_on),
    days: Number(row.days ?? 0),
    countedInBusinessDays: Boolean(row.counted_in_business_days),
    court: nullableText(row.court),
    calendarReviewed: Boolean(row.calendar_reviewed),
    warnings: (row.warnings as string[] | null) ?? [],
    skipped: (row.skipped as CaseDeadline["skipped"] | null) ?? [],
    legalSources: (row.legal_sources as string[] | null) ?? [],
    state: text(row.state) as CaseDeadline["state"],
    confirmedBy: nullableText(row.confirmed_by),
    confirmedAt: nullableText(row.confirmed_at),
    createdAt: text(row.created_at),
    origin: originOf(row.origin),
  };
}

function taskOf(row: Row): CaseTask {
  return {
    id: text(row.id),
    title: text(row.title),
    detail: nullableText(row.detail),
    state: text(row.state) as CaseTask["state"],
    responsible: text(row.responsible),
    internalDueOn: nullableText(row.internal_due_on),
    deadlineId: nullableText(row.deadline_id),
    createdAt: text(row.created_at),
    decidedBy: nullableText(row.decided_by),
    decidedAt: nullableText(row.decided_at),
    origin: originOf(row.origin),
  };
}

function eventOf(row: Row): CaseEvent {
  return {
    id: text(row.id),
    kind: text(row.kind),
    title: text(row.title),
    date: text(row.date),
    time: nullableText(row.time),
    place: nullableText(row.place),
    createdAt: text(row.created_at),
    origin: originOf(row.origin),
  };
}

function reminderOf(row: Row): CaseReminder {
  return {
    id: text(row.id),
    forLawyer: text(row.for_lawyer),
    remindOn: text(row.remind_on),
    message: text(row.message),
    eventId: text(row.event_id),
    state: text(row.state) as CaseReminder["state"],
    createdAt: text(row.created_at),
    doneBy: nullableText(row.done_by),
    doneAt: nullableText(row.done_at),
    origin: originOf(row.origin),
  };
}

function noticeOf(row: Row): ClientNotice {
  return {
    id: text(row.id),
    caseId: text(row.case_id),
    kind: text(row.kind),
    title: text(row.title),
    body: text(row.body),
    eventDate: nullableText(row.event_date),
    eventTime: nullableText(row.event_time),
    place: nullableText(row.place),
    createdAt: text(row.created_at),
    origin: originOf(row.origin),
  };
}

/*
 * A row becomes a record only through the schema that describes it. The office
 * writes these rows itself, through inputs already validated, so a row the
 * schema rejects is not a user mistake: it is a defect or a change made outside
 * the application, and the honest answer to it is to refuse the record instead
 * of asserting that a value is what the code hoped it would be.
 */
function clientOf(row: Row): StoredClient {
  return storedClientSchema.parse({
    id: text(row.id),
    fullName: text(row.full_name),
    cpf: text(row.cpf),
    rg: text(row.rg),
    birthDate: text(row.birth_date),
    motherName: optional(row.mother_name),
    phone: text(row.phone),
    email: text(row.email),
    address: text(row.address),
    cityState: text(row.city_state),
    notes: optional(row.notes),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    notices: ((row.client_notices as Row[] | null) ?? []).map(noticeOf),
  });
}

function caseOf(row: Row): StoredCase {
  return storedCaseSchema.parse({
    id: text(row.id),
    clientId: text(row.client_id),
    sphere: text(row.sphere),
    caseType: text(row.case_type),
    opposingParty: text(row.opposing_party),
    status: text(row.status),
    responsibleLawyer: text(row.responsible_lawyer),
    reference: optional(row.reference),
    factSummary: optional(row.fact_summary),
    lawsuitNumber: optional(row.lawsuit_number),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    documents: ((row.case_documents as Row[] | null) ?? []).map(documentOf),
    deadlines: ((row.case_deadlines as Row[] | null) ?? []).map(deadlineOf),
    tasks: ((row.case_tasks as Row[] | null) ?? []).map(taskOf),
    events: ((row.case_events as Row[] | null) ?? []).map(eventOf),
    reminders: ((row.case_reminders as Row[] | null) ?? []).map(reminderOf),
  });
}

const CLIENT_SELECT = "*, client_notices(*)";
const CASE_SELECT =
  "*, case_documents(*), case_deadlines(*), case_tasks(*), case_events(*), case_reminders(*)";

/* ------------------------------------------------------------------------- */
/* Clients                                                                    */
/* ------------------------------------------------------------------------- */

/* ------------------------------------------------------------------------- */
/* The trail                                                                  */
/* ------------------------------------------------------------------------- */

/*
 * Every relevant act of the office leaves a line here, with the author, what
 * was done, over which record, and the values before and after. The application
 * holds the privilege to insert and to read and holds no privilege to update or
 * to delete, so what is written cannot be rewritten by this code, and only the
 * administration may read it.
 *
 * The trail is written after the act it describes and never before, so a line
 * exists only for something that really happened. A failure to write it is not
 * swallowed: the caller is told, because an unaudited act is a defect and not
 * an inconvenience.
 */
export type AuditInput = {
  action: string;
  entity: string;
  entityId: string | null;
  actor?: string;
  before?: unknown;
  after?: unknown;
};

async function auditActor(
  supabase: Awaited<ReturnType<typeof serverSupabase>>,
  stated?: string,
): Promise<{ actor: string; actorId: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    /* Only the scheduled capture reaches a write with no person behind it, and
     * the trail says so in those words instead of naming somebody. */
    return { actor: stated ?? "rotina agendada do escritório", actorId: null };
  }
  if (stated !== undefined && stated.length > 0) {
    return { actor: stated, actorId: user.id };
  }
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle<{ first_name: string; last_name: string }>();
  return {
    actor: data ? `${data.first_name} ${data.last_name}`.trim() : user.id,
    actorId: user.id,
  };
}

export async function appendAuditEvent(input: AuditInput): Promise<void> {
  const supabase = await serverSupabase();
  const { actor, actorId } = await auditActor(supabase, input.actor);
  const { error } = await supabase.from("audit_events").insert({
    id: ulid(),
    actor,
    actor_id: actorId,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId,
    before: input.before === undefined ? null : (input.before as object),
    after: input.after === undefined ? null : (input.after as object),
    at: nowIso(),
  });
  if (error) {
    throw new Error(`Audit trail refused the event: ${error.message}`);
  }
}

/* What of a record enters the trail. A client and a case carry personal data,
 * and the trail is read only by the administration, so the fields that identify
 * the change are kept and nothing else is copied in. */
function auditableClient(record: StoredClient): Record<string, unknown> {
  return {
    fullName: record.fullName,
    cpf: record.cpf,
    rg: record.rg,
    birthDate: record.birthDate,
    motherName: record.motherName ?? null,
    phone: record.phone,
    email: record.email,
    address: record.address,
    cityState: record.cityState,
    notes: record.notes ?? null,
  };
}

function auditableCase(record: StoredCase): Record<string, unknown> {
  return {
    sphere: record.sphere,
    caseType: record.caseType,
    opposingParty: record.opposingParty,
    status: record.status,
    responsibleLawyer: record.responsibleLawyer,
    reference: record.reference ?? null,
    factSummary: record.factSummary ?? null,
    lawsuitNumber: record.lawsuitNumber ?? null,
  };
}

export async function listClients(): Promise<StoredClient[]> {
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    /* ULID sorts chronologically, so the newest registration comes first. */
    .order("id", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map((row) => clientOf(row as Row));
}

export async function readClient(
  clientId: string,
): Promise<StoredClient | null> {
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("id", assertId(clientId, "client id"))
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return clientOf(data as Row);
}

export async function createClient(input: ClientInput): Promise<StoredClient> {
  const supabase = await serverSupabase();
  const data = clientInputSchema.parse(input);
  const timestamp = nowIso();
  const id = ulid();
  const { error } = await supabase.from("clients").insert({
    id,
    full_name: data.fullName,
    cpf: data.cpf,
    rg: data.rg,
    birth_date: data.birthDate,
    mother_name: data.motherName ?? null,
    phone: data.phone,
    email: data.email,
    address: data.address,
    city_state: data.cityState,
    notes: data.notes ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  });
  if (error) {
    throw new Error(error.message);
  }
  const record = await readClient(id);
  if (!record) {
    throw new Error("Client was written but cannot be read back");
  }
  await appendAuditEvent({
    action: "client-created",
    entity: "client",
    entityId: id,
    after: auditableClient(record),
  });
  return record;
}

export async function updateClient(
  clientId: string,
  input: ClientInput,
): Promise<StoredClient> {
  const supabase = await serverSupabase();
  const data = clientInputSchema.parse(input);
  const previous = await readClient(clientId);
  const { error } = await supabase
    .from("clients")
    .update({
      full_name: data.fullName,
      cpf: data.cpf,
      rg: data.rg,
      birth_date: data.birthDate,
      mother_name: data.motherName ?? null,
      phone: data.phone,
      email: data.email,
      address: data.address,
      city_state: data.cityState,
      notes: data.notes ?? null,
      updated_at: nowIso(),
    })
    .eq("id", assertId(clientId, "client id"));
  if (error) {
    throw new Error(error.message);
  }
  const record = await readClient(clientId);
  if (!record) {
    throw new Error("Client not found");
  }
  await appendAuditEvent({
    action: "client-updated",
    entity: "client",
    entityId: record.id,
    before: previous ? auditableClient(previous) : null,
    after: auditableClient(record),
  });
  return record;
}

/* ------------------------------------------------------------------------- */
/* Cases                                                                      */
/* ------------------------------------------------------------------------- */

export async function listCasesOfClient(
  clientId: string,
): Promise<StoredCase[]> {
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("cases")
    .select(CASE_SELECT)
    .eq("client_id", assertId(clientId, "client id"))
    .order("id", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data.map((row) => caseOf(row as Row));
}

export type CaseWithClient = { record: StoredCase; client: StoredClient };

export async function listAllCases(): Promise<CaseWithClient[]> {
  const supabase = await serverSupabase();
  const [{ data: caseRows }, clients] = await Promise.all([
    supabase
      .from("cases")
      .select(CASE_SELECT)
      .order("id", { ascending: false }),
    listClients(),
  ]);
  if (!caseRows) {
    return [];
  }
  const byId = new Map(clients.map((client) => [client.id, client]));
  const all: CaseWithClient[] = [];
  for (const row of caseRows) {
    const record = caseOf(row as Row);
    const client = byId.get(record.clientId);
    if (client) {
      all.push({ record, client });
    }
  }
  return all;
}

export async function readCase(
  clientId: string,
  caseId: string,
): Promise<StoredCase | null> {
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("cases")
    .select(CASE_SELECT)
    .eq("client_id", assertId(clientId, "client id"))
    .eq("id", assertId(caseId, "case id"))
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return caseOf(data as Row);
}

/* The name on the form is what the screen shows; the identity behind it is what
 * the policy reads, because a lawyer sees exclusively his own cases. When the
 * name matches a member of the office, the case is bound to that identity. */
async function lawyerIdFor(fullName: string): Promise<string | null> {
  const supabase = await serverSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name");
  const match = (data ?? []).find(
    (profile) =>
      `${profile.first_name} ${profile.last_name}`.trim().toLowerCase() ===
      fullName.trim().toLowerCase(),
  );
  return match?.id ?? null;
}

export async function createCase(
  clientId: string,
  input: CaseInput,
): Promise<StoredCase> {
  const supabase = await serverSupabase();
  const client = await readClient(clientId);
  if (!client) {
    throw new Error("Client not found");
  }
  const data = caseInputSchema.parse(input);
  const timestamp = nowIso();
  const id = ulid();
  const { error } = await supabase.from("cases").insert({
    id,
    client_id: client.id,
    sphere: data.sphere,
    case_type: data.caseType,
    opposing_party: data.opposingParty,
    status: data.status,
    responsible_lawyer: data.responsibleLawyer,
    responsible_lawyer_id: await lawyerIdFor(data.responsibleLawyer),
    reference: data.reference ?? null,
    fact_summary: data.factSummary ?? null,
    lawsuit_number: data.lawsuitNumber ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  });
  if (error) {
    throw new Error(error.message);
  }
  const record = await readCase(clientId, id);
  if (!record) {
    throw new Error("Case was written but cannot be read back");
  }
  await appendAuditEvent({
    action: "case-created",
    entity: "case",
    entityId: id,
    after: auditableCase(record),
  });
  return record;
}

export async function updateCase(
  clientId: string,
  caseId: string,
  input: CaseInput,
): Promise<StoredCase> {
  const supabase = await serverSupabase();
  const data = caseInputSchema.parse(input);
  const previous = await readCase(clientId, caseId);
  const { error } = await supabase
    .from("cases")
    .update({
      sphere: data.sphere,
      case_type: data.caseType,
      opposing_party: data.opposingParty,
      status: data.status,
      responsible_lawyer: data.responsibleLawyer,
      responsible_lawyer_id: await lawyerIdFor(data.responsibleLawyer),
      reference: data.reference ?? null,
      fact_summary: data.factSummary ?? null,
      lawsuit_number: data.lawsuitNumber ?? null,
      updated_at: nowIso(),
    })
    .eq("client_id", assertId(clientId, "client id"))
    .eq("id", assertId(caseId, "case id"));
  if (error) {
    throw new Error(error.message);
  }
  const record = await readCase(clientId, caseId);
  if (!record) {
    throw new Error("Case not found");
  }
  /* A change of status is a change of phase in the legal track, and the trail
   * names it as such so the administration can find it without reading every
   * field of every case change. */
  await appendAuditEvent({
    action:
      previous && previous.status !== record.status
        ? "case-phase-changed"
        : "case-updated",
    entity: "case",
    entityId: record.id,
    before: previous ? auditableCase(previous) : null,
    after: auditableCase(record),
  });
  return record;
}

/* ------------------------------------------------------------------------- */
/* Documents                                                                  */
/* ------------------------------------------------------------------------- */

/*
 * The stored name never comes from the browser. The original name is kept in the
 * record for the operator to read, and the bytes live under an identifier we
 * generated, so a crafted name cannot escape the folder of the case.
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
  const supabase = await serverSupabase();
  const record = await readCase(clientId, caseId);
  if (!record) {
    throw new Error("Case not found");
  }
  const id = ulid();
  const storedName = storedNameFor(id, file.name);
  const storagePath = `${caseId}/${storedName}`;

  const upload = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.bytes, {
      contentType: file.type,
      upsert: false,
    });
  if (upload.error) {
    throw new Error(upload.error.message);
  }

  const document: StoredDocument = {
    id,
    fileName: file.name,
    storedName,
    mimeType: file.type,
    byteSize: file.bytes.byteLength,
    fingerprint: createHash("sha256").update(file.bytes).digest("hex"),
    /* Uploaded, never processed: the local reading runs afterwards and the
     * interface must not claim a state the system has not reached. */
    state: "uploaded",
    uploadedAt: nowIso(),
    uploadedBy,
  };

  const { error } = await supabase.from("case_documents").insert({
    id,
    case_id: caseId,
    file_name: document.fileName,
    stored_name: storedName,
    storage_path: storagePath,
    mime_type: document.mimeType,
    byte_size: document.byteSize,
    state: document.state,
    fingerprint: document.fingerprint,
    uploaded_at: document.uploadedAt,
    uploaded_by: uploadedBy,
  });
  if (error) {
    /* The row is what makes the object findable, so an object without a row is
     * removed instead of being left behind as a byte nobody can reach. */
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }
  await touchCase(caseId);
  await appendAuditEvent({
    action: "document-uploaded",
    entity: "document",
    entityId: id,
    actor: uploadedBy,
    after: {
      caseId,
      clientId,
      fileName: document.fileName,
      mimeType: document.mimeType,
      byteSize: document.byteSize,
      fingerprint: document.fingerprint,
      state: document.state,
    },
  });
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
  const supabase = await serverSupabase();
  const { data: currentRow } = await supabase
    .from("case_documents")
    .select("state")
    .eq("id", documentId)
    .eq("case_id", caseId)
    .maybeSingle<{ state: string }>();
  const previousState = currentRow?.state ?? null;
  const patch: Row = { state };
  if (stateNote !== undefined) patch.state_note = stateNote;
  if (measured?.extractedAt !== undefined)
    patch.extracted_at = measured.extractedAt;
  if (measured?.meanConfidence !== undefined)
    patch.mean_confidence = measured.meanConfidence;
  if (measured?.pageCount !== undefined) patch.page_count = measured.pageCount;
  if (measured?.ocrPages !== undefined) patch.ocr_pages = measured.ocrPages;

  const { error } = await supabase
    .from("case_documents")
    .update(patch)
    .eq("id", documentId)
    .eq("case_id", caseId);
  if (error) {
    throw new Error(error.message);
  }
  await touchCase(caseId);
  const record = await readCase(clientId, caseId);
  if (!record) {
    throw new Error("Case not found");
  }
  await appendAuditEvent({
    action: "document-state-changed",
    entity: "document",
    entityId: documentId,
    before: { state: previousState },
    after: { state, ...patch },
  });
  return record;
}

export async function readDocumentBytes(
  clientId: string,
  caseId: string,
  documentId: string,
): Promise<{ document: StoredDocument; bytes: Buffer } | null> {
  const supabase = await serverSupabase();
  const { data: row } = await supabase
    .from("case_documents")
    .select("*")
    .eq("id", documentId)
    .eq("case_id", assertId(caseId, "case id"))
    .maybeSingle();
  if (!row) {
    return null;
  }
  /* The case is read as well, so a document is only served to somebody the
   * policies let read the case it belongs to. */
  const record = await readCase(clientId, caseId);
  if (!record) {
    return null;
  }
  const download = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(text((row as Row).storage_path));
  if (download.error || !download.data) {
    return null;
  }
  const bytes = Buffer.from(await download.data.arrayBuffer());
  return { document: documentOf(row as Row), bytes };
}

/* Fingerprint used to tell two uploads of the same bytes apart in a report. */
export function fingerprintOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

/* ------------------------------------------------------------------------- */
/* What a captured act writes, and the transitions a human makes              */
/* ------------------------------------------------------------------------- */

async function touchCase(caseId: string): Promise<void> {
  const supabase = await serverSupabase();
  await supabase
    .from("cases")
    .update({ updated_at: nowIso() })
    .eq("id", caseId);
}

/*
 * Every one of these is an append, never a rewrite: a deadline, an event, a
 * task, a reminder and a notice are added, and what changes afterwards is only
 * the state a human sets. The confirmation of a deadline is the one transition
 * that matters most in this system, and it exists here in one place, requiring
 * a name and a moment, so no code path can produce it by automation.
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
  const supabase = await serverSupabase();
  const current = await readCase(clientId, caseId);
  if (!current) {
    return null;
  }

  if (records.deadline) {
    const deadline = records.deadline;
    await supabase.from("case_deadlines").insert({
      id: deadline.id,
      case_id: caseId,
      label: deadline.label,
      regime: deadline.regime,
      available_on: deadline.availableOn,
      published_on: deadline.publishedOn,
      starts_on: deadline.startsOn,
      due_on: deadline.dueOn,
      days: deadline.days,
      counted_in_business_days: deadline.countedInBusinessDays,
      court: deadline.court,
      calendar_reviewed: deadline.calendarReviewed,
      warnings: deadline.warnings,
      skipped: deadline.skipped,
      legal_sources: deadline.legalSources,
      state: deadline.state,
      confirmed_by: deadline.confirmedBy,
      confirmed_at: deadline.confirmedAt,
      created_at: deadline.createdAt,
      origin: deadline.origin,
    });
  }

  if (records.event) {
    const event = records.event;
    await supabase.from("case_events").insert({
      id: event.id,
      case_id: caseId,
      kind: event.kind,
      title: event.title,
      date: event.date,
      time: event.time,
      place: event.place,
      created_at: event.createdAt,
      origin: event.origin,
    });
  }

  if (records.task) {
    const task = records.task;
    await supabase.from("case_tasks").insert({
      id: task.id,
      case_id: caseId,
      title: task.title,
      detail: task.detail,
      state: task.state,
      responsible: task.responsible,
      internal_due_on: task.internalDueOn,
      deadline_id: task.deadlineId,
      created_at: task.createdAt,
      decided_by: task.decidedBy,
      decided_at: task.decidedAt,
      origin: task.origin,
    });
  }

  if (records.reminder) {
    const reminder = records.reminder;
    await supabase.from("case_reminders").insert({
      id: reminder.id,
      case_id: caseId,
      for_lawyer: reminder.forLawyer,
      remind_on: reminder.remindOn,
      message: reminder.message,
      event_id: reminder.eventId,
      state: reminder.state,
      created_at: reminder.createdAt,
      done_by: reminder.doneBy,
      done_at: reminder.doneAt,
      origin: reminder.origin,
    });
  }

  await touchCase(caseId);

  /* A deadline born here is born calculated, and the trail says which act of
   * which communication produced it, because a deadline whose origin cannot be
   * shown is a deadline the office cannot defend. */
  if (records.deadline) {
    await appendAuditEvent({
      action: "deadline-created",
      entity: "deadline",
      entityId: records.deadline.id,
      after: {
        caseId,
        label: records.deadline.label,
        regime: records.deadline.regime,
        availableOn: records.deadline.availableOn,
        publishedOn: records.deadline.publishedOn,
        startsOn: records.deadline.startsOn,
        dueOn: records.deadline.dueOn,
        days: records.deadline.days,
        state: records.deadline.state,
        legalSources: records.deadline.legalSources,
        origin: records.deadline.origin,
      },
    });
  }
  if (records.event) {
    await appendAuditEvent({
      action: "case-event-created",
      entity: "case-event",
      entityId: records.event.id,
      after: {
        caseId,
        kind: records.event.kind,
        title: records.event.title,
        date: records.event.date,
        origin: records.event.origin,
      },
    });
  }
  if (records.task) {
    await appendAuditEvent({
      action: "task-created",
      entity: "task",
      entityId: records.task.id,
      after: {
        caseId,
        title: records.task.title,
        state: records.task.state,
        origin: records.task.origin,
      },
    });
  }
  if (records.reminder) {
    await appendAuditEvent({
      action: "reminder-created",
      entity: "reminder",
      entityId: records.reminder.id,
      after: {
        caseId,
        forLawyer: records.reminder.forLawyer,
        remindOn: records.reminder.remindOn,
        eventId: records.reminder.eventId,
        origin: records.reminder.origin,
      },
    });
  }

  return readCase(clientId, caseId);
}

export async function appendClientNotice(
  clientId: string,
  notice: ClientNotice,
): Promise<StoredClient | null> {
  const supabase = await serverSupabase();
  const current = await readClient(clientId);
  if (!current) {
    return null;
  }
  await supabase.from("client_notices").insert({
    id: notice.id,
    client_id: clientId,
    case_id: notice.caseId,
    kind: notice.kind,
    title: notice.title,
    body: notice.body,
    event_date: notice.eventDate,
    event_time: notice.eventTime,
    place: notice.place,
    created_at: notice.createdAt,
    origin: notice.origin,
  });
  await supabase
    .from("clients")
    .update({ updated_at: nowIso() })
    .eq("id", clientId);
  await appendAuditEvent({
    action: "client-notice-created",
    entity: "client-notice",
    entityId: notice.id,
    after: {
      clientId,
      caseId: notice.caseId,
      kind: notice.kind,
      title: notice.title,
    },
  });
  return readClient(clientId);
}

/* The number of the process on the case, written when a human confirms the link
 * of a communication, so every later act of that process finds its case alone. */
export async function setLawsuitNumber(
  clientId: string,
  caseId: string,
  lawsuitNumber: string,
): Promise<StoredCase | null> {
  const supabase = await serverSupabase();
  const { error } = await supabase
    .from("cases")
    .update({ lawsuit_number: lawsuitNumber, updated_at: nowIso() })
    .eq("client_id", assertId(clientId, "client id"))
    .eq("id", assertId(caseId, "case id"));
  if (error) {
    return null;
  }
  await appendAuditEvent({
    action: "case-lawsuit-number-set",
    entity: "case",
    entityId: caseId,
    after: { lawsuitNumber },
  });
  return readCase(clientId, caseId);
}

/*
 * The transition a lawyer makes with his own hand. It carries who did it and
 * when, and there is no other way in this application to reach the state
 * confirmed. The database refuses a confirmation without an author as well, so
 * the rule is written twice and enforced where it cannot be forgotten.
 */
export async function confirmDeadline(
  clientId: string,
  caseId: string,
  deadlineId: string,
  confirmedBy: string,
): Promise<StoredCase | null> {
  const supabase = await serverSupabase();
  const at = nowIso();
  const { error } = await supabase
    .from("case_deadlines")
    .update({ state: "confirmed", confirmed_by: confirmedBy, confirmed_at: at })
    .eq("id", deadlineId)
    .eq("case_id", caseId);
  if (error) {
    return null;
  }
  await touchCase(caseId);
  await appendAuditEvent({
    action: "deadline-confirmed",
    entity: "deadline",
    entityId: deadlineId,
    actor: confirmedBy,
    before: { state: "calculated" },
    after: { state: "confirmed", confirmedBy, confirmedAt: at, caseId },
  });
  return readCase(clientId, caseId);
}

export async function setTaskState(
  clientId: string,
  caseId: string,
  taskId: string,
  state: CaseTask["state"],
  decidedBy: string,
): Promise<StoredCase | null> {
  const supabase = await serverSupabase();
  const at = nowIso();
  const { error } = await supabase
    .from("case_tasks")
    .update({ state, decided_by: decidedBy, decided_at: at })
    .eq("id", taskId)
    .eq("case_id", caseId);
  if (error) {
    return null;
  }
  await touchCase(caseId);
  await appendAuditEvent({
    action: "task-state-changed",
    entity: "task",
    entityId: taskId,
    actor: decidedBy,
    after: { state, decidedBy, decidedAt: at, caseId },
  });
  return readCase(clientId, caseId);
}

export async function setReminderDone(
  clientId: string,
  caseId: string,
  reminderId: string,
  doneBy: string,
): Promise<StoredCase | null> {
  const supabase = await serverSupabase();
  const at = nowIso();
  const { error } = await supabase
    .from("case_reminders")
    .update({ state: "done", done_by: doneBy, done_at: at })
    .eq("id", reminderId)
    .eq("case_id", caseId);
  if (error) {
    return null;
  }
  await touchCase(caseId);
  await appendAuditEvent({
    action: "reminder-done",
    entity: "reminder",
    entityId: reminderId,
    actor: doneBy,
    after: { state: "done", doneBy, doneAt: at, caseId },
  });
  return readCase(clientId, caseId);
}
