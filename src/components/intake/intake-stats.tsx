"use client";

import { useIntakeState } from "@/components/intake/intake-state";
import { intakeStats } from "@/lib/persona";

export function IntakeStats() {
  const { confirmedIds } = useIntakeState();

  return (
    <section
      aria-labelledby="intake-stats-heading"
      className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
    >
      <h2 className="sr-only" id="intake-stats-heading">
        Indicadores do atendimento
      </h2>
      {intakeStats.map((stat) => {
        const recorded = Number(stat.value);
        const inQueue = stat.id === "queue";
        const confirmedToday = stat.id === "confirmed-today";
        const liveValue = confirmedToday
          ? recorded + confirmedIds.length
          : inQueue
            ? recorded - confirmedIds.length
            : recorded;
        const movedInSession =
          confirmedIds.length > 0 && (inQueue || confirmedToday);

        return (
          <article
            key={stat.id}
            className="relative flex flex-col gap-2 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
          >
            <h3 className="text-sm leading-snug font-medium text-ink-soft">
              <a
                href={`#${stat.sectionId}`}
                className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
              >
                {stat.label}
                <span className="sr-only">, ir para {stat.sectionLabel}</span>
              </a>
            </h3>
            <p
              aria-live={movedInSession ? "polite" : undefined}
              className="text-4xl font-bold tracking-tight text-ink"
            >
              {liveValue}
            </p>
            {movedInSession ? (
              <p className="text-xs text-ink-soft">
                {inQueue
                  ? confirmedIds.length === 1
                    ? "Desconta 1 confirmação desta sessão, ainda sem registro em auditoria."
                    : `Desconta ${confirmedIds.length} confirmações desta sessão, ainda sem registro em auditoria.`
                  : confirmedIds.length === 1
                    ? "Inclui 1 confirmação desta sessão, ainda sem registro em auditoria."
                    : `Inclui ${confirmedIds.length} confirmações desta sessão, ainda sem registro em auditoria.`}
              </p>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
