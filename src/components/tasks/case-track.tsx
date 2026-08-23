import { CaretRight, FlowArrow, Scales } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { TrackColumn } from "@/lib/tasks-board";

/*
 * The track of the cases, read as a waterfall: the legal path is sequential
 * and a case occupies exactly one stage at a time. The cards come from the
 * unified case layer, the same one every operation screen reads, so a client
 * or a benefit is never spelled here differently from the screen that owns it.
 */

export function CaseTrack({
  columns,
  caseTotal,
}: {
  columns: TrackColumn[];
  caseTotal: number;
}) {
  return (
    <section
      aria-labelledby="case-track-heading"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <FlowArrow size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <h2 id="case-track-heading" className="text-lg font-bold text-ink">
            Trilha dos casos
          </h2>
          <p className="text-sm text-ink-soft">
            A trilha legal é sequencial e cada caso ocupa uma única etapa por
            vez, do requerimento administrativo ao encerramento.
          </p>
        </div>
        <p className="text-sm font-semibold whitespace-nowrap text-ink-soft">
          {caseTotal === 1 ? "1 caso" : `${caseTotal} casos`}
        </p>
      </header>

      <ol
        aria-label="Etapas da trilha, em sequência"
        className="flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-md bg-inset px-4 py-3"
      >
        {columns.map((column, index) => (
          <li key={column.id} className="flex items-center gap-1.5">
            {index > 0 ? (
              <CaretRight
                size={12}
                weight="bold"
                aria-hidden
                className="text-ink-soft"
              />
            ) : null}
            <span className="text-xs font-semibold whitespace-nowrap text-ink">
              {column.title}
              <span className="ml-1 rounded-full bg-card px-1.5 py-0.5 text-xs font-bold text-ink-soft">
                {column.cases.length}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {/* The six stages wrap instead of scrolling: every width shows every
       * card, and no board of this office scrolls sideways. */}
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {columns.map((column, index) => (
          <li
            key={column.id}
            className="flex min-w-0 flex-col gap-3 rounded-md bg-inset p-3"
          >
            <header className="flex flex-col gap-1 px-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink">
                  <span className="mr-1.5 text-xs font-semibold text-ink-soft">
                    {index + 1}.
                  </span>
                  {column.title}
                </h3>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold text-ink-soft">
                  {column.cases.length}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-ink-soft">
                {column.detail}
              </p>
            </header>
            {column.cases.length === 0 ? (
              <p className="rounded-md border border-dashed border-line bg-card p-3 text-xs text-ink-soft">
                Nenhum caso nesta etapa.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {column.cases.map((entry) => (
                  <li key={entry.key}>
                    <article className="relative flex flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted">
                      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                        <span className="inline-flex min-w-0 items-start gap-1.5 text-xs font-semibold text-ink-soft">
                          <Scales
                            size={14}
                            weight="bold"
                            aria-hidden
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0 break-words">
                            {entry.caseRef}
                          </span>
                        </span>
                        <span className="rounded-full bg-neutral-soft px-2.5 py-0.5 text-center text-xs leading-snug font-bold text-ink">
                          {entry.sphereLabel}
                        </span>
                      </header>
                      <h4 className="min-w-0 text-sm leading-snug font-bold break-words text-ink">
                        <Link
                          href={entry.href}
                          className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                        >
                          {entry.clientName}
                          <span className="sr-only">
                            , abrir a ficha do caso
                          </span>
                        </Link>
                      </h4>
                      <p className="text-xs font-semibold break-words text-ink-soft">
                        {entry.caseType}
                      </p>
                      <p className="text-xs leading-relaxed break-words text-ink-soft">
                        {entry.documentCount === 1
                          ? "1 documento"
                          : `${entry.documentCount} documentos`}
                        {entry.openDeadlines > 0
                          ? `, ${entry.openDeadlines === 1 ? "1 prazo em aberto" : `${entry.openDeadlines} prazos em aberto`}`
                          : ""}
                        {entry.intakeReason !== null
                          ? `. ${entry.intakeReason}`
                          : ""}
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
