/*
 * The shapes the screens read, and nothing else. This file used to carry a
 * demonstration dataset, ordered by the director for the interface phase; the
 * office now writes its own records into its own database, so every collection
 * here is empty and every aggregate is zero. What remains is the vocabulary:
 * the types the components are written against and the two catalogues that are
 * not data at all, the navigation of the product and the subcategories of the
 * judicial track.
 *
 * Nothing in this file may ever be filled with an example again. A number on
 * screen that traces to no record of the office is the one thing the interface
 * of a law firm must never show.
 */

export type DeltaDirection = "up" | "down";

export type KpiEntry = {
  id: string;
  label: string;
  value: string;
  unit?: string;
  delta: string;
  deltaDirection: DeltaDirection;
  deltaLabel: string;
  /* Screen that owns the records behind the indicator. */
  href: string;
  destinationLabel: string;
};

export const kpis: KpiEntry[] = [];

export type CriticalDeadline = {
  id: string;
  caseRef: string;
  client: string;
  benefit: string;
  dueLabel: string;
  status: "calculated" | "confirmed";
  /* Screen that owns the record behind the notification. */
  href: string;
  destinationLabel: string;
};

export const criticalDeadlines: CriticalDeadline[] = [];

export type NavigationItem = {
  id: string;
  label: string;
  href?: string;
};

export const navigationItems: NavigationItem[] = [
  { id: "dashboard", label: "Painel", href: "/" },
  { id: "clients", label: "Clientes", href: "/clientes" },
  { id: "cases", label: "Casos", href: "/casos" },
  { id: "intake", label: "Atendimento", href: "/atendimento" },
  { id: "administrative", label: "Administrativo", href: "/administrativo" },
  { id: "judicial", label: "Judicial", href: "/judicial" },
  { id: "agenda", label: "Agenda", href: "/agenda" },
  { id: "tasks", label: "Tarefas", href: "/tarefas" },
  { id: "finance", label: "Financeiro", href: "/financeiro" },
];

export type AgendaEntry = {
  id: string;
  kind: "hearing" | "examination";
  caseRef: string;
  client: string;
  whenLabel: string;
  placeLabel: string;
};

/* Counts trace to the KPI entries: 3 hearings and 2 examinations this week. */
export const weeklyAgenda: AgendaEntry[] = [];

export type TaskEntry = {
  id: string;
  title: string;
  caseRef: string;
  priority: "high" | "medium" | "low";
  dueLabel: string;
  status: "todo" | "doing" | "review";
};

export const myTasks: TaskEntry[] = [];

export const financialResult = {
  receivedMonthLabel: "R$ 0,00",
  forecastLabel: "R$ 0,00",
  successCasesMonth: 0,
  monthLabel: "",
};

export type ClientCase = {
  caseRef: string;
  benefit: string;
  phase: "administrative" | "requirement" | "judicial" | "appeal" | "closed";
  phaseLabel: string;
  openDeadlines: number;
  benefitNumber?: string;
  lawsuitNumber?: string;
  /*
   * Screen that owns the operation of this case in its current phase. Declared
   * per record instead of derived in the component, so a case never points at a
   * screen that does not hold it.
   */
  href: string;
  destinationLabel: string;
};

export type ClientDocument = {
  id: string;
  name: string;
  status: "validated" | "pending";
  confidenceLabel: string;
};

export type ClientRecord = {
  id: string;
  fullName: string;
  avatarSrc: string;
  cpf: string;
  nit: string;
  birthDateLabel: string;
  maritalStatus: string;
  address: string;
  cityState: string;
  phone: string;
  email: string;
  situationLabel: "Ativo" | "Em análise" | "Documentação pendente";
  rg: string;
  motherName: string;
  bankInfoLabel: string;
  vulnerabilityLabel?: string;
  cases: ClientCase[];
  documents: ClientDocument[];
};

export const personaClients: ClientRecord[] = [];

export function findClientById(clientId: string): ClientRecord | undefined {
  return personaClients.find((client) => client.id === clientId);
}

export type IntakeStat = {
  id: string;
  label: string;
  value: string;
  /* Section of this same screen that holds the records behind the indicator. */
  sectionId: string;
  sectionLabel: string;
};

export const intakeStats: IntakeStat[] = [];

export type TriageChannel = "email" | "message" | "phone";

export type TriageKind =
  | "new-contact"
  | "existing-client"
  | "document"
  | "official";

export type ContactHistoryEntry = {
  dateLabel: string;
  channelLabel: string;
  summary: string;
  responsible: string;
};

export type TriageItem = {
  id: string;
  channel: TriageChannel;
  kind: TriageKind;
  senderName: string;
  senderCpf?: string;
  senderAvatarSrc?: string;
  receivedLabel: string;
  excerpt: string;
  imSuggestionLabel: string;
  imConfidencePercent: number;
  urgency: "high" | "medium" | "low";
  linkedCaseRef?: string;
  linkedBenefitLabel?: string;
  contactHistory?: ContactHistoryEntry[];
};

export const triageQueue: TriageItem[] = [];

export type AwaitingDocsCase = {
  id: string;
  client: string;
  clientAvatarSrc?: string;
  benefit: string;
  caseRef: string;
  receivedCount: number;
  totalRequired: number;
  missingDocuments: string[];
};

export const awaitingDocsCases: AwaitingDocsCase[] = [];

export type UnansweredContact = {
  id: string;
  name: string;
  avatarSrc?: string;
  channelLabel: string;
  waitingLabel: string;
};

export const unansweredContacts: UnansweredContact[] = [];

export type CommunicationLogEntry = {
  id: string;
  clientName: string;
  clientAvatarSrc?: string;
  caseRef?: string;
  channelLabel: string;
  dateLabel: string;
  summary: string;
  responsible: string;
};

export const communicationLog: CommunicationLogEntry[] = [];

export type AdministrativeStat = {
  id: string;
  label: string;
  value: string;
  /* Section of this same screen that holds the records behind the indicator. */
  sectionId: string;
  sectionLabel: string;
};

export const administrativeStats: AdministrativeStat[] = [];

export type AdministrativeRequirement = {
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  benefit: string;
  benefitNumber: string;
  entryDateLabel: string;
  protocolLabel: string;
  statusLabel: string;
};

export const administrativeRequirements: AdministrativeRequirement[] = [];

export type AdministrativeExigency = {
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  description: string;
  dueLabel: string;
  status: "calculated" | "confirmed";
};

/*
 * Due labels and states trace to the critical-deadline records of the same
 * cases; the third exigency covers the single open deadline of case 2025.0012.
 */
export const administrativeExigencies: AdministrativeExigency[] = [];

export type AdministrativeExamination = {
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  kindLabel: string;
  whenLabel: string;
  placeLabel: string;
  preparationLabel: string;
};

/* Mirrors the weekly-agenda examinations of cases 2024.0187 and 2024.0051. */
export const administrativeExaminations: AdministrativeExamination[] = [];

export type AdministrativeDecision = {
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  benefit: string;
  outcomeLabel: string;
  groundsLabel: string;
  pathLabel: string;
  gateLabel: string;
};

/*
 * dec-1 traces to case 2023.0342: the INSS decision communication is a
 * validated document of the client record and the case is now in the judicial
 * phase. dec-2 traces to case 2025.0034, kept in the administrative phase by
 * the ordinary appeal to the CRPS registered below.
 */
export const administrativeDecisions: AdministrativeDecision[] = [];

export type CrpsAppeal = {
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  benefit: string;
  filedLabel: string;
  statusLabel: string;
};

/* Traces to decision dec-2 of case 2025.0034. */
export const crpsAppeals: CrpsAppeal[] = [];

export type JudicialTrackedCase = {
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  benefit: string;
  lawsuitNumber: string;
  phaseLabel: string;
  openDeadlines: number;
  /*
   * The Judicial screen owns the operation of these lawsuits; this card is
   * context reading only, so each row points at the lawsuit detail there.
   */
  href: string;
};

export const judicialTrackedCases: JudicialTrackedCase[] = [];

export type JudicialStat = {
  id: string;
  label: string;
  value: string;
  /*
   * Where the records behind the indicator live. A value starting with the
   * hash sign is a section of this same screen; anything else is the screen
   * that owns them.
   */
  href: string;
  destinationLabel: string;
};

/*
 * Values trace to the lawsuit records below: 4 active lawsuits, 7 open
 * deadlines (3 + 2 + 1 + 1), the 3 weekly-agenda hearings all belonging to
 * these lawsuits, and 2 summonses captured today.
 */
export const judicialStats: JudicialStat[] = [];

/*
 * Subcategory set fixed by the director on 2026-08-09: the six of the
 * registered proposal, plus the overall view of every active lawsuit.
 */
export type JudicialSubcategory =
  | "concession"
  | "reinstatement"
  | "revision"
  | "accident"
  | "assistance"
  | "execution";

export const judicialSubcategories: {
  id: JudicialSubcategory;
  label: string;
}[] = [
  { id: "concession", label: "Concessão" },
  { id: "reinstatement", label: "Restabelecimento" },
  { id: "revision", label: "Revisão" },
  { id: "accident", label: "Acidentário" },
  { id: "assistance", label: "Assistencial" },
  { id: "execution", label: "Execução" },
];

export type LawsuitMovement = {
  id: string;
  dateLabel: string;
  description: string;
  sourceLabel: string;
};

export type LawsuitSummons = {
  id: string;
  dateLabel: string;
  summary: string;
  generatedDeadlineLabel: string;
};

export type LawsuitDeadline = {
  id: string;
  title: string;
  dueLabel: string;
  status: "calculated" | "confirmed";
};

export type LawsuitHearing = {
  id: string;
  kindLabel: string;
  whenLabel: string;
  placeLabel: string;
};

export type LawsuitFiling = {
  id: string;
  title: string;
  statusLabel: string;
};

export type JudicialLawsuit = {
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  benefit: string;
  subcategory: JudicialSubcategory;
  lawsuitNumber: string;
  courtLabel: string;
  classLabel: string;
  distributionDateLabel: string;
  phaseLabel: string;
  openDeadlines: number;
  movements: LawsuitMovement[];
  summonses: LawsuitSummons[];
  deadlines: LawsuitDeadline[];
  hearings: LawsuitHearing[];
  filings: LawsuitFiling[];
};

export const judicialLawsuits: JudicialLawsuit[] = [];

export function findLawsuitById(
  lawsuitId: string,
): JudicialLawsuit | undefined {
  return judicialLawsuits.find((lawsuit) => lawsuit.id === lawsuitId);
}

export type AgendaStat = {
  id: string;
  label: string;
  value: string;
  /* Section of this same screen that holds the records behind the indicator. */
  sectionId: string;
  sectionLabel: string;
};

/*
 * Values trace to the unified items below: the 5 weekly-agenda events, the 10
 * open deadlines of the administrative and judicial screens, the 2 deadlines
 * flagged critical by proximity, and the single untreated escalation.
 */
export const agendaStats: AgendaStat[] = [];

export type AgendaWeekday = "mon" | "tue" | "wed" | "thu" | "fri";

export const agendaWeekdays: { id: AgendaWeekday; label: string }[] = [
  { id: "mon", label: "Segunda" },
  { id: "tue", label: "Terça" },
  { id: "wed", label: "Quarta" },
  { id: "thu", label: "Quinta" },
  { id: "fri", label: "Sexta" },
];

export type UnifiedAgendaItem = {
  id: string;
  kind: "hearing" | "examination" | "deadline";
  title: string;
  client: string;
  clientAvatarSrc?: string;
  caseRef: string;
  whenLabel: string;
  dayId?: AgendaWeekday;
  status?: "calculated" | "confirmed";
  dueThisWeek?: boolean;
  critical?: boolean;
  escalated?: boolean;
  preparationLabel?: string;
  /*
   * The agenda aggregates records that other screens operate, so each item
   * points at the screen that owns its case in the current phase.
   */
  href: string;
  destinationLabel: string;
};

/*
 * Events mirror the weekly agenda; deadlines mirror the administrative
 * exigencies and the judicial lawsuit deadlines, item by item.
 */
export const unifiedAgendaItems: UnifiedAgendaItem[] = [];

export type FinanceStat = {
  id: string;
  label: string;
  value: string;
  /*
   * Where the records behind the indicator live. A value starting with the
   * hash sign is a section of this same screen; anything else is the screen
   * that owns them.
   */
  href: string;
  destinationLabel: string;
};

/*
 * The received and forecast values mirror the dashboard financial result and
 * decompose exactly into the receipt and forecast entries below; the success
 * count mirrors the same dashboard record; the hours value sums the week's
 * hour entries.
 */
export const financeStats: FinanceStat[] = [];

export type FeeContract = {
  /* The lawyer the line is attributable to. Money is read by the office
   * through this field and never through a name written in code. */
  responsibleLawyer: string;
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  benefit: string;
  contractLabel: string;
  participationLabel: string;
  /*
   * Finance aggregates records operated on other screens, so each row
   * points at the screen that owns its case.
   */
  href: string;
  destinationLabel: string;
};

export const feeContracts: FeeContract[] = [];

export type HourEntry = {
  /* The lawyer the line is attributable to. Money is read by the office
   * through this field and never through a name written in code. */
  responsibleLawyer: string;
  id: string;
  caseRef: string;
  client: string;
  dateLabel: string;
  description: string;
  durationLabel: string;
  /*
   * Finance aggregates records operated on other screens, so each row
   * points at the screen that owns its case.
   */
  href: string;
  destinationLabel: string;
};

/* The three entries sum the 9h30 of the finance stat. */
export const hourEntries: HourEntry[] = [];

export type ReceiptEntry = {
  /* The lawyer the line is attributable to. Money is read by the office
   * through this field and never through a name written in code. */
  responsibleLawyer: string;
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  dateLabel: string;
  description: string;
  amountLabel: string;
  /*
   * Finance aggregates records operated on other screens, so each row
   * points at the screen that owns its case.
   */
  href: string;
  destinationLabel: string;
};

/* The three amounts sum the R$ 18.450,00 received in August. */
export const receiptEntries: ReceiptEntry[] = [];

export type ForecastEntry = {
  /* The lawyer the line is attributable to. Money is read by the office
   * through this field and never through a name written in code. */
  responsibleLawyer: string;
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  description: string;
  conditionLabel: string;
  amountLabel: string;
  /*
   * Finance aggregates records operated on other screens, so each row
   * points at the screen that owns its case.
   */
  href: string;
  destinationLabel: string;
};

/* The three amounts sum the R$ 32.900,00 forecast. */
export const forecastEntries: ForecastEntry[] = [];

export type RequisitionEntry = {
  /* The lawyer the line is attributable to. Money is read by the office
   * through this field and never through a name written in code. */
  responsibleLawyer: string;
  id: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  kindLabel: string;
  statusLabel: string;
  /*
   * Finance aggregates records operated on other screens, so each row
   * points at the screen that owns its case.
   */
  href: string;
  destinationLabel: string;
};

/* Traces to the closed case 2022.0311 and reconciles with receipt rc-1. */
export const requisitionEntries: RequisitionEntry[] = [];

/*
 * Portfolio of the lawyer by pleaded benefit, over the benefit list the director
 * fixed on 2026-08-11. Two invariants hold and the screen depends on both: the
 * sum equals activeCasesTotal, exactly as casesByPhase does, so the shares add
 * to one hundred per cent; and every benefit the office pleads appears here,
 * which is why some rows carry no detailed record among personaClients. The
 * card says on screen that this is the demonstration portfolio and that the
 * count of registered cases lives on the Casos screen.
 */
export type GrantRate = {
  id: string;
  label: string;
  granted: number;
  decided: number;
  noteLabel: string;
};

/*
 * Grant rate over the lawyer's own decided cases. The percentage is derived
 * from granted over decided, never stored, so the number on screen always
 * decomposes into the two counts shown beside it.
 */
export const grantRates: GrantRate[] = [];

export type RiskAlert = {
  id: string;
  kindLabel: string;
  caseRef: string;
  client: string;
  clientAvatarSrc: string;
  detailLabel: string;
  sourceLabel: string;
  /* Screen that owns the record behind the notification. */
  href: string;
  destinationLabel: string;
};

/*
 * Risk alerts of the compliance module. Each one traces to an existing case
 * record and names the legal ground, never a bare number.
 */
export const riskAlerts: RiskAlert[] = [];

export const overdueDeadlines = {
  count: 0,
  scopeLabel: "Nenhum prazo em aberto.",
};

export type CaptureSource = {
  id: string;
  label: string;
  statusLabel: string;
  lastRunLabel: string;
  resultLabel: string;
  roleLabel: string;
  healthy: boolean;
  /* Screen that owns the record behind the notification. */
  href: string;
  destinationLabel: string;
};

/*
 * Health of the scheduled external captures. Unavailability must be visible
 * here so a capture failure is noticed on the same day and not on the eve of
 * the deadline. The DJEN is the source of the deadline; DataJud is tracking
 * only and is never a deadline source.
 */
export const captureSources: CaptureSource[] = [];
