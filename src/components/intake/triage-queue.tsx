"use client";

import {
  CaretDown,
  ChatCircleText,
  EnvelopeSimple,
  Phone,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useIntakeState } from "@/components/intake/intake-state";
import { Avatar } from "@/components/ui/avatar";
import type { TriageItem, TriageKind } from "@/lib/persona";

const kindFilters = [
  { id: "all", label: "Todos" },
  { id: "new-contact", label: "Novos contatos" },
  { id: "existing-client", label: "Clientes existentes" },
  { id: "document", label: "Documentos recebidos" },
  { id: "official", label: "Comunicações oficiais" },
] as const;

type KindFilterId = (typeof kindFilters)[number]["id"];

const kindLabels: Record<TriageKind, string> = {
  "new-contact": "Novo contato",
  "existing-client": "Cliente existente",
  document: "Documento recebido",
  official: "Comunicação oficial",
};

const channelPresentation = {
  email: { label: "E-mail", Icon: EnvelopeSimple },
  message: { label: "Mensagem", Icon: ChatCircleText },
  phone: { label: "Ligação", Icon: Phone },
} as const;

const urgencyPresentation = {
  high: { label: "Urgência alta", className: "bg-attention-soft text-ink" },
  medium: { label: "Urgência média", className: "bg-neutral-soft text-ink" },
  low: { label: "Urgência baixa", className: "bg-inset text-ink" },
} as const;

export function TriageQueue({ items }: { items: TriageItem[] }) {
  const [kind, setKind] = useState<KindFilterId>("all");
  const { confirmedIds, reclassifiedIds, confirmTriage, reclassifyTriage } =
    useIntakeState();

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !confirmedIds.includes(item.id) &&
          (kind === "all" || item.kind === kind),
      ),
    [items, kind, confirmedIds],
  );

  const resultLabel =
    filteredItems.length === 1
      ? "1 item na fila"
      : `${filteredItems.length} itens na fila`;

  return (
    <section
      id="fila-de-triagem"
      aria-label="Fila de triagem"
      className="flex scroll-mt-6 flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-ink">Fila de triagem</h2>
          <p className="text-sm text-ink-soft">
            A Inteligência Massiva (IM) sugere a classificação com confiança
            medida; nada avança sem confirmação humana registrada.
          </p>
        </div>
        <p aria-live="polite" className="text-sm font-semibold text-ink-soft">
          {resultLabel}
        </p>
      </header>

      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="sr-only">Filtrar a fila por tipo de item</legend>
        {kindFilters.map((filter) => {
          const isActive = filter.id === kind;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setKind(filter.id)}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors duration-(--motion-fast) ${
                isActive
                  ? "border-panel bg-panel text-ink-inverse"
                  : "border-line bg-card text-ink-soft hover:text-ink"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </fieldset>

      <ol className="flex flex-col divide-y divide-line">
        {filteredItems.map((item) => {
          const channel = channelPresentation[item.channel];
          const urgency = urgencyPresentation[item.urgency];
          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start gap-3">
                {item.senderAvatarSrc ? (
                  <Avatar
                    name={item.senderName}
                    photoSrc={item.senderAvatarSrc}
                  />
                ) : (
                  <span
                    aria-label={channel.label}
                    role="img"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-inset text-ink"
                  >
                    <channel.Icon size={18} weight="bold" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">
                    {item.senderName}
                    {item.senderCpf ? (
                      <span className="ml-2 text-xs font-medium text-ink-soft">
                        CPF {item.senderCpf}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {kindLabels[item.kind]}, {channel.label.toLowerCase()},
                    recebido {item.receivedLabel}
                    {item.linkedCaseRef
                      ? `, vinculado ao ${item.linkedCaseRef}`
                      : ""}
                    {item.linkedBenefitLabel
                      ? `, ${item.linkedBenefitLabel}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${urgency.className}`}
                >
                  {urgency.label}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-ink">{item.excerpt}</p>

              {item.contactHistory ? (
                <details className="group rounded-md border border-line">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-bold text-ink-soft transition-colors duration-(--motion-fast) hover:text-ink [&::-webkit-details-marker]:hidden">
                    <CaretDown
                      size={12}
                      weight="bold"
                      aria-hidden
                      className="transition-transform duration-(--motion-fast) group-open:rotate-180"
                    />
                    Histórico do contato ({item.contactHistory.length})
                  </summary>
                  <ul className="flex flex-col divide-y divide-line border-t border-line">
                    {item.contactHistory.map((entry) => (
                      <li
                        key={`${item.id}-${entry.dateLabel}`}
                        className="flex flex-col gap-0.5 px-3 py-2.5"
                      >
                        <p className="text-xs font-semibold text-ink">
                          {entry.dateLabel}, por {entry.channelLabel}
                        </p>
                        <p className="text-xs leading-relaxed text-ink-soft">
                          {entry.summary}
                        </p>
                        <p className="text-xs text-ink-soft">
                          Responsável: {entry.responsible}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-inset p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Sugestão assistida pela IM
                  </p>
                  <p className="text-sm font-semibold text-ink">
                    {item.imSuggestionLabel}
                    <span className="ml-2 text-xs font-medium text-ink-soft">
                      confiança {item.imConfidencePercent}%
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => confirmTriage(item.id)}
                    className="cursor-pointer rounded-full bg-panel px-4 py-2 text-xs font-bold whitespace-nowrap text-ink-inverse transition-colors duration-(--motion-fast) hover:bg-panel-hover"
                  >
                    Confirmar triagem
                    <span className="sr-only"> de {item.senderName}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={reclassifiedIds.includes(item.id)}
                    onClick={() => reclassifyTriage(item.id)}
                    className="cursor-pointer rounded-full border border-line bg-card px-4 py-2 text-xs font-bold whitespace-nowrap text-ink-soft transition-colors duration-(--motion-fast) hover:text-ink"
                  >
                    Reclassificar
                    <span className="sr-only"> {item.senderName}</span>
                  </button>
                </div>
              </div>

              {reclassifiedIds.includes(item.id) ? (
                <p className="rounded-md border border-line bg-attention-soft p-3 text-xs font-semibold text-ink">
                  Marcado para reclassificação: a sugestão da Inteligência
                  Massiva (IM) foi recusada e o item aguarda nova classificação
                  humana.
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {filteredItems.length === 0 ? (
        <p className="rounded-md border border-line bg-inset p-4 text-sm text-ink-soft">
          {confirmedIds.length > 0
            ? "Nenhum item deste tipo aguarda triagem; os confirmados saíram da fila."
            : "Nenhum item deste tipo aguarda triagem."}
        </p>
      ) : null}

      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        Toda confirmação e reclassificação fica registrada em auditoria com
        autor, data, hora e origem. Nesta fase de interface, a confirmação vale
        apenas para a sessão em uso e ainda não gera o evento de auditoria, que
        depende do banco.
      </p>
    </section>
  );
}
