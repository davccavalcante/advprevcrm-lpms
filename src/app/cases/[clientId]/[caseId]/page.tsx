import {
  CaretLeft,
  Gavel,
  PencilSimple,
  User,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { CaseCaptureRecords } from "@/components/records/case-capture-records";
import { CaseDocuments } from "@/components/records/case-documents";
import { secondaryButtonClasses } from "@/components/ui/form-field";
import { GovernanceNote } from "@/components/ui/governance-note";
import { caseStatuses, isStoredId, sphereOf } from "@/lib/case-domain";
import { readCase, readClient } from "@/lib/records-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/cases/[clientId]/[caseId]">): Promise<Metadata> {
  const { clientId, caseId } = await params;
  if (!isStoredId(clientId) || !isStoredId(caseId)) {
    return { title: "Caso, Advprev CRM" };
  }
  const record = await readCase(clientId, caseId);
  return {
    title: record ? `${record.caseType}, Advprev CRM` : "Caso, Advprev CRM",
  };
}

export default async function CaseRecordPage({
  params,
}: PageProps<"/cases/[clientId]/[caseId]">) {
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

  const sphere = sphereOf(record.sphere);
  const statusLabel =
    caseStatuses.find((status) => status.id === record.status)?.label ??
    record.status;

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="cases" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <div className="flex flex-col gap-4">
            <Link
              href={`/clientes/${client.id}`}
              className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm font-semibold text-ink-soft transition-colors duration-(--motion-fast) hover:text-ink"
            >
              <CaretLeft size={16} weight="bold" aria-hidden />
              Voltar para {client.fullName}
            </Link>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1 basis-64">
                <h1 className="text-3xl font-bold tracking-tight text-ink">
                  {record.caseType}
                </h1>
                <p className="text-sm text-ink-soft">
                  {sphere.label}, {sphere.courtLabel}, contra{" "}
                  {record.opposingParty}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-neutral-soft px-4 py-2 text-xs font-bold whitespace-nowrap text-ink">
                {statusLabel}
              </span>
              <Link
                href={`/casos/${client.id}/${record.id}/editar`}
                className={secondaryButtonClasses}
              >
                <PencilSimple size={18} weight="bold" aria-hidden />
                Editar caso
              </Link>
            </div>
          </div>
        </MotionReveal>

        <div className="grid gap-6 xl:grid-cols-(--layout-detail-columns)">
          <MotionReveal order={1} className="flex min-w-0 flex-col gap-6">
            <CaseCaptureRecords
              caseId={record.id}
              clientId={client.id}
              deadlines={record.deadlines}
              lawsuitNumber={record.lawsuitNumber ?? null}
              events={record.events}
              reminders={record.reminders}
              tasks={record.tasks}
            />
            <CaseDocuments
              clientId={client.id}
              caseId={record.id}
              documents={record.documents}
            />
          </MotionReveal>

          <MotionReveal order={2} className="flex min-w-0 flex-col gap-6">
            <section
              aria-label="Dados do caso"
              className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <header className="flex items-center gap-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
                  <Gavel size={18} weight="bold" aria-hidden />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-ink">Dados do caso</h2>
                  <p className="text-sm text-ink-soft">
                    Independente dos demais casos deste cliente.
                  </p>
                </div>
              </header>
              <dl className="flex flex-col divide-y divide-line">
                {[
                  { label: "Esfera", value: sphere.label },
                  { label: "Justiça", value: sphere.courtLabel },
                  { label: "Tipo", value: record.caseType },
                  { label: "Parte contrária", value: record.opposingParty },
                  { label: "Situação", value: statusLabel },
                  {
                    label: "Advogado responsável",
                    value: record.responsibleLawyer,
                  },
                  {
                    label: "Referência",
                    value: record.reference ?? "Não informada",
                  },
                ].map((entry) => (
                  <div
                    key={entry.label}
                    className="flex flex-wrap gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                  >
                    <dt className="min-w-36 text-xs text-ink-soft">
                      {entry.label}
                    </dt>
                    <dd className="min-w-0 flex-1 basis-40 text-sm break-words text-ink">
                      {entry.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {record.factSummary ? (
              <section
                aria-label="Fato que originou o caso"
                className="flex flex-col gap-3 rounded-lg border border-line bg-card p-6 shadow-card"
              >
                <h2 className="text-lg font-bold text-ink">Fato</h2>
                <p className="text-sm leading-relaxed text-ink">
                  {record.factSummary}
                </p>
              </section>
            ) : null}

            <section
              aria-label="Regime jurídico da esfera"
              className="flex flex-col gap-3 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <header className="flex items-center gap-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
                  <User size={18} weight="bold" aria-hidden />
                </span>
                <h2 className="text-lg font-bold text-ink">
                  Regime desta esfera
                </h2>
              </header>
              <p className="text-xs leading-relaxed text-ink">
                {sphere.scopeLabel}
              </p>
              <p className="text-xs leading-relaxed text-ink">
                {sphere.groundLabel}
              </p>
              <p className="text-xs leading-relaxed text-ink">
                {sphere.deadlineRegimeLabel}
              </p>
            </section>
          </MotionReveal>
        </div>
      </main>
      <GovernanceNote>
        Documento original sempre preservado ao lado de qualquer dado dele
        extraído. Nesta fase nada é extraído, e nenhum estado de processamento é
        alcançado por automação.
      </GovernanceNote>
    </div>
  );
}
