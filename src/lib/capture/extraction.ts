import type { ExtractedAct } from "@/lib/capture/communication";
import { processNumbersIn } from "@/lib/capture/process-number";

/*
 * Reading a communication by rule, which is the whole cost discipline of this
 * block: a process number, a registration number, a date, an hour and a
 * deadline written as "no prazo de 15 (quinze) dias" all follow a shape, and a
 * shape costs nothing to recognise. The model is only ever asked about what is
 * left, and the record says exactly what that was, so the office can see how
 * little it is.
 *
 * Every field carries the excerpt it came from. A lawyer who disagrees with an
 * extracted value has to be able to see the words that produced it, in the text
 * of the act, without opening anything else.
 */

const EXCERPT = 220;

function excerptAt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + length + 60);
  return `${start > 0 ? "..." : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "..." : ""}`.slice(
    0,
    EXCERPT,
  );
}

/*
 * The same text in the shapes a rule may need. A certificate rendered to text
 * carries hard line breaks in the middle of words, and a heading may come with
 * one space between every letter, which is how "ATO ORDINATÓRIO" arrives as
 * "A T O O R D I N A T Ó R I O".
 */
export function textVariants(text: string): {
  flat: string;
  unwrapped: string;
  squeezed: string;
} {
  const plain = fromHtml(text);
  const flat = plain.replace(/\s+/g, " ").trim();
  return {
    flat,
    unwrapped: plain
      .replace(/\n/g, "")
      .replace(/[ \t]+/g, " ")
      .trim(),
    squeezed: flat
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, ""),
  };
}

/*
 * Several courts send the act as HTML. Measured on 2026-08-12 over the live
 * corpus: the São Paulo court and the fourth federal region deliver
 * "15 (quinze) dias &uacute;teis" inside `<strong>` tags, and every rule of this
 * file was reading blind through the markup. The text of the act is stored
 * exactly as it arrived, because it is the official document; only the reading
 * decodes it.
 */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  agrave: "à",
  atilde: "ã",
  otilde: "õ",
  ccedil: "ç",
  acirc: "â",
  ecirc: "ê",
  ocirc: "ô",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Atilde: "Ã",
  Otilde: "Õ",
  Ccedil: "Ç",
  Acirc: "Â",
  Ecirc: "Ê",
  Ocirc: "Ô",
};

export function fromHtml(text: string): string {
  if (!/[<&]/.test(text)) {
    return text;
  }
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, " ")
    .replace(/<[^>]{1,200}>/g, "")
    .replace(/&#(\d{1,6});/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(
      /&([a-zA-Z]{2,8});/g,
      (whole, name: string) => ENTITIES[name] ?? whole,
    );
}

type Hit = { value: string; excerpt: string };

function firstMatch(
  variants: { flat: string; unwrapped: string },
  pattern: RegExp,
  group = 0,
): Hit | null {
  for (const candidate of [variants.flat, variants.unwrapped]) {
    const match = candidate.match(pattern);
    if (match?.index !== undefined && match[group] !== undefined) {
      return {
        value: match[group],
        excerpt: excerptAt(candidate, match.index, match[0].length),
      };
    }
  }
  return null;
}

/* Numbers written out, as an act writes them. Only the ones a procedural
 * deadline actually uses; anything else stays in the residue instead of being
 * guessed. */
const WRITTEN_NUMBERS: Record<string, number> = {
  um: 1,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  quinze: 15,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  quarentaecinco: 45,
  sessenta: 60,
  noventa: 90,
};

function writtenNumber(word: string): number | null {
  const key = word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  return WRITTEN_NUMBERS[key] ?? null;
}

/*
 * The deadline in days. Ranked on purpose: an act says "no prazo de" when it
 * opens a deadline, and says "dias antes" when it is giving an instruction. The
 * office prefers the first shape and records every distinct value it saw, so an
 * act carrying two different deadlines is marked as ambiguous instead of being
 * silently resolved.
 */
export function extractDays(text: string): {
  days: number | null;
  source: string | null;
  candidates: number[];
  ambiguous: boolean;
  /* A deadline written in the act whose counting starts at another event, such
   * as the expert examination, and not at the publication. The office does not
   * compute it, because computing it from the publication would produce a wrong
   * date; it goes to the lawyer. Measured on the fourth federal region: "em até
   * 10 (dez) dias úteis, após a perícia". */
  otherStartingEvent: boolean;
} {
  const variants = textVariants(text);
  const ranked: { pattern: RegExp; weight: number }[] = [
    /* The word "prazo" and a number close to it, which is how every court of
     * this office opens a deadline. Measured against the live service on
     * 2026-08-12 over one hundred and sixty one real acts: "no prazo de 15
     * (quinze) dias" of the third federal region, "Prazo: 15 dias." and "Prazo
     * 15 dias." of the São Paulo court, "no prazo comum de 10 (dez) dias", and
     * even "no prazo de 2 (dias) úteis", which the court itself wrote wrong. The
     * lookahead keeps "dias úteis antes da perícia", an instruction, out. */
    {
      pattern:
        /\bprazo\b[^.]{0,25}?\b(\d{1,3})\s*(?:\(([^)]{2,30})\))?\s*(?:dias?|[úu]teis)\b(?!\s+(?:antes|ap[óo]s))/gi,
      weight: 3,
    },
    {
      pattern:
        /\bprazo\b[^.]{0,25}?\b([a-zçãéêíóúâ]{3,12})\s+dias?\b(?!\s+(?:antes|ap[óo]s))/gi,
      weight: 3,
    },
    /* Measured on the same corpus: the first federal court of Americana opens
     * deadlines writing "Vista à parte autora para em quinze dias apresentar
     * réplica", with no "prazo" anywhere in the act. Three real acts of the same
     * process were left with no deadline at all until this was recognised, which
     * is the most damaging defect this system can have. */
    {
      pattern:
        /\bem\s+(?:at[ée]\s+)?(\d{1,3})\s*(?:\(([^)]{2,30})\))?\s*(?:dias?|[úu]teis)\b(?!\s+(?:antes|ap[óo]s))/gi,
      weight: 2,
    },
    {
      pattern:
        /\bem\s+([a-zçãéêíóúâ]{3,12})\s+dias?\b(?!\s+(?:antes|ap[óo]s))/gi,
      weight: 2,
    },
    {
      pattern:
        /\bdentro\s+de\s+(\d{1,3}|[a-zçãéêíóúâ]{3,12})\s+dias?\b(?!\s+antes)/gi,
      weight: 2,
    },
  ];

  const found: { days: number; weight: number; excerpt: string }[] = [];
  let otherStartingEvent = false;
  for (const { pattern, weight } of ranked) {
    for (const candidate of [variants.flat, variants.unwrapped]) {
      let matchedHere = false;
      for (const match of candidate.matchAll(pattern)) {
        const first = match[1];
        if (first === undefined) {
          continue;
        }
        const numeric = /^\d+$/.test(first)
          ? Number(first)
          : writtenNumber(first);
        if (numeric === null || !Number.isFinite(numeric) || numeric <= 0) {
          continue;
        }
        /* When the act writes the number twice, in digits and in words, the two
         * must agree. They disagreeing is exactly the ambiguity a human has to
         * resolve, never the machine. */
        const written = match[2] === undefined ? null : writtenNumber(match[2]);
        if (written !== null && written !== numeric) {
          continue;
        }
        /* A deadline counted from another event is not this deadline. */
        const after = candidate.slice(
          (match.index ?? 0) + match[0].length,
          (match.index ?? 0) + match[0].length + 40,
        );
        if (OTHER_EVENT.test(after)) {
          otherStartingEvent = true;
          continue;
        }
        matchedHere = true;
        found.push({
          days: numeric,
          weight,
          excerpt: excerptAt(candidate, match.index ?? 0, match[0].length),
        });
      }
      /* One variant of the text is enough for this pattern; reading the second
       * would count the same sentence twice. */
      if (matchedHere) {
        break;
      }
    }
  }

  /* Only the strongest shape that appeared is considered. An act that opens a
   * deadline says "no prazo de", and a sentence that merely mentions days is
   * not allowed to compete with it. */
  const bestWeight = found.reduce(
    (top, entry) => Math.max(top, entry.weight),
    0,
  );
  const strongest = found.filter((entry) => entry.weight === bestWeight);

  const candidates = [...new Set(strongest.map((entry) => entry.days))];
  const best = strongest[0] ?? null;
  return {
    days: best?.days ?? null,
    source: best?.excerpt ?? null,
    candidates,
    ambiguous: candidates.length > 1,
    otherStartingEvent,
  };
}

/* The counting starts at an event that is not the publication. */
const OTHER_EVENT =
  /^[\s,;]*(?:[úu]teis[\s,;]*)?ap[óo]s\s+(?:a\s+|o\s+)?(?:per[íi]cia|realiza|audi[êe]ncia|juntada|intima|sess[ãa]o|tr[âa]nsito)/i;

/*
 * Whether the act writes any quantity of time at all. It is what separates an
 * act that legitimately carries no deadline from an act whose deadline the rules
 * did not recognise, and the second one has to reach a human. Written with a
 * quantity in front on purpose: the surname "Dias" of a lawyer and the word
 * "mídias" match a bare "dias" and would flood the office with false alarms.
 */
const TIME_QUANTITY =
  /\b\d{1,3}\s*(?:\([^)]{2,30}\))?\s*(?:dias?|[úu]teis|horas?)\b|\b(?:um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|quinze|vinte|trinta|quarenta|sessenta|noventa)\s+dias?\b/i;

export function mentionsTimeQuantity(text: string): boolean {
  return TIME_QUANTITY.test(textVariants(text).flat);
}

/* The kind of act. The heading inside the text wins over the field of the
 * payload, because the heading is what the judge wrote. */
const ACT_TYPES: { id: string; label: string; squeezed: string }[] = [
  {
    id: "ato-ordinatorio",
    label: "Ato ordinatório",
    squeezed: "ATOORDINATORIO",
  },
  { id: "sentenca", label: "Sentença", squeezed: "SENTENCA" },
  { id: "despacho", label: "Despacho", squeezed: "DESPACHO" },
  { id: "decisao", label: "Decisão", squeezed: "DECISAO" },
  {
    id: "citacao-intimacao",
    label: "Citação e intimação",
    squeezed: "CITACAOEINTIMACAO",
  },
  { id: "citacao", label: "Citação", squeezed: "CITACAO" },
  { id: "intimacao", label: "Intimação", squeezed: "INTIMACAO" },
  { id: "edital", label: "Edital", squeezed: "EDITAL" },
];

export function extractActType(
  text: string,
  documentType: string | null,
): { actType: string | null; source: string | null } {
  const variants = textVariants(text);
  for (const entry of ACT_TYPES) {
    if (variants.squeezed.includes(entry.squeezed)) {
      return {
        actType: entry.label,
        source: `Expressão "${entry.label}" encontrada no texto do ato.`,
      };
    }
  }
  if (documentType !== null && documentType.trim().length > 0) {
    return {
      actType: documentType.trim(),
      source: "Tipo informado pelo próprio DJEN na comunicação.",
    };
  }
  return { actType: null, source: null };
}

/* What the act asks the office to do. */
const OBJECTS: { label: string; pattern: RegExp }[] = [
  /* The real acts of this office write the same obligation in more than one
   * shape: "manifestação acerca do laudo", "se manifestar sobre o laudo
   * pericial", and "manifestação em quinze dias sobre a produção de outras
   * provas". Measured on 2026-08-12 against the live service. */
  {
    label: "Manifestação sobre outras provas",
    pattern:
      /manifesta\w*[^.]{0,60}?sobre\s+(?:a\s+)?(?:produ[çc][ãa]o\s+de\s+)?outras\s+provas/i,
  },
  {
    label: "Manifestação sobre laudo",
    pattern: /manifesta\w*[^.]{0,60}?(?:acerca\s+d|sobre\s+)o?\s*laudo/i,
  },
  { label: "Réplica", pattern: /r[ée]plica/i },
  { label: "Contestação", pattern: /contesta[çc][ãa]o/i },
  {
    label: "Perícia designada",
    pattern:
      /per[íi]cia[^.]{0,80}?ser[áa]\s+realizada|designad[ao]\s+per[íi]cia/i,
  },
  {
    label: "Audiência designada",
    pattern:
      /audi[êe]ncia\s+(?:de\s+)?(?:concilia[çc][ãa]o|instru[çc][ãa]o|julgamento)/i,
  },
  {
    /* The federal small claims diary announces the hearing by its own name,
     * with no word "audiência" before it. Measured on the real edition of
     * 2019-02-28 of the third region. */
    label: "Audiência designada",
    pattern: /concilia[çc][ãa]o,\s*instru[çc][ãa]o\s+e\s+julgamento/i,
  },
  {
    label: "Embargos de declaração",
    pattern: /embargos\s+de\s+declara[çc][ãa]o/i,
  },
  { label: "Recurso inominado", pattern: /recurso\s+inominado/i },
  {
    label: "Cumprimento de sentença",
    pattern: /cumprimento\s+de\s+senten[çc]a/i,
  },
  {
    label: "Apresentação de documentos",
    pattern: /junt(?:e|ada|ar)\s+(?:de\s+)?documentos/i,
  },
];

export function extractObject(text: string): {
  object: string | null;
  source: string | null;
} {
  const variants = textVariants(text);
  for (const entry of OBJECTS) {
    const hit = firstMatch(variants, entry.pattern);
    if (hit) {
      return { object: entry.label, source: hit.excerpt };
    }
  }
  return { object: null, source: null };
}

/* A registration number of the Order of Attorneys, in the spellings the real
 * acts of this office use: SP289870, OAB SP - 289870, OAB/SP 289870 and
 * SP123934-NOME. */
const OAB_PATTERNS = [
  /OAB[\s/]*([A-Z]{2})[\s-]*(\d{3,7})/gi,
  /\b([A-Z]{2})\s*-?\s*(\d{4,7})\b(?=\s*-\s*[A-ZÀ-Ú])/g,
  /\b([A-Z]{2})(\d{5,7})\b/g,
];

export function extractOabs(text: string): string[] {
  const variants = textVariants(text);
  const found = new Set<string>();
  for (const pattern of OAB_PATTERNS) {
    for (const candidate of [variants.flat, variants.unwrapped]) {
      for (const match of candidate.matchAll(pattern)) {
        const uf = match[1];
        const number = match[2];
        if (uf === undefined || number === undefined) {
          continue;
        }
        found.add(`${uf.toUpperCase()}${number}`);
      }
    }
  }
  return [...found];
}

export function mentionsOab(text: string, uf: string, number: string): boolean {
  const wanted = `${uf.toUpperCase()}${number}`;
  if (extractOabs(text).includes(wanted)) {
    return true;
  }
  /* The watched registration may also arrive as a bare number, which is how the
   * DJEN itself labels a monitored term. */
  return new RegExp(`\\b${number}\\b`).test(text);
}

const MONTHS: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

function isoFromBr(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/*
 * The appointment an act designates, with the date, the hour and the place. This
 * is what becomes an event in the agenda, a notice on the client record and a
 * reminder for the lawyer on the day before.
 */
export function extractAppointment(text: string): {
  kind: string;
  date: string | null;
  time: string | null;
  place: string | null;
  source: string;
} | null {
  const variants = textVariants(text);
  const shapes: { kind: string; pattern: RegExp }[] = [
    {
      kind: "Perícia",
      pattern:
        /(per[íi]cia[^.]{0,120}?)(?:no\s+dia\s+|em\s+|para\s+o\s+dia\s+)?(\d{2})\/(\d{2})\/(\d{4})[\s,]*(?:[àa]s\s*)?(\d{1,2})[:h](\d{2})?/i,
    },
    {
      kind: "Audiência",
      pattern:
        /(audi[êe]ncia[^.]{0,120}?)(?:no\s+dia\s+|em\s+|para\s+o\s+dia\s+|-\s*)?(\d{2})\/(\d{2})\/(\d{4})[\s,]*(?:[àa]s\s*)?(\d{1,2})[:h](\d{2})?/i,
    },
    {
      kind: "Perícia",
      pattern:
        /(per[íi]cia[^.]{0,120}?)(?:no\s+dia\s+|em\s+|para\s+o\s+dia\s+)(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})[\s,]*(?:[àa]s\s*)?(\d{1,2})[:h](\d{2})?/i,
    },
  ];

  for (const shape of shapes) {
    for (const candidate of [variants.flat, variants.unwrapped]) {
      const match = candidate.match(shape.pattern);
      if (!match || match.index === undefined) {
        continue;
      }
      const [, , first, second, third, hour, minute] = match;
      if (first === undefined || second === undefined || third === undefined) {
        continue;
      }
      const month = /^\d+$/.test(second)
        ? second
        : (MONTHS[
            second
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
          ] ?? null);
      if (month === null) {
        continue;
      }
      const place = extractPlace(candidate, match.index + match[0].length);
      return {
        kind: shape.kind,
        date: isoFromBr(first, month, third),
        time:
          hour === undefined
            ? null
            : `${hour.padStart(2, "0")}:${(minute ?? "00").padStart(2, "0")}`,
        place,
        source: excerptAt(candidate, match.index, match[0].length),
      };
    }
  }
  return null;
}

function extractPlace(text: string, from: number): string | null {
  const tail = text.slice(from, from + 400);
  const patterns = [
    /no\s+seguinte\s+endere[çc]o:\s*([^.]{5,180})/i,
    /(?:no|na)\s+endere[çc]o\s*:?\s*([^.]{5,180})/i,
    /realizar-se-[áa]\s+n[ao]\s+([^.]{5,180})/i,
    /local\s*:\s*([^.]{5,180})/i,
  ];
  for (const pattern of patterns) {
    const match = tail.match(pattern);
    if (match?.[1]) {
      return trimPlace(match[1]);
    }
  }
  return null;
}

/*
 * An address in a judicial act runs straight into the instruction that follows
 * it, with no full stop between them. Measured on the real diary of the Federal
 * Justice of the third region: the address of the expert examination came out
 * carrying "devendo a parte autora comparecer munida de documento oficial",
 * which is not a place. The clause starters below are where an address ends.
 */
const PLACE_END =
  /\s(?:devendo|visando|ficando|sendo\s+que|bem\s+como|munid[ao]|onde\s+dever|para\s+onde|observando)/i;

function trimPlace(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  const cut = clean.search(PLACE_END);
  return (cut > 0 ? clean.slice(0, cut) : clean).replace(/[,;\s]+$/, "").trim();
}

/*
 * The whole reading of one act, by rule. What a rule could not decide is named
 * in the residue, which is the only thing the model may ever be asked about.
 */
export function extractAct(input: {
  text: string;
  documentType: string | null;
}): ExtractedAct {
  const { actType, source: actTypeSource } = extractActType(
    input.text,
    input.documentType,
  );
  const { object, source: objectSource } = extractObject(input.text);
  const days = extractDays(input.text);
  const appointment = extractAppointment(input.text);

  const residue: string[] = [];
  if (actType === null) {
    residue.push("tipo do ato");
  }
  if (object === null) {
    residue.push("objeto do ato");
  }
  if (days.days === null && appointment === null) {
    residue.push("prazo em dias");
  }
  /* An act that writes a quantity of time and produced no deadline is an act a
   * human has to read. Nothing that names a time disappears in silence. */
  if (
    days.days === null &&
    appointment !== null &&
    mentionsTimeQuantity(input.text)
  ) {
    residue.push("prazo em dias");
  }
  if (days.otherStartingEvent) {
    residue.push(
      "prazo contado de outro evento, como a perícia, e não da publicação",
    );
  }
  if (days.ambiguous) {
    residue.push(
      `prazos divergentes no mesmo ato: ${days.candidates.join(", ")} dias`,
    );
  }
  if (appointment !== null && appointment.place === null) {
    residue.push("local do compromisso");
  }

  return {
    actType,
    actTypeSource,
    object,
    objectSource,
    days: days.days,
    daysSource: days.source,
    appointment,
    oabs: extractOabs(input.text),
    processNumbers: processNumbersIn(input.text),
    fullyDeterministic: residue.length === 0,
    residue,
  };
}
