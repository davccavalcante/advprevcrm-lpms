import type { RiskClassifier } from "@teleologyhi-sdk/nhe";

/*
 * The risk classifier of this office. It reads the request in Brazilian
 * Portuguese, the language the lawyers actually type, and emits the tags MAIC's
 * rule pack decides on. Transparent by construction: every tag traces to a
 * pattern written here, so a refusal can always be explained.
 *
 * This is the amygdala of the body: it does not decide, it flags. The decision
 * is MAIC's, in office-rules.ts, and it happens before the model is called.
 */

type Pattern = { tag: string; test: RegExp };

const PATTERNS: Pattern[] = [
  {
    tag: "deadline:confirm",
    test: /\b(confirm[ae]r?|confirma|valide|validar|dar por confirmado)\b[^.?!]{0,60}\bprazo/i,
  },
  {
    tag: "deadline:confirm",
    test: /\bprazo\b[^.?!]{0,60}\b(confirm[ae]r?|confirmad[oa]|validar)\b/i,
  },
  {
    tag: "filing:electronic",
    test: /\b(protocol[ae]r?|protocole|peticion[ae]r?|ajuiz[ae]r?|dar entrada)\b[^.?!]{0,60}\b(peça|petição|recurso|réplica|contrarrazões|no pje|no sistema|no tribunal)/i,
  },
  {
    tag: "communication:external",
    test: /\b(envi[ae]r?|envie|mand[ae]r?|dispar[ae]r?|responder ao cliente)\b[^.?!]{0,60}\b(e-?mail|mensagem|whatsapp|carta|notificação|ao cliente|para o cliente|à cliente)/i,
  },
  {
    tag: "opinion:conclusive",
    test: /\b(chance|probabilidade|percentual|vou ganhar|vamos ganhar|garante|garantia|certeza)\b[^.?!]{0,60}\b(ganhar|êxito|procedência|vitória|causa|ação|caso)/i,
  },
  {
    tag: "opinion:conclusive",
    test: /\b(qual|quais|me d[êe])\b[^.?!]{0,40}\b(chance|probabilidade)s?\b/i,
  },
  {
    tag: "identity:direct-identifier",
    test: /\b(cpf|rg|carteira de identidade|endereço|telefone|celular|e-?mail)\b[^.?!]{0,40}\b(d[oae]|desse|dessa|do cliente|da cliente)\b/i,
  },
  {
    tag: "disclosure:constitutional",
    test: /\b(signo|astrolog|mapa astral|ascendente|hor[óo]scopo|arqu[ée]tipo|junguian|jung|pid-?5|hexaco|persona vector|espiritismo|kardec|pante[íi]sta|religi[ãa]o|filosofia|teleolog)/i,
  },
  {
    tag: "domain:write-attempt",
    test: /\b(altere|alterar|edite|editar|apague|apagar|exclu[ai]|excluir|delete|deletar|feche|fechar|encerre|encerrar)\b[^.?!]{0,60}\b(caso|cliente|cadastro|prazo|documento|conversa|auditoria|registro)/i,
  },
];

export const officeRiskClassifier: RiskClassifier = (userPrompt: string) => {
  const tags = new Set<string>();
  for (const pattern of PATTERNS) {
    if (pattern.test.test(userPrompt)) {
      tags.add(pattern.tag);
    }
  }
  return [...tags];
};
