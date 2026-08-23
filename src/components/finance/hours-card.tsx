import { Timer } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { hourEntries } from "@/lib/persona";

export function HoursCard() {
  return (
    <section
      id="registro-de-horas"
      aria-label="Registro de horas"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Timer size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Registro de horas</h2>
          <p className="text-sm text-ink-soft">
            Lançamentos da semana, visíveis somente ao próprio advogado.
          </p>
        </div>
      </header>
      <ol className="flex flex-col divide-y divide-line">
        {hourEntries.map((entry) => (
          <li
            key={entry.id}
            className="relative flex items-center gap-3 rounded-md py-3 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset focus-within:bg-inset"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                <Link
                  href={entry.href}
                  className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                >
                  {entry.description}
                  <span className="sr-only">
                    , abrir o {entry.caseRef} em {entry.destinationLabel}
                  </span>
                </Link>
              </p>
              <p className="text-xs text-ink-soft">
                {entry.client}, {entry.caseRef}, {entry.dateLabel}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-bold whitespace-nowrap text-ink">
              {entry.durationLabel}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
