import { Stethoscope } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { administrativeExaminations } from "@/lib/persona";

export function ExaminationsCard() {
  return (
    <section
      id="pericias-administrativas"
      aria-label="Perícias administrativas"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Stethoscope size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            Perícias administrativas
          </h2>
          <p className="text-sm text-ink-soft">
            Com data, local e preparação do cliente.
          </p>
        </div>
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {administrativeExaminations.map((examination) => (
          <li
            key={examination.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Avatar
                name={examination.client}
                photoSrc={examination.clientAvatarSrc}
                size="sm"
              />
              <div className="min-w-0 flex-1 basis-52">
                <p className="text-sm font-bold text-ink">
                  {examination.client}
                </p>
                <p className="text-xs text-ink-soft">
                  {examination.kindLabel}, {examination.caseRef}
                </p>
              </div>
            </div>
            <p className="text-xs text-ink">
              {examination.whenLabel}, {examination.placeLabel}.
            </p>
            <p className="text-xs leading-relaxed text-ink-soft">
              {examination.preparationLabel}.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
