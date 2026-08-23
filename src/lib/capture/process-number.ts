/*
 * The unified number of a Brazilian judicial process, NNNNNNN-DD.AAAA.J.TR.OOOO.
 *
 * It is the only key that links a communication to a case without a human
 * deciding anything, so it is validated and never merely trimmed: the two check
 * digits are the ninety seven modulus of the rest, and a number that fails them
 * is not a process number, it is a typing mistake or a bad reading.
 *
 * The segments also say which justice and which court the process belongs to,
 * which is what lets the office reach the right DataJud endpoint without anyone
 * choosing it by hand.
 */

export type ProcessNumberParts = {
  sequential: string;
  check: string;
  year: string;
  /* Segment of the justice: 4 is the Federal Justice, 5 the Labour Justice, 8
   * the State Justice, and so on, per the numbering resolution of the National
   * Council of Justice. */
  justice: string;
  court: string;
  origin: string;
};

const FORMATTED = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/;

export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

export function partsOf(value: string): ProcessNumberParts | null {
  const digits = digitsOf(value);
  if (digits.length !== 20) {
    return null;
  }
  return {
    sequential: digits.slice(0, 7),
    check: digits.slice(7, 9),
    year: digits.slice(9, 13),
    justice: digits.slice(13, 14),
    court: digits.slice(14, 16),
    origin: digits.slice(16, 20),
  };
}

/*
 * The check digits, by the ninety seven modulus. The number is read without its
 * two check digits, multiplied by one hundred, and the remainder subtracted from
 * ninety eight is what those two digits must be.
 */
export function expectedCheckDigits(parts: ProcessNumberParts): string {
  const base = `${parts.sequential}${parts.year}${parts.justice}${parts.court}${parts.origin}00`;
  let remainder = 0;
  for (const character of base) {
    remainder = (remainder * 10 + Number(character)) % 97;
  }
  return String(98 - remainder).padStart(2, "0");
}

export function isValidProcessNumber(value: string): boolean {
  const parts = partsOf(value);
  if (parts === null) {
    return false;
  }
  return expectedCheckDigits(parts) === parts.check;
}

export function formatProcessNumber(value: string): string | null {
  const parts = partsOf(value);
  if (parts === null) {
    return null;
  }
  return `${parts.sequential}-${parts.check}.${parts.year}.${parts.justice}.${parts.court}.${parts.origin}`;
}

/* The form the office stores and compares by: twenty digits, nothing else. Two
 * writings of the same number, one with punctuation and one without, must never
 * become two different cases. */
export function canonicalProcessNumber(value: string): string | null {
  return isValidProcessNumber(value) ? digitsOf(value) : null;
}

const PROCESS_IN_TEXT = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b|\b\d{20}\b/g;

/* Every process number written in a text, deduplicated and validated. */
export function processNumbersIn(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.match(PROCESS_IN_TEXT) ?? []) {
    const canonical = canonicalProcessNumber(match);
    if (canonical !== null) {
      found.add(canonical);
    }
  }
  return [...found];
}

export function isFormattedProcessNumber(value: string): boolean {
  return FORMATTED.test(value.trim());
}
