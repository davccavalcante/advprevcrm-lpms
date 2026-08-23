import { Wallet } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { financialResult } from "@/lib/persona";

export function FinanceCard() {
  return (
    <section
      aria-label="Meu resultado financeiro"
      className="relative flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Wallet size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            <Link
              href="/financeiro"
              className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
            >
              Meu resultado financeiro
              <span className="sr-only">, abrir em Financeiro</span>
            </Link>
          </h2>
          <p className="text-sm text-ink-soft">
            Sua participação em {financialResult.monthLabel}.
          </p>
        </div>
      </header>
      <dl className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Recebido no mês
          </dt>
          <dd className="text-3xl font-bold tracking-tight text-ink">
            {financialResult.receivedMonthLabel}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Previsto em recebíveis
          </dt>
          <dd className="text-2xl font-bold tracking-tight text-ink">
            {financialResult.forecastLabel}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Casos com êxito no mês
          </dt>
          <dd className="text-2xl font-bold tracking-tight text-ink">
            {financialResult.successCasesMonth}
          </dd>
        </div>
      </dl>
      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        Somente a sua participação é exibida. Os valores dos demais advogados
        são inacessíveis por regra aplicada no banco.
      </p>
    </section>
  );
}
