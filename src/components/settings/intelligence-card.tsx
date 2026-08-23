import { Gauge } from "@phosphor-icons/react/dist/ssr";
import {
  intelligenceReport,
  intelligenceSnapshot,
} from "@/lib/trinity/intelligence-ops";

/*
 * Where the administration sees what the office measures about the exchanges
 * with David: identity, inspection, tracing, drift, grounding, memory, facts,
 * recording, tuning, prompt discipline, money, and the calibrated reading of
 * the day's ledger and of the capture runs. Every number is a measurement,
 * taken in this process or read from the records on disk at this request, and
 * every reading is advisory: nothing on this card decides anything.
 */

const DECISION_LABEL: Record<string, string> = {
  allow: "permitida",
  ask: "pede revisão",
  block: "sinalizada",
};

const DRIFT_STATUS_LABEL: Record<string, string> = {
  learning: "em aprendizado",
  ready: "estabelecida",
};

const SEVERITY_LABEL: Record<string, string> = {
  none: "nenhuma",
  info: "informativa",
  low: "baixa",
  medium: "média",
  high: "alta",
  critical: "crítica",
};

const TIER_LABEL: Record<string, string> = {
  proceed: "sustentada pelo contexto",
  regenerate: "com trechos sem lastro no contexto",
  replan: "com lastro insuficiente",
};

const GATE_ACTION_LABEL: Record<string, string> = {
  pass: "qualidade alta provável",
  fail: "qualidade baixa provável",
  escalate: "evidência inconclusiva",
};

const GATE_STRENGTH_LABEL: Record<string, string> = {
  "decisive-high": "evidência decisiva de qualidade alta",
  "strong-high": "evidência forte de qualidade alta",
  "substantial-high": "evidência substancial de qualidade alta",
  inconclusive: "evidência inconclusiva",
  "substantial-low": "evidência substancial de qualidade baixa",
  "strong-low": "evidência forte de qualidade baixa",
  "decisive-low": "evidência decisiva de qualidade baixa",
};

const TASK_CLASS_LABEL: Record<string, string> = {
  "factual-qa": "pergunta factual",
};

const COHORT_LABEL: Record<string, string> = {
  baseline: "linha de base",
  canary: "exploração",
};

const CAUSE_LABEL: Record<string, string> = {
  ProviderDegraded: "Provedor de modelo degradado",
  TrafficSpike: "Pico de volume de perguntas",
  ModelDeprecated: "Modelo descontinuado pelo provedor",
  ConfigDrift: "Configuração fora do estado conhecido",
  Latency: "Latência",
  ErrorRate: "Taxa de erro",
  OutputQuality: "Qualidade da resposta",
  CostAnomaly: "Custo anômalo",
};

const SOURCE_LABEL: Record<string, string> = {
  djen: "Diário de Justiça Eletrônico Nacional",
  datajud: "DataJud",
};

function percent(value: number): string {
  return `${Math.round(value * 100)} por cento`;
}

function count(value: number): string {
  return value.toLocaleString("pt-BR");
}

function money(value: number): string {
  return `US$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

function Row({ label, children }: { label: string; children: string }) {
  return (
    <li className="flex flex-col gap-0.5 py-2.5">
      <p className="text-xs font-bold text-ink">{label}</p>
      <p className="text-xs leading-relaxed text-ink-soft">{children}</p>
    </li>
  );
}

export async function IntelligenceCard() {
  const snapshot = await intelligenceSnapshot();
  const report = await intelligenceReport();

  const liveRows: { label: string; value: string }[] = [
    {
      label: "Trocas observadas nesta execução",
      value:
        snapshot.exchanges === 0
          ? "Nenhuma troca com o modelo desde que o servidor subiu."
          : `${count(snapshot.exchanges)} ${snapshot.exchanges === 1 ? "troca observada" : "trocas observadas"}${snapshot.telemetryFailures > 0 ? `, ${count(snapshot.telemetryFailures)} ${snapshot.telemetryFailures === 1 ? "medição falhou" : "medições falharam"} sem afetar resposta (${snapshot.failedSteps.join(", ")})` : ""}.`,
    },
    {
      label: "Credencial do corpo",
      value: `${snapshot.identity.active ? "Ativa" : "Inativa"}, cadeia de auditoria ${snapshot.identity.auditIntact ? "íntegra" : "violada"}, ${count(snapshot.identity.auditEvents)} ${snapshot.identity.auditEvents === 1 ? "evento registrado" : "eventos registrados"}.`,
    },
    {
      label: "Inspeção da busca em documentos",
      value:
        snapshot.inspection.inspections === 0
          ? "Nenhuma inspeção ainda."
          : `${count(snapshot.inspection.inspections)} ${snapshot.inspection.inspections === 1 ? "inspeção" : "inspeções"}, ${count(snapshot.inspection.allowed)} sem apontamento e ${count(snapshot.inspection.flagged)} com apontamento; a última foi ${DECISION_LABEL[snapshot.inspection.lastDecision ?? ""] ?? snapshot.inspection.lastDecision ?? "nenhuma"}.`,
    },
    {
      label: "Comportamento do corpo entre as trocas",
      value:
        snapshot.drift === null
          ? "Ainda sem troca observada neste processo."
          : `Linha de base ${DRIFT_STATUS_LABEL[snapshot.drift.status] ?? snapshot.drift.status}, saúde de comportamento ${count(Math.round(snapshot.drift.behaviorScore))} de 100, severidade ${SEVERITY_LABEL[snapshot.drift.severity] ?? snapshot.drift.severity}, ${count(snapshot.drift.findings)} ${snapshot.drift.findings === 1 ? "achado" : "achados"}.`,
    },
    {
      label: "Mudanças de regime detectadas",
      value: `${count(snapshot.shifts.latencyChangepoints)} na latência e ${count(snapshot.shifts.outputChangepoints)} no tamanho da resposta.`,
    },
    {
      label: "Rastro das trocas",
      value: `${count(snapshot.trace.spans)} ${snapshot.trace.spans === 1 ? "traço" : "traços"}, ${count(snapshot.trace.inputTokens)} tokens de entrada e ${count(snapshot.trace.outputTokens)} de saída${snapshot.trace.costUsd > 0 ? `, ${money(snapshot.trace.costUsd)}` : ""}.`,
    },
    {
      label: "Lastro da última resposta",
      value:
        snapshot.grounding === null
          ? "Nenhuma resposta entregue neste processo ainda."
          : `${percent(snapshot.grounding.score)} das frases com lastro, ${count(snapshot.grounding.claims)} ${snapshot.grounding.claims === 1 ? "frase lida" : "frases lidas"}, leitura ${TIER_LABEL[snapshot.grounding.tier] ?? snapshot.grounding.tier}.`,
    },
    {
      label: "Leitura calibrada de qualidade",
      value:
        snapshot.gate === null
          ? "Ainda sem observação suficiente."
          : `${count(snapshot.gate.observations)} ${snapshot.gate.observations === 1 ? "observação" : "observações"}; última leitura: ${GATE_ACTION_LABEL[snapshot.gate.lastAction] ?? snapshot.gate.lastAction}, ${GATE_STRENGTH_LABEL[snapshot.gate.lastStrength] ?? snapshot.gate.lastStrength}.`,
    },
    {
      label: "Memória de trabalho e grafo de fatos",
      value: `${count(snapshot.memoryRecords)} ${snapshot.memoryRecords === 1 ? "registro de troca na memória" : "registros de troca na memória"}, ${count(snapshot.factGraph.facts)} ${snapshot.factGraph.facts === 1 ? "fato" : "fatos"} sobre ${count(snapshot.factGraph.entities)} ${snapshot.factGraph.entities === 1 ? "entidade" : "entidades"}, ${count(snapshot.factGraph.contradictions)} ${snapshot.factGraph.contradictions === 1 ? "contradição" : "contradições"}.`,
    },
    {
      label: "Gravação determinística",
      value: `${count(snapshot.recordedEvents)} ${snapshot.recordedEvents === 1 ? "evento gravado" : "eventos gravados"} para reexecução exata.`,
    },
    {
      label: "Classificação da tarefa",
      value:
        snapshot.tuner === null
          ? "Ainda sem classificação neste processo."
          : `${TASK_CLASS_LABEL[snapshot.tuner.taskClass] ?? snapshot.tuner.taskClass}, coorte ${COHORT_LABEL[snapshot.tuner.cohort] ?? snapshot.tuner.cohort}; a recomendação é registrada e não altera a chamada nesta fase.`,
    },
    {
      label: "Disciplina de prompt",
      value: `${count(snapshot.promptPlan.calls)} ${snapshot.promptPlan.calls === 1 ? "chamada planejada" : "chamadas planejadas"}, reaproveitamento de ${percent(snapshot.promptPlan.hitRatio)}, ${count(snapshot.promptPlan.lintFindings)} ${snapshot.promptPlan.lintFindings === 1 ? "apontamento" : "apontamentos"} no último plano.`,
    },
    {
      label: "Dinheiro autorizado e registrado",
      value: snapshot.money.budgetConfigured
        ? `Conversa em curso ${money(snapshot.money.taskUsd)}, dia ${money(snapshot.money.dayUsd)}, tetos configurados no ambiente.`
        : "Sem preço em dólar configurado; o consumo é medido em tokens e nenhum dinheiro é estimado.",
    },
  ];

  return (
    <section
      aria-label="Observação da camada de Inteligência Massiva"
      className="flex flex-col gap-5 rounded-lg border border-line bg-card p-6 shadow-card"
    >
      <header className="flex items-start gap-2.5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-ink">
          <Gauge size={18} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">
            Observação da camada de Inteligência Massiva
          </h2>
          <p className="text-sm text-ink-soft">
            O que o escritório mede sobre as trocas com David, nesta execução do
            servidor e no livro de consumo do dia. Toda leitura é auxiliar,
            registrada para a Administração, e nada aqui decide nem confirma
            coisa alguma.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-bold text-ink">Nesta execução</h3>
        <ul className="flex flex-col divide-y divide-line">
          {liveRows.map((row) => (
            <Row key={row.label} label={row.label}>
              {row.value}
            </Row>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-bold text-ink">
          No livro de consumo de {report.day}
        </h3>
        <ul className="flex flex-col divide-y divide-line">
          <Row label="Chamadas de modelo no dia">
            {report.modelCalls === 0
              ? "Nenhuma chamada registrada hoje."
              : `${count(report.modelCalls)} ${report.modelCalls === 1 ? "chamada registrada" : "chamadas registradas"}.`}
          </Row>
          {report.trust.map((entry) => {
            const pooled = report.pooled.find(
              (tenant) => tenant.tenant === entry.subject,
            );
            return (
              <Row key={entry.subject} label={`Confiança em ${entry.subject}`}>
                {`${percent(entry.score)} em ${count(entry.samples)} ${entry.samples === 1 ? "amostra" : "amostras"}, intervalo de ${percent(entry.lower)} a ${percent(entry.upper)}${pooled !== undefined ? `; agrupada entre os modelos, ${percent(pooled.mean)} com encolhimento de ${percent(pooled.shrinkage)}` : ""}.`}
              </Row>
            );
          })}
          <Row label="Previsão de consumo por hora">
            {report.hourlyTokens === null
              ? "Sem registro suficiente hoje para prever."
              : `Próximas ${count(report.hourlyTokens.nextHours.length)} horas com média prevista de ${count(Math.round(report.hourlyTokens.nextHours.reduce((sum, point) => sum + point.mean, 0) / Math.max(1, report.hourlyTokens.nextHours.length)))} tokens por hora; ${report.anomalousHours === 0 ? "nenhuma hora anômala hoje" : `${count(report.anomalousHours)} ${report.anomalousHours === 1 ? "hora anômala" : "horas anômalas"} hoje`}.`}
          </Row>
          {report.captureRisk.map((entry) => {
            const seconds = Math.max(1, Math.round(entry.horizonMs / 1000));
            const horizon = `${count(seconds)} ${seconds === 1 ? "segundo" : "segundos"}`;
            return (
              <Row
                key={entry.source}
                label={`Falha da captura, ${SOURCE_LABEL[entry.source] ?? entry.source}`}
              >
                {`${count(entry.runs)} ${entry.runs === 1 ? "execução medida" : "execuções medidas"}, ${count(entry.failures)} ${entry.failures === 1 ? "falha" : "falhas"}${entry.failureProbability === null ? "; sem falha registrada, nenhuma probabilidade é estimada" : `; probabilidade de ${percent(entry.failureProbability)} de uma execução falhar em até ${horizon}`}.`}
              </Row>
            );
          })}
          {report.causes.length > 0 ? (
            <Row label="Leitura auxiliar de causas">
              {`${report.causes.map((cause) => `${CAUSE_LABEL[cause.variable] ?? cause.variable}, ${percent(cause.posterior)}`).join("; ")}. A leitura vem de um modelo causal sobre a evidência medida do dia e serve de apoio à investigação humana.`}
            </Row>
          ) : null}
        </ul>
      </div>

      <p className="text-xs text-ink-soft">
        Nenhum valor de chave, pergunta ou resposta aparece nesta tela. As
        medições desta execução recomeçam quando o servidor reinicia; o livro do
        dia e as execuções de captura vivem em disco.
      </p>
    </section>
  );
}
