import { AsyncLocalStorage } from "node:async_hooks";
import type {
  GenerateRequest,
  GenerateResponse,
  LlmAdapter,
  StreamEvent,
} from "@teleologyhi-sdk/nhe";

/*
 * The office's records reach the reasoning layer through the system channel,
 * never through the user turn, and never as a message the body could confuse
 * with something the lawyer said.
 *
 * Measured on 2026-08-11 while wiring the real Trinity: the shipped adapters
 * drop any message whose role is "system" from the turn list, so carrying the
 * operation inside `history` would have been silently discarded and the entity
 * would have answered blind, which is exactly the defect corrected earlier
 * today. The documented extension point is the adapter contract itself, so the
 * office wraps the provider adapter instead of fighting it.
 *
 * The context is carried per request in async local storage: two lawyers asking
 * at the same instant never see each other's assembled view.
 */

/*
 * The store lives on the global object, next to the universe, and not in the
 * module scope. Measured on 2026-08-12: the development server recompiles a
 * module graph while the universe stays cached on `globalThis`, so the action
 * setting the context and the adapter reading it ended up in two different
 * copies of this module. The adapter then read an empty store and the entity
 * answered blind, saying it had no access to the office, which is exactly the
 * defect this file exists to prevent. One store for the whole process closes it.
 */
type OfficeContext = { text: string; used: boolean };

const STORE_KEY = "__advprev_office_context__";

/*
 * The identity of this module instance. The development server recompiles a
 * module graph while the universe stays cached on `globalThis`, and the body
 * built by an older instance keeps reading the store of that older instance.
 * The universe compares this value and rebuilds itself when it changes, which
 * is what keeps the entity from ever answering blind after a reload.
 */
export const OFFICE_ADAPTER_INSTANCE = `${Date.now()}-${Math.random()
  .toString(36)
  .slice(2)}`;

const globalScope = globalThis as Record<string, unknown>;
function resolveStore(): AsyncLocalStorage<OfficeContext> {
  const existing = globalScope[STORE_KEY];
  if (existing !== undefined) {
    return existing as AsyncLocalStorage<OfficeContext>;
  }
  const created = new AsyncLocalStorage<OfficeContext>();
  globalScope[STORE_KEY] = created;
  return created;
}

const officeContext = resolveStore();

/*
 * Carries the assembled view of the office into the request, and reports back
 * whether it really travelled. A blind answer must never reach a lawyer as if
 * it were an informed one, so the caller checks this and refuses to deliver an
 * answer produced without the records.
 */
export function withOfficeContext<T>(
  context: string,
  run: () => Promise<T>,
): Promise<{ result: T; contextUsed: boolean }> {
  const holder: OfficeContext = { text: context, used: false };
  return officeContext.run(holder, async () => {
    const result = await run();
    return { result, contextUsed: holder.used };
  });
}

export class OfficeAdapter implements LlmAdapter {
  readonly id: string;
  readonly supportsTools: boolean;
  readonly supportsStreaming: boolean;

  private readonly base: LlmAdapter;

  constructor(base: LlmAdapter) {
    this.base = base;
    this.id = base.id;
    this.supportsTools = base.supportsTools ?? false;
    this.supportsStreaming = base.supportsStreaming ?? false;
  }

  private compose(req: GenerateRequest): GenerateRequest {
    const context = officeContext.getStore();
    if (context === undefined || context.text.length === 0) {
      return req;
    }
    context.used = true;
    return { ...req, system: `${req.system}\n\n${context.text}` };
  }

  generate(req: GenerateRequest): Promise<GenerateResponse> {
    return this.base.generate(this.compose(req));
  }

  generateStream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    const stream = this.base.generateStream;
    if (!stream) {
      throw new Error("O adaptador de base não oferece resposta em fluxo.");
    }
    return stream.call(this.base, this.compose(req));
  }
}
