"use client";

import {
  ArrowsClockwise,
  BellRinging,
  CalendarCheck,
  CheckSquare,
  Clock,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { secondaryButtonClasses } from "@/components/ui/form-field";
import {
  type CaptureActionResult,
  confirmDeadlineAction,
  fetchCaseMovementsAction,
  type MovementsResult,
  markReminderDoneAction,
  setTaskStateAction,
} from "@/lib/capture-actions";
import type {
  CaseDeadline,
  CaseEvent,
  CaseReminder,
  CaseTask,
} from "@/lib/case-domain";

/*
 * What a captured act left inside this case: the deadline with its whole chain
 * of dates open for checking, the appointments, the reminders addressed to the
 * lawyer and the tasks the act suggested.
 *
 * The deadline has two states and only a lawyer moves it from one to the other.
 * There is no control here, and there is no code path anywhere, that confirms a
 * deadline without a person pressing it.
 */

function brDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function dateTimeLabel(iso: string | null): string {
  if (iso === null) {
    return "";
  }
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`;
}

const TASK_STATES: Record<CaseTask["state"], string> = {
  suggested: "Sugerida pela captura",
  accepted: "Aceita",
  done: "Concluída",
  dismissed: "Descartada",
};

export function CaseCaptureRecords({
  clientId,
  caseId,
  deadlines,
  tasks,
  events,
  reminders,
  lawsuitNumber,
}: {
  clientId: string;
  caseId: string;
  deadlines: CaseDeadline[];
  tasks: CaseTask[];
  events: CaseEvent[];
  reminders: CaseReminder[];
  lawsuitNumber: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<CaptureActionResult | null>(null);
  const [movements, setMovements] = useState<MovementsResult | null>(null);

  function run(action: () => Promise<CaptureActionResult>) {
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      router.refresh();
    });
  }

  if (
    deadlines.length === 0 &&
    tasks.length === 0 &&
    events.length === 0 &&
    reminders.length === 0 &&
    lawsuitNumber === null
  ) {
    return null;
  }

  return (
    <section
      aria-labelledby="case-capture-heading"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Clock aria-hidden size={18} weight="bold" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink" id="case-capture-heading">
            Prazos, compromissos e tarefas deste caso
          </h2>
          <p className="text-sm text-ink-soft">
            Cada registro nasceu de uma intimação publicada, e o texto do ato
            fica guardado íntegro. Prazo calculado não é prazo confirmado.
          </p>
        </div>
      </header>

      {feedback === null ? null : (
        <p
          className="rounded-md bg-inset px-4 py-3 text-sm text-ink"
          role="status"
        >
          {feedback.message}
        </p>
      )}

      {deadlines.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-ink">Prazos</h3>
          <ul className="flex flex-col divide-y divide-line">
            {deadlines.map((deadline) => (
              <li
                className="flex flex-col gap-2 py-3 first:pt-0"
                key={deadline.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{deadline.label}</p>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${deadline.state === "confirmed" ? "bg-neutral-soft text-ink" : "bg-attention-soft text-ink"}`}
                  >
                    {deadline.state === "confirmed"
                      ? "Confirmado"
                      : "Calculado, pendente de confirmação"}
                  </span>
                </div>
                <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink">
                  <li>Disponibilização: {brDate(deadline.availableOn)}</li>
                  <li>Publicação: {brDate(deadline.publishedOn)}</li>
                  <li>Início da contagem: {brDate(deadline.startsOn)}</li>
                  <li>
                    {deadline.days}{" "}
                    {deadline.countedInBusinessDays
                      ? deadline.days === 1
                        ? "dia útil"
                        : "dias úteis"
                      : "dias corridos"}
                  </li>
                  <li className="font-bold">
                    Vencimento: {brDate(deadline.dueOn)}
                  </li>
                </ol>
                {deadline.skipped.length === 0 ? null : (
                  <p className="text-xs text-ink-soft">
                    Dias não contados:{" "}
                    {deadline.skipped
                      .map((day) => `${brDate(day.date)} (${day.reason})`)
                      .join("; ")}
                    .
                  </p>
                )}
                <p className="text-xs text-ink-soft">
                  Fundamento: {deadline.legalSources.join("; ")}.
                </p>
                {deadline.warnings.map((warning) => (
                  <p className="text-xs text-ink-soft" key={warning}>
                    {warning}
                  </p>
                ))}
                {deadline.state === "confirmed" ? (
                  <p className="text-xs text-ink-soft">
                    Confirmado por {deadline.confirmedBy} em{" "}
                    {dateTimeLabel(deadline.confirmedAt)}.
                  </p>
                ) : (
                  <button
                    className={secondaryButtonClasses}
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        confirmDeadlineAction(clientId, caseId, deadline.id),
                      )
                    }
                    type="button"
                  >
                    <CalendarCheck aria-hidden size={14} weight="bold" />
                    Confirmar este prazo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {events.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-ink">
            Compromissos designados
          </h3>
          <ul className="flex flex-col divide-y divide-line">
            {events.map((event) => (
              <li
                className="flex flex-col gap-1 py-3 first:pt-0"
                key={event.id}
              >
                <p className="text-sm font-bold text-ink">
                  {event.kind} em {brDate(event.date)}
                  {event.time === null ? "" : `, às ${event.time}`}
                </p>
                {event.place === null ? null : (
                  <p className="text-xs text-ink">Local: {event.place}</p>
                )}
                <p className="text-xs text-ink-soft">{event.origin.excerpt}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reminders.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-ink">
            Lembretes para o advogado
          </h3>
          <ul className="flex flex-col divide-y divide-line">
            {reminders.map((reminder) => (
              <li
                className="flex flex-col gap-2 py-3 first:pt-0"
                key={reminder.id}
              >
                <p className="flex items-center gap-2 text-sm text-ink">
                  <BellRinging aria-hidden size={16} weight="bold" />
                  {brDate(reminder.remindOn)}, para {reminder.forLawyer}
                </p>
                <p className="text-xs text-ink">{reminder.message}</p>
                {reminder.state === "done" ? (
                  <p className="text-xs text-ink-soft">
                    Cumprido por {reminder.doneBy} em{" "}
                    {dateTimeLabel(reminder.doneAt)}.
                  </p>
                ) : (
                  <button
                    className={secondaryButtonClasses}
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        markReminderDoneAction(clientId, caseId, reminder.id),
                      )
                    }
                    type="button"
                  >
                    <CheckSquare aria-hidden size={14} weight="bold" />
                    Marcar como cumprido
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lawsuitNumber === null ? null : (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-ink">
            Movimentações do processo
          </h3>
          <p className="text-xs text-ink-soft">
            Consulta ao DataJud, base de metadados do Conselho Nacional de
            Justiça, pelo número {lawsuitNumber}. Serve para acompanhar o
            processo e jamais é fonte de prazo, porque cada tribunal envia em
            cadência própria e o que chega aqui está sempre atrás do tribunal.
          </p>
          <div>
            <button
              className={secondaryButtonClasses}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await fetchCaseMovementsAction(
                    clientId,
                    caseId,
                  );
                  setMovements(result);
                  router.refresh();
                })
              }
              type="button"
            >
              <ArrowsClockwise aria-hidden size={14} weight="bold" />
              {pending ? "Consultando" : "Consultar movimentações"}
            </button>
          </div>
          {movements === null ? null : (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-ink">{movements.message}</p>
              {movements.movements.length === 0 ? null : (
                <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md bg-inset p-3">
                  {movements.movements.map((movement) => (
                    <li
                      className="text-xs text-ink"
                      key={`${movement.at}-${movement.name}`}
                    >
                      {movement.at === null
                        ? "sem data"
                        : brDate(movement.at.slice(0, 10))}
                      , {movement.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tasks.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-ink">Tarefas</h3>
          <ul className="flex flex-col divide-y divide-line">
            {tasks.map((task) => (
              <li className="flex flex-col gap-2 py-3 first:pt-0" key={task.id}>
                <p className="text-sm font-bold text-ink">{task.title}</p>
                <p className="text-xs text-ink">{task.detail}</p>
                <p className="text-xs text-ink-soft">
                  {TASK_STATES[task.state]}, responsável {task.responsible}
                  {task.internalDueOn === null
                    ? ""
                    : `, prazo interno em ${brDate(task.internalDueOn)}`}
                  .
                </p>
                {task.state === "suggested" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={secondaryButtonClasses}
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          setTaskStateAction(
                            clientId,
                            caseId,
                            task.id,
                            "accepted",
                          ),
                        )
                      }
                      type="button"
                    >
                      Aceitar tarefa
                    </button>
                    <button
                      className={secondaryButtonClasses}
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          setTaskStateAction(
                            clientId,
                            caseId,
                            task.id,
                            "dismissed",
                          ),
                        )
                      }
                      type="button"
                    >
                      Descartar
                    </button>
                  </div>
                ) : task.state === "accepted" ? (
                  <button
                    className={secondaryButtonClasses}
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        setTaskStateAction(clientId, caseId, task.id, "done"),
                      )
                    }
                    type="button"
                  >
                    Concluir tarefa
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
