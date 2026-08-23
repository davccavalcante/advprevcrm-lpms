import { ListChecks } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { myTasks } from "@/lib/persona";

const priorityPresentation = {
  high: { label: "Alta", className: "bg-attention-soft text-ink" },
  medium: { label: "Média", className: "bg-critical-soft text-ink" },
  low: { label: "Baixa", className: "bg-neutral-soft text-ink" },
} as const;

const statusPresentation = {
  todo: "A fazer",
  doing: "Em execução",
  review: "Em revisão",
} as const;

export function TasksCard() {
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
              href="/agenda"
              className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
            >
              Minhas tarefas
              <span className="sr-only">, abrir na Agenda</span>
            </Link>
          </h2>
          <p className="text-sm text-ink-soft">Ciclo atual dos seus casos.</p>
        </div>
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {myTasks.map((task) => {
          const priority = priorityPresentation[task.priority];
          return (
            <li
              key={task.id}
              className="flex flex-col gap-1.5 py-3.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm font-bold text-ink">
                  {task.title}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${priority.className}`}
                >
                  {priority.label}
                </span>
              </div>
              <p className="text-xs text-ink-soft">
                {task.caseRef}, {statusPresentation[task.status]}, vence{" "}
                {task.dueLabel}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
