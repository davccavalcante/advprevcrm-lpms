import "server-only";
import type {
  BoardCase,
  BoardCommunication,
  BoardHealth,
  BoardProcessGroup,
} from "@/components/capture/capture-board";
import { activeOabs } from "@/lib/capture/config";
import { DJEN_SIGNATURE } from "@/lib/capture/djen-signature";
import { egressMode } from "@/lib/capture/egress";
import { captureHealth } from "@/lib/capture/runs";
import { listCommunications } from "@/lib/capture/store";
import { listAllCases } from "@/lib/records-store";

/*
 * Everything the publications board shows, read on the server. The screen does
 * not reach into the store by itself, exactly as no screen of this office reads
 * a case outside its reading layer.
 */

/*
 * What the screen says about the state of the capture. The rule is that no text
 * of this interface may suggest that the lawyer depends on where he is: the call
 * to the court is made by the server of the office, in Brazil, and the browser
 * of the lawyer never speaks to a court.
 */
function signatureNoteOf(): string {
  const mode = egressMode();
  const base =
    "A captura roda no servidor do escritório, no Brasil, e nunca no navegador. O acesso do advogado não depende de onde ele está: pode consultar o sistema de qualquer lugar do mundo.";
  if (!DJEN_SIGNATURE.verifiedLive) {
    return `${base} A assinatura da API pública do DJEN ainda não foi conferida contra o serviço em execução.`;
  }
  const verified = `${base} A assinatura da API pública do DJEN foi conferida contra o serviço em execução em ${DJEN_SIGNATURE.verifiedAt}.`;
  if (mode.kind === "tunnel") {
    return `${verified} Este ambiente de desenvolvimento sai pelo túnel do próprio escritório; se o túnel estiver fechado, a consulta falha de forma visível e nada é inventado.`;
  }
  return verified;
}

/*
 * The queue, grouped by process. A lawyer does not decide act by act: he decides
 * that a process belongs to a case, and every act of that process follows. The
 * one hundred and sixty one acts of the first real capture are fifty six
 * processes, and fifty six decisions is a morning of work; one hundred and sixty
 * one is a wall nobody reads.
 */
function groupUnlinked(
  communications: BoardCommunication[],
): BoardProcessGroup[] {
  const groups = new Map<string, BoardProcessGroup>();
  for (const entry of communications) {
    if (entry.linked !== null) {
      continue;
    }
    const key = entry.processNumberLabel ?? "(sem número de processo)";
    const current = groups.get(key);
    if (current === undefined) {
      groups.set(key, {
        processNumberLabel: key,
        tribunalSigla: entry.tribunalSigla,
        courtName: entry.courtName,
        recipients: [...entry.recipients],
        firstAvailableOn: entry.availableOn,
        lastAvailableOn: entry.availableOn,
        withDeadline: entry.days === null ? 0 : 1,
        suggestions: entry.suggestions,
        communications: [entry],
      });
      continue;
    }
    current.communications.push(entry);
    current.firstAvailableOn =
      entry.availableOn < current.firstAvailableOn
        ? entry.availableOn
        : current.firstAvailableOn;
    current.lastAvailableOn =
      entry.availableOn > current.lastAvailableOn
        ? entry.availableOn
        : current.lastAvailableOn;
    current.withDeadline += entry.days === null ? 0 : 1;
    for (const name of entry.recipients) {
      if (!current.recipients.includes(name)) {
        current.recipients.push(name);
      }
    }
    if (current.suggestions.length === 0 && entry.suggestions.length > 0) {
      current.suggestions = entry.suggestions;
    }
  }
  /* The most recent act first, because that is the one that may be running a
   * deadline right now. */
  return [...groups.values()]
    .map((group) => ({
      ...group,
      communications: group.communications.sort((a, b) =>
        b.availableOn.localeCompare(a.availableOn),
      ),
    }))
    .sort((a, b) => b.lastAvailableOn.localeCompare(a.lastAvailableOn));
}

export async function captureBoardData(): Promise<{
  capturedToday: number;
  unlinkedGroups: BoardProcessGroup[];
  communications: BoardCommunication[];
  health: BoardHealth[];
  cases: BoardCase[];
  signatureVerified: boolean;
  signatureNote: string;
  monitoredLabels: string[];
}> {
  const [communications, health, cases] = await Promise.all([
    listCommunications(),
    captureHealth(),
    listAllCases(),
  ]);

  const caseLabel = (entry: (typeof cases)[number]) =>
    `${entry.client.fullName}, ${entry.record.reference?.trim().length ? `${entry.record.reference.trim()}, ` : ""}${entry.record.caseType}`;

  const today = new Date().toISOString().slice(0, 10);

  const board: BoardCommunication[] = communications.map((entry) => {
    const linkedCase =
      entry.link === null
        ? null
        : (cases.find(
            (candidate) =>
              candidate.client.id === entry.link?.clientId &&
              candidate.record.id === entry.link?.caseId,
          ) ?? null);
    const appointment = entry.extraction?.appointment ?? null;
    return {
      id: entry.id,
      availableOn: entry.availableOn,
      processNumberLabel: entry.processNumberLabel,
      tribunalSigla: entry.tribunalSigla,
      courtName: entry.courtName,
      documentType: entry.documentType,
      actType: entry.extraction?.actType ?? null,
      object: entry.extraction?.object ?? null,
      days: entry.extraction?.days ?? null,
      appointmentLabel:
        appointment === null || appointment.date === null
          ? null
          : `${appointment.kind} em ${appointment.date}${appointment.time === null ? "" : ` às ${appointment.time}`}`,
      residue: entry.extraction?.residue ?? [],
      fullyDeterministic: entry.extraction?.fullyDeterministic ?? false,
      monitoredOab: entry.monitoredOab,
      recipients: entry.recipients,
      certificateUrl: entry.certificateUrl,
      textExcerpt: `${entry.text.replace(/\s+/g, " ").trim().slice(0, 400)}${entry.text.length > 400 ? "..." : ""}`,
      linked:
        entry.link === null
          ? null
          : {
              clientId: entry.link.clientId,
              caseId: entry.link.caseId,
              label:
                linkedCase === null
                  ? "caso não encontrado no cadastro"
                  : caseLabel(linkedCase),
              method:
                entry.link.method === "process-number"
                  ? "pelo número do processo, automático"
                  : "por confirmação humana",
            },
      suggestions: entry.suggestions,
      appliedAt: entry.appliedAt,
      appliedNote: entry.appliedNote,
    };
  });

  return {
    /* What was really captured today. The screen shows this number instead of a
     * fixture, because an indicator that disagrees with the queue right below it
     * is the failure this office has already had once. */
    capturedToday: communications.filter(
      (entry) => entry.capturedAt.slice(0, 10) === today,
    ).length,
    unlinkedGroups: groupUnlinked(board),
    communications: board,
    health,
    cases: cases.map((entry) => ({
      clientId: entry.client.id,
      caseId: entry.record.id,
      label: caseLabel(entry),
    })),
    signatureVerified: DJEN_SIGNATURE.verifiedLive,
    signatureNote: signatureNoteOf(),
    monitoredLabels: activeOabs().map((entry) => entry.label),
  };
}

export type PublicationDay = {
  day: string;
  publications: number;
  highlighted?: boolean;
};

/*
 * How many acts the office captured on each of the last days, counted from the
 * communications themselves. A day with no capture is a zero and appears as
 * one, because a missing bar and a bar of height zero say very different things
 * to whoever reads the panel looking for a silent failure.
 */
export async function dailyPublications(
  days: number,
  now: Date = new Date(),
): Promise<PublicationDay[]> {
  const communications = await listCommunications();
  const counts = new Map<string, number>();
  for (const communication of communications) {
    counts.set(
      communication.availableOn,
      (counts.get(communication.availableOn) ?? 0) + 1,
    );
  }

  const out: PublicationDay[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - back);
    const iso = date.toISOString().slice(0, 10);
    const publications = counts.get(iso) ?? 0;
    out.push({
      day: String(date.getDate()),
      publications,
      /* The day being lived is the one the office is deciding about today. */
      ...(back === 0 ? { highlighted: true } : {}),
    });
  }
  return out;
}
