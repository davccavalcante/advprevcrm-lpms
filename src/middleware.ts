import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/*
 * Two jobs, both of which have to happen before a screen renders.
 *
 * The session is refreshed on every request, because an access token expires
 * and a server component cannot write the refreshed cookie back. Doing it here
 * is what keeps a working session from silently becoming an expired one in the
 * middle of an afternoon.
 *
 * And nothing of the office is served to an unauthenticated request. This is
 * not the access rule, which lives in the database as row level security; it is
 * the door, so a browser that never signed in does not even reach a query.
 */

const PUBLIC_PATHS = ["/entrar", "/login", "/auth"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    /* Unconfigured is not the same as unauthenticated. The application says so
     * on the screen it serves instead of redirecting into a loop. */
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(written) {
        for (const { name, value } of written) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of written) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (candidate) => path === candidate || path.startsWith(`${candidate}/`),
  );

  if (!user && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = "/entrar";
    target.searchParams.set("origem", path);
    return NextResponse.redirect(target);
  }

  if (user && (path === "/entrar" || path === "/login")) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  /* Everything except the static assets and the image optimiser, which carry no
   * session and would only cost latency. */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/capture|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
