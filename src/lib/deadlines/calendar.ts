import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";

/*
 * The days on which a procedural deadline does not run.
 *
 * Nothing here is a literal in code. The national holidays, the year end recess
 * and every court adjustment live in `config/court-calendars.yaml`, each one
 * naming the law or the act it comes from, because a legal value that changes
 * over time is a record with a source and a date.
 *
 * Article 216 of the Code of Civil Procedure is what makes this file part of the
 * calculation: besides those declared by law, Saturdays, Sundays and the days
 * with no forensic expedient are feriados for forensic purposes. There is no
 * unified public source of the days without expedient in Brazil, so a court
 * whose calendar the office has not reviewed is reported as such, on screen,
 * every time it takes part in a calculation.
 */

const CONFIG_FILE = path.join(process.cwd(), "config", "court-calendars.yaml");

const adjustmentSchema = z.object({
  /* The calendar date, YYYY-MM-DD, this adjustment applies to. */
  date: z.string(),
  kind: z.enum(["holiday", "suspension", "expedient"]),
  reason: z.string(),
  source: z.string(),
  recordedBy: z.string(),
  recordedAt: z.string(),
});

const calendarSchema = z.object({
  version: z.number(),
  capturedAt: z.string(),
  sources: z.array(z.string()).default([]),
  nationalHolidays: z
    .array(z.object({ day: z.string(), name: z.string(), source: z.string() }))
    .default([]),
  yearEndRecess: z.object({
    start: z.string(),
    end: z.string(),
    sources: z.array(z.string()).default([]),
    review: z.string().optional(),
  }),
  courts: z
    .array(
      z.object({
        sigla: z.string(),
        name: z.string(),
        reviewed: z.boolean().default(false),
        adjustments: z.array(adjustmentSchema).default([]),
      }),
    )
    .default([]),
});

export type CourtCalendars = z.infer<typeof calendarSchema>;
export type CourtAdjustment = z.infer<typeof adjustmentSchema>;

let cached: CourtCalendars | null = null;

export function courtCalendars(): CourtCalendars {
  if (cached === null) {
    cached = calendarSchema.parse(parse(readFileSync(CONFIG_FILE, "utf8")));
  }
  return cached;
}

/* Only the tests need this: the configuration is read once per process. */
export function resetCalendarCache(): void {
  cached = null;
}

/*
 * A calendar date, with no hour and no zone. Deadline arithmetic is done on
 * dates and never on instants: an hour in the arithmetic is a bug waiting for
 * the first daylight saving change or the first server in another zone.
 */
export type CalendarDate = string;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && toDate(parsed) === value;
}

function toDate(value: Date): CalendarDate {
  return value.toISOString().slice(0, 10);
}

function asUtc(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const moved = asUtc(date);
  moved.setUTCDate(moved.getUTCDate() + days);
  return toDate(moved);
}

export function weekdayOf(date: CalendarDate): number {
  return asUtc(date).getUTCDay();
}

/* Brazilian date, the way it is written on a screen of this office. */
export function brDate(date: CalendarDate): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export type NonBusinessReason = {
  reason: string;
  source: string;
};

function monthDay(date: CalendarDate): string {
  return date.slice(5);
}

/*
 * Whether the year end recess of article 220 of the Code of Civil Procedure, and
 * of article 775-A of the Consolidation of Labour Laws, covers this date. The
 * window crosses the turn of the year, so it is read as two open ends.
 */
export function inYearEndRecess(date: CalendarDate): boolean {
  const { yearEndRecess } = courtCalendars();
  const current = monthDay(date);
  return current >= yearEndRecess.start || current <= yearEndRecess.end;
}

export function courtEntry(sigla: string | null) {
  if (sigla === null) {
    return null;
  }
  const wanted = sigla.trim().toUpperCase();
  return (
    courtCalendars().courts.find(
      (court) => court.sigla.toUpperCase() === wanted,
    ) ?? null
  );
}

/*
 * The single question every counting rule asks. It answers with the reason,
 * because the office has to show the lawyer which day was skipped and why.
 */
export function nonBusinessReason(
  date: CalendarDate,
  options: { court?: string | null; applyRecess?: boolean } = {},
): NonBusinessReason | null {
  const calendars = courtCalendars();
  const court = courtEntry(options.court ?? null);

  /* An adjustment of the court is the most specific record there is, so it
   * answers first, in both directions: it may create a non business day and it
   * may declare that there was expedient on a day that would otherwise be one. */
  const adjustment = court?.adjustments.find((entry) => entry.date === date);
  if (adjustment) {
    if (adjustment.kind === "expedient") {
      return null;
    }
    return { reason: adjustment.reason, source: adjustment.source };
  }

  const weekday = weekdayOf(date);
  if (weekday === 0) {
    return {
      reason: "domingo",
      source: "Código de Processo Civil, artigo 216",
    };
  }
  if (weekday === 6) {
    return {
      reason: "sábado",
      source: "Código de Processo Civil, artigo 216",
    };
  }

  const holiday = calendars.nationalHolidays.find(
    (entry) => entry.day === monthDay(date),
  );
  if (holiday) {
    return { reason: holiday.name, source: holiday.source };
  }

  if ((options.applyRecess ?? true) && inYearEndRecess(date)) {
    return {
      reason: "suspensão de fim de ano",
      source: calendars.yearEndRecess.sources.join("; "),
    };
  }

  return null;
}

export function isBusinessDay(
  date: CalendarDate,
  options: { court?: string | null; applyRecess?: boolean } = {},
): boolean {
  return nonBusinessReason(date, options) === null;
}

export function nextBusinessDay(
  date: CalendarDate,
  options: { court?: string | null; applyRecess?: boolean } = {},
): CalendarDate {
  let current = addDays(date, 1);
  /* A guard, never a limit of the rule: the recess is thirty two days and the
   * longest run of non business days in Brazil is far shorter than this. */
  for (let step = 0; step < 400; step += 1) {
    if (isBusinessDay(current, options)) {
      return current;
    }
    current = addDays(current, 1);
  }
  throw new Error("no business day found within four hundred days");
}

/* The court is known but the office has not reviewed its calendar, so the
 * calculation is honest about being incomplete. */
export function calendarReviewed(sigla: string | null): boolean {
  return courtEntry(sigla)?.reviewed ?? false;
}
