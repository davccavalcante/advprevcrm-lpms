import type { Metadata } from "next";
import { TopNav } from "@/components/dashboard/top-nav";
import { AwaitingDocs } from "@/components/intake/awaiting-docs";
import { CommunicationLog } from "@/components/intake/communication-log";
import { IntakeStateProvider } from "@/components/intake/intake-state";
import { IntakeStats } from "@/components/intake/intake-stats";
import { TriageQueue } from "@/components/intake/triage-queue";
import { UnansweredContacts } from "@/components/intake/unanswered-contacts";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { CaseSliceList } from "@/components/records/case-slice-list";
import { GovernanceNote } from "@/components/ui/governance-note";
import { casesInSlice, listUnifiedCases } from "@/lib/case-views";
import { triageQueue } from "@/lib/persona";

export const metadata: Metadata = {
  title: "Atendimento, Advprev CRM",
};

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const cases = await listUnifiedCases();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="intake" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Atendimento
            </h1>
            <p className="text-sm text-ink-soft">
              Recepção, triagem e qualificação com apoio da Inteligência Massiva
              (IM), sempre sob confirmação humana.
            </p>
          </header>
        </MotionReveal>

        <IntakeStateProvider>
          <MotionReveal order={1}>
            <IntakeStats />
          </MotionReveal>

          <div className="grid gap-6 xl:grid-cols-(--layout-detail-columns)">
            <MotionReveal order={2} className="flex min-w-0 flex-col gap-6">
              <TriageQueue items={triageQueue} />
              <CommunicationLog />
            </MotionReveal>
            <MotionReveal order={3} className="flex min-w-0 flex-col gap-6">
              <AwaitingDocs />
              <UnansweredContacts />
            </MotionReveal>
          </div>
        </IntakeStateProvider>
        <MotionReveal order={99}>
          <CaseSliceList
            headingId="intake-cases-heading"
            title="Fila de casos incompletos"
            description="Casos que ainda dependem de documento ou de retorno do cliente. A condição é derivada da ausência de anexo no caso, não de um campo próprio."
            entries={casesInSlice(cases, "intake")}
            emptyLabel="Nenhum caso pendente de instrução. Toda a fila documental está em dia."
            missingDimension={(entry) =>
              entry.documentCount === 0 ? "Sem documento anexado" : null
            }
          />
        </MotionReveal>
      </main>
      <GovernanceNote>
        O Atendimento não acessa o módulo financeiro; a regra de acesso é
        aplicada no banco e a interface apenas a reflete.
      </GovernanceNote>
    </div>
  );
}
