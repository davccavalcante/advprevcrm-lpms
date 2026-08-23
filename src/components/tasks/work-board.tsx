import { CaretRight, Kanban } from "@phosphor-icons/react/dist/ssr";
import { BoardCard } from "@/components/tasks/board-card";
import type { WorkColumn } from "@/lib/tasks-board";

/*
 * The work kanban. The columns are the waterfall of a piece of work in this
 * office, from arrival by an official source to closure, and the strip above
 * them reads that waterfall in one line. The board is visual: no card is
 * editable here and no column accepts a drop, because every state change of
 * this office is an audited act on the screen that owns the record.
 */

export function WorkBoard({ columns }: { columns: WorkColumn[] }) {
  const total = columns.reduce((sum, column) => sum + column.cards.length, 0);
  return (
    <section
      aria-labelledby="work-board-heading"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Kanban size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <h2 id="work-board-heading" className="text-lg font-bold text-ink">
            Fluxo de trabalho
          </h2>
          <p className="text-sm text-ink-soft">
            Cada coluna é uma etapa do caminho que um item percorre no
            escritório, da chegada pela fonte oficial ao encerramento.
          </p>
        </div>
        <p className="text-sm font-semibold whitespace-nowrap text-ink-soft">
          {total === 1 ? "1 item" : `${total} itens`}
        </p>
      </header>

      <ol
        aria-label="Etapas do fluxo, em sequência"
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
                {column.cards.length}
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
                  {column.cards.length}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-ink-soft">
                {column.description}
              </p>
            </header>
            {column.cards.length === 0 ? (
              <p className="rounded-md border border-dashed border-line bg-card p-3 text-xs text-ink-soft">
                {column.emptyLabel}
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {column.cards.map((card) => (
                  <li key={card.id}>
                    <BoardCard card={card} />
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
