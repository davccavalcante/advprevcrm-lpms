"use client";

import {
  CalendarBlank,
  Gavel,
  HourglassHigh,
  Stethoscope,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  type AgendaWeekday,
  agendaWeekdays,
  type UnifiedAgendaItem,
} from "@/lib/persona";

type ViewMode = "day" | "week" | "month";

type KindFilterId = "all" | "hearing" | "examination" | "deadline";

const viewOptions: { id: ViewMode; label: string }[] = [
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
];

const kindOptions: { id: KindFilterId; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "hearing", label: "Audiências" },
  { id: "examination", label: "Perícias" },
  { id: "deadline", label: "Prazos" },
];

const kindPresentation = {
  hearing: { label: "Audiência", Icon: Gavel },
  examination: { label: "Perícia", Icon: Stethoscope },
  deadline: { label: "Prazo", Icon: HourglassHigh },
} as const;

const statusPresentation = {
  calculated: { label: "Calculado", className: "bg-attention-soft text-ink" },
  confirmed: { label: "Confirmado", className: "bg-neutral-soft text-ink" },
} as const;

export function AgendaExplorer({ items }: { items: UnifiedAgendaItem[] }) {
  const [view, setView] = useState<ViewMode>("week");
  const [kind, setKind] = useState<KindFilterId>("all");
  const [weekday, setWeekday] = useState<AgendaWeekday>("mon");

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (kind !== "all" && item.kind !== kind) {
          return false;
        }
        if (view === "day") {
          return item.dayId === weekday;
        }
        if (view === "week") {
          return item.kind !== "deadline" || item.dueThisWeek === true;
        }
        return true;
      }),
    [items, kind, view, weekday],
  );

  const resultLabel =
    filteredItems.length === 1
      ? "1 item na agenda"
      : `${filteredItems.length} itens na agenda`;

  return (
    <section
      id="agenda-unificada"
      aria-label="Agenda unificada"
      className="flex scroll-mt-6 flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <CalendarBlank size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-52">
          <h2 className="text-lg font-bold text-ink">Agenda unificada</h2>
          <p className="text-sm text-ink-soft">
            Prazos, perícias e audiências do advogado responsável; a coordenação
            filtra também por advogado e por time.
          </p>
        </div>
        <p aria-live="polite" className="text-sm font-semibold text-ink-soft">
          {resultLabel}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">Escolher a visão da agenda</legend>
          {viewOptions.map((option) => {
            const isActive = option.id === view;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setView(option.id)}
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
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">Filtrar a agenda por tipo</legend>
          {kindOptions.map((option) => {
            const isActive = option.id === kind;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setKind(option.id)}
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
      </div>

      {view === "day" ? (
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">Escolher o dia da semana</legend>
          {agendaWeekdays.map((day) => {
            const isActive = day.id === weekday;
            return (
              <button
                key={day.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setWeekday(day.id)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold whitespace-nowrap transition-colors duration-(--motion-fast) ${
                  isActive
                    ? "border-brand bg-brand-muted text-ink"
                    : "border-line bg-card text-ink-soft hover:text-ink"
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </fieldset>
      ) : null}

      <ol className="flex flex-col divide-y divide-line">
        {filteredItems.map((item) => {
          const presentation = kindPresentation[item.kind];
          const status = item.status ? statusPresentation[item.status] : null;
          return (
            <li
              key={item.id}
              className="relative flex flex-col gap-2 rounded-md py-4 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset focus-within:bg-inset"
            >
              <div className="flex flex-wrap items-start gap-3">
                <Avatar
                  name={item.client}
                  size="sm"
                  {...(item.clientAvatarSrc
                    ? { photoSrc: item.clientAvatarSrc }
                    : {})}
                />
                <div className="min-w-0 flex-1 basis-52">
                  <p className="text-sm font-bold text-ink">
                    <Link
                      href={item.href}
                      className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                    >
                      {item.title}
                      <span className="sr-only">
                        , abrir o {item.caseRef} em {item.destinationLabel}
                      </span>
                    </Link>
                    <span className="ml-2 text-xs font-medium text-ink-soft">
                      {presentation.label}
                    </span>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {item.client}, {item.caseRef}
                  </p>
                  <p className="text-xs text-ink-soft">{item.whenLabel}.</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.escalated ? (
                    <span className="rounded-full bg-attention-soft px-2.5 py-1 text-xs font-bold text-ink">
                      Escalonado à coordenação, sem tratativa
                    </span>
                  ) : item.critical ? (
                    <span className="rounded-full bg-attention-soft px-2.5 py-1 text-xs font-bold whitespace-nowrap text-ink">
                      Alerta crítico
                    </span>
                  ) : null}
                  {status ? (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${status.className}`}
                    >
                      {status.label}
                    </span>
                  ) : null}
                </div>
              </div>
              {item.preparationLabel ? (
                <p className="rounded-md border border-line bg-inset p-3 text-xs leading-relaxed text-ink-soft">
                  {item.preparationLabel}.
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {filteredItems.length === 0 ? (
        <p className="rounded-md border border-line bg-inset p-4 text-sm text-ink-soft">
          Nenhum item da agenda para esta seleção.
        </p>
      ) : null}

      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        Os alertas escalonam conforme a proximidade do vencimento, e um prazo
        crítico sem tratativa é escalonado automaticamente à coordenação; cada
        perícia e audiência gera as tarefas de preparação e a comunicação de
        orientação ao cliente, sempre sujeita a revisão antes do envio.
      </p>
    </section>
  );
}
