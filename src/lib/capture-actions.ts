"use server";

import { revalidatePath } from "next/cache";
import { fetchDatajudCase } from "@/lib/capture/datajud-client";
import { applyCommunication } from "@/lib/capture/pipeline";
import {
  canonicalProcessNumber,
  formatProcessNumber,
} from "@/lib/capture/process-number";
import { runDjenCapture } from "@/lib/capture/runner";
import { recordRun } from "@/lib/capture/runs";
import {
  listCommunications,
  readCommunication,
  updateCommunication,
} from "@/lib/capture/store";
import type { CaseTask } from "@/lib/case-domain";
import {
  appendCaseRecords,
  appendClientNotice,
  confirmDeadline,
  readCase,
  readClient,
  setLawsuitNumber,
  setReminderDone,
  setTaskState,
} from "@/lib/records-store";

/*
 * The only writes the capture is allowed to make, and every one of them either
 * comes from a rule with no room for judgement or from a human act with a name
 * attached.
 *
 * What automation may do: store a communication whole, read it by rule, link it
 * when the process number matches, and produce a deadline in the state
 * `calculated`, an event, a notice, a reminder and a suggested task.
 *
 * What only a person may do: link by name, confirm a deadline, accept a task,
 * and mark a reminder as done.
 */

const OPERATOR = "Mendelsson Sandrini Alves Maciel";

export type CaptureActionResult = { ok: boolean; message: string };

export async function runCaptureAction(): Promise<CaptureActionResult> {
  const outcome = await runDjenCapture();
  if (!outcome.ok) {
    return {
      ok: false,
      message: `A consulta ao DJEN não foi concluída. ${outcome.reason ?? "Motivo não informado pela fonte."}`,
    };
  }
  return {
    ok: true,
    message: `Consulta concluída: ${outcome.found} comunicações recuperadas, ${outcome.stored} novas, ${outcome.duplicates} já conhecidas, ${outcome.linked} vinculadas pelo número do processo, ${outcome.suggested} com sugestão de vínculo e ${outcome.unlinked} sem vínculo.`,
  };
}

/*
 * Turns one linked communication into the records of the case. Runs once: a
 * communication already applied is never applied again, which is what keeps a
 * second click from creating a second deadline for the same act.
 */
export async function applyCommunicationAction(
  communicationId: string,
): Promise<CaptureActionResult> {
  const communication = await readCommunication(communicationId);
  if (communication === null) {
    return { ok: false, message: "Comunicação não encontrada." };
  }
  if (communication.link === null) {
    return {
      ok: false,
      message:
        "Esta comunicação ainda não está vinculada a um caso. Confirme o vínculo antes.",
    };
  }
  if (communication.appliedAt !== null) {
    return {
      ok: false,
      message:
        "Esta comunicação já foi aplicada ao caso e não é aplicada duas vezes.",
    };
  }

  const record = await readCase(
    communication.link.clientId,
    communication.link.caseId,
  );
  const client = await readClient(communication.link.clientId);
  if (record === null || client === null) {
    return { ok: false, message: "O caso vinculado não foi encontrado." };
  }

  const produced = applyCommunication({
    communication,
    record,
    client,
    now: new Date(),
  });

  await appendCaseRecords(record.clientId, record.id, {
    deadline: produced.deadline,
    event: produced.event,
    task: produced.task,
    reminder: produced.reminder,
  });
  if (produced.notice !== null) {
    await appendClientNotice(client.id, produced.notice);
  }
  await updateCommunication(communicationId, (current) => ({
    ...current,
    appliedAt: new Date().toISOString(),
    appliedNote: produced.note,
  }));

  revalidatePath(`/cases/${record.clientId}/${record.id}`);
  revalidatePath(`/casos/${record.clientId}/${record.id}`);
  revalidatePath(`/clients/${client.id}`);
  revalidatePath(`/clientes/${client.id}`);
  revalidatePath("/judicial");
  return { ok: true, message: produced.note };
}

/*
 * The human confirmation of a link. By name it is the only way there is, and the
 * number of the process is written on the case at the same moment, so every
 * later act of that process finds this case by itself.
 */
export async function linkCommunicationAction(
  communicationId: string,
  clientId: string,
  caseId: string,
): Promise<CaptureActionResult> {
  const communication = await readCommunication(communicationId);
  if (communication === null) {
    return { ok: false, message: "Comunicação não encontrada." };
  }
  const record = await readCase(clientId, caseId);
  if (record === null) {
    return { ok: false, message: "Caso não encontrado." };
  }

  await updateCommunication(communicationId, (current) => ({
    ...current,
    link: {
      clientId,
      caseId,
      method: "human",
      linkedAt: new Date().toISOString(),
      linkedBy: OPERATOR,
    },
    suggestions: [],
  }));

  const number = communication.processNumber;
  if (
    number !== null &&
    (record.lawsuitNumber === undefined ||
      canonicalProcessNumber(record.lawsuitNumber ?? "") !== number)
  ) {
    await setLawsuitNumber(
      clientId,
      caseId,
      formatProcessNumber(number) ?? number,
    );
  }

  revalidatePath("/judicial");
  revalidatePath(`/cases/${clientId}/${caseId}`);
  revalidatePath(`/casos/${clientId}/${caseId}`);
  return {
    ok: true,
    message:
      number === null
        ? "Vínculo confirmado."
        : "Vínculo confirmado e número do processo gravado no caso. As próximas comunicações deste processo vão casar sozinhas.",
  };
}

export async function confirmDeadlineAction(
  clientId: string,
  caseId: string,
  deadlineId: string,
): Promise<CaptureActionResult> {
  const updated = await confirmDeadline(clientId, caseId, deadlineId, OPERATOR);
  if (updated === null) {
    return { ok: false, message: "Caso não encontrado." };
  }
  revalidatePath(`/cases/${clientId}/${caseId}`);
  revalidatePath(`/casos/${clientId}/${caseId}`);
  return {
    ok: true,
    message: `Prazo confirmado por ${OPERATOR}, com data e hora registradas.`,
  };
}

export async function setTaskStateAction(
  clientId: string,
  caseId: string,
  taskId: string,
  state: CaseTask["state"],
): Promise<CaptureActionResult> {
  const updated = await setTaskState(clientId, caseId, taskId, state, OPERATOR);
  if (updated === null) {
    return { ok: false, message: "Caso não encontrado." };
  }
  revalidatePath(`/cases/${clientId}/${caseId}`);
  revalidatePath(`/casos/${clientId}/${caseId}`);
  return { ok: true, message: "Situação da tarefa atualizada." };
}

export async function markReminderDoneAction(
  clientId: string,
  caseId: string,
  reminderId: string,
): Promise<CaptureActionResult> {
  const updated = await setReminderDone(clientId, caseId, reminderId, OPERATOR);
  if (updated === null) {
    return { ok: false, message: "Caso não encontrado." };
  }
  revalidatePath(`/cases/${clientId}/${caseId}`);
  revalidatePath(`/casos/${clientId}/${caseId}`);
  return { ok: true, message: "Lembrete marcado como cumprido." };
}

export type MovementsResult = {
  ok: boolean;
  message: string;
  endpoint: string | null;
  movements: { name: string; at: string | null }[];
  lastUpdateAt: string | null;
};

/*
 * The complement by movements, and only that. The DataJud carries procedural
 * metadata, never the text of a service notice, so nothing here produces a
 * deadline: it is what the office reads to know what happened in the process,
 * with the delay each court sends its data with.
 */
export async function fetchCaseMovementsAction(
  clientId: string,
  caseId: string,
): Promise<MovementsResult> {
  const record = await readCase(clientId, caseId);
  const empty = { movements: [], endpoint: null, lastUpdateAt: null };
  if (record === null) {
    return { ok: false, message: "Caso não encontrado.", ...empty };
  }
  const number = record.lawsuitNumber?.trim();
  if (number === undefined || number.length === 0) {
    return {
      ok: false,
      message:
        "Este caso não tem número de processo cadastrado, então não há o que consultar no DataJud.",
      ...empty,
    };
  }

  const startedAt = new Date().toISOString();
  const result = await fetchDatajudCase(number);
  const first = result.ok ? result.cases[0] : undefined;
  await recordRun({
    source: "datajud",
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: result.ok,
    attempts: 1,
    query: `processo ${number}`,
    status: result.ok ? 200 : result.status,
    reason: result.ok ? null : result.reason,
    found: result.ok ? result.found : 0,
    stored: 0,
    duplicates: 0,
    linked: 0,
    suggested: 0,
    unlinked: 0,
  });
  revalidatePath("/");

  if (!result.ok) {
    return {
      ok: false,
      message: result.reason,
      ...empty,
      endpoint: result.endpoint,
    };
  }
  if (first === undefined) {
    return {
      ok: true,
      message:
        "O DataJud não trouxe este processo. Cada tribunal envia em cadência própria, e a ausência aqui não significa ausência no tribunal.",
      ...empty,
      endpoint: result.endpoint,
    };
  }
  return {
    ok: true,
    message: `${first.movements.length} movimentações recuperadas. O DataJud é acompanhamento e nunca fonte de prazo.`,
    endpoint: result.endpoint,
    lastUpdateAt: first.lastUpdateAt,
    movements: first.movements.map((movement) => ({
      name: movement.name,
      at: movement.at,
    })),
  };
}

/*
 * The link of a whole process at once, which is how a lawyer actually thinks:
 * he does not decide act by act, he decides that this process belongs to that
 * case. Every act of the process that is still unlinked is linked, the number is
 * written on the case, and from then on the acts of that process match by
 * themselves.
 */
export async function linkProcessAction(
  processNumber: string,
  clientId: string,
  caseId: string,
): Promise<CaptureActionResult> {
  const canonical = canonicalProcessNumber(processNumber);
  if (canonical === null) {
    return { ok: false, message: "Número de processo inválido." };
  }
  const record = await readCase(clientId, caseId);
  if (record === null) {
    return { ok: false, message: "Caso não encontrado." };
  }

  const all = await listCommunications();
  const targets = all.filter(
    (entry) => entry.processNumber === canonical && entry.link === null,
  );
  const at = new Date().toISOString();
  for (const entry of targets) {
    await updateCommunication(entry.id, (current) => ({
      ...current,
      link: {
        clientId,
        caseId,
        method: "human",
        linkedAt: at,
        linkedBy: OPERATOR,
      },
      suggestions: [],
    }));
  }
  await setLawsuitNumber(
    clientId,
    caseId,
    formatProcessNumber(canonical) ?? canonical,
  );

  revalidatePath("/judicial");
  revalidatePath(`/cases/${clientId}/${caseId}`);
  revalidatePath(`/casos/${clientId}/${caseId}`);
  return {
    ok: true,
    message: `${targets.length === 1 ? "Uma comunicação vinculada" : `${targets.length} comunicações vinculadas`} ao caso, e o número do processo foi gravado nele. As próximas comunicações deste processo passam a casar sozinhas.`,
  };
}
