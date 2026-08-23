import { Notebook } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { communicationLog } from "@/lib/persona";

export function CommunicationLog() {
  return (
    <section
      aria-label="Registro de comunicações"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Notebook size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            Registro de comunicações
          </h2>
          <p className="text-sm text-ink-soft">
            Todo contato realizado fica registrado com canal, conteúdo e
            responsável, vinculado ao caso.
          </p>
        </div>
      </header>
      <ol className="flex flex-col divide-y divide-line">
        {communicationLog.map((entry) => (
          <li
            key={entry.id}
            className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
          >
            <Avatar
              name={entry.clientName}
              size="sm"
              {...(entry.clientAvatarSrc
                ? { photoSrc: entry.clientAvatarSrc }
                : {})}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-bold text-ink">{entry.clientName}</p>
                <p className="text-xs text-ink-soft">
                  {entry.channelLabel}, {entry.dateLabel}
                  {entry.caseRef ? `, ${entry.caseRef}` : ""}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-ink-soft">
                {entry.summary}
              </p>
              <p className="text-xs text-ink-soft">
                Responsável: {entry.responsible}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        Nenhuma comunicação externa é disparada por automação; o envio sempre
        exige aprovação humana registrada.
      </p>
    </section>
  );
}
