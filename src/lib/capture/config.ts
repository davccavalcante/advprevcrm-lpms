/*
 * Where the capture reads its configuration. No registration number, no key, no
 * endpoint and no court alias is ever written in code: all of it comes from the
 * environment or from a versioned configuration file.
 */

function fromEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function djenBaseUrl(): string | null {
  return fromEnv("DJEN_BASE_URL");
}

export function datajudBaseUrl(): string | null {
  return fromEnv("DATAJUD_BASE_URL");
}

export function datajudApiKey(): string | null {
  return fromEnv("DATAJUD_API_KEY");
}

export type MonitoredOab = {
  /* The registration number, digits only. */
  number: string;
  /* The federative unit of the registration, two letters. */
  uf: string;
  label: string;
  active: boolean;
};

/*
 * The registrations the office watches at the DJEN. It is a list from the first
 * day, because the real data already shows a second lawyer on the same case, and
 * a list that starts as a single value is a migration waiting to happen.
 *
 * `MONITORED_OAB_NUMBER` and `MONITORED_OAB_UF` carry the registration in force.
 * `MONITORED_OAB_ADDITIONAL` carries the others, separated by commas, each one
 * written as the federative unit followed by the number, for example SP530198.
 */
export function monitoredOabs(): MonitoredOab[] {
  const list: MonitoredOab[] = [];
  const number = fromEnv("MONITORED_OAB_NUMBER");
  const uf = fromEnv("MONITORED_OAB_UF");
  if (number !== null && uf !== null) {
    list.push({
      number: number.replace(/\D/g, ""),
      uf: uf.toUpperCase(),
      label: `OAB/${uf.toUpperCase()} ${number}`,
      active: true,
    });
  }
  for (const entry of (fromEnv("MONITORED_OAB_ADDITIONAL") ?? "").split(",")) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z]{2})\s*-?\s*(\d+)$/);
    if (!match?.[1] || !match[2]) {
      continue;
    }
    const additionalUf = match[1].toUpperCase();
    const additionalNumber = match[2];
    if (
      list.some(
        (existing) =>
          existing.number === additionalNumber && existing.uf === additionalUf,
      )
    ) {
      continue;
    }
    list.push({
      number: additionalNumber,
      uf: additionalUf,
      label: `OAB/${additionalUf} ${additionalNumber}`,
      active: true,
    });
  }
  return list;
}

export function activeOabs(): MonitoredOab[] {
  return monitoredOabs().filter((entry) => entry.active);
}

/* How many days of availability a scheduled run asks for. The window overlaps
 * the previous run on purpose, because the fingerprint of each act stops a
 * second record and an overlap is how a day that failed comes back. */
export function captureWindowDays(): number {
  const raw = fromEnv("DJEN_CAPTURE_WINDOW_DAYS");
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 7;
}
