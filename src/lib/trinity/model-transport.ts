import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createBayesRoute } from "@takk/bayesroute";
import type { ProviderAdapter as KeymeshProviderAdapter } from "@takk/keymesh";
import { createKeymesh } from "@takk/keymesh";
import {
  createModelchain,
  type ModelchainRouter,
  type ModelDefinition,
} from "@takk/modelchain";
import { anthropicModel, geminiModel } from "@takk/modelchain/providers";
import type {
  ChatMessage,
  GenerateRequest,
  GenerateResponse,
  LlmAdapter,
} from "@teleologyhi-sdk/nhe";
import { parse } from "yaml";
import { TRINITY_ROOT } from "@/lib/trinity/store-paths";
import { writeYamlAtomic } from "@/lib/trinity/yaml-store";

/*
 * The transport of the body of this office: the layer between the NHE adapter
 * contract and the model providers.
 *
 * Three packages of the @takk family compose here, each doing the one thing it
 * was written for. `@takk/keymesh` owns the credentials: every provider has a
 * pool of keys read from the environment, and keymesh rotates them, opens a
 * circuit on a key that keeps failing, and isolates a key the provider refuses.
 * `@takk/modelchain` owns the call: it speaks to Anthropic and Gemini over
 * their public REST APIs, retries transient failures, opens a circuit per
 * model, enforces a money ceiling per request and per day, and reports which
 * model answered. `@takk/bayesroute` keeps the calibrated posterior of each
 * model over the observed quality, latency and cost; the order between models
 * is not its to choose, because the director fixed it on 2026-08-18: Gemini
 * answers by default and Claude takes over when no Gemini key works.
 *
 * Governance is not here. MAIC decides before this file is reached and the
 * output guards run after it; this file only carries a request that was already
 * allowed to a provider that is currently healthy.
 */

const OFFICE_AGENT_ID = "david";

/*
 * The default Gemini model reasons before it writes and the reasoning spends
 * output tokens inside the same cap. Measured on 2026-08-21: with the office
 * cap the answers were cut mid-sentence, and the second reading flagged it;
 * with this floor the same question completed. GEMINI_MAX_OUTPUT_TOKENS, when
 * set, replaces the floor entirely.
 */
const GEMINI_REASONING_FLOOR = 2_048;

function maxTokensFor(provider: TransportProvider, requested: number): number {
  if (provider !== "gemini") {
    return requested;
  }
  const configured = Number.parseInt(
    process.env.GEMINI_MAX_OUTPUT_TOKENS?.trim() ?? "",
    10,
  );
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return Math.max(requested, GEMINI_REASONING_FLOOR);
}

/* Where the routing posterior survives a restart, next to the other records
 * of the generation, written atomically like every record of this office. */
const ROUTING_FILE = path.join(TRINITY_ROOT, "routing.yaml");

/* One domain for now: the order between models is fixed by the director, so
 * the posterior measures each model as a whole instead of steering by topic. */
const ROUTING_DOMAIN = "default";

/* Persist the posterior after every observation. A failure to persist never
 * fails the answer; it is telemetry, and the next observation tries again. */
function savePosterior(route: { snapshot: () => unknown }): void {
  void writeYamlAtomic(ROUTING_FILE, route.snapshot()).catch(() => {});
}

/* Which provider a model id belongs to, so the ledger and the screen can name
 * the provider without parsing the id. */
export type TransportProvider = "anthropic" | "gemini";

export type TransportModel = {
  provider: TransportProvider;
  modelId: string;
};

/* Every answer the transport produces carries the model that really produced
 * it, because the ledger writes it and the lawyer reads it. */
export type TransportOutcome = {
  provider: TransportProvider;
  modelId: string;
  latencyMs: number;
  costUsd: number;
  explored: boolean;
};

/*
 * A pool of keys for one provider. The environment carries the singular key
 * and the plural list; both are honoured, deduplicated, and a list left empty
 * means the provider is not configured, which the transport says out loud.
 */
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

/*
 * The client keymesh wraps is the key itself, exposed through one method, so
 * that every provider call runs under a key keymesh picked and every failure
 * is charged to that key. keymesh only rotates on the errors it can classify,
 * so the detector reads the status a provider left on the error.
 */
type KeyClient = { withKey<T>(run: (key: string) => Promise<T>): Promise<T> };

const keyAdapter: KeymeshProviderAdapter<KeyClient, void> = {
  name: "advprev-key-pool",
  createClient(key) {
    return { withKey: (run) => run(key) };
  },
  detectError(err) {
    const status = statusOf(err);
    return {
      status,
      isTransient:
        status === undefined
          ? /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|fetch failed|aborted/i.test(
              String(err instanceof Error ? err.message : err),
            )
          : status === 408 || status === 425 || status === 429 || status >= 500,
      message: err instanceof Error ? err.message : String(err),
    };
  },
};

/*
 * The status a provider left on the error. modelchain wraps the provider
 * failure and names its class in the message; when a numeric status is not
 * attached, the class is mapped to the status keymesh understands, so a
 * refused key is isolated and a rate-limited key rotates, exactly as the two
 * packages promise. Measured on 2026-08-15: a Gemini key with denied access
 * arrives as `unauthorized`, and an exhausted quota as `rate-limited`.
 */
function statusOf(err: unknown): number | undefined {
  if (err !== null && typeof err === "object" && "status" in err) {
    const value = (err as { status: unknown }).status;
    if (typeof value === "number") {
      return value;
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/\bunauthorized\b/.test(message)) {
    return 401;
  }
  if (/\brate-limited\b/.test(message)) {
    return 429;
  }
  if (/\bserver-error\b/.test(message)) {
    return 503;
  }
  if (/\btimeout\b/.test(message)) {
    return 408;
  }
  if (/\bbad-request\b/.test(message)) {
    return 400;
  }
  return undefined;
}

type KeyPool = KeyClient & {
  inspect: () => {
    keys: readonly { circuitState: string; cooldownUntil: number }[];
  };
  close: () => Promise<void>;
};

/* Keys the pool would still pick right now: circuit not open and not cooling. */
function eligibleKeys(pool: KeyPool): number {
  const now = Date.now();
  return pool
    .inspect()
    .keys.filter(
      (key) => key.circuitState !== "open" && key.cooldownUntil <= now,
    ).length;
}

function poolOf(keys: string[]): KeyPool | null {
  if (keys.length === 0) {
    return null;
  }
  return createKeymesh<KeyClient, void>({
    provider: keyAdapter,
    keys,
    strategy: "least-used",
    circuitBreaker: { threshold: 3, cooldownMs: 30_000 },
    retry: { max: keys.length, baseMs: 200, jitter: true },
    telemetry: { enabled: true },
  }) as KeyPool;
}

/*
 * The price of each model, in dollars per thousand tokens, read from the
 * environment. modelchain needs a cost profile to route by cost and to enforce
 * a money ceiling; when the office has not configured a price, the profile is
 * zero and the router still works, but no money is estimated, which is the
 * rule of this office: an invented price is an invented number.
 */
function pricePer1k(name: string): number {
  const perMillion = Number.parseFloat(process.env[name]?.trim() ?? "");
  return Number.isFinite(perMillion) && perMillion > 0 ? perMillion / 1000 : 0;
}

function optionalUsd(name: string): number | undefined {
  const value = Number.parseFloat(process.env[name]?.trim() ?? "");
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export type TransportConfig = {
  models: TransportModel[];
  reason: string;
};

/*
 * Which models this office runs, in the order they are tried. By the
 * director's decision of 2026-08-18, Gemini answers by default and Claude
 * takes over automatically only when no Gemini key works. A provider with no
 * key is left out and named in the reason, never silently dropped, so the
 * screen can say why only one model is answering.
 */
export function transportConfig(): TransportConfig {
  const models: TransportModel[] = [];
  const missing: string[] = [];

  const geminiKeys = keysOf(
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEYS,
  );
  /* Measured against the live service on 2026-08-15 with the keys of the
   * office: the 2.x and 3.0 families answer 404 as discontinued, 3.1 Pro
   * answers 429 with a zero quota on every key, and 3.6 Flash answers 200 on
   * four of the five keys, in Brazilian Portuguese, in about two seconds. */
  const geminiModelId = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  if (geminiKeys.length > 0) {
    models.push({ provider: "gemini", modelId: geminiModelId });
  } else {
    missing.push("Gemini sem chave configurada");
  }

  const anthropicKeys = keysOf(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEYS,
  );
  const anthropicModelId =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-6";
  if (anthropicKeys.length > 0) {
    models.push({ provider: "anthropic", modelId: anthropicModelId });
  } else {
    missing.push("Anthropic sem chave configurada");
  }

  return {
    models,
    reason:
      missing.length === 0
        ? "O Gemini responde por padrão e o Claude assume automaticamente quando nenhuma chave do Gemini funciona."
        : `${missing.join("; ")}. Apenas ${models.map((m) => m.modelId).join(", ")} responde.`,
  };
}

/*
 * A single object of the process holds the router, the pools and the routing
 * posterior, because the posterior is what learns across requests. The
 * development server reloads modules and the universe survives on the global
 * object; the same is done here so learning is not thrown away on reload.
 */
type TransportState = {
  routers: Map<string, ModelchainRouter>;
  route: ReturnType<typeof createBayesRoute>;
  pools: Record<TransportProvider, KeyPool | null>;
  providerOf: Map<string, TransportProvider>;
  config: TransportConfig;
  /* The key of the attempt in flight, per provider. The key resolvers built at
   * boot read this slot; the pool fills it right before each provider call. */
  keySlot: Record<TransportProvider, string>;
};

const STATE_KEY = "__advprev_model_transport__";

function buildState(): TransportState {
  const config = transportConfig();
  const pools: Record<TransportProvider, KeyPool | null> = {
    anthropic: poolOf(
      keysOf(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_API_KEYS),
    ),
    gemini: poolOf(
      keysOf(process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEYS),
    ),
  };
  const providerOf = new Map<string, TransportProvider>();
  const definitions: ModelDefinition[] = [];

  /* The key resolver of modelchain is called once per attempt, and keymesh
   * needs the attempt to run under the key it picked. So the key travels
   * through a per-attempt slot filled by the pool right before the call. */
  const keySlot: Record<TransportProvider, string> = {
    anthropic: "",
    gemini: "",
  };

  for (const model of config.models) {
    providerOf.set(model.modelId, model.provider);
    if (model.provider === "anthropic") {
      definitions.push(
        anthropicModel(model.modelId, {
          cost: {
            costPer1kInput: pricePer1k("IM_PRICE_INPUT_PER_MTOK"),
            costPer1kOutput: pricePer1k("IM_PRICE_OUTPUT_PER_MTOK"),
          },
          keys: () => keySlot.anthropic,
          capabilities: ["tools", "streaming"],
        }),
      );
    } else {
      definitions.push(
        geminiModel(model.modelId, {
          cost: {
            costPer1kInput: pricePer1k("IM_PRICE_GEMINI_INPUT_PER_MTOK"),
            costPer1kOutput: pricePer1k("IM_PRICE_GEMINI_OUTPUT_PER_MTOK"),
          },
          keys: () => keySlot.gemini,
          capabilities: ["streaming"],
        }),
      );
    }
  }

  /* The posterior of BayesRoute no longer chooses the model, because the
   * director fixed the order: Gemini by default, Claude on failure. It keeps
   * observing every outcome, so the screen shows a calibrated quality,
   * latency and cost per model instead of a bare count, and it survives a
   * restart: the snapshot is loaded here and saved after every observation. */
  const route = createBayesRoute({
    models: config.models.map((model) => model.modelId),
    weights: { quality: 0.6, latency: 0.15, cost: 0.25 },
    audit: true,
  });
  try {
    const raw = readFileSync(ROUTING_FILE, "utf8");
    const parsed = parse(raw) as Parameters<typeof route.load>[0] | null;
    if (parsed !== null) {
      route.load(parsed);
    }
  } catch {
    /* First boot of this generation: there is no posterior yet. */
  }

  const perRequestUsd = optionalUsd("IM_BUDGET_PER_REQUEST_USD");
  const dailyUsd = optionalUsd("IM_BUDGET_PER_DAY_USD");
  const budget =
    perRequestUsd === undefined && dailyUsd === undefined
      ? undefined
      : {
          ...(perRequestUsd === undefined ? {} : { perRequestUsd }),
          ...(dailyUsd === undefined ? {} : { dailyUsd }),
        };

  /* One router per model. The choice between models belongs to BayesRoute and
   * the choice between keys belongs to keymesh; a router that could fail over
   * to another model inside one attempt would hide the failure of a key from
   * the pool that owns it. Each router keeps its own circuit, retry with
   * backoff, money ceiling and scorers, and its own inspection. */
  const routers = new Map<string, ModelchainRouter>();
  for (const definition of definitions) {
    routers.set(
      String(definition.id),
      createModelchain({
        models: [definition],
        strategy: "sequential-fallback",
        retry: { max: 1, baseMs: 300, jitter: true },
        circuitBreaker: { threshold: 3, cooldownMs: 30_000 },
        fallback: { onError: "fail" },
        scoring: { built: ["latency", "token-budget"] },
        ...(budget === undefined ? {} : { budget }),
        telemetry: { enabled: true },
      }),
    );
  }

  return { routers, route, pools, providerOf, config, keySlot };
}

function state(): TransportState {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[STATE_KEY];
  if (existing !== undefined) {
    return existing as TransportState;
  }
  const built = buildState();
  scope[STATE_KEY] = built;
  return built;
}

/* The NHE hands the turns as chat messages; the providers want one prompt with
 * the system channel apart. The last user turn is the prompt and the earlier
 * turns are folded into it in order, labelled, so nothing said before is lost. */
function promptOf(messages: ChatMessage[]): string {
  const lines: string[] = [];
  for (const message of messages) {
    const label = message.role === "assistant" ? "Assistente" : "Advogado";
    lines.push(`${label}: ${message.content}`);
  }
  return lines.join("\n\n");
}

/*
 * The adapter the body of the office uses. It implements the NHE contract, so
 * the office adapter that carries the records of the office wraps it exactly
 * as it wrapped the single-provider adapter, and nothing above this file knows
 * that two providers exist.
 */
export class ModelTransportAdapter implements LlmAdapter {
  readonly id = "advprev-model-transport";
  readonly supportsTools = false;
  readonly supportsStreaming = false;

  private readonly maxOutputTokens: number;
  private lastOutcome: TransportOutcome | null = null;

  constructor(options: { defaultMaxOutputTokens: number }) {
    this.maxOutputTokens = options.defaultMaxOutputTokens;
  }

  /* What answered the last request of this adapter instance. Read by the
   * caller right after `generate` returns, in the same async flow. */
  outcome(): TransportOutcome | null {
    return this.lastOutcome;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const current = state();
    if (current.config.models.length === 0) {
      throw new Error(
        "Nenhum provedor de modelo está configurado. Defina ANTHROPIC_API_KEYS ou GEMINI_API_KEYS no ambiente.",
      );
    }
    const prompt = promptOf(req.messages);

    /* The order is the director's decision of 2026-08-18, fixed in the
     * configuration: Gemini answers by default, and Claude takes over only
     * when Gemini produced no answer with any of its keys. The posterior
     * observes every outcome but never reorders this. */
    const order = current.config.models.map((entry) => entry.modelId);
    let response: Awaited<ReturnType<ModelchainRouter["complete"]>> | null =
      null;
    let lastError: unknown = null;
    for (const modelId of order) {
      const provider = current.providerOf.get(modelId) ?? "anthropic";
      const pool = current.pools[provider];
      const router = current.routers.get(modelId);
      if (pool === null || router === undefined) {
        continue;
      }
      const startedAt = Date.now();
      const call = () =>
        pool.withKey(async (key) => {
          setCurrentKey(current, provider, key);
          return router.complete({
            prompt,
            system: req.system,
            maxTokens: maxTokensFor(
              provider,
              req.maxOutputTokens ?? this.maxOutputTokens,
            ),
            metadata: { agent: OFFICE_AGENT_ID },
          });
        });
      try {
        try {
          response = await call();
        } catch (error) {
          /* keymesh isolates a refused key and surfaces the refusal without
           * trying the next key in the same call, by design. Measured on
           * 2026-08-15: one of the two Anthropic keys of the office answers
           * "API key is invalid". The pool has already cooled that key, so one
           * more call on the same model runs on a key that is still eligible,
           * and only then does the failure count against the model. */
          if (statusOf(error) === 401 && eligibleKeys(pool) > 0) {
            response = await call();
          } else {
            throw error;
          }
        }
        break;
      } catch (error) {
        lastError = error;
        current.route.observe(modelId, ROUTING_DOMAIN, {
          quality: "rejected",
          latencyMs: Math.max(1, Date.now() - startedAt),
          cost: routingCost(0, 0),
        });
        savePosterior(current.route);
      }
    }
    if (response === null) {
      throw lastError instanceof Error
        ? lastError
        : new Error("Nenhum provedor de modelo respondeu.");
    }

    const answeredProvider =
      current.providerOf.get(response.modelId) ?? "anthropic";
    const costUsd = costOf(
      current,
      response.modelId,
      response.usage.inputTokens,
      response.usage.outputTokens,
    );
    /* The router learns from tokens when the office has not priced the model,
     * because a posterior over cost needs a positive quantity and tokens are
     * the quantity the office always measures. Money on screen stays honest:
     * only `costUsd` is shown, and it is zero without a configured price. */
    current.route.observe(response.modelId, ROUTING_DOMAIN, {
      quality:
        response.finishReason === "stop" || response.finishReason === "length",
      latencyMs: Math.max(1, response.latencyMs),
      cost:
        costUsd > 0
          ? costUsd
          : routingCost(
              response.usage.inputTokens,
              response.usage.outputTokens,
            ),
    });
    savePosterior(current.route);
    this.lastOutcome = {
      provider: answeredProvider,
      modelId: response.modelId,
      latencyMs: response.latencyMs,
      costUsd,
      explored: false,
    };
    return {
      text: response.text,
      tokensIn: response.usage.inputTokens,
      tokensOut: response.usage.outputTokens,
    };
  }
}

/* Tokens as the routing cost when there is no price: a positive number in the
 * same order of magnitude across providers, so the posterior compares like
 * with like. Never shown as money. */
function routingCost(inputTokens: number, outputTokens: number): number {
  return Math.max(1, inputTokens + outputTokens * 4) / 1_000_000;
}

function setCurrentKey(
  current: TransportState,
  provider: TransportProvider,
  key: string,
): void {
  current.keySlot[provider] = key;
}

/* Cost from the office's own price configuration, never from a table shipped
 * inside a package that would go stale. Zero when the price is not set. */
function costOf(
  current: TransportState,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const provider = current.providerOf.get(modelId);
  const input =
    provider === "gemini"
      ? pricePer1k("IM_PRICE_GEMINI_INPUT_PER_MTOK")
      : pricePer1k("IM_PRICE_INPUT_PER_MTOK");
  const output =
    provider === "gemini"
      ? pricePer1k("IM_PRICE_GEMINI_OUTPUT_PER_MTOK")
      : pricePer1k("IM_PRICE_OUTPUT_PER_MTOK");
  return (inputTokens / 1000) * input + (outputTokens / 1000) * output;
}

/* What the settings screen shows: the models in the pool, the routing
 * posterior of each, and the state of the key pools, with no key value ever
 * included, exactly as the packages themselves promise. */
export function transportSnapshot(): {
  config: TransportConfig;
  models: {
    id: string;
    provider: TransportProvider;
    circuitState: string;
    successCount: number;
    failureCount: number;
    avgLatencyMs: number;
    totalCostUsd: number;
  }[];
  routing: ReturnType<ReturnType<typeof createBayesRoute>["summary"]>;
  keys: Record<TransportProvider, number>;
} {
  const current = state();
  const models = [...current.routers.values()].flatMap((router) =>
    router.inspect().models.map((model) => ({
      id: model.id,
      provider: current.providerOf.get(model.id) ?? ("anthropic" as const),
      circuitState: model.circuitState,
      successCount: model.successCount,
      failureCount: model.failureCount,
      avgLatencyMs: model.avgLatencyMs,
      totalCostUsd: model.totalCostUsd,
    })),
  );
  return {
    config: current.config,
    models,
    routing: current.route.summary(),
    keys: {
      anthropic: current.pools.anthropic?.inspect().keys.length ?? 0,
      gemini: current.pools.gemini?.inspect().keys.length ?? 0,
    },
  };
}
