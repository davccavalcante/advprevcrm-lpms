import { Scales } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { administrativeDecisions } from "@/lib/persona";

export function DecisionsCard() {
  return (
    <section
      aria-label="Decisões e encaminhamentos"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Scales size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            Decisões e encaminhamentos
          </h2>
          <p className="text-sm text-ink-soft">
            Deferimento encerra a fase com apuração dos honorários;
            indeferimento abre a escolha registrada entre o recurso ao Conselho
            de Recursos da Previdência Social e o ajuizamento.
          </p>
        </div>
      </header>
      <ol className="flex flex-col divide-y divide-line">
        {administrativeDecisions.map((decision) => (
          <li
            key={decision.id}
            className="flex flex-wrap items-start gap-3 py-4 first:pt-0 last:pb-0"
          >
            <Avatar
              name={decision.client}
              photoSrc={decision.clientAvatarSrc}
              size="sm"
            />
            <div className="min-w-0 flex-1 basis-52">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-bold text-ink">{decision.client}</p>
                <p className="text-xs text-ink-soft">
                  {decision.benefit}, {decision.caseRef}
                </p>
                <span className="rounded-full bg-attention-soft px-2.5 py-0.5 text-xs font-bold text-ink">
                  {decision.outcomeLabel}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-ink-soft">
                {decision.groundsLabel}
              </p>
              <p className="text-xs font-semibold text-ink">
                {decision.pathLabel}.
              </p>
              <p className="text-xs text-ink-soft">{decision.gateLabel}.</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        A liberação do portão para a fase judicial nunca é silenciosa: exige a
        prova do requerimento prévio e da decisão, ou dispensa expressamente
        justificada, registrada em auditoria.
      </p>
    </section>
  );
}
