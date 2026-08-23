import { CaretRight, FolderOpen } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import type { StoredClient } from "@/lib/case-domain";

/*
 * Clients the office registered, read from disk. They sit above the
 * demonstration records on purpose: what the operator wrote is the real work,
 * and the fixture below is labelled as what it is.
 */
export function StoredClientsList({
  clients,
  caseCounts,
}: {
  clients: StoredClient[];
  caseCounts: Record<string, number>;
}) {
  return (
    <section
      aria-labelledby="stored-clients-heading"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <FolderOpen size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <h2
            id="stored-clients-heading"
            className="text-lg font-bold text-ink"
          >
            Cadastrados pelo escritório
          </h2>
          <p className="text-sm text-ink-soft">
            Gravados em arquivo local. O cliente nunca se cadastra e nunca
            acessa o sistema.
          </p>
        </div>
        <p className="text-sm font-semibold whitespace-nowrap text-ink-soft">
          {clients.length === 1 ? "1 cliente" : `${clients.length} clientes`}
        </p>
      </header>

      {clients.length === 0 ? (
        <p className="rounded-md bg-inset p-4 text-sm text-ink">
          Nenhum cliente cadastrado ainda. Use "Novo cliente" para abrir o
          primeiro cadastro.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {clients.map((client) => {
            const total = caseCounts[client.id] ?? 0;
            return (
              <li
                key={client.id}
                className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md py-4 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset focus-within:bg-inset"
              >
                <Avatar name={client.fullName} size="sm" />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-sm font-bold text-ink">
                    <Link
                      href={`/clientes/${client.id}`}
                      className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                    >
                      {client.fullName}
                      <span className="sr-only">
                        , abrir a ficha do cliente
                      </span>
                    </Link>
                  </p>
                  <p className="text-xs text-ink-soft">
                    CPF {client.cpf}, {client.cityState}
                  </p>
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-ink-soft">
                  {total === 1 ? "1 caso" : `${total} casos`}
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
