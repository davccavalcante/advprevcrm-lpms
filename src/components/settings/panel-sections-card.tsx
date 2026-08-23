"use client";

import { ArrowCounterClockwise, SquaresFour } from "@phosphor-icons/react";
import {
  dashboardSections,
  useDashboardFilter,
} from "@/components/dashboard/dashboard-filter";

export function PanelSectionsCard() {
  const filter = useDashboardFilter();

  if (!filter) {
    return null;
  }

  const hiddenCount = filter.hiddenIds.length;
  const visibleCount = dashboardSections.length - hiddenCount;

  return (
    <section
      aria-label="Seções do painel"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <SquaresFour size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Seções do painel</h2>
          <p className="text-sm text-ink-soft">
            Mesma escolha do filtro da barra superior. A saudação e os prazos da
            semana permanecem sempre visíveis, porque são a razão de a tela
            abrir.
          </p>
        </div>
      </header>

      <p className="text-sm text-ink-soft" aria-live="polite">
        {visibleCount} de {dashboardSections.length} seções visíveis.
      </p>

      <ul className="grid gap-1 sm:grid-cols-2">
        {dashboardSections.map((section) => (
          <li key={section.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-ink transition-colors duration-(--motion-fast) hover:bg-inset">
              <input
                type="checkbox"
                checked={filter.isVisible(section.id)}
                onChange={() => filter.toggle(section.id)}
                className="size-4 shrink-0 cursor-pointer accent-ink"
              />
              {section.label}
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={filter.showAll}
        disabled={hiddenCount === 0}
        className="inline-flex w-fit cursor-pointer items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors duration-(--motion-fast) hover:bg-inset disabled:cursor-not-allowed disabled:text-ink-soft disabled:opacity-60"
      >
        <ArrowCounterClockwise size={16} weight="bold" aria-hidden />
        Mostrar todas
      </button>
    </section>
  );
}
