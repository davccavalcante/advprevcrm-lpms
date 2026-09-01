import { ListChecks } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { type BoardChipTone, buildTasksBoard } from "@/lib/tasks-board";

const chipClasses: Record<BoardChipTone, string> = {
  attention: "bg-attention-soft text-ink",
  critical: "bg-critical-soft text-ink",
  neutral: "bg-neutral-soft text-ink",
  brand: "bg-brand-muted text-ink",
};

/* The card is a window on the same board the Tarefas screen shows, never a
 * second list assembled from somewhere else: what needs a decision first, then
 * what is waiting to be done. */
const CARD_LIMIT = 5;

export async function TasksCard() {
  const board = await buildTasksBoard();
  const waiting = board.workColumns
    .filter((column) => column.id === "decide" || column.id === "todo")
    .flatMap((column) => column.cards);
  const cards = waiting.slice(0, CARD_LIMIT);
  /* A cut that is not stated is read as an absence, and an absence on a card of
   * pending work is how work is forgotten. */
  const hidden = waiting.length - cards.length;

  return (
    <section
      aria-label="Minhas tarefas"
      className="relative flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <ListChecks size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            <Link
              href="/tarefas"
              className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
            >
              Minhas tarefas
              <span className="sr-only">, abrir em Tarefas</span>
            </Link>
          </h2>
          <p className="text-sm text-ink-soft">
            O que aguarda decisão e execução nos seus casos.
          </p>
        </div>
      </header>
      {cards.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Nada aguardando decisão ou execução. As tarefas nascem dos casos e das
          intimações capturadas.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex flex-col gap-1.5 py-3.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm font-bold text-ink">
                  {card.title}
                </p>
                {card.chips[0] ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${chipClasses[card.chips[0].tone]}`}
                  >
                    {card.chips[0].label}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-ink-soft">
                {[card.client, card.caseLabel, card.detail]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 ? (
        <p className="border-t border-line pt-4 text-xs text-ink-soft">
          Mostrando {cards.length} de {waiting.length} itens aguardando decisão
          ou execução. Os demais estão em Tarefas.
        </p>
      ) : null}
    </section>
  );
}
