/*
 * Front-end persona dataset, ordered by the director for the UI design phase.
 * Every value below is display data for the lawyer persona and will be removed
 * after full approval, before any push or deploy. Never ship to production.
 */

export const personaLawyer = {
  fullName: "Mendelsson Sandrini Alves Maciel",
  firstName: "Mendelsson",
  email: "mendelsson@advprev.adv.br",
  role: "Advogado responsável",
  team: "Advogados",
  avatarSrc: "/avatars/zaid-schwartz.jpeg",
};

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

export const kpis: KpiEntry[] = [
  {
    id: "deadlines-7d",
    label: "Prazos a vencer em 7 dias",
    value: "9",
    delta: "+2",
    deltaDirection: "up",
    deltaLabel: "dois a mais que na semana anterior",
    href: "/agenda",
    destinationLabel: "Agenda",
  },
  {
    id: "hearings-week",
    label: "Audiências da semana",
    value: "3",
    delta: "+1",
    deltaDirection: "up",
    deltaLabel: "uma a mais que na semana anterior",
    href: "/agenda",
    destinationLabel: "Agenda",
  },
  {
    id: "examinations-week",
    label: "Perícias da semana",
    value: "2",
    delta: "0",
    deltaDirection: "down",
    deltaLabel: "mesmo volume da semana anterior",
    href: "/agenda",
    destinationLabel: "Agenda",
  },
  {
    id: "new-publications",
    label: "Publicações novas",
    value: "14",
    delta: "+5",
    deltaDirection: "up",
    deltaLabel: "cinco a mais que ontem",
    href: "/judicial",
    destinationLabel: "Judicial",
  },
];

export const deadlineOverview = {
  confirmed: 12,
  calculated: 20,
  critical: 5,
  get total(): number {
    return this.confirmed + this.calculated + this.critical;
  },
};

export const activeCasesTotal = 48;

export type ActivityDay = {
  day: string;
  publications: number;
  highlighted?: boolean;
};

export const monthlyActivity: ActivityDay[] = [
  { day: "01", publications: 4 },
  { day: "02", publications: 7 },
  { day: "03", publications: 3 },
  { day: "04", publications: 6 },
  { day: "05", publications: 9 },
  { day: "06", publications: 5 },
  { day: "07", publications: 8 },
  { day: "08", publications: 12, highlighted: true },
  { day: "09", publications: 6 },
  { day: "10", publications: 4 },
  { day: "11", publications: 7 },
  { day: "12", publications: 10 },
  { day: "13", publications: 5 },
  { day: "14", publications: 8 },
];

export const monthlyActivityTotal = monthlyActivity.reduce(
  (sum, entry) => sum + entry.publications,
  0,
);

export type PhaseSlice = {
  id: string;
  label: string;
  count: number;
};

export const casesByPhase: PhaseSlice[] = [
  { id: "administrative", label: "Fase administrativa", count: 21 },
  { id: "requirement", label: "Em exigência no INSS", count: 6 },
  { id: "judicial", label: "Fase judicial", count: 18 },
  { id: "appeal", label: "Em recurso", count: 3 },
];

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

export const criticalDeadlines: CriticalDeadline[] = [
  {
    id: "cd-1",
    href: "/agenda",
    destinationLabel: "Agenda",
    caseRef: "Caso 2024.0187",
    client: "Maria Aparecida da Silva",
    benefit: "Aposentadoria por incapacidade permanente",
    dueLabel: "vence em 2 dias úteis",
    status: "calculated",
  },
  {
    id: "cd-2",
    href: "/agenda",
    destinationLabel: "Agenda",
    caseRef: "Caso 2023.0342",
    client: "José Carlos Ferreira",
    benefit: "Auxílio por incapacidade temporária",
    dueLabel: "vence em 3 dias úteis",
    status: "confirmed",
  },
  {
    id: "cd-3",
    href: "/agenda",
    destinationLabel: "Agenda",
    caseRef: "Caso 2024.0051",
    client: "Antônia Pereira dos Santos",
    benefit: "BPC/LOAS, idoso",
    dueLabel: "vence em 5 dias úteis",
    status: "calculated",
  },
];

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
export const weeklyAgenda: AgendaEntry[] = [
  {
    id: "ag-1",
    kind: "hearing",
    caseRef: "Caso 2023.0342",
    client: "José Carlos Ferreira",
    whenLabel: "segunda-feira, 10h30",
    placeLabel: "2ª Vara Federal de São Paulo, sala 4",
  },
  {
    id: "ag-2",
    kind: "examination",
    caseRef: "Caso 2024.0187",
    client: "Maria Aparecida da Silva",
    whenLabel: "terça-feira, 9h00",
    placeLabel: "Perícia médica administrativa, agência do INSS",
  },
  {
    id: "ag-3",
    kind: "hearing",
    caseRef: "Caso 2024.0090",
    client: "Sebastião Oliveira Lima",
    whenLabel: "quarta-feira, 14h00",
    placeLabel: "Audiência por videoconferência",
  },
  {
    id: "ag-4",
    kind: "examination",
    caseRef: "Caso 2024.0051",
    client: "Antônia Pereira dos Santos",
    whenLabel: "quinta-feira, 11h15",
    placeLabel: "Perícia social, agência do INSS",
  },
  {
    id: "ag-5",
    kind: "hearing",
    caseRef: "Caso 2022.0418",
    client: "Raimundo Nonato Souza",
    whenLabel: "sexta-feira, 9h30",
    placeLabel: "1ª Vara do Juizado Especial Federal",
  },
];

export type TaskEntry = {
  id: string;
  title: string;
  caseRef: string;
  priority: "high" | "medium" | "low";
  dueLabel: string;
  status: "todo" | "doing" | "review";
};

export const myTasks: TaskEntry[] = [
  {
    id: "task-1",
    title: "Revisar minuta de recurso administrativo",
    caseRef: "Caso 2024.0187",
    priority: "high",
    dueLabel: "hoje",
    status: "review",
  },
  {
    id: "task-2",
    title: "Conferir extração do laudo médico",
    caseRef: "Caso 2024.0051",
    priority: "high",
    dueLabel: "amanhã",
    status: "doing",
  },
  {
    id: "task-3",
    title: "Preparar cliente para audiência",
    caseRef: "Caso 2023.0342",
    priority: "medium",
    dueLabel: "em 2 dias",
    status: "todo",
  },
  {
    id: "task-4",
    title: "Juntar procuração atualizada",
    caseRef: "Caso 2022.0418",
    priority: "low",
    dueLabel: "em 4 dias",
    status: "todo",
  },
];

export const financialResult = {
  receivedMonthLabel: "R$ 18.450,00",
  forecastLabel: "R$ 32.900,00",
  successCasesMonth: 4,
  monthLabel: "agosto",
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

export const personaClients: ClientRecord[] = [
  {
    id: "maria-aparecida-da-silva",
    fullName: "Maria Aparecida da Silva",
    avatarSrc: "/avatars/harriet-rojas.jpeg",
    cpf: "312.481.234-70",
    nit: "1234567890-1",
    birthDateLabel: "14 de março de 1962",
    maritalStatus: "Casada",
    address: "Rua das Palmeiras, 218, Vila Esperança",
    cityState: "São Paulo, SP",
    phone: "(11) 98765-4321",
    email: "maria.aparecida@exemplo.com.br",
    rg: "18.442.371-5 SSP/SP",
    motherName: "Aparecida Rosa da Silva",
    bankInfoLabel: "Caixa Econômica Federal, agência 0912, conta 00034.517-8",
    vulnerabilityLabel: "Prioridade legal, pessoa idosa",
    situationLabel: "Ativo",
    cases: [
      {
        caseRef: "Caso 2024.0187",
        benefit: "Aposentadoria por incapacidade permanente",
        phase: "administrative",
        phaseLabel: "Fase administrativa",
        openDeadlines: 2,
        benefitNumber: "NB 175.842.396-4",
        href: "/administrativo",
        destinationLabel: "Administrativo",
      },
      {
        caseRef: "Caso 2022.0311",
        benefit: "Auxílio-acidente",
        phase: "closed",
        phaseLabel: "Encerrado com êxito",
        openDeadlines: 0,
        benefitNumber: "NB 168.204.117-9",
        lawsuitNumber: "5001872-34.2022.4.03.6183",
        href: "/financeiro",
        destinationLabel: "Financeiro",
      },
    ],
    documents: [
      {
        id: "doc-ms-1",
        name: "Laudo médico, clínica ortopédica",
        status: "validated",
        confidenceLabel: "confiança 97%",
      },
      {
        id: "doc-ms-2",
        name: "Extrato CNIS",
        status: "validated",
        confidenceLabel: "confiança 99%",
      },
      {
        id: "doc-ms-3",
        name: "Carteira de trabalho, páginas 12 a 18",
        status: "pending",
        confidenceLabel: "confiança 74%, abaixo do limiar",
      },
    ],
  },
  {
    id: "jose-carlos-ferreira",
    fullName: "José Carlos Ferreira",
    avatarSrc: "/avatars/lyle-kauffman.jpeg",
    cpf: "245.903.118-04",
    nit: "2345678901-2",
    birthDateLabel: "2 de julho de 1958",
    maritalStatus: "Casado",
    address: "Avenida Brasil, 1450, apto 32, Centro",
    cityState: "Campinas, SP",
    phone: "(19) 99654-2210",
    email: "jose.ferreira@exemplo.com.br",
    rg: "22.815.904-8 SSP/SP",
    motherName: "Benedita Alves Ferreira",
    bankInfoLabel: "Banco do Brasil, agência 3044-2, conta 51.208-6",
    situationLabel: "Ativo",
    cases: [
      {
        caseRef: "Caso 2023.0342",
        benefit: "Auxílio por incapacidade temporária",
        phase: "judicial",
        phaseLabel: "Fase judicial",
        openDeadlines: 3,
        benefitNumber: "NB 172.556.902-1",
        lawsuitNumber: "5004231-88.2023.4.03.6100",
        href: "/judicial/2023-0342",
        destinationLabel: "Judicial",
      },
    ],
    documents: [
      {
        id: "doc-jf-1",
        name: "Atestado médico, cardiologia",
        status: "validated",
        confidenceLabel: "confiança 95%",
      },
      {
        id: "doc-jf-2",
        name: "Comunicação de decisão do INSS",
        status: "validated",
        confidenceLabel: "confiança 98%",
      },
    ],
  },
  {
    id: "antonia-pereira-dos-santos",
    fullName: "Antônia Pereira dos Santos",
    avatarSrc: "/avatars/adriana-sullivan.jpeg",
    cpf: "178.256.399-51",
    nit: "3456789012-3",
    birthDateLabel: "28 de novembro de 1957",
    maritalStatus: "Viúva",
    address: "Rua São Benedito, 77, Jardim Aurora",
    cityState: "Sorocaba, SP",
    phone: "(15) 99811-7788",
    email: "antonia.santos@exemplo.com.br",
    rg: "15.230.667-1 SSP/SP",
    motherName: "Raimunda Pereira de Souza",
    bankInfoLabel: "Caixa Econômica Federal, agência 1780, conta 00087.921-3",
    vulnerabilityLabel: "Prioridade legal, pessoa idosa",
    situationLabel: "Ativo",
    cases: [
      {
        caseRef: "Caso 2024.0051",
        benefit: "BPC/LOAS, idoso",
        phase: "requirement",
        phaseLabel: "Em exigência no INSS",
        openDeadlines: 1,
        benefitNumber: "NB 180.334.671-2",
        href: "/administrativo",
        destinationLabel: "Administrativo",
      },
    ],
    documents: [
      {
        id: "doc-as-1",
        name: "Comprovante de residência",
        status: "validated",
        confidenceLabel: "confiança 99%",
      },
      {
        id: "doc-as-2",
        name: "Laudo social",
        status: "pending",
        confidenceLabel: "confiança 68%, abaixo do limiar",
      },
    ],
  },
  {
    id: "sebastiao-oliveira-lima",
    fullName: "Sebastião Oliveira Lima",
    avatarSrc: "/avatars/nicolas-wang.jpeg",
    cpf: "089.331.245-96",
    nit: "4567890123-4",
    birthDateLabel: "19 de janeiro de 1969",
    maritalStatus: "Casado",
    address: "Estrada do Campo, km 4, Zona Rural",
    cityState: "Itapetininga, SP",
    phone: "(15) 99230-4455",
    email: "sebastiao.lima@exemplo.com.br",
    rg: "20.098.554-7 SSP/SP",
    motherName: "Josefa Oliveira Lima",
    bankInfoLabel: "Sicredi, agência 0713, conta 44.902-1",
    situationLabel: "Ativo",
    cases: [
      {
        caseRef: "Caso 2024.0090",
        benefit: "Aposentadoria por idade rural",
        phase: "judicial",
        phaseLabel: "Fase judicial",
        openDeadlines: 2,
        benefitNumber: "NB 177.910.483-6",
        lawsuitNumber: "5000917-52.2024.4.03.6139",
        href: "/judicial/2024-0090",
        destinationLabel: "Judicial",
      },
    ],
    documents: [
      {
        id: "doc-sl-1",
        name: "Declaração de sindicato rural",
        status: "validated",
        confidenceLabel: "confiança 92%",
      },
      {
        id: "doc-sl-2",
        name: "Notas de produtor rural, 2001 a 2015",
        status: "pending",
        confidenceLabel: "confiança 61%, abaixo do limiar",
      },
    ],
  },
  {
    id: "raimundo-nonato-souza",
    fullName: "Raimundo Nonato Souza",
    avatarSrc: "/avatars/orlando-diggs.jpeg",
    cpf: "402.117.583-22",
    nit: "5678901234-5",
    birthDateLabel: "6 de setembro de 1971",
    maritalStatus: "Solteiro",
    address: "Rua Piauí, 903, Vila Nova",
    cityState: "Osasco, SP",
    phone: "(11) 97542-8890",
    email: "raimundo.souza@exemplo.com.br",
    rg: "27.664.108-2 SSP/SP",
    motherName: "Francisca Nonato de Souza",
    bankInfoLabel: "Itaú, agência 5521, conta 33.407-9",
    situationLabel: "Ativo",
    cases: [
      {
        caseRef: "Caso 2022.0418",
        benefit: "Auxílio-acidente",
        phase: "appeal",
        phaseLabel: "Em recurso",
        openDeadlines: 1,
        benefitNumber: "NB 165.778.240-8",
        lawsuitNumber: "5006644-19.2022.4.03.6130",
        href: "/judicial/2022-0418",
        destinationLabel: "Judicial",
      },
    ],
    documents: [
      {
        id: "doc-rs-1",
        name: "Comunicação de acidente",
        status: "validated",
        confidenceLabel: "confiança 96%",
      },
      {
        id: "doc-rs-2",
        name: "Laudo pericial administrativo",
        status: "validated",
        confidenceLabel: "confiança 94%",
      },
    ],
  },
  {
    id: "terezinha-gomes-barbosa",
    fullName: "Terezinha Gomes Barbosa",
    avatarSrc: "/avatars/ava-wright.jpeg",
    cpf: "156.842.907-38",
    nit: "6789012345-6",
    birthDateLabel: "22 de maio de 1960",
    maritalStatus: "Divorciada",
    address: "Rua das Acácias, 45, Parque das Flores",
    cityState: "Jundiaí, SP",
    phone: "(11) 96677-1122",
    email: "terezinha.barbosa@exemplo.com.br",
    rg: "17.905.226-4 SSP/SP",
    motherName: "Carmelita Gomes Barbosa",
    bankInfoLabel: "Bradesco, agência 2280-6, conta 70.145-2",
    vulnerabilityLabel: "Prioridade legal, pessoa idosa",
    situationLabel: "Em análise",
    cases: [
      {
        caseRef: "Caso 2025.0012",
        benefit: "Aposentadoria por idade urbana",
        phase: "administrative",
        phaseLabel: "Fase administrativa",
        openDeadlines: 1,
        benefitNumber: "NB 182.450.019-3",
        href: "/administrativo",
        destinationLabel: "Administrativo",
      },
      {
        caseRef: "Caso 2025.0034",
        benefit: "Revisão de benefício",
        phase: "administrative",
        phaseLabel: "Fase administrativa",
        openDeadlines: 0,
        benefitNumber: "NB 151.209.664-7",
        href: "/administrativo",
        destinationLabel: "Administrativo",
      },
    ],
    documents: [
      {
        id: "doc-tb-1",
        name: "Extrato CNIS",
        status: "validated",
        confidenceLabel: "confiança 99%",
      },
      {
        id: "doc-tb-2",
        name: "Carta de concessão anterior",
        status: "pending",
        confidenceLabel: "confiança 72%, abaixo do limiar",
      },
    ],
  },
  {
    id: "francisco-das-chagas-ribeiro",
    fullName: "Francisco das Chagas Ribeiro",
    avatarSrc: "/avatars/jordan-burgess.jpeg",
    cpf: "233.664.781-15",
    nit: "7890123456-7",
    birthDateLabel: "11 de dezembro de 1975",
    maritalStatus: "Casado",
    address: "Travessa do Comércio, 12, Centro",
    cityState: "Santos, SP",
    phone: "(13) 99118-3344",
    email: "francisco.ribeiro@exemplo.com.br",
    rg: "30.152.489-0 SSP/SP",
    motherName: "Maria das Dores Chagas Ribeiro",
    bankInfoLabel: "Banco do Brasil, agência 1017-4, conta 28.664-0",
    situationLabel: "Documentação pendente",
    cases: [
      {
        caseRef: "Caso 2025.0047",
        benefit: "Aposentadoria especial",
        phase: "administrative",
        phaseLabel: "Instrução documental",
        openDeadlines: 0,
        href: "/atendimento",
        destinationLabel: "Atendimento",
      },
    ],
    documents: [
      {
        id: "doc-fr-1",
        name: "PPP, perfil profissiográfico previdenciário",
        status: "pending",
        confidenceLabel: "confiança 58%, abaixo do limiar",
      },
    ],
  },
  {
    id: "ivone-castro-almeida",
    fullName: "Ivone Castro Almeida",
    avatarSrc: "/avatars/lucy-bond.jpeg",
    cpf: "367.220.454-89",
    nit: "8901234567-8",
    birthDateLabel: "3 de abril de 1988",
    maritalStatus: "Casada",
    address: "Alameda dos Ipês, 330, Residencial Sul",
    cityState: "São José dos Campos, SP",
    phone: "(12) 98890-5566",
    email: "ivone.almeida@exemplo.com.br",
    rg: "33.870.215-6 SSP/SP",
    motherName: "Neusa Castro de Almeida",
    bankInfoLabel: "Nubank, agência 0001, conta 78412036-5",
    situationLabel: "Ativo",
    cases: [
      {
        caseRef: "Caso 2025.0021",
        benefit: "Salário-maternidade",
        phase: "judicial",
        phaseLabel: "Fase judicial",
        openDeadlines: 1,
        benefitNumber: "NB 183.017.552-0",
        lawsuitNumber: "5002308-71.2025.4.03.6103",
        href: "/judicial/2025-0021",
        destinationLabel: "Judicial",
      },
    ],
    documents: [
      {
        id: "doc-ia-1",
        name: "Certidão de nascimento",
        status: "validated",
        confidenceLabel: "confiança 99%",
      },
      {
        id: "doc-ia-2",
        name: "Contrato de trabalho rural",
        status: "validated",
        confidenceLabel: "confiança 91%",
      },
    ],
  },
];

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

export const intakeStats: IntakeStat[] = [
  {
    id: "queue",
    label: "Na fila de triagem",
    value: "5",
    sectionId: "fila-de-triagem",
    sectionLabel: "Fila de triagem",
  },
  {
    id: "awaiting-docs",
    label: "Aguardando documentação",
    value: "3",
    sectionId: "aguardando-documentacao",
    sectionLabel: "Casos aguardando documentação",
  },
  {
    id: "unanswered",
    label: "Contatos sem retorno",
    value: "2",
    sectionId: "contatos-sem-retorno",
    sectionLabel: "Contatos sem retorno",
  },
  {
    id: "confirmed-today",
    label: "Triagens confirmadas hoje",
    value: "9",
    sectionId: "fila-de-triagem",
    sectionLabel: "Fila de triagem",
  },
];

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

export const triageQueue: TriageItem[] = [
  {
    id: "tq-1",
    channel: "email",
    kind: "new-contact",
    senderName: "Marlene Souza Batista",
    receivedLabel: "há 12 minutos",
    excerpt:
      "Meu benefício foi negado pelo INSS e preciso de ajuda para recorrer. Tenho laudos recentes da coluna.",
    imSuggestionLabel: "Novo contato, possível aposentadoria por incapacidade",
    imConfidencePercent: 92,
    urgency: "high",
  },
  {
    id: "tq-2",
    channel: "message",
    kind: "document",
    senderName: "José Carlos Ferreira",
    senderCpf: "245.903.118-04",
    senderAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    receivedLabel: "há 40 minutos",
    excerpt:
      "Doutor, estou enviando a foto do atestado novo que o cardiologista me deu hoje.",
    imSuggestionLabel: "Cliente existente, documento enviado",
    imConfidencePercent: 97,
    urgency: "medium",
    linkedCaseRef: "Caso 2023.0342",
    linkedBenefitLabel: "Auxílio por incapacidade temporária",
    contactHistory: [
      {
        dateLabel: "05/08/2026",
        channelLabel: "mensagem",
        summary: "Cliente avisou que faria nova consulta com o cardiologista.",
        responsible: "Mendelsson Sandrini Alves Maciel",
      },
      {
        dateLabel: "28/07/2026",
        channelLabel: "telefone",
        summary:
          "Orientado sobre a lista de documentos pendentes do requerimento.",
        responsible: "Mendelsson Sandrini Alves Maciel",
      },
    ],
  },
  {
    id: "tq-3",
    channel: "email",
    kind: "official",
    senderName: "INSS, comunicação oficial",
    receivedLabel: "há 1 hora",
    excerpt:
      "Comunicado de decisão referente ao requerimento NB 180.334.671-2, com exigência a cumprir.",
    imSuggestionLabel: "Comunicação oficial do INSS, exigência com prazo",
    imConfidencePercent: 99,
    urgency: "high",
    linkedCaseRef: "Caso 2024.0051",
    linkedBenefitLabel: "BPC/LOAS, idoso",
  },
  {
    id: "tq-4",
    channel: "phone",
    kind: "existing-client",
    senderName: "Terezinha Gomes Barbosa",
    senderCpf: "156.842.907-38",
    senderAvatarSrc: "/avatars/ava-wright.jpeg",
    receivedLabel: "há 2 horas",
    excerpt:
      "Registro de ligação: cliente pergunta sobre o andamento da revisão do benefício.",
    imSuggestionLabel: "Cliente existente, dúvida de andamento",
    imConfidencePercent: 88,
    urgency: "low",
    linkedCaseRef: "Caso 2025.0034",
    linkedBenefitLabel: "Revisão de benefício",
    contactHistory: [
      {
        dateLabel: "30/07/2026",
        channelLabel: "e-mail",
        summary: "Enviada a relação de documentos que faltam para a revisão.",
        responsible: "Mendelsson Sandrini Alves Maciel",
      },
      {
        dateLabel: "18/07/2026",
        channelLabel: "telefone",
        summary: "Cliente informada sobre a abertura do caso de revisão.",
        responsible: "Mendelsson Sandrini Alves Maciel",
      },
    ],
  },
  {
    id: "tq-5",
    channel: "email",
    kind: "new-contact",
    senderName: "Osvaldo Pinto Guimarães",
    receivedLabel: "há 3 horas",
    excerpt:
      "Trabalhei 28 anos em lavoura de cana e queria saber se tenho direito à aposentadoria rural.",
    imSuggestionLabel: "Novo contato, possível aposentadoria rural",
    imConfidencePercent: 85,
    urgency: "medium",
  },
];

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

export const awaitingDocsCases: AwaitingDocsCase[] = [
  {
    id: "ad-1",
    client: "Francisco das Chagas Ribeiro",
    clientAvatarSrc: "/avatars/jordan-burgess.jpeg",
    benefit: "Aposentadoria especial",
    caseRef: "Caso 2025.0047",
    receivedCount: 2,
    totalRequired: 5,
    missingDocuments: [
      "PPP atualizado",
      "LTCAT da última empresa",
      "CTPS, páginas de contrato",
    ],
  },
  {
    id: "ad-2",
    client: "Sebastião Oliveira Lima",
    clientAvatarSrc: "/avatars/nicolas-wang.jpeg",
    benefit: "Aposentadoria por idade rural",
    caseRef: "Caso 2024.0090",
    receivedCount: 3,
    totalRequired: 4,
    missingDocuments: ["Notas de produtor rural, 2001 a 2015"],
  },
  {
    id: "ad-3",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    benefit: "Revisão de benefício",
    caseRef: "Caso 2025.0034",
    receivedCount: 4,
    totalRequired: 5,
    missingDocuments: ["Carta de concessão anterior"],
  },
];

export type UnansweredContact = {
  id: string;
  name: string;
  avatarSrc?: string;
  channelLabel: string;
  waitingLabel: string;
};

export const unansweredContacts: UnansweredContact[] = [
  {
    id: "uc-1",
    name: "Ivone Castro Almeida",
    avatarSrc: "/avatars/lucy-bond.jpeg",
    channelLabel: "mensagem",
    waitingLabel: "aguardando retorno há 1 dia",
  },
  {
    id: "uc-2",
    name: "Osvaldo Pinto Guimarães",
    channelLabel: "e-mail",
    waitingLabel: "aguardando retorno há 3 horas",
  },
];

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

export const communicationLog: CommunicationLogEntry[] = [
  {
    id: "cm-1",
    clientName: "José Carlos Ferreira",
    clientAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    caseRef: "Caso 2023.0342",
    channelLabel: "Mensagem",
    dateLabel: "hoje, 09h12",
    summary:
      "Recebido o novo atestado cardiológico; confirmado o recebimento ao cliente e documento encaminhado para conferência.",
    responsible: "Mendelsson Sandrini Alves Maciel",
  },
  {
    id: "cm-2",
    clientName: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    caseRef: "Caso 2025.0034",
    channelLabel: "Telefone",
    dateLabel: "hoje, 08h47",
    summary:
      "Ligação registrada: cliente informada de que a revisão aguarda a carta de concessão anterior.",
    responsible: "Mendelsson Sandrini Alves Maciel",
  },
  {
    id: "cm-3",
    clientName: "Francisco das Chagas Ribeiro",
    clientAvatarSrc: "/avatars/jordan-burgess.jpeg",
    caseRef: "Caso 2025.0047",
    channelLabel: "E-mail",
    dateLabel: "ontem, 17h30",
    summary:
      "Enviada a relação dos três documentos pendentes da aposentadoria especial, com orientação de obtenção.",
    responsible: "Mendelsson Sandrini Alves Maciel",
  },
  {
    id: "cm-4",
    clientName: "Marlene Souza Batista",
    channelLabel: "E-mail",
    dateLabel: "ontem, 16h05",
    summary:
      "Primeiro retorno ao novo contato: solicitados os laudos da coluna e o extrato CNIS para a análise inicial.",
    responsible: "Mendelsson Sandrini Alves Maciel",
  },
];

export type AdministrativeStat = {
  id: string;
  label: string;
  value: string;
  /* Section of this same screen that holds the records behind the indicator. */
  sectionId: string;
  sectionLabel: string;
};

export const administrativeStats: AdministrativeStat[] = [
  {
    id: "requirements",
    label: "Requerimentos em andamento",
    value: "4",
    sectionId: "requerimentos-ao-inss",
    sectionLabel: "Requerimentos ao INSS",
  },
  {
    id: "exigencies",
    label: "Exigências em aberto",
    value: "3",
    sectionId: "exigencias-em-aberto",
    sectionLabel: "Exigências em aberto",
  },
  {
    id: "examinations",
    label: "Perícias administrativas agendadas",
    value: "2",
    sectionId: "pericias-administrativas",
    sectionLabel: "Perícias administrativas",
  },
  {
    id: "tracked",
    label: "Casos acompanhados na fase judicial",
    value: "4",
    sectionId: "acompanhamento-fase-judicial",
    sectionLabel: "Acompanhamento da fase judicial",
  },
];

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

export const administrativeRequirements: AdministrativeRequirement[] = [
  {
    id: "req-1",
    caseRef: "Caso 2024.0187",
    client: "Maria Aparecida da Silva",
    clientAvatarSrc: "/avatars/harriet-rojas.jpeg",
    benefit: "Aposentadoria por incapacidade permanente",
    benefitNumber: "NB 175.842.396-4",
    entryDateLabel: "entrada em 12/03/2024",
    protocolLabel: "protocolo 2403.221.480",
    statusLabel: "Em análise, com exigência",
  },
  {
    id: "req-2",
    caseRef: "Caso 2024.0051",
    client: "Antônia Pereira dos Santos",
    clientAvatarSrc: "/avatars/adriana-sullivan.jpeg",
    benefit: "BPC/LOAS, idoso",
    benefitNumber: "NB 180.334.671-2",
    entryDateLabel: "entrada em 29/01/2024",
    protocolLabel: "protocolo 2401.088.157",
    statusLabel: "Em exigência",
  },
  {
    id: "req-3",
    caseRef: "Caso 2025.0012",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    benefit: "Aposentadoria por idade urbana",
    benefitNumber: "NB 182.450.019-3",
    entryDateLabel: "entrada em 15/01/2025",
    protocolLabel: "protocolo 2501.034.902",
    statusLabel: "Em análise, com exigência",
  },
  {
    id: "req-4",
    caseRef: "Caso 2025.0034",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    benefit: "Revisão de benefício",
    benefitNumber: "NB 151.209.664-7",
    entryDateLabel: "entrada em 20/02/2025",
    protocolLabel: "protocolo 2502.119.263",
    statusLabel: "Em recurso ao CRPS",
  },
];

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
export const administrativeExigencies: AdministrativeExigency[] = [
  {
    id: "ex-1",
    caseRef: "Caso 2024.0187",
    client: "Maria Aparecida da Silva",
    clientAvatarSrc: "/avatars/harriet-rojas.jpeg",
    description: "Complementar cópia da carteira de trabalho, páginas 12 a 18",
    dueLabel: "vence em 2 dias úteis",
    status: "calculated",
  },
  {
    id: "ex-2",
    caseRef: "Caso 2024.0051",
    client: "Antônia Pereira dos Santos",
    clientAvatarSrc: "/avatars/adriana-sullivan.jpeg",
    description: "Apresentar laudo social para a avaliação do requisito",
    dueLabel: "vence em 5 dias úteis",
    status: "calculated",
  },
  {
    id: "ex-3",
    caseRef: "Caso 2025.0012",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    description: "Comprovar vínculos urbanos do período de 1995 a 2003",
    dueLabel: "vence em 12 dias úteis",
    status: "confirmed",
  },
];

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
export const administrativeExaminations: AdministrativeExamination[] = [
  {
    id: "pex-1",
    caseRef: "Caso 2024.0187",
    client: "Maria Aparecida da Silva",
    clientAvatarSrc: "/avatars/harriet-rojas.jpeg",
    kindLabel: "Perícia médica administrativa",
    whenLabel: "terça-feira, 9h00",
    placeLabel: "Agência do INSS",
    preparationLabel:
      "Cliente orientada sobre documentos e horário, comparecimento confirmado",
  },
  {
    id: "pex-2",
    caseRef: "Caso 2024.0051",
    client: "Antônia Pereira dos Santos",
    clientAvatarSrc: "/avatars/adriana-sullivan.jpeg",
    kindLabel: "Perícia social",
    whenLabel: "quinta-feira, 11h15",
    placeLabel: "Agência do INSS",
    preparationLabel:
      "Orientação de comparecimento preparada, aguardando aprovação humana para envio",
  },
];

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
export const administrativeDecisions: AdministrativeDecision[] = [
  {
    id: "dec-1",
    caseRef: "Caso 2023.0342",
    client: "José Carlos Ferreira",
    clientAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    benefit: "Auxílio por incapacidade temporária",
    outcomeLabel: "Indeferimento",
    groundsLabel:
      "Fundamento registrado: não reconhecimento da incapacidade na perícia médica federal.",
    pathLabel: "Encaminhamento registrado: ajuizamento da ação",
    gateLabel:
      "Portão atendido com a prova do requerimento prévio e da decisão anexada",
  },
  {
    id: "dec-2",
    caseRef: "Caso 2025.0034",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    benefit: "Revisão de benefício",
    outcomeLabel: "Indeferimento",
    groundsLabel:
      "Fundamento registrado: erro de cálculo apontado não reconhecido na primeira análise.",
    pathLabel:
      "Encaminhamento registrado: recurso ordinário ao Conselho de Recursos da Previdência Social",
    gateLabel:
      "Caso permanece na fase administrativa durante o julgamento do recurso",
  },
];

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
export const crpsAppeals: CrpsAppeal[] = [
  {
    id: "crps-1",
    caseRef: "Caso 2025.0034",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    benefit: "Revisão de benefício",
    filedLabel: "recurso protocolado em 28/07/2026",
    statusLabel: "Aguardando julgamento da Junta de Recursos",
  },
];

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

export const judicialTrackedCases: JudicialTrackedCase[] = [
  {
    id: "jt-1",
    caseRef: "Caso 2023.0342",
    client: "José Carlos Ferreira",
    clientAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    benefit: "Auxílio por incapacidade temporária",
    lawsuitNumber: "5004231-88.2023.4.03.6100",
    phaseLabel: "Fase judicial",
    openDeadlines: 3,
    href: "/judicial/2023-0342",
  },
  {
    id: "jt-2",
    caseRef: "Caso 2024.0090",
    client: "Sebastião Oliveira Lima",
    clientAvatarSrc: "/avatars/nicolas-wang.jpeg",
    benefit: "Aposentadoria por idade rural",
    lawsuitNumber: "5000917-52.2024.4.03.6139",
    phaseLabel: "Fase judicial",
    openDeadlines: 2,
    href: "/judicial/2024-0090",
  },
  {
    id: "jt-3",
    caseRef: "Caso 2025.0021",
    client: "Ivone Castro Almeida",
    clientAvatarSrc: "/avatars/lucy-bond.jpeg",
    benefit: "Salário-maternidade",
    lawsuitNumber: "5002308-71.2025.4.03.6103",
    phaseLabel: "Fase judicial",
    openDeadlines: 1,
    href: "/judicial/2025-0021",
  },
  {
    id: "jt-4",
    caseRef: "Caso 2022.0418",
    client: "Raimundo Nonato Souza",
    clientAvatarSrc: "/avatars/orlando-diggs.jpeg",
    benefit: "Auxílio-acidente",
    lawsuitNumber: "5006644-19.2022.4.03.6130",
    phaseLabel: "Em recurso",
    openDeadlines: 1,
    href: "/judicial/2022-0418",
  },
];

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
export const judicialStats: JudicialStat[] = [
  {
    id: "active",
    label: "Processos ativos",
    value: "4",
    href: "#processos-por-subcategoria",
    destinationLabel: "Processos por subcategoria",
  },
  {
    id: "deadlines",
    label: "Prazos abertos",
    value: "7",
    href: "/agenda",
    destinationLabel: "Agenda",
  },
  {
    id: "hearings",
    label: "Audiências da semana",
    value: "3",
    href: "/agenda",
    destinationLabel: "Agenda",
  },
  {
    id: "summonses",
    label: "Intimações capturadas hoje",
    value: "2",
    href: "#processos-por-subcategoria",
    destinationLabel: "Processos por subcategoria",
  },
];

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

export const judicialLawsuits: JudicialLawsuit[] = [
  {
    id: "2023-0342",
    caseRef: "Caso 2023.0342",
    client: "José Carlos Ferreira",
    clientAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    benefit: "Auxílio por incapacidade temporária",
    subcategory: "concession",
    lawsuitNumber: "5004231-88.2023.4.03.6100",
    courtLabel: "2ª Vara Federal de São Paulo",
    classLabel: "Procedimento Comum Cível",
    distributionDateLabel: "distribuído em 15/09/2023",
    phaseLabel: "Fase judicial",
    openDeadlines: 3,
    movements: [
      {
        id: "mv-jc-1",
        dateLabel: "07/08/2026",
        description: "Contestação do INSS juntada aos autos.",
        sourceLabel: "DataJud, capturado em 08/08/2026",
      },
      {
        id: "mv-jc-2",
        dateLabel: "22/07/2026",
        description: "Despacho designando audiência de instrução.",
        sourceLabel: "DataJud, capturado em 23/07/2026",
      },
    ],
    summonses: [
      {
        id: "in-jc-1",
        dateLabel: "publicada em 06/08/2026, capturada hoje",
        summary:
          "Intimação para réplica à contestação, texto integral preservado.",
        generatedDeadlineLabel:
          "Gerou o prazo de réplica, calculado e depois confirmado pelo advogado",
      },
    ],
    deadlines: [
      {
        id: "dl-jc-1",
        title: "Réplica à contestação",
        dueLabel: "vence em 3 dias úteis",
        status: "confirmed",
      },
      {
        id: "dl-jc-2",
        title: "Juntada de documentos médicos complementares",
        dueLabel: "vence em 8 dias úteis",
        status: "calculated",
      },
      {
        id: "dl-jc-3",
        title: "Preparação do cliente para a audiência",
        dueLabel: "vence em 6 dias úteis",
        status: "calculated",
      },
    ],
    hearings: [
      {
        id: "he-jc-1",
        kindLabel: "Audiência de instrução",
        whenLabel: "segunda-feira, 10h30",
        placeLabel: "2ª Vara Federal de São Paulo, sala 4",
      },
    ],
    filings: [
      {
        id: "fi-jc-1",
        title: "Petição inicial",
        statusLabel: "Protocolada em 15/09/2023, registro anexado ao caso",
      },
      {
        id: "fi-jc-2",
        title: "Réplica à contestação",
        statusLabel: "Em preparação, conferência do advogado pendente",
      },
    ],
  },
  {
    id: "2024-0090",
    caseRef: "Caso 2024.0090",
    client: "Sebastião Oliveira Lima",
    clientAvatarSrc: "/avatars/nicolas-wang.jpeg",
    benefit: "Aposentadoria por idade rural",
    subcategory: "concession",
    lawsuitNumber: "5000917-52.2024.4.03.6139",
    courtLabel: "Vara do Juizado Especial Federal de Itapetininga",
    classLabel: "Procedimento do Juizado Especial Cível",
    distributionDateLabel: "distribuído em 08/04/2024",
    phaseLabel: "Fase judicial",
    openDeadlines: 2,
    movements: [
      {
        id: "mv-sl-1",
        dateLabel: "05/08/2026",
        description: "Audiência de conciliação e instrução designada.",
        sourceLabel: "DataJud, capturado em 06/08/2026",
      },
    ],
    summonses: [
      {
        id: "in-sl-1",
        dateLabel: "publicada em 07/08/2026, capturada hoje",
        summary: "Intimação da contestação do INSS, texto integral preservado.",
        generatedDeadlineLabel:
          "Gerou o prazo de manifestação, no estado calculado até a confirmação",
      },
    ],
    deadlines: [
      {
        id: "dl-sl-1",
        title: "Manifestação sobre a contestação do INSS",
        dueLabel: "vence em 4 dias úteis",
        status: "calculated",
      },
      {
        id: "dl-sl-2",
        title: "Apresentação do rol de testemunhas",
        dueLabel: "vence em 9 dias úteis",
        status: "calculated",
      },
    ],
    hearings: [
      {
        id: "he-sl-1",
        kindLabel: "Audiência de conciliação e instrução",
        whenLabel: "quarta-feira, 14h00",
        placeLabel: "Audiência por videoconferência",
      },
    ],
    filings: [
      {
        id: "fi-sl-1",
        title: "Petição inicial",
        statusLabel: "Protocolada em 08/04/2024, registro anexado ao caso",
      },
    ],
  },
  {
    id: "2025-0021",
    caseRef: "Caso 2025.0021",
    client: "Ivone Castro Almeida",
    clientAvatarSrc: "/avatars/lucy-bond.jpeg",
    benefit: "Salário-maternidade",
    subcategory: "concession",
    lawsuitNumber: "5002308-71.2025.4.03.6103",
    courtLabel: "Vara do Juizado Especial Federal de São José dos Campos",
    classLabel: "Procedimento do Juizado Especial Cível",
    distributionDateLabel: "distribuído em 19/03/2025",
    phaseLabel: "Fase judicial",
    openDeadlines: 1,
    movements: [
      {
        id: "mv-ia-1",
        dateLabel: "30/07/2026",
        description: "Proposta de acordo apresentada pelo INSS.",
        sourceLabel: "DataJud, capturado em 31/07/2026",
      },
    ],
    summonses: [],
    deadlines: [
      {
        id: "dl-ia-1",
        title: "Manifestação sobre a proposta de acordo",
        dueLabel: "vence em 5 dias úteis",
        status: "calculated",
      },
    ],
    hearings: [],
    filings: [
      {
        id: "fi-ia-1",
        title: "Petição inicial",
        statusLabel: "Protocolada em 19/03/2025, registro anexado ao caso",
      },
    ],
  },
  {
    id: "2022-0418",
    caseRef: "Caso 2022.0418",
    client: "Raimundo Nonato Souza",
    clientAvatarSrc: "/avatars/orlando-diggs.jpeg",
    benefit: "Auxílio-acidente",
    subcategory: "accident",
    lawsuitNumber: "5006644-19.2022.4.03.6130",
    courtLabel: "Turma Recursal dos Juizados Especiais Federais",
    classLabel: "Recurso Inominado Cível",
    distributionDateLabel: "distribuído em 21/06/2022",
    phaseLabel: "Em recurso",
    openDeadlines: 1,
    movements: [
      {
        id: "mv-rn-1",
        dateLabel: "01/08/2026",
        description: "Recurso inominado do INSS recebido e distribuído.",
        sourceLabel: "DataJud, capturado em 02/08/2026",
      },
    ],
    summonses: [],
    deadlines: [
      {
        id: "dl-rn-1",
        title: "Contrarrazões ao recurso do INSS",
        dueLabel: "vence em 10 dias úteis",
        status: "calculated",
      },
    ],
    hearings: [
      {
        id: "he-rn-1",
        kindLabel: "Sessão de julgamento",
        whenLabel: "sexta-feira, 9h30",
        placeLabel: "1ª Vara do Juizado Especial Federal",
      },
    ],
    filings: [
      {
        id: "fi-rn-1",
        title: "Contrarrazões ao recurso",
        statusLabel: "Em preparação, conferência do advogado pendente",
      },
    ],
  },
];

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
export const agendaStats: AgendaStat[] = [
  {
    id: "events",
    label: "Compromissos da semana",
    value: "5",
    sectionId: "agenda-unificada",
    sectionLabel: "Agenda unificada",
  },
  {
    id: "deadlines",
    label: "Prazos abertos",
    value: "10",
    sectionId: "agenda-unificada",
    sectionLabel: "Agenda unificada",
  },
  {
    id: "critical",
    label: "Alertas críticos",
    value: "2",
    sectionId: "agenda-unificada",
    sectionLabel: "Agenda unificada",
  },
  {
    id: "escalated",
    label: "Escalonados à coordenação",
    value: "1",
    sectionId: "agenda-unificada",
    sectionLabel: "Agenda unificada",
  },
];

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
export const unifiedAgendaItems: UnifiedAgendaItem[] = [
  {
    id: "ua-ag-1",
    kind: "hearing",
    title: "Audiência de instrução",
    client: "José Carlos Ferreira",
    clientAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    caseRef: "Caso 2023.0342",
    whenLabel: "segunda-feira, 10h30, 2ª Vara Federal de São Paulo, sala 4",
    dayId: "mon",
    preparationLabel:
      "Tarefa de preparação do cliente aberta; orientação de comparecimento aguardando revisão do advogado antes do envio",
    href: "/judicial/2023-0342",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-ag-2",
    kind: "examination",
    title: "Perícia médica administrativa",
    client: "Maria Aparecida da Silva",
    clientAvatarSrc: "/avatars/harriet-rojas.jpeg",
    caseRef: "Caso 2024.0187",
    whenLabel: "terça-feira, 9h00, agência do INSS",
    dayId: "tue",
    preparationLabel:
      "Cliente orientada sobre documentos e horário, comparecimento confirmado",
    href: "/administrativo",
    destinationLabel: "Administrativo",
  },
  {
    id: "ua-ag-3",
    kind: "hearing",
    title: "Audiência de conciliação e instrução",
    client: "Sebastião Oliveira Lima",
    clientAvatarSrc: "/avatars/nicolas-wang.jpeg",
    caseRef: "Caso 2024.0090",
    whenLabel: "quarta-feira, 14h00, por videoconferência",
    dayId: "wed",
    preparationLabel:
      "Tarefa de preparação aberta; orientação de acesso à videoconferência aguardando revisão antes do envio",
    href: "/judicial/2024-0090",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-ag-4",
    kind: "examination",
    title: "Perícia social",
    client: "Antônia Pereira dos Santos",
    clientAvatarSrc: "/avatars/adriana-sullivan.jpeg",
    caseRef: "Caso 2024.0051",
    whenLabel: "quinta-feira, 11h15, agência do INSS",
    dayId: "thu",
    preparationLabel:
      "Orientação de comparecimento preparada, aguardando aprovação humana para envio",
    href: "/administrativo",
    destinationLabel: "Administrativo",
  },
  {
    id: "ua-ag-5",
    kind: "hearing",
    title: "Sessão de julgamento",
    client: "Raimundo Nonato Souza",
    clientAvatarSrc: "/avatars/orlando-diggs.jpeg",
    caseRef: "Caso 2022.0418",
    whenLabel: "sexta-feira, 9h30, 1ª Vara do Juizado Especial Federal",
    dayId: "fri",
    preparationLabel:
      "Tarefa de preparação das contrarrazões aberta, conferência do advogado pendente",
    href: "/judicial/2022-0418",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-ex-1",
    kind: "deadline",
    title: "Complementar cópia da carteira de trabalho, páginas 12 a 18",
    client: "Maria Aparecida da Silva",
    clientAvatarSrc: "/avatars/harriet-rojas.jpeg",
    caseRef: "Caso 2024.0187",
    whenLabel: "prazo administrativo, vence em 2 dias úteis",
    status: "calculated",
    dueThisWeek: true,
    critical: true,
    escalated: true,
    href: "/administrativo",
    destinationLabel: "Administrativo",
  },
  {
    id: "ua-dl-jc-1",
    kind: "deadline",
    title: "Réplica à contestação",
    client: "José Carlos Ferreira",
    clientAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    caseRef: "Caso 2023.0342",
    whenLabel: "prazo processual, vence em 3 dias úteis",
    status: "confirmed",
    dueThisWeek: true,
    critical: true,
    href: "/judicial/2023-0342",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-dl-sl-1",
    kind: "deadline",
    title: "Manifestação sobre a contestação do INSS",
    client: "Sebastião Oliveira Lima",
    clientAvatarSrc: "/avatars/nicolas-wang.jpeg",
    caseRef: "Caso 2024.0090",
    whenLabel: "prazo processual, vence em 4 dias úteis",
    status: "calculated",
    dueThisWeek: true,
    href: "/judicial/2024-0090",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-ex-2",
    kind: "deadline",
    title: "Apresentar laudo social para a avaliação do requisito",
    client: "Antônia Pereira dos Santos",
    clientAvatarSrc: "/avatars/adriana-sullivan.jpeg",
    caseRef: "Caso 2024.0051",
    whenLabel: "prazo administrativo, vence em 5 dias úteis",
    status: "calculated",
    dueThisWeek: true,
    href: "/administrativo",
    destinationLabel: "Administrativo",
  },
  {
    id: "ua-dl-ia-1",
    kind: "deadline",
    title: "Manifestação sobre a proposta de acordo",
    client: "Ivone Castro Almeida",
    clientAvatarSrc: "/avatars/lucy-bond.jpeg",
    caseRef: "Caso 2025.0021",
    whenLabel: "prazo processual, vence em 5 dias úteis",
    status: "calculated",
    dueThisWeek: true,
    href: "/judicial/2025-0021",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-dl-jc-3",
    kind: "deadline",
    title: "Preparação do cliente para a audiência",
    client: "José Carlos Ferreira",
    clientAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    caseRef: "Caso 2023.0342",
    whenLabel: "prazo processual, vence em 6 dias úteis",
    status: "calculated",
    href: "/judicial/2023-0342",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-dl-jc-2",
    kind: "deadline",
    title: "Juntada de documentos médicos complementares",
    client: "José Carlos Ferreira",
    clientAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    caseRef: "Caso 2023.0342",
    whenLabel: "prazo processual, vence em 8 dias úteis",
    status: "calculated",
    href: "/judicial/2023-0342",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-dl-sl-2",
    kind: "deadline",
    title: "Apresentação do rol de testemunhas",
    client: "Sebastião Oliveira Lima",
    clientAvatarSrc: "/avatars/nicolas-wang.jpeg",
    caseRef: "Caso 2024.0090",
    whenLabel: "prazo processual, vence em 9 dias úteis",
    status: "calculated",
    href: "/judicial/2024-0090",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-dl-rn-1",
    kind: "deadline",
    title: "Contrarrazões ao recurso do INSS",
    client: "Raimundo Nonato Souza",
    clientAvatarSrc: "/avatars/orlando-diggs.jpeg",
    caseRef: "Caso 2022.0418",
    whenLabel: "prazo processual, vence em 10 dias úteis",
    status: "calculated",
    href: "/judicial/2022-0418",
    destinationLabel: "Judicial",
  },
  {
    id: "ua-ex-3",
    kind: "deadline",
    title: "Comprovar vínculos urbanos do período de 1995 a 2003",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    caseRef: "Caso 2025.0012",
    whenLabel: "prazo administrativo, vence em 12 dias úteis",
    status: "confirmed",
    href: "/administrativo",
    destinationLabel: "Administrativo",
  },
];

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
export const financeStats: FinanceStat[] = [
  {
    id: "received",
    label: "Recebido em agosto",
    value: "R$ 18.450,00",
    href: "#historico-de-recebimentos",
    destinationLabel: "Histórico de recebimentos",
  },
  {
    id: "forecast",
    label: "Previsão de recebimento",
    value: "R$ 32.900,00",
    href: "#previsao-de-recebimento",
    destinationLabel: "Previsão de recebimento",
  },
  {
    id: "successes",
    label: "Casos com êxito em agosto",
    value: "4",
    href: "/clientes",
    destinationLabel: "Clientes",
  },
  {
    id: "hours",
    label: "Horas lançadas na semana",
    value: "9h30",
    href: "#registro-de-horas",
    destinationLabel: "Registro de horas",
  },
];

export type FeeContract = {
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

export const feeContracts: FeeContract[] = [
  {
    id: "fc-1",
    caseRef: "Caso 2022.0311",
    client: "Maria Aparecida da Silva",
    clientAvatarSrc: "/avatars/harriet-rojas.jpeg",
    benefit: "Auxílio-acidente, encerrado com êxito",
    contractLabel:
      "30% do proveito econômico, com sucumbência fixada na sentença",
    participationLabel: "Minha participação: 50%, definida por caso",
    href: "/clientes/maria-aparecida-da-silva",
    destinationLabel: "ficha de Maria Aparecida da Silva",
  },
  {
    id: "fc-2",
    caseRef: "Caso 2023.0342",
    client: "José Carlos Ferreira",
    clientAvatarSrc: "/avatars/lyle-kauffman.jpeg",
    benefit: "Auxílio por incapacidade temporária",
    contractLabel: "30% do proveito econômico, com sucumbência quando fixada",
    participationLabel: "Minha participação: 40%, regra padrão do escritório",
    href: "/judicial/2023-0342",
    destinationLabel: "Judicial",
  },
  {
    id: "fc-3",
    caseRef: "Caso 2024.0090",
    client: "Sebastião Oliveira Lima",
    clientAvatarSrc: "/avatars/nicolas-wang.jpeg",
    benefit: "Aposentadoria por idade rural",
    contractLabel: "30% do proveito econômico",
    participationLabel: "Minha participação: 40%, regra padrão do escritório",
    href: "/judicial/2024-0090",
    destinationLabel: "Judicial",
  },
  {
    id: "fc-4",
    caseRef: "Caso 2025.0021",
    client: "Ivone Castro Almeida",
    clientAvatarSrc: "/avatars/lucy-bond.jpeg",
    benefit: "Salário-maternidade",
    contractLabel: "25% do proveito econômico e parcela fixa contratual",
    participationLabel: "Minha participação: 40%, regra padrão do escritório",
    href: "/judicial/2025-0021",
    destinationLabel: "Judicial",
  },
  {
    id: "fc-5",
    caseRef: "Caso 2025.0012",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    benefit: "Aposentadoria por idade urbana",
    contractLabel: "30% do proveito econômico e parcela fixa contratual",
    participationLabel: "Minha participação: 40%, regra padrão do escritório",
    href: "/administrativo",
    destinationLabel: "Administrativo",
  },
];

export type HourEntry = {
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
export const hourEntries: HourEntry[] = [
  {
    id: "hr-1",
    caseRef: "Caso 2023.0342",
    client: "José Carlos Ferreira",
    dateLabel: "hoje",
    description: "Preparação do cliente e da instrução para a audiência",
    durationLabel: "4h00",
    href: "/judicial/2023-0342",
    destinationLabel: "Judicial",
  },
  {
    id: "hr-2",
    caseRef: "Caso 2025.0034",
    client: "Terezinha Gomes Barbosa",
    dateLabel: "ontem",
    description: "Elaboração do recurso ordinário ao CRPS",
    durationLabel: "3h00",
    href: "/administrativo",
    destinationLabel: "Administrativo",
  },
  {
    id: "hr-3",
    caseRef: "Caso 2022.0418",
    client: "Raimundo Nonato Souza",
    dateLabel: "anteontem",
    description: "Rascunho das contrarrazões ao recurso do INSS",
    durationLabel: "2h30",
    href: "/judicial/2022-0418",
    destinationLabel: "Judicial",
  },
];

export type ReceiptEntry = {
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
export const receiptEntries: ReceiptEntry[] = [
  {
    id: "rc-1",
    caseRef: "Caso 2022.0311",
    client: "Maria Aparecida da Silva",
    clientAvatarSrc: "/avatars/harriet-rojas.jpeg",
    dateLabel: "05/08/2026",
    description:
      "Participação apurada sobre a requisição de pequeno valor paga",
    amountLabel: "R$ 12.700,00",
    href: "/clientes/maria-aparecida-da-silva",
    destinationLabel: "ficha de Maria Aparecida da Silva",
  },
  {
    id: "rc-2",
    caseRef: "Caso 2025.0021",
    client: "Ivone Castro Almeida",
    clientAvatarSrc: "/avatars/lucy-bond.jpeg",
    dateLabel: "04/08/2026",
    description: "Participação sobre a parcela fixa contratual recebida",
    amountLabel: "R$ 3.250,00",
    href: "/judicial/2025-0021",
    destinationLabel: "Judicial",
  },
  {
    id: "rc-3",
    caseRef: "Caso 2025.0012",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    dateLabel: "01/08/2026",
    description: "Participação sobre a parcela fixa contratual recebida",
    amountLabel: "R$ 2.500,00",
    href: "/administrativo",
    destinationLabel: "Administrativo",
  },
];

export type ForecastEntry = {
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
export const forecastEntries: ForecastEntry[] = [
  {
    id: "fe-1",
    caseRef: "Caso 2022.0418",
    client: "Raimundo Nonato Souza",
    clientAvatarSrc: "/avatars/orlando-diggs.jpeg",
    description: "Participação estimada sobre a condenação em execução futura",
    conditionLabel:
      "Previsão condicionada à manutenção da sentença no julgamento do recurso",
    amountLabel: "R$ 15.600,00",
    href: "/judicial/2022-0418",
    destinationLabel: "Judicial",
  },
  {
    id: "fe-2",
    caseRef: "Caso 2025.0021",
    client: "Ivone Castro Almeida",
    clientAvatarSrc: "/avatars/lucy-bond.jpeg",
    description: "Participação estimada sobre a proposta de acordo do INSS",
    conditionLabel:
      "Previsão condicionada à aceitação do acordo e à homologação",
    amountLabel: "R$ 8.400,00",
    href: "/judicial/2025-0021",
    destinationLabel: "Judicial",
  },
  {
    id: "fe-3",
    caseRef: "Caso 2025.0012",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    description: "Participação sobre a parcela fixa contratual a vencer",
    conditionLabel: "Previsão pelo vencimento contratual do próximo mês",
    amountLabel: "R$ 8.900,00",
    href: "/administrativo",
    destinationLabel: "Administrativo",
  },
];

export type RequisitionEntry = {
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
export const requisitionEntries: RequisitionEntry[] = [
  {
    id: "rq-1",
    caseRef: "Caso 2022.0311",
    client: "Maria Aparecida da Silva",
    clientAvatarSrc: "/avatars/harriet-rojas.jpeg",
    kindLabel: "Requisição de pequeno valor",
    statusLabel:
      "Expedida em 10/06/2026, paga em 05/08/2026 e conciliada com o recebimento de agosto",
    href: "/clientes/maria-aparecida-da-silva",
    destinationLabel: "ficha de Maria Aparecida da Silva",
  },
];

export type BenefitSlice = {
  id: string;
  label: string;
  count: number;
};

/*
 * Portfolio of the lawyer by pleaded benefit, over the benefit list the director
 * fixed on 2026-08-11. Two invariants hold and the screen depends on both: the
 * sum equals activeCasesTotal, exactly as casesByPhase does, so the shares add
 * to one hundred per cent; and every benefit the office pleads appears here,
 * which is why some rows carry no detailed record among personaClients. The
 * card says on screen that this is the demonstration portfolio and that the
 * count of registered cases lives on the Casos screen.
 */
export const casesByBenefit: BenefitSlice[] = [
  {
    id: "permanent-incapacity",
    label: "Aposentadoria por incapacidade permanente",
    count: 6,
  },
  {
    id: "temporary-incapacity",
    label: "Auxílio por incapacidade temporária",
    count: 6,
  },
  { id: "rural-age", label: "Aposentadoria por idade rural", count: 5 },
  { id: "urban-age", label: "Aposentadoria por idade urbana", count: 5 },
  { id: "accident", label: "Auxílio-acidente", count: 4 },
  { id: "revision", label: "Revisão de benefício", count: 4 },
  { id: "welfare-elderly", label: "BPC/LOAS, idoso", count: 4 },
  { id: "maternity", label: "Salário-maternidade", count: 3 },
  {
    id: "contribution",
    label: "Aposentadoria por tempo de contribuição e regras de transição",
    count: 3,
  },
  { id: "special", label: "Aposentadoria especial", count: 2 },
  {
    id: "welfare-disability",
    label: "BPC/LOAS, pessoa com deficiência",
    count: 2,
  },
  { id: "death-pension", label: "Pensão por morte", count: 1 },
  { id: "prison-allowance", label: "Auxílio-reclusão", count: 1 },
  {
    id: "disability-age",
    label: "Aposentadoria da pessoa com deficiência por idade",
    count: 1,
  },
  {
    id: "disability-contribution",
    label: "Aposentadoria da pessoa com deficiência por tempo de contribuição",
    count: 1,
  },
];

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
export const grantRates: GrantRate[] = [
  {
    id: "administrative",
    label: "Deferimento administrativo",
    granted: 13,
    decided: 21,
    noteLabel: "Decisões do INSS nos meus casos, no ano corrente.",
  },
  {
    id: "judicial",
    label: "Procedência judicial",
    granted: 14,
    decided: 19,
    noteLabel: "Sentenças nos meus processos, no ano corrente.",
  },
];

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
export const riskAlerts: RiskAlert[] = [
  {
    id: "risk-decadence",
    href: "/administrativo",
    destinationLabel: "Administrativo",
    kindLabel: "Risco de decadência",
    caseRef: "Caso 2025.0034",
    client: "Terezinha Gomes Barbosa",
    clientAvatarSrc: "/avatars/ava-wright.jpeg",
    detailLabel:
      "Revisão de benefício com concessão em 2016; o prazo decadencial de dez anos da Lei 8.213 se aproxima.",
    sourceLabel:
      "Alerta assistido pela Inteligência Massiva (IM), pendente de confirmação do advogado.",
  },
  {
    id: "risk-prescription",
    href: "/judicial/2022-0418",
    destinationLabel: "Judicial",
    kindLabel: "Risco de prescrição",
    caseRef: "Caso 2022.0418",
    client: "Raimundo Nonato Souza",
    clientAvatarSrc: "/avatars/omar-mora.jpeg",
    detailLabel:
      "Parcelas anteriores a cinco anos da propositura podem estar prescritas na fase de execução.",
    sourceLabel:
      "Alerta assistido pela Inteligência Massiva (IM), pendente de confirmação do advogado.",
  },
  {
    id: "risk-untreated",
    href: "/administrativo",
    destinationLabel: "Administrativo",
    kindLabel: "Prazo crítico sem tratativa",
    caseRef: "Caso 2024.0187",
    client: "Maria Aparecida da Silva",
    clientAvatarSrc: "/avatars/harriet-rojas.jpeg",
    detailLabel:
      "Exigência administrativa vence em 2 dias úteis e ainda não registra tratativa; já escalonada à coordenação.",
    sourceLabel: "Escalonamento registrado na Agenda, com autor, data e hora.",
  },
];

export const overdueDeadlines = {
  count: 0,
  scopeLabel: "Nos meus 37 prazos em aberto.",
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
export const captureSources: CaptureSource[] = [
  {
    id: "djen",
    href: "/judicial",
    destinationLabel: "Judicial",
    label: "Diário de Justiça Eletrônico Nacional",
    statusLabel: "Em dia",
    lastRunLabel: "última execução hoje, 06h10",
    resultLabel:
      "14 publicações novas capturadas, com texto integral preservado",
    roleLabel: "Fonte oficial da intimação; é daqui que nasce o prazo.",
    healthy: true,
  },
  {
    id: "datajud",
    href: "/judicial",
    destinationLabel: "Judicial",
    label: "DataJud, base de metadados do CNJ",
    statusLabel: "Atraso de um dia",
    lastRunLabel: "última execução ontem, 22h40",
    resultLabel:
      "2 movimentações capturadas; cada tribunal envia em cadência própria",
    roleLabel: "Acompanhamento apenas; jamais é fonte de prazo.",
    healthy: false,
  },
];
