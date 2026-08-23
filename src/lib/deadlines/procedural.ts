import {
  addDays,
  brDate,
  type CalendarDate,
  calendarReviewed,
  isBusinessDay,
  isCalendarDate,
  nextBusinessDay,
  nonBusinessReason,
} from "@/lib/deadlines/calendar";

/*
 * The chain that turns a publication into a due date, exactly as the law writes
 * it, and exactly as the footer of every certificate of the Diário de Justiça
 * Eletrônico Nacional states it.
 *
 * Article 4, paragraph 3, of Law 11.419 of 2006, and article 224, paragraph 2,
 * of the Code of Civil Procedure: the date of publication is the first business
 * day following the day the information was made available.
 *
 * Article 4, paragraph 4, of the same law, and article 224, paragraph 3, of the
 * Code: the counting starts on the first business day following the publication.
 *
 * Article 219 of the Code: only business days are counted, and only for
 * procedural deadlines. Article 775 of the Consolidation of Labour Laws, with
 * the wording of Law 13.467 of 2017, says the same for the labour sphere.
 *
 * Article 224 of the Code: the start day is excluded and the due day is
 * included; a start or a due day falling on a non business day is moved to the
 * next business day.
 *
 * Article 220 of the Code, and article 775-A of the Consolidation: the deadline
 * is suspended from the twentieth of December to the twentieth of January.
 *
 * Nothing here confirms anything. What comes out is a calculation, in the state
 * `calculated`, and only a lawyer turns it into `confirmed`, by an explicit act
 * that is written to the audit trail.
 */

export type DeadlineRegime = "procedural" | "administrative";

export type DeadlineStep = {
  label: string;
  date: CalendarDate;
  detail: string;
  source: string;
};

export type SkippedDay = {
  date: CalendarDate;
  reason: string;
  source: string;
};

export type CalculatedDeadline = {
  ok: true;
  regime: DeadlineRegime;
  /* Everything the lawyer needs to check the chain with his own eyes. */
  availableOn: CalendarDate;
  publishedOn: CalendarDate;
  startsOn: CalendarDate;
  dueOn: CalendarDate;
  days: number;
  countedInBusinessDays: boolean;
  steps: DeadlineStep[];
  skipped: SkippedDay[];
  court: string | null;
  /* False when the office has not reviewed the calendar of this court, which
   * means local holidays and days without expedient may be missing. The screen
   * says so, always. */
  calendarReviewed: boolean;
  warnings: string[];
};

export type DeadlineFailure = { ok: false; reason: string };

export type DeadlineResult = CalculatedDeadline | DeadlineFailure;

const LAW_11419 = "Lei 11.419 de 2006, artigo 4º, parágrafo 3º";
const LAW_11419_START = "Lei 11.419 de 2006, artigo 4º, parágrafo 4º";
const CPC_224_2 = "Código de Processo Civil, artigo 224, parágrafo 2º";
const CPC_224_3 = "Código de Processo Civil, artigo 224, parágrafo 3º";
const CPC_219 = "Código de Processo Civil, artigo 219";
const CPC_224 = "Código de Processo Civil, artigo 224";
const CLT_775 =
  "Consolidação das Leis do Trabalho, artigo 775, redação da Lei 13.467 de 2017";

/*
 * The counting of the deadline itself. Business days for the procedural regime,
 * calendar days for the administrative one, which follows its own rules and is
 * never counted like a procedural deadline.
 */
export function calculateDeadline(input: {
  availableOn: CalendarDate;
  days: number;
  regime?: DeadlineRegime;
  labour?: boolean;
  court?: string | null;
  applyRecess?: boolean;
}): DeadlineResult {
  const { availableOn, days } = input;
  const regime = input.regime ?? "procedural";
  const court = input.court ?? null;
  const applyRecess = input.applyRecess ?? true;

  if (!isCalendarDate(availableOn)) {
    return { ok: false, reason: "Data de disponibilização inválida." };
  }
  if (!Number.isInteger(days) || days <= 0 || days > 365) {
    return { ok: false, reason: "Quantidade de dias inválida." };
  }

  const options = { court, applyRecess };
  const steps: DeadlineStep[] = [];
  const skipped: SkippedDay[] = [];
  const warnings: string[] = [];

  steps.push({
    label: "Disponibilização",
    date: availableOn,
    detail:
      "Dia em que o ato foi disponibilizado no Diário de Justiça Eletrônico Nacional.",
    source: "Certidão de publicação do DJEN",
  });

  if (regime === "administrative") {
    /* The administrative regime is not the procedural one and must never borrow
     * its rules. What the office can state with certainty is the counting in
     * calendar days from the day after the communication; anything beyond that
     * depends on the act and is left to the lawyer. */
    const startsOn = addDays(availableOn, 1);
    const dueOn = addDays(startsOn, days - 1);
    steps.push({
      label: "Início da contagem",
      date: startsOn,
      detail: "Dia seguinte ao da ciência, no regime administrativo.",
      source: "Regime administrativo, distinto do processual",
    });
    steps.push({
      label: "Vencimento",
      date: dueOn,
      detail: `${days} dias corridos, incluído o dia do vencimento.`,
      source: "Regime administrativo, distinto do processual",
    });
    return {
      ok: true,
      regime,
      availableOn,
      publishedOn: availableOn,
      startsOn,
      dueOn,
      days,
      countedInBusinessDays: false,
      steps,
      skipped,
      court,
      calendarReviewed: calendarReviewed(court),
      warnings: [
        "Prazo administrativo, contado em dias corridos e sujeito ao regime próprio do órgão. O sistema não aplica aqui as regras do processo civil.",
      ],
    };
  }

  /* Publication: the first business day after the availability. */
  const publishedOn = nextBusinessDay(availableOn, options);
  for (
    let cursor = addDays(availableOn, 1);
    cursor < publishedOn;
    cursor = addDays(cursor, 1)
  ) {
    const reason = nonBusinessReason(cursor, options);
    if (reason) {
      skipped.push({ date: cursor, ...reason });
    }
  }
  steps.push({
    label: "Publicação",
    date: publishedOn,
    detail: "Primeiro dia útil seguinte ao da disponibilização.",
    source: `${LAW_11419}; ${CPC_224_2}`,
  });

  /* Start of the counting: the first business day after the publication. */
  const startsOn = nextBusinessDay(publishedOn, options);
  for (
    let cursor = addDays(publishedOn, 1);
    cursor < startsOn;
    cursor = addDays(cursor, 1)
  ) {
    const reason = nonBusinessReason(cursor, options);
    if (reason) {
      skipped.push({ date: cursor, ...reason });
    }
  }
  steps.push({
    label: "Início da contagem",
    date: startsOn,
    detail:
      "Primeiro dia útil seguinte ao da publicação, excluído o dia do começo.",
    source: `${LAW_11419_START}; ${CPC_224_3}; ${CPC_224}`,
  });

  /* The count itself. The start day is the first counted business day, because
   * the day excluded by article 224 is the day of the publication, and the
   * counting begins on the day after it. */
  let counted = 1;
  let cursor = startsOn;
  while (counted < days) {
    cursor = addDays(cursor, 1);
    const reason = nonBusinessReason(cursor, options);
    if (reason) {
      skipped.push({ date: cursor, ...reason });
      continue;
    }
    counted += 1;
  }

  /* Article 224: a due day that falls on a non business day rolls forward. The
   * counting above already lands on a business day, so this is the guard that
   * keeps the rule true if the calendar is adjusted later. */
  let dueOn = cursor;
  if (!isBusinessDay(dueOn, options)) {
    dueOn = nextBusinessDay(dueOn, options);
  }
  steps.push({
    label: "Vencimento",
    date: dueOn,
    detail: `${days} ${days === 1 ? "dia útil" : "dias úteis"}, incluído o dia do vencimento.`,
    source: input.labour === true ? CLT_775 : `${CPC_219}; ${CPC_224}`,
  });

  const reviewed = calendarReviewed(court);
  if (!reviewed) {
    warnings.push(
      court === null
        ? "O tribunal deste ato não foi identificado, então o cálculo usou apenas os feriados nacionais e a suspensão de fim de ano. Feriado local e dia sem expediente podem alterar o vencimento."
        : `O calendário do tribunal ${court} ainda não foi revisado pelo escritório, então feriado local e dia sem expediente podem não estar considerados.`,
    );
  }
  warnings.push(
    "O cálculo é apoio. A responsabilidade profissional pelo prazo permanece do advogado, e o prazo só passa a confirmado por ação humana registrada.",
  );

  return {
    ok: true,
    regime,
    availableOn,
    publishedOn,
    startsOn,
    dueOn,
    days,
    countedInBusinessDays: true,
    steps,
    skipped,
    court,
    calendarReviewed: reviewed,
    warnings,
  };
}

/* The chain in one sentence, for a screen or for a record. */
export function chainSentence(deadline: CalculatedDeadline): string {
  return [
    `Disponibilizado em ${brDate(deadline.availableOn)}`,
    `publicado em ${brDate(deadline.publishedOn)}`,
    `contagem iniciada em ${brDate(deadline.startsOn)}`,
    `${deadline.days} ${deadline.countedInBusinessDays ? (deadline.days === 1 ? "dia útil" : "dias úteis") : "dias corridos"}`,
    `vencimento em ${brDate(deadline.dueOn)}`,
  ].join(", ");
}
