import { photoBytes } from "@/lib/office-profile";

/*
 * Serves the uploaded account photo. The bytes live in a private bucket of the
 * office database, never in the repository and never in `public/`, because a
 * personal photo is personal data. Without an uploaded photo the route answers
 * 404 and the interface shows the initials of the account.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const photo = await photoBytes();
  if (photo === null) {
    return new Response(null, { status: 404 });
  }
  return new Response(new Uint8Array(photo.bytes), {
    status: 200,
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "no-store",
    },
  });
}
