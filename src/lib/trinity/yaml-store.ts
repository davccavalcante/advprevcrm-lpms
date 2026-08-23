import { randomUUID } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";
import { stringify } from "yaml";

/*
 * Writing a record of the office to disk, safely.
 *
 * Measured on 2026-08-11T20:03Z: three questions answered at the same instant
 * wrote the same user record concurrently, a reader caught a half-written file,
 * and the parsed record came back without its identifier, which then travelled
 * into a path and threw. Two lawyers asking at the same second would have
 * reproduced it in the office.
 *
 * Two rules fix it and both are cheap. A file is never written in place: the
 * bytes go to a temporary neighbour and are moved over the target, and a move
 * on this filesystem is atomic, so a reader sees either the old record or the
 * new one and never half of either. And writes to the same file are queued in
 * order, so the last writer does not lose to a slower one that started first.
 */

const queues = new Map<string, Promise<unknown>>();

export function serialiseByFile<T>(
  file: string,
  run: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous.then(run, run);
  /* The queue keeps order, never the failure: a rejected write must not block
   * the next one. */
  queues.set(
    file,
    next.catch(() => undefined),
  );
  return next;
}

export async function writeYamlAtomic(
  file: string,
  data: unknown,
): Promise<void> {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, stringify(data, { lineWidth: 0 }), "utf8");
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
