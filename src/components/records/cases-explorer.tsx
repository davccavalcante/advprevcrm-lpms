"use client";

import { CaretRight, Scales } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type CaseSphereId,
  type CaseStatusId,
  caseSpheres,
  caseStatuses,
} from "@/lib/case-domain";
import type { UnifiedCase } from "@/lib/case-views";

/* One source for every screen: this list is the same the panel counts from. */
export type CaseRow = UnifiedCase;

/* Forty four pixels of touch target below the small breakpoint, forty from it
 * upwards, the same rule the top bar follows. The row gained a fourth branch on
 * 2026-08-11 and the chips were measured at thirty eight pixels on a phone. */
const chipBase =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors duration-(--motion-fast) sm:min-h-10";
const chipIdle = "border-line text-ink-soft hover:bg-inset hover:text-ink";
const chipActive = "border-transparent bg-panel text-ink-inverse";

export function CasesExplorer({ rows }: { rows: CaseRow[] }) {
  const [sphere, setSphere] = useState<CaseSphereId | "all">("all");
  const [status, setStatus] = useState<CaseStatusId | "all">("all");
  const [caseType, setCaseType] = useState<string>("all");

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (sphere === "all" || row.sphere === sphere) {
        set.add(row.caseType);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows, sphere]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (sphere === "all" || row.sphere === sphere) &&
          (status === "all" || row.status === status) &&
          (caseType === "all" || row.caseType === caseType),
      ),
    [rows, sphere, status, caseType],
  );

  const countBySphere = (id: CaseSphereId) =>
    rows.filter((row) => row.sphere === id).length;

  return (
    <section
      aria-labelledby="cases-explorer-heading"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Scales size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <h2
            id="cases-explorer-heading"
            className="text-lg font-bold text-ink"
          >
            Casos por esfera
          </h2>
          <p className="text-sm text-ink-soft">
            A esfera é definida por contra quem se litiga e pelo que se pede.
          </p>
        </div>
        <p className="text-sm font-semibold whitespace-nowrap text-ink-soft">
          {filtered.length === 1 ? "1 caso" : `${filtered.length} casos`}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <fieldset>
          <legend className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
            Esfera
          </legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSphere("all");
                setCaseType("all");
              }}
              aria-pressed={sphere === "all"}
              className={`${chipBase} ${sphere === "all" ? chipActive : chipIdle}`}
            >
              Todas ({rows.length})
            </button>
            {caseSpheres.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setSphere(option.id);
                  setCaseType("all");
                }}
                aria-pressed={sphere === option.id}
                className={`${chipBase} ${sphere === option.id ? chipActive : chipIdle}`}
              >
                {option.label} ({countBySphere(option.id)})
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
            Situação
          </legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus("all")}
              aria-pressed={status === "all"}
              className={`${chipBase} ${status === "all" ? chipActive : chipIdle}`}
            >
              Todas
            </button>
            {caseStatuses.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setStatus(option.id)}
                aria-pressed={status === option.id}
                className={`${chipBase} ${status === option.id ? chipActive : chipIdle}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex max-w-md flex-col gap-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
          Tipo do caso
          <select
            value={caseType}
            onChange={(event) => setCaseType(event.target.value)}
            className="w-full rounded-md border border-line bg-inset px-4 py-2.5 text-sm font-normal tracking-normal text-ink normal-case"
          >
            <option value="all">Todos os tipos</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p role="status" className="rounded-md bg-inset p-4 text-sm text-ink">
          {rows.length === 0
            ? "Nenhum caso cadastrado ainda. Abra o primeiro pela ficha de um cliente."
            : "Nenhum caso corresponde a esta combinação de filtros."}
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {filtered.map((row) => {
            const statusLabel = row.statusLabel;
            return (
              <li
                key={row.key}
                className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md py-4 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset focus-within:bg-inset"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-sm font-bold text-ink">
                    <Link
                      href={row.href}
                      className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                    >
                      {row.caseType}
                      <span className="sr-only">
                        , de {row.clientName}, abrir o caso
                      </span>
                    </Link>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {row.clientName}, contra {row.opposingParty}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {row.sphereLabel}, {row.courtLabel}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-neutral-soft px-3 py-1 text-xs font-bold whitespace-nowrap text-ink">
                  {statusLabel}
                </span>
                <span className="shrink-0 text-xs whitespace-nowrap text-ink-soft">
                  {row.documentCount === 1
                    ? "1 documento"
                    : `${row.documentCount} documentos`}
                </span>
                <CaretRight
                  size={16}
                  weight="bold"
                  aria-hidden
                  className="shrink-0 text-ink-soft"
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
