"use client";
import { createBrowserClient } from "@supabase/ssr";

/*
 * The only client that runs in the browser of a member of the office, and it
 * carries the publishable key, which is public by design and safe there because
 * every table has row level security enabled and no policy is permissive by
 * default. It exists for one purpose, the sign in form, because a password is
 * exchanged for a session directly with the authentication service and never
 * travels through this application.
 */
export function browserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}
