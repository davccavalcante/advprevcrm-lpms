import { ArrowDown, ArrowUp } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { KpiEntry } from "@/lib/persona";

export function KpiCard({ entry }: { entry: KpiEntry }) {
  const DeltaIcon = entry.deltaDirection === "up" ? ArrowUp : ArrowDown;
  return (
    <article className="relative flex flex-col gap-3 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted">
      <h3 className="text-sm leading-snug font-medium text-ink-soft">
        <Link
          href={entry.href}
          className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
        >
          {entry.label}
          <span className="sr-only">, abrir em {entry.destinationLabel}</span>
        </Link>
      </h3>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <p className="text-4xl font-bold tracking-tight text-ink">
          {entry.value}
          {entry.unit ? (
            <span className="ml-1 text-lg font-medium text-ink-soft">
              {entry.unit}
            </span>
          ) : null}
        </p>
        <span className="mb-1.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-attention-soft px-2.5 py-1 text-xs font-bold text-ink">
          <DeltaIcon size={12} weight="bold" aria-hidden />
          <span aria-hidden>{entry.delta}</span>
          <span className="sr-only">{entry.deltaLabel}</span>
        </span>
      </div>
    </article>
  );
}
