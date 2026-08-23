import type {
  Communication,
  LinkSuggestion,
} from "@/lib/capture/communication";
import { canonicalProcessNumber } from "@/lib/capture/process-number";
import type { CaseWithClient } from "@/lib/records-store";

/*
 * Which case a communication belongs to.
 *
 * By the process number the answer is certain: the number is unique, it is
 * validated by its own check digits, and a case that carries it is that case. So
 * the link is automatic.
 *
 * By the name of the party the answer is never certain. Homonyms, abbreviations,
 * accents and divergent spellings are the ordinary state of a name in Brazil, so
 * a name only ever produces a suggestion, with the similarity it earned, for a
 * human to confirm. Automation never links by name, and a communication that
 * matched nothing is not discarded: it waits, in sight, in the queue of the
 * unlinked.
 */

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Particles carry no identity and only inflate a similarity. */
const NAME_NOISE = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "di",
  "du",
  "van",
  "von",
]);

function nameTokens(value: string): string[] {
  return normaliseName(value)
    .split(" ")
    .filter((token) => token.length > 1 && !NAME_NOISE.has(token));
}

/*
 * Similarity between two names, zero to one hundred. It is the share of the
 * shorter name's parts that appear in the longer one, with the first and the
 * last part weighing more, because those are the parts a court writes in full.
 */
export function nameSimilarity(left: string, right: string): number {
  const a = nameTokens(left);
  const b = nameTokens(right);
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const setB = new Set(b);
  const shared = a.filter((token) => setB.has(token));
  const base = shared.length / Math.min(a.length, b.length);

  const firstMatches = a[0] !== undefined && a[0] === b[0];
  const lastMatches =
    a[a.length - 1] !== undefined && a[a.length - 1] === b[b.length - 1];
  const anchors = (firstMatches ? 0.5 : 0) + (lastMatches ? 0.5 : 0);

  /* Two thirds from how much of the name matched, one third from the anchors. */
  return Math.round((base * 0.67 + anchors * 0.33) * 100);
}

/* Below this a suggestion is noise and is not shown. It is a floor for a human
 * decision, never a threshold for an automatic one. */
export const SUGGESTION_FLOOR = 55;

export type LinkOutcome =
  | {
      kind: "linked";
      clientId: string;
      caseId: string;
      reason: string;
    }
  | { kind: "suggested"; suggestions: LinkSuggestion[] }
  | { kind: "unlinked"; reason: string };

function caseLabel(entry: CaseWithClient): string {
  return entry.record.reference?.trim().length
    ? `${entry.record.reference.trim()}, ${entry.record.caseType}`
    : entry.record.caseType;
}

/*
 * The decision. The process number of the communication is compared with the
 * number registered on the case, both in the canonical form of twenty digits, so
 * a number written with punctuation on one side and without it on the other is
 * still the same number.
 */
export function resolveLink(
  communication: Communication,
  cases: CaseWithClient[],
): LinkOutcome {
  if (communication.processNumber !== null) {
    const matches = cases.filter((entry) => {
      const registered = entry.record.lawsuitNumber;
      if (registered === undefined || registered.trim().length === 0) {
        return false;
      }
      return canonicalProcessNumber(registered) === communication.processNumber;
    });
    if (matches.length === 1 && matches[0] !== undefined) {
      const only = matches[0];
      return {
        kind: "linked",
        clientId: only.client.id,
        caseId: only.record.id,
        reason:
          "Número do processo da comunicação igual ao número cadastrado no caso.",
      };
    }
    if (matches.length > 1) {
      /* Two cases claiming the same process number is a registration defect, and
       * the office decides it, never the machine. */
      return {
        kind: "suggested",
        suggestions: matches.map((entry) => ({
          clientId: entry.client.id,
          caseId: entry.record.id,
          clientName: entry.client.fullName,
          caseLabel: caseLabel(entry),
          score: 100,
          reason:
            "Mais de um caso cadastrado com este mesmo número de processo. O vínculo depende de decisão humana.",
        })),
      };
    }
  }

  const names = [
    ...communication.recipients,
    ...communication.lawyers.map((lawyer) => lawyer.name),
  ];
  const suggestions: LinkSuggestion[] = [];
  for (const entry of cases) {
    let best = 0;
    let matched = "";
    for (const name of names) {
      const score = nameSimilarity(name, entry.client.fullName);
      if (score > best) {
        best = score;
        matched = name;
      }
    }
    if (best >= SUGGESTION_FLOOR) {
      suggestions.push({
        clientId: entry.client.id,
        caseId: entry.record.id,
        clientName: entry.client.fullName,
        caseLabel: caseLabel(entry),
        score: best,
        reason: `Semelhança de ${best} por cento entre "${matched}" na comunicação e "${entry.client.fullName}" no cadastro. Vínculo por nome nunca é automático.`,
      });
    }
  }

  if (suggestions.length > 0) {
    return {
      kind: "suggested",
      suggestions: suggestions.sort((a, b) => b.score - a.score).slice(0, 5),
    };
  }

  return {
    kind: "unlinked",
    reason:
      communication.processNumber === null
        ? "A comunicação não trouxe número de processo reconhecível e nenhum nome se aproximou de um cliente cadastrado."
        : "Nenhum caso cadastrado carrega este número de processo e nenhum nome se aproximou de um cliente cadastrado.",
  };
}
