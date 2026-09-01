import "server-only";
import { ulid } from "ulid";
import { z } from "zod";
import { serverSupabase } from "@/lib/supabase/server";

/*
 * The account that operates this installation: name, electronic address,
 * password and photo. All four live in Supabase, the first three in the profile
 * row and in the authentication service, the photo in a private bucket, and not
 * one of them in a file on the server any more.
 *
 * The password is the real credential now. It is changed at the authentication
 * service, it is never stored by this application, and this application never
 * sees it: changing it requires proving the current one, which is done by
 * exchanging it for a session and discarding that session immediately.
 *
 * Every change appends an immutable line to the audit trail, with author, field
 * and moment. Password material never appears there; the action name is the
 * whole record of it.
 */

const AVATARS_BUCKET = "avatars";

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

/* What the screens receive. No token, no storage path, nothing of the credential. */
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

const TEAM_LABELS: Record<string, { team: string; role: string }> = {
  administration: {
    team: "Administração",
    role: "Administração do escritório",
  },
  intake: { team: "Atendimento", role: "Atendimento e triagem" },
  lawyer: { team: "Advogados", role: "Advogado responsável" },
  finance: { team: "Financeiro", role: "Financeiro" },
};

const EMPTY_VIEW: OfficeProfileView = {
  firstName: "",
  lastName: "",
  fullName: "",
  email: "",
  role: "",
  team: "",
  avatarSrc: "",
  passwordSet: false,
  updatedAt: null,
};

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  team: string;
  avatar_path: string | null;
  updated_at: string | null;
};

function viewOf(row: ProfileRow): OfficeProfileView {
  const fullName = `${row.first_name} ${row.last_name}`.trim();
  const labels = TEAM_LABELS[row.team] ?? { team: row.team, role: row.team };
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    fullName,
    email: row.email,
    role: labels.role,
    team: labels.team,
    /* The photo is served by the application's own route, never by a link that
     * outlives a session. An account with no photo shows its initials, which is
     * the honest state of an office that has just started. */
    avatarSrc: row.avatar_path
      ? `/api/avatar?v=${encodeURIComponent(row.updated_at ?? "")}`
      : "",
    /* An account only exists here because it exists at the authentication
     * service, and there it always carries a credential. */
    passwordSet: true,
    updatedAt: row.updated_at,
  };
}

async function currentRow(): Promise<ProfileRow | null> {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, team, avatar_path, updated_at")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  return data ?? null;
}

export async function officeProfile(): Promise<OfficeProfileView> {
  const row = await currentRow();
  return row ? viewOf(row) : EMPTY_VIEW;
}

export type ProfileWriteResult =
  | { ok: true; profile: OfficeProfileView }
  | { ok: false; reason: string };

async function audit(
  actor: string,
  action: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("audit_events").insert({
    id: ulid(),
    actor,
    actor_id: user?.id ?? null,
    action,
    entity: "profile",
    entity_id: user?.id ?? null,
    before: before === null ? null : (before as object),
    after: after === null ? null : (after as object),
  });
}

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
  const row = await currentRow();
  if (!row) {
    return { ok: false, reason: "Nenhuma sessão ativa." };
  }

  const supabase = await serverSupabase();
  const at = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      updated_at: at,
    })
    .eq("id", row.id);
  if (error) {
    return { ok: false, reason: "Não foi possível gravar a alteração." };
  }

  /* The address of the account changes at the authentication service too, so a
   * sign in and a profile never disagree about who this member is. */
  if (parsed.data.email !== row.email) {
    await supabase.auth.updateUser({ email: parsed.data.email });
  }

  await audit(
    actor,
    "identity-updated",
    { firstName: row.first_name, lastName: row.last_name, email: row.email },
    parsed.data,
  );

  const next = await currentRow();
  return next
    ? { ok: true, profile: viewOf(next) }
    : { ok: false, reason: "Alteração gravada, mas o perfil não foi lido." };
}

export async function changePassword(
  input: PasswordInput,
  actor: string,
): Promise<ProfileWriteResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `A nova senha precisa ter ao menos ${PASSWORD_MIN_CHARS} caracteres.`,
    };
  }
  const row = await currentRow();
  if (!row) {
    return { ok: false, reason: "Nenhuma sessão ativa." };
  }

  const supabase = await serverSupabase();

  /* The current password is proved, never compared: it is exchanged for a
   * session at the authentication service, which is the only place that knows
   * it, and the session obtained this way is discarded at once. */
  if (parsed.data.current !== undefined && parsed.data.current.length > 0) {
    const proof = await supabase.auth.signInWithPassword({
      email: row.email,
      password: parsed.data.current,
    });
    if (proof.error) {
      return { ok: false, reason: "A senha atual não confere." };
    }
  } else {
    return { ok: false, reason: "Informe a senha atual para poder trocá-la." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.next,
  });
  if (error) {
    return { ok: false, reason: "Não foi possível trocar a senha." };
  }

  await supabase
    .from("profiles")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", row.id);

  /* The action is the whole record. No password material is ever written to the
   * trail, in clear or in any other form. */
  await audit(actor, "password-changed", null, null);

  const next = await currentRow();
  return next
    ? { ok: true, profile: viewOf(next) }
    : { ok: false, reason: "Senha trocada, mas o perfil não foi lido." };
}

/* The type is decided by the bytes themselves, never by what the browser said
 * the file was. */
function sniffedType(bytes: Buffer): (typeof PHOTO_TYPES)[number] | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
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
    return { ok: false, reason: "A foto pode ter no máximo dois megabytes." };
  }
  const type = sniffedType(bytes);
  if (type === null) {
    return {
      ok: false,
      reason: "A foto precisa ser um arquivo JPEG, PNG ou WebP.",
    };
  }
  const row = await currentRow();
  if (!row) {
    return { ok: false, reason: "Nenhuma sessão ativa." };
  }

  const supabase = await serverSupabase();
  const at = new Date().toISOString();
  /* The object sits under the identifier of the account, which is what the
   * storage policy checks, so one member can never write over another's photo. */
  const objectPath = `${row.id}/avatar-${ulid()}.${PHOTO_EXTENSION[type]}`;
  const upload = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(objectPath, bytes, { contentType: type, upsert: false });
  if (upload.error) {
    return { ok: false, reason: "Não foi possível guardar a foto." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: objectPath, updated_at: at })
    .eq("id", row.id);
  if (error) {
    await supabase.storage.from(AVATARS_BUCKET).remove([objectPath]);
    return { ok: false, reason: "Não foi possível gravar a foto no perfil." };
  }

  if (row.avatar_path) {
    await supabase.storage.from(AVATARS_BUCKET).remove([row.avatar_path]);
  }

  await audit(
    actor,
    "photo-updated",
    { photo: row.avatar_path ?? "none" },
    { photo: objectPath, bytes: bytes.length },
  );

  const next = await currentRow();
  return next
    ? { ok: true, profile: viewOf(next) }
    : { ok: false, reason: "Foto guardada, mas o perfil não foi lido." };
}

/* The bytes of the photo, for the route that serves it. Null when the account
 * has no photo, which is how every account of a new installation starts. */
export async function photoBytes(): Promise<{
  bytes: Buffer;
  contentType: string;
} | null> {
  const row = await currentRow();
  if (!row?.avatar_path) {
    return null;
  }
  const supabase = await serverSupabase();
  const download = await supabase.storage
    .from(AVATARS_BUCKET)
    .download(row.avatar_path);
  if (download.error || !download.data) {
    return null;
  }
  return {
    bytes: Buffer.from(await download.data.arrayBuffer()),
    contentType: download.data.type || "application/octet-stream",
  };
}
