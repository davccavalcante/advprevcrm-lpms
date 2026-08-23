import { Timer } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { criticalDeadlines } from "@/lib/persona";

const statusPresentation = {
  calculated: {
    label: "Calculado",
    className: "bg-attention-soft text-ink",
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-critical-soft text-ink",
  },
} as const;

export function CriticalDeadlines() {
  return (
    <section
      aria-label="Prazos críticos"
      className="relative flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-attention-soft text-ink">
          <Timer size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-52">
          <h2 className="text-lg font-bold text-ink">
            <Link
              href="/agenda"
              className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
            >
              Prazos críticos
              <span className="sr-only">, abrir na Agenda</span>
            </Link>
          </h2>
          <p className="text-sm text-ink-soft">
            Vencimentos mais próximos dos seus casos.
          </p>
        </div>
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {criticalDeadlines.map((deadline) => {
          const status = statusPresentation[deadline.status];
          return (
            <li
              key={deadline.id}
              className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink">{deadline.caseRef}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="text-sm text-ink-soft">{deadline.client}</p>
              <p className="text-sm text-ink-soft">{deadline.benefit}</p>
              <p className="text-sm font-semibold text-ink">
                {deadline.dueLabel}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        O cálculo de prazos é apoio operacional. A confirmação é sempre um ato
        do advogado, registrado em auditoria.
      </p>
    </section>
  );
}
