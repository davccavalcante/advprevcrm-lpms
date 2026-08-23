import { caseSpheres, caseTypesBySphere } from "@/lib/case-domain";
import { listUnifiedCases, type UnifiedCase } from "@/lib/case-views";
import {
  activeCasesTotal,
  administrativeDecisions,
  administrativeExaminations,
  administrativeExigencies,
  administrativeRequirements,
  awaitingDocsCases,
  captureSources,
  casesByBenefit,
  casesByPhase,
  communicationLog,
  crpsAppeals,
  deadlineOverview,
  feeContracts,
  financeStats,
  forecastEntries,
  grantRates,
  hourEntries,
  judicialLawsuits,
  kpis,
  monthlyActivity,
  myTasks,
  overdueDeadlines,
  receiptEntries,
  requisitionEntries,
  riskAlerts,
  type TaskEntry,
  type TriageChannel,
  type TriageItem,
  triageQueue,
  unansweredContacts,
  unifiedAgendaItems,
} from "@/lib/persona";

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
  lawyer: string;
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
 * Every financial line of the demonstration dataset carries the lawyer it is
 * attributable to. The fixture was written for a single lawyer, so the
 * attribution below is explicit rather than inferred.
 */
const FIXTURE_LAWYER = "Mendelsson Sandrini Alves Maciel";

function allFinancialLines(): FinancialLine[] {
  const lines: FinancialLine[] = [];
  for (const contract of feeContracts) {
    lines.push({
      caseRef: contract.caseRef,
      client: contract.client,
      lawyer: FIXTURE_LAWYER,
      label: `Contrato: ${contract.contractLabel}. ${contract.participationLabel}`,
      amountLabel: contract.participationLabel,
    });
  }
  for (const receipt of receiptEntries) {
    lines.push({
      caseRef: receipt.caseRef,
      client: receipt.client,
      lawyer: FIXTURE_LAWYER,
      label: `Recebimento: ${receipt.description}`,
      amountLabel: receipt.amountLabel,
    });
  }
  for (const hour of hourEntries) {
    lines.push({
      caseRef: hour.caseRef,
      client: hour.client,
      lawyer: FIXTURE_LAWYER,
      label: `Horas lançadas em ${hour.dateLabel}: ${hour.description}`,
      amountLabel: hour.durationLabel,
    });
  }
  for (const forecast of forecastEntries) {
    lines.push({
      caseRef: forecast.caseRef,
      client: forecast.client,
      lawyer: FIXTURE_LAWYER,
      label: `Previsão: ${forecast.description}. ${forecast.conditionLabel}`,
      amountLabel: forecast.amountLabel,
    });
  }
  for (const requisition of requisitionEntries) {
    lines.push({
      caseRef: requisition.caseRef,
      client: requisition.client,
      lawyer: FIXTURE_LAWYER,
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
      lawyer: FIXTURE_LAWYER,
      label: `Indicador do Financeiro: ${stat.label}`,
      amountLabel: stat.value,
    });
  }
  return lines;
}

const TASK_PRIORITY: Record<TaskEntry["priority"], string> = {
  high: "alta",
  medium: "média",
  low: "baixa",
};

const TASK_STATUS: Record<TaskEntry["status"], string> = {
  todo: "a fazer",
  doing: "em andamento",
  review: "em revisão",
};

const TRIAGE_CHANNEL: Record<TriageChannel, string> = {
  email: "e-mail",
  message: "mensagem",
  phone: "telefone",
};

const URGENCY: Record<TriageItem["urgency"], string> = {
  high: "alta",
  medium: "média",
  low: "baixa",
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
function operationalSections(): ContextSection[] {
  const events = unifiedAgendaItems.filter((item) => item.kind !== "deadline");
  const deadlines = unifiedAgendaItems.filter(
    (item) => item.kind === "deadline",
  );

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
      id: "agenda-events",
      title: "AGENDA DA SEMANA, AUDIÊNCIAS E PERÍCIAS",
      lines: events.map(
        (item) =>
          `- ${item.title} | ${item.client} | ${item.caseRef} | ${item.whenLabel} | preparação: ${item.preparationLabel ?? "sem registro de preparação"} | operado na tela ${item.destinationLabel}`,
      ),
    },
    {
      id: "agenda-deadlines",
      title: "PRAZOS EM ABERTO",
      lines: deadlines.map(
        (item) =>
          `- ${item.title} | ${item.client} | ${item.caseRef} | ${item.whenLabel} | estado ${item.status ? DEADLINE_STATE[item.status] : "sem estado registrado"}${item.critical ? " | marcado como crítico" : ""}${item.escalated ? " | escalonado à coordenação" : ""} | operado na tela ${item.destinationLabel}`,
      ),
    },
    {
      id: "tasks",
      title: "TAREFAS DO ADVOGADO",
      lines: myTasks.map(
        (task) =>
          `- ${task.title} | ${task.caseRef} | prioridade ${TASK_PRIORITY[task.priority]} | vence ${task.dueLabel} | situação ${TASK_STATUS[task.status]}`,
      ),
    },
    {
      id: "intake-queue",
      title: "ATENDIMENTO, FILA DE TRIAGEM",
      lines: triageQueue.map(
        (item) =>
          `- ${item.senderName} | canal ${TRIAGE_CHANNEL[item.channel]} | recebido ${item.receivedLabel} | urgência ${URGENCY[item.urgency]} | ${item.linkedCaseRef ? `vinculado a ${item.linkedCaseRef}, ${item.linkedBenefitLabel ?? "benefício não registrado"}` : "sem caso vinculado"} | sugestão da Inteligência Massiva: ${item.imSuggestionLabel}, confiança ${item.imConfidencePercent}%, pendente de conferência humana | trecho recebido: ${item.excerpt}`,
      ),
    },
    {
      id: "intake-awaiting-documents",
      title: "ATENDIMENTO, CASOS AGUARDANDO DOCUMENTAÇÃO",
      lines: awaitingDocsCases.map(
        (item) =>
          `- ${item.client} | ${item.caseRef} | ${item.benefit} | ${item.receivedCount} de ${item.totalRequired} documentos recebidos | falta: ${item.missingDocuments.join("; ")}`,
      ),
    },
    {
      id: "intake-unanswered",
      title: "ATENDIMENTO, CONTATOS SEM RETORNO",
      lines: unansweredContacts.map(
        (item) =>
          `- ${item.name} | ${item.channelLabel} | ${item.waitingLabel}`,
      ),
    },
    {
      id: "communication-log",
      title: "REGISTRO DE COMUNICAÇÃO COM O CLIENTE",
      lines: communicationLog.map(
        (item) =>
          `- ${item.dateLabel} | ${item.clientName} | ${item.caseRef ?? "sem caso vinculado"} | ${item.channelLabel} | ${item.summary} | responsável ${item.responsible}`,
      ),
    },
    {
      id: "administrative-requirements",
      title: "ADMINISTRATIVO, REQUERIMENTOS AO INSS",
      lines: administrativeRequirements.map(
        (item) =>
          `- ${item.caseRef} | ${item.client} | ${item.benefit} | ${item.benefitNumber} | ${item.protocolLabel} | ${item.entryDateLabel} | situação ${item.statusLabel}`,
      ),
    },
    {
      id: "administrative-exigencies",
      title: "ADMINISTRATIVO, EXIGÊNCIAS EM ABERTO",
      lines: administrativeExigencies.map(
        (item) =>
          `- ${item.caseRef} | ${item.client} | ${item.description} | ${item.dueLabel} | prazo administrativo, regime próprio, distinto do processual | estado ${DEADLINE_STATE[item.status]}`,
      ),
    },
    {
      id: "administrative-examinations",
      title: "ADMINISTRATIVO, PERÍCIAS AGENDADAS",
      lines: administrativeExaminations.map(
        (item) =>
          `- ${item.caseRef} | ${item.client} | ${item.kindLabel} | ${item.whenLabel} | ${item.placeLabel} | preparação: ${item.preparationLabel}`,
      ),
    },
    {
      id: "administrative-decisions",
      title: "ADMINISTRATIVO, DECISÕES DO INSS E PORTÃO DE FASE",
      lines: administrativeDecisions.map(
        (item) =>
          `- ${item.caseRef} | ${item.client} | ${item.benefit} | resultado ${item.outcomeLabel} | ${item.groundsLabel} | ${item.pathLabel} | ${item.gateLabel}`,
      ),
    },
    {
      id: "crps-appeals",
      title: "ADMINISTRATIVO, RECURSOS AO CONSELHO DE RECURSOS",
      lines: crpsAppeals.map(
        (item) =>
          `- ${item.caseRef} | ${item.client} | ${item.benefit} | ${item.filedLabel} | ${item.statusLabel}`,
      ),
    },
    {
      id: "judicial-lawsuits",
      title: "JUDICIAL, PROCESSOS E ANDAMENTO",
      lines: judicialLawsuits.flatMap((lawsuit) => [
        `- ${lawsuit.caseRef} | ${lawsuit.client} | ${lawsuit.benefit} | processo ${lawsuit.lawsuitNumber} | ${lawsuit.courtLabel} | ${lawsuit.classLabel} | ${lawsuit.distributionDateLabel} | ${lawsuit.phaseLabel} | ${lawsuit.openDeadlines} prazos em aberto`,
        ...lawsuit.movements.map(
          (movement) =>
            `    movimentação ${movement.dateLabel}: ${movement.description} Fonte: ${movement.sourceLabel}`,
        ),
        ...lawsuit.summonses.map(
          (summons) =>
            `    intimação ${summons.dateLabel}: ${summons.summary} ${summons.generatedDeadlineLabel}`,
        ),
        ...lawsuit.deadlines.map(
          (deadline) =>
            `    prazo processual: ${deadline.title}, ${deadline.dueLabel}, estado ${DEADLINE_STATE[deadline.status]}`,
        ),
        ...lawsuit.hearings.map(
          (hearing) =>
            `    audiência: ${hearing.kindLabel}, ${hearing.whenLabel}, ${hearing.placeLabel}`,
        ),
        ...lawsuit.filings.map(
          (filing) => `    peça: ${filing.title}, ${filing.statusLabel}`,
        ),
      ]),
    },
    {
      id: "risk-alerts",
      title: "RISCO E CONFORMIDADE",
      lines: [
        ...riskAlerts.map(
          (alert) =>
            `- ${alert.kindLabel} | ${alert.caseRef} | ${alert.client} | ${alert.detailLabel} | ${alert.sourceLabel}`,
        ),
        `- Prazos vencidos: ${overdueDeadlines.count}. ${overdueDeadlines.scopeLabel}`,
      ],
    },
    {
      id: "capture-health",
      title: "SAÚDE DA CAPTURA EXTERNA",
      lines: captureSources.map(
        (source) =>
          `- ${source.label} | ${source.statusLabel} | ${source.lastRunLabel} | ${source.resultLabel} | ${source.roleLabel} | ${source.healthy ? "sem indisponibilidade registrada" : "com atraso registrado, comunicar ao advogado quando o assunto for prazo"}`,
      ),
    },
    {
      id: "panel-indicators",
      title:
        "INDICADORES AGREGADOS DAS TELAS, QUE NÃO SE DECOMPÕEM NOS REGISTROS DETALHADOS ACIMA",
      lines: [
        ...kpis.map(
          (kpi) =>
            `- Painel: ${kpi.label}: ${kpi.value}, variação ${kpi.delta}, ${kpi.deltaLabel}, registros na tela ${kpi.destinationLabel}`,
        ),
        `- Painel, prazos da semana: ${deadlineOverview.confirmed} confirmados, ${deadlineOverview.calculated} calculados e ${deadlineOverview.critical} críticos, total de ${deadlineOverview.total}`,
        `- Painel, carteira declarada do advogado: ${activeCasesTotal} casos ativos`,
        ...casesByPhase.map(
          (phase) => `- Painel, por fase: ${phase.label}: ${phase.count}`,
        ),
        ...casesByBenefit.map(
          (benefit) =>
            `- Painel, por benefício pleiteado: ${benefit.label}: ${benefit.count}`,
        ),
        ...grantRates.map(
          (rate) =>
            `- Painel, ${rate.label}: ${rate.granted} de ${rate.decided} decididos. ${rate.noteLabel}`,
        ),
        `- Painel, publicações capturadas por dia no gráfico dos últimos catorze dias: ${monthlyActivity.map((day) => `dia ${day.day}: ${day.publications}`).join("; ")}`,
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
  const operations = operationalSections();
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

export function contextBlock(view: AllowedView, screenContext: string): string {
  const cases = view.cases
    .map(
      (entry) =>
        `- ${entry.caseRef} | ${entry.clientName} | ${entry.caseType} | ${entry.sphereLabel}, ${entry.courtLabel} | contra ${entry.opposingParty} | situação ${entry.statusLabel} | responsável ${entry.responsibleLawyer} | documentos ${entry.documentCount}${entry.documentNames.length > 0 ? ` (${entry.documentNames.join("; ")})` : ""} | origem ${entry.origin === "fixture" ? "demonstração" : "cadastro do escritório"}`,
    )
    .join("\n");

  const finance = view.finance
    .map(
      (line) =>
        `- ${line.caseRef} | ${line.client} | ${line.lawyer} | ${line.label} | valor ${line.amountLabel}`,
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
    `Tela em que o advogado está: ${screenContext}.`,
    "",
    "COMO LER ESTES REGISTROS:",
    "Os rótulos temporais são relativos, por dia da semana e por dias úteis, e não trazem data de calendário. Não converta rótulo relativo em data, e se perguntarem a data exata de um prazo, diga que o registro guarda apenas o rótulo relativo e que a data nasce da intimação publicada.",
    "Indicador agregado de tela e contagem de registro detalhado são coisas diferentes. Quando divergirem, diga os dois e nomeie a origem de cada um.",
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
