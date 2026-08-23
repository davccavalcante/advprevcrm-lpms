import "server-only";
import { datajudApiKey, datajudBaseUrl } from "@/lib/capture/config";
import { captureFetch } from "@/lib/capture/egress";
import { digitsOf } from "@/lib/capture/process-number";
import {
  datajudEndpoint,
  resolveTribunal,
  type TribunalEntry,
} from "@/lib/capture/tribunals";

/*
 * The DataJud, the national base of procedural metadata of the National Council
 * of Justice.
 *
 * What it is for here, and for nothing else: enriching a process the office has
 * already identified with its movements. It does not search by registration
 * number of a lawyer, it does not carry the text of a service notice, and it is
 * NEVER the source of a deadline. Each court sends its data on its own cadence,
 * so what comes back is always behind the court itself.
 *
 * Authentication is the public key published by the council, which lives in the
 * environment because the council may change it at any time.
 */

export type DatajudMovement = {
  code: number | null;
  name: string;
  at: string | null;
};

export type DatajudCase = {
  processNumber: string;
  tribunal: string | null;
  grau: string | null;
  caseClass: string | null;
  court: string | null;
  filedAt: string | null;
  lastUpdateAt: string | null;
  secrecyLevel: number | null;
  subjects: string[];
  movements: DatajudMovement[];
};

export type DatajudResult =
  | { ok: true; endpoint: string; found: number; cases: DatajudCase[] }
  | {
      ok: false;
      endpoint: string | null;
      status: number | null;
      reason: string;
      bodyExcerpt?: string | undefined;
    };

function textOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

/*
 * The date of a movement arrives in more than one shape. The wiki example shows
 * an ISO instant; the live answer of the third region on 2026-08-12 returned
 * `dataAjuizamento` as fourteen digits, YYYYMMDDHHMMSS. Both are read, and an
 * unknown shape is kept as it came instead of being guessed into a date.
 */
export function datajudInstant(value: unknown): string | null {
  const raw = textOf(value);
  if (raw === null) {
    return null;
  }
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}.000Z`;
  }
  return raw;
}

function movementsOf(value: unknown): DatajudMovement[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: DatajudMovement[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const name = textOf(record.nome);
    if (name === null) {
      continue;
    }
    out.push({
      code: typeof record.codigo === "number" ? record.codigo : null,
      name,
      at: datajudInstant(record.dataHora),
    });
  }
  /* Newest first: what a lawyer wants to see is what just happened. */
  return out.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

function named(value: unknown): string | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  return textOf((value as Record<string, unknown>).nome);
}

export async function fetchDatajudCase(
  processNumber: string,
  options: { sigla?: string | null; timeoutMs?: number } = {},
): Promise<DatajudResult> {
  const base = datajudBaseUrl();
  const key = datajudApiKey();
  if (base === null || key === null) {
    return {
      ok: false,
      endpoint: null,
      status: null,
      reason:
        "O DataJud não está configurado. Defina DATAJUD_BASE_URL e DATAJUD_API_KEY no ambiente.",
    };
  }
  const tribunal: TribunalEntry | null = resolveTribunal({
    sigla: options.sigla ?? null,
    processNumber,
  });
  if (tribunal === null) {
    return {
      ok: false,
      endpoint: null,
      status: null,
      reason:
        "O tribunal deste processo não foi identificado, então nenhuma consulta foi feita. O DataJud tem um endereço por tribunal e o escritório não adivinha qual é.",
    };
  }

  const endpoint = datajudEndpoint(base, tribunal);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 30_000,
  );
  try {
    const response = await captureFetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: digitsOf(processNumber) } },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        endpoint,
        status: response.status,
        reason: `O DataJud respondeu ${response.status}.`,
        bodyExcerpt: text.slice(0, 300),
      };
    }
    const body = JSON.parse(text) as {
      hits?: { hits?: { _source?: Record<string, unknown> }[] };
    };
    const hits = body.hits?.hits ?? [];
    const cases: DatajudCase[] = [];
    for (const hit of hits) {
      const source = hit._source;
      if (source === undefined) {
        continue;
      }
      const number = textOf(source.numeroProcesso);
      if (number === null) {
        continue;
      }
      cases.push({
        processNumber: number,
        tribunal: textOf(source.tribunal),
        grau: textOf(source.grau),
        caseClass: named(source.classe),
        court: named(source.orgaoJulgador),
        filedAt: datajudInstant(source.dataAjuizamento),
        lastUpdateAt: datajudInstant(source.dataHoraUltimaAtualizacao),
        secrecyLevel:
          typeof source.nivelSigilo === "number" ? source.nivelSigilo : null,
        subjects: Array.isArray(source.assuntos)
          ? source.assuntos
              .map((entry) => named(entry))
              .filter((entry): entry is string => entry !== null)
          : [],
        movements: movementsOf(source.movimentos),
      });
    }
    return { ok: true, endpoint, found: cases.length, cases };
  } catch (error) {
    return {
      ok: false,
      endpoint,
      status: null,
      reason:
        error instanceof Error && error.name === "AbortError"
          ? "O DataJud não respondeu dentro do tempo limite."
          : "Não foi possível falar com o DataJud.",
      bodyExcerpt:
        error instanceof Error ? error.message.slice(0, 200) : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}
