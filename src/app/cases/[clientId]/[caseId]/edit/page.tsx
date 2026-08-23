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
import { readCase, readClient } from "@/lib/records-store";

export const metadata: Metadata = {
  title: "Editar caso, Advprev CRM",
};

export default async function EditCasePage({
  params,
}: PageProps<"/cases/[clientId]/[caseId]/edit">) {
  const { clientId, caseId } = await params;
  if (!isStoredId(clientId) || !isStoredId(caseId)) {
    notFound();
  }
  const [client, record] = await Promise.all([
    readClient(clientId),
    readCase(clientId, caseId),
  ]);
  if (!client || !record) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="cases" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <div className="flex flex-col gap-3">
            <Link
              href={`/casos/${client.id}/${record.id}`}
              className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm font-semibold text-ink-soft transition-colors duration-(--motion-fast) hover:text-ink"
            >
              <CaretLeft size={16} weight="bold" aria-hidden />
              Voltar para o caso
            </Link>
            <header className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-ink">
                Editar caso
              </h1>
              <p className="text-sm text-ink-soft">
                Trocar a esfera troca o regime de contagem de prazo e a parte
                contrária esperada.
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
              record={record}
              defaultLawyer={(await officeProfile()).fullName}
            />
          </section>
        </MotionReveal>
      </main>
      <GovernanceNote>
        Os documentos anexados permanecem com o caso e não são afetados pela
        alteração cadastral.
      </GovernanceNote>
    </div>
  );
}
