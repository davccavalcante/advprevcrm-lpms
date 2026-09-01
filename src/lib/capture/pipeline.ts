import { ulid } from "ulid";
import type { Communication } from "@/lib/capture/communication";
import { extractAct } from "@/lib/capture/extraction";
import type {
  CaseDeadline,
  CaseEvent,
  CaseReminder,
  CaseTask,
  ClientNotice,
  StoredCase,
  StoredClient,
} from "@/lib/case-domain";
import { addDays, brDate, isBusinessDay } from "@/lib/deadlines/calendar";
import { calculateDeadline } from "@/lib/deadlines/procedural";

/*
 * What one linked communication becomes inside the case.
 *
 * A deadline, always in the state `calculated`, with the whole chain of dates
 * open for the lawyer to check. An event in the agenda when the act designates
 * an expert examination or a hearing. A notice on the client record, which is
 * the page the LAWYER opens, because the client has no login and receives
 * nothing from this system. A reminder addressed to the lawyer on the day
 * before, so that he remembers to warn that client. And a task, suggested and
 * never accepted on anybody's behalf.
 *
 * Nothing here decides. The deadline is not confirmed, the task is not accepted,
 * and no message leaves the office.
 */

function marginDays(): number {
  const raw = process.env.TASK_INTERNAL_MARGIN_BUSINESS_DAYS?.trim();
  const value = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 2;
}

/* The title of the task the act asks for. The object of the act is what names
 * it, so the lawyer reads a task written the way he would have written it. */
const TASK_TITLES: Record<string, string> = {
  "Manifestação sobre laudo": "Fazer manifestação sobre laudo",
  "Manifestação sobre outras provas": "Fazer manifestação sobre outras provas",
  Réplica: "Apresentar réplica",
  Contestação: "Apresentar contestação",
  "Embargos de declaração": "Opor embargos de declaração",
  "Recurso inominado": "Interpor recurso inominado",
  "Cumprimento de sentença": "Providenciar o cumprimento de sentença",
  "Apresentação de documentos": "Juntar os documentos exigidos",
};

export type AppliedRecords = {
  deadline: CaseDeadline | null;
  event: CaseEvent | null;
  notice: ClientNotice | null;
  reminder: CaseReminder | null;
  task: CaseTask | null;
  note: string;
};

function originOf(communication: Communication, excerpt: string) {
  return {
    communicationId: communication.id,
    certificateCode: communication.certificateCode,
    certificateUrl: communication.certificateUrl,
    availableOn: communication.availableOn,
    excerpt: excerpt.slice(0, 400),
  };
}

/*
 * Builds every record a communication produces. It touches no disk: what it
 * returns is written by the caller, so the same function is exercised by a test
 * without a store behind it.
 */
export function applyCommunication(input: {
  communication: Communication;
  record: StoredCase;
  client: StoredClient;
  now: Date;
}): AppliedRecords {
  const { communication, record, client } = input;
  const createdAt = input.now.toISOString();
  const extraction =
    communication.extraction ??
    extractAct({
      text: communication.text,
      documentType: communication.documentType,
    });

  const labour = record.sphere === "labor";
  const court = communication.tribunalSigla;

  let deadline: CaseDeadline | null = null;
  if (extraction.days !== null) {
    const calculated = calculateDeadline({
      availableOn: communication.availableOn,
      days: extraction.days,
      regime: "procedural",
      labour,
      court,
    });
    if (calculated.ok) {
      deadline = {
        id: ulid(),
        label:
          extraction.object === null
            ? `Prazo de ${extraction.days} dias úteis`
            : `${extraction.object}, ${extraction.days} dias úteis`,
        regime: calculated.regime,
        availableOn: calculated.availableOn,
        publishedOn: calculated.publishedOn,
        startsOn: calculated.startsOn,
        dueOn: calculated.dueOn,
        days: calculated.days,
        countedInBusinessDays: calculated.countedInBusinessDays,
        court: calculated.court,
        calendarReviewed: calculated.calendarReviewed,
        warnings: calculated.warnings,
        skipped: calculated.skipped,
        legalSources: [...new Set(calculated.steps.map((step) => step.source))],
        state: "calculated",
        confirmedBy: null,
        confirmedAt: null,
        createdAt,
        origin: originOf(communication, extraction.daysSource ?? ""),
      };
    }
  }

  let event: CaseEvent | null = null;
  let notice: ClientNotice | null = null;
  let reminder: CaseReminder | null = null;
  const appointment = extraction.appointment;
  if (appointment !== null && appointment.date !== null) {
    event = {
      id: ulid(),
      kind: appointment.kind,
      title: `${appointment.kind} designada${appointment.time === null ? "" : `, ${appointment.time}`}`,
      date: appointment.date,
      time: appointment.time,
      place: appointment.place,
      createdAt,
      origin: originOf(communication, appointment.source),
    };

    const whenLabel = [
      `dia ${brDate(appointment.date)}`,
      appointment.time === null ? null : `às ${appointment.time}`,
    ]
      .filter((part) => part !== null)
      .join(", ");

    notice = {
      id: ulid(),
      caseId: record.id,
      kind: appointment.kind,
      title: `${appointment.kind} designada para ${whenLabel}`,
      body: [
        `${appointment.kind} designada no processo ${communication.processNumberLabel ?? "sem número identificado"}, ${record.caseType}.`,
        `Data e hora: ${whenLabel}.`,
        appointment.place === null
          ? "Local não identificado no ato. Confira no texto integral da comunicação."
          : `Local: ${appointment.place}.`,
        "Aviso interno, na ficha que o advogado abre. Nesta fase o sistema não envia mensagem nem correio eletrônico ao cliente.",
      ].join(" "),
      eventDate: appointment.date,
      eventTime: appointment.time,
      place: appointment.place,
      createdAt,
      origin: originOf(communication, appointment.source),
    };

    reminder = {
      id: ulid(),
      forLawyer: record.responsibleLawyer,
      remindOn: addDays(appointment.date, -1),
      message: `Avisar ${client.fullName} sobre a ${appointment.kind.toLowerCase()} de amanhã, ${whenLabel}, no processo ${communication.processNumberLabel ?? "sem número identificado"}${appointment.place === null ? "" : `, em ${appointment.place}`}. Lembrete para o advogado; o sistema não fala com o cliente.`,
      eventId: event.id,
      state: "pending",
      createdAt,
      doneBy: null,
      doneAt: null,
      origin: originOf(communication, appointment.source),
    };
  }

  let task: CaseTask | null = null;
  if (deadline !== null) {
    const title =
      extraction.object === null
        ? "Cumprir o ato do prazo publicado"
        : (TASK_TITLES[extraction.object] ??
          `Providenciar: ${extraction.object.toLowerCase()}`);
    task = {
      id: ulid(),
      title,
      detail: [
        extraction.actType === null ? null : `Ato: ${extraction.actType}.`,
        `Prazo calculado com vencimento em ${brDate(deadline.dueOn)}, ainda não confirmado por advogado.`,
      ]
        .filter((part) => part !== null)
        .join(" "),
      state: "suggested",
      responsible: record.responsibleLawyer,
      internalDueOn: internalDueDate(deadline.dueOn, court),
      deadlineId: deadline.id,
      createdAt,
      decidedBy: null,
      decidedAt: null,
      origin: originOf(communication, extraction.objectSource ?? ""),
    };
  }

  const produced = [
    deadline === null ? null : "prazo calculado",
    event === null ? null : "evento na agenda",
    notice === null ? null : "aviso na ficha do cliente",
    reminder === null ? null : "lembrete para o advogado",
    task === null ? null : "tarefa sugerida",
  ].filter((part) => part !== null);

  return {
    deadline,
    event,
    notice,
    reminder,
    task,
    /* What the rule could not decide is named, never left implicit. An act that
     * carries two divergent deadlines produces none, by the constitution, and
     * the lawyer has to read here that this is why. */
    note: [
      produced.length === 0
        ? "Nenhuma obrigação processual foi reconhecida por regra neste ato. A comunicação fica registrada íntegra e o advogado decide."
        : `Gerados: ${produced.join(", ")}.`,
      extraction.residue.length === 0
        ? null
        : `Para decisão do advogado: ${extraction.residue.join("; ")}.`,
    ]
      .filter((part) => part !== null)
      .join(" "),
  };
}

/*
 * The internal deadline of the office: some business days before the legal one,
 * so the work is not started on the day it is due. The margin is configuration,
 * never a number decided inside a function.
 */
function internalDueDate(dueOn: string, court: string | null): string {
  const margin = marginDays();
  let cursor = dueOn;
  let moved = 0;
  /* Backwards through business days of the same calendar the legal deadline
   * used, so the margin is real working time and not a subtraction of dates. */
  while (moved < margin) {
    cursor = addDays(cursor, -1);
    if (isBusinessDay(cursor, { court })) {
      moved += 1;
    }
  }
  return cursor;
}
