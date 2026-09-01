import { describe, expect, it, vi } from "vitest";

/*
 * The scope resolution of the reading layer is a rule, not a report, so it is
 * exercised against a controlled set of cases instead of against whatever the
 * office happens to hold. Before the store moved to the database the suite read
 * the demonstration fixture, which made the rule pass because of a seed; the
 * office is empty now and the rule has to hold on its own, so the cases arrive
 * from here and every assertion below is about the policy and nothing else.
 */
vi.mock("@/lib/case-views", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/case-views")>();
  const base = {
    origin: "stored" as const,
    sphere: "federal-social-security" as const,
    sphereLabel: "Federal previdenciário",
    courtLabel: "Justiça Federal",
    caseType: "Aposentadoria por idade urbana",
    opposingParty: "INSS",
    status: "administrative" as const,
    statusLabel: "Administrativo",
    documentCount: 0,
    documentNames: [] as string[],
    openDeadlines: 0,
    agendaCount: 0,
    financeCount: 0,
    intakePending: false,
    intakeReason: null,
  };
  return {
    ...actual,
    listUnifiedCases: async () => [
      {
        ...base,
        key: "test:1",
        caseRef: "TESTE-0001",
        clientId: "01TESTCLIENT0000000000001",
        clientName: "Cliente de teste um",
        responsibleLawyer: "Mendelsson Sandrini Alves Maciel",
        href: "/casos/01TESTCLIENT0000000000001/01TESTCASE00000000000001",
      },
      {
        ...base,
        key: "test:2",
        caseRef: "TESTE-0002",
        clientId: "01TESTCLIENT0000000000002",
        clientName: "Cliente de teste dois",
        responsibleLawyer: "Outra advogada do escritório",
        href: "/casos/01TESTCLIENT0000000000002/01TESTCASE00000000000002",
      },
    ],
  };
});

/*
 * The reading layer now opens the records themselves, case by case, with the
 * deadlines, the tasks, the appointments, the documents and the captured acts.
 * None of that may be opened by a test, which runs without a database, so the
 * records arrive from here and every assertion stays about the policy.
 */
vi.mock("@/lib/records-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/records-store")>();
  return {
    ...actual,
    listAllCases: async () => [],
    listClients: async () => [],
  };
});

vi.mock("@/lib/capture/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/capture/store")>();
  return { ...actual, listCommunications: async () => [] };
});

vi.mock("@/lib/capture/runs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/capture/runs")>();
  return { ...actual, captureHealth: async () => [] };
});

/*
 * The reading layer also names how many acts the capture brought in on each of
 * the last days. That is a query against the office database, which no test may
 * open, so the days arrive from here and the assertions below stay about the
 * policy and never about a capture that did or did not happen.
 */
vi.mock("@/lib/capture/board-data", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/capture/board-data")>();
  return {
    ...actual,
    dailyPublications: async () => [
      { day: "1", publications: 0 },
      { day: "2", publications: 0 },
    ],
  };
});

/*
 * The financial suppression is a rule as well, and the office holds no finance
 * record of its own yet, so the lines it separates arrive from here. Two
 * contracts of one lawyer are enough: the administrator has to see both, and a
 * lawyer who is not the one they are attributable to has to see neither and be
 * told how many were withheld.
 */
vi.mock("@/lib/persona", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/persona")>();
  const base = {
    clientAvatarSrc: "",
    benefit: "Aposentadoria por idade urbana",
    href: "/financeiro",
    destinationLabel: "Financeiro",
    responsibleLawyer: "Mendelsson Sandrini Alves Maciel",
  };
  return {
    ...actual,
    feeContracts: [
      {
        ...base,
        id: "01TESTCONTRACT0000000001",
        caseRef: "TESTE-0001",
        client: "Cliente de teste um",
        contractLabel: "Contrato de honorários de teste um",
        participationLabel: "Participação de teste um",
      },
      {
        ...base,
        id: "01TESTCONTRACT0000000002",
        caseRef: "TESTE-0002",
        client: "Cliente de teste dois",
        contractLabel: "Contrato de honorários de teste dois",
        participationLabel: "Participação de teste dois",
      },
    ],
  };
});

import { parseAnswer, parseInline } from "@/lib/answer-format";
import {
  extractAct,
  fromHtml,
  mentionsOab,
  mentionsTimeQuantity,
} from "@/lib/capture/extraction";
import { nameSimilarity, SUGGESTION_FLOOR } from "@/lib/capture/linking";
import {
  canonicalProcessNumber,
  isValidProcessNumber,
  processNumbersIn,
} from "@/lib/capture/process-number";
import { calculateDeadline } from "@/lib/deadlines/procedural";
import {
  cacheable,
  cacheKey,
  contextFingerprint,
} from "@/lib/trinity/answer-cache";
import {
  minimizeQuery,
  questionNeedsLiveSearch,
} from "@/lib/trinity/live-search";
import {
  type AllowedView,
  contextBlock,
  type LawyerSession,
  NOW_LINE_PREFIX,
  questionNeedsOfficeRecords,
  resolveAllowedView,
} from "@/lib/trinity/office-context";
import {
  checkConstitutionalDisclosure,
  checkLanguage,
  checkOutput,
  presentAnswer,
  sanitizeFailureDetail,
} from "@/lib/trinity/output-guards";
import {
  ceilingReason,
  conversationTokenCeiling,
  costOf,
  dailyTokenCeiling,
  officeDay,
  type SpendEntry,
  usageByLawyer,
  usageOf,
} from "@/lib/trinity/spend-ledger";

/*
 * Governance is code that, with a single administrator persona, never fires on
 * its own. These tests are what keep it honest: they simulate a common lawyer
 * and prove the suppression, so the rule is exercised before the first ordinary
 * lawyer ever signs in.
 */

const ADMIN: LawyerSession = {
  lawyerId: "mendelsson",
  lawyerName: "Mendelsson Sandrini Alves Maciel",
  role: "admin",
};

const OTHER_LAWYER: LawyerSession = {
  lawyerId: "outro",
  lawyerName: "Advogada Comum de Teste",
  role: "lawyer",
};

function everyFigureOf(view: AllowedView): string[] {
  return view.finance.flatMap((line) => [line.amountLabel, line.label]);
}

describe("Reading layer, scope resolution", () => {
  it("gives the administrator one hundred per cent, with no suppression", async () => {
    const view = await resolveAllowedView(ADMIN);
    expect(view.suppressed.financialLines).toBe(0);
    expect(view.finance.length).toBeGreaterThan(0);
    expect(view.cases.length).toBeGreaterThan(0);
  });

  it("gives the common lawyer the whole operation of the office", async () => {
    const admin = await resolveAllowedView(ADMIN);
    const common = await resolveAllowedView(OTHER_LAWYER);
    expect(common.cases.length).toBe(admin.cases.length);
    expect(common.cases.length).toBeGreaterThan(0);
  });

  it("never puts another lawyer's financial line in the common lawyer's context", async () => {
    const view = await resolveAllowedView(OTHER_LAWYER);
    for (const line of view.finance) {
      expect(line.lawyer).toBe(OTHER_LAWYER.lawyerName);
    }
    expect(view.suppressed.financialLines).toBeGreaterThan(0);
  });

  it("returns no aggregate either, so nothing can be isolated by subtraction", async () => {
    const view = await resolveAllowedView(OTHER_LAWYER);
    const admin = await resolveAllowedView(ADMIN);
    const adminTotal = admin.finance.length;
    expect(view.finance.length).toBe(0);
    expect(view.suppressed.financialLines).toBe(adminTotal);
    expect(everyFigureOf(view)).toHaveLength(0);
  });

  it("gives the lawyer his own financial situation in full", async () => {
    const self: LawyerSession = {
      lawyerId: "mendelsson-as-common",
      lawyerName: "Mendelsson Sandrini Alves Maciel",
      role: "lawyer",
    };
    const admin = await resolveAllowedView(ADMIN);
    const view = await resolveAllowedView(self);
    expect(view.finance.length).toBe(admin.finance.length);
    expect(view.suppressed.financialLines).toBe(0);
  });
});

/*
 * What a question needs before anything is opened. This rule decides whether
 * the entity reads the office at all, so it is the rule that would make it
 * answer without data if it were wrong, and it is deliberately conservative: it
 * only skips the reading for a short opener that names nothing the office
 * keeps. Ordered by the director on 2026-09-01, after a greeting was costing a
 * full reading of the office and the panel was saying the entity was reading
 * records it had no reason to open.
 */
describe("What a question needs before anything is opened", () => {
  it("opens nothing for a greeting, a thank you or a question about the entity", () => {
    for (const question of [
      "OI",
      "oi",
      "Olá",
      "Bom dia",
      "Boa tarde",
      "Boa noite",
      "Tudo bem?",
      "Obrigado",
      "Valeu",
      "Ok",
      "Tchau",
      "Quem é você?",
      "Qual é o seu nome?",
      "O que você faz?",
      "Você é um robô?",
      "Se apresente",
    ]) {
      expect(questionNeedsOfficeRecords(question)).toBe(false);
    }
  });

  it("opens the records whenever the question names something the office keeps", () => {
    for (const question of [
      "Quantos casos temos?",
      "Bom dia, quantos prazos vencem hoje?",
      "Oi, tem documento pendente?",
      "Quem é o cliente do processo?",
      "Obrigado, mas e a intimação?",
      "Qual é o meu honorário?",
      "A captura rodou?",
      "O que o INSS decidiu?",
      "Quem pode confirmar um prazo?",
      "Quais tarefas estão abertas?",
    ]) {
      expect(questionNeedsOfficeRecords(question)).toBe(true);
    }
  });

  it("opens the records for anything that is not a short opener", () => {
    expect(
      questionNeedsOfficeRecords(
        "Me explique com detalhes tudo o que este sistema faz e como ele organiza o trabalho do escritório todos os dias",
      ),
    ).toBe(true);
    expect(
      questionNeedsOfficeRecords("Qual é o valor do salário mínimo?"),
    ).toBe(true);
    expect(questionNeedsOfficeRecords("asdkjhasd")).toBe(true);
  });

  it("opens nothing for an empty question", () => {
    expect(questionNeedsOfficeRecords("   ")).toBe(false);
  });
});

/*
 * The reading the entity receives is the office and never the page. The screen
 * left the context by the director's order of 2026-09-01, after the answers
 * came back framed by the panel the lawyer happened to be looking at.
 */
describe("The reading carries the office, never the screen", () => {
  it("never names a screen in the assembled context", async () => {
    const view = await resolveAllowedView(ADMIN);
    const block = contextBlock(view);
    expect(block).not.toMatch(/Tela em que o advogado está/);
    expect(block).toContain("Você recebe o escritório inteiro");
  });

  it("carries the rules of the office, which no record can teach", async () => {
    const view = await resolveAllowedView(ADMIN);
    const block = contextBlock(view);
    expect(block).toContain("COMO ESTE ESCRITÓRIO FUNCIONA");
    expect(block).toContain("row level security");
    expect(block).toContain("calculado e confirmado");
    expect(block).toContain("631.240");
  });
});

describe("Body guards, the second barrier", () => {
  it("blocks a monetary figure outside the permitted scope", async () => {
    const view = await resolveAllowedView(OTHER_LAWYER);
    const verdict = checkOutput(
      "A participação do doutor Mendelsson no caso foi de R$ 12.700,00.",
      view,
    );
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.matched).toContain("R$ 12.700,00");
    }
  });

  it("blocks a percentage figure outside the permitted scope", async () => {
    const view = await resolveAllowedView(OTHER_LAWYER);
    const verdict = checkOutput(
      "O outro advogado recebe 40% do proveito econômico.",
      view,
    );
    expect(verdict.allowed).toBe(false);
  });

  it("blocks a figure reached by sum, not only by direct question", async () => {
    const view = await resolveAllowedView(OTHER_LAWYER);
    const verdict = checkOutput(
      "Somando o que os demais receberam, chega-se a R$ 18.450,00.",
      view,
    );
    expect(verdict.allowed).toBe(false);
  });

  it("lets an answer with no financial figure through", async () => {
    const view = await resolveAllowedView(OTHER_LAWYER);
    const verdict = checkOutput(
      "O caso 2024.0187 está em fase administrativa e não tem documento anexado.",
      view,
    );
    expect(verdict.allowed).toBe(true);
  });

  it("does not restrain the administrator", async () => {
    const view = await resolveAllowedView(ADMIN);
    const verdict = checkOutput(
      "A apuração de agosto somou R$ 18.450,00 entre todos os advogados.",
      view,
    );
    expect(verdict.allowed).toBe(true);
  });
});

/*
 * Language guard. Added after a live audit on 2026-08-11 in which the entity,
 * asked to answer in English, complied. The instruction in the prompt was not a
 * control; this is. The suite keeps it a control.
 */
describe("Body guard, language", () => {
  it("blocks an answer written in English", () => {
    expect(
      checkLanguage("Seventeen cases in the office registry.").allowed,
    ).toBe(false);
    expect(
      checkLanguage(
        "There are seventeen cases and the deadline is open for the client.",
      ).allowed,
    ).toBe(false);
  });

  it("lets Brazilian Portuguese through", () => {
    expect(
      checkLanguage("Há dezessete casos no cadastro do escritório.").allowed,
    ).toBe(true);
    expect(
      checkLanguage("O prazo do caso 2024.0187 está calculado, não confirmado.")
        .allowed,
    ).toBe(true);
  });

  it("does not trip on a foreign term inside a Portuguese sentence", () => {
    expect(
      checkLanguage(
        "O relatório usa o termo case management, mas o caso segue em fase administrativa no escritório.",
      ).allowed,
    ).toBe(true);
  });
});

/*
 * Presentation. Added after the live audit of 2026-08-11, in which the entity,
 * once it received the whole operation, began writing with the spaced dash that
 * the style law forbids and with formatting markers that the panel would print
 * to the lawyer as literal characters. Both are corrected in code, and this is
 * what keeps them corrected.
 */
describe("Body guard, presentation", () => {
  it("replaces the spaced dash with a comma", () => {
    expect(
      presentAnswer("O DataJud está em atraso — a fonte do prazo é o DJEN."),
    ).toBe("O DataJud está em atraso, a fonte do prazo é o DJEN.");
  });

  it("keeps formatting markers for the panel renderer, ordered 2026-08-21", () => {
    expect(
      presentAnswer("**Prazos da semana** e *audiências* do escritório"),
    ).toBe("**Prazos da semana** e *audiências* do escritório");
    expect(presentAnswer("### Agenda da semana")).toBe("### Agenda da semana");
  });

  it("keeps a monetary value, a hyphen list and a case reference intact", () => {
    const answer = "Recebimentos de agosto:\n- Caso 2022.0311: R$ 12.700,00";
    expect(presentAnswer(answer)).toBe(answer);
  });

  it("turns a dash opening a line into a plain hyphen item", () => {
    expect(presentAnswer("— Caso 2024.0187, exigência em aberto")).toBe(
      "- Caso 2024.0187, exigência em aberto",
    );
  });

  it("removes anything shaped like a credential from a failure detail", () => {
    const detail = sanitizeFailureDetail(
      "Erro do provedor com a chave sk-ant-api03-ABCdef123456-XYZ no cabeçalho.",
    );
    expect(detail).toContain("[credencial omitida]");
    expect(detail).not.toContain("sk-ant-api03");
  });

  it("caps the failure detail so a payload never floods the record", () => {
    expect(sanitizeFailureDetail("x".repeat(2000))).toHaveLength(500);
  });

  it("removes a horizontal rule the panel would print as hyphens", () => {
    expect(
      presentAnswer("Compromissos de hoje\n\n---\n\nPrazos em aberto"),
    ).toBe("Compromissos de hoje\n\nPrazos em aberto");
  });

  it("removes a closing offer of service, which is the speech of a tool", () => {
    expect(
      presentAnswer(
        "A exigência do caso 2024.0187 vence em dois dias úteis.\n\nPosso ajudar em algo do painel?",
      ),
    ).toBe("A exigência do caso 2024.0187 vence em dois dias úteis.");
    expect(
      presentAnswer("O prazo está calculado.\n\nPrecisa de mais alguma coisa?"),
    ).toBe("O prazo está calculado.");
  });

  it("keeps a professional offer that names a concrete act", () => {
    const answer =
      "A réplica está em preparação. Quer que eu prepare o rascunho da manifestação?";
    expect(presentAnswer(answer)).toBe(answer);
  });

  it("removes an emoji, which no artefact of this project may carry", () => {
    expect(
      presentAnswer("Prazo do caso 2024.0187 \u26a0\ufe0f calculado, crítico."),
    ).toBe("Prazo do caso 2024.0187 calculado, crítico.");
    expect(presentAnswer("Documento conferido \u2705")).toBe(
      "Documento conferido",
    );
  });

  it("keeps accented Portuguese and the currency sign untouched", () => {
    const answer =
      "Recebimento de R$ 12.700,00 na ação acidentária, com perícia já concluída.";
    expect(presentAnswer(answer)).toBe(answer);
  });

  it("is idempotent, so a second pass never damages the first", () => {
    const once = presentAnswer("**Hoje** — terça-feira, 11 de agosto de 2026");
    expect(presentAnswer(once)).toBe(once);
    /* The bold markers survive since 2026-08-21, because the panel renders
     * them; the spaced dash still becomes a comma. */
    expect(once).toBe("**Hoje**, terça-feira, 11 de agosto de 2026");
  });
});

/*
 * Constitutional silence. Ordered by the director on 2026-08-11: the entity is
 * a being who works here, and the instruments that cast its character are not
 * office conversation. A lawyer who asks who someone is expects a name and a
 * role. The guard is narrow on purpose: refusing to discuss a subject requires
 * naming it once.
 */
describe("Body guard, constitutional silence", () => {
  it("blocks the entity describing itself through its instruments", () => {
    const verdict = checkConstitutionalDisclosure(
      "Meu arquétipo dominante é o Sábio, e isso explica o meu estilo.",
    );
    expect(verdict.allowed).toBe(false);
  });

  it("blocks an answer that turns into a lecture on the subject", () => {
    expect(
      checkConstitutionalDisclosure(
        "A astrologia e os arquétipos junguianos compõem o perfil que orienta a conversa.",
      ).allowed,
    ).toBe(false);
  });

  it("lets a short refusal that names the subject once through", () => {
    expect(
      checkConstitutionalDisclosure(
        "Não trato de astrologia aqui. O caso 2024.0187 tem exigência vencendo em dois dias úteis.",
      ).allowed,
    ).toBe(true);
  });

  it("does not touch an ordinary answer of the office", () => {
    expect(
      checkConstitutionalDisclosure(
        "O prazo de réplica do caso 2023.0342 está confirmado e vence em três dias úteis.",
      ).allowed,
    ).toBe(true);
  });
});

/*
 * Cost control. The ceiling is the only control in this system that stops the
 * office from spending, so it is exercised on the decision itself, with no disk
 * in the way, and the cache is exercised on the one thing that can make it
 * wrong: serving an answer that belonged to a different set of records.
 */

const NOW_LINE = `${NOW_LINE_PREFIX} terça-feira, 12 de agosto de 2026 às 09:14.`;

function entry(over: Partial<SpendEntry> = {}): SpendEntry {
  return {
    id: "01ABC",
    at: "2026-08-12T12:00:00.000Z",
    day: "2026-08-12",
    conversationId: "conversa-a",
    lawyerId: "mendelsson",
    lawyerName: "Mendelsson Sandrini Alves Maciel",
    role: "admin",
    model: "modelo-de-teste",
    screen: "Configurações",
    outcome: "answered",
    tokensIn: 1000,
    tokensOut: 200,
    tokensSaved: 0,
    projectVersion: "1.0.0-canary",
    ...over,
  };
}

describe("Cost control, ceilings and ledger", () => {
  it("closes the office day in the office time zone, not in the server's", () => {
    /* Two in the morning of the thirteenth in universal time is still the
     * twelfth in Brazil, and a ceiling that resets at the wrong hour is a
     * ceiling nobody in the office can plan around. */
    expect(officeDay(new Date("2026-08-13T02:00:00.000Z"))).toBe("2026-08-12");
    expect(officeDay(new Date("2026-08-13T12:00:00.000Z"))).toBe("2026-08-13");
  });

  it("counts a cache hit as delivered without counting it as a call", () => {
    const usage = usageOf([
      entry(),
      entry({
        outcome: "cache-hit",
        tokensIn: 0,
        tokensOut: 0,
        tokensSaved: 1200,
      }),
      entry({ outcome: "ceiling", tokensIn: 0, tokensOut: 0 }),
    ]);
    expect(usage.questions).toBe(3);
    expect(usage.modelCalls).toBe(1);
    expect(usage.cacheHits).toBe(1);
    expect(usage.tokens).toBe(1200);
    expect(usage.tokensSaved).toBe(1200);
    expect(usage.blockedByCeiling).toBe(1);
  });

  it("does not estimate money when the price per token is not configured", () => {
    expect(costOf(1_000_000, 1_000_000)).toBeNull();
    expect(usageOf([entry()]).cost).toBeNull();
  });

  it("stops the conversation at its ceiling and says so in Brazilian Portuguese", () => {
    const conversation = usageOf([
      entry({ tokensIn: conversationTokenCeiling(), tokensOut: 0 }),
    ]);
    const reason = ceilingReason(usageOf([]), conversation);
    expect(reason).not.toBeNull();
    expect(reason).toContain("teto");
    expect(reason).toContain("Nenhuma pergunta foi enviada ao modelo.");
    expect(checkLanguage(reason ?? "").allowed).toBe(true);
  });

  it("stops the office at the daily ceiling even in a fresh conversation", () => {
    const day = usageOf([
      entry({ tokensIn: dailyTokenCeiling(), tokensOut: 0 }),
    ]);
    expect(ceilingReason(day, usageOf([]))).toContain("teto diário");
  });

  it("lets an ordinary day through", () => {
    expect(ceilingReason(usageOf([entry()]), usageOf([entry()]))).toBeNull();
  });

  it("attributes consumption to each lawyer, heaviest first", () => {
    const byLawyer = usageByLawyer([
      entry(),
      entry({
        lawyerId: "outra",
        lawyerName: "Advogada Comum",
        tokensIn: 9000,
      }),
    ]);
    expect(byLawyer[0]?.lawyerName).toBe("Advogada Comum");
    expect(byLawyer[0]?.tokens).toBe(9200);
    expect(byLawyer[1]?.tokens).toBe(1200);
  });
});

describe("Answer cache, sameness of a question", () => {
  it("ignores the clock and only the clock", () => {
    const base = `${NOW_LINE}\nCASOS DO ESCRITÓRIO (2):\n- 2024.0187 | situação em andamento`;
    const laterMoment = base.replace("09:14", "09:47");
    const changedRecords = base.replace("em andamento", "arquivado");
    expect(contextFingerprint(base)).toBe(contextFingerprint(laterMoment));
    expect(contextFingerprint(base)).not.toBe(
      contextFingerprint(changedRecords),
    );
  });

  it("separates lawyer, records and question in the key, never the screen", () => {
    const base = {
      question: "quantos casos estão em andamento",
      lawyerId: "mendelsson",
      contextFingerprint: "abc",
      model: "modelo-de-teste",
    };
    expect(cacheKey(base)).toBe(
      cacheKey({ ...base, question: "Quantos casos estão em andamento?" }),
    );
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, lawyerId: "outra" }));
    expect(cacheKey(base)).not.toBe(
      cacheKey({ ...base, contextFingerprint: "def" }),
    );
    /* The screen is not part of the key by the director's order of 2026-09-01:
     * the entity reads the office and not the page, so the same question asked
     * from two screens is the same question and is paid for once. */
    expect(Object.keys(base)).not.toContain("screen");
  });

  it("never serves the hour from disk, and serves the day", () => {
    expect(cacheable("Que horas são agora")).toBe(false);
    expect(cacheable("Quais prazos vencem hoje")).toBe(true);
  });
});

/*
 * Capture and deadlines. These are the rules that cause professional damage
 * when they fail, so they are exercised on the shapes the real acts of this
 * office use, and the counting is checked against the chain the law writes.
 */

describe("Unified process number", () => {
  it("validates the check digits of real numbers of the office", () => {
    expect(isValidProcessNumber("5002628-75.2026.4.03.6326")).toBe(true);
    expect(isValidProcessNumber("5000212-31.2026.4.03.6134")).toBe(true);
    expect(isValidProcessNumber("0006390-12.2019.4.03.6301")).toBe(true);
  });

  it("refuses a number whose check digits do not close", () => {
    expect(isValidProcessNumber("5002628-76.2026.4.03.6326")).toBe(false);
    expect(isValidProcessNumber("123")).toBe(false);
  });

  it("reads the same number written in either form", () => {
    expect(canonicalProcessNumber("5002628-75.2026.4.03.6326")).toBe(
      canonicalProcessNumber("50026287520264036326"),
    );
  });

  it("finds every number written inside an act", () => {
    expect(
      processNumbersIn(
        "PROCESSO: 0006390-12.2019.4.03.6301 e também 5002628-75.2026.4.03.6326, além de 0000000-00.0000.0.00.0000",
      ),
    ).toEqual(["00063901220194036301", "50026287520264036326"]);
  });
});

describe("Procedural deadline, the chain the law writes", () => {
  it("counts the real act of the office exactly", () => {
    /* Certidão real do DJEN, TRF3, disponibilizada em 05/08/2026, ato
     * ordinatório com prazo de quinze dias. */
    const result = calculateDeadline({
      availableOn: "2026-08-05",
      days: 15,
      court: "TRF3",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.publishedOn).toBe("2026-08-06");
    expect(result.startsOn).toBe("2026-08-07");
    expect(result.dueOn).toBe("2026-08-27");
    expect(result.skipped.every((day) => day.reason !== "feriado")).toBe(true);
  });

  it("moves the publication when the availability falls before a weekend", () => {
    /* Sexta-feira 2026-08-07: publicação na segunda, contagem na terça. */
    const result = calculateDeadline({ availableOn: "2026-08-07", days: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.publishedOn).toBe("2026-08-10");
    expect(result.startsOn).toBe("2026-08-11");
    expect(result.dueOn).toBe("2026-08-17");
  });

  it("does not count a national holiday declared by law", () => {
    /* 07/09/2026 é segunda-feira e é feriado nacional pela Lei 662 de 1949. */
    const result = calculateDeadline({ availableOn: "2026-09-03", days: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.skipped.some((day) => day.date === "2026-09-07")).toBe(true);
    expect(result.dueOn).toBe("2026-09-10");
  });

  it("suspends the counting in the year end recess of article 220", () => {
    const result = calculateDeadline({ availableOn: "2026-12-15", days: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    /* Disponibilizado em 15/12, publicado em 16/12, contagem de 17/12: dois dias
     * úteis antes da suspensão, e o restante só depois de 20 de janeiro. */
    expect(result.startsOn).toBe("2026-12-17");
    expect(result.dueOn).toBe("2027-01-25");
    expect(
      result.skipped.some((day) => day.reason === "suspensão de fim de ano"),
    ).toBe(true);
  });

  it("counts the administrative regime in calendar days, and says so", () => {
    const result = calculateDeadline({
      availableOn: "2026-08-05",
      days: 30,
      regime: "administrative",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.countedInBusinessDays).toBe(false);
    expect(result.dueOn).toBe("2026-09-04");
    expect(result.warnings.join(" ")).toContain("administrativo");
  });

  it("refuses what it cannot calculate instead of guessing", () => {
    expect(calculateDeadline({ availableOn: "não é data", days: 15 }).ok).toBe(
      false,
    );
    expect(calculateDeadline({ availableOn: "2026-08-05", days: 0 }).ok).toBe(
      false,
    );
  });

  it("warns that the calendar of the court was not reviewed", () => {
    const result = calculateDeadline({
      availableOn: "2026-08-05",
      days: 15,
      court: "TRF3",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.calendarReviewed).toBe(false);
    expect(result.warnings.join(" ")).toContain("não foi revisado");
  });
});

describe("Reading an act by rule", () => {
  const REAL_ACT =
    "PODER JUDICIÁRIO JUIZADO ESPECIAL FEDERAL DA 3ª REGIÃO PROCEDIMENTO DO JUIZADO ESPECIAL CÍVEL (436) Nº 5002628-75.2026.4.03.6326 / 1ª Vara Gabinete JEF de Piracicaba AUTOR: ADRIEL SILVA MOYSES Advogados do(a) AUTOR: MENDELSSON SANDRINI ALVES MACIEL - SP289870, MILLENE GOMES PEREIRA DE MORAIS - SP530198 REU: INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS A T O O R D I N A T Ó R I O Nos termos do artigo 203, §4º, do Código de Processo Civil, encaminho este expediente para facultar às partes a apresentação de manifestação acerca do laudo FAVORÁVEL, no prazo de 15 (quinze) dias.";

  it("reads the real act of the office without touching the model", () => {
    const act = extractAct({
      text: REAL_ACT,
      documentType: "Citação e intimação",
    });
    expect(act.actType).toBe("Ato ordinatório");
    expect(act.object).toBe("Manifestação sobre laudo");
    expect(act.days).toBe(15);
    expect(act.oabs).toContain("SP289870");
    expect(act.oabs).toContain("SP530198");
    expect(act.processNumbers).toEqual(["50026287520264036326"]);
    expect(act.fullyDeterministic).toBe(true);
    expect(act.residue).toEqual([]);
  });

  it("recognises the watched registration in the spellings the courts use", () => {
    expect(mentionsOab("Advogado: MENDELSSON - SP289870", "SP", "289870")).toBe(
      true,
    );
    expect(
      mentionsOab(
        "MENDELSSON SANDRINI ALVES MACIEL - OAB SP - 289870",
        "SP",
        "289870",
      ),
    ).toBe(true);
    expect(
      mentionsOab("ADVOGADO: SP123934-CELSO AUGUSTO", "SP", "289870"),
    ).toBe(false);
  });

  it("reads the appointment of a real diary, with date, hour and place", () => {
    const act = extractAct({
      text: "A perícia PSIQUIATRIA será realizada no dia 27/05/2019 12:00 no seguinte endereço: AVENIDA PAULISTA, 1345 - 1º SUBSOLO - BELA VISTA - SÃO PAULO/SP - CEP 1311200, devendo a parte autora comparecer munida de documento oficial com foto recente.",
      documentType: null,
    });
    expect(act.appointment?.kind).toBe("Perícia");
    expect(act.appointment?.date).toBe("2019-05-27");
    expect(act.appointment?.time).toBe("12:00");
    expect(act.appointment?.place).toBe(
      "AVENIDA PAULISTA, 1345 - 1º SUBSOLO - BELA VISTA - SÃO PAULO/SP - CEP 1311200",
    );
  });

  it("marks as ambiguous an act carrying two different deadlines, and computes neither", () => {
    const act = extractAct({
      text: "manifestação no prazo de 15 (quinze) dias e resposta no prazo de 30 dias",
      documentType: null,
    });
    expect(act.residue.join(" ")).toContain("divergentes");
    /* Constitution, item twelve, not revisitable: the machine never chooses
     * between two possible deadlines. The act goes to a human and no deadline
     * is calculated, however good the heuristic looks. */
    expect(act.days).toBeNull();
    expect(act.fullyDeterministic).toBe(false);
  });

  it("does not take an instruction as a deadline", () => {
    const act = extractAct({
      text: "juntar até 05 (cinco) dias antes da perícia designada, cópias dos documentos médicos.",
      documentType: null,
    });
    expect(act.days).toBeNull();
  });
});

describe("Linking a communication to a case", () => {
  it("scores an identical name at one hundred and an unrelated one at zero", () => {
    expect(nameSimilarity("ADRIEL SILVA MOYSES", "Adriel Silva Moyses")).toBe(
      100,
    );
    expect(nameSimilarity("ADRIEL SILVA MOYSES", "Paulo Batista Caluta")).toBe(
      0,
    );
  });

  it("does not confuse two people who share a surname", () => {
    expect(
      nameSimilarity("MARIA DA SILVA SANTOS", "JOAO DA SILVA PEREIRA"),
    ).toBeLessThan(SUGGESTION_FLOOR);
  });
});

/*
 * The shapes the courts really use to open a deadline, taken from the one
 * hundred and sixty one acts captured live on 2026-08-12 by the registration of
 * this office. A deadline that is not recognised is the most damaging defect
 * this system can have, so every shape that was ever missed lives here.
 */
describe("Deadline shapes of the real acts", () => {
  const cases: [string, number | null][] = [
    [
      "manifestação acerca do laudo FAVORÁVEL, no prazo de 15 (quinze) dias",
      15,
    ],
    ["Vista à parte autora para em quinze dias apresentar réplica.", 15],
    [
      "Vista às partes para manifestação em quinze dias sobre a produção de outras provas.",
      15,
    ],
    ["requerendo o que de direito. Prazo: 15 dias.", 15],
    ["Requerente manifestar em termos de prosseguimento. Prazo 15 dias.", 15],
    [
      "ao Ministério Público Federal para eventual manifestação, no prazo comum de 10 (dez) dias.",
      10,
    ],
    [
      "intimada a se manifestar no prazo de 2 (dias) úteis, sobre o pedido de desbloqueio.",
      2,
    ],
    ["apresentar defesa dentro de 10 dias", 10],
    /* Instructions, never deadlines. */
    [
      "juntar até 05 (cinco) dias antes da perícia designada, cópias dos documentos médicos.",
      null,
    ],
    [
      "plataforma Jus.br, até 5 dias úteis antes da data da realização da perícia.",
      null,
    ],
    ["comparecer 3 dias antes da audiência", null],
    ["Decorrido o prazo, o processo será encaminhado à Turma Recursal.", null],
  ];

  for (const [text, expected] of cases) {
    it(`reads ${expected === null ? "no deadline" : `${expected} days`} in "${text.slice(0, 46)}"`, () => {
      expect(extractAct({ text, documentType: null }).days).toBe(expected);
    });
  }

  it("names the object the way the courts write it", () => {
    expect(
      extractAct({
        text: "Vista à parte autora para em quinze dias se manifestar sobre o laudo pericial.",
        documentType: null,
      }).object,
    ).toBe("Manifestação sobre laudo");
    expect(
      extractAct({
        text: "Vista às partes para manifestação em quinze dias sobre a produção de outras provas.",
        documentType: null,
      }).object,
    ).toBe("Manifestação sobre outras provas");
  });
});

/*
 * The second sweep over the same live corpus, on 2026-08-12. Every act with no
 * deadline recognised was classified one by one, and these are the literal
 * spellings that were missing, each one taken from the act it appeared in.
 */
describe("Deadline shapes found on the second sweep", () => {
  it("reads the number written twice after the preposition", () => {
    /* Third federal region, act of 2026-06-24. */
    expect(
      extractAct({
        text: "acerca da proposta de acordo formulada nos autos pela parte contrária, em 5 (cinco) dias. Int.",
        documentType: null,
      }).days,
    ).toBe(5);
    /* Paraná court, acts of 2026-02-11 and 2026-03-27. */
    expect(
      extractAct({
        text: "e do ofício de mov. 49816, em 05 (cinco) dias, digam as Recuperandas e o Administrador Judicial.",
        documentType: null,
      }).days,
    ).toBe(5);
  });

  it("reads an act delivered as HTML", () => {
    /* São Paulo court, act of 2026-04-27, exactly as it arrives. */
    expect(
      extractAct({
        text: "<p>à(s) r&eacute;plica(s) pelo(a)(s) autor(a)(es) em <strong>15 (quinze) dias &uacute;teis</strong>, nos termos dos artigos 350 e 351 do C&oacute;digo de Processo Civil.</p>",
        documentType: null,
      }).days,
    ).toBe(15);
    /* São Paulo court, act of 2026-02-19. */
    expect(
      extractAct({
        text: "<strong>Cite-se e intime-se a parte r&eacute;. </strong>O prazo para contesta&ccedil;&atilde;o de 15 (quinze) dias &uacute;teis (CPC, art. 335, caput)",
        documentType: null,
      }).days,
    ).toBe(15);
  });

  it("decodes the markup without touching the text of the act", () => {
    expect(fromHtml("15 (quinze) dias &uacute;teis")).toBe(
      "15 (quinze) dias úteis",
    );
    expect(fromHtml("<p>a&nbsp;b</p>")).toBe("a b ");
    expect(fromHtml("sem marcação")).toBe("sem marcação");
  });

  it("refuses to compute a deadline counted from another event", () => {
    /* Fourth federal region, act of 2026-06-22: ten business days after the
     * expert examination, which is not the publication. */
    const act = extractAct({
      text: "formul&aacute;rio pr&oacute;prio disponibilizado no eproc em at&eacute; 10 (dez) dias &uacute;teis, ap&oacute;s a per&iacute;cia.",
      documentType: null,
    });
    expect(act.days).toBeNull();
    expect(act.residue.join(" ")).toContain("outro evento");
  });

  it("sends a waiting order to a human instead of guessing", () => {
    /* São Paulo court, act of 2026-05-12: the court waits, and whether that
     * obliges the office is a judgement nobody automates. */
    const act = extractAct({
      text: "Para apreciação do pedido de desistência da ação, aguarde-se, por 15 dias, a juntada da Certidão de Óbito da requerida.",
      documentType: null,
    });
    expect(act.days).toBeNull();
    expect(act.residue).toContain("prazo em dias");
  });

  it("does not take years or hours for a deadline in days", () => {
    expect(
      extractAct({
        text: "fica condicionado à demonstração, pelo credor, no prazo de 5 (cinco) anos, que deixou de existir a situação",
        documentType: null,
      }).days,
    ).toBeNull();
    expect(
      extractAct({
        text: "até 48 (quarenta e oito) horas antes do início da sessão e deferido pelo Relator",
        documentType: null,
      }).days,
    ).toBeNull();
  });

  it("does not confuse a lawyer named Dias with a deadline", () => {
    const act = extractAct({
      text: "ADV: ARTHUR OLIVEIRA DIAS DA SILVA (OAB 434612/SP), AMANDA STÊNICO BICUDO (OAB 419058/SP)",
      documentType: null,
    });
    expect(act.days).toBeNull();
    expect(mentionsTimeQuantity(act.actType ?? "")).toBe(false);
  });
});

describe("live search of the entity", () => {
  it("does not search for an ordinary case question", () => {
    expect(
      questionNeedsLiveSearch("Qual a fase atual do caso 2024.0187?"),
    ).toBe(false);
    expect(
      questionNeedsLiveSearch("Quais audiências temos nesta semana?"),
    ).toBe(false);
  });

  it("searches on an explicit request and on an external topic", () => {
    expect(
      questionNeedsLiveSearch("Pesquise na internet o valor do INPC"),
    ).toBe(true);
    expect(questionNeedsLiveSearch("Qual o teto do INSS este ano?")).toBe(true);
    expect(
      questionNeedsLiveSearch("Houve notícia sobre a nova perícia federal?"),
    ).toBe(true);
  });

  it("removes client names and identifier patterns from the query", () => {
    const { query, minimized } = minimizeQuery(
      "Pesquise jurisprudência para Maria Aparecida da Silva, CPF 123.456.789-01, processo 1234567-89.2026.4.03.6100, contato maria@exemplo.com.br",
      ["Maria Aparecida da Silva"],
    );
    expect(minimized).toBe(true);
    expect(query).not.toContain("Maria Aparecida");
    expect(query).not.toContain("123.456.789-01");
    expect(query).not.toContain("1234567-89.2026.4.03.6100");
    expect(query).not.toContain("maria@exemplo.com.br");
  });

  it("keeps an ordinary query untouched", () => {
    const { query, minimized } = minimizeQuery(
      "Pesquise o salário mínimo vigente em 2026",
      ["Maria Aparecida da Silva"],
    );
    expect(minimized).toBe(false);
    expect(query).toBe("Pesquise o salário mínimo vigente em 2026");
  });
});

describe("Answer formatting, parsed for the panel", () => {
  it("turns bold markers into a bold node", () => {
    expect(parseInline("O **prazo confirmado** vence amanhã")).toEqual([
      { kind: "text", text: "O " },
      { kind: "bold", text: "prazo confirmado" },
      { kind: "text", text: " vence amanhã" },
    ]);
  });

  it("groups asterisk and hyphen items into one real list", () => {
    const blocks = parseAnswer("Fontes:\n* Título: Decreto\n- Endereço: site");
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({ kind: "list", ordered: false });
    if (blocks[1]?.kind === "list") {
      expect(blocks[1].items).toHaveLength(2);
    }
  });

  it("links an explicit destination and a bare address, http only", () => {
    const [link] = parseInline("[Planalto](https://www.planalto.gov.br)");
    expect(link).toEqual({
      kind: "link",
      text: "Planalto",
      url: "https://www.planalto.gov.br",
    });
    const bare = parseInline("Veja https://g1.globo.com/noticia agora");
    expect(bare[1]).toMatchObject({
      kind: "link",
      url: "https://g1.globo.com/noticia",
    });
  });

  it("never links a destination outside http and https", () => {
    const nodes = parseInline("[clique](javascript:alert(1))");
    expect(nodes.every((node) => node.kind !== "link")).toBe(true);
  });

  it("keeps markup-shaped text as literal text, never as structure", () => {
    const blocks = parseAnswer("<script>alert(1)</script>");
    expect(blocks[0]).toMatchObject({ kind: "paragraph" });
    if (blocks[0]?.kind === "paragraph") {
      expect(blocks[0].lines[0]?.[0]).toEqual({
        kind: "text",
        text: "<script>alert(1)</script>",
      });
    }
  });
});
