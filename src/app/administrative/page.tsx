import type { Metadata } from "next";
import { CrpsAppealsCard } from "@/components/administrative/crps-appeals-card";
import { DecisionsCard } from "@/components/administrative/decisions-card";
import { ExaminationsCard } from "@/components/administrative/examinations-card";
import { ExigenciesCard } from "@/components/administrative/exigencies-card";
import { JudicialTrackingCard } from "@/components/administrative/judicial-tracking-card";
import { RequirementsCard } from "@/components/administrative/requirements-card";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { CaseSliceList } from "@/components/records/case-slice-list";
import { GovernanceNote } from "@/components/ui/governance-note";
import { casesInSlice, listUnifiedCases } from "@/lib/case-views";
import { administrativeStats } from "@/lib/persona";

export const metadata: Metadata = {
  title: "Administrativo, Advprev CRM",
};

export const dynamic = "force-dynamic";

export default async function AdministrativePage() {
  const cases = await listUnifiedCases();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="administrative" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Administrativo
            </h1>
            <p className="text-sm text-ink-soft">
              Procedimentos junto ao INSS: requerimentos, exigências e seus
              prazos, perícias administrativas, decisões e recursos.
            </p>
          </header>
        </MotionReveal>

        <MotionReveal order={1}>
          <section
            aria-labelledby="administrative-stats-heading"
            className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
          >
            <h2 className="sr-only" id="administrative-stats-heading">
              Indicadores do administrativo
            </h2>
            {administrativeStats.map((stat) => (
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

        <div className="grid gap-6 xl:grid-cols-(--layout-detail-columns)">
          <MotionReveal order={2} className="flex min-w-0 flex-col gap-6">
            <RequirementsCard />
            <DecisionsCard />
          </MotionReveal>
          <MotionReveal order={3} className="flex min-w-0 flex-col gap-6">
            <ExigenciesCard />
            <ExaminationsCard />
            <CrpsAppealsCard />
          </MotionReveal>
        </div>

        <MotionReveal order={4}>
          <JudicialTrackingCard />
        </MotionReveal>
        <MotionReveal order={99}>
          <CaseSliceList
            headingId="administrative-cases-heading"
            title="Casos em fase administrativa"
            description="Recorte dos casos junto ao INSS, do requerimento à decisão, vindos do disco e da demonstração."
            entries={casesInSlice(cases, "administrative")}
            emptyLabel="Nenhum caso em fase administrativa."
            missingDimension={(entry) =>
              entry.origin === "stored"
                ? "Requerimento, exigências e decisão ainda não registrados neste caso"
                : null
            }
          />
        </MotionReveal>
      </main>
      <GovernanceNote>
        Os prazos administrativos seguem regime próprio, distinto do processual;
        todo vencimento nasce calculado e somente um advogado o confirma, com
        registro em auditoria.
      </GovernanceNote>
    </div>
  );
}
