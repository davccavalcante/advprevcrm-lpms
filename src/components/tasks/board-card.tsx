import {
  CaretRight,
  FileText,
  Gavel,
  ListChecks,
  Newspaper,
  Scales,
  Stethoscope,
  Timer,
  WarningDiamond,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type {
  BoardCard as BoardCardData,
  BoardCardKind,
  BoardChipTone,
} from "@/lib/tasks-board";

/*
 * One card of the board. It is information and never a control: the only
 * interaction is following the link to the screen that owns the record, where
 * any decision happens and is audited. Nothing on this card edits anything.
 */

const KIND_PRESENTATION: Record<
  BoardCardKind,
  { label: string; icon: typeof ListChecks }
> = {
  task: { label: "Tarefa", icon: ListChecks },
  deadline: { label: "Prazo", icon: Timer },
  hearing: { label: "Audiência", icon: Gavel },
  examination: { label: "Perícia", icon: Stethoscope },
  document: { label: "Documento", icon: FileText },
  risk: { label: "Risco", icon: WarningDiamond },
  capture: { label: "Captura", icon: Newspaper },
  case: { label: "Caso", icon: Scales },
};

const CHIP_TONE_CLASSES: Record<BoardChipTone, string> = {
  attention: "bg-attention-soft text-ink",
  critical: "bg-critical-soft text-ink",
  neutral: "bg-neutral-soft text-ink",
  brand: "bg-inset text-ink",
};

export function BoardCard({ card }: { card: BoardCardData }) {
  const kind = KIND_PRESENTATION[card.kind];
  const Icon = kind.icon;
  return (
    <article className="relative flex flex-col gap-2 rounded-md border border-line bg-card p-4 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
          <Icon size={14} weight="bold" aria-hidden className="shrink-0" />
          {kind.label}
        </span>
        <span className="flex min-w-0 flex-wrap justify-end gap-1.5">
          {card.chips.map((chip) => (
            <span
              key={chip.label}
              className={`rounded-full px-2.5 py-0.5 text-center text-xs leading-snug font-bold ${CHIP_TONE_CLASSES[chip.tone]}`}
            >
              {chip.label}
            </span>
          ))}
        </span>
      </header>
      <h4 className="min-w-0 text-sm leading-snug font-bold break-words text-ink">
        <Link
          href={card.href}
          className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
        >
          {card.title}
          <span className="sr-only">, abrir em {card.destinationLabel}</span>
        </Link>
      </h4>
      {card.client !== null || card.caseLabel !== null ? (
        <p className="text-xs font-semibold break-words text-ink-soft">
          {[card.client, card.caseLabel].filter(Boolean).join(", ")}
        </p>
      ) : null}
      {card.detail !== null ? (
        <p className="text-xs leading-relaxed break-words text-ink-soft">
          {card.detail}
        </p>
      ) : null}
      <p className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
        Ver em {card.destinationLabel}
        <CaretRight size={12} weight="bold" aria-hidden />
      </p>
    </article>
  );
}
