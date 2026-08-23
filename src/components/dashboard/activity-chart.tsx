"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { monthlyActivity } from "@/lib/persona";

const periodOptions = [
  { id: "14", label: "14 dias", days: 14 },
  { id: "7", label: "7 dias", days: 7 },
] as const;

type PeriodId = (typeof periodOptions)[number]["id"];

export function ActivityChart() {
  const [period, setPeriod] = useState<PeriodId>("14");

  const { days, total, maxValue } = useMemo(() => {
    const option =
      periodOptions.find((entry) => entry.id === period) ?? periodOptions[0];
    const selected = monthlyActivity.slice(-option.days);
    return {
      days: selected,
      total: selected.reduce((sum, entry) => sum + entry.publications, 0),
      maxValue: Math.max(...selected.map((entry) => entry.publications)),
    };
  }, [period]);

  return (
    <section
      aria-label="Publicações e intimações capturadas no mês"
      className="relative flex flex-col gap-6 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-52">
          <h2 className="text-lg font-bold text-ink">
            <Link
              href="/judicial"
              className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
            >
              Publicações e intimações
              <span className="sr-only">, abrir em Judicial</span>
            </Link>
          </h2>
          <p className="text-sm text-ink-soft">
            Capturadas diariamente do Diário de Justiça Eletrônico Nacional, com
            texto integral preservado.
          </p>
        </div>
        <fieldset className="relative flex items-center gap-1.5">
          <legend className="sr-only">Escolher o período do gráfico</legend>
          {periodOptions.map((option) => {
            const isActive = option.id === period;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setPeriod(option.id)}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors duration-(--motion-fast) ${
                  isActive
                    ? "border-panel bg-panel text-ink-inverse"
                    : "border-line bg-card text-ink-soft hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>
      </header>

      <div className="flex items-end gap-6">
        <ol
          aria-label="Publicações por dia"
          className="flex h-44 flex-1 items-end gap-1.5 sm:gap-2.5"
        >
          {days.map((entry) => {
            const heightPercent = Math.round(
              (entry.publications / maxValue) * 100,
            );
            return (
              <li
                key={entry.day}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                {entry.highlighted ? (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-brand-contrast">
                    {entry.publications}
                  </span>
                ) : null}
                <span
                  role="img"
                  aria-label={`Dia ${entry.day}: ${entry.publications} publicações`}
                  className={`block w-full rounded-t-md transition-colors duration-(--motion-base) ${
                    entry.highlighted
                      ? "bg-brand"
                      : "bg-brand-muted/45 hover:bg-brand-muted"
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
                <span aria-hidden className="text-xs font-medium text-ink-soft">
                  {entry.day}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="hidden shrink-0 flex-col items-end gap-1 pb-5 sm:flex">
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
            Total no período
          </p>
          <p
            aria-live="polite"
            className="text-4xl font-bold tracking-tight text-ink"
          >
            {total}
          </p>
        </div>
      </div>

      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        Cada registro preserva a fonte oficial, a data de captura e o texto
        original da comunicação.
      </p>
    </section>
  );
}
