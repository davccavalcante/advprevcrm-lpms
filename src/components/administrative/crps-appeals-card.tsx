import { ArrowUUpLeft } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { crpsAppeals } from "@/lib/persona";

export function CrpsAppealsCard() {
  return (
    <section
      aria-label="Recursos ao CRPS"
      className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <ArrowUUpLeft size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Recursos ao CRPS</h2>
          <p className="text-sm text-ink-soft">
            Recursos ao Conselho de Recursos da Previdência Social em
            julgamento.
          </p>
        </div>
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {crpsAppeals.map((appeal) => (
          <li
            key={appeal.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Avatar
                name={appeal.client}
                photoSrc={appeal.clientAvatarSrc}
                size="sm"
              />
              <div className="min-w-0 flex-1 basis-52">
                <p className="text-sm font-bold text-ink">{appeal.client}</p>
                <p className="text-xs text-ink-soft">
                  {appeal.benefit}, {appeal.caseRef}
                </p>
              </div>
            </div>
            <p className="text-xs text-ink">
              Recurso ordinário, {appeal.filedLabel}.
            </p>
            <p className="text-xs font-semibold text-ink-soft">
              {appeal.statusLabel}.
            </p>
          </li>
        ))}
      </ul>
      <p className="border-t border-line pt-3 text-xs text-ink-soft">
        Durante o julgamento do recurso, o caso permanece na fase
        administrativa.
      </p>
    </section>
  );
}
