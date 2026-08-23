import { CaretRight, Scales } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { UnifiedCase } from "@/lib/case-views";

/*
 * One presentation of a case, shared by the five operation screens. The branch,
 * the type and the situation are printed with the same vocabulary everywhere,
 * because a situation named one way here and another way there is an error, not
 * a style. Every row leads to the canonical case page.
 */
export function CaseSliceList({
  headingId,
  title,
  description,
  entries,
  emptyLabel,
  missingDimension,
}: {
  headingId: string;
  title: string;
  description: string;
  entries: UnifiedCase[];
  emptyLabel: string;
  /* What this screen would show for a case that has no data in this dimension
   * yet, printed on the row instead of a zero that looks like a measurement. */
  missingDimension?: (entry: UnifiedCase) => string | null;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Scales size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <h2 id={headingId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          <p className="text-sm text-ink-soft">{description}</p>
        </div>
        <p className="text-sm font-semibold whitespace-nowrap text-ink-soft">
          {entries.length === 1 ? "1 caso" : `${entries.length} casos`}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-md bg-inset p-4 text-sm text-ink">{emptyLabel}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {entries.map((entry) => {
            const missing = missingDimension?.(entry) ?? null;
            return (
              <li
                key={entry.key}
                className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md py-4 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset focus-within:bg-inset"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-sm font-bold text-ink">
                    <Link
                      href={entry.href}
                      className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                    >
                      {entry.caseType}
                      <span className="sr-only">
                        , de {entry.clientName}, abrir o caso
                      </span>
                    </Link>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {entry.clientName}, {entry.caseRef}, contra{" "}
                    {entry.opposingParty}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {entry.sphereLabel}, {entry.courtLabel}, responsável{" "}
                    {entry.responsibleLawyer}
                  </p>
                  {missing ? (
                    <p className="mt-1 w-fit rounded-md bg-attention-soft px-2 py-1 text-xs font-semibold text-ink">
                      {missing}
                    </p>
                  ) : null}
                </div>
                {entry.origin === "fixture" ? (
                  <span className="shrink-0 rounded-full bg-neutral-soft px-3 py-1 text-xs font-semibold whitespace-nowrap text-ink-soft">
                    Demonstração
                  </span>
                ) : null}
                <span className="shrink-0 rounded-full bg-neutral-soft px-3 py-1 text-xs font-bold whitespace-nowrap text-ink">
                  {entry.statusLabel}
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
