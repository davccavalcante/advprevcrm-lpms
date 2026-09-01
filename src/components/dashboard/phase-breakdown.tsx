import Link from "next/link";
import { activeCases, countByStatus, listUnifiedCases } from "@/lib/case-views";

export async function PhaseBreakdown() {
  const cases = activeCases(await listUnifiedCases());
  const phases = countByStatus(cases);
  const total = cases.length;

  return (
    <section
      aria-label="Casos por fase da trilha jurídica"
      className="relative flex flex-col gap-6 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header>
        <h2 className="text-lg font-bold text-ink">
          <Link
            href="/administrativo"
            className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
          >
            Casos por fase
            <span className="sr-only">, abrir em Administrativo</span>
          </Link>
        </h2>
        <p className="text-sm text-ink-soft">
          A trilha é sequencial: cada avanço de fase exige os artefatos
          obrigatórios da etapa.
        </p>
      </header>
      {total === 0 ? (
        <p className="text-sm text-ink-soft">
          Nenhum caso ativo cadastrado. A distribuição por fase aparece assim
          que o primeiro caso for aberto.
        </p>
      ) : (
        <dl className="grid gap-5 sm:grid-cols-2">
          {phases.map((phase) => {
            const sharePercent = Math.round((phase.count / total) * 100);
            return (
              <div key={phase.status} className="flex flex-col gap-2">
                <dt className="text-sm font-medium text-ink-soft">
                  {phase.label}
                </dt>
                <dd className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-ink">
                    {phase.count}
                  </span>
                  <span className="text-xs font-semibold text-ink-soft">
                    {sharePercent}% dos casos
                  </span>
                </dd>
                <div
                  role="img"
                  aria-label={`${phase.label}: ${phase.count} casos, ${sharePercent} por cento do total`}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-inset"
                >
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${sharePercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
