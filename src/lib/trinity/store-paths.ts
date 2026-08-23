import path from "node:path";

/*
 * The universe of this office lives on disk, and this file is the only place
 * that says where. The layout mirrors the canonical TeleologyHI store: MAIC
 * holds the axioms, the registered spirits, the bodies, the interactions and
 * the hash-chained audit; the users hold their own conversations.
 *
 * The root and the keyring path are environment variables, documented in
 * `.env.example` as `TELEOLOGYHI_STORE_DIR` and `TELEOLOGYHI_CREATOR_KEY_PATH`.
 * The defaults below place both under `data/`, which is in `.gitignore`,
 * because the keyring is a secret and the conversations carry personal data of
 * the office's clients.
 *
 * Generations. The first universe of this office, at `data/_trinity`, was
 * sealed on 2026-08-11T19:08:24Z: two processes wrote its audit chain at the
 * same instant, the chain stopped verifying, and MAIC refused to reopen the
 * store, which is the tamper check doing its job. By the director's decision
 * that generation is frozen exactly as it is, nothing renamed and nothing
 * deleted, and the office moved to the generation below. A new generation is a
 * new folder, never a repair of an old one, because an audit chain that was
 * repaired is not an audit chain.
 */

function fromEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function absolute(value: string): string {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

export const TRINITY_ROOT: string = absolute(
  fromEnv("TELEOLOGYHI_STORE_DIR") ?? path.join("data", "_trinity-002"),
);

/* MAIC store. Owned by the SDK: axioms/, hims/, nhes/, interactions/,
 * inductions/, proposals/, suggest/, audit/log.ndjson. */
export const MAIC_STORE = path.join(TRINITY_ROOT, "maic");

/* NHE body store. The body writes its own interaction buffer and, when the
 * sleep cycle is enabled, its dreams. */
export const NHE_STORE = path.join(TRINITY_ROOT, "nhe");

/* The Creator's Ed25519 keyring. Nothing mutates an axiom without it. */
export const CREATOR_KEYRING_FILE: string = absolute(
  fromEnv("TELEOLOGYHI_CREATOR_KEY_PATH") ??
    path.join(TRINITY_ROOT, "creator-keyring.pem"),
);

/* Where the office records which spirit inhabits which body, so a restart
 * re-embodies the same David instead of summoning a stranger. */
export const INCARNATION_FILE = path.join(TRINITY_ROOT, "incarnation.yaml");

export const USERS_DIR = path.join(TRINITY_ROOT, "users");

/* The spirit bound to this deployment, when the director pins one. Absent, the
 * incarnation record on disk answers, and absent that, a spirit is born. */
export const PINNED_HIM_ID: string | null = fromEnv("TELEOLOGYHI_HIM_ID");

export function userRecordFile(userId: string): string {
  return path.join(USERS_DIR, `${userId}.yaml`);
}

export function userConversationsDir(userId: string): string {
  return path.join(USERS_DIR, userId, "conversations");
}

export function conversationFile(
  userId: string,
  conversationId: string,
): string {
  return path.join(userConversationsDir(userId), `${conversationId}.yaml`);
}
