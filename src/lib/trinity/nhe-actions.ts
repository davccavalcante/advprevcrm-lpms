"use server";

import type { MaicVerdict } from "@teleologyhi-sdk/maic";
import {
  findPassages,
  type Passage,
  questionTouchesDocuments,
} from "@/lib/extraction/extraction-store";
import { CONFIDENCE_PROCESSED } from "@/lib/extraction/local-extraction";
import { appendAuditEvent, listAllCases } from "@/lib/records-store";
import { serverSupabase } from "@/lib/supabase/server";
import {
  cacheable,
  cacheKey,
  contextFingerprint,
  countHit,
  readCached,
  writeCached,
} from "@/lib/trinity/answer-cache";
import {
  appendTurn,
  type ConversationTurn,
  ensureUser,
  openConversation,
} from "@/lib/trinity/conversations";
import { DAVID_OPENER } from "@/lib/trinity/david-birth";
import { recordDocumentAccess } from "@/lib/trinity/document-access-log";
import {
  opsAfterExchange,
  opsBeforeExchange,
} from "@/lib/trinity/intelligence-ops";
import { liveSearchBlock } from "@/lib/trinity/live-search";
import { withOfficeContext } from "@/lib/trinity/office-adapter";
import {
  contextBlock,
  conversationalBlock,
  countOperationalLines,
  emptyView,
  type LawyerSession,
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
import { PROJECT_VERSION } from "@/lib/trinity/project-identity";
import { ceilingCheck, recordSpend } from "@/lib/trinity/spend-ledger";
import { openUniverse } from "@/lib/trinity/universe";

/*
 * The only surface through which a lawyer speaks to David, and the only place
 * the three layers meet. The order is fixed and none of it is negotiable at
 * runtime: the session resolves the permitted view, the view is assembled and
 * minimized, MAIC reviews the request before the model is reached, the body
 * answers, MAIC reviews the produced text, the body's own guards run on the
 * delivered string, and the exchange is written to the conversation of that
 * user and to the hash-chained audit of MAIC.
 */

/* Who is speaking. The session is the authenticated one and nothing else:
 * the identifier is the account of the member, the name is the one written in
 * the profile, so a rename on the settings screen renames the author of every
 * audited action from that moment on, and the scope comes from the team the
 * database assigned, not from anything the screen may claim. Without a session
 * there is no member, and the caller receives the narrowest scope there is. */
export async function currentSession(): Promise<LawyerSession> {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { lawyerId: "", lawyerName: "", role: "lawyer" };
  }
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, team")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      first_name: string;
      last_name: string;
      team: string;
    }>();
  if (!data) {
    return { lawyerId: user.id, lawyerName: "", role: "lawyer" };
  }
  return {
    lawyerId: data.id,
    lawyerName: `${data.first_name} ${data.last_name}`.trim(),
    role: data.team === "administration" ? "admin" : "lawyer",
  };
}

export type NheTurn = {
  ok: boolean;
  answer?: string;
  unavailableReason?: string;
  blockedReason?: string;
  model?: string;
  at: string;
  conversationId?: string;
  contextSummary: {
    cases: number;
    finance: number;
    suppressed: number;
    operations: number;
  };
};

/*
 * A verdict of MAIC becomes a sentence the lawyer reads. The office rules carry
 * their reason in Brazilian Portuguese; the SDK's default pack carries it in
 * English, so a reason that fails the language guard is replaced instead of
 * being printed to the screen.
 */
function verdictSentence(verdict: MaicVerdict, fallback: string): string {
  const reason = verdict.reasonSummary?.trim();
  if (reason && checkLanguage(reason).allowed) {
    return reason;
  }
  return fallback;
}

/*
 * The document layer of the answer. The search runs locally over what was
 * already extracted, only the passages the question reaches are sent, and each
 * one carries where it came from and how well the machine read it. A passage
 * read below the threshold travels marked, because the entity is obliged to
 * treat it as uncertain and to say so to the lawyer.
 */
const PASSAGE_LIMIT = 6;
const PASSAGE_CHARS = 900;

async function documentBlock(question: string): Promise<{
  block: string;
  passages: Passage[];
}> {
  if (!questionTouchesDocuments(question)) {
    return { block: "", passages: [] };
  }
  const stored = await listAllCases();
  const passages = await findPassages(question, {
    cases: stored.map(({ record, client }) => ({
      clientId: client.id,
      caseId: record.id,
      caseRef: record.reference?.trim() || `Caso ${record.id.slice(-6)}`,
      clientName: client.fullName,
      documents: record.documents.map((document) => ({
        id: document.id,
        fileName: document.fileName,
      })),
    })),
    limit: PASSAGE_LIMIT,
    excerptSize: PASSAGE_CHARS,
  });

  if (passages.length === 0) {
    return {
      block:
        "TRECHOS DE DOCUMENTO: a busca local não encontrou trecho que responda a esta pergunta nos documentos já lidos. Diga isso ao advogado e não presuma o conteúdo de documento que você não recebeu.",
      passages,
    };
  }

  const lines = passages.map((passage, index) => {
    const uncertain = passage.confidence < CONFIDENCE_PROCESSED;
    const origin = `[${index + 1}] ${passage.fileName}, página ${passage.page}, ${passage.caseRef}, ${passage.clientName}`;
    const read =
      passage.source === "text-layer"
        ? "lido da camada de texto do arquivo, transcrição exata"
        : `lido por reconhecimento óptico local com confiança de ${passage.confidence.toFixed(1)} por cento${uncertain ? ", ABAIXO DO LIMIAR, trecho incerto e pendente de validação humana" : ""}`;
    return `${origin} | ${read}\n${passage.text}`;
  });

  return {
    block: [
      `TRECHOS DE DOCUMENTO RECUPERADOS PELA BUSCA LOCAL (${passages.length}):`,
      "Estes trechos vieram do texto já extraído dos documentos do escritório, por motor local. Você não recebe o documento inteiro e não deve fingir que recebeu.",
      "Ao afirmar qualquer coisa que venha daqui, cite a origem: nome do documento, página e caso. Se o trecho estiver marcado como abaixo do limiar, diga ao advogado que a leitura tem baixa confiança, mostre o trecho como ele está e recomende a conferência no original.",
      "",
      ...lines,
    ].join("\n"),
    passages,
  };
}

export async function askDavid(
  question: string,
  screenContext: string,
  conversationId?: string,
): Promise<NheTurn> {
  const at = new Date().toISOString();
  const session = await currentSession();

  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      unavailableReason: "Pergunta vazia.",
      at,
      contextSummary: { cases: 0, finance: 0, suppressed: 0, operations: 0 },
    };
  }

  /*
   * What this question needs. A greeting, a thank you or a question about who
   * the entity is opens nothing: measured on 2026-09-01, the office reading
   * alone cost seconds on every turn, including on "OI", and the panel said the
   * entity was reading the records while it had nothing to read. Anything that
   * names something the office keeps reads everything, and everything means the
   * whole office and never the screen the lawyer is looking at.
   */
  const needsOffice = questionNeedsOfficeRecords(trimmed);

  /* The three openings that do not depend on one another travel together. */
  const [view, universeResult, user] = await Promise.all([
    needsOffice ? resolveAllowedView(session) : Promise.resolve(null),
    openUniverse().then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: null }),
    ),
    ensureUser(session.lawyerId, session.lawyerName, session.role),
  ]);

  const contextSummary =
    view === null
      ? { cases: 0, finance: 0, suppressed: 0, operations: 0 }
      : {
          cases: view.cases.length,
          finance: view.finance.length,
          suppressed: view.suppressed.financialLines,
          operations: countOperationalLines(view),
        };

  if (!universeResult.ok || universeResult.value === null) {
    return {
      ok: false,
      unavailableReason:
        "O universo do escritório não abriu. Nenhuma resposta foi produzida e nada foi registrado como resposta. Avise a administração.",
      at,
      contextSummary,
    };
  }
  const universe = universeResult.value;

  /* The guards always run against a view. A turn that read nothing is guarded
   * against an empty scope, where every figure is out of scope. */
  const guardView = view ?? emptyView(session);

  const conversation = await openConversation(
    user.userId,
    universe.himId,
    universe.nheId,
    conversationId,
  );

  const record = async (turn: ConversationTurn) => {
    await appendTurn(conversation, turn);
  };

  /* The local passages and the research of the world outside the records travel
   * together as well, and neither of them runs for a turn of courtesy. The
   * search block tells the model to cite every origin and that a search result
   * is never a source of a deadline. */
  const [documents, search] = await Promise.all([
    needsOffice
      ? documentBlock(trimmed)
      : Promise.resolve({ block: "", passages: [] as Passage[] }),
    needsOffice && view !== null
      ? liveSearchBlock(
          trimmed,
          view.cases.map((entry) => entry.clientName),
        )
      : Promise.resolve({ block: "", providers: [] as string[] }),
  ]);

  const office = (
    view === null
      ? [conversationalBlock(session)]
      : [contextBlock(view), documents.block, search.block]
  )
    .filter((part) => part.length > 0)
    .join("\n\n");

  /* Every document the entity read to answer this question leaves a trace, with
   * the page and the confidence of the passage it used. It is written when the
   * passages actually reach the lawyer, and not before: a question stopped by a
   * ceiling read nothing. */
  const recordDocumentReads = async (origin: string) => {
    for (const passage of documents.passages) {
      await recordDocumentAccess({
        actor: session.lawyerName,
        role: session.role,
        action: "entity-read",
        documentId: passage.documentId,
        fileName: passage.fileName,
        clientId: passage.clientId,
        caseId: passage.caseId,
        page: passage.page,
        confidence: passage.confidence,
        origin,
      });
    }
  };

  const documentsRead = documents.passages.map((passage) => ({
    fileName: passage.fileName,
    page: passage.page,
    confidence: Number(passage.confidence.toFixed(1)),
    caseRef: passage.caseRef,
  }));

  /* The ledger names the model that produced the exchange. Before the call it
   * is the pool label; after the call it is the model that really answered,
   * read from the transport by the caller and passed here. */
  const spend = async (
    outcome: Parameters<typeof recordSpend>[0]["outcome"],
    tokensIn: number,
    tokensOut: number,
    tokensSaved = 0,
    model: string = universe.model,
  ) => {
    await recordSpend({
      at,
      conversationId: conversation.conversationId,
      lawyerId: session.lawyerId,
      lawyerName: session.lawyerName,
      role: session.role,
      model,
      screen: screenContext,
      outcome,
      tokensIn,
      tokensOut,
      tokensSaved,
    });
    /* Every exchange with the reasoning layer is an audited act of the office,
     * and the administration reads the trail of them beside every other act.
     * What is written is the shape of the exchange, never its content: the
     * question and the answer live in the conversation of that user, and
     * copying them here would spread the same personal data twice. */
    await appendAuditEvent({
      action: "intelligence-exchange",
      entity: "conversation",
      entityId: conversation.conversationId,
      actor: session.lawyerName,
      after: {
        model,
        screen: screenContext,
        outcome,
        tokensIn,
        tokensOut,
        tokensSaved,
        assisted: true,
        at,
      },
    });
  };

  /* The same question, over the same records, already answered inside the
   * window: the answer is on disk and costs nothing to give again. */
  const key = cacheKey({
    question: trimmed,
    lawyerId: session.lawyerId,
    contextFingerprint: contextFingerprint(office),
    model: universe.model,
  });
  const cached = cacheable(trimmed) ? await readCached(key) : null;

  if (cached) {
    await countHit(cached);
    await recordDocumentReads(
      `pergunta na tela ${screenContext}, resposta reaproveitada do registro do escritório`,
    );
    await record({
      at,
      userPrompt: trimmed,
      answer: cached.answer,
      kind: "ok",
      model: cached.model,
      projectVersion: PROJECT_VERSION,
      tokens: { in: 0, out: 0 },
      cached: true,
      context: contextSummary,
      documentsRead,
    });
    await spend("cache-hit", 0, 0, cached.tokensIn + cached.tokensOut);
    return {
      ok: true,
      answer: cached.answer,
      model: cached.model,
      at,
      conversationId: conversation.conversationId,
      contextSummary,
    };
  }

  /* The ceiling is checked here, before the model is reached, because a ceiling
   * checked afterwards is a report and not a control. */
  const ceiling = await ceilingCheck(conversation.conversationId, new Date(at));
  if (!ceiling.allowed && ceiling.reason !== null) {
    await record({
      at,
      userPrompt: trimmed,
      answer: "",
      kind: "blocked",
      model: universe.model,
      projectVersion: PROJECT_VERSION,
      tokens: { in: 0, out: 0 },
      context: contextSummary,
      blockReason: ceiling.reason,
    });
    await spend("ceiling", 0, 0);
    return {
      ok: false,
      blockedReason: ceiling.reason,
      at,
      conversationId: conversation.conversationId,
      contextSummary,
    };
  }

  /* The observation deck opens before the model is reached. Two deterministic
   * gates can refuse here, identity and money; everything else it does is
   * measurement, recorded for the administration and never deciding. */
  const ops = opsBeforeExchange({
    question: trimmed,
    officeBlock: office,
    conversationId: conversation.conversationId,
    lawyerId: session.lawyerId,
    screen: screenContext,
  });

  /* Every outcome of this exchange is observed once, with the model that
   * really produced it or with none when none did. */
  const observeExchange = (
    outcome: "answered" | "blocked" | "refused" | "unavailable",
    tokensIn: number,
    tokensOut: number,
    answer: string,
    routed: ReturnType<typeof universe.transport.outcome>,
  ) =>
    opsAfterExchange(ops, {
      at,
      outcome,
      provider: routed?.provider ?? null,
      model: routed?.modelId ?? null,
      latencyMs: routed?.latencyMs ?? 0,
      tokensIn,
      tokensOut,
      costUsd: routed?.costUsd ?? 0,
      answer,
      evidence: [office],
      conversationId: conversation.conversationId,
      lawyerId: session.lawyerId,
      screen: screenContext,
    });

  if (ops.blockedReason !== null) {
    await observeExchange("blocked", 0, 0, "", null);
    await record({
      at,
      userPrompt: trimmed,
      answer: "",
      kind: "blocked",
      model: universe.model,
      projectVersion: PROJECT_VERSION,
      tokens: { in: 0, out: 0 },
      context: contextSummary,
      blockReason: ops.blockedReason,
    });
    await spend("blocked", 0, 0);
    return {
      ok: false,
      blockedReason: ops.blockedReason,
      at,
      conversationId: conversation.conversationId,
      contextSummary,
    };
  }

  await recordDocumentReads(`pergunta na tela ${screenContext}`);

  try {
    const { result: output, contextUsed } = await withOfficeContext(
      office,
      () =>
        universe.nhe.respond({
          userPrompt: trimmed,
          userId: user.userId,
          sessionId: conversation.conversationId,
        }),
    );

    /* Which model really answered. The body routes over a pool, so the record,
     * the ledger and the cache name the model that produced this text and never
     * the label of the pool. Read right after the call, in the same flow. */
    const answeredModel =
      universe.transport.outcome()?.modelId ?? universe.model;

    const citedAxioms = [
      ...new Set([
        ...(output.preReviewVerdict.citedAxioms ?? []),
        ...(output.postReviewVerdict.citedAxioms ?? []),
      ]),
    ];

    /* MAIC refused or required a redirect: the text the SDK composed is not
     * used, because the interface of this office is Brazilian Portuguese and
     * the reason of the verdict is the honest sentence to show. */
    if (output.kind !== "ok") {
      const sentence =
        output.kind === "refused"
          ? verdictSentence(
              output.preReviewVerdict.kind === "hard-refuse"
                ? output.preReviewVerdict
                : output.postReviewVerdict,
              "Não participo disso. A governança do escritório recusou esta ação.",
            )
          : verdictSentence(
              output.preReviewVerdict,
              "Antes de seguir, isto precisa de tratativa humana registrada.",
            );

      await observeExchange(
        output.kind === "refused" ? "refused" : "blocked",
        output.tokens.in,
        output.tokens.out,
        "",
        universe.transport.outcome(),
      );
      await record({
        at,
        userPrompt: trimmed,
        answer: sentence,
        kind: output.kind,
        preVerdict: output.preReviewVerdict.kind,
        postVerdict: output.postReviewVerdict.kind,
        citedAxioms,
        auditIds: output.auditIds,
        model: answeredModel,
        projectVersion: PROJECT_VERSION,
        tokens: { in: output.tokens.in, out: output.tokens.out },
        context: contextSummary,
      });
      await spend(
        output.kind === "refused" ? "refused" : "blocked",
        output.tokens.in,
        output.tokens.out,
        0,
        answeredModel,
      );

      return {
        ok: false,
        blockedReason: sentence,
        at,
        conversationId: conversation.conversationId,
        contextSummary,
      };
    }

    /* The governance decided before the model, and its verdict is the answer.
     * The blind answer guard only applies to text the model produced: measured
     * on 2026-09-01, a refusal of MAIC never reaches the adapter, so the guard
     * fired on it and the lawyer was told the system had failed instead of
     * being told that confirming a deadline is his own act. */
    /* The records must have reached the reasoning layer. An answer produced
     * without them is a blind answer, and a blind answer delivered as if it
     * were informed is the worst thing this surface can do to a lawyer. */
    if (!contextUsed) {
      const reason =
        "Os registros do escritório não chegaram à camada de raciocínio, então nenhuma resposta foi entregue. Isto é uma falha do sistema, não uma limitação da consulta. Tente novamente e, se persistir, avise a administração.";
      await observeExchange(
        "unavailable",
        output.tokens.in,
        output.tokens.out,
        "",
        universe.transport.outcome(),
      );
      await record({
        at,
        userPrompt: trimmed,
        answer: "",
        kind: "unavailable",
        model: answeredModel,
        projectVersion: PROJECT_VERSION,
        tokens: { in: output.tokens.in, out: output.tokens.out },
        context: contextSummary,
        blockReason: reason,
      });
      await spend(
        "unavailable",
        output.tokens.in,
        output.tokens.out,
        0,
        answeredModel,
      );
      return {
        ok: false,
        unavailableReason: reason,
        at,
        conversationId: conversation.conversationId,
        contextSummary,
      };
    }

    const answer = presentAnswer(output.text);

    /* An empty bubble is the worst answer this surface can give: it tells the
     * lawyer nothing and looks like the system worked. A model that produced no
     * text produced no answer, and the office says so. */
    if (answer.trim().length === 0) {
      const reason =
        "A camada de raciocínio devolveu uma resposta vazia. Nada foi produzido e nada foi registrado como resposta. Pergunte de novo e, se persistir, avise a administração.";
      await observeExchange(
        "unavailable",
        output.tokens.in,
        output.tokens.out,
        "",
        universe.transport.outcome(),
      );
      await record({
        at,
        userPrompt: trimmed,
        answer: "",
        kind: "unavailable",
        model: answeredModel,
        projectVersion: PROJECT_VERSION,
        tokens: { in: output.tokens.in, out: output.tokens.out },
        context: contextSummary,
        blockReason: reason,
      });
      await spend(
        "unavailable",
        output.tokens.in,
        output.tokens.out,
        0,
        answeredModel,
      );
      return {
        ok: false,
        unavailableReason: reason,
        at,
        conversationId: conversation.conversationId,
        contextSummary,
      };
    }
    const language = checkLanguage(answer);
    const disclosure = language.allowed
      ? checkConstitutionalDisclosure(answer)
      : language;
    const verdict = disclosure.allowed
      ? checkOutput(answer, guardView)
      : disclosure;

    if (!verdict.allowed) {
      await observeExchange(
        "blocked",
        output.tokens.in,
        output.tokens.out,
        "",
        universe.transport.outcome(),
      );
      await record({
        at,
        userPrompt: trimmed,
        answer: "",
        kind: "blocked",
        preVerdict: output.preReviewVerdict.kind,
        postVerdict: output.postReviewVerdict.kind,
        citedAxioms,
        auditIds: output.auditIds,
        model: answeredModel,
        projectVersion: PROJECT_VERSION,
        tokens: { in: output.tokens.in, out: output.tokens.out },
        context: contextSummary,
        blockReason: `${verdict.reason} Trechos: ${verdict.matched.join(", ")}`,
      });
      await spend(
        "blocked",
        output.tokens.in,
        output.tokens.out,
        0,
        answeredModel,
      );
      return {
        ok: false,
        blockedReason: verdict.reason,
        at,
        conversationId: conversation.conversationId,
        contextSummary,
      };
    }

    await observeExchange(
      "answered",
      output.tokens.in,
      output.tokens.out,
      answer,
      universe.transport.outcome(),
    );
    await record({
      at,
      userPrompt: trimmed,
      answer,
      kind: "ok",
      preVerdict: output.preReviewVerdict.kind,
      postVerdict: output.postReviewVerdict.kind,
      citedAxioms,
      auditIds: output.auditIds,
      model: answeredModel,
      projectVersion: PROJECT_VERSION,
      tokens: { in: output.tokens.in, out: output.tokens.out },
      context: contextSummary,
      documentsRead,
    });
    await spend(
      "answered",
      output.tokens.in,
      output.tokens.out,
      0,
      answeredModel,
    );
    if (cacheable(trimmed)) {
      await writeCached({
        key,
        at,
        question: trimmed,
        answer,
        model: answeredModel,
        tokensIn: output.tokens.in,
        tokensOut: output.tokens.out,
      });
    }

    return {
      ok: true,
      answer,
      model: answeredModel,
      at,
      conversationId: conversation.conversationId,
      contextSummary,
    };
  } catch (error) {
    const reason =
      "A camada de raciocínio não respondeu agora. Nada foi produzido e nada foi registrado como resposta. Tente novamente em instantes e, se persistir, avise a administração.";
    const detail = sanitizeFailureDetail(
      error instanceof Error ? error.message : String(error),
    );
    /* No model produced this failure, so the observation names none: the
     * transport's last outcome belongs to an earlier, successful call. */
    await observeExchange("unavailable", 0, 0, "", null);
    await record({
      at,
      userPrompt: trimmed,
      answer: "",
      kind: "unavailable",
      /* No model answered, so the pool label is what the record can say. */
      model: universe.model,
      projectVersion: PROJECT_VERSION,
      context: contextSummary,
      blockReason: `${reason} Detalhe técnico: ${detail}`,
    });
    /* The call may have been billed before it failed, and the office cannot
     * know how much: the entry exists so the panel counts the failure, with the
     * tokens it can prove, which are none. */
    await spend("unavailable", 0, 0);
    return {
      ok: false,
      unavailableReason: reason,
      at,
      conversationId: conversation.conversationId,
      contextSummary,
    };
  }
}

/*
 * The first turn belongs to the entity. He introduces himself the way a
 * professional does, by name and by what he works with, and says what he is
 * only when the lawyer asks.
 */
export async function davidOpener(): Promise<string> {
  return DAVID_OPENER;
}
