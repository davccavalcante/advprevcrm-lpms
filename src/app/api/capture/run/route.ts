import type { NextRequest } from "next/server";
import { runDjenCapture } from "@/lib/capture/runner";

/*
 * The door the scheduler knocks on, once a day, from the server of the office.
 *
 * It exists so the capture is not a button somebody has to remember to press:
 * the DJEN is a consultation and never a notification, so if nobody asks, the
 * office learns of a publication only when the deadline is gone.
 *
 * The call runs here, on the server, exactly like the button does. Nothing about
 * this route reaches a court from a browser, and nothing here accepts a URL from
 * the request: the sources are configuration and the caller only says "run".
 *
 * It is protected by a shared secret. With no secret configured the route
 * refuses to run at all, because an open endpoint that spends the quota of a
 * public API is a gift to whoever finds it.
 */

export const dynamic = "force-dynamic";

function refuse(status: number, message: string): Response {
  return Response.json(
    { ok: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret === undefined || secret.length === 0) {
    return refuse(
      503,
      "O agendamento não está configurado nesta instalação. Defina CRON_SECRET no ambiente.",
    );
  }

  const offered = request.headers.get("authorization")?.trim() ?? "";
  const expected = `Bearer ${secret}`;
  if (offered.length !== expected.length || offered !== expected) {
    return refuse(401, "Credencial de agendamento inválida.");
  }

  const outcome = await runDjenCapture();
  return Response.json(outcome, {
    status: outcome.ok ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
