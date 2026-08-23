import "server-only";
import { captureHealth } from "@/lib/capture/runs";
import { listCommunications } from "@/lib/capture/store";
import { type CaseStatusId, caseStatuses } from "@/lib/case-domain";
import { listUnifiedCases, type UnifiedCase } from "@/lib/case-views";
import { officeProfile } from "@/lib/office-profile";
import {
  administrativeExigencies,
  criticalDeadlines,
  myTasks,
  riskAlerts,
  weeklyAgenda,
} from "@/lib/persona";
import { listAllCases } from "@/lib/records-store";

/*
 * The reading layer of the Tarefas board, and only a reading layer: nothing
 * here writes, decides or changes a record. The board is the situation of the
 * logged lawyer laid out as a kanban whose columns are the waterfall of a piece
 * of work, from the moment it arrives by an official source to the moment it is
 * closed, plus the track of the cases themselves, which is the waterfall the
 * law imposes.
 *
 * Every count is computed here at render time, from the same sources the other
 * screens read: the unified case layer, the capture store and the demonstration
 * dataset of the operation. A number invented for this board would be a second
 * truth on the same product, which this project has already paid for twice.
 */

export type BoardCardKind =
  | "task"
  | "deadline"
  | "hearing"
  | "examination"
  | "document"
  | "risk"
  | "capture"
  | "case";

export type BoardChipTone = "attention" | "critical" | "neutral" | "brand";

export type BoardChip = { label: string; tone: BoardChipTone };

export type BoardCard = {
  id: string;
  kind: BoardCardKind;
  title: string;
  client: string | null;
  caseLabel: string | null;
  detail: string | null;
  chips: BoardChip[];
  href: string;
  destinationLabel: string;
};

export type WorkColumnId =
  | "arrived"
  | "decide"
  | "todo"
  | "active"
  | "waiting"
  | "done";

export type WorkColumn = {
  id: WorkColumnId;
  title: string;
  description: string;
  emptyLabel: string;
  cards: BoardCard[];
};

export type TrackColumnId = "intake" | CaseStatusId;

export type TrackColumn = {
  id: TrackColumnId;
  title: string;
  detail: string;
  cases: UnifiedCase[];
};

export type TasksBoard = {
  lawyerName: string;
  workColumns: WorkColumn[];
  trackColumns: TrackColumn[];
  workTotal: number;
  caseTotal: number;
};

const TASK_PRIORITY_CHIP: Record<
  (typeof myTasks)[number]["priority"],
  BoardChip
> = {
  high: { label: "Alta", tone: "attention" },
  medium: { label: "Média", tone: "critical" },
  low: { label: "Baixa", tone: "neutral" },
};

const DEADLINE_STATE_CHIP: Record<"calculated" | "confirmed", BoardChip> = {
  calculated: { label: "Calculado", tone: "attention" },
  confirmed: { label: "Confirmado", tone: "critical" },
};

/* The fixture records name only the case reference; the client, the benefit
 * and the canonical page come from the unified case layer, so this board can
 * never spell a case differently from the screen that owns it. */
function caseIndexOf(cases: UnifiedCase[]): Map<string, UnifiedCase> {
  const index = new Map<string, UnifiedCase>();
  for (const entry of cases) {
    index.set(entry.caseRef, entry);
  }
  return index;
}

function caseLabelOf(entry: UnifiedCase | undefined, caseRef: string): string {
  if (entry === undefined) {
    return caseRef;
  }
  return `${entry.caseRef}, ${entry.caseType}`;
}

export async function buildTasksBoard(): Promise<TasksBoard> {
  const [cases, communications, health] = await Promise.all([
    listUnifiedCases(),
    listCommunications(),
    captureHealth(),
  ]);
  const byRef = caseIndexOf(cases);

  /* Column one, what arrived by an official source and is not work yet. */
  const arrived: BoardCard[] = [];

  const unlinked = communications.filter((entry) => entry.link === null);
  const unlinkedProcesses = new Set(
    unlinked.map((entry) => entry.processNumber ?? `sem-numero:${entry.id}`),
  );
  if (unlinked.length > 0) {
    arrived.push({
      id: "arrived-queue",
      kind: "capture",
      title: "Fila de vínculo do Diário",
      client: null,
      caseLabel: null,
      detail: `${unlinkedProcesses.size} processos, ${unlinked.length} comunicações capturadas aguardando vínculo a um caso. Uma confirmação por processo vincula todos os atos dele.`,
      chips: [{ label: "Aguardando vínculo", tone: "neutral" }],
      href: "/judicial",
      destinationLabel: "Judicial",
    });
  }

  const suggested = unlinked.filter((entry) => entry.suggestions.length > 0);
  if (suggested.length > 0) {
    arrived.push({
      id: "arrived-suggestions",
      kind: "capture",
      title: "Sugestões de vínculo por nome",
      client: null,
      caseLabel: null,
      detail: `${suggested.length} comunicações têm sugestão de caso pela semelhança do nome e aguardam confirmação humana.`,
      chips: [{ label: "Confirmação humana", tone: "attention" }],
      href: "/judicial",
      destinationLabel: "Judicial",
    });
  }

  for (const source of health) {
    if (!source.healthy) {
      arrived.push({
        id: `arrived-source-${source.source}`,
        kind: "capture",
        title: source.label,
        client: null,
        caseLabel: null,
        detail: `${source.statusLabel}. ${source.lastResult ?? "Nenhuma execução registrada até agora."}`,
        chips: [{ label: source.statusLabel, tone: "critical" }],
        href: "/judicial",
        destinationLabel: "Judicial",
      });
    }
  }

  /* Documents come from the stored cases; the unified layer keeps only the
   * names, so the states are read from the same records the case page reads. */
  const decide: BoardCard[] = [];
  const storedCases = await listAllCases();
  for (const { record, client } of storedCases) {
    for (const document of record.documents) {
      const href = `/casos/${client.id}/${record.id}`;
      const caseLabel = record.reference?.trim().length
        ? `${record.reference}, ${record.caseType}`
        : record.caseType;
      if (document.state === "uploaded" || document.state === "processing") {
        arrived.push({
          id: `arrived-document-${document.id}`,
          kind: "document",
          title: document.fileName,
          client: client.fullName,
          caseLabel,
          detail:
            "Leitura local em andamento. O documento entra no acervo do caso assim que a extração terminar.",
          chips: [{ label: "Em processamento", tone: "neutral" }],
          href,
          destinationLabel: "Ficha do caso",
        });
      }
      if (document.state === "needs-review") {
        decide.push({
          id: `decide-document-${document.id}`,
          kind: "document",
          title: document.fileName,
          client: client.fullName,
          caseLabel,
          detail:
            "A leitura ficou abaixo do limiar de confiança e aguarda validação humana. Nada extraído daqui entra em cálculo ou peça antes disso.",
          chips: [{ label: "Requer revisão humana", tone: "attention" }],
          href,
          destinationLabel: "Ficha do caso",
        });
      }
      if (document.state === "failed") {
        decide.push({
          id: `decide-document-${document.id}`,
          kind: "document",
          title: document.fileName,
          client: client.fullName,
          caseLabel,
          detail:
            "A leitura local não produziu texto aproveitável. O original permanece acessível e a decisão sobre o tratamento é do advogado.",
          chips: [{ label: "Falha no processamento", tone: "critical" }],
          href,
          destinationLabel: "Ficha do caso",
        });
      }
    }
  }

  /* Column two, the acts the constitution of this office reserves to a person:
   * confirming a deadline, validating a low confidence reading, resolving an
   * act that carries two possible deadlines, treating a legal risk. */
  for (const deadline of criticalDeadlines) {
    if (deadline.status !== "calculated") {
      continue;
    }
    const entry = byRef.get(deadline.caseRef);
    decide.push({
      id: `decide-deadline-${deadline.id}`,
      kind: "deadline",
      title: "Confirmar o prazo calculado",
      client: deadline.client,
      caseLabel: caseLabelOf(entry, deadline.caseRef),
      detail: `${deadline.benefit}, ${deadline.dueLabel}. O prazo nasceu calculado e só passa a confirmado por ato seu, registrado em auditoria.`,
      chips: [DEADLINE_STATE_CHIP.calculated],
      href: deadline.href,
      destinationLabel: deadline.destinationLabel,
    });
  }

  const divergent = communications.filter((entry) =>
    (entry.extraction?.residue ?? []).some((item) =>
      item.startsWith("prazos divergentes"),
    ),
  );
  if (divergent.length > 0) {
    decide.push({
      id: "decide-divergent",
      kind: "capture",
      title: "Atos com prazos divergentes",
      client: null,
      caseLabel: null,
      detail: `${divergent.length} atos capturados citam mais de um prazo possível. A máquina nunca escolhe entre eles: cada um espera a leitura de um advogado na fila.`,
      chips: [{ label: "Decisão humana", tone: "attention" }],
      href: "/judicial",
      destinationLabel: "Judicial",
    });
  }

  for (const risk of riskAlerts) {
    const entry = byRef.get(risk.caseRef);
    decide.push({
      id: `decide-risk-${risk.id}`,
      kind: "risk",
      title: risk.kindLabel,
      client: risk.client,
      caseLabel: caseLabelOf(entry, risk.caseRef),
      detail: risk.detailLabel,
      chips: [{ label: "Alerta assistido", tone: "critical" }],
      href: risk.href,
      destinationLabel: risk.destinationLabel,
    });
  }

  /* Column three, the open work of the lawyer, ordered by what expires. */
  const todo: BoardCard[] = [];
  for (const task of myTasks) {
    if (task.status !== "todo") {
      continue;
    }
    const entry = byRef.get(task.caseRef);
    todo.push({
      id: `todo-task-${task.id}`,
      kind: "task",
      title: task.title,
      client: entry?.clientName ?? null,
      caseLabel: caseLabelOf(entry, task.caseRef),
      detail: `Vence ${task.dueLabel}.`,
      chips: [TASK_PRIORITY_CHIP[task.priority]],
      href: entry?.href ?? "/agenda",
      destinationLabel: entry === undefined ? "Agenda" : "Ficha do caso",
    });
  }
  for (const deadline of criticalDeadlines) {
    if (deadline.status !== "confirmed") {
      continue;
    }
    const entry = byRef.get(deadline.caseRef);
    todo.push({
      id: `todo-deadline-${deadline.id}`,
      kind: "deadline",
      title: "Cumprir o prazo confirmado",
      client: deadline.client,
      caseLabel: caseLabelOf(entry, deadline.caseRef),
      detail: `${deadline.benefit}, ${deadline.dueLabel}.`,
      chips: [DEADLINE_STATE_CHIP.confirmed],
      href: deadline.href,
      destinationLabel: deadline.destinationLabel,
    });
  }
  for (const exigency of administrativeExigencies) {
    const entry = byRef.get(exigency.caseRef);
    /* On a task card the bare deadline state would be ambiguous, so the chip
     * names the deadline explicitly. */
    const state = DEADLINE_STATE_CHIP[exigency.status];
    todo.push({
      id: `todo-exigency-${exigency.id}`,
      kind: "task",
      title: "Responder a exigência do INSS",
      client: exigency.client,
      caseLabel: caseLabelOf(entry, exigency.caseRef),
      detail: `${exigency.description}, ${exigency.dueLabel}.`,
      chips: [
        { label: `Prazo ${state.label.toLowerCase()}`, tone: state.tone },
      ],
      href: "/administrativo",
      destinationLabel: "Administrativo",
    });
  }

  /* Column four, what is moving: in execution under the lawyer's hands or in
   * review before it leaves the office. One stage of the flow, and each card
   * says which of the two states it is in. */
  const active: BoardCard[] = [];
  for (const task of myTasks) {
    if (task.status !== "doing" && task.status !== "review") {
      continue;
    }
    const entry = byRef.get(task.caseRef);
    active.push({
      id: `active-task-${task.id}`,
      kind: "task",
      title: task.title,
      client: entry?.clientName ?? null,
      caseLabel: caseLabelOf(entry, task.caseRef),
      detail: `Vence ${task.dueLabel}.`,
      chips: [
        {
          label: task.status === "doing" ? "Em execução" : "Em revisão",
          tone: "neutral",
        },
        TASK_PRIORITY_CHIP[task.priority],
      ],
      href: entry?.href ?? "/agenda",
      destinationLabel: entry === undefined ? "Agenda" : "Ficha do caso",
    });
  }

  /* Column five, what depends on a scheduled date or on a third party. */
  const waiting: BoardCard[] = weeklyAgenda.map((item) => {
    const entry = byRef.get(item.caseRef);
    return {
      id: `waiting-${item.id}`,
      kind: item.kind,
      title: item.kind === "hearing" ? "Audiência marcada" : "Perícia marcada",
      client: item.client,
      caseLabel: caseLabelOf(entry, item.caseRef),
      detail: `${item.whenLabel}, ${item.placeLabel}.`,
      chips: [{ label: "Data marcada", tone: "neutral" }],
      href: "/agenda",
      destinationLabel: "Agenda",
    };
  });

  /* Column six, what closed and stays as record. */
  const done: BoardCard[] = cases
    .filter((entry) => entry.status === "closed")
    .map((entry) => ({
      id: `done-${entry.key}`,
      kind: "case" as const,
      title: entry.caseType,
      client: entry.clientName,
      caseLabel: entry.caseRef,
      detail: `${entry.sphereLabel}. Sem etapa pendente no escritório.`,
      chips: [{ label: "Encerrado", tone: "neutral" as const }],
      href: entry.href,
      destinationLabel: "Ficha do caso",
    }));

  const workColumns: WorkColumn[] = [
    {
      id: "arrived",
      title: "Entrada",
      description:
        "O que chegou pelas fontes oficiais e ainda não virou trabalho de ninguém.",
      emptyLabel: "Nada aguardando triagem neste momento.",
      cards: arrived,
    },
    {
      id: "decide",
      title: "Só o advogado decide",
      description:
        "Atos que a governança reserva a uma pessoa: confirmar prazo, validar leitura, resolver divergência, tratar risco.",
      emptyLabel: "Nenhuma decisão reservada pendente.",
      cards: decide,
    },
    {
      id: "todo",
      title: "A fazer",
      description:
        "Trabalho aberto dos seus casos, com o vencimento de cada item à vista.",
      emptyLabel: "Nenhum trabalho aberto.",
      cards: todo,
    },
    {
      id: "active",
      title: "Em andamento",
      description:
        "O que está em movimento: em execução sob a sua condução ou em revisão antes de seguir.",
      emptyLabel: "Nada em andamento neste momento.",
      cards: active,
    },
    {
      id: "waiting",
      title: "Aguardando terceiros",
      description: "O que depende do INSS, do juízo ou de uma data já marcada.",
      emptyLabel: "Nada aguardando terceiros.",
      cards: waiting,
    },
    {
      id: "done",
      title: "Concluído",
      description: "O que se encerrou e permanece como registro do escritório.",
      emptyLabel: "Nada concluído no recorte atual.",
      cards: done,
    },
  ];

  /* The track of the cases, which is the waterfall the law writes: a case in
   * instruction, then the administrative phase, then the judicial one, then
   * appeal and execution, until it closes. A case appears exactly once. */
  const trackColumns: TrackColumn[] = [
    {
      id: "intake",
      title: "Em instrução",
      detail: "Caso aberto e ainda reunindo os documentos obrigatórios.",
      cases: cases.filter(
        (entry) => entry.status !== "closed" && entry.intakePending,
      ),
    },
    ...caseStatuses.map((status) => ({
      id: status.id,
      title: status.label,
      detail: status.detailLabel,
      cases: cases.filter((entry) =>
        status.id === "closed"
          ? entry.status === "closed"
          : entry.status === status.id && !entry.intakePending,
      ),
    })),
  ];

  return {
    lawyerName: (await officeProfile()).fullName,
    workColumns,
    trackColumns,
    workTotal: workColumns.reduce(
      (sum, column) => sum + column.cards.length,
      0,
    ),
    caseTotal: cases.length,
  };
}
