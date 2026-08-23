import "server-only";
import { ulid } from "ulid";
import type { Communication } from "@/lib/capture/communication";
import { djenBaseUrl, type MonitoredOab } from "@/lib/capture/config";
import { DJEN_SIGNATURE, djenDate } from "@/lib/capture/djen-signature";
import { captureFetch } from "@/lib/capture/egress";
import {
  canonicalProcessNumber,
  formatProcessNumber,
} from "@/lib/capture/process-number";

/*
 * The client of the Diário de Justiça Eletrônico Nacional.
 *
 * It reads the signature from one module and never repeats a parameter name of
 * its own. It never throws: a court that is down, a distribution that blocks the
 * country and a body that does not parse are all outcomes the office has to see
 * on a health panel, with the status and the reason, and not exceptions that
 * vanish into a log.
 *
 * The public consultation of the DJEN carries no credential. The key of the
 * DataJud is never sent here.
 */

export type DjenQuery = {
  oab?: MonitoredOab;
  processNumber?: string;
  tribunal?: string;
  availableFrom?: string;
  availableTo?: string;
  page?: number;
  pageSize?: number;
};

export type DjenFailure = {
  ok: false;
  status: number | null;
  reason: string;
  requestUrl: string;
  bodyExcerpt?: string | undefined;
};

export type DjenSuccess = {
  ok: true;
  requestUrl: string;
  status: number;
  total: number | null;
  items: unknown[];
};

export type DjenResult = DjenSuccess | DjenFailure;

export function djenRequestUrl(query: DjenQuery): string | null {
  const base = djenBaseUrl();
  if (base === null) {
    return null;
  }
  const url = new URL(`${base.replace(/\/+$/, "")}/${DJEN_SIGNATURE.resource}`);
  const names = DJEN_SIGNATURE.params;
  if (query.oab) {
    url.searchParams.set(names.oabNumber, query.oab.number);
    url.searchParams.set(names.oabUf, query.oab.uf);
  }
  if (query.processNumber) {
    url.searchParams.set(names.processNumber, query.processNumber);
  }
  if (query.tribunal) {
    url.searchParams.set(names.tribunal, query.tribunal);
  }
  if (query.availableFrom) {
    url.searchParams.set(names.availableFrom, djenDate(query.availableFrom));
  }
  if (query.availableTo) {
    url.searchParams.set(names.availableTo, djenDate(query.availableTo));
  }
  url.searchParams.set(names.page, String(query.page ?? 1));
  url.searchParams.set(names.pageSize, String(query.pageSize ?? 100));
  return url.toString();
}

function pick(body: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (key in body && body[key] !== null && body[key] !== undefined) {
      return body[key];
    }
  }
  return undefined;
}

export async function fetchDjen(
  query: DjenQuery,
  options: { timeoutMs?: number } = {},
): Promise<DjenResult> {
  const requestUrl = djenRequestUrl(query);
  if (requestUrl === null) {
    return {
      ok: false,
      status: null,
      reason:
        "A base do DJEN não está configurada. Defina DJEN_BASE_URL no ambiente.",
      requestUrl: "",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 30_000,
  );
  try {
    const response = await captureFetch(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reason: `O DJEN respondeu ${response.status}.`,
        requestUrl,
        bodyExcerpt: text.slice(0, 400),
      };
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: response.status,
        reason: "O DJEN respondeu algo que não é JSON.",
        requestUrl,
        bodyExcerpt: text.slice(0, 400),
      };
    }

    if (Array.isArray(body)) {
      return {
        ok: true,
        requestUrl,
        status: response.status,
        total: body.length,
        items: body,
      };
    }
    if (typeof body !== "object" || body === null) {
      return {
        ok: false,
        status: response.status,
        reason: "O corpo da resposta do DJEN não tem o formato esperado.",
        requestUrl,
        bodyExcerpt: text.slice(0, 400),
      };
    }
    const record = body as Record<string, unknown>;
    const items = pick(record, DJEN_SIGNATURE.itemKeys);
    const total = pick(record, DJEN_SIGNATURE.totalKeys);
    if (!Array.isArray(items)) {
      return {
        ok: false,
        status: response.status,
        reason:
          "A resposta do DJEN não trouxe a lista de comunicações em nenhuma das chaves conhecidas.",
        requestUrl,
        bodyExcerpt: text.slice(0, 400),
      };
    }
    return {
      ok: true,
      requestUrl,
      status: response.status,
      total: typeof total === "number" ? total : items.length,
      items,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      reason:
        error instanceof Error && error.name === "AbortError"
          ? "O DJEN não respondeu dentro do tempo limite."
          : "Não foi possível falar com o DJEN.",
      requestUrl,
      bodyExcerpt:
        error instanceof Error ? error.message.slice(0, 200) : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function field(
  raw: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return null;
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim().length > 0 ? [value.trim()] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim().length > 0) {
      out.push(entry.trim());
      continue;
    }
    if (entry !== null && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const name = field(record, ["nome", "name", "polo", "descricao"]);
      if (name !== null) {
        out.push(name);
      }
    }
  }
  return out;
}

function lawyerList(value: unknown): { name: string; oab: string | null }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: { name: string; oab: string | null }[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      out.push({ name: entry.trim(), oab: null });
      continue;
    }
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const nested =
      record.advogado !== null && typeof record.advogado === "object"
        ? (record.advogado as Record<string, unknown>)
        : record;
    const name = field(nested, ["nome", "name", "nomeAdvogado"]);
    if (name === null) {
      continue;
    }
    const numberOab = field(nested, ["numero_oab", "numeroOab", "oab"]);
    const ufOab = field(nested, ["uf_oab", "ufOab", "uf"]);
    const oab =
      numberOab === null
        ? null
        : ufOab === null
          ? numberOab
          : `${ufOab.toUpperCase()}${numberOab}`;
    out.push({ name, oab });
  }
  return out;
}

/* An ISO or Brazilian date found in the payload, normalised to a calendar date. */
function calendarDate(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }
  return null;
}

/*
 * One item of the response turned into the record the office keeps. Every field
 * is read through the signature module, so a name confirmed later is corrected
 * in one place.
 */
export function normaliseCommunication(
  item: unknown,
  monitoredOab: string,
  capturedAt: string,
): Communication | null {
  if (item === null || typeof item !== "object") {
    return null;
  }
  const raw = item as Record<string, unknown>;
  const fields = DJEN_SIGNATURE.fields;

  const text = field(raw, fields.text);
  const availableOn = calendarDate(field(raw, fields.availableOn));
  if (text === null || availableOn === null) {
    return null;
  }

  const rawNumber = field(raw, fields.processNumber);
  const processNumber =
    rawNumber === null ? null : canonicalProcessNumber(rawNumber);
  const certificateCode = field(raw, fields.certificateCode);

  return {
    id: ulid(),
    source: "djen",
    capturedAt,
    monitoredOab,
    externalId: field(raw, fields.id),
    certificateCode,
    certificateUrl:
      certificateCode === null
        ? field(raw, fields.link)
        : `${(djenBaseUrl() ?? "").replace(/\/+$/, "")}/${DJEN_SIGNATURE.certificatePath(certificateCode)}`,
    processNumber,
    processNumberLabel:
      processNumber === null ? rawNumber : formatProcessNumber(processNumber),
    availableOn,
    tribunalSigla: field(raw, fields.tribunal),
    courtName: field(raw, fields.court),
    caseClass: field(raw, fields.caseClass),
    documentType: field(raw, fields.documentType),
    medium: field(raw, fields.medium),
    text,
    recipients: stringList(pick(raw, fields.recipients)),
    lawyers: lawyerList(pick(raw, fields.lawyers)),
    raw,
    extraction: null,
    link: null,
    suggestions: [],
    appliedAt: null,
    appliedNote: null,
  };
}
