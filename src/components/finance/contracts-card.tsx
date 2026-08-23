import { FileText } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { feeContracts } from "@/lib/persona";

export function ContractsCard() {
  return (
    <section
      aria-label="Contratos de honorários"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
          <FileText size={18} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">
            Contratos de honorários
          </h2>
          <p className="text-sm text-ink-soft">
            Cada caso tem o seu contrato, com percentual sobre o proveito
            econômico, honorários fixos quando houver e sucumbência.
          </p>
        </div>
      </header>
      <ol className="flex flex-col divide-y divide-line">
        {feeContracts.map((contract) => (
          <li
            key={contract.id}
            className="relative flex items-start gap-3 rounded-md py-4 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset focus-within:bg-inset"
          >
            <Avatar
              name={contract.client}
              photoSrc={contract.clientAvatarSrc}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                <Link
                  href={contract.href}
                  className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                >
                  {contract.client}
                  <span className="sr-only">
                    , abrir o {contract.caseRef} em {contract.destinationLabel}
                  </span>
                </Link>
              </p>
              <p className="text-xs text-ink-soft">
                {contract.benefit}, {contract.caseRef}
              </p>
              <p className="text-xs leading-relaxed text-ink">
                {contract.contractLabel}.
              </p>
              <p className="text-xs font-semibold text-ink-soft">
                {contract.participationLabel}.
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-t border-line pt-4 text-xs text-ink-soft">
        A participação é apurada automaticamente quando o caso gera receita, e
        toda alteração de dado financeiro fica registrada em auditoria.
      </p>
    </section>
  );
}
