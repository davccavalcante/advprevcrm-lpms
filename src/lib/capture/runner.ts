import "server-only";
import { createRuntime, defineWorkflow } from "@takk/alkaline";
import { createRetryPolicy } from "@takk/bayesretry";
import type { Communication } from "@/lib/capture/communication";
import { activeOabs, captureWindowDays } from "@/lib/capture/config";
import { fetchDjen, normaliseCommunication } from "@/lib/capture/djen-client";
import { extractAct } from "@/lib/capture/extraction";
import { resolveLink } from "@/lib/capture/linking";
import { recordRun } from "@/lib/capture/runs";
import { storeIfNew } from "@/lib/capture/store";
import { addDays } from "@/lib/deadlines/calendar";
import { listAllCases } from "@/lib/records-store";

/*
 * The scheduled routine. The DJEN is a consultation and not a notification: it
 * never warns the office that a publication came out, so the office asks, every
 * day, for every watched registration.
 *
 * A failed attempt is retried with a growing wait, because a refusal at a peak
 * hour is ordinary and an aggressive retry makes it worse. Every attempt, and
 * the reason it failed, is written to the execution log that feeds the health
 * panel.
 */

const BACKOFF_MS = [0, 2_000, 8_000, 30_000];

/*
 * The calibrated retry policy of the capture (@takk/bayesretry). It learns,
 * per source, how often a retry after each kind of failure actually succeeds,
 * and decides whether one more attempt is worth the wait. The office keeps its
 * own bounds around that decision: the first retry always runs, the ladder
 * above stays the ceiling, and the wait is never shorter than the measured
 * ladder step, so a peak-hour refusal is never hammered faster than before.
 */
type RetryPolicy = ReturnType<typeof createRetryPolicy>;

const RETRY_KEY = "__advprev_capture_retry__";

function retryPolicy(): RetryPolicy {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[RETRY_KEY];
  if (existing !== undefined) {
    return existing as RetryPolicy;
  }
  const built = createRetryPolicy({ maxAttempts: BACKOFF_MS.length });
  scope[RETRY_KEY] = built;
  return built;
}

/* The failure class the posterior learns from, read off the response the
 * source actually gave. */
function failureType(status: number | null): string {
  if (status === null) {
    return "network";
  }
  if (status === 429) {
    return "rate-limited";
  }
  if (status >= 500) {
    return "server-error";
  }
  return `status-${status}`;
}

/* How many acts the office asks for at a time, and how many pages a single run
 * may read. Measured on 2026-08-12: the service honours `itensPorPagina` with a
 * floor of five, so a hundred is one round trip per hundred acts. */
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type CaptureOutcome = {
  ok: boolean;
  reason: string | null;
  found: number;
  stored: number;
  duplicates: number;
  linked: number;
  suggested: number;
  unlinked: number;
  attempts: number;
  requestUrl: string;
  status: number | null;
};

/*
 * Every capture runs as a durable execution (@takk/alkaline): the run is a
 * named workflow whose step journal, status and failure are queryable records,
 * so a run is never a bare function call that vanishes when it throws. The
 * store is in memory in this phase, like every state of this process, and
 * moves to the database cell when the office gains one; the execution log on
 * disk, written by `recordRun`, remains the record the health panel reads.
 */
type CaptureWorkflowInput = {
  from: string | null;
  to: string | null;
  nowMs: number | null;
  maxAttempts: number | null;
};

const captureWorkflow = defineWorkflow<CaptureWorkflowInput, CaptureOutcome>({
  name: "djen-capture",
  handler: (ctx, input) =>
    ctx.step("djen-run", () =>
      executeDjenCapture({
        ...(input.from === null ? {} : { from: input.from }),
        ...(input.to === null ? {} : { to: input.to }),
        ...(input.nowMs === null ? {} : { now: new Date(input.nowMs) }),
        ...(input.maxAttempts === null
          ? {}
          : { maxAttempts: input.maxAttempts }),
      }),
    ),
});

type CaptureRuntime = ReturnType<typeof createRuntime>;

const RUNTIME_KEY = "__advprev_capture_runtime__";

function captureRuntime(): CaptureRuntime {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[RUNTIME_KEY];
  if (existing !== undefined) {
    return existing as CaptureRuntime;
  }
  const built = createRuntime();
  built.register(captureWorkflow);
  scope[RUNTIME_KEY] = built;
  return built;
}

/*
 * One run over one registration, as a durable execution. The window is the
 * last days of availability, which overlaps the previous run on purpose: the
 * fingerprint of each act is what keeps an overlap from creating a second
 * record, and an overlap is how a day that failed is recovered without
 * anybody noticing it.
 */
export async function runDjenCapture(
  options: {
    from?: string;
    to?: string;
    now?: Date;
    maxAttempts?: number;
  } = {},
): Promise<CaptureOutcome> {
  const handle = await captureRuntime().start(captureWorkflow, {
    from: options.from ?? null,
    to: options.to ?? null,
    nowMs: options.now?.getTime() ?? null,
    maxAttempts: options.maxAttempts ?? null,
  });
  return handle.result();
}

async function executeDjenCapture(
  options: {
    from?: string;
    to?: string;
    now?: Date;
    maxAttempts?: number;
  } = {},
): Promise<CaptureOutcome> {
  const now = options.now ?? new Date();
  const startedAt = now.toISOString();
  const to = options.to ?? startedAt.slice(0, 10);
  const from = options.from ?? addDays(to, -captureWindowDays());
  const maxAttempts = Math.min(
    options.maxAttempts ?? BACKOFF_MS.length,
    BACKOFF_MS.length,
  );

  const oabs = activeOabs();
  if (oabs.length === 0) {
    const reason =
      "Nenhuma inscrição da OAB está configurada para monitoramento. Defina MONITORED_OAB_NUMBER e MONITORED_OAB_UF no ambiente.";
    await recordRun({
      source: "djen",
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: false,
      attempts: 0,
      query: `${from} a ${to}`,
      status: null,
      reason,
      found: 0,
      stored: 0,
      duplicates: 0,
      linked: 0,
      suggested: 0,
      unlinked: 0,
    });
    return {
      ok: false,
      reason,
      found: 0,
      stored: 0,
      duplicates: 0,
      linked: 0,
      suggested: 0,
      unlinked: 0,
      attempts: 0,
      requestUrl: "",
      status: null,
    };
  }

  const cases = await listAllCases();
  let found = 0;
  let stored = 0;
  let duplicates = 0;
  let linked = 0;
  let suggested = 0;
  let unlinked = 0;
  let attempts = 0;
  let lastReason: string | null = null;
  let lastStatus: number | null = null;
  let requestUrl = "";
  let anySuccess = false;
  let pageCapReached = false;

  for (const oab of oabs) {
    /* The service answers one page at a time and the office asks for every page
     * of the window, because a run that silently stops at the first hundred acts
     * is a run that loses a deadline. The cap exists so a wrong window can never
     * turn into an endless loop, and a run that reaches it says so. */
    let page = 1;
    let pagesRead = 0;
    let more = true;
    while (more && pagesRead < MAX_PAGES) {
      const policy = retryPolicy();
      let result = await fetchDjen({
        oab,
        availableFrom: from,
        availableTo: to,
        page,
        pageSize: PAGE_SIZE,
      });
      attempts += 1;
      policy.observe(
        {
          endpoint: "djen",
          attempt: 1,
          ...(result.ok ? {} : { errorType: failureType(result.status) }),
        },
        result.ok,
      );
      let stoppedByPolicy = false;
      for (let attempt = 1; attempt < maxAttempts && !result.ok; attempt += 1) {
        const errorType = failureType(result.status);
        const decision = policy.shouldRetry({
          endpoint: "djen",
          attempt,
          errorType,
        });
        /* The first retry always runs, whatever the posterior thinks, because
         * a deadline may live behind a single transient refusal. Above that
         * floor the calibrated decision holds, inside the ceiling. */
        if (attempt > 1 && !decision.retry) {
          stoppedByPolicy = true;
          break;
        }
        await wait(Math.max(BACKOFF_MS[attempt] ?? 0, decision.delayMs));
        result = await fetchDjen({
          oab,
          availableFrom: from,
          availableTo: to,
          page,
          pageSize: PAGE_SIZE,
        });
        attempts += 1;
        policy.observe(
          {
            endpoint: "djen",
            attempt: attempt + 1,
            ...(result.ok ? {} : { errorType }),
          },
          result.ok,
        );
      }
      requestUrl = result.requestUrl;

      if (!result.ok) {
        lastReason = stoppedByPolicy
          ? `${result.reason ?? "Falha na consulta."} A política calibrada de repetição indicou parar após ${attempts} tentativas, porque repetir de novo tinha probabilidade baixa de dar certo.`
          : result.reason;
        lastStatus = result.status;
        break;
      }
      anySuccess = true;
      found += result.items.length;
      pagesRead += 1;

      for (const item of result.items) {
        const communication = normaliseCommunication(
          item,
          oab.label,
          new Date().toISOString(),
        );
        if (communication === null) {
          continue;
        }
        const prepared = prepareCommunication(communication, cases);
        const outcome = await storeIfNew(prepared);
        if (!outcome.stored) {
          duplicates += 1;
          continue;
        }
        stored += 1;
        if (prepared.link !== null) {
          linked += 1;
        } else if (prepared.suggestions.length > 0) {
          suggested += 1;
        } else {
          unlinked += 1;
        }
      }

      more = result.items.length >= PAGE_SIZE;
      page += 1;
    }
    if (pagesRead >= MAX_PAGES) {
      pageCapReached = true;
    }
  }

  const ok = anySuccess;
  await recordRun({
    source: "djen",
    startedAt,
    finishedAt: new Date().toISOString(),
    ok,
    attempts,
    query: `OAB ${oabs.map((entry) => entry.label).join(", ")}, disponibilização de ${from} a ${to}`,
    status: lastStatus,
    reason: ok
      ? pageCapReached
        ? `A execução parou no limite de ${MAX_PAGES} páginas e pode não ter trazido tudo do intervalo pedido.`
        : null
      : lastReason,
    found,
    stored,
    duplicates,
    linked,
    suggested,
    unlinked,
  });

  return {
    ok,
    reason: ok ? null : lastReason,
    found,
    stored,
    duplicates,
    linked,
    suggested,
    unlinked,
    attempts,
    requestUrl,
    status: lastStatus,
  };
}

/*
 * Reading and linking, before the record is written. Both are deterministic and
 * neither of them decides anything a human has to decide: the link only happens
 * by itself when the process number of the act is the number registered on the
 * case.
 */
export function prepareCommunication(
  communication: Communication,
  cases: Awaited<ReturnType<typeof listAllCases>>,
): Communication {
  const extraction = extractAct({
    text: communication.text,
    documentType: communication.documentType,
  });
  const outcome = resolveLink(communication, cases);
  const linkedAt = new Date().toISOString();

  return {
    ...communication,
    extraction,
    link:
      outcome.kind === "linked"
        ? {
            clientId: outcome.clientId,
            caseId: outcome.caseId,
            method: "process-number",
            linkedAt,
            linkedBy: "captura automática, por número de processo",
          }
        : null,
    suggestions: outcome.kind === "suggested" ? outcome.suggestions : [],
  };
}
