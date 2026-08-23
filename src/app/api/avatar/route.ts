import { photoBytes } from "@/lib/office-profile";

/*
 * Serves the uploaded account photo. The bytes live under `data/`, outside
 * the repository and outside `public/`, because a personal photo is personal
 * data and never enters version control. Without an uploaded photo the route
 * answers 404 and the interface falls back to the persona image.
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
