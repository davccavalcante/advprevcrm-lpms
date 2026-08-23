import { z } from "zod";
import { isValidProcessNumber } from "@/lib/capture/process-number";

/*
 * Domain of the case. A case is one claim of one client in one court branch, and
 * a single fact can open several of them at once: the employee who fell at work
 * opens a labour claim against the employer, an accident claim against the INSS
 * in the state branch, and possibly an administrative request before the INSS.
 * They never merge, not in the interface and not on disk.
 *
 * Every legal reference below carries its source. No monetary limit, no fee
 * percentage and no deadline table is written here, because those change over
 * time and belong to a catalogue with source and date, owned by Administration.
 */

export const caseSpheres = [
  {
    id: "labor",
    label: "Trabalhista",
    courtLabel: "Justiça do Trabalho",
    opposingPartyLabel: "Empregador",
    opposingPartyPrefill: "Empregador",
    scopeLabel:
      "O cliente, na condição de empregado, contra o empregador, inclusive a indenização por dano decorrente de acidente de trabalho.",
    groundLabel:
      "Competência firmada na Súmula Vinculante 22 do Supremo Tribunal Federal.",
    deadlineRegimeLabel:
      "Prazo em dias úteis, artigo 775 da CLT, na redação da Lei 13.467 de 2017.",
  },
  {
    id: "state-accident",
    label: "Estadual acidentário",
    courtLabel: "Justiça Estadual",
    opposingPartyLabel: "INSS",
    opposingPartyPrefill: "INSS",
    scopeLabel:
      "O cliente contra o INSS em matéria acidentária, quando o benefício decorre de acidente de trabalho ou de doença ocupacional.",
    groundLabel:
      "Competência consolidada na Súmula 15 do Superior Tribunal de Justiça.",
    deadlineRegimeLabel:
      "Prazo em dias úteis, artigo 219 do Código de Processo Civil, excluído o dia do começo e incluído o do vencimento na forma do artigo 224.",
  },
  {
    id: "state-civil",
    label: "Estadual cível",
    courtLabel: "Justiça Estadual",
    /*
     * The counterpart varies with the claim and, in voluntary jurisdiction,
     * there may be none, so this sphere prefills nothing and says why.
     */
    opposingPartyLabel:
      "varia conforme o pedido, a instituição financeira nas ações bancárias, e nos procedimentos de jurisdição voluntária pode não haver parte contrária",
    opposingPartyPrefill: "",
    scopeLabel:
      "O cliente em matéria cível de competência da Justiça Estadual, como alvará judicial para levantamento de valores, curatela e ações contra instituição financeira.",
    groundLabel:
      "Competência residual da Justiça Estadual, pois o que não cabe à Justiça Federal pelo artigo 109 da Constituição Federal permanece nela, com a organização do artigo 125. O alvará judicial e a curatela correm em jurisdição voluntária, artigos 719 e seguintes do Código de Processo Civil, a curatela nos artigos 747 a 758 com os limites do Estatuto da Pessoa com Deficiência, Lei 13.146 de 2015, e o levantamento de valores deixados por falecido segue a Lei 6.858 de 1980. A ação contra instituição financeira é relação de consumo pela Súmula 297 do Superior Tribunal de Justiça.",
    deadlineRegimeLabel:
      "Prazo em dias úteis, artigo 219 do Código de Processo Civil, excluído o dia do começo e incluído o do vencimento na forma do artigo 224.",
  },
  {
    id: "federal-social-security",
    label: "Federal previdenciário",
    courtLabel: "Justiça Federal",
    opposingPartyLabel: "INSS",
    opposingPartyPrefill: "INSS",
    scopeLabel:
      "O cliente contra o INSS em matéria previdenciária comum, no Juizado Especial Federal até o limite legal de alçada e na Justiça Federal comum acima dele.",
    groundLabel:
      "Abertura da fase judicial exige prévio requerimento administrativo e a respectiva decisão, ou dispensa justificada, conforme o Recurso Extraordinário 631.240 do Supremo Tribunal Federal.",
    deadlineRegimeLabel:
      "Prazo em dias úteis, artigo 219 do Código de Processo Civil, excluído o dia do começo e incluído o do vencimento na forma do artigo 224.",
  },
] as const;

export type CaseSphereId = (typeof caseSpheres)[number]["id"];

export const caseSphereIds = caseSpheres.map((sphere) => sphere.id) as [
  CaseSphereId,
  ...CaseSphereId[],
];

export function sphereOf(id: CaseSphereId): (typeof caseSpheres)[number] {
  const found = caseSpheres.find((sphere) => sphere.id === id);
  if (!found) {
    throw new Error(`Unknown case sphere: ${id}`);
  }
  return found;
}

/*
 * Seed of the case type catalogue. It is written here for this phase only; the
 * catalogue belongs to Administration and moves to a record with source and date
 * when that module exists.
 */
export const caseTypesBySphere: Record<
  CaseSphereId,
  { id: string; label: string }[]
> = {
  labor: [
    { id: "severance", label: "Verbas rescisórias" },
    { id: "overtime", label: "Horas extras" },
    { id: "night-shift", label: "Adicional noturno" },
    { id: "unhealthy-work", label: "Insalubridade" },
    { id: "hazardous-work", label: "Periculosidade" },
    { id: "fgts", label: "FGTS" },
    { id: "employment-recognition", label: "Reconhecimento de vínculo" },
    { id: "harassment", label: "Assédio" },
    {
      id: "work-accident-damages",
      label: "Indenização por acidente de trabalho",
    },
  ],
  "state-accident": [
    { id: "accident-allowance", label: "Auxílio-acidente" },
    {
      id: "accident-temporary-incapacity",
      label: "Auxílio por incapacidade temporária acidentário",
    },
    {
      id: "accident-permanent-incapacity",
      label: "Aposentadoria por incapacidade permanente acidentária",
    },
    { id: "accident-death-pension", label: "Pensão por morte acidentária" },
  ],
  "state-civil": [
    { id: "judicial-permit", label: "Alvará judicial" },
    { id: "curatorship", label: "Curatela" },
    { id: "banking-action", label: "Ações bancárias" },
  ],
  /*
   * The benefit list of the office, fixed by the director on 2026-08-11. Age
   * retirement is split into urban and rural because they are different claims
   * with different proof, and the assistance benefit is split into the two
   * groups the law itself separates, the person with disability and the elderly
   * person, under Law 8.742 of 1993. Auxílio-acidente is not repeated here: it
   * derives from an accident at work and is heard by the State Justice, so it
   * lives in the state accident branch above.
   */
  "federal-social-security": [
    {
      id: "permanent-incapacity",
      label: "Aposentadoria por incapacidade permanente",
    },
    {
      id: "temporary-incapacity",
      label: "Auxílio por incapacidade temporária",
    },
    { id: "urban-age-retirement", label: "Aposentadoria por idade urbana" },
    { id: "rural-age-retirement", label: "Aposentadoria por idade rural" },
    {
      id: "contribution-retirement",
      label: "Aposentadoria por tempo de contribuição e regras de transição",
    },
    { id: "special-retirement", label: "Aposentadoria especial" },
    {
      id: "disability-age-retirement",
      label: "Aposentadoria da pessoa com deficiência por idade",
    },
    {
      id: "disability-contribution-retirement",
      label:
        "Aposentadoria da pessoa com deficiência por tempo de contribuição",
    },
    { id: "welfare-disability", label: "BPC/LOAS, pessoa com deficiência" },
    { id: "welfare-elderly", label: "BPC/LOAS, idoso" },
    { id: "death-pension", label: "Pensão por morte" },
    { id: "prison-allowance", label: "Auxílio-reclusão" },
    { id: "maternity-allowance", label: "Salário-maternidade" },
    { id: "benefit-revision", label: "Revisão de benefício" },
  ],
};

export const caseStatuses = [
  {
    id: "administrative",
    label: "Fase administrativa",
    detailLabel: "Requerimento em análise no INSS, antes de qualquer ação.",
  },
  {
    id: "judicial",
    label: "Fase judicial",
    detailLabel: "Ação distribuída e em andamento.",
  },
  { id: "appeal", label: "Em recurso", detailLabel: "Decisão recorrida." },
  {
    id: "execution",
    label: "Em execução",
    detailLabel: "Título definido, em cumprimento.",
  },
  {
    id: "closed",
    label: "Encerrado",
    detailLabel: "Sem etapa pendente no escritório.",
  },
] as const;

export type CaseStatusId = (typeof caseStatuses)[number]["id"];

export const caseStatusIds = caseStatuses.map((status) => status.id) as [
  CaseStatusId,
  ...CaseStatusId[],
];

/*
 * Document lifecycle. The local engine moves a document from "uploaded" to
 * "processing" and then to the state its own measurement earns, "processed",
 * "needs-review" or "failed", and no state is ever claimed without a measured
 * confidence behind it. The operator may still set a state by hand, which is
 * how a reading pending human validation is accepted or rejected.
 */
export const documentStates = [
  { id: "uploading", label: "Enviando" },
  { id: "uploaded", label: "Enviado" },
  { id: "processing", label: "Em processamento" },
  { id: "processed", label: "Processado" },
  { id: "needs-review", label: "Requer revisão humana" },
  { id: "failed", label: "Falha no processamento" },
] as const;

export type DocumentStateId = (typeof documentStates)[number]["id"];

export const documentStateIds = documentStates.map((state) => state.id) as [
  DocumentStateId,
  ...DocumentStateId[],
];

export function documentStateLabel(id: DocumentStateId): string {
  return (
    documentStates.find((state) => state.id === id)?.label ?? "Estado ignorado"
  );
}

/*
 * A stored record is identified by a ULID, twenty six characters of Crockford
 * base32. Anything else on a route belongs to the demonstration data, which uses
 * readable slugs, so the two sources never collide.
 */
const STORED_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isStoredId(value: string): boolean {
  return STORED_ID_PATTERN.test(value);
}

/* Check digits of the CPF. Structural validation, not a legal value. */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }
  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return (
    checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10])
  );
}

export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

const requiredText = (field: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { message: `Informe ${field}.` })
    .max(max, { message: `${field} passa de ${max} caracteres.` });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const clientInputSchema = z.object({
  fullName: requiredText("o nome completo", 140),
  cpf: z
    .string()
    .trim()
    .refine(isValidCpf, { message: "CPF inválido, confira os dígitos." })
    .transform(formatCpf),
  rg: requiredText("o documento de identidade", 40),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Informe a data de nascimento." })
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Data de nascimento inválida.",
    }),
  motherName: optionalText(140),
  phone: requiredText("o telefone", 40),
  email: z
    .string()
    .trim()
    .email({ message: "Endereço eletrônico inválido." })
    .max(140),
  address: requiredText("o endereço", 180),
  cityState: requiredText("a cidade e a unidade federativa", 120),
  notes: optionalText(600),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

export const caseInputSchema = z.object({
  sphere: z.enum(caseSphereIds),
  caseType: requiredText("o tipo do caso", 120),
  opposingParty: requiredText("a parte contrária", 140),
  status: z.enum(caseStatusIds),
  responsibleLawyer: requiredText("o advogado responsável", 140),
  reference: optionalText(60),
  factSummary: optionalText(600),
  /* The unified number of the judicial process, when the case already has one.
   * It is what lets a communication of the Diário de Justiça Eletrônico
   * Nacional find its case with no human deciding anything, so it is validated
   * by its own check digits and never merely stored. */
  lawsuitNumber: optionalText(30).refine(
    (value) => value === undefined || isValidProcessNumber(value),
    {
      message:
        "Número de processo inválido. Confira os dígitos verificadores da numeração única.",
    },
  ),
});

export type CaseInput = z.infer<typeof caseInputSchema>;

/*
 * Records as they live on disk. The identifier is a ULID everywhere, because
 * every record of this phase is internal and its chronological order is useful
 * when listing. UUID is reserved for an identifier that ever leaves the system,
 * such as a single use link, which does not exist yet.
 */
export const storedDocumentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  storedName: z.string(),
  mimeType: z.string(),
  byteSize: z.number().int().nonnegative(),
  state: z.enum(documentStateIds),
  uploadedAt: z.string(),
  uploadedBy: z.string(),
  stateNote: z.string().optional(),
  /* SHA-256 of the bytes. It is what keeps a document from being read twice and
   * what makes two byte identical uploads recognisable as the same document.
   * Optional because records written before the reading pipeline existed do not
   * carry it, and a record of the office is never rewritten to look newer. */
  fingerprint: z.string().optional(),
  extractedAt: z.string().optional(),
  meanConfidence: z.number().optional(),
  pageCount: z.number().int().nonnegative().optional(),
  ocrPages: z.number().int().nonnegative().optional(),
});

export type StoredDocument = z.infer<typeof storedDocumentSchema>;

/*
 * What a captured act leaves inside the case. Every one of these records names
 * the communication it was born from, because a number on a screen that cannot
 * be traced back to an official act does not belong in this system.
 */
const originSchema = z.object({
  communicationId: z.string(),
  certificateCode: z.string().nullable(),
  certificateUrl: z.string().nullable(),
  availableOn: z.string(),
  excerpt: z.string(),
});

export const caseDeadlineSchema = z.object({
  id: z.string(),
  label: z.string(),
  regime: z.enum(["procedural", "administrative"]),
  /* The whole chain, so the lawyer checks every link of it on screen. */
  availableOn: z.string(),
  publishedOn: z.string(),
  startsOn: z.string(),
  dueOn: z.string(),
  days: z.number().int().positive(),
  countedInBusinessDays: z.boolean(),
  court: z.string().nullable(),
  calendarReviewed: z.boolean(),
  warnings: z.array(z.string()).default([]),
  skipped: z
    .array(
      z.object({ date: z.string(), reason: z.string(), source: z.string() }),
    )
    .default([]),
  legalSources: z.array(z.string()).default([]),
  /* Two states and nothing else. Automation never writes `confirmed`. */
  state: z.enum(["calculated", "confirmed"]),
  confirmedBy: z.string().nullable().default(null),
  confirmedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  origin: originSchema,
});

export type CaseDeadline = z.infer<typeof caseDeadlineSchema>;

export const caseTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string().nullable().default(null),
  /* Suggested by the capture, accepted by a lawyer, or done. The automation
   * never closes a task and never accepts one on anybody's behalf. */
  state: z.enum(["suggested", "accepted", "done", "dismissed"]),
  responsible: z.string(),
  internalDueOn: z.string().nullable().default(null),
  deadlineId: z.string().nullable().default(null),
  createdAt: z.string(),
  decidedBy: z.string().nullable().default(null),
  decidedAt: z.string().nullable().default(null),
  origin: originSchema,
});

export type CaseTask = z.infer<typeof caseTaskSchema>;

export const caseEventSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string().nullable().default(null),
  place: z.string().nullable().default(null),
  createdAt: z.string(),
  origin: originSchema,
});

export type CaseEvent = z.infer<typeof caseEventSchema>;

/*
 * The reminder is addressed to the lawyer, one day before the appointment, so he
 * remembers to warn the client. It is internal: this phase sends no message and
 * no electronic mail to anyone, and the client never signs in.
 */
export const caseReminderSchema = z.object({
  id: z.string(),
  forLawyer: z.string(),
  remindOn: z.string(),
  message: z.string(),
  eventId: z.string(),
  state: z.enum(["pending", "done"]),
  createdAt: z.string(),
  doneBy: z.string().nullable().default(null),
  doneAt: z.string().nullable().default(null),
  origin: originSchema,
});

export type CaseReminder = z.infer<typeof caseReminderSchema>;

export const storedCaseSchema = caseInputSchema.extend({
  id: z.string(),
  clientId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  documents: z.array(storedDocumentSchema).default([]),
  deadlines: z.array(caseDeadlineSchema).default([]),
  tasks: z.array(caseTaskSchema).default([]),
  events: z.array(caseEventSchema).default([]),
  reminders: z.array(caseReminderSchema).default([]),
});

export type StoredCase = z.infer<typeof storedCaseSchema>;

/*
 * A notice on the client record. "Client record" here is the page the LAWYER
 * opens inside the system: the client has no login, receives nothing from the
 * system and is never contacted by it in this phase.
 */
export const clientNoticeSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  eventDate: z.string().nullable().default(null),
  eventTime: z.string().nullable().default(null),
  place: z.string().nullable().default(null),
  createdAt: z.string(),
  origin: originSchema,
});

export type ClientNotice = z.infer<typeof clientNoticeSchema>;

export const storedClientSchema = clientInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  notices: z.array(clientNoticeSchema).default([]),
});

export type StoredClient = z.infer<typeof storedClientSchema>;
