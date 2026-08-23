import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ulid } from "ulid";
import { parseAllDocuments, stringify } from "yaml";
import { OFFICE_TIME_ZONE } from "@/lib/trinity/office-context";
import { PROJECT_VERSION } from "@/lib/trinity/project-identity";
import { TRINITY_ROOT } from "@/lib/trinity/store-paths";

/*
 * What the reasoning layer costs, measured, and the ceilings that stop it.
 *
 * Cost nobody measures is cost that explodes, and a ceiling that is not checked
 * before the model is reached is not a ceiling. So every exchange leaves an
 * entry here, whether it was answered, refused, served from cache or stopped by
 * a ceiling, and every question passes through `ceilingCheck` before a single
 * token is spent.
 *
 * The unit that always exists is the token, because the office measures it on
 * every call. Money exists only when the director configures the price of the
 * model in the environment, and the office never estimates a price it was not
 * given: a number on screen has to trace to a real record, and an invented
 * price per token is an invented number.
 */

const SPEND_DIR = path.join(TRINITY_ROOT, "spend");

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function optionalNumberFromEnv(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/*
 * The ceilings. Both are read from the environment and documented in
 * `.env.example`; the defaults below are the office's opening position and the
 * director changes them without touching code.
 */
export function conversationTokenCeiling(): number {
  return numberFromEnv("IM_CONVERSATION_TOKEN_CEILING", 120_000);
}

export function dailyTokenCeiling(): number {
  return numberFromEnv("IM_DAILY_TOKEN_CEILING", 600_000);
}

/* Price per million tokens, in the configured currency. Absent, the office
 * reports consumption in tokens and says plainly that the price is not
 * configured, which is the honest state and not a failure. */
export function priceTable(): {
  input: number;
  output: number;
  currency: string;
} | null {
  const input = optionalNumberFromEnv("IM_PRICE_INPUT_PER_MTOK");
  const output = optionalNumberFromEnv("IM_PRICE_OUTPUT_PER_MTOK");
  if (input === null || output === null) {
    return null;
  }
  const currency = process.env.IM_PRICE_CURRENCY?.trim() || "USD";
  return { input, output, currency };
}

/* Money ceilings only bind when the price is configured, because a ceiling the
 * office cannot compute would be a control that silently does nothing. */
export function conversationSpendCeiling(): number | null {
  return priceTable() === null
    ? null
    : optionalNumberFromEnv("IM_CONVERSATION_SPEND_CEILING");
}

export function dailySpendCeiling(): number | null {
  return priceTable() === null
    ? null
    : optionalNumberFromEnv("IM_DAILY_SPEND_CEILING");
}

export function costOf(tokensIn: number, tokensOut: number): number | null {
  const price = priceTable();
  if (price === null) {
    return null;
  }
  return (
    (tokensIn / 1_000_000) * price.input +
    (tokensOut / 1_000_000) * price.output
  );
}

export function formatMoney(value: number): string {
  const price = priceTable();
  const currency = price?.currency ?? "USD";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  } catch {
    /* An unknown currency code must not break a screen. */
    return `${value.toFixed(4)} ${currency}`;
  }
}

/*
 * The day of the office, not the day of the server. A ceiling that resets at
 * an hour nobody in the office recognises is a ceiling nobody can plan around.
 */
export function officeDay(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OFFICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export type SpendOutcome =
  | "answered"
  | "cache-hit"
  | "blocked"
  | "refused"
  | "unavailable"
  | "ceiling";

export type SpendEntry = {
  id: string;
  at: string;
  day: string;
  conversationId: string;
  lawyerId: string;
  lawyerName: string;
  role: string;
  model: string;
  screen: string;
  outcome: SpendOutcome;
  tokensIn: number;
  tokensOut: number;
  /* What the cache spared on this exchange, measured from the tokens the
   * original answer actually cost. Zero on everything that is not a cache hit. */
  tokensSaved: number;
  projectVersion: string;
};

function dayFile(day: string): string {
  return path.join(SPEND_DIR, `${day}.yaml`);
}

export async function recordSpend(
  entry: Omit<SpendEntry, "id" | "at" | "day" | "projectVersion"> & {
    at?: string;
  },
): Promise<void> {
  const at = entry.at ?? new Date().toISOString();
  const day = officeDay(new Date(at));
  const full: SpendEntry = {
    id: ulid(),
    at,
    day,
    conversationId: entry.conversationId,
    lawyerId: entry.lawyerId,
    lawyerName: entry.lawyerName,
    role: entry.role,
    model: entry.model,
    screen: entry.screen,
    outcome: entry.outcome,
    tokensIn: entry.tokensIn,
    tokensOut: entry.tokensOut,
    tokensSaved: entry.tokensSaved,
    projectVersion: PROJECT_VERSION,
  };
  await mkdir(SPEND_DIR, { recursive: true });
  await appendFile(
    dayFile(day),
    `---\n${stringify(full, { lineWidth: 0 })}`,
    "utf8",
  );
}

export async function readDay(day: string): Promise<SpendEntry[]> {
  try {
    const raw = await readFile(dayFile(day), "utf8");
    return parseAllDocuments(raw)
      .map((document) => document.toJS() as SpendEntry | null)
      .filter((entry): entry is SpendEntry => Boolean(entry?.id));
  } catch {
    return [];
  }
}

export type Usage = {
  tokensIn: number;
  tokensOut: number;
  tokens: number;
  cost: number | null;
  /* Every question the office asked, whatever became of it. */
  questions: number;
  /* The ones that actually reached the model and could be billed. A question
   * stopped by a ceiling and a question answered from the cache are not here,
   * because neither of them was sent. */
  modelCalls: number;
  cacheHits: number;
  tokensSaved: number;
  blockedByCeiling: number;
};

export function usageOf(entries: SpendEntry[]): Usage {
  const tokensIn = entries.reduce((total, entry) => total + entry.tokensIn, 0);
  const tokensOut = entries.reduce(
    (total, entry) => total + entry.tokensOut,
    0,
  );
  return {
    tokensIn,
    tokensOut,
    tokens: tokensIn + tokensOut,
    cost: costOf(tokensIn, tokensOut),
    questions: entries.length,
    modelCalls: entries.filter(
      (entry) => entry.outcome !== "cache-hit" && entry.outcome !== "ceiling",
    ).length,
    cacheHits: entries.filter((entry) => entry.outcome === "cache-hit").length,
    tokensSaved: entries.reduce((total, entry) => total + entry.tokensSaved, 0),
    blockedByCeiling: entries.filter((entry) => entry.outcome === "ceiling")
      .length,
  };
}

export type CeilingVerdict = {
  allowed: boolean;
  reason: string | null;
  day: Usage;
  conversation: Usage;
};

/*
 * The decision itself, with no disk in it, so it can be exercised in full: the
 * ceiling that stops the office is the rule that most deserves a test.
 */
export function ceilingReason(day: Usage, conversation: Usage): string | null {
  const dayTokens = dailyTokenCeiling();
  const conversationTokens = conversationTokenCeiling();
  const dayMoney = dailySpendCeiling();
  const conversationMoney = conversationSpendCeiling();

  let reason: string | null = null;
  if (conversation.tokens >= conversationTokens) {
    reason = `Esta conversa atingiu o teto de consumo definido para uma conversa, que é de ${conversationTokens.toLocaleString("pt-BR")} tokens, e já consumiu ${conversation.tokens.toLocaleString("pt-BR")}. Abra uma conversa nova para continuar, ou peça à Administração que reveja o teto. Nenhuma pergunta foi enviada ao modelo.`;
  } else if (day.tokens >= dayTokens) {
    reason = `O escritório atingiu hoje o teto diário de consumo da Inteligência Massiva, que é de ${dayTokens.toLocaleString("pt-BR")} tokens, e já consumiu ${day.tokens.toLocaleString("pt-BR")}. O atendimento volta amanhã ou quando a Administração revisar o teto. Nenhuma pergunta foi enviada ao modelo.`;
  } else if (
    conversationMoney !== null &&
    conversation.cost !== null &&
    conversation.cost >= conversationMoney
  ) {
    reason = `Esta conversa atingiu o teto de gasto definido para uma conversa, que é de ${formatMoney(conversationMoney)}, e já gastou ${formatMoney(conversation.cost)}. Abra uma conversa nova para continuar, ou peça à Administração que reveja o teto. Nenhuma pergunta foi enviada ao modelo.`;
  } else if (dayMoney !== null && day.cost !== null && day.cost >= dayMoney) {
    reason = `O escritório atingiu hoje o teto diário de gasto da Inteligência Massiva, que é de ${formatMoney(dayMoney)}, e já gastou ${formatMoney(day.cost)}. O atendimento volta amanhã ou quando a Administração revisar o teto. Nenhuma pergunta foi enviada ao modelo.`;
  }
  return reason;
}

/*
 * Runs before the model is reached. A cache hit is not checked here on purpose:
 * an answer already on disk costs nothing, and refusing a free answer would
 * punish the office for a ceiling it did not exceed with that question.
 */
export async function ceilingCheck(
  conversationId: string,
  at: Date = new Date(),
): Promise<CeilingVerdict> {
  const entries = await readDay(officeDay(at));
  const day = usageOf(entries);
  const conversation = usageOf(
    entries.filter((entry) => entry.conversationId === conversationId),
  );
  const reason = ceilingReason(day, conversation);
  return { allowed: reason === null, reason, day, conversation };
}

export type LawyerUsage = Usage & { lawyerId: string; lawyerName: string };

export function usageByLawyer(entries: SpendEntry[]): LawyerUsage[] {
  const byLawyer = new Map<string, SpendEntry[]>();
  for (const entry of entries) {
    const bucket = byLawyer.get(entry.lawyerId);
    if (bucket) {
      bucket.push(entry);
    } else {
      byLawyer.set(entry.lawyerId, [entry]);
    }
  }
  return [...byLawyer.entries()]
    .map(([lawyerId, list]) => ({
      lawyerId,
      lawyerName: list[0]?.lawyerName ?? lawyerId,
      ...usageOf(list),
    }))
    .sort((a, b) => b.tokens - a.tokens);
}

/* The days the office wants on the panel, most recent first, including days
 * with no consumption, because a gap is information too. */
export function recentDays(count: number, at: Date = new Date()): string[] {
  const days: string[] = [];
  for (let back = 0; back < count; back += 1) {
    days.push(officeDay(new Date(at.getTime() - back * 24 * 60 * 60 * 1000)));
  }
  return days;
}
