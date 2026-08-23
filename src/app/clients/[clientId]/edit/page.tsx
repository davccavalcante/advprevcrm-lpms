import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { ClientForm } from "@/components/records/client-form";
import { GovernanceNote } from "@/components/ui/governance-note";
import { isStoredId } from "@/lib/case-domain";
import { readClient } from "@/lib/records-store";

export const metadata: Metadata = {
  title: "Editar cliente, Advprev CRM",
};

export default async function EditClientPage({
  params,
}: PageProps<"/clients/[clientId]/edit">) {
  const { clientId } = await params;
  if (!isStoredId(clientId)) {
    notFound();
  }
  const client = await readClient(clientId);
  if (!client) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="clients" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <div className="flex flex-col gap-3">
            <Link
              href={`/clientes/${client.id}`}
              className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm font-semibold text-ink-soft transition-colors duration-(--motion-fast) hover:text-ink"
            >
              <CaretLeft size={16} weight="bold" aria-hidden />
              Voltar para {client.fullName}
            </Link>
            <header className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-ink">
                Editar cadastro
              </h1>
              <p className="text-sm text-ink-soft">
                Alteração de dado cadastral do cliente, feita pelo advogado ou
                pela equipe autorizada.
              </p>
            </header>
          </div>
        </MotionReveal>

        <MotionReveal order={1}>
          <section
            aria-label="Dados civis do cliente"
            className="flex flex-col gap-6 rounded-lg border border-line bg-card p-6 shadow-card"
          >
            <ClientForm client={client} />
          </section>
        </MotionReveal>
      </main>
      <GovernanceNote>
        Toda alteração de dado cadastral gerará evento de auditoria com autor,
        valores antes e depois, data e hora, quando o módulo de auditoria
        existir.
      </GovernanceNote>
    </div>
  );
}
