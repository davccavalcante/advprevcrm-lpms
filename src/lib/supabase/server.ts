import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/*
 * The client every server component, server action and route handler of this
 * office uses. It carries the session of the person who is asking, read from
 * the request cookies, so every statement it sends reaches Postgres as that
 * person and the row level security policies decide what comes back.
 *
 * This is the whole point of using the session client instead of the service
 * role on the screens: the rule that a lawyer sees exclusively his own cases
 * lives in the database, and the interface only reflects it. A screen that
 * asked with the service role would bypass the rule and the guarantee would
 * become a promise.
 */
export async function serverSupabase() {
  const store = await cookies();

  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(written) {
          /* A server component cannot write a cookie, and that is not an error
           * here: the middleware refreshes the session on every request, so the
           * refreshed cookie is written there and this call has nothing left to
           * do. Swallowing it keeps a read from throwing over a write that
           * already happened. */
          try {
            for (const { name, value, options } of written) {
              store.set(name, value, options);
            }
          } catch {
            /* Written by the middleware instead. */
          }
        },
      },
    },
  );
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not configured. The application talks to no database without it, and it refuses to pretend otherwise.`,
    );
  }
  return value;
}
