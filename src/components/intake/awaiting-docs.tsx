"use client";

import { FolderOpen } from "@phosphor-icons/react";
import { useIntakeState } from "@/components/intake/intake-state";
import { Avatar } from "@/components/ui/avatar";
import { awaitingDocsCases } from "@/lib/persona";

export function AwaitingDocs() {
  const { preparedIds, prepareRequest } = useIntakeState();

  return (
    <section
      id="aguardando-documentacao"
      aria-label="Casos aguardando documentação"
      className="flex scroll-mt-6 flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <FolderOpen size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            Aguardando documentação
          </h2>
          <p className="text-sm text-ink-soft">
            O caso avança somente com a instrução documental mínima completa.
          </p>
        </div>
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {awaitingDocsCases.map((entry) => {
          const progressPercent = Math.round(
            (entry.receivedCount / entry.totalRequired) * 100,
          );
          return (
            <li
              key={entry.id}
              className="flex flex-col gap-2.5 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Avatar
                  name={entry.client}
                  size="sm"
                  {...(entry.clientAvatarSrc
                    ? { photoSrc: entry.clientAvatarSrc }
                    : {})}
                />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-sm font-bold text-ink">{entry.client}</p>
                  <p className="text-xs text-ink-soft">
                    {entry.benefit}, {entry.caseRef}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold text-ink-soft">
                  {entry.receivedCount} de {entry.totalRequired} documentos
                </p>
              </div>
              <div
                role="img"
                aria-label={`${entry.receivedCount} de ${entry.totalRequired} documentos recebidos`}
                className="h-1.5 w-full overflow-hidden rounded-full bg-inset"
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entry.missingDocuments.map((doc) => (
                  <span
                    key={doc}
                    className="rounded-full bg-attention-soft px-2.5 py-1 text-xs font-semibold text-ink"
                  >
                    Falta: {doc}
                  </span>
                ))}
              </div>
              <button
                type="button"
                aria-pressed={preparedIds.includes(entry.id)}
                onClick={() => prepareRequest(entry.id)}
                className="w-fit cursor-pointer rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-bold text-ink-soft transition-colors duration-(--motion-fast) hover:border-brand-muted hover:text-ink"
              >
                Preparar solicitação de pendentes
                <span className="sr-only"> de {entry.client}</span>
              </button>
              {preparedIds.includes(entry.id) ? (
                <p className="rounded-md border border-line bg-inset p-3 text-xs text-ink">
                  Rascunho da solicitação preparado com os{" "}
                  {entry.missingDocuments.length} documentos pendentes. O envio
                  ao cliente depende de aprovação humana registrada e nunca é
                  disparado por automação.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
