import { HourglassHigh } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { administrativeExigencies } from "@/lib/persona";

const statusPresentation = {
  calculated: { label: "Calculado", className: "bg-attention-soft text-ink" },
  confirmed: { label: "Confirmado", className: "bg-neutral-soft text-ink" },
} as const;

export function ExigenciesCard() {
  return (
    <section
      id="exigencias-em-aberto"
      aria-label="Exigências em aberto"
      className="flex scroll-mt-6 flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-attention-soft text-ink">
          <HourglassHigh size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Exigências em aberto</h2>
          <p className="text-sm text-ink-soft">
            Cada exigência tem prazo próprio, no regime administrativo, distinto
            do processual.
          </p>
        </div>
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {administrativeExigencies.map((exigency) => {
          const status = statusPresentation[exigency.status];
          return (
            <li
              key={exigency.id}
              className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Avatar
                  name={exigency.client}
                  photoSrc={exigency.clientAvatarSrc}
                  size="sm"
                />
                <div className="min-w-0 flex-1 basis-52">
                  <p className="text-sm font-bold text-ink">
                    {exigency.client}
                  </p>
                  <p className="text-xs text-ink-soft">{exigency.caseRef}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-ink">
                {exigency.description}
              </p>
              <p className="text-xs font-semibold text-ink-soft">
                Prazo administrativo: {exigency.dueLabel}.
              </p>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        O cálculo é apoio; a confirmação de cada vencimento é ato do advogado,
        registrado em auditoria.
      </p>
    </section>
  );
}
