"use client";

import {
  ArrowClockwise,
  CheckCircle,
  LinkSimple,
  Warning,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { secondaryButtonClasses } from "@/components/ui/form-field";
import {
  applyCommunicationAction,
  type CaptureActionResult,
  linkProcessAction,
  runCaptureAction,
} from "@/lib/capture-actions";

/*
 * The publications board. It is the queue of everything the office captured from
 * the Diário de Justiça Eletrônico Nacional, with the unlinked ones on top,
 * because a communication that matched no case is the one that can be lost.
 *
 * Nothing here is decided by the screen. Linking by name is a human act, and so
 * is applying a communication to a case.
 */

export type BoardCommunication = {
  id: string;
  availableOn: string;
  processNumberLabel: string | null;
  tribunalSigla: string | null;
  courtName: string | null;
  documentType: string | null;
  actType: string | null;
  object: string | null;
  days: number | null;
  appointmentLabel: string | null;
  residue: string[];
  fullyDeterministic: boolean;
  monitoredOab: string;
  recipients: string[];
  certificateUrl: string | null;
  textExcerpt: string;
  linked: {
    clientId: string;
    caseId: string;
    label: string;
    method: string;
  } | null;
  suggestions: {
    clientId: string;
    caseId: string;
    clientName: string;
    caseLabel: string;
    score: number;
    reason: string;
  }[];
  appliedAt: string | null;
  appliedNote: string | null;
};

export type BoardProcessGroup = {
  processNumberLabel: string;
  tribunalSigla: string | null;
  courtName: string | null;
  recipients: string[];
  firstAvailableOn: string;
  lastAvailableOn: string;
  withDeadline: number;
  suggestions: BoardCommunication["suggestions"];
  communications: BoardCommunication[];
};

export type BoardHealth = {
  source: string;
  label: string;
  role: string;
  statusLabel: string;
  healthy: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastResult: string | null;
};

export type BoardCase = {
  clientId: string;
  caseId: string;
  label: string;
};

function dateTimeLabel(iso: string | null): string {
  if (iso === null) {
    return "nunca";
  }
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`;
}

function brDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/* How many processes the queue opens with. Everything above it is reachable in
 * one click, and the screen says how many are hidden: a silent cap would read as
 * "there is nothing else", which is exactly how a deadline is lost. */
const FIRST_PAGE = 12;

export function CaptureBoard({
  communications,
  unlinkedGroups,
  health,
  cases,
  signatureVerified,
  signatureNote,
  monitoredLabels,
}: {
  communications: BoardCommunication[];
  unlinkedGroups: BoardProcessGroup[];
  health: BoardHealth[];
  cases: BoardCase[];
  signatureVerified: boolean;
  signatureNote: string;
  monitoredLabels: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<CaptureActionResult | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  function run(action: () => Promise<CaptureActionResult>) {
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      router.refresh();
    });
  }

  const linked = communications.filter((entry) => entry.linked !== null);
  const needle = filter.trim().toLowerCase();
  const matching =
    needle.length === 0
      ? unlinkedGroups
      : unlinkedGroups.filter((group) =>
          [
            group.processNumberLabel,
            group.tribunalSigla ?? "",
            group.courtName ?? "",
            group.recipients.join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        );
  const shown = showAll ? matching : matching.slice(0, FIRST_PAGE);
  const unlinkedCount = unlinkedGroups.reduce(
    (total, group) => total + group.communications.length,
    0,
  );

  return (
    <section
      aria-labelledby="capture-board-heading"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
      id="publicacoes"
    >
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="text-lg font-bold text-ink" id="capture-board-heading">
            Publicações e intimações
          </h2>
          <p className="text-sm text-ink-soft">
            Capturadas no Diário de Justiça Eletrônico Nacional pelas inscrições
            monitoradas {monitoredLabels.join(", ")}. O texto do ato é gravado
            íntegro e é dele que nasce o prazo.
          </p>
        </div>
        <button
          className={secondaryButtonClasses}
          disabled={pending}
          onClick={() => run(runCaptureAction)}
          type="button"
        >
          <ArrowClockwise aria-hidden size={16} weight="bold" />
          {pending ? "Consultando" : "Consultar o DJEN agora"}
        </button>
      </header>

      <p
        className={`flex items-start gap-2 rounded-md px-4 py-3 text-sm text-ink ${signatureVerified ? "bg-inset" : "bg-attention-soft"}`}
      >
        {signatureVerified ? (
          <CheckCircle
            aria-hidden
            className="mt-0.5 shrink-0"
            size={16}
            weight="bold"
          />
        ) : (
          <Warning
            aria-hidden
            className="mt-0.5 shrink-0"
            size={16}
            weight="bold"
          />
        )}
        <span>{signatureNote}</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {health.map((source) => (
          <article
            className="flex flex-col gap-1 rounded-md border border-line bg-inset p-4"
            key={source.source}
          >
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              {source.healthy ? (
                <CheckCircle aria-hidden size={16} weight="bold" />
              ) : (
                <Warning aria-hidden size={16} weight="bold" />
              )}
              {source.label}
            </p>
            <p className="text-xs text-ink-soft">{source.role}</p>
            <p className="text-xs text-ink">
              {source.statusLabel}. Última execução em{" "}
              {dateTimeLabel(source.lastRunAt)}; última captura bem-sucedida em{" "}
              {dateTimeLabel(source.lastSuccessAt)}.
            </p>
            {source.lastResult === null ? null : (
              <p className="text-xs text-ink-soft">{source.lastResult}</p>
            )}
          </article>
        ))}
      </div>

      {feedback === null ? null : (
        <p
          className={`rounded-md px-4 py-3 text-sm text-ink ${feedback.ok ? "bg-inset" : "bg-attention-soft"}`}
          role="status"
        >
          {feedback.message}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">
            Fila de não vinculadas, {unlinkedGroups.length}{" "}
            {unlinkedGroups.length === 1 ? "processo" : "processos"},{" "}
            {unlinkedCount}{" "}
            {unlinkedCount === 1 ? "comunicação" : "comunicações"}
          </h3>
          <p className="text-xs text-ink-soft">
            Vincule uma vez por processo. Feito isso, o número fica no caso e as
            próximas comunicações casam sozinhas.
          </p>
        </div>

        {unlinkedGroups.length === 0 ? (
          <p className="rounded-md bg-inset p-4 text-sm text-ink">
            Nenhuma comunicação aguardando vínculo. Comunicação que não casa com
            caso algum fica aqui, sempre visível, e nunca é descartada.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="filtro-fila">
                Filtrar a fila por processo, cliente ou tribunal
              </label>
              <input
                className="min-w-0 flex-1 basis-64 rounded-md border border-line bg-inset px-3 py-2 text-sm text-ink"
                id="filtro-fila"
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filtrar por número do processo, cliente ou tribunal"
                type="search"
                value={filter}
              />
              <p aria-live="polite" className="text-xs text-ink-soft">
                Mostrando {shown.length} de {matching.length}
                {needle.length > 0
                  ? ` que atendem ao filtro, de ${unlinkedGroups.length} no total`
                  : " processos"}
                .
              </p>
              {matching.length > shown.length || showAll ? (
                <button
                  className={secondaryButtonClasses}
                  onClick={() => setShowAll((value) => !value)}
                  type="button"
                >
                  {showAll ? "Mostrar menos" : "Mostrar todos"}
                </button>
              ) : null}
            </div>

            <ol className="flex flex-col divide-y divide-line">
              {shown.map((group) => {
                const expanded = open[group.processNumberLabel] === true;
                const head = group.communications[0];
                return (
                  <li
                    className="flex flex-col gap-2 py-4 first:pt-0"
                    key={group.processNumberLabel}
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-bold text-ink">
                        {group.processNumberLabel}
                        {group.tribunalSigla === null
                          ? ""
                          : `, ${group.tribunalSigla}`}
                        {group.courtName === null ? "" : `, ${group.courtName}`}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {group.recipients.length === 0
                          ? "Destinatário não identificado"
                          : `Destinatário: ${group.recipients.join(", ")}`}
                        .{" "}
                        {group.communications.length === 1
                          ? "1 comunicação"
                          : `${group.communications.length} comunicações`}
                        , de {brDate(group.firstAvailableOn)} a{" "}
                        {brDate(group.lastAvailableOn)}
                        {group.withDeadline === 0
                          ? ", nenhuma com prazo reconhecido"
                          : `, ${group.withDeadline} com prazo reconhecido`}
                        .
                      </p>
                      {head === undefined ? null : (
                        <p className="text-xs text-ink">
                          Ato mais recente: {brDate(head.availableOn)}
                          {head.actType === null ? "" : `, ${head.actType}`}
                          {head.object === null ? "" : `, ${head.object}`}
                          {head.days === null
                            ? ""
                            : `, prazo de ${head.days} dias`}
                          .
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className="text-xs font-semibold text-ink-soft"
                        htmlFor={`caso-${group.processNumberLabel}`}
                      >
                        Vincular este processo ao caso
                      </label>
                      <select
                        className="min-w-0 max-w-full flex-1 basis-56 truncate rounded-md border border-line bg-inset px-3 py-2 text-xs text-ink"
                        disabled={pending || cases.length === 0}
                        id={`caso-${group.processNumberLabel}`}
                        onChange={(event) =>
                          setChoice((current) => ({
                            ...current,
                            [group.processNumberLabel]: event.target.value,
                          }))
                        }
                        value={choice[group.processNumberLabel] ?? ""}
                      >
                        <option value="">Escolha um caso</option>
                        {cases.map((option) => (
                          <option
                            key={`${group.processNumberLabel}-${option.caseId}`}
                            value={`${option.clientId}:${option.caseId}`}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        className={secondaryButtonClasses}
                        disabled={pending || !choice[group.processNumberLabel]}
                        onClick={() => {
                          const value = choice[group.processNumberLabel];
                          if (value === undefined) {
                            return;
                          }
                          const [clientId, caseId] = value.split(":");
                          if (clientId === undefined || caseId === undefined) {
                            return;
                          }
                          run(() =>
                            linkProcessAction(
                              group.processNumberLabel,
                              clientId,
                              caseId,
                            ),
                          );
                        }}
                        type="button"
                      >
                        <LinkSimple aria-hidden size={14} weight="bold" />
                        Confirmar vínculo do processo
                      </button>
                      <button
                        aria-expanded={expanded}
                        className={secondaryButtonClasses}
                        onClick={() =>
                          setOpen((current) => ({
                            ...current,
                            [group.processNumberLabel]: !expanded,
                          }))
                        }
                        type="button"
                      >
                        {expanded
                          ? "Fechar os atos"
                          : `Ver os ${group.communications.length} atos`}
                      </button>
                    </div>

                    {group.suggestions.length === 0 ? null : (
                      <ul className="flex flex-col gap-1">
                        {group.suggestions.map((suggestion) => (
                          <li
                            className="flex flex-wrap items-center gap-2 text-xs text-ink"
                            key={`${group.processNumberLabel}-${suggestion.caseId}`}
                          >
                            <span className="font-bold">
                              Sugestão: {suggestion.clientName},{" "}
                              {suggestion.caseLabel}
                            </span>
                            <span className="text-ink-soft">
                              {suggestion.reason}
                            </span>
                            <button
                              className={secondaryButtonClasses}
                              disabled={pending}
                              onClick={() =>
                                run(() =>
                                  linkProcessAction(
                                    group.processNumberLabel,
                                    suggestion.clientId,
                                    suggestion.caseId,
                                  ),
                                )
                              }
                              type="button"
                            >
                              <LinkSimple aria-hidden size={14} weight="bold" />
                              Vincular a este caso
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {expanded ? (
                      <ol className="flex flex-col divide-y divide-line rounded-md bg-inset p-3">
                        {group.communications.map((entry) => (
                          <li
                            className="py-2 first:pt-0 last:pb-0"
                            key={entry.id}
                          >
                            <CommunicationHead entry={entry} />
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-ink">
          Vinculadas, {linked.length}
        </h3>
        {linked.length === 0 ? (
          <p className="rounded-md bg-inset p-4 text-sm text-ink">
            Nenhuma comunicação vinculada a caso até agora.
          </p>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {linked.map((entry) => (
              <li
                className="flex flex-col gap-2 py-4 first:pt-0"
                key={entry.id}
              >
                <CommunicationHead entry={entry} />
                <p className="text-xs text-ink">
                  Vinculada a {entry.linked?.label}, {entry.linked?.method}.
                </p>
                {entry.appliedAt === null ? (
                  <button
                    className={secondaryButtonClasses}
                    disabled={pending}
                    onClick={() =>
                      run(() => applyCommunicationAction(entry.id))
                    }
                    type="button"
                  >
                    <CheckCircle aria-hidden size={14} weight="bold" />
                    Lançar prazo, tarefa e avisos no caso
                  </button>
                ) : (
                  <p className="text-xs text-ink-soft">
                    Lançada no caso em {dateTimeLabel(entry.appliedAt)}.{" "}
                    {entry.appliedNote}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function CommunicationHead({ entry }: { entry: BoardCommunication }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-bold text-ink">
        {entry.processNumberLabel ?? "Processo não identificado"}
        {entry.tribunalSigla === null ? "" : `, ${entry.tribunalSigla}`}
        {entry.courtName === null ? "" : `, ${entry.courtName}`}
      </p>
      <p className="text-xs text-ink-soft">
        Disponibilizado em {brDate(entry.availableOn)}, termo monitorado{" "}
        {entry.monitoredOab}
        {entry.actType === null ? "" : `, ${entry.actType}`}
        {entry.object === null ? "" : `, ${entry.object}`}
        {entry.days === null ? "" : `, prazo de ${entry.days} dias`}
        {entry.appointmentLabel === null ? "" : `, ${entry.appointmentLabel}`}.
      </p>
      <p className="text-xs leading-relaxed text-ink">{entry.textExcerpt}</p>
      <p className="text-xs text-ink-soft">
        {entry.fullyDeterministic
          ? "Lida inteiramente por regra, sem custo de modelo."
          : `Lida por regra, com resíduo para decisão humana: ${entry.residue.join(", ")}.`}
        {entry.certificateUrl === null ? null : (
          <>
            {" "}
            <a
              className="underline"
              href={entry.certificateUrl}
              rel="noreferrer"
              target="_blank"
            >
              Certidão oficial
            </a>
          </>
        )}
      </p>
    </div>
  );
}
