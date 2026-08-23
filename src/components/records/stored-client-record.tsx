import {
  BellRinging,
  CaretLeft,
  CaretRight,
  IdentificationCard,
  PencilSimple,
  Plus,
  Scales,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { MotionReveal } from "@/components/motion/motion-reveal";
import { Avatar } from "@/components/ui/avatar";
import {
  primaryButtonClasses,
  secondaryButtonClasses,
} from "@/components/ui/form-field";
import {
  caseStatuses,
  type StoredCase,
  type StoredClient,
  sphereOf,
} from "@/lib/case-domain";

function statusLabelOf(id: StoredCase["status"]): string {
  return caseStatuses.find((status) => status.id === id)?.label ?? id;
}

function birthDateLabel(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function StoredClientRecord({
  client,
  cases,
}: {
  client: StoredClient;
  cases: StoredCase[];
}) {
  return (
    <>
      <MotionReveal order={0}>
        <div className="flex flex-col gap-4">
          <Link
            href="/clientes"
            className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm font-semibold text-ink-soft transition-colors duration-(--motion-fast) hover:text-ink"
          >
            <CaretLeft size={16} weight="bold" aria-hidden />
            Voltar para clientes
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={client.fullName} size="xl" />
            <div className="min-w-0 flex-1 basis-64">
              <h1 className="text-3xl font-bold tracking-tight text-ink">
                {client.fullName}
              </h1>
              <p className="text-sm text-ink-soft">
                CPF {client.cpf}, {client.cityState}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/clientes/${client.id}/editar`}
                className={secondaryButtonClasses}
              >
                <PencilSimple size={18} weight="bold" aria-hidden />
                Editar cadastro
              </Link>
              <Link
                href={`/clientes/${client.id}/casos/novo`}
                className={primaryButtonClasses}
              >
                <Plus size={18} weight="bold" aria-hidden />
                Novo caso
              </Link>
            </div>
          </div>
        </div>
      </MotionReveal>

      <div className="grid gap-6 xl:grid-cols-(--layout-record-columns)">
        <MotionReveal order={1} className="flex min-w-0 flex-col gap-6">
          {client.notices.length === 0 ? null : (
            <section
              aria-label="Avisos deste cliente"
              className="flex flex-col gap-4 rounded-lg border border-line bg-card p-6 shadow-card"
            >
              <header className="flex items-center gap-2.5">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
                  <BellRinging aria-hidden size={18} weight="bold" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-ink">Avisos</h2>
                  <p className="text-sm text-ink-soft">
                    Ficha interna, aberta pelo advogado. O cliente não acessa o
                    sistema e nesta fase o sistema não envia mensagem nem
                    correio eletrônico a ele.
                  </p>
                </div>
              </header>
              <ul className="flex flex-col divide-y divide-line">
                {client.notices.map((notice) => (
                  <li
                    className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                    key={notice.id}
                  >
                    <p className="text-sm font-bold text-ink">{notice.title}</p>
                    <p className="text-xs leading-relaxed text-ink">
                      {notice.body}
                    </p>
                    <p className="text-xs text-ink-soft">
                      Origem: intimação disponibilizada em{" "}
                      {notice.origin.availableOn.split("-").reverse().join("/")}
                      {notice.origin.certificateCode === null
                        ? ""
                        : `, certidão ${notice.origin.certificateCode}`}
                      .
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            aria-label="Dados civis"
            className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
          >
            <header className="flex items-center gap-2.5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
                <IdentificationCard size={18} weight="bold" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink">Dados civis</h2>
                <p className="text-sm text-ink-soft">
                  Gravados em arquivo local, sob a responsabilidade do
                  escritório.
                </p>
              </div>
            </header>
            <dl className="flex flex-col divide-y divide-line">
              {[
                { label: "Nome completo", value: client.fullName },
                { label: "CPF", value: client.cpf },
                { label: "Documento de identidade", value: client.rg },
                {
                  label: "Nascimento",
                  value: birthDateLabel(client.birthDate),
                },
                {
                  label: "Nome da mãe",
                  value: client.motherName ?? "Não informado",
                },
                { label: "Telefone", value: client.phone },
                { label: "Endereço eletrônico", value: client.email },
                { label: "Endereço", value: client.address },
                { label: "Cidade e UF", value: client.cityState },
              ].map((entry) => (
                <div
                  key={entry.label}
                  className="flex flex-wrap gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                >
                  <dt className="min-w-40 text-xs text-ink-soft">
                    {entry.label}
                  </dt>
                  <dd className="min-w-0 flex-1 basis-48 text-sm break-words text-ink">
                    {entry.value}
                  </dd>
                </div>
              ))}
            </dl>
            {client.notes ? (
              <p className="rounded-md bg-inset p-4 text-xs leading-relaxed text-ink">
                {client.notes}
              </p>
            ) : null}
          </section>
        </MotionReveal>

        <MotionReveal order={2} className="flex min-w-0 flex-col gap-6">
          <section
            aria-label="Casos do cliente"
            className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
          >
            <header className="flex items-center gap-2.5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-inset text-ink">
                <Scales size={18} weight="bold" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink">
                  Casos,{" "}
                  {cases.length === 1 ? "1 caso" : `${cases.length} casos`}
                </h2>
                <p className="text-sm text-ink-soft">
                  Um único fato pode abrir casos em esferas diferentes, e eles
                  nunca se misturam.
                </p>
              </div>
            </header>

            {cases.length === 0 ? (
              <p className="rounded-md bg-inset p-4 text-sm text-ink">
                Nenhum caso cadastrado para este cliente. Use "Novo caso" para
                abrir o primeiro, escolhendo a esfera.
              </p>
            ) : (
              <ol className="flex flex-col divide-y divide-line">
                {cases.map((record) => {
                  const sphere = sphereOf(record.sphere);
                  return (
                    <li
                      key={record.id}
                      className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md py-4 transition-colors duration-(--motion-fast) first:pt-0 last:pb-0 hover:bg-inset focus-within:bg-inset"
                    >
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="text-sm font-bold text-ink">
                          <Link
                            href={`/casos/${client.id}/${record.id}`}
                            className="cursor-pointer after:absolute after:inset-0 after:rounded-md"
                          >
                            {record.caseType}
                            <span className="sr-only">
                              , abrir o caso em {sphere.courtLabel}
                            </span>
                          </Link>
                        </p>
                        <p className="text-xs text-ink-soft">
                          {sphere.label}, contra {record.opposingParty}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {record.documents.length === 1
                            ? "1 documento anexado"
                            : `${record.documents.length} documentos anexados`}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-neutral-soft px-3 py-1 text-xs font-bold whitespace-nowrap text-ink">
                        {statusLabelOf(record.status)}
                      </span>
                      <CaretRight
                        size={16}
                        weight="bold"
                        aria-hidden
                        className="shrink-0 text-ink-soft"
                      />
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </MotionReveal>
      </div>
    </>
  );
}
