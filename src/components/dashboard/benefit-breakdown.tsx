import Link from "next/link";
import {
  activeCases,
  countByCaseType,
  listUnifiedCases,
} from "@/lib/case-views";

export async function BenefitBreakdown() {
  const cases = activeCases(await listUnifiedCases());
  const slices = countByCaseType(cases);
  const total = cases.length;

  return (
    <section
      aria-label="Casos por tipo de benefício"
      className="relative flex flex-col gap-6 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header>
        <h2 className="text-lg font-bold text-ink">
          <Link
            href="/clientes"
            className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
          >
            Casos por benefício
            <span className="sr-only">, abrir em Clientes</span>
          </Link>
        </h2>
        <p className="text-sm text-ink-soft">
          Cada benefício pleiteado é um caso independente, e a soma fecha os{" "}
          {total} casos ativos do escritório.
        </p>
      </header>
      {total === 0 ? (
        <p className="text-sm text-ink-soft">
          Nenhum caso ativo cadastrado. A distribuição por benefício aparece
          assim que o primeiro caso for aberto.
        </p>
      ) : (
        <dl className="flex flex-col gap-3">
          {slices.map((slice) => {
            const sharePercent = Math.round((slice.count / total) * 100);
            return (
              <div key={slice.caseType} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-sm text-ink">{slice.caseType}</dt>
                  <dd className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-ink">
                      {slice.count}
                    </span>
                    <span className="text-xs font-semibold text-ink-soft">
                      {sharePercent}%
                    </span>
                  </dd>
                </div>
                <div
                  role="img"
                  aria-label={`${slice.caseType}: ${slice.count} casos, ${sharePercent} por cento da carteira`}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-inset"
                >
                  <div
                    className="h-full rounded-full bg-brand-muted"
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
