import "server-only";
import type { ProviderAdapter as KeymeshProviderAdapter } from "@takk/keymesh";
import { createKeymesh } from "@takk/keymesh";
import { z } from "zod";

/*
 * The live research of the body: when a question asks for the world outside
 * the records of the office, the server searches Exa and Tavily, both at
 * once, and the results enter the governed context exactly like the document
 * passages do, before MAIC reviews the request and before the model is
 * reached. The model receives text and origins and is instructed to cite
 * them; it never browses and it never decides what to search, because the
 * trigger below is a deterministic rule over the question.
 *
 * Three rules of the constitution bind this file. Every call runs on the
 * server, behind the server-only guard. The query is minimized before it
 * leaves the office: full client names, personal identifier patterns and
 * process numbers are removed, and the block says so when it happened. And a
 * search result is support, never a source of a deadline, which the block
 * states in the words the model receives.
 *
 * Keys come from the environment through @takk/keymesh pools, one per
 * provider, with rotation and isolation of refused keys. A provider with no
 * key configured is skipped and named honestly in the block, never silently
 * dropped, because the office does not pretend to have searched what it
 * could not search.
 */

const EXA_ENDPOINT = "https://api.exa.ai/search";
const TAVILY_ENDPOINT = "https://api.tavily.com/search";

const RESULTS_PER_PROVIDER = 4;
const SNIPPET_CHARS = 600;
const QUERY_MAX_CHARS = 300;
const SEARCH_TIMEOUT_MS = 12_000;

/*
 * When the office searches. The rule is deliberately conservative: an
 * explicit request to research, or a topic that only the world outside the
 * records can answer, with the recency the lawyer asked for. A question about
 * a case, a deadline or a document never leaves the office by itself.
 */
const EXPLICIT_SEARCH =
  /\b(pesquis\w*|busqu\w*|procur\w+ (na|no|em) (internet|web|rede)|na internet|na web|em tempo real|fontes? externas?|google)\b/i;

const EXTERNAL_TOPICS =
  /\b(not[íi]cias?|jurisprud[êe]nc\w*|s[úu]mulas? (nova|novas|recente|recentes)|sal[áa]rio m[íi]nimo|teto (do inss|previdenci[áa]rio)|reajuste|inpc|igp-?m?|[íi]ndice de corre[çc][ãa]o|legisla[çc][ãa]o (nova|recente|atualizada)|lei (nova|recente|sancionada))\b/i;

export function questionNeedsLiveSearch(question: string): boolean {
  return EXPLICIT_SEARCH.test(question) || EXTERNAL_TOPICS.test(question);
}

/* CPF with or without punctuation, CNJ process numbers, electronic addresses
 * and telephone shapes: none of them belongs in a query to an external
 * service, whatever the question was. */
const IDENTIFIER_PATTERNS: RegExp[] = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  /\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/g,
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g,
];

export function minimizeQuery(
  question: string,
  clientNames: readonly string[],
): { query: string; minimized: boolean } {
  let query = question;
  let minimized = false;
  for (const name of clientNames) {
    const trimmed = name.trim();
    if (trimmed.length < 8) {
      continue;
    }
    const pattern = new RegExp(
      trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi",
    );
    if (pattern.test(query)) {
      query = query.replace(pattern, "");
      minimized = true;
    }
  }
  for (const pattern of IDENTIFIER_PATTERNS) {
    if (pattern.test(query)) {
      query = query.replace(pattern, "");
      minimized = true;
    }
  }
  query = query.replace(/\s+/g, " ").trim().slice(0, QUERY_MAX_CHARS);
  return { query, minimized };
}

export type SearchResult = {
  provider: "exa" | "tavily";
  title: string;
  url: string;
  publishedDate: string | null;
  snippet: string;
};

/* Every payload from an external service is validated before it is used,
 * mandatory standard two: an unexpected shape is a failed search, never an
 * exception and never a guess. */
const exaResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string().nullish(),
      url: z.string(),
      publishedDate: z.string().nullish(),
      text: z.string().nullish(),
    }),
  ),
});

const tavilyResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string().nullish(),
      url: z.string(),
      published_date: z.string().nullish(),
      content: z.string().nullish(),
    }),
  ),
});

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

type KeyClient = { withKey<T>(run: (key: string) => Promise<T>): Promise<T> };

const keyAdapter: KeymeshProviderAdapter<KeyClient, void> = {
  name: "advprev-search-pool",
  createClient(key) {
    return { withKey: (run) => run(key) };
  },
  detectError(err) {
    const status =
      err !== null && typeof err === "object" && "status" in err
        ? Number((err as { status: unknown }).status)
        : undefined;
    return {
      ...(status === undefined ? {} : { status }),
      isTransient:
        status === undefined
          ? /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|fetch failed|abort/i.test(
              String(err instanceof Error ? err.message : err),
            )
          : status === 408 || status === 429 || status >= 500,
      message: err instanceof Error ? err.message : String(err),
    };
  },
};

type KeyPool = KeyClient & { close: () => Promise<void> };

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
  }) as KeyPool;
}

type SearchState = {
  exa: KeyPool | null;
  tavily: KeyPool | null;
};

const STATE_KEY = "__advprev_live_search__";

function state(): SearchState {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[STATE_KEY];
  if (existing !== undefined) {
    return existing as SearchState;
  }
  const built: SearchState = {
    exa: poolOf(keysOf(process.env.EXA_API_KEY, process.env.EXA_API_KEYS)),
    tavily: poolOf(
      keysOf(process.env.TAVILY_API_KEY, process.env.TAVILY_API_KEYS),
    ),
  };
  scope[STATE_KEY] = built;
  return built;
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw Object.assign(
      new Error(`search service answered ${response.status}`),
      {
        status: response.status,
      },
    );
  }
  return response.json();
}

async function searchExa(
  pool: KeyPool,
  query: string,
): Promise<SearchResult[]> {
  return pool.withKey(async (key) => {
    const raw = await postJson(
      EXA_ENDPOINT,
      { "x-api-key": key },
      {
        query,
        numResults: RESULTS_PER_PROVIDER,
        contents: { text: { maxCharacters: SNIPPET_CHARS } },
      },
    );
    const parsed = exaResponseSchema.parse(raw);
    return parsed.results.map((entry) => ({
      provider: "exa" as const,
      title: entry.title?.trim() || entry.url,
      url: entry.url,
      publishedDate: entry.publishedDate ?? null,
      snippet: (entry.text ?? "").slice(0, SNIPPET_CHARS),
    }));
  });
}

async function searchTavily(
  pool: KeyPool,
  query: string,
): Promise<SearchResult[]> {
  return pool.withKey(async (key) => {
    const raw = await postJson(
      TAVILY_ENDPOINT,
      { Authorization: `Bearer ${key}` },
      { query, max_results: RESULTS_PER_PROVIDER, include_answer: false },
    );
    const parsed = tavilyResponseSchema.parse(raw);
    return parsed.results.map((entry) => ({
      provider: "tavily" as const,
      title: entry.title?.trim() || entry.url,
      url: entry.url,
      publishedDate: entry.published_date ?? null,
      snippet: (entry.content ?? "").slice(0, SNIPPET_CHARS),
    }));
  });
}

export type LiveSearch = {
  /* Empty when the question does not call for a search. */
  block: string;
  results: SearchResult[];
  providersTried: string[];
  providersFailed: string[];
  providersMissingKey: string[];
  minimized: boolean;
};

const EMPTY: LiveSearch = {
  block: "",
  results: [],
  providersTried: [],
  providersFailed: [],
  providersMissingKey: [],
  minimized: false,
};

export async function liveSearchBlock(
  question: string,
  clientNames: readonly string[],
): Promise<LiveSearch> {
  if (!questionNeedsLiveSearch(question)) {
    return EMPTY;
  }
  const current = state();
  const { query, minimized } = minimizeQuery(question, clientNames);
  if (query.length < 3) {
    return EMPTY;
  }

  const providersTried: string[] = [];
  const providersFailed: string[] = [];
  const providersMissingKey: string[] = [];
  const tasks: Promise<SearchResult[]>[] = [];

  if (current.exa === null) {
    providersMissingKey.push("Exa");
  } else {
    providersTried.push("Exa");
    tasks.push(searchExa(current.exa, query));
  }
  if (current.tavily === null) {
    providersMissingKey.push("Tavily");
  } else {
    providersTried.push("Tavily");
    tasks.push(searchTavily(current.tavily, query));
  }

  const settled = await Promise.allSettled(tasks);
  const results: SearchResult[] = [];
  settled.forEach((outcome, index) => {
    const provider = providersTried[index] ?? "desconhecido";
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      providersFailed.push(provider);
    }
  });

  const header: string[] = [];
  if (results.length > 0) {
    header.push(
      `RESULTADOS DE PESQUISA EM TEMPO REAL (${results.length} ${results.length === 1 ? "resultado" : "resultados"}, ${[...new Set(results.map((r) => (r.provider === "exa" ? "Exa" : "Tavily")))].join(" e ")}):`,
      "A pesquisa foi executada pelo servidor do escritório, nunca pelo navegador.",
    );
  } else {
    header.push("PESQUISA EM TEMPO REAL:");
  }
  if (minimized) {
    header.push(
      "Identificadores diretos foram removidos da consulta antes de ela sair do escritório, por minimização.",
    );
  }
  if (providersFailed.length > 0) {
    header.push(
      `${providersFailed.join(" e ")} ${providersFailed.length === 1 ? "falhou" : "falharam"} nesta consulta. Diga isso ao advogado se a resposta depender do que faltou.`,
    );
  }
  if (providersMissingKey.length > 0) {
    header.push(
      `${providersMissingKey.join(" e ")} ${providersMissingKey.length === 1 ? "está sem chave configurada" : "estão sem chave configurada"} nesta instalação, então ${providersMissingKey.length === 1 ? "não foi consultado" : "não foram consultados"}.`,
    );
  }
  if (
    results.length === 0 &&
    providersTried.length > 0 &&
    providersFailed.length === 0
  ) {
    header.push(
      "A pesquisa executou e não trouxe resultado para esta consulta. Diga isso ao advogado e não presuma conteúdo.",
    );
  }
  header.push(
    "Ao usar qualquer resultado, cite o título, o endereço e a data quando houver. Resultado de pesquisa é apoio e nunca é fonte de prazo: prazo nasce da intimação publicada no Diário de Justiça Eletrônico Nacional.",
  );

  const lines = results.map((result, index) => {
    const date = result.publishedDate ? `, ${result.publishedDate}` : "";
    const origin = result.provider === "exa" ? "Exa" : "Tavily";
    return `[${index + 1}] ${result.title} | ${result.url}${date} | via ${origin}\n${result.snippet}`;
  });

  return {
    block: [header.join(" "), "", ...lines].join("\n").trim(),
    results,
    providersTried,
    providersFailed,
    providersMissingKey,
    minimized,
  };
}
