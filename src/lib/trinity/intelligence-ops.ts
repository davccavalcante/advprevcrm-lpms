import "server-only";
import { createStash } from "@takk/agenticstash";
import {
  assessGrounding,
  classifyClaims,
  type GroundingResult,
} from "@takk/automend";
import { BetaHierarchy } from "@takk/bayesbelief";
import { createNetwork, imServingIncident } from "@takk/bayescausal";
import { createDetector } from "@takk/bayeschangepoint";
import { OutputGateMonitor } from "@takk/bayesoutputgate";
import { fitSurvival, foldEvents, forecast } from "@takk/bayespredicts";
import { createBayesTruth } from "@takk/bayestruth";
import { createBehavioralAI } from "@takk/behavioralai";
import { createGapTime } from "@takk/gaptime";
import { createGlasshouse } from "@takk/glasshouse";
import { createKrikos } from "@takk/krikos";
import { createCustoms } from "@takk/mcpcustoms";
import { asAgentId, asNamespaceId, createMnemosyne } from "@takk/mnemosyne";
import { createNoeticOS } from "@takk/noeticos";
import { createRACS, estimateTokens } from "@takk/racs";
import { createForecaster } from "@takk/tokenforecast";
import { createTreasury, toUsd, usd } from "@takk/treasury";
import { listRuns } from "@/lib/capture/runs";
import { transportConfig } from "@/lib/trinity/model-transport";
import {
  costOf,
  officeDay,
  priceTable,
  readDay,
} from "@/lib/trinity/spend-ledger";

/*
 * The observation deck of the body. Everything the office measures about an
 * exchange with David that is not the exchange itself lives here: identity,
 * inspection, tracing, drift, grounding, memory, facts, recording, tuning,
 * prompt-cache discipline and money. Thirteen packages of the @takk family
 * compose in this file, each doing the one thing it was written for, and none
 * of them decides anything a lawyer should decide. Two deterministic gates are
 * enforced, because they are governance and not intelligence: the identity of
 * the body must be active and authorized (krikos), and a configured money
 * ceiling must not be crossed (treasury). Every other result is advisory,
 * recorded and shown to the administration, never blocking an answer, by
 * constitutional rule: the IM layer classifies, extracts, suggests and alerts,
 * and does not decide.
 *
 * Nothing here persists to disk in this phase. The state lives in the process
 * and survives the development reload on the global object, exactly like the
 * transport, and the screen that reads it says "neste processo" out loud.
 */

const DAVID_AGENT = "david";

/* Jeffreys' scale: a Bayes factor above three is substantial evidence for
 * high quality, below one third substantial evidence against. The gate only
 * reports the decision; it never withholds an answer. */
const GATE_PASS_ABOVE = 3;
const GATE_FAIL_BELOW = 1 / 3;

/* Lexical grounding reads sentences against the office context. Caps keep the
 * comparison cheap on the machine of the office; they bound work, not data. */
const CLAIM_MIN_CHARS = 20;
const CLAIM_LIMIT = 24;
const EVIDENCE_CHARS = 20_000;

type Krikos = ReturnType<typeof createKrikos>;
type Customs = ReturnType<typeof createCustoms>;
type CustomsVerdict = ReturnType<Customs["inspect"]>;
type Behavioral = ReturnType<typeof createBehavioralAI>;
type Drift = ReturnType<Behavioral["observe"]>;
type Detector = ReturnType<typeof createDetector>;
type Glasshouse = ReturnType<typeof createGlasshouse>;
type LiveSpan = ReturnType<Glasshouse["startSpan"]>;
type GateDecision = ReturnType<OutputGateMonitor["evaluate"]>;
type Memory = ReturnType<typeof createMnemosyne>;
type Facts = ReturnType<typeof createGapTime>;
type Stash = ReturnType<typeof createStash>;
type Noetic = ReturnType<typeof createNoeticOS>;
type Racs = ReturnType<typeof createRACS>;
type Treasury = ReturnType<typeof createTreasury>;

type OpsState = {
  krikos: Krikos;
  davidId: string;
  customs: Customs;
  lastVerdict: CustomsVerdict | null;
  behavioral: Behavioral;
  lastDrift: Drift | null;
  latencyShift: Detector;
  outputShift: Detector;
  latencyChangepoints: number;
  outputChangepoints: number;
  glass: Glasshouse;
  gate: OutputGateMonitor;
  gateObservations: number;
  lastGate: GateDecision | null;
  lastGrounding: GroundingResult | null;
  memory: Memory;
  facts: Facts;
  stash: Stash;
  noetic: Noetic;
  lastRecommendation: {
    taskClass: string;
    cohort: string;
    reasoning: string;
  } | null;
  racs: Racs;
  lastLintFindings: number;
  treasury: Treasury;
  exchanges: number;
  telemetryFailures: number;
  failedSteps: string[];
};

const STATE_KEY = "__advprev_intelligence_ops__";

function optionalUsd(name: string): number | undefined {
  const value = Number.parseFloat(process.env[name]?.trim() ?? "");
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/* The budget the treasury enforces, in dollars, from the same variables the
 * transport reads, plus the per-conversation ceiling nothing else enforces.
 * The three are optional; absent all three, the treasury only reports. */
function treasuryBudget(): {
  perRequest?: number;
  perTask?: number;
  perDay?: number;
} | null {
  const perRequest = optionalUsd("IM_BUDGET_PER_REQUEST_USD");
  const perTask = optionalUsd("IM_BUDGET_PER_TASK_USD");
  const perDay = optionalUsd("IM_BUDGET_PER_DAY_USD");
  if (
    perRequest === undefined &&
    perTask === undefined &&
    perDay === undefined
  ) {
    return null;
  }
  return {
    ...(perRequest === undefined ? {} : { perRequest }),
    ...(perTask === undefined ? {} : { perTask }),
    ...(perDay === undefined ? {} : { perDay }),
  };
}

/* Money is only computed when the office configured a price in dollars. A
 * price in another currency cannot feed a ceiling declared in dollars, so it
 * is treated as not configured here and the panel says consumption in tokens. */
function usdCost(tokensIn: number, tokensOut: number): number {
  const table = priceTable();
  if (table === null || table.currency !== "USD") {
    return 0;
  }
  return costOf(tokensIn, tokensOut) ?? 0;
}

function buildState(): OpsState {
  const krikos = createKrikos({ idPrefix: "advprev" });
  /* The body is issued once per process by MAIC as its issuer, with the two
   * capabilities it exercises: answering inside a conversation and reading
   * the extracted text of documents. Every authorization is audited. */
  const david = krikos.issue({
    name: DAVID_AGENT,
    issuer: { id: "maic", name: "MAIC" },
    framework: "teleologyhi-nhe",
    capabilities: [
      {
        name: "office-answer",
        actions: ["answer"],
        resources: ["office:conversation"],
      },
      {
        name: "office-documents",
        actions: ["read"],
        resources: ["office:document"],
      },
    ],
    activate: true,
  });

  const facts = createGapTime({
    predicates: [{ name: "answered-with", cardinality: "multi" }],
  });

  const budget = treasuryBudget();

  return {
    krikos,
    davidId: david.id,
    customs: createCustoms(),
    lastVerdict: null,
    behavioral: createBehavioralAI(),
    lastDrift: null,
    latencyShift: createDetector(),
    outputShift: createDetector(),
    latencyChangepoints: 0,
    outputChangepoints: 0,
    glass: createGlasshouse({ audit: true }),
    gate: new OutputGateMonitor({
      policy: {
        kind: "bayes-factor",
        passAbove: GATE_PASS_ABOVE,
        failBelow: GATE_FAIL_BELOW,
      },
    }),
    gateObservations: 0,
    lastGate: null,
    lastGrounding: null,
    memory: createMnemosyne({
      namespace: asNamespaceId("advprev-office"),
      agent: asAgentId(DAVID_AGENT),
      audit: true,
    }),
    facts,
    stash: createStash({ id: "david-exchanges" }),
    noetic: createNoeticOS(),
    lastRecommendation: null,
    racs: createRACS(),
    lastLintFindings: 0,
    treasury: createTreasury(budget === null ? {} : { budget }),
    exchanges: 0,
    telemetryFailures: 0,
    failedSteps: [],
  };
}

function state(): OpsState {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[STATE_KEY];
  if (existing !== undefined) {
    return existing as OpsState;
  }
  const built = buildState();
  scope[STATE_KEY] = built;
  return built;
}

/* A telemetry step must never break an answer. The failure is counted, named
 * and shown on the panel instead of being swallowed in silence. */
function telemetryFailed(current: OpsState, step: string): void {
  current.telemetryFailures += 1;
  if (!current.failedSteps.includes(step)) {
    current.failedSteps = [...current.failedSteps, step].slice(-8);
  }
}

function guarded(current: OpsState, step: string, run: () => void): void {
  try {
    run();
  } catch {
    telemetryFailed(current, step);
  }
}

export type ExchangeStart = {
  question: string;
  officeBlock: string;
  conversationId: string;
  lawyerId: string;
  screen: string;
};

export type ExchangeOps = {
  /* Set only by the two deterministic gates, identity and money. Everything
   * else in this module observes and never blocks. */
  blockedReason: string | null;
  span: LiveSpan;
  executionId: string | null;
  estimatedUsd: number;
};

const BUDGET_SCOPE_LABEL: Record<string, string> = {
  request: "por pergunta",
  task: "por conversa",
  day: "por dia",
};

export function opsBeforeExchange(input: ExchangeStart): ExchangeOps {
  const current = state();
  current.exchanges += 1;

  let blockedReason: string | null = null;

  /* Identity gate. The body must hold an active credential with the answer
   * capability; the check writes one event to the hash-chained audit. */
  const authorized = current.krikos.authorize(
    current.davidId,
    "office-answer",
    "answer",
    "office:conversation",
    input.lawyerId,
  );
  if (!authorized) {
    blockedReason =
      "A credencial do corpo que responde pelo escritório não está ativa, então nenhuma resposta foi produzida. Avise a administração.";
  }

  /* The local document search is inspected as the tool call it is. The
   * verdict is advisory by constitutional rule: it is recorded and shown to
   * the administration, and MAIC remains the layer that decides. */
  guarded(current, "customs-inspect", () => {
    current.lastVerdict = current.customs.inspect({
      tool: "office-document-search",
      args: { question: input.question },
      description:
        "Local search over the text already extracted from the documents of the office.",
    });
  });

  /* The prompt of this exchange is planned as cacheable segments, so the lint
   * of the plan can tell the administration what the prompt discipline costs.
   * The office context changes with the records and the question changes
   * every time; the plan says so instead of pretending stability. */
  guarded(current, "racs-plan", () => {
    const first = transportConfig().models[0];
    if (first === undefined) {
      return;
    }
    const provider = first.provider === "gemini" ? "google" : "anthropic";
    const plan = current.racs.plan({
      provider,
      model: first.modelId,
      segments: [
        {
          id: "office-context",
          role: "documents",
          stability: "semi",
          content: input.officeBlock,
        },
        {
          id: "question",
          role: "dynamic",
          stability: "volatile",
          content: input.question,
        },
      ],
    });
    current.lastLintFindings = plan.findings.length;
  });

  /* Money gate, pre-flight. The estimate covers the input the office can
   * measure before the call; the output is recorded after, with real numbers.
   * Without a configured price in dollars the estimate is zero and only a
   * ledger already depleted by real records could refuse. */
  const estimatedUsd = usdCost(
    estimateTokens(`${input.officeBlock}\n${input.question}`),
    0,
  );
  if (blockedReason === null) {
    try {
      const verdict = current.treasury.authorize(usd(estimatedUsd), {
        taskId: input.conversationId,
      });
      if (!verdict.allowed) {
        const scope =
          verdict.breachedScope !== undefined
            ? (BUDGET_SCOPE_LABEL[verdict.breachedScope] ??
              verdict.breachedScope)
            : "configurado";
        blockedReason = `O teto de gasto em dinheiro ${scope} seria ultrapassado por esta pergunta, então ela não foi enviada ao modelo. A administração define os tetos no ambiente.`;
      }
    } catch {
      telemetryFailed(current, "treasury-authorize");
    }
  }

  /* The runtime tuner classifies the task and recommends parameters. The
   * office does not apply them to the call in this phase; the recommendation
   * and its outcome teach the profile the panel shows. */
  let executionId: string | null = null;
  guarded(current, "noetic-recommend", () => {
    const recommendation = current.noetic.recommend({
      agentId: DAVID_AGENT,
      kind: "factual-qa",
      promptLength: input.officeBlock.length + input.question.length,
      toolsAvailable: 0,
    });
    executionId = recommendation.executionId;
    current.lastRecommendation = {
      taskClass: recommendation.taskClass,
      cohort: recommendation.cohort,
      reasoning: recommendation.reasoning,
    };
  });

  const span = current.glass.startSpan("david-exchange", {
    kind: "llm",
    agentId: DAVID_AGENT,
    attributes: { screen: input.screen },
  });

  return { blockedReason, span, executionId, estimatedUsd };
}

export type ExchangeResult = {
  at: string;
  outcome: "answered" | "blocked" | "refused" | "unavailable";
  provider: "anthropic" | "gemini" | null;
  model: string | null;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  answer: string;
  evidence: string[];
  conversationId: string;
  lawyerId: string;
  screen: string;
};

/* Sentences long enough to carry a claim, capped, each one checked against
 * the office context the model actually received. */
function claimsOf(answer: string): { id: string; text: string }[] {
  return answer
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= CLAIM_MIN_CHARS)
    .slice(0, CLAIM_LIMIT)
    .map((text, index) => ({ id: `claim-${index + 1}`, text }));
}

export async function opsAfterExchange(
  ops: ExchangeOps,
  result: ExchangeResult,
): Promise<void> {
  const current = state();
  const failed = result.outcome !== "answered";

  guarded(current, "behavioral-observe", () => {
    current.lastDrift = current.behavioral.observe({
      agentId: DAVID_AGENT,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
      inputTokens: result.tokensIn,
      outputTokens: result.tokensOut,
      finishReason: result.outcome,
      error: failed,
      metadata: {
        model: result.model ?? "none",
        screen: result.screen,
      },
    });
  });

  guarded(current, "changepoint-observe", () => {
    /* The very first observation of a stream is a boundary by construction,
     * not a regime change of the office, so it is never counted. */
    if (result.latencyMs > 0) {
      const seen = current.latencyShift.observations;
      const latency = current.latencyShift.observe(result.latencyMs);
      if (latency.isChangepoint && !latency.warming && seen > 0) {
        current.latencyChangepoints += 1;
      }
    }
    if (result.tokensOut > 0) {
      const seen = current.outputShift.observations;
      const output = current.outputShift.observe(result.tokensOut);
      if (output.isChangepoint && !output.warming && seen > 0) {
        current.outputChangepoints += 1;
      }
    }
  });

  /* Grounding is measured only on a delivered answer, against the context the
   * model received. The tiers of the package suggest regenerating; the office
   * records the suggestion and never regenerates on its own. */
  let grounding: GroundingResult | null = null;
  guarded(current, "grounding", () => {
    if (!failed && result.answer.length > 0) {
      const claims = claimsOf(result.answer);
      if (claims.length > 0) {
        const evidence = result.evidence
          .map((chunk) => chunk.slice(0, EVIDENCE_CHARS))
          .filter((chunk) => chunk.length > 0);
        grounding = assessGrounding(classifyClaims(claims, evidence));
        current.lastGrounding = grounding;
      }
    }
  });

  guarded(current, "output-gate", () => {
    const scores = [
      { dimension: "grounding", value: grounding?.score ?? 0 },
      { dimension: "delivery", value: failed ? 0 : 1 },
      { dimension: "latency", value: 1 / (1 + result.latencyMs / 10_000) },
    ];
    current.gate.observe({
      scores,
      label:
        !failed && grounding !== null && grounding.tier === "proceed"
          ? "high"
          : "low",
    });
    current.gateObservations += 1;
    current.lastGate = current.gate.evaluate(scores);
  });

  /* What the exchange was, without the exchange itself: no question and no
   * answer text enters the memory, the fact graph or the recording, by
   * minimization. The conversation file already keeps the full text. */
  const summary = {
    model: result.model ?? "none",
    outcome: result.outcome,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    screen: result.screen,
  };

  try {
    await current.memory.remember({
      key: `exchange/${result.conversationId}/${result.at}`,
      value: summary,
      tags: ["exchange", result.outcome],
    });
  } catch {
    telemetryFailed(current, "memory-remember");
  }

  guarded(current, "fact-assert", () => {
    if (result.model !== null) {
      current.facts.assert({
        subject: { type: "agent", name: DAVID_AGENT },
        predicate: "answered-with",
        object: { type: "model", name: result.model },
        provenance: { source: "office-exchange", actor: result.lawyerId },
        validFrom: Date.parse(result.at),
      });
    }
  });

  guarded(current, "stash-record", () => {
    current.stash.value(
      "exchange",
      `${result.conversationId}/${result.at}`,
      summary,
    );
  });

  guarded(current, "noetic-report", () => {
    if (ops.executionId !== null) {
      current.noetic.report({
        executionId: ops.executionId,
        latencyMs: result.latencyMs,
        costUsd: result.costUsd,
        inputTokens: result.tokensIn,
        outputTokens: result.tokensOut,
        finishReason: failed ? "error" : "stop",
        error: failed,
        ...(grounding === null ? {} : { qualityScore: grounding.score }),
      });
    }
  });

  guarded(current, "racs-record", () => {
    if (result.provider !== null && result.model !== null) {
      current.racs.record({
        provider: result.provider === "gemini" ? "google" : "anthropic",
        model: result.model,
        inputTokens: result.tokensIn,
        /* No provider-side prompt cache is active in this phase, and the
         * ledger says so with a zero instead of an estimate. */
        cacheReadTokens: 0,
      });
    }
  });

  guarded(current, "treasury-record", () => {
    const actualUsd =
      result.costUsd > 0
        ? result.costUsd
        : usdCost(result.tokensIn, result.tokensOut);
    if (actualUsd > 0) {
      current.treasury.ledger.record(usd(actualUsd), {
        taskId: result.conversationId,
      });
    }
  });

  try {
    if (result.model !== null) {
      ops.span.setModel(result.model, result.provider ?? undefined);
    }
    ops.span.setUsage({
      inputTokens: result.tokensIn,
      outputTokens: result.tokensOut,
      costUsd: result.costUsd,
    });
    ops.span.setStatus(failed ? "error" : "ok", result.outcome);
    await ops.span.end();
  } catch {
    telemetryFailed(current, "trace-span");
  }
}

/* The advisory labels of the last delivered answer, read by the consensus of
 * the second reading. Null when this process has not measured one yet. */
export function advisoryLabels(): {
  grounding: "high" | "low" | null;
  gate: "high" | "low" | null;
} {
  const current = state();
  const groundingLabel =
    current.lastGrounding === null
      ? null
      : current.lastGrounding.tier === "proceed"
        ? ("high" as const)
        : ("low" as const);
  const gateLabel =
    current.lastGate === null
      ? null
      : current.lastGate.action === "pass"
        ? ("high" as const)
        : current.lastGate.action === "fail"
          ? ("low" as const)
          : null;
  return { grounding: groundingLabel, gate: gateLabel };
}

/* What the settings screen shows about this process: every number below is a
 * measurement taken from the packages above, in memory, since the process
 * started. Nothing here estimates and nothing here invents. */
export type IntelligenceSnapshot = {
  exchanges: number;
  telemetryFailures: number;
  failedSteps: string[];
  identity: {
    active: boolean;
    fingerprint: string;
    auditIntact: boolean;
    auditEvents: number;
  };
  inspection: {
    inspections: number;
    allowed: number;
    flagged: number;
    lastDecision: string | null;
    lastRiskScore: number | null;
  };
  drift: {
    status: string;
    behaviorScore: number;
    severity: string;
    findings: number;
  } | null;
  shifts: {
    latencyChangepoints: number;
    outputChangepoints: number;
  };
  trace: {
    spans: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  grounding: {
    score: number;
    tier: string;
    claims: number;
  } | null;
  gate: {
    observations: number;
    lastAction: string;
    lastStrength: string;
  } | null;
  memoryRecords: number;
  factGraph: {
    facts: number;
    entities: number;
    contradictions: number;
  };
  recordedEvents: number;
  tuner: {
    taskClass: string;
    cohort: string;
    reasoning: string;
  } | null;
  promptPlan: {
    calls: number;
    hitRatio: number;
    lintFindings: number;
  };
  money: {
    taskUsd: number;
    dayUsd: number;
    budgetConfigured: boolean;
  };
};

export async function intelligenceSnapshot(): Promise<IntelligenceSnapshot> {
  const current = state();

  const david = current.krikos.get(current.davidId);
  const customsStats = current.customs.stats();
  const totals = current.glass.totals();
  const factStats = current.facts.stats();
  const racsStats = current.racs.stats();
  const money = current.treasury.report();

  let memoryRecords = 0;
  try {
    memoryRecords = (await current.memory.query({ keyPrefix: "exchange/" }))
      .length;
  } catch {
    telemetryFailed(current, "memory-query");
  }

  return {
    exchanges: current.exchanges,
    telemetryFailures: current.telemetryFailures,
    failedSteps: [...current.failedSteps],
    identity: {
      active: david?.status === "active",
      fingerprint: david?.fingerprint ?? "",
      auditIntact: current.krikos.verifyAuditChain(),
      auditEvents: current.krikos.auditTrail().length,
    },
    inspection: {
      inspections: customsStats.inspections,
      allowed: customsStats.byDecision.allow,
      flagged: customsStats.byDecision.ask + customsStats.byDecision.block,
      lastDecision: current.lastVerdict?.decision ?? null,
      lastRiskScore: current.lastVerdict?.riskScore ?? null,
    },
    drift:
      current.lastDrift === null
        ? null
        : {
            status: current.lastDrift.status,
            behaviorScore: current.lastDrift.behaviorScore,
            severity: current.lastDrift.severity,
            findings: current.lastDrift.findings.length,
          },
    shifts: {
      latencyChangepoints: current.latencyChangepoints,
      outputChangepoints: current.outputChangepoints,
    },
    trace: {
      spans: current.glass.spans.length,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      costUsd: totals.costUsd,
    },
    grounding:
      current.lastGrounding === null
        ? null
        : {
            score: current.lastGrounding.score,
            tier: current.lastGrounding.tier,
            claims: current.lastGrounding.total,
          },
    gate:
      current.lastGate === null
        ? null
        : {
            observations: current.gateObservations,
            lastAction: current.lastGate.action,
            lastStrength: current.lastGate.strength,
          },
    memoryRecords,
    factGraph: {
      facts: factStats.currentFacts,
      entities: factStats.entities,
      contradictions: factStats.contradictions,
    },
    recordedEvents: current.stash.recording().events.length,
    tuner: current.lastRecommendation,
    promptPlan: {
      calls: racsStats.calls,
      hitRatio: racsStats.hitRatio,
      lintFindings: current.lastLintFindings,
    },
    money: {
      taskUsd: toUsd(money.taskMicros),
      dayUsd: toUsd(money.dayMicros),
      budgetConfigured: treasuryBudget() !== null,
    },
  };
}

/*
 * The calibrated reading of the records on disk, computed at render time from
 * the ledger of the day and from the capture runs. Five packages read the same
 * records the other screens already show and say what a count cannot: a
 * calibrated trust with its interval, a pooled comparison between models, a
 * forecast of the consumption of the day, the failure behaviour of the capture
 * and the ranked causes an incident template assigns to the day's evidence.
 */
export type IntelligenceReport = {
  day: string;
  modelCalls: number;
  trust: {
    subject: string;
    score: number;
    lower: number;
    upper: number;
    samples: number;
  }[];
  pooled: {
    tenant: string;
    mean: number;
    shrinkage: number;
    observations: number;
  }[];
  hourlyTokens: {
    method: string;
    nextHours: { at: number; mean: number }[];
  } | null;
  anomalousHours: number;
  captureRisk: {
    source: string;
    runs: number;
    failures: number;
    horizonMs: number;
    /* Null when no failure was ever recorded for the source: a probability
     * fitted over zero failures would be the prior speaking, not the data. */
    failureProbability: number | null;
  }[];
  causes: {
    variable: string;
    posterior: number;
    description: string;
  }[];
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const at = sorted[middle];
  return at ?? 0;
}

export async function intelligenceReport(): Promise<IntelligenceReport> {
  const current = state();
  const day = officeDay(new Date());
  const entries = await readDay(day);

  /* Only outcomes that say something about a model enter the trust reading:
   * an answer or a cache of one counts for it, an unavailability against it.
   * A refusal or a governance block is the office working, not the model. */
  const modelEntries = entries.filter(
    (entry) =>
      entry.outcome === "answered" ||
      entry.outcome === "cache-hit" ||
      entry.outcome === "unavailable",
  );

  const trust = createBayesTruth();
  const belief = new BetaHierarchy();
  for (const entry of modelEntries) {
    const success = entry.outcome !== "unavailable";
    trust.observe(entry.model, success);
    belief.observe(entry.model, success);
  }

  const trustScores = trust.scoreAll().map((score) => ({
    subject: score.subject,
    score: score.score,
    lower: score.interval.lower,
    upper: score.interval.upper,
    samples: score.samples,
  }));

  let pooled: IntelligenceReport["pooled"] = [];
  try {
    pooled = belief.pool().tenants.map((tenant) => ({
      tenant: tenant.tenant,
      mean: tenant.mean,
      shrinkage: tenant.shrinkage,
      observations: tenant.observations,
    }));
  } catch {
    /* Fewer models than the pooling needs: the row simply omits the pooled
     * reading, which is the honest display for it. */
  }

  let hourlyTokens: IntelligenceReport["hourlyTokens"] = null;
  let anomalousHours = 0;
  try {
    if (entries.length > 0) {
      const forecaster = createForecaster({ granularity: "hour" });
      forecaster.add(
        entries.map((entry) => ({
          at: Date.parse(entry.at),
          provider: entry.model,
          model: entry.model,
          feature: entry.screen,
          user: entry.lawyerId,
          inputTokens: entry.tokensIn,
          outputTokens: entry.tokensOut,
          cost: usdCost(entry.tokensIn, entry.tokensOut),
        })),
      );
      const projection = forecaster.forecast({ horizon: 6, metric: "tokens" });
      hourlyTokens = {
        method: projection.method,
        nextHours: projection.points.map((point) => ({
          at: point.at,
          mean: point.mean,
        })),
      };
      anomalousHours = forecaster
        .anomalies()
        .filter((point) => point.isAnomaly).length;
    }
  } catch {
    /* Not enough hours in the ledger to fit: the row says so. */
  }

  /* Each capture run is a life of its source: it starts, and it either fails
   * or stops healthy. The survival fit over the measured durations says how
   * probable a failure is within the median duration the office observed. */
  const captureRisk: IntelligenceReport["captureRisk"] = [];
  try {
    const runs = await listRuns();
    const sources = [...new Set(runs.map((run) => run.source))];
    for (const source of sources) {
      const ofSource = runs.filter((run) => run.source === source);
      const events = ofSource
        .flatMap((run) => [
          {
            component: run.id,
            kind: "start" as const,
            at: Date.parse(run.startedAt),
          },
          {
            component: run.id,
            kind: run.ok ? ("stop" as const) : ("failure" as const),
            at: Date.parse(run.finishedAt),
          },
        ])
        .sort((a, b) => a.at - b.at);
      const observations = foldEvents(events);
      if (observations.length === 0) {
        continue;
      }
      const durations = ofSource.map((run) =>
        Math.max(1, Date.parse(run.finishedAt) - Date.parse(run.startedAt)),
      );
      const horizonMs = Math.max(1, median(durations));
      const failures = ofSource.filter((run) => !run.ok).length;
      /* With zero failures the fit would only echo its prior, so no
       * probability is reported: the counts speak and the estimate waits. */
      let probability: number | null = null;
      if (failures > 0) {
        const fit = fitSurvival(observations);
        const projection = forecast(fit.posterior, { horizons: [horizonMs] });
        probability =
          projection.failureProbabilityByHorizon[0]?.probability ?? null;
      }
      captureRisk.push({
        source,
        runs: ofSource.length,
        failures,
        horizonMs,
        failureProbability: probability,
      });
    }
  } catch {
    /* A source without a foldable history is left out of the list. */
  }

  /* The incident template of the causal package, with only the evidence the
   * office measured today: the error rate of the model calls, the anomaly
   * reading of the consumption and the grounding of the last answer of this
   * process. What was not measured is not observed, and the ranking is the
   * advisory reading of what would explain the evidence. */
  let causes: IntelligenceReport["causes"] = [];
  try {
    const network = createNetwork({ nodes: imServingIncident() });
    const liveCalls = modelEntries.filter(
      (entry) => entry.outcome !== "cache-hit",
    );
    if (liveCalls.length > 0) {
      const failures = liveCalls.filter(
        (entry) => entry.outcome === "unavailable",
      ).length;
      network.observe("ErrorRate", failures > 0 ? "high" : "normal");
    }
    network.observe("CostAnomaly", anomalousHours > 0 ? "yes" : "no");
    if (current.lastGrounding !== null) {
      network.observe(
        "OutputQuality",
        current.lastGrounding.tier === "proceed" ? "ok" : "low",
      );
    }
    causes = network
      .diagnose()
      .ranked.slice(0, 3)
      .map((cause) => ({
        variable: cause.variable,
        posterior: cause.posterior,
        description: cause.description ?? cause.variable,
      }));
  } catch {
    /* Without a diagnosable evidence set the causes row is omitted. */
  }

  return {
    day,
    modelCalls: modelEntries.length,
    trust: trustScores,
    pooled,
    hourlyTokens,
    anomalousHours,
    captureRisk,
    causes,
  };
}
