"use server";

import { revalidatePath } from "next/cache";
import {
  changePassword,
  type OfficeProfileView,
  officeProfile,
  type ProfileWriteResult,
  updateIdentity,
  updatePhoto,
} from "@/lib/office-profile";
import { currentSession } from "@/lib/trinity/nhe-actions";

/*
 * The only doors through which the settings screen changes the account
 * profile. Every action resolves the session on the server, validates on the
 * server, and revalidates the whole tree, because the name and the photo
 * appear on every screen.
 */

async function actorName(): Promise<string> {
  const session = await currentSession();
  return session.lawyerName;
}

function refresh(): void {
  revalidatePath("/", "layout");
}

export async function readProfileAction(): Promise<OfficeProfileView> {
  return officeProfile();
}

export async function updateIdentityAction(input: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<ProfileWriteResult> {
  const result = await updateIdentity(input, await actorName());
  if (result.ok) {
    refresh();
  }
  return result;
}

export async function changePasswordAction(input: {
  current?: string;
  next: string;
}): Promise<ProfileWriteResult> {
  const result = await changePassword(
    {
      ...(input.current === undefined || input.current.length === 0
        ? {}
        : { current: input.current }),
      next: input.next,
    },
    await actorName(),
  );
  if (result.ok) {
    refresh();
  }
  return result;
}

export async function updatePhotoAction(
  form: FormData,
): Promise<ProfileWriteResult> {
  const entry = form.get("photo");
  if (!(entry instanceof File)) {
    return { ok: false, reason: "Nenhum arquivo de imagem foi recebido." };
  }
  const bytes = Buffer.from(await entry.arrayBuffer());
  const result = await updatePhoto(bytes, await actorName());
  if (result.ok) {
    refresh();
  }
  return result;
}
