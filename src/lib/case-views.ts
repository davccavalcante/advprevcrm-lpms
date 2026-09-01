import {
  type CaseSphereId,
  type CaseStatusId,
  caseStatuses,
  sphereOf,
} from "@/lib/case-domain";
import { listAllCases, listClients } from "@/lib/records-store";

/*
 * The single reading layer of cases. Every screen consumes this and nothing
 * else, so a count shown on one screen can never disagree with a list shown on
 * another. The five operation screens read from here without writing.
 *
 * There is one origin and only one: the records the office wrote in its own
 * database. No fixture, no demonstration case and no seeded number reaches a
 * screen through here, so an empty office shows an empty screen and every
 * figure on it traces to a record somebody created.
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
  /* The three buckets are disjoint and add up to `openDeadlines`, because a
   * panel that draws them as one whole cannot count a deadline twice. A
   * deadline near its due date, or already past it, is critical whatever its
   * state; of the rest, what a lawyer confirmed is separated from what is still
   * only calculated, which is the distinction that protects the office. */
  criticalDeadlines: number;
  confirmedDeadlines: number;
  calculatedDeadlines: number;
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
 * How near a due date has to be for the office to call a deadline critical. It
 * is a tolerance of the office, not a legal value, so it is configuration and
 * never a number written into a component.
 */
function criticalWithinDays(): number {
  const raw = process.env.DEADLINE_CRITICAL_WITHIN_DAYS?.trim();
  const value = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

function criticalLimitDate(now: Date = new Date()): string {
  const limit = new Date(now);
  limit.setDate(limit.getDate() + criticalWithinDays());
  return limit.toISOString().slice(0, 10);
}

export async function listUnifiedCases(): Promise<UnifiedCase[]> {
  const stored = await listAllCases();

  const limit = criticalLimitDate();

  const storedCases: UnifiedCase[] = stored.map(({ record, client }) => {
    const info = sphereOf(record.sphere);
    const critical = record.deadlines.filter(
      (deadline) => deadline.dueOn <= limit,
    ).length;
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
      openDeadlines: record.deadlines.length,
      criticalDeadlines: critical,
      confirmedDeadlines: record.deadlines.filter(
        (deadline) => deadline.dueOn > limit && deadline.state === "confirmed",
      ).length,
      calculatedDeadlines: record.deadlines.filter(
        (deadline) => deadline.dueOn > limit && deadline.state === "calculated",
      ).length,
      agendaCount: record.reminders.filter(
        (reminder) => reminder.state === "pending",
      ).length,
      /* Finance does not exist for a case yet, and the screen says so instead
       * of showing a zero that looks like data. */
      financeCount: 0,
      intakePending: record.documents.length === 0,
      intakeReason:
        record.documents.length === 0
          ? "Nenhum documento anexado ao caso."
          : null,
    };
  });

  return storedCases;
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

export type DeadlineSummary = {
  confirmed: number;
  calculated: number;
  critical: number;
  total: number;
};

/*
 * The distribution of the deadlines of the office by state, read from the
 * records and from nowhere else. An office with no deadline written yet gets
 * four zeros, which is the truth about it.
 */
export function deadlineSummary(entries: UnifiedCase[]): DeadlineSummary {
  const summary = entries.reduce(
    (totals, entry) => ({
      confirmed: totals.confirmed + entry.confirmedDeadlines,
      calculated: totals.calculated + entry.calculatedDeadlines,
      critical: totals.critical + entry.criticalDeadlines,
    }),
    { confirmed: 0, calculated: 0, critical: 0 },
  );
  return {
    ...summary,
    total: summary.confirmed + summary.calculated + summary.critical,
  };
}

/*
 * The pleaded benefits of the office, counted. The label is the case type the
 * office itself wrote, never a catalogue of examples.
 */
export function countByCaseType(
  entries: UnifiedCase[],
): { caseType: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.caseType, (counts.get(entry.caseType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([caseType, count]) => ({ caseType, count }))
    .sort((a, b) => b.count - a.count || a.caseType.localeCompare(b.caseType));
}

export type SearchEntry = {
  id: string;
  kindLabel: string;
  title: string;
  detail: string;
  haystack: string;
  href: string;
  destinationLabel: string;
};

/* Accent and punctuation insensitive: the operator types "jose" or a bare
 * sequence of digits, the record says "José" and "5004231-88.2023.4.03.6100". */
function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function haystackOf(parts: string[]): string {
  const text = normalizeForSearch(parts.filter(Boolean).join(" "));
  return `${text} ${text.replace(/\D/g, "")}`;
}

/*
 * What the search of the top bar looks through: the clients the office
 * registered and their cases, and nothing else. An office that registered
 * nothing finds nothing, which is the truth about it.
 */
export async function searchIndex(): Promise<SearchEntry[]> {
  const [clients, cases] = await Promise.all([listClients(), listAllCases()]);
  const caseCount = new Map<string, number>();
  for (const row of cases) {
    caseCount.set(row.client.id, (caseCount.get(row.client.id) ?? 0) + 1);
  }

  const entries: SearchEntry[] = clients.map((client) => {
    const total = caseCount.get(client.id) ?? 0;
    return {
      id: `client-${client.id}`,
      kindLabel: "Cliente",
      title: client.fullName,
      detail: `${client.cpf}, ${total === 1 ? "1 caso" : `${total} casos`}`,
      haystack: haystackOf([client.fullName, client.cpf, client.rg]),
      href: `/clientes/${client.id}`,
      destinationLabel: "ficha do cliente",
    };
  });

  for (const { record, client } of cases) {
    const caseRef = record.reference?.trim()
      ? record.reference
      : `Caso ${record.id.slice(-6)}`;
    entries.push({
      id: `case-${record.id}`,
      kindLabel: record.lawsuitNumber ? "Processo" : "Caso",
      title: record.lawsuitNumber ?? caseRef,
      detail: `${client.fullName}, ${record.caseType}`,
      haystack: haystackOf([
        caseRef,
        client.fullName,
        record.caseType,
        record.lawsuitNumber ?? "",
      ]),
      href: `/casos/${client.id}/${record.id}`,
      destinationLabel: "ficha do caso",
    });
  }

  return entries;
}

export type CriticalDeadline = {
  id: string;
  label: string;
  clientName: string;
  caseRef: string;
  dueOn: string;
  state: "calculated" | "confirmed";
  href: string;
};

/*
 * The deadlines near their due date or already past it, named one by one and
 * ordered by how little time is left. A deadline that is only calculated is
 * still shown as calculated: the transition to confirmed belongs to a lawyer
 * and nothing on a panel may suggest otherwise.
 */
export async function criticalDeadlineList(): Promise<CriticalDeadline[]> {
  const stored = await listAllCases();
  const limit = criticalLimitDate();
  const out: CriticalDeadline[] = [];

  for (const { record, client } of stored) {
    const caseRef = record.reference?.trim()
      ? record.reference
      : `Caso ${record.id.slice(-6)}`;
    for (const deadline of record.deadlines) {
      if (deadline.dueOn > limit) {
        continue;
      }
      out.push({
        id: deadline.id,
        label: deadline.label,
        clientName: client.fullName,
        caseRef,
        dueOn: deadline.dueOn,
        state: deadline.state,
        href: `/casos/${client.id}/${record.id}`,
      });
    }
  }

  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export type Appointment = {
  id: string;
  kind: "hearing" | "examination";
  caseRef: string;
  clientName: string;
  date: string;
  time: string | null;
  place: string | null;
  href: string;
};

/*
 * The appointments of the coming days, read from the events the office wrote on
 * its cases. A hearing and an expert examination are the two that change a
 * lawyer's week, so they are the two this reading names; anything else stays on
 * the case where it was recorded.
 */
export async function weekAppointments(
  withinDays = 7,
  now: Date = new Date(),
): Promise<Appointment[]> {
  const stored = await listAllCases();
  const today = now.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setDate(end.getDate() + withinDays);
  const limit = end.toISOString().slice(0, 10);

  const out: Appointment[] = [];
  for (const { record, client } of stored) {
    const caseRef = record.reference?.trim()
      ? record.reference
      : `Caso ${record.id.slice(-6)}`;
    for (const event of record.events) {
      if (event.kind !== "hearing" && event.kind !== "examination") {
        continue;
      }
      if (event.date < today || event.date > limit) {
        continue;
      }
      out.push({
        id: event.id,
        kind: event.kind,
        caseRef,
        clientName: client.fullName,
        date: event.date,
        time: event.time,
        place: event.place,
        href: `/casos/${client.id}/${record.id}`,
      });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}
