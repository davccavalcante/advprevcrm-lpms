import {
  type CaseSphereId,
  type CaseStatusId,
  caseStatuses,
  sphereOf,
} from "@/lib/case-domain";
import {
  type ClientCase,
  type ClientRecord,
  feeContracts,
  personaClients,
  unifiedAgendaItems,
} from "@/lib/persona";
import { listAllCases } from "@/lib/records-store";

/*
 * The single reading layer of cases. Every screen consumes this and nothing
 * else, so a count shown on one screen can never disagree with a list shown on
 * another. The five operation screens read from here without writing.
 *
 * Two origins are merged: the records the office wrote under data/, and the
 * demonstration fixture that seeds the design. The merge is by case reference,
 * and a stored record always wins over a fixture record with the same
 * reference, so nothing is ever counted twice.
 */

export type CaseOrigin = "stored" | "fixture";

export type UnifiedCase = {
  key: string;
  origin: CaseOrigin;
  caseRef: string;
  clientId: string;
  clientName: string;
  sphere: CaseSphereId;
  sphereLabel: string;
  courtLabel: string;
  caseType: string;
  opposingParty: string;
  status: CaseStatusId;
  statusLabel: string;
  responsibleLawyer: string;
  href: string;
  documentCount: number;
  /* Names only. No content is extracted in this phase. */
  documentNames: string[];
  openDeadlines: number;
  agendaCount: number;
  financeCount: number;
  /*
   * Derived, never stored: a case with no document attached is still being
   * instructed. The screen that uses it says the condition is derived from the
   * absence of an attachment, not read from a field of the case.
   */
  intakePending: boolean;
  intakeReason: string | null;
};

const statusLabels = new Map<CaseStatusId, string>(
  caseStatuses.map((status) => [status.id, status.label]),
);

/*
 * The fixture predates the court branches and describes only claims against the
 * INSS. The branch is derived from what the record already says: an accident
 * benefit is heard by the state branch under Precedent 15 of the Superior Court
 * of Justice, and every other INSS claim is ordinary social security matter in
 * the federal branch. No fixture case is a labour claim, because none of them
 * litigates against an employer.
 */
function sphereOfFixtureBenefit(benefit: string): CaseSphereId {
  return /acidente|acident/i.test(benefit)
    ? "state-accident"
    : "federal-social-security";
}

/* The fixture phase vocabulary maps onto the case status vocabulary, so a
 * situation is never named one way here and another way there. */
function statusOfFixturePhase(phase: ClientCase["phase"]): CaseStatusId {
  switch (phase) {
    case "administrative":
    case "requirement":
      return "administrative";
    case "judicial":
      return "judicial";
    case "appeal":
      return "appeal";
    case "closed":
      return "closed";
    default:
      return "administrative";
  }
}

function agendaCountOf(caseRef: string): number {
  return unifiedAgendaItems.filter((item) => item.caseRef === caseRef).length;
}

function financeCountOf(caseRef: string): number {
  return feeContracts.filter((contract) => contract.caseRef === caseRef).length;
}

function fixtureCaseOf(client: ClientRecord, entry: ClientCase): UnifiedCase {
  const sphere = sphereOfFixtureBenefit(entry.benefit);
  const status = statusOfFixturePhase(entry.phase);
  const info = sphereOf(sphere);
  return {
    key: `fixture:${entry.caseRef}`,
    origin: "fixture",
    caseRef: entry.caseRef,
    clientId: client.id,
    clientName: client.fullName,
    sphere,
    sphereLabel: info.label,
    courtLabel: info.courtLabel,
    caseType: entry.benefit,
    opposingParty: "INSS",
    status,
    statusLabel: statusLabels.get(status) ?? status,
    responsibleLawyer: "Mendelsson Sandrini Alves Maciel",
    href: entry.href,
    documentCount: client.documents.length,
    documentNames: client.documents.map((document) => document.name),
    openDeadlines: entry.openDeadlines,
    agendaCount: agendaCountOf(entry.caseRef),
    financeCount: financeCountOf(entry.caseRef),
    intakePending:
      entry.phase === "administrative" && entry.openDeadlines === 0,
    intakeReason:
      entry.phase === "administrative" && entry.openDeadlines === 0
        ? "Sem prazo em aberto e ainda em instrução, aguarda conferência documental."
        : null,
  };
}

export async function listUnifiedCases(): Promise<UnifiedCase[]> {
  const stored = await listAllCases();

  const storedCases: UnifiedCase[] = stored.map(({ record, client }) => {
    const info = sphereOf(record.sphere);
    const caseRef = record.reference?.trim()
      ? record.reference
      : `Caso ${record.id.slice(-6)}`;
    return {
      key: `stored:${record.id}`,
      origin: "stored",
      caseRef,
      clientId: client.id,
      clientName: client.fullName,
      sphere: record.sphere,
      sphereLabel: info.label,
      courtLabel: info.courtLabel,
      caseType: record.caseType,
      opposingParty: record.opposingParty,
      status: record.status,
      statusLabel: statusLabels.get(record.status) ?? record.status,
      responsibleLawyer: record.responsibleLawyer,
      href: `/casos/${client.id}/${record.id}`,
      documentCount: record.documents.length,
      documentNames: record.documents.map((document) => document.fileName),
      /* Deadlines, agenda and finance do not exist for a stored case yet, and
       * the screens say so instead of showing a zero that looks like data. */
      openDeadlines: 0,
      agendaCount: 0,
      financeCount: 0,
      intakePending: record.documents.length === 0,
      intakeReason:
        record.documents.length === 0
          ? "Nenhum documento anexado ao caso."
          : null,
    };
  });

  const takenRefs = new Set(storedCases.map((entry) => entry.caseRef));
  const fixtureCases: UnifiedCase[] = [];
  for (const client of personaClients) {
    for (const entry of client.cases) {
      if (takenRefs.has(entry.caseRef)) {
        continue;
      }
      fixtureCases.push(fixtureCaseOf(client, entry));
    }
  }

  return [...storedCases, ...fixtureCases];
}

export type CaseSlice =
  | "all"
  | "intake"
  | "administrative"
  | "judicial"
  | "agenda"
  | "finance";

/*
 * The slice each operation screen works on. One function, so a screen and the
 * panel can never disagree about what belongs where.
 */
export function inSlice(entry: UnifiedCase, slice: CaseSlice): boolean {
  switch (slice) {
    case "all":
      return true;
    case "intake":
      return entry.intakePending;
    case "administrative":
      return entry.status === "administrative";
    case "judicial":
      return (
        entry.status === "judicial" ||
        entry.status === "appeal" ||
        entry.status === "execution"
      );
    case "agenda":
      return entry.status !== "closed";
    case "finance":
      return true;
    default:
      return true;
  }
}

export function casesInSlice(
  entries: UnifiedCase[],
  slice: CaseSlice,
): UnifiedCase[] {
  return entries.filter((entry) => inSlice(entry, slice));
}

export function countInSlice(entries: UnifiedCase[], slice: CaseSlice): number {
  return casesInSlice(entries, slice).length;
}

export function activeCases(entries: UnifiedCase[]): UnifiedCase[] {
  return entries.filter((entry) => entry.status !== "closed");
}

export function countBySphere(
  entries: UnifiedCase[],
): { sphere: CaseSphereId; label: string; count: number }[] {
  const counts = new Map<CaseSphereId, number>();
  for (const entry of entries) {
    counts.set(entry.sphere, (counts.get(entry.sphere) ?? 0) + 1);
  }
  return [...counts.entries()].map(([sphere, count]) => ({
    sphere,
    label: sphereOf(sphere).label,
    count,
  }));
}

export function countByStatus(
  entries: UnifiedCase[],
): { status: CaseStatusId; label: string; count: number }[] {
  return caseStatuses
    .map((status) => ({
      status: status.id,
      label: status.label,
      count: entries.filter((entry) => entry.status === status.id).length,
    }))
    .filter((row) => row.count > 0);
}
