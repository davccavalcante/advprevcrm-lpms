"use server";

import { currentSession } from "@/lib/trinity/nhe-actions";
import {
  runSecondReading,
  type SecondReading,
} from "@/lib/trinity/second-reading";

/*
 * The only door to the second reading: a deliberate click of the
 * Administration, never a schedule and never an automation. The session is
 * resolved here, on the server, and the reading itself refuses any role that
 * is not the administration's.
 */
export async function requestSecondReading(): Promise<SecondReading> {
  const session = await currentSession();
  return runSecondReading(session);
}
