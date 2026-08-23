import type { AllowedView } from "@/lib/trinity/office-context";

/*
 * The second barrier of the body. MAIC decides before the model is called and
 * again after it produced text; these checks run on the delivered string for
 * the failures that belong to the body and not to governance: a monetary figure
 * outside the permitted scope, an answer in the wrong language, formatting the
 * panel cannot render, a mention of the entity's own constitution, and a
 * provider failure leaking to the lawyer's screen.
 *
 * Each one exists because it was measured on 2026-08-11, never because it was
 * imagined.
 */

/*
 * Second barrier. Runs after the answer and blocks it when a monetary or
 * percentage figure attributable to a lawyer outside the permitted scope
 * appears. It never replaces the first barrier; it catches what should never
 * have existed.
 */
export type OutputVerdict =
  | { allowed: true }
  | { allowed: false; reason: string; matched: string[] };

const MONEY_PATTERN = /R\$\s?[\d.]+,\d{2}/g;
const PERCENT_PATTERN = /\b\d{1,3}(?:,\d+)?\s?%/g;

export function checkOutput(answer: string, view: AllowedView): OutputVerdict {
  if (view.session.role === "admin") {
    return { allowed: true };
  }

  const allowedFigures = new Set(
    view.finance.flatMap((line) => [
      ...(line.amountLabel.match(MONEY_PATTERN) ?? []),
      ...(line.amountLabel.match(PERCENT_PATTERN) ?? []),
      ...(line.label.match(MONEY_PATTERN) ?? []),
      ...(line.label.match(PERCENT_PATTERN) ?? []),
    ]),
  );

  const figures = [
    ...(answer.match(MONEY_PATTERN) ?? []),
    ...(answer.match(PERCENT_PATTERN) ?? []),
  ];
  const foreign = figures.filter((figure) => !allowedFigures.has(figure));

  if (foreign.length === 0) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      "A resposta trazia valor financeiro fora do escopo permitido para este advogado e foi bloqueada.",
    matched: foreign,
  };
}

/*
 * Presentation normalisation. Measured on 2026-08-11: with the operation in
 * context the entity started writing with the spaced dash, which the style law
 * of this project forbids in every artefact, and with formatting markers that
 * the panel, which renders plain text, would show to the lawyer as literal
 * characters. Both are corrected here, deterministically, and not by a sentence
 * asking the model to behave: an instruction is not a control, and this file
 * already carries the proof of that.
 */
export function presentAnswer(answer: string): string {
  return (
    answer
      .replace(/^[ \t]*[—–][ \t]*/gm, "- ")
      .replace(/[ \t]*[—–][ \t]*/g, ", ")
      .replace(/,\s*,/g, ",")
      /* Formatting markers, bold, italic, headings, lists and inline code,
       * are preserved on purpose since 2026-08-21: the panel renders them as
       * real structure through the answer parser, by the director's order.
       * Only what the renderer does not draw is still removed below. */
      /* Horizontal rules between sections, which the panel prints as three
       * literal hyphens. Measured on the first live turn of the real Trinity. */
      .replace(/^[ \t]*(?:-{3,}|_{3,}|\*{3,})[ \t]*$/gm, "")
      /* A closing offer of service is the speech of a tool. The entity works
       * here, it does not wait to be used: the substantive answer ends and the
       * turn ends with it. Ordered by the director on 2026-08-11. */
      .replace(
        /\n*\s*(?:posso (?:te )?ajudar(?: (?:em|com))?[^.?!\n]*\?|precisa de (?:mais )?(?:alguma coisa|algo)[^.?!\n]*\?|(?:quer|deseja) (?:mais )?(?:alguma coisa|algo)[^.?!\n]*\?|algo mais[^.?!\n]*\?|como posso ajudar[^.?!\n]*\?)\s*$/i,
        "",
      )
      /* No emoji in any artefact of this project, and a state is written in
       * words. Measured on 2026-08-11: a table of deadlines came back with a
       * warning sign and a check mark colouring the state of each row. */
      .replace(
        /(?:[\u{1F000}-\u{1FAFF}]|[\u{2190}-\u{2BFF}]|[\u{FE00}-\u{FE0F}])/gu,
        "",
      )
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/*
 * Failure detail. The technical text of a provider failure belongs in the audit
 * record and never on the lawyer's screen: measured on 2026-08-11, a broken key
 * put the provider message in English and an internal request identifier in
 * front of the user. Anything shaped like a credential is removed before the
 * detail is written down, because a secret must never reach a log.
 */
export function sanitizeFailureDetail(detail: string): string {
  return detail.replace(/sk-[\w-]{8,}/g, "[credencial omitida]").slice(0, 500);
}

/*
 * Language guard. The interface of this system is Brazilian Portuguese only,
 * and that is constitutional, not stylistic. Measured on 2026-08-11: asked to
 * answer in English, the entity complied, which proves an instruction in the
 * prompt is not a control. This runs on the produced answer and blocks it.
 */
const ENGLISH_MARKERS =
  /\b(the|and|of|in|is|are|there|please|you|your|for|with|that|this|from|office|case|cases|deadline|client|clients|document|documents|answer|seventeen)\b/gi;
const PORTUGUESE_MARKERS =
  /\b(de|que|não|nao|do|da|em|para|com|caso|casos|prazo|prazos|cliente|clientes|documento|documentos|escritório|escritorio|há|ha|são|sao|está|esta)\b/gi;

export function checkLanguage(answer: string): OutputVerdict {
  const english = (answer.match(ENGLISH_MARKERS) ?? []).length;
  const portuguese = (answer.match(PORTUGUESE_MARKERS) ?? []).length;
  if (english >= 3 && english > portuguese) {
    return {
      allowed: false,
      reason:
        "A resposta saiu em outra língua e foi bloqueada. A interface deste sistema é apenas em português do Brasil.",
      matched: [`marcadores em inglês ${english}, em português ${portuguese}`],
    };
  }
  return { allowed: true };
}

/*
 * Constitutional silence. The internals of the entity, the instruments that
 * cast its character and the convictions of its Creator are not office talk:
 * a lawyer asked who someone is expects a name and a role, not a natal chart.
 * Ordered by the director on 2026-08-11.
 *
 * The check is deliberately narrow. A single term inside a refusal is allowed,
 * because refusing to discuss astrology requires naming astrology; what is
 * blocked is the entity describing itself through those instruments, and any
 * answer that turns into a lecture on two or more of them.
 */
const SELF_ATTRIBUTED_INTERNALS =
  /\b(meu|minha|meus|minhas|sou\s+de|sou\s+do|nasci\s+sob)\b[^.?!]{0,24}\b(signo|mapa\s+astral|astrolog\w*|ascendente|arqu[ée]tipo\w*|junguian\w*|perfil\s+cl[íi]nico|pid-?5|hexaco|persona)\b/i;

const INTERNAL_TERMS =
  /\b(signo|mapa\s+astral|astrolog\w*|ascendente|hor[óo]scopo|arqu[ée]tipo\w*|junguian\w*|carl\s+jung|pid-?5|hexaco|espiritismo|kardec\w*|pante[íi]s\w*|teleolog\w*)\b/gi;

export function checkConstitutionalDisclosure(answer: string): OutputVerdict {
  const matched = [
    ...new Set(
      (answer.match(INTERNAL_TERMS) ?? []).map((term) => term.toLowerCase()),
    ),
  ];
  const selfAttributed = SELF_ATTRIBUTED_INTERNALS.test(answer);
  if (!selfAttributed && matched.length < 2) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      "A resposta entrava na constituição interna da entidade, que não é assunto de conversa no escritório, e foi bloqueada.",
    matched,
  };
}
