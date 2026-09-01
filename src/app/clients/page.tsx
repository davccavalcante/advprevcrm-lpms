import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { StoredClientsList } from "@/components/records/stored-clients-list";
import { primaryButtonClasses } from "@/components/ui/form-field";
import { GovernanceNote } from "@/components/ui/governance-note";
import { listAllCases, listClients } from "@/lib/records-store";

export const metadata: Metadata = {
  title: "Clientes, Advprev CRM",
};

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const stored = await listClients();
  const cases = await listAllCases();
  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="clients" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <div className="flex flex-wrap items-end gap-4">
            <header className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-ink">
                Clientes
              </h1>
              <p className="text-sm text-ink-soft">
                Cada cliente reúne seus dados civis, contatos, documentos e a
                lista de casos, sempre separados por benefício.
              </p>
            </header>
            <Link href="/clientes/novo" className={primaryButtonClasses}>
              <Plus size={18} weight="bold" aria-hidden />
              Novo cliente
            </Link>
          </div>
        </MotionReveal>
        <MotionReveal order={1}>
          <StoredClientsList
            clients={stored}
            caseCounts={cases.reduce<Record<string, number>>((totals, row) => {
              totals[row.client.id] = (totals[row.client.id] ?? 0) + 1;
              return totals;
            }, {})}
          />
        </MotionReveal>
      </main>
      <GovernanceNote>
        Dois pedidos distintos do mesmo cliente nunca se misturam: cada
        benefício é um caso independente, com prazos, documentos e financeiro
        próprios.
      </GovernanceNote>
    </div>
  );
}
