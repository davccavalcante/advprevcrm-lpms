import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Communication,
  communicationSchema,
} from "@/lib/capture/communication";
import { adminSupabase } from "@/lib/supabase/admin";
import { serverSupabase } from "@/lib/supabase/server";

/*
 * Where the captured communications live: one row per act, in the office
 * database, with the whole text and the payload as it arrived. Nothing is ever
 * deleted here, and a communication that matched no case is not discarded: it
 * waits in the queue of the unlinked, in plain sight.
 *
 * A communication is written once. The fingerprint carries a unique index, so a
 * scheduled run that overlaps the previous window cannot create a second record
 * of the same act, and the decision is the database's, not a read followed by a
 * write that another run can slip between.
 */

/*
 * Who asks the database. A screen always asks as the person signed in, so the
 * access policies decide what comes back and the finance team never sees an
 * act. The scheduled capture has no person behind it, and only then does the
 * office use its own credential.
 */
async function captureDb(): Promise<SupabaseClient> {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? (supabase as SupabaseClient) : adminSupabase();
}

/*
 * What makes two payloads the same act. The certificate code is the identifier
 * the court itself gives, so it answers first. Without it, the office falls back
 * to the process number, the day of availability and the text, which is the
 * least that can distinguish two acts of the same day.
 */
export function fingerprintOfCommunication(
  communication: Pick<
    Communication,
    "certificateCode" | "externalId" | "processNumber" | "availableOn" | "text"
  >,
): string {
  if (communication.certificateCode !== null) {
    return `certidao:${communication.certificateCode}`;
  }
  if (communication.externalId !== null) {
    return `id:${communication.externalId}`;
  }
  const digest = createHash("sha256")
    .update(
      [
        communication.processNumber ?? "",
        communication.availableOn,
        communication.text,
      ].join("|"),
    )
    .digest("hex");
  return `texto:${digest}`;
}

type CommunicationRow = {
  id: string;
  source: string;
  captured_at: string;
  monitored_oab: string;
  external_id: string | null;
  certificate_code: string | null;
  certificate_url: string | null;
  lawsuit_number: string | null;
  lawsuit_number_label: string | null;
  available_on: string;
  tribunal: string | null;
  court_name: string | null;
  case_class: string | null;
  document_type: string | null;
  medium: string | null;
  official_text: string;
  recipients: unknown;
  lawyers: unknown;
  raw: unknown;
  extraction: unknown;
  suggestions: unknown;
  client_id: string | null;
  case_id: string | null;
  link_method: string | null;
  linked_at: string | null;
  linked_by: string | null;
  applied_at: string | null;
  applied_note: string | null;
  fingerprint: string;
};

const COLUMNS =
  "id, source, captured_at, monitored_oab, external_id, certificate_code, certificate_url, lawsuit_number, lawsuit_number_label, available_on, tribunal, court_name, case_class, document_type, medium, official_text, recipients, lawyers, raw, extraction, suggestions, client_id, case_id, link_method, linked_at, linked_by, applied_at, applied_note, fingerprint";

/*
 * A row becomes the record only through the schema that describes it. A row the
 * schema rejects is not repaired and is not guessed at: it is left out, because
 * an act the office cannot read whole is not an act it may act upon.
 */
function communicationOf(row: CommunicationRow): Communication | null {
  const link =
    row.case_id !== null && row.client_id !== null && row.link_method !== null
      ? {
          clientId: row.client_id,
          caseId: row.case_id,
          method: row.link_method,
          linkedAt: row.linked_at,
          linkedBy: row.linked_by,
        }
      : null;

  const parsed = communicationSchema.safeParse({
    id: row.id,
    source: row.source,
    capturedAt: row.captured_at,
    monitoredOab: row.monitored_oab,
    externalId: row.external_id,
    certificateCode: row.certificate_code,
    certificateUrl: row.certificate_url,
    processNumber: row.lawsuit_number,
    processNumberLabel: row.lawsuit_number_label,
    availableOn: row.available_on,
    tribunalSigla: row.tribunal,
    courtName: row.court_name,
    caseClass: row.case_class,
    documentType: row.document_type,
    medium: row.medium,
    text: row.official_text,
    recipients: row.recipients ?? [],
    lawyers: row.lawyers ?? [],
    ...(row.raw === null || row.raw === undefined ? {} : { raw: row.raw }),
    extraction: row.extraction ?? null,
    link,
    suggestions: row.suggestions ?? [],
    appliedAt: row.applied_at,
    appliedNote: row.applied_note,
  });
  return parsed.success ? parsed.data : null;
}

function rowOf(communication: Communication): Record<string, unknown> {
  return {
    id: communication.id,
    source: communication.source,
    captured_at: communication.capturedAt,
    monitored_oab: communication.monitoredOab,
    external_id: communication.externalId,
    certificate_code: communication.certificateCode,
    certificate_url: communication.certificateUrl,
    lawsuit_number: communication.processNumber,
    lawsuit_number_label: communication.processNumberLabel,
    available_on: communication.availableOn,
    tribunal: communication.tribunalSigla,
    court_name: communication.courtName,
    case_class: communication.caseClass,
    document_type: communication.documentType,
    medium: communication.medium,
    official_text: communication.text,
    recipients: communication.recipients,
    lawyers: communication.lawyers,
    raw: communication.raw ?? null,
    extraction: communication.extraction,
    suggestions: communication.suggestions,
    client_id: communication.link?.clientId ?? null,
    case_id: communication.link?.caseId ?? null,
    link_method: communication.link?.method ?? null,
    linked_at: communication.link?.linkedAt ?? null,
    linked_by: communication.link?.linkedBy ?? null,
    applied_at: communication.appliedAt,
    applied_note: communication.appliedNote,
    fingerprint: fingerprintOfCommunication(communication),
  };
}

export async function readCommunication(
  id: string,
): Promise<Communication | null> {
  const supabase = await captureDb();
  const { data } = await supabase
    .from("communications")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<CommunicationRow>();
  return data ? communicationOf(data) : null;
}

export async function listCommunications(): Promise<Communication[]> {
  const supabase = await captureDb();
  /* Newest availability first, and inside the same day the newest capture. */
  const { data } = await supabase
    .from("communications")
    .select(COLUMNS)
    .order("available_on", { ascending: false })
    .order("id", { ascending: false })
    .returns<CommunicationRow[]>();
  if (!data) {
    return [];
  }
  const out: Communication[] = [];
  for (const row of data) {
    const record = communicationOf(row);
    if (record) {
      out.push(record);
    }
  }
  return out;
}

export async function saveCommunication(
  communication: Communication,
): Promise<void> {
  const supabase = await captureDb();
  await supabase
    .from("communications")
    .upsert(rowOf(communication), { onConflict: "id" });
}

export type StoreOutcome = {
  stored: boolean;
  reason: "new" | "duplicate";
  id: string;
};

/* The code Postgres returns when a unique index refuses a second row. */
const UNIQUE_VIOLATION = "23505";

/*
 * Stores a communication unless the office already has it. The uniqueness of the
 * fingerprint is enforced by the database, so two runs at the same instant
 * cannot both decide that the act is new: one of them is refused, and a refusal
 * is read as the duplicate it is, never as a failure of the capture.
 */
export async function storeIfNew(
  communication: Communication,
): Promise<StoreOutcome> {
  const supabase = await captureDb();
  const fingerprint = fingerprintOfCommunication(communication);
  const { error } = await supabase
    .from("communications")
    .insert(rowOf(communication));

  if (error === null) {
    return { stored: true, reason: "new", id: communication.id };
  }
  if (error.code !== UNIQUE_VIOLATION) {
    throw new Error(error.message);
  }

  const { data } = await supabase
    .from("communications")
    .select("id")
    .eq("fingerprint", fingerprint)
    .maybeSingle<{ id: string }>();
  return {
    stored: false,
    reason: "duplicate",
    id: data?.id ?? communication.id,
  };
}

export async function updateCommunication(
  id: string,
  change: (current: Communication) => Communication,
): Promise<Communication | null> {
  const current = await readCommunication(id);
  if (current === null) {
    return null;
  }
  const updated = change(current);
  const supabase = await captureDb();
  const { error } = await supabase
    .from("communications")
    .update(rowOf(updated))
    .eq("id", id);
  return error === null ? updated : null;
}

export async function unlinkedCommunications(): Promise<Communication[]> {
  return (await listCommunications()).filter(
    (communication) => communication.link === null,
  );
}

export async function communicationsOfCase(
  clientId: string,
  caseId: string,
): Promise<Communication[]> {
  return (await listCommunications()).filter(
    (communication) =>
      communication.link?.clientId === clientId &&
      communication.link?.caseId === caseId,
  );
}
