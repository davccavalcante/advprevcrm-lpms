import { WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { criticalDeadlineList } from "@/lib/case-views";
import { riskAlerts } from "@/lib/persona";

export async function RiskAlerts() {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (await criticalDeadlineList()).filter(
    (deadline) => deadline.dueOn < today,
  );

  return (
    <section
      aria-label="Prazos vencidos e alertas de risco"
      className="relative flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <WarningDiamond size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-52">
          <h2 className="text-lg font-bold text-ink">
            <Link
              href="/agenda"
              className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
            >
              Riscos e vencidos
              <span className="sr-only">, abrir na Agenda</span>
            </Link>
          </h2>
          <p className="text-sm text-ink-soft">
            Decadência, prescrição e prazo crítico sem tratativa.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2 rounded-md border border-line bg-inset p-4">
        <p className="text-sm font-medium text-ink-soft">Prazos vencidos</p>
        <p className="text-4xl font-bold tracking-tight text-ink">
          {overdue.length}
        </p>
        <p className="text-xs text-ink-soft">
          {overdue.length === 0
            ? "Nenhum prazo registrado passou da data de vencimento."
            : "Prazos registrados cuja data de vencimento já passou."}
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-line">
        {riskAlerts.map((alert) => (
          <li
            key={alert.id}
            className="flex flex-wrap items-start gap-3 py-4 first:pt-0 last:pb-0"
          >
            <Avatar
              name={alert.client}
              photoSrc={alert.clientAvatarSrc}
              size="sm"
            />
            <div className="min-w-0 flex-1 basis-52">
              <p className="text-sm font-bold text-ink">{alert.kindLabel}</p>
              <p className="text-xs text-ink-soft">
                {alert.client}, {alert.caseRef}
              </p>
              <p className="text-xs text-ink-soft">{alert.detailLabel}</p>
              <p className="text-xs text-ink-soft">{alert.sourceLabel}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        O alerta é apoio operacional e nunca conclui o caso; a decisão e a
        confirmação de prazo permanecem atos do advogado, registrados em
        auditoria.
      </p>
    </section>
  );
}
