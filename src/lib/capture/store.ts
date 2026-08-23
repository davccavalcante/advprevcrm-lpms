import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import {
  type Communication,
  communicationSchema,
} from "@/lib/capture/communication";
import { serialiseByFile, writeYamlAtomic } from "@/lib/trinity/yaml-store";

/*
 * Where the captured communications live. One YAML per communication, under
 * `data/_capture/communications/`, with the whole text of the act and the
 * payload as it arrived. Nothing is ever deleted here, and a communication that
 * matched no case is not discarded: it waits in the queue of the unlinked, in
 * plain sight.
 *
 * A communication is written once. The index keeps the fingerprint of every one
 * already stored, so a scheduled run that overlaps the previous window does not
 * create a second record of the same act.
 */

const CAPTURE_ROOT = path.join(process.cwd(), "data", "_capture");
const COMMUNICATIONS_DIR = path.join(CAPTURE_ROOT, "communications");
const INDEX_FILE = path.join(CAPTURE_ROOT, "index.yaml");

export function captureRoot(): string {
  return CAPTURE_ROOT;
}

/*
 * What makes two payloads the same act. The certificate code is the identifier
 * the court itself gives, so it answers first. Without it, the office falls back
 * to the process number, the day of availability and the text, which is the
 * least that can distinguish two acts of the same day.
 */
export function fingerprintOfCommunication(
  communication: Pick<
    Communication,
    "certificateCode" | "externalId" | "processNumber" | "availableOn" | "text"
  >,
): string {
  if (communication.certificateCode !== null) {
    return `certidao:${communication.certificateCode}`;
  }
  if (communication.externalId !== null) {
    return `id:${communication.externalId}`;
  }
  const digest = createHash("sha256")
    .update(
      [
        communication.processNumber ?? "",
        communication.availableOn,
        communication.text,
      ].join("|"),
    )
    .digest("hex");
  return `texto:${digest}`;
}

type CaptureIndex = Record<string, string>;

async function readIndex(): Promise<CaptureIndex> {
  try {
    return (
      (parse(await readFile(INDEX_FILE, "utf8")) as CaptureIndex | null) ?? {}
    );
  } catch {
    return {};
  }
}

function communicationFile(id: string): string {
  return path.join(COMMUNICATIONS_DIR, `${id}.yaml`);
}

export async function readCommunication(
  id: string,
): Promise<Communication | null> {
  try {
    const parsed = communicationSchema.safeParse(
      parse(await readFile(communicationFile(id), "utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function listCommunications(): Promise<Communication[]> {
  try {
    const names = await readdir(COMMUNICATIONS_DIR);
    const out: Communication[] = [];
    for (const name of names) {
      if (!name.endsWith(".yaml")) {
        continue;
      }
      const record = await readCommunication(name.replace(/\.yaml$/, ""));
      if (record) {
        out.push(record);
      }
    }
    /* Newest availability first, and inside the same day the newest capture. */
    return out.sort((a, b) => {
      if (a.availableOn !== b.availableOn) {
        return b.availableOn.localeCompare(a.availableOn);
      }
      return b.id.localeCompare(a.id);
    });
  } catch {
    return [];
  }
}

export async function saveCommunication(
  communication: Communication,
): Promise<void> {
  const file = communicationFile(communication.id);
  await serialiseByFile(file, async () => {
    await mkdir(COMMUNICATIONS_DIR, { recursive: true });
    await writeYamlAtomic(file, communication);
  });
}

export type StoreOutcome = {
  stored: boolean;
  reason: "new" | "duplicate";
  id: string;
};

/*
 * Stores a communication unless the office already has it. The index is written
 * under the same lock as the record, so two runs at the same instant cannot both
 * decide that the act is new.
 */
export async function storeIfNew(
  communication: Communication,
): Promise<StoreOutcome> {
  const fingerprint = fingerprintOfCommunication(communication);
  return serialiseByFile(INDEX_FILE, async () => {
    await mkdir(COMMUNICATIONS_DIR, { recursive: true });
    const index = await readIndex();
    const known = index[fingerprint];
    if (known !== undefined) {
      return { stored: false, reason: "duplicate" as const, id: known };
    }
    await writeYamlAtomic(communicationFile(communication.id), communication);
    index[fingerprint] = communication.id;
    await writeYamlAtomic(INDEX_FILE, index);
    return { stored: true, reason: "new" as const, id: communication.id };
  });
}

export async function updateCommunication(
  id: string,
  change: (current: Communication) => Communication,
): Promise<Communication | null> {
  const file = communicationFile(id);
  return serialiseByFile(file, async () => {
    const current = await readCommunication(id);
    if (current === null) {
      return null;
    }
    const updated = change(current);
    await writeYamlAtomic(file, updated);
    return updated;
  });
}

export async function unlinkedCommunications(): Promise<Communication[]> {
  return (await listCommunications()).filter(
    (communication) => communication.link === null,
  );
}

export async function communicationsOfCase(
  clientId: string,
  caseId: string,
): Promise<Communication[]> {
  return (await listCommunications()).filter(
    (communication) =>
      communication.link?.clientId === clientId &&
      communication.link?.caseId === caseId,
  );
}
