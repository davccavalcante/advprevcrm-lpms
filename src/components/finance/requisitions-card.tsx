import { Bank } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { requisitionEntries } from "@/lib/persona";

export function RequisitionsCard() {
  return (
    <section
      aria-label="Requisições e precatórios"
      className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Bank size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            Requisições e precatórios
          </h2>
          <p className="text-sm text-ink-soft">
            Expedição, pagamento, previsão de recebimento e conciliação.
          </p>
        </div>
      </header>
      <ol className="flex flex-col divide-y divide-line">
        {requisitionEntries.map((entry) => (
          <li
            key={entry.id}
            className="relative flex items-start gap-3 rounded-md py-3 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset focus-within:bg-inset"
          >
            <Avatar
              name={entry.client}
              photoSrc={entry.clientAvatarSrc}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                <Link
                  href={entry.href}
                  className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                >
                  {entry.kindLabel}
                  <span className="sr-only">
                    , abrir o {entry.caseRef} em {entry.destinationLabel}
                  </span>
                </Link>
              </p>
              <p className="text-xs text-ink-soft">
                {entry.client}, {entry.caseRef}
              </p>
              <p className="text-xs leading-relaxed text-ink-soft">
                {entry.statusLabel}.
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-line pt-3 text-xs text-ink-soft">
        Nenhuma requisição aguarda expedição nos meus casos.
      </p>
    </section>
  );
}
