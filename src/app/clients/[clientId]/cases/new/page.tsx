import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { CaseForm } from "@/components/records/case-form";
import { GovernanceNote } from "@/components/ui/governance-note";
import { isStoredId } from "@/lib/case-domain";
import { officeProfile } from "@/lib/office-profile";
import { readClient } from "@/lib/records-store";

export const metadata: Metadata = {
  title: "Novo caso, Advprev CRM",
};

export default async function NewCasePage({
  params,
}: PageProps<"/clients/[clientId]/cases/new">) {
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
      <TopNav activeId="cases" />
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
                Novo caso
              </h1>
              <p className="text-sm text-ink-soft">
                A esfera define contra quem se litiga, qual justiça julga e qual
                regime conta o prazo.
              </p>
            </header>
          </div>
        </MotionReveal>

        <MotionReveal order={1}>
          <section
            aria-label="Dados do caso"
            className="flex flex-col gap-6 rounded-lg border border-line bg-card p-6 shadow-card"
          >
            <CaseForm
              clientId={client.id}
              clientName={client.fullName}
              defaultLawyer={(await officeProfile()).fullName}
            />
          </section>
        </MotionReveal>
      </main>
      <GovernanceNote>
        O prazo trabalhista corre em dias úteis pelo artigo 775 da CLT, e o
        processual civil pelo artigo 219 do Código de Processo Civil. As esferas
        não compartilham regime de contagem.
      </GovernanceNote>
    </div>
  );
}
