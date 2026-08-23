import type { RulePack } from "@teleologyhi-sdk/maic";

/*
 * MAIC as executed policy for this office. Every rule cites an axiom that was
 * minted and signed, and every verdict is produced by the review pipeline
 * before the model is reached, or after it produced text and before the lawyer
 * reads it. Nothing here is an instruction addressed to a model: this file
 * decides, and the decision is written to the hash-chained audit.
 *
 * Verdict severity, lowest to highest: approve, approve-with-warning,
 * soft-correct, induce-dream, require-redirect, hard-refuse, escalate-creator.
 * When several rules fire, the highest severity wins.
 */

export const OFFICE_RULE_PACK: RulePack = {
  name: "advprev-office-policy",
  rules: [
    {
      id: "deadline-confirmation-is-human",
      axiomIds: ["ax.office.deadline-human-confirmation"],
      match: { anyRiskTags: ["deadline:confirm"] },
      verdict: "hard-refuse",
      reasonSummary:
        "A confirmação de prazo é ato humano do advogado, registrado em auditoria. Nenhuma automação confirma prazo neste escritório.",
    },
    {
      id: "no-electronic-filing",
      axiomIds: ["ax.office.no-electronic-filing"],
      match: { anyRiskTags: ["filing:electronic"] },
      verdict: "hard-refuse",
      reasonSummary:
        "Não existe protocolo eletrônico automático de peça. A preparação e a conferência são possíveis; o protocolo é ato do advogado, com o seu certificado digital.",
    },
    {
      id: "external-communication-needs-approval",
      axiomIds: ["ax.office.human-approved-communication"],
      match: { anyRiskTags: ["communication:external"] },
      verdict: "require-redirect",
      reasonSummary:
        "Comunicação externa a cliente ou a terceiro exige aprovação humana registrada antes do envio. O rascunho pode ser preparado; o envio não.",
    },
    {
      id: "no-conclusive-opinion",
      axiomIds: ["ax.office.no-conclusive-opinion"],
      match: { anyRiskTags: ["opinion:conclusive"] },
      verdict: "require-redirect",
      reasonSummary:
        "Não se afirma resultado provável de forma peremptória nem se emite parecer conclusivo. O que existe é o registro do caso e o que ele demonstra.",
    },
    {
      id: "direct-identifier-not-in-context",
      axiomIds: ["ax.office.data-minimization"],
      match: { anyRiskTags: ["identity:direct-identifier"] },
      verdict: "soft-correct",
      reasonSummary:
        "Identificadores diretos de pessoa natural não entram no contexto por minimização. O dado está no cadastro do escritório, acessível ao advogado na tela.",
    },
    {
      id: "constitutional-internals-are-not-office-talk",
      axiomIds: ["ax.office.domain-speech"],
      match: { anyRiskTags: ["disclosure:constitutional"] },
      verdict: "soft-correct",
      reasonSummary:
        "A constituição interna da entidade e as convicções do Criador não são assunto de conversa no escritório. A entidade diz o que é quando perguntada, sem entrar em futilidade, e volta ao trabalho.",
    },
    {
      id: "domain-is-read-only",
      axiomIds: ["ax.office.traceable-answer"],
      match: { anyRiskTags: ["domain:write-attempt"] },
      verdict: "soft-correct",
      reasonSummary:
        "A entidade lê o domínio e não escreve nele. Alteração de cadastro, de caso, de prazo ou de documento é ação do advogado na tela, com registro em auditoria.",
    },
  ],
};
