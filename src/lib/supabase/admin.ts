import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "@/lib/supabase/server";

/*
 * The service role client. It bypasses row level security, so it is never used
 * to answer a screen: it exists for the few operations that are about the
 * office itself rather than about a case, creating the first account of the
 * administration and reading a stored object back to serve its bytes.
 *
 * It is server only and it never reaches a browser. A component that imported
 * this module would break the build, which is the guarantee being structural
 * rather than remembered.
 */
export function adminSupabase() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
