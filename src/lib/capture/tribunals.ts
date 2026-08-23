import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { partsOf } from "@/lib/capture/process-number";

/*
 * The endpoints of the DataJud, transcribed from the official page of the
 * National Council of Justice into `config/datajud-tribunals.yaml`, with the
 * date of the capture. The alias of a court is never written in code: the
 * council changes the list, and a list inside a source file is a list nobody
 * updates.
 */

const CONFIG_FILE = path.join(
  process.cwd(),
  "config",
  "datajud-tribunals.yaml",
);

const schema = z.object({
  source: z.string(),
  capturedAt: z.string(),
  groups: z.record(z.string(), z.string()).default({}),
  tribunals: z.array(
    z.object({
      alias: z.string(),
      sigla: z.string(),
      name: z.string(),
      kind: z.string(),
      note: z.string().optional(),
    }),
  ),
});

export type TribunalCatalogue = z.infer<typeof schema>;
export type TribunalEntry = TribunalCatalogue["tribunals"][number];

let cached: TribunalCatalogue | null = null;

export function tribunalCatalogue(): TribunalCatalogue {
  if (cached === null) {
    cached = schema.parse(parse(readFileSync(CONFIG_FILE, "utf8")));
  }
  return cached;
}

function normalise(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* By the acronym the communication carries, for example TRF3 or TJSP. */
export function tribunalBySigla(sigla: string): TribunalEntry | null {
  const wanted = normalise(sigla).replace(/[^A-Z0-9-]/g, "");
  return (
    tribunalCatalogue().tribunals.find(
      (entry) => normalise(entry.sigla) === wanted,
    ) ?? null
  );
}

/*
 * By the process number, for the two justices whose court segment is the region
 * itself and therefore says the endpoint without any table: the Federal Justice,
 * segment four, and the Labour Justice, segment five. For every other justice
 * the number does not carry the acronym, and the office uses the one the
 * communication states instead of guessing.
 */
export function tribunalByProcessNumber(value: string): TribunalEntry | null {
  const parts = partsOf(value);
  if (parts === null) {
    return null;
  }
  const region = String(Number(parts.court));
  if (parts.justice === "4") {
    return tribunalBySigla(`TRF${region}`);
  }
  if (parts.justice === "5") {
    return tribunalBySigla(`TRT${region}`);
  }
  return null;
}

/*
 * The endpoint the office will call. Returns null when the court cannot be
 * identified, and null is an honest answer: the complement by movements simply
 * does not run, and the office says so, instead of calling the wrong court.
 */
export function datajudEndpoint(baseUrl: string, entry: TribunalEntry): string {
  return `${baseUrl.replace(/\/+$/, "")}/${entry.alias}/_search`;
}

export function resolveTribunal(input: {
  sigla?: string | null;
  processNumber?: string | null;
}): TribunalEntry | null {
  if (input.sigla) {
    const bySigla = tribunalBySigla(input.sigla);
    if (bySigla) {
      return bySigla;
    }
  }
  if (input.processNumber) {
    return tribunalByProcessNumber(input.processNumber);
  }
  return null;
}
