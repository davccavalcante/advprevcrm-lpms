import {
  CaretLeft,
  EnvelopeSimple,
  FileText,
  Phone,
  Scales,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/dashboard/top-nav";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { StoredClientRecord } from "@/components/records/stored-client-record";
import { Avatar } from "@/components/ui/avatar";
import { GovernanceNote } from "@/components/ui/governance-note";
import { isStoredId } from "@/lib/case-domain";
import { findClientById, personaClients } from "@/lib/persona";
import { listCasesOfClient, readClient } from "@/lib/records-store";

const situationClasses = {
  Ativo: "bg-critical-soft text-ink",
  "Em análise": "bg-attention-soft text-ink",
  "Documentação pendente": "bg-neutral-soft text-ink",
} as const;

const documentStatusPresentation = {
  validated: { label: "Validado", className: "bg-critical-soft text-ink" },
  pending: {
    label: "Pendente de validação humana",
    className: "bg-attention-soft text-ink",
  },
} as const;

export function generateStaticParams() {
  return personaClients.map((client) => ({ clientId: client.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/clients/[clientId]">): Promise<Metadata> {
  const { clientId } = await params;
  if (isStoredId(clientId)) {
    const stored = await readClient(clientId);
    return {
      title: stored
        ? `${stored.fullName}, Advprev CRM`
        : "Cliente, Advprev CRM",
    };
  }
  const client = findClientById(clientId);
  return {
    title: client ? `${client.fullName}, Advprev CRM` : "Cliente, Advprev CRM",
  };
}

export default async function ClientRecordPage({
  params,
}: PageProps<"/clients/[clientId]">) {
  const { clientId } = await params;

  /*
   * Two sources live under the same route. A stored identifier is a client the
   * office registered and it comes from disk; anything else is one of the
   * demonstration records, which stay until the director orders their removal.
   */
  if (isStoredId(clientId)) {
    const stored = await readClient(clientId);
    if (!stored) {
      notFound();
    }
    const cases = await listCasesOfClient(clientId);
    return (
      <div className="flex min-h-dvh w-full flex-col bg-page">
        <TopNav activeId="clients" />
        <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
          <StoredClientRecord client={stored} cases={cases} />
        </main>
        <GovernanceNote>
          Dois pedidos distintos do mesmo cliente nunca se misturam: cada
          benefício ou ação é um caso independente, com prazos, documentos e
          financeiro próprios.
        </GovernanceNote>
      </div>
    );
  }

  const client = findClientById(clientId);
  if (!client) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-page">
      <TopNav activeId="clients" />
      <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-10">
        <MotionReveal order={0}>
          <div className="flex flex-col gap-4">
            <Link
              href="/clientes"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors duration-(--motion-fast) hover:text-ink"
            >
              <CaretLeft size={16} weight="bold" aria-hidden />
              Voltar para clientes
            </Link>
            <header className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-card p-6 shadow-card">
              <Avatar
                name={client.fullName}
                photoSrc={client.avatarSrc}
                size="xl"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  {client.fullName}
                </h1>
                <p className="text-sm text-ink-soft">
                  CPF {client.cpf}, {client.cityState}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {client.vulnerabilityLabel ? (
                  <span className="rounded-full bg-attention-soft px-3 py-1.5 text-xs font-bold whitespace-nowrap text-ink">
                    {client.vulnerabilityLabel}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap ${situationClasses[client.situationLabel]}`}
                >
                  {client.situationLabel}
                </span>
              </div>
            </header>
          </div>
        </MotionReveal>

        <div className="grid gap-6 xl:grid-cols-(--layout-record-columns)">
          <MotionReveal order={1} className="flex min-w-0 flex-col gap-6">
            <section
              aria-label="Dados civis"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <h2 className="text-lg font-bold text-ink">Dados civis</h2>
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Nascimento</dt>
                  <dd className="text-right font-semibold text-ink">
                    {client.birthDateLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">CPF</dt>
                  <dd className="text-right font-semibold text-ink">
                    {client.cpf}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">NIT</dt>
                  <dd className="text-right font-semibold text-ink">
                    {client.nit}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Documento de identidade</dt>
                  <dd className="text-right font-semibold text-ink">
                    {client.rg}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Filiação</dt>
                  <dd className="text-right font-semibold text-ink">
                    {client.motherName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Estado civil</dt>
                  <dd className="text-right font-semibold text-ink">
                    {client.maritalStatus}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Endereço</dt>
                  <dd className="text-right font-semibold text-ink">
                    {client.address}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-label="Contatos"
              className="relative flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
            >
              <h2 className="text-lg font-bold text-ink">
                <Link
                  href="/atendimento"
                  className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
                >
                  Contatos
                  <span className="sr-only">
                    , abrir o registro de comunicações no Atendimento
                  </span>
                </Link>
              </h2>
              <ul className="flex flex-col gap-3 text-sm">
                <li className="flex items-center gap-2.5">
                  <Phone
                    size={16}
                    weight="bold"
                    aria-hidden
                    className="text-ink-soft"
                  />
                  <span className="font-semibold text-ink">{client.phone}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <EnvelopeSimple
                    size={16}
                    weight="bold"
                    aria-hidden
                    className="text-ink-soft"
                  />
                  <span className="font-semibold text-ink">{client.email}</span>
                </li>
              </ul>
              <div className="border-t border-line pt-3">
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                  Dados para recebimento
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {client.bankInfoLabel}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Utilizados exclusivamente para o recebimento do benefício.
                </p>
              </div>
              <p className="border-t border-line pt-3 text-xs text-ink-soft">
                Toda comunicação com o cliente é registrada e vinculada ao caso
                correspondente.
              </p>
            </section>
          </MotionReveal>

          <MotionReveal order={2} className="flex min-w-0 flex-col gap-6">
            <section
              aria-label="Casos por benefício"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <header>
                <h2 className="text-lg font-bold text-ink">
                  Casos por benefício
                </h2>
                <p className="text-sm text-ink-soft">
                  Cada benefício é um caso independente, com prazos, documentos
                  e financeiro próprios.
                </p>
              </header>
              <ul className="flex flex-col gap-3">
                {client.cases.map((clientCase) => (
                  <li
                    key={clientCase.caseRef}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-inset p-4"
                  >
                    <span className="inline-flex size-10 items-center justify-center rounded-full bg-card text-ink">
                      <Scales size={18} weight="bold" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 basis-56">
                      <span className="block font-bold text-ink">
                        {clientCase.benefit}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {clientCase.caseRef},{" "}
                        {clientCase.openDeadlines === 1
                          ? "1 prazo em aberto"
                          : `${clientCase.openDeadlines} prazos em aberto`}
                      </span>
                      {clientCase.benefitNumber || clientCase.lawsuitNumber ? (
                        <span className="block text-xs text-ink-soft">
                          {[
                            clientCase.benefitNumber,
                            clientCase.lawsuitNumber
                              ? `Processo ${clientCase.lawsuitNumber}`
                              : undefined,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="rounded-full bg-card px-2.5 py-1 text-xs font-bold whitespace-nowrap text-ink">
                      {clientCase.phaseLabel}
                    </span>
                    <Link
                      href={clientCase.href}
                      className="cursor-pointer rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-ink-soft transition-colors duration-(--motion-fast) hover:border-brand-muted hover:text-ink"
                    >
                      Abrir caso
                      <span className="sr-only">
                        {" "}
                        {clientCase.caseRef} em {clientCase.destinationLabel}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section
              aria-label="Documentos do cliente"
              className="relative flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card transition-colors duration-(--motion-fast) hover:border-brand-muted focus-within:border-brand-muted"
            >
              <header>
                <h2 className="text-lg font-bold text-ink">
                  <Link
                    href="/atendimento"
                    className="cursor-pointer after:absolute after:inset-0 after:rounded-lg"
                  >
                    Documentos
                    <span className="sr-only">
                      , abrir a coleta documental no Atendimento
                    </span>
                  </Link>
                </h2>
                <p className="text-sm text-ink-soft">
                  Extração assistida com confiança medida; campo abaixo do
                  limiar aguarda validação humana.
                </p>
              </header>
              <ul className="flex flex-col divide-y divide-line">
                {client.documents.map((doc) => {
                  const status = documentStatusPresentation[doc.status];
                  return (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                    >
                      <FileText
                        size={18}
                        weight="bold"
                        aria-hidden
                        className="text-ink-soft"
                      />
                      <span className="min-w-0 flex-1 basis-56">
                        <span className="block text-sm font-semibold text-ink">
                          {doc.name}
                        </span>
                        <span className="block text-xs text-ink-soft">
                          {doc.confidenceLabel}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-line pt-4 text-xs text-ink-soft">
                O documento original permanece acessível ao lado do dado
                extraído, e toda leitura e download gera evento de auditoria.
              </p>
            </section>
          </MotionReveal>
        </div>
      </main>
      <GovernanceNote />
    </div>
  );
}
