"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  type JudicialLawsuit,
  type JudicialSubcategory,
  judicialSubcategories,
} from "@/lib/persona";

type SubcategoryFilterId = "all" | JudicialSubcategory;

export function LawsuitsExplorer({
  lawsuits,
}: {
  lawsuits: JudicialLawsuit[];
}) {
  const [subcategory, setSubcategory] = useState<SubcategoryFilterId>("all");

  const filteredLawsuits = useMemo(
    () =>
      lawsuits.filter(
        (lawsuit) =>
          subcategory === "all" || lawsuit.subcategory === subcategory,
      ),
    [lawsuits, subcategory],
  );

  const resultLabel =
    filteredLawsuits.length === 1
      ? "1 processo"
      : `${filteredLawsuits.length} processos`;

  return (
    <section
      id="processos-por-subcategoria"
      aria-label="Processos por subcategoria"
      className="flex scroll-mt-6 flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-ink">
            Processos por subcategoria
          </h2>
          <p className="text-sm text-ink-soft">
            A visão geral reúne todos os processos ativos; cada subcategoria
            reflete a natureza do caso e leva ao processo correspondente.
          </p>
        </div>
        <p aria-live="polite" className="text-sm font-semibold text-ink-soft">
          {resultLabel}
        </p>
      </header>

      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="sr-only">
          Filtrar os processos por subcategoria
        </legend>
        {[
          { id: "all" as const, label: "Visão geral" },
          ...judicialSubcategories,
        ].map((filter) => {
          const isActive = filter.id === subcategory;
          const count =
            filter.id === "all"
              ? lawsuits.length
              : lawsuits.filter((l) => l.subcategory === filter.id).length;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSubcategory(filter.id)}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors duration-(--motion-fast) ${
                isActive
                  ? "border-panel bg-panel text-ink-inverse"
                  : "border-line bg-card text-ink-soft hover:text-ink"
              }`}
            >
              {filter.label} ({count})
            </button>
          );
        })}
      </fieldset>

      <ol className="flex flex-col divide-y divide-line">
        {filteredLawsuits.map((lawsuit) => (
          <li key={lawsuit.id}>
            <Link
              href={`/judicial/${lawsuit.id}`}
              className="flex flex-wrap items-center gap-3 py-4 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset"
            >
              <Avatar
                name={lawsuit.client}
                photoSrc={lawsuit.clientAvatarSrc}
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{lawsuit.client}</p>
                <p className="text-xs text-ink-soft">
                  {lawsuit.benefit}, {lawsuit.caseRef}
                </p>
                <p className="text-xs text-ink-soft">
                  Processo {lawsuit.lawsuitNumber}, {lawsuit.courtLabel}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-bold whitespace-nowrap text-ink">
                  {lawsuit.phaseLabel}
                </span>
                <p className="text-xs text-ink-soft">
                  {lawsuit.openDeadlines === 1
                    ? "1 prazo aberto"
                    : `${lawsuit.openDeadlines} prazos abertos`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ol>

      {filteredLawsuits.length === 0 ? (
        <p className="rounded-md border border-line bg-inset p-4 text-sm text-ink-soft">
          Nenhum processo ativo nesta subcategoria.
        </p>
      ) : null}
    </section>
  );
}
