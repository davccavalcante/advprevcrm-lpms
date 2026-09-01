"use client";

import { ArrowRight, MagnifyingGlass, X } from "@phosphor-icons/react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useMemo, useRef, useState } from "react";
import {
  navIconButtonClasses,
  navPanelClasses,
} from "@/components/dashboard/nav-action-styles";
import type { SearchEntry } from "@/lib/case-views";

/*
 * The list is capped so the panel never turns into an endless scroll, and the
 * cap is stated on screen whenever it hides a match. A silent truncation would
 * make the operator believe a case does not exist.
 */
const RESULT_LIMIT = 8;

/* The same normalisation the index was built with, applied to what the operator
 * types: accent and punctuation insensitive on both sides or neither. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function NavSearch({ index }: { index: SearchEntry[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(
    () => ({
      clients: index.filter((entry) => entry.kindLabel === "Cliente").length,
      cases: index.filter((entry) => entry.kindLabel === "Caso").length,
      lawsuits: index.filter((entry) => entry.kindLabel === "Processo").length,
    }),
    [index],
  );

  const term = normalize(query.trim());
  const matches =
    term.length === 0
      ? []
      : index.filter((entry) => entry.haystack.includes(term));
  const shown = matches.slice(0, RESULT_LIMIT);
  const hidden = matches.length - shown.length;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Buscar cliente, caso ou processo"
          className={navIconButtonClasses}
        >
          <MagnifyingGlass size={20} weight="bold" aria-hidden />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          aria-describedby="nav-search-scope"
          onOpenAutoFocus={(event) => {
            /* The field is the reason the panel opened, so the caret starts
             * there instead of on the close button that comes first in the DOM. */
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className={`fixed inset-x-4 top-20 mx-auto max-h-(--overlay-max-height-tall) max-w-2xl overflow-y-auto sm:top-24 ${navPanelClasses}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-xl font-bold text-ink">
                Buscar
              </Dialog.Title>
              <Dialog.Description
                id="nav-search-scope"
                className="text-sm text-ink-soft"
              >
                {counts.clients} clientes, {counts.cases} casos e{" "}
                {counts.lawsuits} processos sob a sua responsabilidade.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar a busca"
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-(--motion-fast) hover:bg-inset hover:text-ink"
            >
              <X size={20} weight="bold" aria-hidden />
            </Dialog.Close>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-ink-soft">
            Nome, CPF, número do benefício, do caso ou do processo
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Comece a digitar"
              className="w-full rounded-md border border-line bg-inset px-4 py-3 text-base font-normal text-ink placeholder:text-ink-soft"
            />
          </label>

          {term.length === 0 ? (
            <p className="text-sm text-ink-soft">
              A busca percorre apenas os registros aos quais você tem acesso, e
              cada resultado abre a tela que é dona do caso.
            </p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-ink" role="status">
              Nenhum registro encontrado para o termo digitado. Confira a grafia
              ou busque pelo número do caso.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-soft" role="status">
                {matches.length === 1
                  ? "1 registro encontrado"
                  : `${matches.length} registros encontrados`}
                {hidden > 0
                  ? `, exibindo os ${RESULT_LIMIT} primeiros; refine o termo para ver os demais`
                  : ""}
                .
              </p>
              <ol className="flex flex-col divide-y divide-line">
                {shown.map((entry) => (
                  <li key={entry.id}>
                    <Dialog.Close asChild>
                      <Link
                        href={entry.href}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-3 transition-colors duration-(--motion-fast) hover:bg-inset"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-ink">
                            {entry.title}
                          </span>
                          <span className="block text-xs text-ink-soft">
                            {entry.kindLabel}, {entry.detail}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-soft">
                          {entry.destinationLabel}
                          <ArrowRight size={14} weight="bold" aria-hidden />
                        </span>
                      </Link>
                    </Dialog.Close>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
