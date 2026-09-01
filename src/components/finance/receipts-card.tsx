import { Receipt } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { receiptEntries } from "@/lib/persona";

export function ReceiptsCard() {
  return (
    <section
      id="historico-de-recebimentos"
      aria-label="Histórico de recebimentos"
      className="flex scroll-mt-6 flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <Receipt size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            Histórico de recebimentos
          </h2>
          <p className="text-sm text-ink-soft">
            Somente a minha apuração, recebimento por recebimento, sempre
            vinculada ao caso que o gerou.
          </p>
        </div>
      </header>
      <ol className="flex flex-col divide-y divide-line">
        {receiptEntries.map((entry) => (
          <li
            key={entry.id}
            className="relative flex flex-wrap items-center gap-3 rounded-md py-3 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset focus-within:bg-inset"
          >
            <Avatar
              name={entry.client}
              photoSrc={entry.clientAvatarSrc}
              size="sm"
            />
            <div className="min-w-0 flex-1 basis-40">
              <p className="text-sm font-semibold text-ink">
                <Link
                  href={entry.href}
                  className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                >
                  {entry.description}
                  <span className="sr-only">
                    , abrir o {entry.caseRef} em {entry.destinationLabel}
                  </span>
                </Link>
              </p>
              <p className="text-xs text-ink-soft">
                {entry.client}, {entry.caseRef}, {entry.dateLabel}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold whitespace-nowrap text-ink">
              {entry.amountLabel}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
