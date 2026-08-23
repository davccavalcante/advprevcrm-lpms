"use client";

import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { ClientRecord } from "@/lib/persona";

const situationClasses: Record<ClientRecord["situationLabel"], string> = {
  Ativo: "bg-critical-soft text-ink",
  "Em análise": "bg-attention-soft text-ink",
  "Documentação pendente": "bg-neutral-soft text-ink",
};

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const situationFilters = [
  { id: "all", label: "Todos" },
  { id: "Ativo", label: "Ativos" },
  { id: "Em análise", label: "Em análise" },
  { id: "Documentação pendente", label: "Documentação pendente" },
] as const;

type SituationFilterId = (typeof situationFilters)[number]["id"];

export function ClientsExplorer({ clients }: { clients: ClientRecord[] }) {
  const [query, setQuery] = useState("");
  const [situation, setSituation] = useState<SituationFilterId>("all");

  const filteredClients = useMemo(() => {
    const needle = normalize(query.trim());
    return clients.filter((client) => {
      if (situation !== "all" && client.situationLabel !== situation) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = normalize(
        [
          client.fullName,
          client.cpf,
          client.cityState,
          ...client.cases.flatMap((clientCase) => [
            clientCase.benefit,
            clientCase.caseRef,
            clientCase.benefitNumber ?? "",
            clientCase.lawsuitNumber ?? "",
          ]),
        ].join(" "),
      );
      return haystack.includes(needle);
    });
  }, [clients, query, situation]);

  const resultLabel =
    filteredClients.length === 1
      ? "1 cliente encontrado"
      : `${filteredClients.length} clientes encontrados`;

  return (
    <section aria-label="Lista de clientes" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <label className="relative w-full min-w-0 sm:max-w-md sm:flex-1">
          <span className="sr-only">
            Buscar por nome, CPF, benefício ou número de processo
          </span>
          <MagnifyingGlass
            size={18}
            weight="bold"
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, CPF, benefício ou processo"
            className="w-full rounded-full border border-line bg-card py-3 pr-4 pl-11 text-sm text-ink shadow-card placeholder:text-ink-soft"
          />
        </label>
        <p aria-live="polite" className="text-sm font-semibold text-ink-soft">
          {resultLabel}
        </p>
      </div>

      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="sr-only">Filtrar por situação</legend>
        {situationFilters.map((filter) => {
          const isActive = filter.id === situation;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSituation(filter.id)}
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

      <ul className="flex flex-col gap-3">
        {filteredClients.map((client) => {
          const [firstCase] = client.cases;
          const extraCases = client.cases.length - 1;
          return (
            <li key={client.id}>
              <Link
                href={`/clientes/${client.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 rounded-lg border border-line bg-card p-4 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted lg:grid-cols-(--layout-client-row-columns)"
              >
                <span className="flex min-w-0 items-center gap-3 lg:col-span-1">
                  <Avatar
                    name={client.fullName}
                    photoSrc={client.avatarSrc}
                    size="lg"
                  />
                  <span className="min-w-0">
                    <span className="block font-bold text-ink">
                      {client.fullName}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      CPF {client.cpf}
                    </span>
                  </span>
                </span>
                <span className="hidden min-w-0 flex-col lg:flex">
                  <span className="text-sm text-ink">{client.phone}</span>
                  <span className="text-xs text-ink-soft">
                    {client.cityState}
                  </span>
                </span>
                <span className="hidden min-w-0 flex-col gap-1 lg:flex">
                  {firstCase ? (
                    <span className="text-sm text-ink">
                      {firstCase.benefit}
                    </span>
                  ) : null}
                  <span className="text-xs text-ink-soft">
                    {client.cases.length === 1
                      ? "1 caso ativo"
                      : `${client.cases.length} casos independentes`}
                    {extraCases > 0 ? ", benefícios separados" : ""}
                  </span>
                </span>
                <span
                  className={`col-start-1 row-start-2 justify-self-start rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap lg:col-auto lg:row-auto ${situationClasses[client.situationLabel]}`}
                >
                  {client.situationLabel}
                </span>
                <CaretRight
                  size={18}
                  weight="bold"
                  aria-hidden
                  className="col-start-2 row-start-1 justify-self-end text-ink-soft lg:col-auto lg:row-auto"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      {filteredClients.length === 0 ? (
        <p className="rounded-lg border border-line bg-card p-6 text-sm text-ink-soft shadow-card">
          Nenhum cliente corresponde à busca. Ajuste os termos e tente
          novamente.
        </p>
      ) : null}
    </section>
  );
}
