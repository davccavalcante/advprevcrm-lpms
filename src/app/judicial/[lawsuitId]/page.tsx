import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { Avatar } from "@/components/ui/avatar";
import { GovernanceNote } from "@/components/ui/governance-note";
import {
  findLawsuitById,
  judicialLawsuits,
  judicialSubcategories,
} from "@/lib/persona";

export function generateStaticParams() {
  return judicialLawsuits.map((lawsuit) => ({ lawsuitId: lawsuit.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/judicial/[lawsuitId]">): Promise<Metadata> {
  const { lawsuitId } = await params;
  const lawsuit = findLawsuitById(lawsuitId);
  return {
    title: lawsuit
      ? `${lawsuit.caseRef}, Judicial, Advprev CRM`
      : "Judicial, Advprev CRM",
  };
}

const deadlineStatusPresentation = {
  calculated: { label: "Calculado", className: "bg-attention-soft text-ink" },
  confirmed: { label: "Confirmado", className: "bg-neutral-soft text-ink" },
} as const;

export default async function LawsuitDetailPage({
  params,
}: PageProps<"/judicial/[lawsuitId]">) {
  const { lawsuitId } = await params;
  const lawsuit = findLawsuitById(lawsuitId);
  if (!lawsuit) {
    notFound();
  }
  const subcategoryLabel =
    judicialSubcategories.find((entry) => entry.id === lawsuit.subcategory)
      ?.label ?? "";

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="judicial" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <header className="flex flex-wrap items-center gap-4">
            <Avatar
              name={lawsuit.client}
              photoSrc={lawsuit.clientAvatarSrc}
              size="xl"
            />
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-sm text-ink-soft">
                <Link
                  href="/judicial"
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Judicial
                </Link>
                , {subcategoryLabel}
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-ink">
                {lawsuit.client}
              </h1>
              <p className="text-sm text-ink-soft">
                {lawsuit.benefit}, {lawsuit.caseRef}
              </p>
            </div>
            <span className="rounded-full bg-neutral-soft px-3 py-1.5 text-xs font-bold whitespace-nowrap text-ink">
              {lawsuit.phaseLabel}
            </span>
          </header>
        </MotionReveal>

        <div className="grid gap-6 xl:grid-cols-(--layout-detail-columns)">
          <MotionReveal order={1} className="flex min-w-0 flex-col gap-6">
            <section
              aria-label="Dados da distribuição"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <h2 className="text-lg font-bold text-ink">
                Dados da distribuição
              </h2>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Número do processo
                  </dt>
                  <dd className="text-sm font-semibold text-ink">
                    {lawsuit.lawsuitNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Juízo
                  </dt>
                  <dd className="text-sm font-semibold text-ink">
                    {lawsuit.courtLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Classe
                  </dt>
                  <dd className="text-sm font-semibold text-ink">
                    {lawsuit.classLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Distribuição
                  </dt>
                  <dd className="text-sm font-semibold text-ink">
                    {lawsuit.distributionDateLabel}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-label="Movimentações capturadas"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <h2 className="text-lg font-bold text-ink">
                Movimentações capturadas
              </h2>
              <ol className="flex flex-col divide-y divide-line">
                {lawsuit.movements.map((movement) => (
                  <li
                    key={movement.id}
                    className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0"
                  >
                    <p className="text-sm font-semibold text-ink">
                      {movement.dateLabel}, {movement.description}
                    </p>
                    <p className="text-xs text-ink-soft">
                      Fonte: {movement.sourceLabel}, texto original preservado.
                    </p>
                  </li>
                ))}
              </ol>
              <p className="border-t border-line pt-3 text-xs text-ink-soft">
                Movimentação é acompanhamento e nunca fonte de prazo.
              </p>
            </section>

            <section
              aria-label="Intimações"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <h2 className="text-lg font-bold text-ink">Intimações</h2>
              {lawsuit.summonses.length > 0 ? (
                <ol className="flex flex-col divide-y divide-line">
                  {lawsuit.summonses.map((summons) => (
                    <li
                      key={summons.id}
                      className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0"
                    >
                      <p className="text-sm font-semibold text-ink">
                        {summons.summary}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {summons.dateLabel}.
                      </p>
                      <p className="text-xs text-ink-soft">
                        {summons.generatedDeadlineLabel}.
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-md border border-line bg-inset p-4 text-sm text-ink-soft">
                  Nenhuma intimação pendente de tratamento neste processo.
                </p>
              )}
              <p className="border-t border-line pt-3 text-xs text-ink-soft">
                A fonte oficial é o Diário de Justiça Eletrônico Nacional; todo
                prazo nasce da intimação publicada, no estado calculado.
              </p>
            </section>

            <section
              aria-label="Peças"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <h2 className="text-lg font-bold text-ink">Peças</h2>
              <ol className="flex flex-col divide-y divide-line">
                {lawsuit.filings.map((filing) => (
                  <li
                    key={filing.id}
                    className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0"
                  >
                    <p className="text-sm font-semibold text-ink">
                      {filing.title}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {filing.statusLabel}.
                    </p>
                  </li>
                ))}
              </ol>
              <p className="border-t border-line pt-3 text-xs text-ink-soft">
                O sistema atua até a preparação, montagem, conferência e
                registro da peça protocolada; o protocolo é ato do advogado no
                sistema do tribunal.
              </p>
            </section>
          </MotionReveal>

          <MotionReveal order={2} className="flex min-w-0 flex-col gap-6">
            <section
              aria-label="Prazos do processo"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <h2 className="text-lg font-bold text-ink">Prazos</h2>
              <ul className="flex flex-col divide-y divide-line">
                {lawsuit.deadlines.map((deadline) => {
                  const status = deadlineStatusPresentation[deadline.status];
                  return (
                    <li
                      key={deadline.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">
                          {deadline.title}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {deadline.dueLabel}.
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-line pt-3 text-xs text-ink-soft">
                O cálculo é apoio; somente o advogado confirma um vencimento,
                com registro em auditoria.
              </p>
            </section>

            <section
              aria-label="Audiências e perícias"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <h2 className="text-lg font-bold text-ink">
                Audiências e perícias
              </h2>
              {lawsuit.hearings.length > 0 ? (
                <ul className="flex flex-col divide-y divide-line">
                  {lawsuit.hearings.map((hearing) => (
                    <li
                      key={hearing.id}
                      className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0"
                    >
                      <p className="text-sm font-semibold text-ink">
                        {hearing.kindLabel}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {hearing.whenLabel}, {hearing.placeLabel}.
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-line bg-inset p-4 text-sm text-ink-soft">
                  Nenhuma audiência ou perícia judicial agendada.
                </p>
              )}
            </section>

            <section
              aria-label="Histórico do processo"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <h2 className="text-lg font-bold text-ink">Histórico</h2>
              <p className="text-sm leading-relaxed text-ink-soft">
                O histórico completo reúne a distribuição, as movimentações
                capturadas com fonte e data, as intimações com o texto integral
                e as peças registradas, na ordem em que aparecem nesta página.
              </p>
            </section>
          </MotionReveal>
        </div>
      </main>
      <GovernanceNote>
        Cada caso é independente por benefício; este processo pertence
        exclusivamente ao {lawsuit.caseRef}.
      </GovernanceNote>
    </div>
  );
}
