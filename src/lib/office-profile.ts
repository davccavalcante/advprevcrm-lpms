import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ulid } from "ulid";
import { parse } from "yaml";
import { z } from "zod";
import { personaLawyer } from "@/lib/persona";
import { serialiseByFile, writeYamlAtomic } from "@/lib/trinity/yaml-store";

/*
 * The profile of the account that operates this installation: name, email,
 * password and photo, editable on the settings screen by the director's order
 * of 2026-08-21. The record lives on disk under `data/`, outside the
 * repository, and every change appends an immutable line to its own change
 * log, with author, field, values before and after, and the moment, because
 * account changes are audited actions.
 *
 * What this is not, said out loud: there is no authentication module in this
 * phase, so the password recorded here does not guard any login yet. It is
 * stored only as a salted scrypt hash, never in clear, and changing it
 * requires the current one once one exists. When Supabase auth arrives, this
 * record is the seed of the real credential and the rule moves to the
 * database.
 *
 * The record is seeded from the persona dataset and only materialises on the
 * first real change, so a fresh installation keeps showing the display data
 * the director ordered without creating files nobody asked for.
 */

const PROFILE_DIR = path.join(process.cwd(), "data", "_office");
const PROFILE_FILE = path.join(PROFILE_DIR, "profile.yaml");

/* Bounds of the photo upload, stated on the screen with the same numbers. */
export const PHOTO_MAX_BYTES = 2_000_000;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/* Bounds of the password, stated on the screen with the same numbers. */
export const PASSWORD_MIN_CHARS = 12;
const PASSWORD_MAX_CHARS = 128;

export const identitySchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
});

export type IdentityInput = z.infer<typeof identitySchema>;

const passwordSchema = z.object({
  current: z.string().max(PASSWORD_MAX_CHARS).optional(),
  next: z.string().min(PASSWORD_MIN_CHARS).max(PASSWORD_MAX_CHARS),
});

export type PasswordInput = z.infer<typeof passwordSchema>;

type StoredPassword = {
  algorithm: "scrypt";
  saltHex: string;
  hashHex: string;
  updatedAt: string;
};

type StoredPhoto = {
  fileName: string;
  contentType: string;
  bytes: number;
  updatedAt: string;
};

type ProfileChange = {
  at: string;
  actor: string;
  action:
    | "identity-updated"
    | "password-set"
    | "password-changed"
    | "photo-updated";
  /* Values before and after for identity fields. Password material never
   * appears here; the action name is the whole record of it. */
  detail: string;
};

type StoredProfile = {
  firstName: string;
  lastName: string;
  email: string;
  password: StoredPassword | null;
  photo: StoredPhoto | null;
  updatedAt: string;
  changes: ProfileChange[];
};

/* What the screens receive. No hash, no salt, no file path. */
export type OfficeProfileView = {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: string;
  team: string;
  avatarSrc: string;
  passwordSet: boolean;
  updatedAt: string | null;
};

function seedProfile(): StoredProfile {
  const parts = personaLawyer.fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? personaLawyer.firstName,
    lastName: parts.slice(1).join(" "),
    email: personaLawyer.email,
    password: null,
    photo: null,
    updatedAt: "",
    changes: [],
  };
}

async function readStored(): Promise<StoredProfile> {
  try {
    const raw = parse(
      await readFile(PROFILE_FILE, "utf8"),
    ) as Partial<StoredProfile> | null;
    if (raw && typeof raw.firstName === "string") {
      const seed = seedProfile();
      return {
        firstName: raw.firstName,
        lastName:
          typeof raw.lastName === "string" ? raw.lastName : seed.lastName,
        email: typeof raw.email === "string" ? raw.email : seed.email,
        password: raw.password ?? null,
        photo: raw.photo ?? null,
        updatedAt: raw.updatedAt ?? "",
        changes: Array.isArray(raw.changes) ? raw.changes : [],
      };
    }
  } catch {
    /* No profile recorded yet: the seed answers. */
  }
  return seedProfile();
}

function viewOf(stored: StoredProfile): OfficeProfileView {
  const fullName = `${stored.firstName} ${stored.lastName}`.trim();
  return {
    firstName: stored.firstName,
    lastName: stored.lastName,
    fullName,
    email: stored.email,
    role: personaLawyer.role,
    team: personaLawyer.team,
    avatarSrc:
      stored.photo === null
        ? personaLawyer.avatarSrc
        : `/api/avatar?v=${encodeURIComponent(stored.photo.updatedAt)}`,
    passwordSet: stored.password !== null,
    updatedAt: stored.updatedAt.length > 0 ? stored.updatedAt : null,
  };
}

export async function officeProfile(): Promise<OfficeProfileView> {
  return viewOf(await readStored());
}

async function writeStored(profile: StoredProfile): Promise<void> {
  await serialiseByFile(PROFILE_FILE, async () => {
    await mkdir(PROFILE_DIR, { recursive: true });
    await writeYamlAtomic(PROFILE_FILE, profile);
  });
}

export type ProfileWriteResult =
  | { ok: true; profile: OfficeProfileView }
  | { ok: false; reason: string };

export async function updateIdentity(
  input: IdentityInput,
  actor: string,
): Promise<ProfileWriteResult> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason:
        "Nome, sobrenome e endereço eletrônico precisam estar preenchidos, e o endereço precisa ser válido.",
    };
  }
  const stored = await readStored();
  const at = new Date().toISOString();
  const before = `${stored.firstName} ${stored.lastName} <${stored.email}>`;
  const after = `${parsed.data.firstName} ${parsed.data.lastName} <${parsed.data.email}>`;
  if (before === after) {
    return { ok: true, profile: viewOf(stored) };
  }
  const next: StoredProfile = {
    ...stored,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    updatedAt: at,
    changes: [
      ...stored.changes,
      {
        at,
        actor,
        action: "identity-updated",
        detail: `${before} -> ${after}`,
      },
    ],
  };
  await writeStored(next);
  return { ok: true, profile: viewOf(next) };
}

function hashPassword(password: string): StoredPassword {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return {
    algorithm: "scrypt",
    saltHex: salt.toString("hex"),
    hashHex: hash.toString("hex"),
    updatedAt: new Date().toISOString(),
  };
}

function verifyPassword(password: string, stored: StoredPassword): boolean {
  const hash = scryptSync(password, Buffer.from(stored.saltHex, "hex"), 64);
  const expected = Buffer.from(stored.hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

export async function changePassword(
  input: PasswordInput,
  actor: string,
): Promise<ProfileWriteResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `A nova senha precisa ter entre ${PASSWORD_MIN_CHARS} e ${PASSWORD_MAX_CHARS} caracteres.`,
    };
  }
  const stored = await readStored();
  if (stored.password !== null) {
    const offered = parsed.data.current ?? "";
    if (offered.length === 0 || !verifyPassword(offered, stored.password)) {
      return {
        ok: false,
        reason: "A senha atual não confere, então nada foi alterado.",
      };
    }
  }
  const at = new Date().toISOString();
  const next: StoredProfile = {
    ...stored,
    password: hashPassword(parsed.data.next),
    updatedAt: at,
    changes: [
      ...stored.changes,
      {
        at,
        actor,
        action: stored.password === null ? "password-set" : "password-changed",
        detail: "Stored as a salted scrypt hash; the value never appears here.",
      },
    ],
  };
  await writeStored(next);
  return { ok: true, profile: viewOf(next) };
}

/* The magic numbers of the three accepted formats, checked on the bytes that
 * actually arrived, because a declared content type is a claim and not a fact. */
function sniffedType(bytes: Buffer): (typeof PHOTO_TYPES)[number] | null {
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length > 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const PHOTO_EXTENSION: Record<(typeof PHOTO_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function updatePhoto(
  bytes: Buffer,
  actor: string,
): Promise<ProfileWriteResult> {
  if (bytes.length === 0) {
    return { ok: false, reason: "Nenhum arquivo de imagem foi recebido." };
  }
  if (bytes.length > PHOTO_MAX_BYTES) {
    return {
      ok: false,
      reason: "A foto pode ter no máximo dois megabytes.",
    };
  }
  const type = sniffedType(bytes);
  if (type === null) {
    return {
      ok: false,
      reason: "A foto precisa ser um arquivo JPEG, PNG ou WebP.",
    };
  }
  const at = new Date().toISOString();
  const fileName = `avatar-${ulid()}.${PHOTO_EXTENSION[type]}`;
  await mkdir(PROFILE_DIR, { recursive: true });
  await writeFile(path.join(PROFILE_DIR, fileName), bytes);

  const stored = await readStored();
  const next: StoredProfile = {
    ...stored,
    photo: { fileName, contentType: type, bytes: bytes.length, updatedAt: at },
    updatedAt: at,
    changes: [
      ...stored.changes,
      {
        at,
        actor,
        action: "photo-updated",
        detail: `${stored.photo?.fileName ?? "persona"} -> ${fileName}, ${bytes.length} bytes`,
      },
    ],
  };
  await writeStored(next);
  return { ok: true, profile: viewOf(next) };
}

/* The bytes of the uploaded photo, for the route that serves it. Null when
 * the profile still shows the persona photo. */
export async function photoBytes(): Promise<{
  bytes: Buffer;
  contentType: string;
} | null> {
  const stored = await readStored();
  if (stored.photo === null) {
    return null;
  }
  /* The file name always comes from this module's own writer, never from the
   * request, so the read cannot be steered outside the profile folder. */
  const file = path.join(PROFILE_DIR, path.basename(stored.photo.fileName));
  try {
    return {
      bytes: await readFile(file),
      contentType: stored.photo.contentType,
    };
  } catch {
    return null;
  }
}
