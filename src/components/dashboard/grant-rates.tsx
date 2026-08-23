import Link from "next/link";
import { grantRates } from "@/lib/persona";

export function GrantRates() {
  return (
    <section
      aria-label="Taxa de deferimento dos meus casos"
      className="relative flex flex-col gap-6 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header>
        <h2 className="text-lg font-bold text-ink">
          <Link
            href="/administrativo"
            className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
          >
            Taxa de deferimento
            <span className="sr-only">, abrir em Administrativo</span>
          </Link>
        </h2>
        <p className="text-sm text-ink-soft">
          Resultado das decisões nos meus casos; o percentual sempre vem
          acompanhado da fração que o origina.
        </p>
      </header>
      <dl className="flex flex-col gap-5">
        {grantRates.map((rate) => {
          const sharePercent = Math.round((rate.granted / rate.decided) * 100);
          return (
            <div key={rate.id} className="flex flex-col gap-2">
              <dt className="text-sm font-medium text-ink-soft">
                {rate.label}
              </dt>
              <dd className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-bold tracking-tight text-ink">
                  {sharePercent}%
                </span>
                <span className="text-xs font-semibold text-ink-soft">
                  {rate.granted} de {rate.decided} decisões
                </span>
              </dd>
              <div
                role="img"
                aria-label={`${rate.label}: ${rate.granted} de ${rate.decided} decisões favoráveis, ${sharePercent} por cento`}
                className="h-1.5 w-full overflow-hidden rounded-full bg-inset"
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${sharePercent}%` }}
                />
              </div>
              <p className="text-xs text-ink-soft">{rate.noteLabel}</p>
            </div>
          );
        })}
      </dl>
      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        A taxa é histórico apurado, nunca previsão de resultado de um caso em
        andamento.
      </p>
    </section>
  );
}
