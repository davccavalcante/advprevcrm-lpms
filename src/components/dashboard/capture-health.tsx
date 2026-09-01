import { CloudArrowDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { captureHealth } from "@/lib/capture/runs";

/*
 * The health of the scheduled captures, read from the execution log of the
 * office and from nowhere else. A source that never ran says exactly that: an
 * invented "up to date" here is how a lawyer trusts a capture that stopped days
 * ago and loses a deadline.
 */

function dateTimeLabel(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`;
}

/*
 * A moment that does not exist is not written as a date: the sentence changes
 * shape instead, because "última execução em nunca" is not Portuguese and an
 * interface that writes it teaches the office to stop reading it.
 */
function runSentence(
  lastRunAt: string | null,
  lastSuccessAt: string | null,
): string {
  if (lastRunAt === null) {
    return "Nenhuma execução registrada até agora.";
  }
  const first = `Última execução em ${dateTimeLabel(lastRunAt)}.`;
  return lastSuccessAt === null
    ? `${first} Nenhuma captura bem-sucedida até agora.`
    : `${first} Última captura bem-sucedida em ${dateTimeLabel(lastSuccessAt)}.`;
}

export async function CaptureHealth() {
  const sources = await captureHealth();

  return (
    <section
      aria-label="Saúde das capturas externas"
      className="relative flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <CloudArrowDown aria-hidden size={18} weight="bold" />
        </span>
        <div className="min-w-0 flex-1 basis-52">
          <h2 className="text-lg font-bold text-ink">
            <Link
              className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
              href="/judicial#publicacoes"
            >
              Saúde das capturas
              <span className="sr-only">, abrir em Judicial</span>
            </Link>
          </h2>
          <p className="text-sm text-ink-soft">
            Execução, resultado e atraso de cada fonte oficial.
          </p>
        </div>
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {sources.map((source) => (
          <li
            className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0"
            key={source.source}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <p className="min-w-0 flex-1 basis-52 text-sm font-bold text-ink">
                {source.label}
              </p>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${
                  source.healthy
                    ? "bg-neutral-soft text-ink"
                    : "bg-attention-soft text-ink"
                }`}
              >
                {source.statusLabel}
              </span>
            </div>
            <p className="text-xs text-ink-soft">
              {runSentence(source.lastRunAt, source.lastSuccessAt)}
            </p>
            {source.lastResult === null ? null : (
              <p className="text-xs text-ink-soft">{source.lastResult}</p>
            )}
            <p className="text-xs font-semibold text-ink">{source.role}</p>
          </li>
        ))}
      </ul>
      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        A indisponibilidade fica visível aqui para que a falha de captura seja
        percebida no mesmo dia, e não na véspera do prazo; o acompanhamento
        manual permanece sempre disponível.
      </p>
    </section>
  );
}
