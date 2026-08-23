import type { Metadata } from "next";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { CasesExplorer } from "@/components/records/cases-explorer";
import { GovernanceNote } from "@/components/ui/governance-note";
import { caseSpheres } from "@/lib/case-domain";
import { listUnifiedCases } from "@/lib/case-views";

export const metadata: Metadata = {
  title: "Casos, Advprev CRM",
};

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const rows = await listUnifiedCases();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="cases" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Casos
            </h1>
            <p className="text-sm text-ink-soft">
              Todos os casos do escritório nas esferas em que ele atua, com
              filtro por esfera, por situação e por tipo.
            </p>
          </header>
        </MotionReveal>

        <MotionReveal order={1}>
          <section
            aria-labelledby="spheres-heading"
            className="grid gap-6 md:grid-cols-2 xl:grid-cols-4"
          >
            <h2 id="spheres-heading" className="sr-only">
              Esferas de atuação do escritório
            </h2>
            {caseSpheres.map((sphere) => (
              <article
                key={sphere.id}
                className="flex flex-col gap-2 rounded-lg border border-line bg-card p-6 shadow-card"
              >
                <h3 className="text-base font-bold text-ink">
                  {sphere.label}, {sphere.courtLabel}
                </h3>
                <p className="text-xs leading-relaxed text-ink-soft">
                  {sphere.scopeLabel}
                </p>
                <p className="text-xs leading-relaxed text-ink-soft">
                  {sphere.deadlineRegimeLabel}
                </p>
              </article>
            ))}
          </section>
        </MotionReveal>

        <MotionReveal order={2}>
          <CasesExplorer rows={rows} />
        </MotionReveal>
      </main>
      <GovernanceNote>
        Um único fato pode abrir casos em esferas diferentes, contra partes
        diferentes. Eles seguem independentes, com documentos, prazos e
        financeiro próprios, e a interface nunca os mistura.
      </GovernanceNote>
    </div>
  );
}
