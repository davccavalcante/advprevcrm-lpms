import { Gavel, Stethoscope } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { weeklyAgenda } from "@/lib/persona";

const kindPresentation = {
  hearing: {
    label: "Audiência",
    Icon: Gavel,
  },
  examination: {
    label: "Perícia",
    Icon: Stethoscope,
  },
} as const;

export function WeeklyAgenda() {
  return (
    <section
      aria-label="Agenda da semana"
      className="relative flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header>
        <h2 className="text-lg font-bold text-ink">
          <Link
            href="/agenda"
            className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
          >
            Agenda da semana
            <span className="sr-only">, abrir na Agenda</span>
          </Link>
        </h2>
        <p className="text-sm text-ink-soft">
          Suas audiências e perícias, com preparação gerada como tarefa.
        </p>
      </header>
      <ol className="flex flex-col divide-y divide-line">
        {weeklyAgenda.map((entry) => {
          const kind = kindPresentation[entry.kind];
          return (
            <li
              key={entry.id}
              className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0"
            >
              <span
                aria-hidden
                className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-ink"
              >
                <kind.Icon size={18} weight="bold" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">
                  {kind.label}, {entry.whenLabel}
                </p>
                <p className="text-sm text-ink-soft">
                  {entry.caseRef}, {entry.client}
                </p>
                <p className="text-xs text-ink-soft">{entry.placeLabel}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
