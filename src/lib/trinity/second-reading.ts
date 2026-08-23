import "server-only";
import { fitDawidSkene, majorityVote } from "@takk/bayesconsensus";
import { createExperiment } from "@takk/bayesdecide";
import { Caduceus, defineModel, defineProvider } from "@takk/caduceus";
import { createFetchDispatch } from "@takk/caduceus/node";
import { agentClientFromChat, Coryphaeus, defineAgent } from "@takk/coryphaeus";
import {
  asCandidateId,
  createHeuristicJudge,
  defineRubric,
  judgeEvaluator,
  latencyEvaluator,
  regexEvaluator,
  Tribunal,
} from "@takk/tribunal";
import { lastAnsweredTurn } from "@/lib/trinity/conversations";
import { advisoryLabels } from "@/lib/trinity/intelligence-ops";
import { transportConfig } from "@/lib/trinity/model-transport";
import type { LawyerSession } from "@/lib/trinity/office-context";
import { sanitizeFailureDetail } from "@/lib/trinity/output-guards";
import { ceilingCheck, recordSpend } from "@/lib/trinity/spend-ledger";

/*
 * The second reading: an advisory review of the last answer the entity
 * delivered, requested by the Administration, one click at a time, never by
 * automation. Five packages compose here. `@takk/caduceus` is the transport of
 * the reviewer, deliberately independent from the transport that produced the
 * answer, so a second reading does not inherit a failure of the first path;
 * the order of models follows the director's decision, Gemini by default and
 * Claude when Gemini does not answer. `@takk/coryphaeus` orchestrates the
 * reviewer as a registered agent and keeps the provenance of the run.
 * `@takk/tribunal` evaluates the produced review with deterministic
 * evaluators and a heuristic judge, no second model call. `@takk/bayesdecide`
 * runs the standing experiment over the two rubric phrasings, learning which
 * one produces a readable review. `@takk/bayesconsensus` combines the graders
 * of the answer, the grounding reading, the calibrated gate, the tribunal and
 * the reviewer, into one consensus with its agreement.
 *
 * What this is not: a verification of facts against the records. The reviewer
 * receives the question and the answer, not the records, and the screen says
 * so. And nothing here decides: the result is advisory, shown to the
 * Administration, recorded in the spend ledger like any exchange.
 */

const REVIEW_CONVERSATION = "second-reading";
/* The default Gemini model reasons before it writes and the reasoning spends
 * output tokens; a cap too low returns thought and no text. Measured on
 * 2026-08-21 with a 64-token cap: the visible text came back empty. */
const REVIEW_MAX_OUTPUT_TOKENS = 2_048;
const REVIEW_MAX_LATENCY_MS = 120_000;

/* The two rubric phrasings under experiment. Both ask for the same three
 * grades and the same closing line; they differ in how much guidance the
 * reviewer receives. The reward is measured, not judged: one when the review
 * came back parseable, zero when it did not. */
const RUBRIC_VARIANTS = {
  "concise-rubric": [
    "Você é o revisor de qualidade de um escritório de advocacia previdenciária.",
    "Avalie a resposta abaixo dada a um advogado. Não confira fatos externos; avalie apenas o texto.",
    "Dê três notas de 0 a 10, cada uma em sua própria linha, no formato exato 'Clareza: N de 10', 'Fundamentação declarada: N de 10' e 'Cuidado jurídico: N de 10'.",
    "Termine com uma única linha no formato exato 'Leitura geral: adequada' ou 'Leitura geral: inadequada'.",
    "Responda em português do Brasil, sem se apresentar e sem repetir a pergunta.",
  ].join(" "),
  "detailed-rubric": [
    "Você é o revisor de qualidade de um escritório de advocacia previdenciária.",
    "Avalie a resposta abaixo dada a um advogado. Não confira fatos externos; avalie apenas o texto recebido.",
    "Clareza mede se um advogado entende a resposta na primeira leitura, sem ambiguidade.",
    "Fundamentação declarada mede se a resposta diz de onde vem cada afirmação, citando tela, registro ou documento, sem inventar origem.",
    "Cuidado jurídico mede se a resposta preserva as cautelas do escritório: prazo é confirmado por advogado, a Inteligência Massiva não decide, e incerteza é dita como incerteza.",
    "Dê três notas de 0 a 10, cada uma em sua própria linha, no formato exato 'Clareza: N de 10', 'Fundamentação declarada: N de 10' e 'Cuidado jurídico: N de 10'.",
    "Termine com uma única linha no formato exato 'Leitura geral: adequada' ou 'Leitura geral: inadequada'.",
    "Responda em português do Brasil, sem se apresentar e sem repetir a pergunta.",
  ].join(" "),
} as const;

type RubricVariant = keyof typeof RUBRIC_VARIANTS;

function priceOf(name: string): number {
  const perMillion = Number.parseFloat(process.env[name]?.trim() ?? "");
  return Number.isFinite(perMillion) && perMillion > 0 ? perMillion : 0;
}

function keysOf(
  single: string | undefined,
  plural: string | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [single ?? "", ...(plural ?? "").split(",")]) {
    const key = raw.trim();
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

type ReadingState = {
  caduceus: Caduceus | null;
  tribunal: Tribunal;
  experiment: ReturnType<typeof createExperiment>;
  votes: { item: string; agent: string; label: string }[];
  readings: number;
  /* Per-provider rotation cursor: every call presents the next key of its
   * provider, so a refused or exhausted key yields to the following one on
   * the retry the transport already performs. */
  cursor: { gemini: number; anthropic: number };
  /* Key indexes the provider refused with 401 or 403. A refused key is never
   * presented again in this process, so one dead key in the pool cannot push
   * the reading to the fallback provider. Measured on 2026-08-21: the first
   * Gemini key of the office is refused and, without this, the first reading
   * cascaded to Claude although four healthy Gemini keys existed. */
  badKeys: { gemini: Set<number>; anthropic: Set<number> };
  lastPresented: { gemini: number; anthropic: number };
};

const STATE_KEY = "__advprev_second_reading__";

function buildCaduceus(state: ReadingState): Caduceus | null {
  const config = transportConfig();
  if (config.models.length === 0) {
    return null;
  }
  const geminiKeys = keysOf(
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEYS,
  );
  const anthropicKeys = keysOf(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEYS,
  );
  const nextKey = (provider: "gemini" | "anthropic"): string => {
    const keys = provider === "gemini" ? geminiKeys : anthropicKeys;
    if (keys.length === 0) {
      return "";
    }
    const refused = state.badKeys[provider];
    for (let step = 0; step < keys.length; step += 1) {
      const index = state.cursor[provider] % keys.length;
      state.cursor[provider] += 1;
      if (refused.has(index) && refused.size < keys.length) {
        continue;
      }
      state.lastPresented[provider] = index;
      return keys[index] ?? "";
    }
    state.lastPresented[provider] = 0;
    return keys[0] ?? "";
  };

  /* The base carries the API version because the transport appends only the
   * resource path. Measured against the live service on 2026-08-21: the
   * versionless base answers 404 and the versioned base answers 200. */
  const providers = [
    defineProvider({
      id: "google",
      shape: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    }),
    defineProvider({
      id: "anthropic",
      shape: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
    }),
  ];
  /* The registration order is the director's order: Gemini first, Claude
   * after, and the sequential cascade tries them exactly in that order. */
  const models = config.models.map((entry) =>
    defineModel({
      id: entry.modelId,
      provider: entry.provider === "gemini" ? "google" : "anthropic",
      model: entry.modelId,
      cost: {
        inputPerMTok: priceOf(
          entry.provider === "gemini"
            ? "IM_PRICE_GEMINI_INPUT_PER_MTOK"
            : "IM_PRICE_INPUT_PER_MTOK",
        ),
        outputPerMTok: priceOf(
          entry.provider === "gemini"
            ? "IM_PRICE_GEMINI_OUTPUT_PER_MTOK"
            : "IM_PRICE_OUTPUT_PER_MTOK",
        ),
      },
    }),
  );

  const inner = createFetchDispatch({
    auth: (call) =>
      call.shape === "gemini"
        ? { "x-goog-api-key": nextKey("gemini") }
        : {
            "x-api-key": nextKey("anthropic"),
            "anthropic-version": "2023-06-01",
          },
  });

  /* A 401 or 403 condemns the key that was presented, not the model: the
   * index is retired and the next reading runs on a key the provider accepts. */
  const dispatch: ReturnType<typeof createFetchDispatch> = async (call) => {
    const provider = call.shape === "gemini" ? "gemini" : "anthropic";
    const result = await inner(call);
    const status = (result as { status?: number }).status;
    if (
      (status === 401 || status === 403) &&
      state.lastPresented[provider] >= 0
    ) {
      state.badKeys[provider].add(state.lastPresented[provider]);
    }
    return result;
  };

  return new Caduceus({
    dispatch,
    providers,
    models,
    strategy: "sequential-cascade",
    retry: { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 8_000 },
  });
}

function buildTribunal(): Tribunal {
  const rubric = defineRubric({
    id: "second-reading-review",
    criteria: [
      {
        id: "grades-present",
        description:
          "The review carries the three grades in the exact expected lines.",
        weight: 2,
        mustInclude: ["de 10"],
      },
      {
        id: "closing-line",
        description: "The review closes with the overall reading line.",
        weight: 2,
        mustInclude: ["Leitura geral:"],
      },
      {
        id: "language",
        description: "The review does not slip into English boilerplate.",
        weight: 1,
        mustAvoid: ["As an AI", "I cannot", "Sorry"],
      },
    ],
    passThreshold: 0.6,
  });
  return new Tribunal()
    .addEvaluator(
      regexEvaluator({
        id: "overall-line",
        pattern: /Leitura geral:\s*(adequada|inadequada)/i,
        mustMatch: true,
      }),
    )
    .addEvaluator(latencyEvaluator({ maxMs: REVIEW_MAX_LATENCY_MS }))
    .addEvaluator(
      judgeEvaluator({
        id: "heuristic-judge",
        judge: createHeuristicJudge(),
        rubric,
      }),
    );
}

function state(): ReadingState {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[STATE_KEY];
  if (existing !== undefined) {
    return existing as ReadingState;
  }
  const built: ReadingState = {
    caduceus: null,
    tribunal: buildTribunal(),
    experiment: createExperiment({
      variants: [
        { id: "concise-rubric", label: "Rubrica enxuta" },
        { id: "detailed-rubric", label: "Rubrica detalhada" },
      ],
      rewardModel: "bernoulli",
    }),
    votes: [],
    readings: 0,
    cursor: { gemini: 0, anthropic: 0 },
    badKeys: { gemini: new Set(), anthropic: new Set() },
    lastPresented: { gemini: -1, anthropic: -1 },
  };
  built.caduceus = buildCaduceus(built);
  scope[STATE_KEY] = built;
  return built;
}

export type SecondReading = {
  ok: boolean;
  reason: string | null;
  at: string;
  reviewedAnswerAt: string | null;
  reviewerModel: string | null;
  reviewText: string | null;
  grades: { label: string; value: number }[];
  overall: "adequada" | "inadequada" | null;
  tribunal: {
    outcome: string;
    score: number;
    findings: number;
  } | null;
  consensus: {
    label: string;
    agreement: number;
    votes: number;
  } | null;
  raterAgreementMeasured: boolean;
  experiment: {
    variant: string;
    report: { variant: string; trials: number; mean: number }[];
  } | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

function parseGrades(text: string): { label: string; value: number }[] {
  const grades: { label: string; value: number }[] = [];
  for (const [label, pattern] of [
    ["Clareza", /Clareza:\s*(\d{1,2})\s*de\s*10/i],
    [
      "Fundamentação declarada",
      /Fundamenta\S+ declarada:\s*(\d{1,2})\s*de\s*10/i,
    ],
    ["Cuidado jurídico", /Cuidado jur\S+:\s*(\d{1,2})\s*de\s*10/i],
  ] as const) {
    const match = text.match(pattern);
    const value =
      match?.[1] !== undefined ? Number.parseInt(match[1], 10) : null;
    if (value !== null && value >= 0 && value <= 10) {
      grades.push({ label, value });
    }
  }
  return grades;
}

function parseOverall(text: string): "adequada" | "inadequada" | null {
  const match = text.match(/Leitura geral:\s*(adequada|inadequada)/i);
  const word = match?.[1]?.toLowerCase();
  return word === "adequada" || word === "inadequada" ? word : null;
}

export async function runSecondReading(
  session: LawyerSession,
): Promise<SecondReading> {
  const at = new Date().toISOString();
  const empty: Omit<SecondReading, "ok" | "reason"> = {
    at,
    reviewedAnswerAt: null,
    reviewerModel: null,
    reviewText: null,
    grades: [],
    overall: null,
    tribunal: null,
    consensus: null,
    raterAgreementMeasured: false,
    experiment: null,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
  };

  if (session.role !== "admin") {
    return {
      ok: false,
      reason: "A segunda leitura pertence à Administração.",
      ...empty,
    };
  }

  const current = state();
  if (current.caduceus === null) {
    return {
      ok: false,
      reason:
        "Nenhum provedor de modelo está configurado para a segunda leitura.",
      ...empty,
    };
  }

  const turn = await lastAnsweredTurn();
  if (turn === null) {
    return {
      ok: false,
      reason:
        "Nenhuma resposta entregue foi encontrada no registro de conversas para ser lida de novo.",
      ...empty,
    };
  }

  /* The same ceilings that govern a question govern the reading: checked
   * before the model is reached, recorded in the same ledger after. */
  const ceiling = await ceilingCheck(REVIEW_CONVERSATION, new Date(at));
  if (!ceiling.allowed && ceiling.reason !== null) {
    return { ok: false, reason: ceiling.reason, ...empty };
  }

  const selection = current.experiment.select();
  const variant = (
    selection.variant in RUBRIC_VARIANTS ? selection.variant : "concise-rubric"
  ) as RubricVariant;
  const system = RUBRIC_VARIANTS[variant];

  const reviewInput = [
    "PERGUNTA DO ADVOGADO:",
    turn.userPrompt,
    "",
    "RESPOSTA A AVALIAR:",
    turn.answer,
  ].join("\n");

  /* The reviewer is a registered agent and the run keeps its provenance. The
   * chat behind the agent is the caduceus route: Gemini first, Claude when
   * Gemini does not answer, keys rotating per call. */
  let reviewerModel: string | null = null;
  let tokensIn = 0;
  let tokensOut = 0;
  let costUsd = 0;
  const startedAt = Date.now();
  const transport = current.caduceus;
  const orchestrator = new Coryphaeus({
    client: agentClientFromChat(async (request) => {
      const chatRequest = {
        messages: [
          { role: "system" as const, content: request.system },
          { role: "user" as const, content: request.task },
        ],
        maxOutputTokens: REVIEW_MAX_OUTPUT_TOKENS,
      };
      const retiredBefore = current.badKeys.gemini.size;
      let result = await transport.complete(chatRequest);
      /* A Gemini key condemned inside this very call pushed the cascade to
       * the fallback although healthy Gemini keys exist. One more attempt
       * runs with the condemned key already retired, the same retry-once
       * pattern the main transport measured on 2026-08-15. Both attempts are
       * counted, because both were billed. */
      if (
        String(result.winner.provider) === "anthropic" &&
        current.badKeys.gemini.size > retiredBefore
      ) {
        tokensIn += result.response.usage.inputTokens;
        tokensOut += result.response.usage.outputTokens;
        costUsd += result.totalCostUsd;
        result = await transport.complete(chatRequest);
      }
      reviewerModel = String(result.winner.model);
      tokensIn += result.response.usage.inputTokens;
      tokensOut += result.response.usage.outputTokens;
      costUsd += result.totalCostUsd;
      return {
        content: result.response.text,
        usage: {
          inputTokens: result.response.usage.inputTokens,
          outputTokens: result.response.usage.outputTokens,
        },
      };
    }),
    agents: [
      /* The reader plays the worker role because it is the one that executes
       * the reading, and the verifier role because reading is verification. */
      defineAgent({
        id: "second-reader",
        provider: "advprev-transport",
        model: "director-order",
        roles: ["worker", "verifier"],
      }),
    ],
  });

  let reviewText: string;
  try {
    const run = await orchestrator.run({
      input: reviewInput,
      system,
      complexity: "low",
    });
    reviewText = run.output;
  } catch (error) {
    /* The transport failed before the rubric could act, so the experiment
     * observes nothing: a network failure says nothing about the phrasing. */
    const detail = sanitizeFailureDetail(
      error instanceof Error ? error.message : String(error),
    );
    return {
      ok: false,
      reason: `A segunda leitura não foi produzida agora. Nada foi registrado como leitura. Tente novamente em instantes. Detalhe técnico: ${detail}`,
      ...empty,
      reviewedAnswerAt: turn.at,
    };
  }
  const latencyMs = Date.now() - startedAt;

  const grades = parseGrades(reviewText);
  const overall = parseOverall(reviewText);
  const parseable = overall !== null && grades.length > 0;
  current.experiment.observe(variant, parseable ? 1 : 0);

  /* The tribunal reads the produced review with deterministic evaluators and
   * the heuristic judge; no second model call happens here. */
  const verdict = await current.tribunal.tryCandidate(
    {
      id: asCandidateId(`reading-${at}`),
      content: reviewText,
      latencyMs,
    },
    { prompt: turn.userPrompt },
  );

  /* Four graders of the same answer vote, and the consensus carries its
   * agreement. With three or more readings the rater agreement model runs
   * and its convergence is reported. */
  const item = `answer-${turn.at}`;
  const advisory = advisoryLabels();
  const votes = [
    ...(advisory.grounding === null
      ? []
      : [{ item, agent: "grounding", label: advisory.grounding }]),
    ...(advisory.gate === null
      ? []
      : [{ item, agent: "output-gate", label: advisory.gate }]),
    {
      item,
      agent: "tribunal",
      label: verdict.outcome === "pass" ? "high" : "low",
    },
    ...(overall === null
      ? []
      : [
          {
            item,
            agent: "reviewer",
            label: overall === "adequada" ? "high" : "low",
          },
        ]),
  ];
  current.votes = [...current.votes, ...votes].slice(-400);
  current.readings += 1;

  const majority = majorityVote(votes);
  const consensus = majority.get(item) ?? null;

  let raterAgreementMeasured = false;
  const items = new Set(current.votes.map((vote) => vote.item));
  if (items.size >= 3) {
    try {
      fitDawidSkene(current.votes);
      raterAgreementMeasured = true;
    } catch {
      /* Not enough overlap between raters yet: the report says so. */
    }
  }

  await recordSpend({
    at,
    conversationId: REVIEW_CONVERSATION,
    lawyerId: session.lawyerId,
    lawyerName: session.lawyerName,
    role: session.role,
    model: reviewerModel ?? "none",
    screen: "Configurações, segunda leitura",
    outcome: "answered",
    tokensIn,
    tokensOut,
    tokensSaved: 0,
  });

  return {
    ok: true,
    reason: null,
    at,
    reviewedAnswerAt: turn.at,
    reviewerModel,
    reviewText,
    grades,
    overall,
    tribunal: {
      outcome: verdict.outcome,
      score: verdict.score,
      findings: verdict.findings.length,
    },
    consensus:
      consensus === null
        ? null
        : {
            label: consensus.label,
            agreement: consensus.agreement,
            votes: consensus.votes,
          },
    raterAgreementMeasured,
    experiment: {
      variant,
      report: current.experiment.report().map((entry) => ({
        variant: entry.variant,
        trials: entry.trials,
        mean: entry.mean,
      })),
    },
    tokensIn,
    tokensOut,
    costUsd,
  };
}
