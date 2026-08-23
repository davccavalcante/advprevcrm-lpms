import { FileText } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { administrativeRequirements } from "@/lib/persona";

export function RequirementsCard() {
  return (
    <section
      id="requerimentos-ao-inss"
      aria-label="Requerimentos ao INSS"
      className="flex scroll-mt-6 flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <FileText size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Requerimentos ao INSS</h2>
          <p className="text-sm text-ink-soft">
            Cada requerimento carrega o número do benefício, a data de entrada e
            o protocolo.
          </p>
        </div>
      </header>
      <ol className="flex flex-col divide-y divide-line">
        {administrativeRequirements.map((requirement) => (
          <li
            key={requirement.id}
            className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"
          >
            <Avatar
              name={requirement.client}
              photoSrc={requirement.clientAvatarSrc}
            />
            <div className="min-w-0 flex-1 basis-52">
              <p className="font-bold text-ink">{requirement.client}</p>
              <p className="text-xs text-ink-soft">
                {requirement.benefit}, {requirement.caseRef},{" "}
                {requirement.benefitNumber}
              </p>
              <p className="text-xs text-ink-soft">
                Requerimento com {requirement.entryDateLabel},{" "}
                {requirement.protocolLabel}.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-bold whitespace-nowrap text-ink">
              {requirement.statusLabel}
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        A instrução documental do caso 2025.0047 segue no Atendimento; o
        requerimento é registrado aqui após o protocolo no INSS.
      </p>
    </section>
  );
}
