import type { Metadata } from "next";
import { AgendaExplorer } from "@/components/agenda/agenda-explorer";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { CaseSliceList } from "@/components/records/case-slice-list";
import { GovernanceNote } from "@/components/ui/governance-note";
import { casesInSlice, listUnifiedCases } from "@/lib/case-views";
import { agendaStats, unifiedAgendaItems } from "@/lib/persona";

export const metadata: Metadata = {
  title: "Agenda, Advprev CRM",
};

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const cases = await listUnifiedCases();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="agenda" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Agenda
            </h1>
            <p className="text-sm text-ink-soft">
              Agenda unificada de prazos, perícias e audiências, com visão por
              dia, semana e mês e alertas escalonados por proximidade.
            </p>
          </header>
        </MotionReveal>

        <MotionReveal order={1}>
          <section
            aria-labelledby="agenda-stats-heading"
            className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
          >
            <h2 className="sr-only" id="agenda-stats-heading">
              Indicadores da agenda
            </h2>
            {agendaStats.map((stat) => (
              <article
                key={stat.id}
                className="relative flex flex-col gap-2 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
              >
                <h3 className="text-sm leading-snug font-medium text-ink-soft">
                  <a
                    href={`#${stat.sectionId}`}
                    className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
                  >
                    {stat.label}
                    <span className="sr-only">
                      , ir para {stat.sectionLabel}
                    </span>
                  </a>
                </h3>
                <p className="text-4xl font-bold tracking-tight text-ink">
                  {stat.value}
                </p>
              </article>
            ))}
          </section>
        </MotionReveal>

        <MotionReveal order={2}>
          <AgendaExplorer items={unifiedAgendaItems} />
        </MotionReveal>
        <MotionReveal order={99}>
          <CaseSliceList
            headingId="agenda-cases-heading"
            title="Casos com compromissos a acompanhar"
            description="Todo compromisso pertence a um caso. Os casos abaixo estão ativos e é sobre eles que prazo, perícia e audiência são marcados."
            entries={casesInSlice(cases, "agenda")}
            emptyLabel="Nenhum caso ativo."
            missingDimension={(entry) =>
              entry.agendaCount === 0
                ? "Nenhum compromisso vinculado a este caso ainda"
                : null
            }
          />
        </MotionReveal>
      </main>
      <GovernanceNote>
        O cálculo de vencimento é apoio e considera o calendário por tribunal,
        revisado e com ajuste manual registrado; a responsabilidade profissional
        permanece do advogado, que confirma cada vencimento.
      </GovernanceNote>
    </div>
  );
}
