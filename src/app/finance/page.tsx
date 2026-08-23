import type { Metadata } from "next";
import Link from "next/link";
import { TopNav } from "@/components/dashboard/top-nav";
import { ContractsCard } from "@/components/finance/contracts-card";
import { ForecastCard } from "@/components/finance/forecast-card";
import { HoursCard } from "@/components/finance/hours-card";
import { ReceiptsCard } from "@/components/finance/receipts-card";
import { RequisitionsCard } from "@/components/finance/requisitions-card";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { CaseSliceList } from "@/components/records/case-slice-list";
import { GovernanceNote } from "@/components/ui/governance-note";
import { casesInSlice, listUnifiedCases } from "@/lib/case-views";
import { financeStats } from "@/lib/persona";

export const metadata: Metadata = {
  title: "Financeiro, Advprev CRM",
};

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const cases = await listUnifiedCases();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="finance" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Financeiro
            </h1>
            <p className="text-sm text-ink-soft">
              Contratos, honorários, minha participação, horas e recebimentos,
              sempre vinculados ao caso.
            </p>
          </header>
        </MotionReveal>

        <MotionReveal order={1}>
          <section
            aria-labelledby="finance-stats-heading"
            className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
          >
            <h2 className="sr-only" id="finance-stats-heading">
              Indicadores do financeiro
            </h2>
            {financeStats.map((stat) => {
              const isSectionAnchor = stat.href.startsWith("#");
              const linkClasses =
                "cursor-pointer after:absolute after:inset-0 after:rounded-lg";
              const linkContent = (
                <>
                  {stat.label}
                  <span className="sr-only">
                    {isSectionAnchor ? ", ir para " : ", abrir em "}
                    {stat.destinationLabel}
                  </span>
                </>
              );
              return (
                <article
                  key={stat.id}
                  className="relative flex flex-col gap-2 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
                >
                  <h3 className="text-sm leading-snug font-medium text-ink-soft">
                    {isSectionAnchor ? (
                      <a href={stat.href} className={linkClasses}>
                        {linkContent}
                      </a>
                    ) : (
                      <Link href={stat.href} className={linkClasses}>
                        {linkContent}
                      </Link>
                    )}
                  </h3>
                  <p className="text-3xl font-bold tracking-tight text-ink">
                    {stat.value}
                  </p>
                </article>
              );
            })}
          </section>
        </MotionReveal>

        <div className="grid gap-6 xl:grid-cols-(--layout-detail-columns)">
          <MotionReveal order={2} className="flex min-w-0 flex-col gap-6">
            <ContractsCard />
            <HoursCard />
          </MotionReveal>
          <MotionReveal order={3} className="flex min-w-0 flex-col gap-6">
            <ReceiptsCard />
            <ForecastCard />
            <RequisitionsCard />
          </MotionReveal>
        </div>
        <MotionReveal order={99}>
          <CaseSliceList
            headingId="finance-cases-heading"
            title="Casos e a sua situação econômica"
            description="Cada linha financeira pertence a um caso. Sem acesso a documento de saúde ou dado sensível."
            entries={casesInSlice(cases, "finance")}
            emptyLabel="Nenhum caso cadastrado."
            missingDimension={(entry) =>
              entry.financeCount === 0
                ? "Sem contrato de honorários registrado para este caso"
                : null
            }
          />
        </MotionReveal>
      </main>
      <GovernanceNote>
        Cada advogado acessa exclusivamente a própria apuração, horas e
        recebimentos; o Financeiro e a Administração acessam a visão
        consolidada, sem acesso a documento de saúde ou dado sensível, e a regra
        é aplicada no banco, com a interface apenas a refletindo.
      </GovernanceNote>
    </div>
  );
}
