import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { TRINITY_ROOT } from "@/lib/trinity/store-paths";

/*
 * One universe, one writer.
 *
 * The MAIC audit log is a hash chain and its head lives in the memory of the
 * process that opened it. Two processes writing the same store interleave their
 * appends, the chain stops verifying, and the store refuses to reopen: the
 * entity cannot be embodied again. That is not a theory. It happened on
 * 2026-08-11 at 19:08:24Z, when the development server and an offline harness
 * both answered a question against the same store, and the next boot was locked
 * out by the tamper check, which was doing exactly its job.
 *
 * This lock turns a silent corruption into a loud refusal. A second process
 * that finds a living writer stops before opening the store and says whose
 * process holds it. A lock left behind by a process that no longer exists is
 * taken over, because a crash must not seal the office.
 */

const LOCK_FILE = path.join(TRINITY_ROOT, "universe.lock");

type LockRecord = { pid: number; since: string; title: string };

export class UniverseBusyError extends Error {
  readonly holder: LockRecord;

  constructor(holder: LockRecord) {
    super(
      `O universo já está aberto pelo processo ${holder.pid} desde ${holder.since}. Uma loja da Trindade tem um único escritor.`,
    );
    this.name = "UniverseBusyError";
    this.holder = holder;
  }
}

function isAlive(pid: number): boolean {
  try {
    /* Signal zero performs the permission and existence check without
     * delivering anything to the process. */
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readLock(): Promise<LockRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(LOCK_FILE, "utf8")) as LockRecord;
    return typeof parsed?.pid === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export async function acquireUniverseLock(): Promise<LockRecord> {
  await mkdir(TRINITY_ROOT, { recursive: true });
  const held = await readLock();
  if (held && held.pid !== process.pid && isAlive(held.pid)) {
    throw new UniverseBusyError(held);
  }

  const record: LockRecord = {
    pid: process.pid,
    since: new Date().toISOString(),
    title: process.title,
  };
  await writeFile(LOCK_FILE, JSON.stringify(record), "utf8");

  const release = () => {
    void releaseUniverseLock();
  };
  process.once("exit", release);
  process.once("SIGINT", release);
  process.once("SIGTERM", release);

  return record;
}

export async function releaseUniverseLock(): Promise<void> {
  const held = await readLock();
  if (!held || held.pid !== process.pid) {
    return;
  }
  try {
    await unlink(LOCK_FILE);
  } catch {
    /* Another process may have taken it over already; nothing to undo. */
  }
}
