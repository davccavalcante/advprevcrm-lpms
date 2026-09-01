"use server";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

/*
 * Leaving the system. The session is destroyed at the authentication service
 * and the cookie goes with it, so a browser left open on a shared machine
 * cannot be used to reopen a case.
 */
export async function signOut(): Promise<never> {
  const supabase = await serverSupabase();
  await supabase.auth.signOut();
  redirect("/entrar");
}

/*
 * Who is asking, for the screens that need to name the member of the office.
 * It returns null instead of throwing when there is no session, because the
 * sign in screen itself renders through the same layout.
 */
export async function currentMember() {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, team, oab_registration, avatar_path",
    )
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}
