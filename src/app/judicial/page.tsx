import type { Metadata } from "next";
import Link from "next/link";
import { CaptureBoard } from "@/components/capture/capture-board";
import { TopNav } from "@/components/dashboard/top-nav";
import { LawsuitsExplorer } from "@/components/judicial/lawsuits-explorer";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { CaseSliceList } from "@/components/records/case-slice-list";
import { GovernanceNote } from "@/components/ui/governance-note";
import { captureBoardData } from "@/lib/capture/board-data";
import { casesInSlice, listUnifiedCases } from "@/lib/case-views";
import { judicialLawsuits, judicialStats } from "@/lib/persona";

export const metadata: Metadata = {
  title: "Judicial, Advprev CRM",
};

export const dynamic = "force-dynamic";

export default async function JudicialPage() {
  const cases = await listUnifiedCases();
  const board = await captureBoardData();

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="judicial" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Judicial
            </h1>
            <p className="text-sm text-ink-soft">
              Processos organizados por subcategoria, com acompanhamento de
              movimentações, intimações, prazos, perícias, audiências e peças.
            </p>
          </header>
        </MotionReveal>

        <MotionReveal order={1}>
          <CaptureBoard
            cases={board.cases}
            communications={board.communications}
            health={board.health}
            monitoredLabels={board.monitoredLabels}
            signatureNote={board.signatureNote}
            signatureVerified={board.signatureVerified}
            unlinkedGroups={board.unlinkedGroups}
          />
        </MotionReveal>

        <MotionReveal order={2}>
          <section
            aria-labelledby="judicial-stats-heading"
            className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
          >
            <h2 className="sr-only" id="judicial-stats-heading">
              Indicadores do judicial
            </h2>
            {judicialStats.map((fixtureStat) => {
              /* One of these indicators has a real source now: what the capture
               * brought in today. It is read from the store and never from the
               * demonstration dataset, so it cannot contradict the queue of
               * publications on this same screen. */
              const stat =
                fixtureStat.id === "summonses"
                  ? {
                      ...fixtureStat,
                      value: String(board.capturedToday),
                      href: "#publicacoes",
                      destinationLabel: "Publicações e intimações",
                    }
                  : fixtureStat;
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
                  <p className="text-4xl font-bold tracking-tight text-ink">
                    {stat.value}
                  </p>
                </article>
              );
            })}
          </section>
        </MotionReveal>

        <MotionReveal order={2}>
          <LawsuitsExplorer lawsuits={judicialLawsuits} />
        </MotionReveal>
        <MotionReveal order={99}>
          <CaseSliceList
            headingId="judicial-cases-heading"
            title="Casos em fase judicial por esfera"
            description="Trabalhista contra o empregador, Estadual acidentário e Federal previdenciário contra o INSS, cada esfera com o seu regime de prazo."
            entries={casesInSlice(cases, "judicial")}
            emptyLabel="Nenhum caso em fase judicial."
            missingDimension={(entry) =>
              entry.origin === "stored"
                ? "Processo, movimentações e intimações ainda não vinculados a este caso"
                : null
            }
          />
        </MotionReveal>
      </main>
      <GovernanceNote>
        As movimentações capturadas servem ao acompanhamento e nunca são fonte
        de prazo; o prazo nasce da intimação publicada no Diário de Justiça
        Eletrônico Nacional, com o texto integral preservado.
      </GovernanceNote>
    </div>
  );
}
