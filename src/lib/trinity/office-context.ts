import { captureHealth } from "@/lib/capture/runs";
import { listCommunications } from "@/lib/capture/store";
import {
  type CaseTask,
  caseSpheres,
  caseTypesBySphere,
  documentStateLabel,
  type StoredCase,
} from "@/lib/case-domain";
import {
  activeCases,
  countByCaseType,
  countByStatus,
  deadlineSummary,
  listUnifiedCases,
  type UnifiedCase,
} from "@/lib/case-views";
import {
  feeContracts,
  financeStats,
  forecastEntries,
  hourEntries,
  receiptEntries,
  requisitionEntries,
} from "@/lib/persona";
import { listAllCases, listClients } from "@/lib/records-store";

/*
 * The reading layer of the office, and the only path by which a record of this
 * system reaches the reasoning layer. It resolves what the session may see,
 * assembles the operation in named sections, and applies the two rules that
 * cannot be delegated to a model: suppression of what the session must not
 * read, and minimization of the direct identifiers the task does not need.
 *
 * Governance itself, the verdicts and the audit chain, lives in MAIC, in the
 * signed store under data/_trinity/maic. This file feeds it; it does not
 * replace it.
 */

export type LawyerSession = {
  lawyerId: string;
  lawyerName: string;
  role: "admin" | "lawyer";
};

export type FinancialLine = {
  caseRef: string;
  client: string;
  /* Null is an office wide indicator, attributable to no single lawyer. */
  lawyer: string | null;
  label: string;
  amountLabel: string;
};

/*
 * A named group of records the entity may read. Measured defect of 2026-08-11:
 * asked about the commitments of the week, the entity answered it had no agenda
 * data, and it was right, because the context carried cases and finance only.
 * Everything the screens display now reaches it through these sections, so what
 * the lawyer sees and what the entity sees is the same operation.
 */
export type ContextSection = {
  id: string;
  title: string;
  lines: string[];
};

export type AllowedView = {
  session: LawyerSession;
  /* Temporal anchor. Without it the entity cannot answer a question about today
   * and has no way to notice that a record label is relative and not a date. */
  now: { iso: string; label: string };
  cases: UnifiedCase[];
  finance: FinancialLine[];
  operations: ContextSection[];
  suppressed: {
    financialLines: number;
    reason: string | null;
    /* Constitution, item nine: direct identifiers not needed by the task are
     * removed before anything reaches an external service. */
    minimized: string;
  };
};

/*
 * The office operates in Brazil and every temporal label of the operation is
 * read in this zone. One named source, never a literal spread over the code.
 */
export const OFFICE_TIME_ZONE = "America/Sao_Paulo";

export function officeNow(at: Date = new Date()): {
  iso: string;
  label: string;
} {
  return {
    iso: at.toISOString(),
    label: new Intl.DateTimeFormat("pt-BR", {
      timeZone: OFFICE_TIME_ZONE,
      dateStyle: "full",
      timeStyle: "short",
    }).format(at),
  };
}

/*
 * Every financial line carries the lawyer it is attributable to, read from the
 * record itself and never from a name written in code. A line attributable to
 * nobody is an office wide indicator: it belongs to the whole operation, so a
 * lawyer outside the administration never receives it, because an aggregate is
 * exactly what lets a third party's share be isolated by subtraction.
 */
function allFinancialLines(): FinancialLine[] {
  const lines: FinancialLine[] = [];
  for (const contract of feeContracts) {
    lines.push({
      caseRef: contract.caseRef,
      client: contract.client,
      lawyer: contract.responsibleLawyer,
      label: `Contrato: ${contract.contractLabel}. ${contract.participationLabel}`,
      amountLabel: contract.participationLabel,
    });
  }
  for (const receipt of receiptEntries) {
    lines.push({
      caseRef: receipt.caseRef,
      client: receipt.client,
      lawyer: receipt.responsibleLawyer,
      label: `Recebimento: ${receipt.description}`,
      amountLabel: receipt.amountLabel,
    });
  }
  for (const hour of hourEntries) {
    lines.push({
      caseRef: hour.caseRef,
      client: hour.client,
      lawyer: hour.responsibleLawyer,
      label: `Horas lançadas em ${hour.dateLabel}: ${hour.description}`,
      amountLabel: hour.durationLabel,
    });
  }
  for (const forecast of forecastEntries) {
    lines.push({
      caseRef: forecast.caseRef,
      client: forecast.client,
      lawyer: forecast.responsibleLawyer,
      label: `Previsão: ${forecast.description}. ${forecast.conditionLabel}`,
      amountLabel: forecast.amountLabel,
    });
  }
  for (const requisition of requisitionEntries) {
    lines.push({
      caseRef: requisition.caseRef,
      client: requisition.client,
      lawyer: requisition.responsibleLawyer,
      label: `${requisition.kindLabel}: ${requisition.statusLabel}`,
      amountLabel: "valor não registrado nesta linha",
    });
  }
  /*
   * The finance screen indicators are money as well, so they travel inside the
   * governed lines and never in the free operational sections. For a lawyer
   * outside the scope they disappear with everything else, and no total is left
   * behind from which a third party's share could be isolated by subtraction.
   */
  for (const stat of financeStats) {
    lines.push({
      caseRef: "indicador do escritório",
      client: "não se aplica",
      lawyer: null,
      label: `Indicador do Financeiro: ${stat.label}`,
      amountLabel: stat.value,
    });
  }
  return lines;
}

/* The four states a task of a case really has. The automation suggests, a
 * lawyer accepts or dismisses, and only a person closes one. */
const TASK_STATE: Record<CaseTask["state"], string> = {
  suggested: "sugerida pela captura, pendente de decisão do advogado",
  accepted: "aceita pelo advogado",
  done: "concluída",
  dismissed: "descartada pelo advogado",
};

const DEADLINE_STATE: Record<"calculated" | "confirmed", string> = {
  calculated: "calculado, ainda não confirmado por advogado",
  confirmed: "confirmado por advogado",
};

/*
 * The operation of the office, assembled from the same records the screens
 * read. Two rules govern the assembly, and both run here rather than in a
 * sentence addressed to the model:
 *
 * Minimization, constitution item nine. Direct personal identifiers that the
 * task does not need never enter, which is why no registration number of a
 * natural person is written below even though the fixture carries some.
 *
 * Traceability, constitution item five. Every line names its origin, and an
 * aggregate indicator of a screen is labelled as such, so it is never merged
 * with the count of the detailed records.
 */
/*
 * Everything the office holds, read for the entity. This is not a description
 * of the screens: it is the records themselves, case by case, with the
 * deadlines and their whole chain, the tasks, the appointments, the reminders,
 * the notices, the documents with their measured confidence and the acts
 * captured from the official source. A question is answered over the office,
 * never over the page the lawyer happens to be looking at.
 */
async function operationalSections(
  cases: UnifiedCase[],
): Promise<ContextSection[]> {
  const [stored, clients, communications, health] = await Promise.all([
    listAllCases(),
    listClients(),
    listCommunications(),
    captureHealth(),
  ]);
  const active = activeCases(cases);
  const deadlineTotals = deadlineSummary(cases);
  const caseCount = new Map<string, number>();
  for (const row of stored) {
    caseCount.set(row.client.id, (caseCount.get(row.client.id) ?? 0) + 1);
  }
  const refOf = (record: StoredCase): string =>
    record.reference?.trim() ? record.reference : `Caso ${record.id.slice(-6)}`;

  const deadlines: string[] = [];
  const tasks: string[] = [];
  const appointments: string[] = [];
  const reminders: string[] = [];
  const documents: string[] = [];
  const notices: string[] = [];

  for (const { record, client } of stored) {
    const ref = refOf(record);
    for (const deadline of record.deadlines) {
      deadlines.push(
        `- ${ref} | ${client.fullName} | ${deadline.label} | regime ${deadline.regime === "procedural" ? "processual" : "administrativo"} | disponibilização ${deadline.availableOn} | publicação ${deadline.publishedOn} | início ${deadline.startsOn} | ${deadline.days} dias ${deadline.countedInBusinessDays ? "úteis" : "corridos"} | vencimento ${deadline.dueOn} | estado ${DEADLINE_STATE[deadline.state]}${deadline.state === "confirmed" ? `, confirmado por ${deadline.confirmedBy ?? "autor não registrado"} em ${deadline.confirmedAt ?? "momento não registrado"}` : ", ainda não confirmado por um advogado"} | fundamento: ${deadline.legalSources.join("; ") || "sem fundamento registrado"}${deadline.warnings.length > 0 ? ` | avisos: ${deadline.warnings.join("; ")}` : ""} | nasceu do ato ${deadline.origin.certificateCode ?? deadline.origin.communicationId}, disponibilizado em ${deadline.origin.availableOn}`,
      );
    }
    for (const task of record.tasks) {
      tasks.push(
        `- ${ref} | ${client.fullName} | ${task.title} | situação ${TASK_STATE[task.state]} | responsável ${task.responsible}${task.internalDueOn === null ? "" : ` | prazo interno ${task.internalDueOn}`}${task.detail === null ? "" : ` | ${task.detail}`}`,
      );
    }
    for (const event of record.events) {
      appointments.push(
        `- ${ref} | ${client.fullName} | ${event.kind === "hearing" ? "audiência" : event.kind === "examination" ? "perícia" : event.kind} | ${event.title} | ${event.date}${event.time === null ? "" : `, ${event.time}`} | ${event.place ?? "local não registrado no ato"}`,
      );
    }
    for (const reminder of record.reminders) {
      reminders.push(
        `- ${ref} | ${client.fullName} | lembrar ${reminder.remindOn} | ${reminder.message} | situação ${reminder.state === "done" ? "concluído" : "pendente"}`,
      );
    }
    for (const document of record.documents) {
      documents.push(
        `- ${ref} | ${client.fullName} | ${document.fileName} | estado ${documentStateLabel(document.state)}${document.meanConfidence === undefined ? "" : ` | confiança média ${document.meanConfidence.toFixed(1)} por cento`}${document.pageCount === undefined ? "" : ` | ${document.pageCount} páginas, ${document.ocrPages ?? 0} por reconhecimento óptico`}${document.stateNote === undefined ? "" : ` | ${document.stateNote}`}`,
      );
    }
  }

  for (const client of clients) {
    for (const notice of client.notices) {
      notices.push(
        `- ${client.fullName} | ${notice.kind} | ${notice.title} | ${notice.eventDate ?? "sem data"} | ${notice.body}`,
      );
    }
  }

  const linked = communications.filter((entry) => entry.link !== null);
  const unlinked = communications.filter((entry) => entry.link === null);
  const communicationLine = (entry: (typeof communications)[number]): string =>
    `- ${entry.processNumberLabel ?? entry.processNumber ?? "sem número de processo"} | ${entry.tribunalSigla ?? "tribunal não informado"} | disponibilizado em ${entry.availableOn} | ${entry.documentType ?? "tipo não informado"} | ${entry.link === null ? "não vinculado a caso" : "vinculado a caso"}${entry.extraction === null ? "" : ` | leitura por regra: ${entry.extraction.actType ?? "tipo não reconhecido"}${entry.extraction.days === null ? "" : `, ${entry.extraction.days} dias`}${entry.extraction.residue.length > 0 ? `, resíduo para decisão humana: ${entry.extraction.residue.join("; ")}` : ""}`} | texto do ato: ${entry.text.replace(/\s+/g, " ").slice(0, 600)}`;

  return [
    {
      id: "practice-spheres",
      title:
        "ESFERAS EM QUE O ESCRITÓRIO ATUA, COM A JUSTIÇA E O REGIME DE PRAZO",
      /* Domain knowledge, not case data: the office practises in these branches
       * even in a week when none of them has an open case, and the entity has
       * to be able to say so. */
      lines: caseSpheres.map(
        (sphere) =>
          `- ${sphere.label} | ${sphere.courtLabel} | ${sphere.scopeLabel} | tipos de caso: ${caseTypesBySphere[sphere.id].map((type) => type.label).join("; ")} | ${sphere.deadlineRegimeLabel} | ${sphere.groundLabel}`,
      ),
    },
    {
      id: "office-rules",
      title: "COMO ESTE ESCRITÓRIO FUNCIONA, REGRAS DO PRÓPRIO SISTEMA",
      /* Domain knowledge of the office itself, not case data. Measured on
       * 2026-09-01: without it the entity answered about the teams, about who
       * confirms a deadline and about the phase gate as if the office had no
       * rule, or answered about the Brazilian judiciary in general, which is
       * not what a member of this office is asking. */
      lines: [
        "- O núcleo do sistema é o CASO: um benefício pleiteado por um cliente, com prazos, documentos, tarefas e financeiro próprios. Um cliente com três benefícios tem três casos independentes, que nunca se misturam.",
        "- Quatro times operam o sistema, e a regra de acesso vive no banco de dados, por row level security, nunca apenas na interface. Administração: visão global, contas, times, permissões, catálogos e parâmetros, e é a única que lê a trilha de auditoria. Atendimento: recepção, triagem, cadastro de cliente, abertura de caso, coleta documental e registro de comunicação, e não acessa o módulo financeiro. Advogados: acesso total apenas aos próprios casos, às próprias horas e à própria participação financeira, nunca à de outro. Financeiro: contratos, honorários, recebíveis e repasses de todos os casos, mais o cadastro mínimo do caso, e nunca documento de saúde, laudo, exame ou resultado de perícia.",
        "- Um advogado não lê o caso de outro advogado, nem pela interface nem por acesso direto à API, porque a política é aplicada no banco.",
        "- Prazo tem dois estados e apenas dois: calculado e confirmado. A passagem de calculado para confirmado é ato humano e explícito de um advogado, registrado em auditoria. Nenhuma automação confirma prazo, em nenhuma circunstância.",
        "- Portão de fase: a trilha jurídica é sequencial e o avanço exige os artefatos obrigatórios da etapa. Abrir a fase judicial exige prova do prévio requerimento administrativo e da respectiva decisão, ou dispensa expressamente justificada, conforme o Recurso Extraordinário 631.240 do Supremo Tribunal Federal. Um advogado pode liberar o portão com justificativa registrada, nunca em silêncio.",
        "- A Inteligência Massiva classifica, extrai, resume, sugere e alerta, e nunca decide. Não conclui caso, não confirma prazo e não produz comunicação externa sem aprovação registrada de um advogado. Toda saída assistida fica marcada como assistida, com modelo, data, hora e usuário, e toda interação é registrada.",
        "- A leitura de documento é local, com poppler e tesseract em português, e nenhuma imagem, página ou documento digitalizado é enviado ao modelo para ser transcrito. Cada página carrega confiança medida; abaixo do limiar o campo fica pendente de validação humana e não é usado em cálculo, peça ou decisão.",
        "- O prazo nasce da intimação publicada no Diário de Justiça Eletrônico Nacional, sempre. O DataJud é base de metadados do Conselho Nacional de Justiça, serve para acompanhar movimentação e JAMAIS é fonte de prazo.",
        "- Ato que traga dois prazos divergentes, ou prazo contado de outro evento como a perícia, ou ordem judicial de aguardar, vai para decisão humana e nenhum prazo é calculado.",
        "- Toda chamada a fonte externa parte do servidor do escritório, no Brasil, e nunca do navegador do advogado. O lugar onde o advogado está é irrelevante.",
        "- O sistema não fala com o cliente por canal nenhum nesta fase, e não existe protocolo eletrônico automático de peça: o sistema vai até a preparação, a montagem, a conferência e o registro da peça protocolada.",
        "- Toda ação relevante grava evento imutável de auditoria com autor, ação, entidade, valores antes e depois, data e hora. A trilha não é editável nem apagável pela aplicação e só a Administração a lê. Toda leitura ou download de documento grava evento próprio de acesso.",
      ],
    },
    {
      id: "clients",
      title: "CLIENTES CADASTRADOS NO ESCRITÓRIO",
      lines: clients.map(
        (client) =>
          `- ${client.fullName} | ${client.cityState} | ${caseCount.get(client.id) ?? 0} casos | cadastrado em ${client.createdAt.slice(0, 10)}${client.notes === undefined ? "" : ` | observação: ${client.notes}`}`,
      ),
    },
    {
      id: "deadlines",
      title: "PRAZOS REGISTRADOS, COM A CADEIA INTEIRA E O ESTADO DE CADA UM",
      lines: deadlines,
    },
    {
      id: "tasks",
      title: "TAREFAS DOS CASOS",
      lines: tasks,
    },
    {
      id: "appointments",
      title: "AUDIÊNCIAS E PERÍCIAS MARCADAS",
      lines: appointments,
    },
    {
      id: "reminders",
      title: "LEMBRETES DO ADVOGADO",
      lines: reminders,
    },
    {
      id: "documents",
      title: "DOCUMENTOS DOS CASOS, COM A CONFIANÇA MEDIDA DA LEITURA LOCAL",
      lines: documents,
    },
    {
      id: "client-notices",
      title: "AVISOS PREPARADOS PARA O CLIENTE, NENHUM ENVIADO POR AUTOMAÇÃO",
      lines: notices,
    },
    {
      id: "communications-linked",
      title: "COMUNICAÇÕES CAPTURADAS E JÁ VINCULADAS A UM CASO",
      lines: linked.map(communicationLine),
    },
    {
      id: "communications-unlinked",
      title:
        "COMUNICAÇÕES CAPTURADAS AINDA SEM CASO, NA FILA DE VÍNCULO, NUNCA DESCARTADAS",
      lines: unlinked.map(communicationLine),
    },
    {
      id: "capture-health",
      title: "SAÚDE DA CAPTURA EXTERNA",
      lines: health.map(
        (source) =>
          `- ${source.label} | ${source.statusLabel} | ${source.lastSuccessAt === null ? "nenhuma captura bem-sucedida registrada" : `última captura bem-sucedida em ${source.lastSuccessAt}`} | ${source.role} | ${source.healthy ? "sem indisponibilidade registrada" : "com atraso ou falha registrada, comunicar ao advogado quando o assunto for prazo"}`,
      ),
    },
    {
      id: "office-figures",
      title: "NÚMEROS DO ESCRITÓRIO, APURADOS SOBRE OS REGISTROS ACIMA",
      lines: [
        `- Casos ativos: ${active.length}, de ${cases.length} casos cadastrados`,
        `- Prazos: ${deadlineTotals.confirmed} confirmados, ${deadlineTotals.calculated} calculados e ${deadlineTotals.critical} próximos do vencimento ou vencidos, total de ${deadlineTotals.total}`,
        `- Clientes cadastrados: ${clients.length}`,
        `- Documentos guardados: ${documents.length}`,
        `- Comunicações capturadas: ${communications.length}, sendo ${linked.length} vinculadas e ${unlinked.length} na fila`,
        ...countByStatus(active).map(
          (phase) => `- Por fase: ${phase.label}: ${phase.count}`,
        ),
        ...countByCaseType(active).map(
          (benefit) =>
            `- Por benefício pleiteado: ${benefit.caseType}: ${benefit.count}`,
        ),
      ],
    },
  ];
}

/*
 * The single reading path of the entity. There is no alternative route, no
 * development shortcut and no debug mode that bypasses this function.
 */
export async function resolveAllowedView(
  session: LawyerSession,
): Promise<AllowedView> {
  const cases = await listUnifiedCases();
  const everyLine = allFinancialLines();
  const operations = await operationalSections(cases);
  const now = officeNow();
  const minimized =
    "Identificadores diretos de pessoa natural, como número de inscrição no cadastro de pessoas físicas, endereço, telefone e endereço eletrônico, não entram no contexto, por minimização.";

  if (session.role === "admin") {
    return {
      session,
      now,
      cases,
      finance: everyLine,
      operations,
      suppressed: { financialLines: 0, reason: null, minimized },
    };
  }

  /*
   * A common lawyer sees the whole operation of the office and, of the finance,
   * only what is attributable to himself. No aggregate is returned either: with
   * a small team any total lets a third party's share be isolated by
   * subtraction, which is the very deduction the ethical rule forbids.
   */
  const own = everyLine.filter((line) => line.lawyer === session.lawyerName);
  return {
    session,
    now,
    cases,
    finance: own,
    operations,
    suppressed: {
      financialLines: everyLine.length - own.length,
      reason:
        "Participação, apuração e recebimento de outro advogado não entram no contexto, nem em agregado.",
      minimized,
    },
  };
}

/*
 * The rendered view. What the entity receives about the office, in one block,
 * appended to the system prompt MAIC and HIM composed. Two reading rules travel
 * with it because they are properties of the records, not requests to a model:
 * a relative label is never turned into a calendar date, and an aggregate
 * indicator is never merged with the count of the detailed records.
 */
/*
 * The one line of the context that changes on its own, without anything in the
 * office having changed. It is named here because the answer cache has to
 * remove it before fingerprinting the context, and a cache that fingerprints
 * the clock never hits.
 */
export const NOW_LINE_PREFIX = "Momento atual no fuso do escritório:";

/*
 * The reading the entity receives. It carries the office, never the page: the
 * screen the lawyer happens to be looking at is not in here and is not part of
 * the answer, by the director's order of 2026-09-01, because an entity that
 * answers about the current screen is an entity that hides the other records
 * from the person who asked.
 */
export function contextBlock(view: AllowedView): string {
  const cases = view.cases
    .map(
      (entry) =>
        `- ${entry.caseRef} | ${entry.clientName} | ${entry.caseType} | ${entry.sphereLabel}, ${entry.courtLabel} | contra ${entry.opposingParty} | situação ${entry.statusLabel} | responsável ${entry.responsibleLawyer} | documentos ${entry.documentCount}${entry.documentNames.length > 0 ? ` (${entry.documentNames.join("; ")})` : ""} | origem ${entry.origin === "fixture" ? "demonstração" : "cadastro do escritório"}`,
    )
    .join("\n");

  const finance = view.finance
    .map(
      (line) =>
        `- ${line.caseRef} | ${line.client} | ${line.lawyer ?? "indicador do escritório, sem advogado atribuível"} | ${line.label} | valor ${line.amountLabel}`,
    )
    .join("\n");

  const operations = view.operations
    .map((section) =>
      [
        `${section.title} (${section.lines.length}):`,
        section.lines.join("\n") || "(nenhum registro)",
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "REGISTROS DO ESCRITÓRIO, LEITURA GOVERNADA PELO MAIC:",
    `${NOW_LINE_PREFIX} ${view.now.label}.`,
    "",
    "COMO LER ESTES REGISTROS:",
    "Você recebe o escritório inteiro, e não a tela em que o advogado está. Responda sobre todos os registros abaixo, venha a pergunta de onde vier, e nunca diga que algo não aparece na tela atual: a tela não é a sua fonte.",
    "Toda data aqui é data de calendário, no formato ano-mês-dia. Use as datas como estão e não as converta em rótulos vagos.",
    "Um número apurado e a contagem dos registros detalhados vêm dos mesmos registros. Se divergirem, diga os dois e nomeie a origem de cada um.",
    "Apresentação: perguntado quem você é, responda pelo nome e pelo que faz neste escritório, como faria qualquer profissional. A sua natureza você explica se perguntarem o que você é, e mesmo aí sem entrar em futilidade.",
    view.suppressed.minimized,
    "",
    `CASOS DO ESCRITÓRIO (${view.cases.length}):`,
    cases || "(nenhum)",
    "",
    operations,
    "",
    `LINHAS FINANCEIRAS NO ESCOPO PERMITIDO (${view.finance.length}):`,
    finance || "(nenhuma)",
    view.suppressed.financialLines > 0
      ? `\n${view.suppressed.financialLines} linhas financeiras não entraram neste contexto por política. Se perguntarem sobre elas, diga que não tem acesso, e não estime, não some e não deduza.`
      : "",
  ].join("\n");
}

export function countOperationalLines(view: AllowedView): number {
  return view.operations.reduce(
    (total, section) => total + section.lines.length,
    0,
  );
}

/* ------------------------------------------------------------------------- */
/* What a question needs                                                      */
/* ------------------------------------------------------------------------- */

function normalizeQuestion(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/* Words that name something the office keeps. One of them in the question and
 * the records are read, whatever else the sentence looks like. */
const OFFICE_TERMS = [
  "caso",
  "casos",
  "cliente",
  "clientes",
  "prazo",
  "prazos",
  "documento",
  "documentos",
  "intimacao",
  "intimacoes",
  "publicacao",
  "publicacoes",
  "comunicacao",
  "comunicacoes",
  "processo",
  "processos",
  "audiencia",
  "audiencias",
  "pericia",
  "pericias",
  "tarefa",
  "tarefas",
  "agenda",
  "financeiro",
  "honorario",
  "honorarios",
  "contrato",
  "contratos",
  "captura",
  "inss",
  "beneficio",
  "beneficios",
  "aposentadoria",
  "auxilio",
  "pensao",
  "recurso",
  "recursos",
  "requerimento",
  "exigencia",
  "decisao",
  "advogado",
  "advogada",
  "escritorio",
  "protocolo",
  "vencimento",
  "andamento",
  "djen",
  "datajud",
  "oab",
  "cpf",
  "peticao",
  "sentenca",
  "despacho",
  "lembrete",
  "aviso",
  "auditoria",
  "usuario",
  "conta",
  "sistema",
];

const GREETING =
  /^(oi+|ola|opa|e ai|eai|hey|hi|hello|bom dia|boa tarde|boa noite|tudo bem|tudo bom|tudo certo|como vai|como voce esta|beleza|salve|bom te ver)\b/;

const COURTESY =
  /^(obrigad|valeu|muito obrigad|agradec|ok\b|okay\b|certo\b|entendi|perfeito|legal\b|otimo|show\b|ate logo|ate mais|tchau|adeus|boa sorte)/;

const IDENTITY =
  /(quem (e|eh|es) voce|qual (e |eh )?(o )?seu nome|como voce se chama|como e o seu nome|o que voce (e|eh|faz|pode fazer|sabe fazer)|voce (e|eh) (uma |um )?(ia|inteligencia|robo|maquina|humano|pessoa|bot)|se apresente|fale (sobre|de) voce|quem e david|voce esta ai|esta ai)/;

/*
 * Whether a question needs the records of the office at all. A greeting, a
 * thank you and a question about who the entity is are answered without opening
 * anything, because reading twenty tables to say good morning is what made this
 * surface slow, and because a status line saying the entity is reading the
 * records when it is not is a lie the interface tells every time.
 *
 * The rule is deliberately conservative: any word that names something the
 * office keeps, or any sentence longer than a short opener, reads everything.
 */
export function questionNeedsOfficeRecords(question: string): boolean {
  const text = normalizeQuestion(question);
  if (text.length === 0) {
    return false;
  }
  if (text.length > 120) {
    return true;
  }
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((word) => OFFICE_TERMS.includes(word))) {
    return true;
  }
  return !(GREETING.test(text) || COURTESY.test(text) || IDENTITY.test(text));
}

/*
 * The reading a conversational turn receives. It is not the office: it is who
 * the entity is, where it stands and the honest statement that no record was
 * opened, so the body still answers inside a governed context and the guarantee
 * that an answer never arrives blind is preserved.
 */
export function conversationalBlock(
  session: LawyerSession,
  now: { iso: string; label: string } = officeNow(),
): string {
  return [
    "CONTEXTO DESTA CONVERSA, LEITURA GOVERNADA PELO MAIC:",
    `${NOW_LINE_PREFIX} ${now.label}.`,
    `Quem está falando com você: ${session.lawyerName.length > 0 ? session.lawyerName : "membro do escritório"}, perfil ${session.role === "admin" ? "administração" : "advogado"}.`,
    "",
    "Esta pergunta é de cortesia ou sobre você, e por isso nenhum registro do escritório foi aberto para respondê-la. Não invente número, caso, cliente ou prazo: se a conversa passar a pedir dado do escritório, o próximo turno abre os registros.",
    "Responda em uma ou duas frases, no tom de um profissional do escritório. Apresente-se pelo nome e pelo que faz quando perguntarem, sem discorrer sobre a sua natureza a menos que perguntem o que você é.",
  ].join("\n");
}

/*
 * The view of a turn that read nothing. The guards still run against it, and
 * against an empty scope every monetary figure is outside the scope, which is
 * the correct posture for an answer produced without opening a single record.
 */
export function emptyView(session: LawyerSession): AllowedView {
  return {
    session,
    now: officeNow(),
    cases: [],
    finance: [],
    operations: [],
    suppressed: {
      financialLines: 0,
      reason: null,
      minimized:
        "Nenhum registro do escritório foi aberto para esta pergunta, por ser de cortesia ou sobre a própria entidade.",
    },
  };
}
