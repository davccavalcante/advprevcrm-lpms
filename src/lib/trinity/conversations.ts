import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ulid } from "ulid";
import { parse } from "yaml";
import { PROJECT_NAME, PROJECT_VERSION } from "@/lib/trinity/project-identity";
import {
  conversationFile,
  USERS_DIR,
  userConversationsDir,
  userRecordFile,
} from "@/lib/trinity/store-paths";
import { serialiseByFile, writeYamlAtomic } from "@/lib/trinity/yaml-store";

/*
 * Every conversation between a lawyer and the entity is written to YAML under
 * the user it belongs to, inside the Trinity store. YAML because a person and a
 * language model both read it without a parser in between, which is what the
 * next phases of this project need.
 *
 * The file is append-only in practice: turns are added, never rewritten, and no
 * profile in this application deletes a conversation. MAIC keeps the
 * hash-chained audit of the same exchange in parallel; this file is the
 * readable face of it.
 */

export type ConversationTurn = {
  at: string;
  userPrompt: string;
  answer: string;
  kind: "ok" | "refused" | "redirect" | "blocked" | "unavailable";
  preVerdict?: string;
  postVerdict?: string;
  citedAxioms?: string[];
  auditIds?: { pre: string; post: string };
  model?: string;
  /* The cut of the system that produced the turn. A conversation may span
   * versions, so the stamp belongs to the turn and not only to the header. */
  projectVersion?: string;
  tokens?: { in: number; out: number };
  /* True when the answer was reused from the office cache and no token was
   * spent. The turn is still written, because the lawyer received it. */
  cached?: boolean;
  context?: {
    cases: number;
    finance: number;
    operations: number;
    suppressed: number;
  };
  blockReason?: string;
  /* Which document, which page and with how much confidence the entity read to
   * produce this turn. Empty when the answer came only from structured data. */
  documentsRead?: {
    fileName: string;
    page: number;
    confidence: number;
    caseRef: string;
  }[];
};

export type ConversationRecord = {
  conversationId: string;
  userId: string;
  himId: string;
  nheId: string;
  project: string;
  projectVersion: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: ConversationTurn[];
};

export type UserRecord = {
  userId: string;
  lawyerId: string;
  displayName: string;
  role: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

const INDEX_FILE = path.join(USERS_DIR, "_index.yaml");

type UserIndex = Record<string, string>;

async function readIndex(): Promise<UserIndex> {
  try {
    return (
      (parse(await readFile(INDEX_FILE, "utf8")) as UserIndex | null) ?? {}
    );
  } catch {
    return {};
  }
}

/*
 * The user identifier of the store is a ULID, never the readable login of the
 * lawyer, so a folder name never carries a person's name.
 */
export async function ensureUser(
  lawyerId: string,
  displayName: string,
  role: string,
): Promise<UserRecord> {
  return serialiseByFile(INDEX_FILE, async () => {
    await mkdir(USERS_DIR, { recursive: true });
    const index = await readIndex();
    const now = new Date().toISOString();
    const known = index[lawyerId];
    const userId = known ?? ulid();

    if (!known) {
      index[lawyerId] = userId;
      await writeYamlAtomic(INDEX_FILE, index);
    }

    let record: UserRecord = {
      userId,
      lawyerId,
      displayName,
      role,
      firstSeenAt: now,
      lastSeenAt: now,
    };
    try {
      const existing = parse(
        await readFile(userRecordFile(userId), "utf8"),
      ) as Partial<UserRecord> | null;
      /* A record that lost its identifier is not a record: rather than letting
       * an undefined travel into a path, the office rewrites it whole. */
      if (existing && typeof existing.userId === "string") {
        record = {
          ...record,
          firstSeenAt: existing.firstSeenAt ?? now,
          lastSeenAt: now,
        };
      }
    } catch {
      /* first time this lawyer speaks to the entity */
    }
    await writeYamlAtomic(userRecordFile(userId), record);
    return record;
  });
}

export async function openConversation(
  userId: string,
  himId: string,
  nheId: string,
  conversationId?: string,
): Promise<ConversationRecord> {
  await mkdir(userConversationsDir(userId), { recursive: true });
  const id = conversationId ?? ulid();
  try {
    const existing = parse(
      await readFile(conversationFile(userId, id), "utf8"),
    ) as ConversationRecord;
    if (existing?.conversationId) {
      return existing;
    }
  } catch {
    /* first turn of a new conversation */
  }
  const now = new Date().toISOString();
  return {
    conversationId: id,
    userId,
    himId,
    nheId,
    project: PROJECT_NAME,
    projectVersion: PROJECT_VERSION,
    title: "Conversa com David",
    createdAt: now,
    updatedAt: now,
    turns: [],
  };
}

export type AnsweredTurn = {
  at: string;
  userPrompt: string;
  answer: string;
  model: string | null;
  conversationId: string;
};

/*
 * The most recent turn the entity actually delivered, read from the store on
 * disk. The second reading works on it: newest conversation file first, and
 * inside each file the turns from the end, so the walk stops at the first
 * delivered answer it meets.
 */
export async function lastAnsweredTurn(): Promise<AnsweredTurn | null> {
  let files: { file: string; mtime: number }[] = [];
  try {
    const users = (await readdir(USERS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    for (const userId of users) {
      try {
        for (const name of await readdir(userConversationsDir(userId))) {
          if (!name.endsWith(".yaml")) {
            continue;
          }
          const file = path.join(userConversationsDir(userId), name);
          files.push({ file, mtime: (await stat(file)).mtimeMs });
        }
      } catch {
        /* a user folder without conversations yet */
      }
    }
  } catch {
    return null;
  }
  files = files.sort((a, b) => b.mtime - a.mtime);

  for (const entry of files) {
    let record: ConversationRecord | null = null;
    try {
      record = parse(
        await readFile(entry.file, "utf8"),
      ) as ConversationRecord | null;
    } catch {
      continue;
    }
    const turns = record?.turns ?? [];
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index];
      if (
        turn !== undefined &&
        turn.kind === "ok" &&
        turn.answer.trim().length > 0 &&
        record !== null
      ) {
        return {
          at: turn.at,
          userPrompt: turn.userPrompt,
          answer: turn.answer,
          model: turn.model ?? null,
          conversationId: record.conversationId,
        };
      }
    }
  }
  return null;
}

export async function appendTurn(
  conversation: ConversationRecord,
  turn: ConversationTurn,
): Promise<ConversationRecord> {
  const updated: ConversationRecord = {
    ...conversation,
    project: PROJECT_NAME,
    projectVersion: PROJECT_VERSION,
    updatedAt: turn.at,
    title:
      conversation.turns.length === 0
        ? turn.userPrompt.slice(0, 80)
        : conversation.title,
    turns: [...conversation.turns, turn],
  };
  const file = conversationFile(
    conversation.userId,
    conversation.conversationId,
  );
  await serialiseByFile(file, async () => {
    await mkdir(userConversationsDir(conversation.userId), { recursive: true });
    await writeYamlAtomic(file, updated);
  });
  return updated;
}
